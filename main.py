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

# --- MODÈLE DE DONNÉES DGR ---
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

# --- GÉNÉRATION PDF DGR (Moteur Chrome) ---
async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    fichier = f"EVAL_DGR_{nom_clean}.pdf"
    
    # Lancement de Chrome avec les arguments de sécurité pour Render
    browser = await launch(
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        handleSIGINT=False, 
        handleSIGTERM=False, 
        handleSIGHUP=False
    )
    
    page = await browser.newPage()
    
    try:
        # On attend que le formulaire local soit chargé
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})
        
        # Injection des données dans le HTML
        await page.evaluate(f"""() => {{
            document.getElementById('nom-agent').value = "{data.nom_agent}";
            document.getElementById('prenom-agent').value = "{data.prenom_agent}";
            document.getElementById('nom-eval').value = "{data.nom_eval}";
            document.getElementById('prenom-eval').value = "{data.prenom_eval}";
            document.getElementById('fonction-eval').value = "{data.fonction_eval}";
            document.getElementById('date-eval').value = "{data.date_eval}";
            document.getElementById('lieu-eval').value = "{data.lieu_eval}";
            document.getElementById('points-result').innerText = "{data.points}";
            document.getElementById('percent-result').innerText = "{data.pourcentage}";
            document.getElementById('status-result').innerText = "{data.status}";
        }}""")

        # Création du PDF
        await page.pdf({
            'path': fichier,
            'format': 'A4',
            'printBackground': True,
            'margin': {'top': '10mm', 'bottom': '10mm', 'left': '10mm', 'right': '10mm'}
        })
    finally:
        await browser.close()
    
    return fichier

# --- ENVOI EMAIL (Identique à PAXI - Solution SendGrid) ---
async def envoyer_email(fichier, nom):
    API_KEY = os.getenv("SENDGRID_API_KEY")
    SENDER_EMAIL = "alyzia.cdg2@gmail.com"
    RECEIVER_EMAIL = "xavier.oliere@alyzia.com"

    with open(fichier, "rb") as f:
        encoded_pdf = base64.b64encode(f.read()).decode()

    payload = {
        "personalizations": [{"to": [{"email": RECEIVER_EMAIL}]}],
        "from": {"email": SENDER_EMAIL, "name": "ALYZIA DGR SYSTEM"},
        "subject": f"EVALUATION DGR 7.5 - {nom.upper()}",
        "content": [{"type": "text/plain", "value": f"Bonjour,\n\nVeuillez trouver ci-joint l'évaluation DGR 7.5 de l'agent : {nom}."}],
        "attachments": [
            {
                "content": encoded_pdf,
                "filename": fichier,
                "type": "application/pdf",
                "disposition": "attachment"
            }
        ]
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post("https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers)
        if response.status_code >= 400:
            print(f"Erreur API SendGrid: {response.text}")
            raise Exception("Erreur lors de l'envoi du mail via API")

# --- ROUTE PRINCIPALE ---
@app.post("/submit")
async def submit(data: EvalDGR, action: str = Query("email")):
    try:
        # 1. Génération du PDF
        pdf_path = await generer_pdf_dgr(data)
        
        if action == "email":
            # 2. Envoi via SendGrid
            await envoyer_email(pdf_path, data.nom_agent)
            return {"status": "ok"}
        else:
            # 3. Téléchargement direct
            return FileResponse(
                path=pdf_path,
                filename=pdf_path,
                media_type='application/pdf'
            )
    except Exception as e:
        print(f"ERREUR SERVEUR : {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Montage des fichiers statiques (index.html, style.css, script.js)
app.mount("/", StaticFiles(directory=".", html=True), name="static")
