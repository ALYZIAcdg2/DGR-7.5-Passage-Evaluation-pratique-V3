import os
import asyncio
import httpx
import base64
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch
from dotenv import load_dotenv

# Charge les variables d'environnement
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
    
    # Préparation des données JSON
    data_json = json.dumps(data.dict())

    chrome_path = os.environ.get("CHROME_PATH")
    if not chrome_path and os.path.exists('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'):
        chrome_path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

    browser = await launch({
        "args": ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        "executablePath": chrome_path if chrome_path else None,
        "handleSIGINT": False,
        "handleSIGTERM": False,
        "handleSIGHUP": False
    })
    
    page = await browser.newPage()
    pdf_content = await page.pdf({
    'format': 'A4',
    'printBackground': True,
    'margin': {'top': '5mm', 'bottom': '5mm', 'left': '5mm', 'right': '5mm'}
})
    
    try:
        # Utilisation de l'URL locale Render
        await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0', 'timeout': 60000})

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

            // 3. COCHAGE DES RÉPONSES (Gestion Single et Multi-choix)
            for (const [name, value] of Object.entries(d.reponses)) {{
                // Si la valeur est une liste (cas de Q1 corrigé dans script.js)
                if (Array.isArray(value)) {{
                    value.forEach(val => {{
                        const input = document.querySelector(`input[name="${{name}}"][value="${{val}}"]`);
                        if (input) {{
                            input.checked = true;
                            input.setAttribute('checked', 'checked');
                        }}
                    }});
                }} else {{
                    // Cas classique (Q2 à Q5)
                    const input = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                    if (input) {{
                        input.checked = true;
                        input.setAttribute('checked', 'checked');
                    }}
                }}
            }}

            // 4. FORCE L'AFFICHAGE DES COULEURS
            window.scoreValide = true; 
            
            if (typeof calculerScore === "function") {{ 
                calculerScore(); 
            }}

            // 5. Nettoyage visuel 
            document.querySelectorAll('.btn-area, .no-print').forEach(el => el.style.display = 'none');
        }}""", data_json)

        # Attente pour le rendu des styles !important
        await asyncio.sleep(5) 

        # Génération du flux PDF
        pdf_content = await page.pdf({
            'format': 'A4',
            'printBackground': True,
            'margin': {'top': '0', 'bottom': '0', 'left': '0', 'right': '0'}
        })
        
        # Sauvegarde physique pour l'envoi email
        with open(pdf_filename, "wb") as f:
            f.write(pdf_content)

    finally:
        await browser.close()
    
    return pdf_filename

@app.post("/submit")
async def submit_evaluation(data: EvalDGR, action: str = Query("download")):
    try:
        pdf_path = await generer_pdf_dgr(data)
        
        if action == "email":
            await envoyer_email(pdf_path, str(data.nom_agent))
            # Optionnel : supprimer le fichier après envoi pour nettoyer le serveur
            # os.remove(pdf_path)
            return {"status": "success"}
            
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
    except Exception as e:
        print(f"Erreur Serveur: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)