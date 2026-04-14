# =========================
# main.py (VERSION FINALE STABLE)
# =========================

import asyncio
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch

app = FastAPI()

# ✅ Sert les fichiers (HTML / CSS / JS)
app.mount("/static", StaticFiles(directory="."), name="static")


# ✅ ROUTE ROOT (évite le 404 Render)
@app.get("/")
async def root():
    return {"message": "API DGR OK"}


# ✅ ROUTE POUR TON FORMULAIRE
@app.get("/form")
async def form():
    return FileResponse("index.html")


# =========================
# DATA MODEL
# =========================
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


# =========================
# GENERATION PDF
# =========================
async def generer_pdf_dgr(data: EvalDGR):

    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"

    browser = await launch(
        args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ],
        handleSIGINT=False,
        handleSIGTERM=False,
        handleSIGHUP=False
    )

    page = await browser.newPage()

    try:
        # ✅ IMPORTANT : pointer vers /form
        await page.goto('https://dgr-yh51.onrender.com/form', {
            'waitUntil': 'networkidle0',
            'timeout': 60000
        })

        await page.waitForSelector('#document-to-print')
        await page.emulateMedia('screen')

        # =========================
        # INJECTION DATA
        # =========================
        await page.evaluate("""(d) => {

            document.getElementById('nom-agent').value = d.nom_agent;
            document.getElementById('prenom-agent').value = d.prenom_agent;
            document.getElementById('nom-eval').value = d.nom_eval;
            document.getElementById('prenom-eval').value = d.prenom_eval;
            document.getElementById('fonction-eval').value = d.fonction_eval;
            document.getElementById('date-eval').value = d.date_eval;
            document.getElementById('lieu-eval').value = d.lieu_eval;

            document.getElementById('points-result').innerText = d.points + "/100";
            document.getElementById('percent-result').innerText = d.pourcentage + "%";
            document.getElementById('status-result').innerText = d.status;

            if(d.points >= 80){
                document.getElementById('status-result').style.color = "green";
            } else {
                document.getElementById('status-result').style.color = "red";
            }

            document.getElementById('sig-eval').innerText = d.sig_eval;
            document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;

            // SUPPRESSION BOUTONS
            document.querySelectorAll('.btn-area, #custom-alert')
                .forEach(el => el.remove());

        }""", data.dict())

        await asyncio.sleep(1)

        # =========================
        # GENERATION PDF
        # =========================
        await page.pdf({
            'path': pdf_filename,
            'format': 'A4',
            'printBackground': True,
            'preferCSSPageSize': True,
            'margin': {
                'top': '0mm',
                'bottom': '0mm',
                'left': '5mm',
                'right': '5mm'
            }
        })

    finally:
        await browser.close()

    return pdf_filename


# =========================
# API
# =========================
@app.post("/generate")
async def generate(data: EvalDGR):
    file = await generer_pdf_dgr(data)
    return FileResponse(file, media_type='application/pdf', filename=file)