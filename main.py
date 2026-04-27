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

    with open(fichier_path, "rb") as f:
        encoded_pdf = base64.b64encode(f.read()).decode()

    # 🔥 DESTINATAIRES MULTIPLES
    destinataires = [
        {"email": "xavier.oliere@alyzia.com"},   # chef
        {"email": "estelle.inglese@alyzia.com"},
        {"email": "service_formationcdg@alyzia.com"},
        {"email": "pascale.rousseau@alyzia.com"}
    ]

    payload = {
        "personalizations": [{
            "to": destinataires
        }],

        # 🔥 NOM EXPÉDITEUR PERSONNALISÉ
        "from": {
            "email": "alyzia.cdg2@gmail.com",
            "name": "CBTA DGR 7.5"
        },

        "subject": f"EVALUATION PRATIQUE DGR 7.5 - {nom_agent.upper()}",

        "content": [{
            "type": "text/plain",
            "value": f"Veuillez trouver ci-joint l'évaluation de l'agent {nom_agent}."
        }],

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
    pdf_filename = f"EVALUATION_PRATIQUE_DGR 7.5_{nom_clean}.pdf"

    data_json = json.dumps(data.dict())

    browser = await launch({
        "args": ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })

    page = await browser.newPage()

    # 🔥 FULL SYNC MODE
    await page.emulateMedia('screen')

    # 🔥 VIEWPORT A4 EXACT + QUALITÉ
    await page.setViewport({
        'width': 794,
        'height': 1123,
        'deviceScaleFactor': 2
    })

    try:
        await page.goto('http://localhost:10000', {
            'waitUntil': 'networkidle0',
            'timeout': 60000
        })

        # 🔥 INJECTION DATA
        await page.evaluate(f"""(dStr) => {{
            const d = JSON.parse(dStr);

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

            if(document.getElementById('sig-eval')) document.getElementById('sig-eval').innerText = d.sig_eval;
            if(document.getElementById('sig-stagiaire')) document.getElementById('sig-stagiaire').innerText = d.sig_stagiaire;

            for (const [name, value] of Object.entries(d.reponses)) {{
                if (Array.isArray(value)) {{
                    value.forEach(val => {{
                        const input = document.querySelector(`input[name="${{name}}"][value="${{val}}"]`);
                        if (input) input.checked = true;
                    }});
                }} else {{
                    const input = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                    if (input) input.checked = true;
                }}
            }}

            window.scoreValide = true;
            if (typeof calculerScore === "function") calculerScore();

            document.querySelectorAll('.btn-area, .no-print')
                .forEach(el => el.style.display = 'none');
        }}""", data_json)

        # 🔥 ATTENTE DOM STABLE
        await page.waitForSelector('#document-to-print')
        await asyncio.sleep(1)

        # 🔥 RESET ÉCHELLE
        await page.evaluate("""
        () => {
            document.body.style.zoom = "1";
            document.body.style.margin = "0";
        }
        """)

        # 🔥 PDF FINAL PARFAIT
        pdf_content = await page.pdf({
            'format': 'A4',
            'printBackground': True,
            'margin': {
                'top': '0mm',
                'bottom': '0mm',
                'left': '0mm',
                'right': '0mm'
            },
            'preferCSSPageSize': True,
            'scale': 1
        })

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
            await envoyer_email(pdf_path, data.nom_agent)
            return {"status": "success"}

        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)

    except Exception as e:
        print(f"Erreur Serveur: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


app.mount("/", StaticFiles(directory=".", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)
