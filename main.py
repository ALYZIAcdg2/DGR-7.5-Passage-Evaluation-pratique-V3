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
    
    # Détection du chemin Chrome (Windows local vs Render Linux)
    chrome_path = os.environ.get("CHROME_PATH")
    if not chrome_path and os.path.exists("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"):
        chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

    launch_kwargs = {
        "args": ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        "handleSIGINT": False, "handleSIGTERM": False, "handleSIGHUP": False
    }
    if chrome_path:
        launch_kwargs["executablePath"] = chrome_path

    browser = await launch(**launch_kwargs)
    page = await browser.newPage()
    
    try:
        # On utilise l'URL relative ou locale
        url = "http://localhost:10000"
        await page.goto(url, {'waitUntil': 'networkidle0', 'timeout': 60000})

        # Injection des données dans le formulaire pour le PDF
        await page.evaluate(f"""(d) => {{
            document.getElementById('nom-agent').value = d.nom_agent;
            document.getElementById('prenom-agent').value = d.prenom_agent;
            document.getElementById('nom-eval').value = d.nom_eval;
            document.getElementById('prenom-eval').value = d.prenom_eval;
            document.getElementById('fonction-eval').value = d.fonction_eval;
            document.getElementById('date-eval').value = d.date_eval;
            document.getElementById('lieu-eval').value = d.lieu_eval;
            document.getElementById('points-result').innerText = d.points;
            document.getElementById('percent-result').innerText = d.pourcentage;
            document.getElementById('status-result').innerText = d.status;
            document.getElementById('sig-eval').innerText = d.sig_eval;
            document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;

            for (const [name, value] of Object.entries(d.reponses)) {{
                const el = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                if (el) el.checked = true;
            }}
            // Cacher les boutons sur le PDF
            document.querySelector('.btn-area').style.display = 'none';
        }}""", data.dict())

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