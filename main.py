import os
import asyncio
import httpx
import base64
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch

app = FastAPI()

class EvalDGR(BaseModel):
    nom_agent: str
    prenom_agent: str
    nom_eval: str
    prenom_eval: str
    fonction_eval: str
    date_eval: str
    lieu_eval: str
    points: int
    pourcentage: float
    status: str
    sig_eval: str
    sig_stagiaire: str
    reponses: dict 

async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"
    
    chrome_path = os.environ.get("CHROME_PATH")
    browser = await launch(executablePath=chrome_path, args=['--no-sandbox'])
    page = await browser.newPage()
    
    try:
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0'})

        # Injection complète des données ET déclenchement du calcul de score dans le PDF
        await page.evaluate(f"""(d) => {{
            // Remplissage texte
            document.getElementById('nom-agent').value = d.nom_agent;
            document.getElementById('prenom-agent').value = d.prenom_agent;
            document.getElementById('nom-eval').value = d.nom_eval;
            document.getElementById('prenom-eval').value = d.prenom_eval;
            document.getElementById('fonction-eval').value = d.fonction_eval;
            document.getElementById('date-eval').value = d.date_eval;
            document.getElementById('lieu-eval').value = d.lieu_eval;
            document.getElementById('sig-eval').innerText = d.sig_eval;
            document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;

            // Cochage des réponses
            for (const [name, value] of Object.entries(d.reponses)) {{
                const input = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                if (input) {{
                    input.checked = true;
                    input.setAttribute('checked', 'checked');
                }}
            }}

            // FORCE le calcul du score pour générer les couleurs et les points dans le PDF
            if (typeof calculerScore === "function") {{
                calculerScore();
            }}

            // Supprimer les boutons du PDF
            document.querySelectorAll('.btn-area, .no-print').forEach(el => el.remove());
        }}""", data.dict())

        await asyncio.sleep(1) # Laisse le temps au script de colorier

        await page.pdf({
            'path': pdf_filename,
            'format': 'A4',
            'printBackground': True,
            'margin': {'top': '10mm', 'bottom': '10mm', 'left': '10mm', 'right': '10mm'}
        })
    finally:
        await browser.close()
    return pdf_filename

async def envoyer_email(fichier_path, nom_agent):
    API_KEY = os.environ.get("SENDGRID_API_KEY")
    if not API_KEY:
        raise Exception("Clé API SendGrid manquante.")

    with open(fichier_path, "rb") as f:
        encoded_pdf = base64.b64encode(f.read()).decode()

    payload = {
        "personalizations": [{"to": [{"email": "xavier.oliere@alyzia.com"}]}],
        "from": {"email": "alyzia.cdg2@gmail.com"},
        "subject": f"Évaluation DGR - {nom_agent.upper()}",
        "content": [{"type": "text/plain", "value": f"Veuillez trouver ci-joint l'évaluation de l'agent {nom_agent}."}],
        "attachments": [{
            "content": encoded_pdf,
            "filename": os.path.basename(fichier_path),
            "type": "application/pdf",
            "disposition": "attachment"
        }]
    }

    async with httpx.AsyncClient() as client:
        r = await client.post("https://api.sendgrid.com/v3/mail/send", 
                             json=payload, 
                             headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})
        if r.status_code >= 400:
            raise Exception(f"Erreur SendGrid: {r.text}")

@app.post("/submit")
async def submit_evaluation(data: EvalDGR, action: str = Query("download")):
    try:
        pdf_path = await generer_pdf_dgr(data)
        if action == "email":
            await envoyer_email(pdf_path, data.nom_agent)
            return {"status": "success"}
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
    except Exception as e:
        print(f"Erreur: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)