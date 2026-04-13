import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch
import httpx
import base64

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
    # Ajoutez ici les réponses si vous voulez les logger

async def generer_pdf_dgr(data: EvalDGR):
    fichier = f"EVAL_DGR_{data.nom_agent.upper()}.pdf"
    browser = await launch(args=['--no-sandbox', '--disable-setuid-sandbox'])
    page = await browser.newPage()
    
    # On charge le formulaire local
    await page.goto('http://localhost:10000', {'waitUntil': 'networkidle0'})

    # On remplit les champs dans le HTML avant de "clicher" le PDF
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

    await page.pdf({
        'path': fichier,
        'format': 'A4',
        'printBackground': True,
        'margin': {'top': '10mm', 'bottom': '10mm', 'left': '10mm', 'right': '10mm'}
    })
    await browser.close()
    return fichier

@app.post("/submit")
async def submit(data: EvalDGR, action: str = Query("email")):
    try:
        pdf_path = await generer_pdf_dgr(data)
        if action == "email":
            # Utilisez votre fonction envoyer_email (SendGrid) ici
            return {"status": "ok"}
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

app.mount("/", StaticFiles(directory=".", html=True), name="static")