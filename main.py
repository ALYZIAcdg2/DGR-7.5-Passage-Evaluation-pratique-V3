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

# --- MODÈLE DE DONNÉES ---
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
    reponses: dict  # Contient les noms et valeurs des cases cochées

# --- GÉNÉRATION DU PDF ---
async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"
    
    # Lancement de Chrome
    browser = await launch(
        args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        handleSIGINT=False,
        handleSIGTERM=False,
        handleSIGHUP=False
    )
    
    page = await browser.newPage()
    
    try:
        # On charge l'index local (Render utilise le port 10000 par défaut)
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})

        # Injection des données et forçage des coches
        await page.evaluate(f"""(d) => {{
            // Remplissage des textes
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

            // --- LOGIQUE DE COCHAGE FORCÉ ---
            for (const [name, value] of Object.entries(d.reponses)) {{
                const el = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                if (el) {{
                    el.checked = true;
                    el.setAttribute('checked', 'checked'); // Indispensable pour l'impression PDF
                }}
            }}

            // Relancer le calcul pour les couleurs vert/rouge
            if (typeof calculerScore === 'function') {{
                calculerScore();
            }}
            
            // Masquer les éléments inutiles (boutons et alertes résiduelles)
            const elementsToHide = document.querySelectorAll('.btn-area, #custom-alert');
            elementsToHide.forEach(el => el.style.setProperty('display', 'none', 'important'));
        }}""", data.dict())

    # Petite pause pour laisser le temps au navigateur de rendre les couleurs/styles
        await asyncio.sleep(1.5)

        # Impression en PDF
        await page.pdf({
            'path': pdf_filename,
            'format': 'A4',
            'printBackground': True, # Important pour garder le logo et les couleurs
            'margin': {'top': '5mm', 'bottom': '5mm', 'left': '5mm', 'right': '5mm'}
        })
        
    finally:
        await browser.close()
    
    return pdf_filename

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