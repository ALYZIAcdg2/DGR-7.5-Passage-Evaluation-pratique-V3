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

# --- MODÈLE DE DONNÉES COMPLET ---
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

# --- LOGIQUE DE GÉNÉRATION PDF (Chrome Headless) ---
async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"
    
    # Lancement du navigateur (indispensable sur Render)
    browser = await launch(
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        handleSIGINT=False,
        handleSIGTERM=False,
        handleSIGHUP=False
    )
    
    page = await browser.newPage()
    
    try:
        # On charge l'application locale
        # Render utilise localhost:10000 par défaut
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})

        # On injecte les données calculées dans le formulaire avant impression
        await page.evaluate(f"""(d) => {{
            document.getElementById('nom-agent').value = d.nom_agent;
            document.getElementById('prenom-agent').value = d.prenom_agent;
            document.getElementById('nom-eval').value = d.nom_eval;
            document.getElementById('prenom-eval').value = d.prenom_eval;
            document.getElementById('fonction-eval').value = d.fonction_eval;
            document.getElementById('date-eval').value = d.date_eval;
            document.getElementById('lieu-eval').value = d.lieu_eval;
            
            // Mise à jour des résultats
            document.getElementById('points-result').innerText = d.points + "/100";
            document.getElementById('percent-result').innerText = d.pourcentage + "%";
            document.getElementById('status-result').innerText = d.status;
            
            // Signatures
            document.getElementById('sig-eval').innerText = d.sig_eval;
            document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;
            
            // On cache les boutons pour le PDF
            const btnArea = document.querySelector('.btn-area');
            if(btnArea) btnArea.style.display = 'none';
        }}""", data.dict())

        # Création du PDF
        await page.pdf({
            'path': pdf_filename,
            'format': 'A4',
            'printBackground': True,
            'margin': {'top': '5mm', 'bottom': '5mm', 'left': '5mm', 'right': '5mm'}
        })
        
    finally:
        await browser.close()
    
    return pdf_filename

# --- FONCTION ENVOI EMAIL (SENDGRID) ---
async def envoyer_email(fichier_path, nom_agent):
    API_KEY = os.getenv("SENDGRID_API_KEY")
    if not API_KEY:
        raise Exception("Clé API SendGrid manquante dans les variables d'environnement")

    with open(fichier_path, "rb") as f:
        encoded_pdf = base64.b64encode(f.read()).decode()

    payload = {
        "personalizations": [{
            "to": [{"email": "votre-email@domaine.com"}] # Remplacez par l'email de réception
        }],
        "from": {"email": "votre-email-verifie-sendgrid@domaine.com"}, # Email expéditeur validé
        "subject": f"Résultat Évaluation DGR - {nom_agent.upper()}",
        "content": [{"type": "text/plain", "value": f"Veuillez trouver ci-joint l'évaluation pratique de {nom_agent}."}],
        "attachments": [
            {
                "content": encoded_pdf,
                "filename": os.path.basename(fichier_path),
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
            raise Exception(f"Erreur SendGrid: {response.text}")

# --- ROUTES ---
@app.post("/submit")
async def submit_evaluation(data: EvalDGR, action: str = Query("download")):
    try:
        pdf_path = await generer_pdf_dgr(data)
        
        if action == "email":
            await envoyer_email(pdf_path, data.nom_agent)
            return {"status": "success", "message": "Email envoyé avec le PDF."}
        else:
            return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
            
    except Exception as e:
        print(f"Erreur: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Servir les fichiers statiques (HTML, CSS, JS, Images)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Le port doit être 10000 pour Render
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)