import asyncio
import os
import base64
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch

app = FastAPI()

# Montage du dossier static pour le CSS, JS et les IMAGES
# Assurez-vous que toxique.jpg est bien dans le même dossier que main.py
app.mount("/static", StaticFiles(directory="."), name="static")

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

@app.get("/")
async def root():
    return FileResponse("index.html")

async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"

    browser = await launch(
        args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        handleSIGINT=False, handleSIGTERM=False, handleSIGHUP=False
    )
    page = await browser.newPage()

    try:
        # Render utilise le port 10000. Pyppeteer doit charger l'URL locale.
        await page.goto("http://localhost:10000", {"waitUntil": "networkidle0", "timeout": 60000})

        await page.evaluate(f"""(d) => {{
            // Remplissage des champs texte
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

            // Application visuelle des réponses et couleurs pour le PDF
            const solutions = {{
                q2: "Toxique",
                q3: "Une cigarette électronique",
                q4: "Je préviens un responsable + périmètre de sécurité de 25m",
                q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
            }};

            for (const [name, value] of Object.entries(d.reponses)) {{
                const el = document.querySelector(`input[name="${{name}}"][value="${{value}}"]`);
                if (el) {{
                    el.checked = true;
                    el.setAttribute('checked', 'checked');
                    const label = el.parentElement;
                    if (label.textContent.includes(solutions[name] || "SITADOC") || label.textContent.includes("IATA")) {{
                        label.style.backgroundColor = "#d4edda";
                    }} else {{
                        label.style.backgroundColor = "#f8d7da";
                    }}
                }}
            }}
            
            document.querySelectorAll('.btn-area, #custom-alert').forEach(el => el.remove());
        }}""", data.model_dump())

        await asyncio.sleep(1.5) 

        await page.pdf({
            "path": pdf_filename,
            "format": "A4",
            "printBackground": True,
            "margin": {"top": "5mm", "bottom": "5mm", "left": "5mm", "right": "5mm"}
        })
    finally:
        await browser.close()
    return pdf_filename

# ROUTE CORRIGÉE : Changement de /generate à /submit pour correspondre au JS
@app.post("/submit")
async def submit(data: EvalDGR, action: str = Query("download")):
    pdf_path = await generer_pdf_dgr(data)
    if action == "email":
        # Logique SendGrid ici
        return {"status": "success"}
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path)