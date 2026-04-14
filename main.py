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

async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"
    
    # Détection automatique du chemin Chrome (Local Windows vs Render Linux)
    chrome_path = os.environ.get("CHROME_PATH")
    if not chrome_path and os.path.exists('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'):
        chrome_path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

    launch_kwargs = {
        "args": ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        "handleSIGINT": False,
        "handleSIGTERM": False,
        "handleSIGHUP": False
    }
    
    if chrome_path:
        launch_kwargs["executablePath"] = chrome_path

    browser = await launch(**launch_kwargs)
    page = await browser.newPage()
    
    # Définit une taille de fenêtre large pour éviter les coupures
    await page.setViewport({'width': 1024, 'height': 1600})
    
    try:
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})

        await page.evaluate(f"""(d) => {{
            // Remplissage texte
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

            // Cochage des réponses avec FORCE visuelle pour le PDF
            for (const [name, value] of Object.entries(d.reponses)) {{
                const input = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                if (input) {{
                    input.checked = true;
                    input.setAttribute('checked', 'checked'); // Indispensable pour le moteur PDF
                    input.click(); // Déclenche les couleurs dans script.js
                }}
            }}

            // On lance le calcul manuellement pour être sûr
            if (typeof calculerScore === "function") {{
                calculerScore();
            }}

            // On masque les boutons
            document.querySelectorAll('.btn-area, .no-print').forEach(el => el.style.display = 'none');
        }}""", data.dict())

        # --- CHANGEMENT ICI : On attend 5 secondes complètes ---
        await asyncio.sleep(5) 

        return await page.pdf({{
            'format': 'A4',
            'printBackground': True,
            'margin': {{'top': '0', 'bottom': '0', 'left': '0', 'right': '0'}}
        }})
        
    finally:
        await browser.close()
    
    return pdf_filename

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

@app.post("/submit")
async def submit_evaluation(data: EvalDGR, action: str = Query("download")):
    try:
        # On génère le PDF en passant l'objet data complet
        pdf_path = await generer_pdf_dgr(data)
        
        if action == "email":
            # IMPORTANT : On passe data.nom_agent (du texte) et non l'objet data complet
            await envoyer_email(pdf_path, data.nom_agent)
            return {"status": "success"}
            
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
    except Exception as e:
        # On imprime l'erreur dans la console pour débugger
        print(f"DEBUG Erreur : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Montage des fichiers statiques
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # On tourne sur le port 10000 requis par Render
    uvicorn.run(app, host="0.0.0.0", port=10000)