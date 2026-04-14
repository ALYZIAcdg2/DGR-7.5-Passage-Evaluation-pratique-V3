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
    
    browser = await launch(
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        handleSIGINT=False, handleSIGTERM=False, handleSIGHUP=False
    )
    
    page = await browser.newPage()
    
    try:
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})

        # --- INJECTION RADICALE POUR LE RENDU PHOTO ---
        await page.evaluate(f"""(d) => {{
            // 1. Remplissage des champs (Value et Attr pour être sûr)
            const setVal = (id, val) => {{
                const el = document.getElementById(id);
                if(el) {{ el.value = val; el.setAttribute('value', val); }}
            }};

            setVal('nom-agent', d.nom_agent);
            setVal('prenom-agent', d.prenom_agent);
            setVal('nom-eval', d.nom_eval);
            setVal('prenom-eval', d.prenom_eval);
            setVal('fonction-eval', d.fonction_eval);
            setVal('date-eval', d.date_eval);
            setVal('lieu-eval', d.lieu_eval);
            
            // 2. Scores et Signatures
            document.getElementById('points-result').innerText = d.points;
            document.getElementById('percent-result').innerText = d.pourcentage;
            document.getElementById('status-result').innerText = d.status;
            document.getElementById('sig-eval').innerText = d.sig_eval;
            document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;

            // 3. COCHAGE ET CALCUL VISUEL DES COULEURS (IDENTIQUE PHOTO)
            const solutions = {{
                q2: "Toxique",
                q3: "Une cigarette électronique",
                q4: "Je préviens un responsable + périmètre de sécurité de 25m",
                q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
            }};

            // Reset labels avant application
            document.querySelectorAll('.question-card label').forEach(l => l.style.backgroundColor = "transparent");

            for (const [name, value] of Object.entries(d.reponses)) {{
                const el = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                const resSpan = document.getElementById(`res-${{name}}`);
                
                if (el) {{
                    el.checked = true;
                    el.setAttribute('checked', 'checked');
                    
                    const label = el.parentElement;
                    let isCorrect = false;

                    // Logique visuelle Q1
                    if (name === "q1") {{
                        if (value === "SITADOC" || value === "IATA") {{
                            isCorrect = true;
                        }}
                    }} 
                    // Logique visuelle Q2-Q5
                    else if (label.textContent.includes(solutions[name])) {{
                        isCorrect = true;
                    }}

                    if (isCorrect) {{
                        label.style.backgroundColor = "#d4edda"; // Vert
                        if(resSpan) {{ resSpan.innerText = "+20 pts"; resSpan.style.color = "green"; }}
                    }} else {{
                        label.style.backgroundColor = "#f8d7da"; // Rouge
                        if(resSpan) {{ resSpan.innerText = "+0 pt"; resSpan.style.color = "red"; }}
                    }}
                }}
            }}

            // 4. Nettoyage final pour le PDF
            document.querySelectorAll('.btn-area, #custom-alert').forEach(el => el.remove());
        }}""", data.dict())

        # On attend un peu pour que les styles CSS s'appliquent bien
        await asyncio.sleep(2)

        await page.pdf({
            'path': pdf_filename,
            'format': 'A4',
            'printBackground': True,
            'margin': {'top': '5mm', 'bottom': '5mm', 'left': '10mm', 'right': '10mm'}
        })
        
    finally:
        await browser.close()
    
    return pdf_filename

# Les autres fonctions (email, submit) restent identiques.

# --- ENVOI DE L'EMAIL VIA SENDGRID ---
async def envoyer_email(fichier_path, nom_agent):
    API_KEY = os.getenv("SENDGRID_API_KEY")
    if not API_KEY:
        raise Exception("Clé API SendGrid manquante")

    with open(fichier_path, "rb") as f:
        encoded_pdf = base64.b64encode(f.read()).decode()

    payload = {
        "personalizations": [{
            "to": [{"email": "xavier.oliere@alyzia.com"}]
        }],
        "from": {"email": "alyzia.cdg2@gmail.com"}, # DOIT ÊTRE VALIDÉ DANS SENDGRID
        "subject": f"Évaluation DGR - {nom_agent.upper()}",
        "content": [{"type": "text/plain", "value": f"Veuillez trouver ci-joint l'évaluation de l'agent {nom_agent}."}],
        "attachments": [
            {
                "content": encoded_pdf,
                "filename": os.path.basename(fichier_path),
                "type": "application/pdf",
                "disposition": "attachment"
            }
        ]
    }

    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    async with httpx.AsyncClient() as client:
        response = await client.post("https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers)
        if response.status_code >= 400:
            raise Exception(f"Erreur SendGrid: {response.text}")

# --- ROUTES API ---
@app.post("/submit")
async def submit_evaluation(data: EvalDGR, action: str = Query("download")):
    try:
        pdf_path = await generer_pdf_dgr(data)
        
        if action == "email":
            await envoyer_email(pdf_path, data.nom_agent)
            return {"status": "success"}
        else:
            return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
            
    except Exception as e:
        print(f"Erreur Serveur: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Servir les fichiers statiques (index.html, style.css, script.js)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)