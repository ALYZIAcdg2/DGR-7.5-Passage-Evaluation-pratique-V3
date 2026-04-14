import os
import asyncio
import httpx
import base64
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch
from dotenv import load_dotenv

# Charge les variables d'environnement du fichier .env en local
load_dotenv()

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



async def envoyer_email(fichier_path, nom_agent):
    API_KEY = os.environ.get("SENDGRID_API_KEY")
    if not API_KEY:
        raise Exception("Clé API SendGrid manquante.")

    # Sécurité : s'assurer que nom_agent est bien une chaîne de caractères
    nom_str = str(nom_agent)

    with open(fichier_path, "rb") as f:
        encoded_pdf = base64.b64encode(f.read()).decode()

    payload = {
        "personalizations": [{"to": [{"email": "xavier.oliere@alyzia.com"}]}],
        "from": {"email": "alyzia.cdg2@gmail.com"},
        "subject": f"Évaluation DGR - {nom_str.upper()}",
        "content": [{"type": "text/plain", "value": f"Veuillez trouver ci-joint l'évaluation de l'agent {nom_str}."}],
        "attachments": [{
            "content": encoded_pdf,
            "filename": os.path.basename(fichier_path),
            "type": "application/pdf",
            "disposition": "attachment"
        }]
    }

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.sendgrid.com/v3/mail/send", 
            json=payload, 
            headers={
                "Authorization": f"Bearer {API_KEY}", 
                "Content-Type": "application/json"
            }
        )
        if r.status_code >= 400:
            raise Exception(f"Erreur SendGrid: {r.text}")

async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"
    
    import json
    # Préparation des données pour injection sécurisée
    data_json = json.dumps(data.dict())

    # Détection du chemin Chrome
    chrome_path = os.environ.get("CHROME_PATH")
    if not chrome_path and os.path.exists('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'):
        chrome_path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

    browser = await launch({
        "args": ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        "executablePath": chrome_path if chrome_path else None
    })
    
    page = await browser.newPage()
    await page.setViewport({'width': 1024, 'height': 1600})
    
    try:
        # Chargement de la page locale
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})

        # Injection et simulation du comportement de l'agent
        await page.evaluate(f"""(dStr) => {{
            const d = JSON.parse(dStr);
            const setVal = (id, val) => {{
                const el = document.getElementById(id);
                if(el) {{ el.value = val; el.setAttribute('value', val); }}
            }};

            // 1. Remplissage des champs texte
            setVal('nom-agent', d.nom_agent);
            setVal('prenom-agent', d.prenom_agent);
            setVal('nom-eval', d.nom_eval);
            setVal('prenom-eval', d.prenom_eval);
            setVal('fonction-eval', d.fonction_eval);
            setVal('date-eval', d.date_eval);
            setVal('lieu-eval', d.lieu_eval);
            
            // 2. Signatures
            if(document.getElementById('sig-eval')) document.getElementById('sig-eval').innerText = d.sig_eval;
            if(document.getElementById('sig-stagiaire')) document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;

            // 3. COCHAGE DES RÉPONSES (Indispensable pour que le score ne soit pas à 0)
            for (const [name, value] of Object.entries(d.reponses)) {{
                const input = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                if (input) {{
                    input.checked = true;
                    // Force l'attribut visuel pour le rendu PDF
                    input.setAttribute('checked', 'checked');
                }}
            }}

            // 4. FORCE LE CALCUL DU SCORE (Pour colorier en rouge/vert et mettre à jour le score final)
            if (typeof calculerScore === "function") {{ 
                calculerScore(); 
            }}

            // 5. Nettoyage visuel du PDF
            document.querySelectorAll('.btn-area, .no-print').forEach(el => el.style.display = 'none');
        }}""", data_json)

        # Pause pour laisser le moteur CSS appliquer les couleurs de script.js
        await asyncio.sleep(4) 

        # Génération du PDF final
        await page.pdf({
            'path': pdf_filename,
            'format': 'A4',
            'printBackground': True,
            'margin': {'top': '0', 'bottom': '0', 'left': '0', 'right': '0'}
        })
        
    finally:
        await browser.close()
    
    return pdf_filename

@app.post("/submit")
async def submit_evaluation(data: EvalDGR, action: str = Query("download")):
    try:
        pdf_path = await generer_pdf_dgr(data)
        
        if action == "email":
            # On passe une simple string pour le nom, pas l'objet dict
            await envoyer_email(pdf_path, str(data.nom_agent))
            return {"status": "success"}
            
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
    except Exception as e:
        print(f"Erreur: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Montage des fichiers statiques
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # On tourne sur le port 10000 requis par Render
    uvicorn.run(app, host="0.0.0.0", port=10000)