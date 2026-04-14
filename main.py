import asyncio
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pyppeteer import launch

app = FastAPI()

# Sert les fichiers statiques du dossier courant
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


# Page principale = ton HTML
@app.get("/")
async def root():
    return FileResponse("index.html")


# Route santé optionnelle
@app.api_route("/healthz", methods=["GET", "HEAD"])
async def healthz():
    return JSONResponse({"status": "ok"})


async def generer_pdf_dgr(data: EvalDGR):
    nom_clean = data.nom_agent.replace(" ", "_").upper()
    pdf_filename = f"EVAL_DGR_{nom_clean}.pdf"

    browser = await launch(
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
        handleSIGINT=False,
        handleSIGTERM=False,
        handleSIGHUP=False,
    )

    page = await browser.newPage()

    try:
        await page.goto(
            "https://dgr-yh51.onrender.com",
            {
                "waitUntil": "networkidle0",
                "timeout": 60000,
            },
        )

        await page.waitForSelector("#document-to-print")
        await page.emulateMedia("screen")
        await asyncio.sleep(1)

        await page.evaluate(
            """(d) => {
                const setValue = (id, value) => {
                    const el = document.getElementById(id);
                    if (el) el.value = value ?? "";
                };

                const setText = (id, value) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = value ?? "";
                };

                setValue("nom-agent", d.nom_agent);
                setValue("prenom-agent", d.prenom_agent);
                setValue("nom-eval", d.nom_eval);
                setValue("prenom-eval", d.prenom_eval);
                setValue("fonction-eval", d.fonction_eval);
                setValue("date-eval", d.date_eval);
                setValue("lieu-eval", d.lieu_eval);

                setText("points-result", d.points + " / 100");
                setText("percent-result", d.pourcentage + " %");
                setText("status-result", d.status);

                const statusEl = document.getElementById("status-result");
                if (statusEl) {
                    statusEl.style.color = d.points >= 80 ? "green" : "red";
                }

                setText("sig-eval", d.sig_eval);
                setText("sig-stagiaire", d.sig_stagiaire);

                const solutions = {
                    q2: "Toxique",
                    q3: "Une cigarette électronique",
                    q4: "Je préviens un responsable + périmètre de sécurité de 25m",
                    q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
                };

                // Réinitialise styles
                document.querySelectorAll(".question-card label").forEach(label => {
                    label.style.backgroundColor = "transparent";
                    label.style.color = "black";
                    label.style.fontWeight = "normal";
                    label.style.display = "block";
                    label.style.width = "100%";
                });

                // Q1 cases multiples
                if (Array.isArray(d.reponses.q1)) {
                    d.reponses.q1.forEach(val => {
                        const el = document.querySelector(`input[name="q1"][value="${val}"]`);
                        if (el) {
                            el.checked = true;
                            el.setAttribute("checked", "checked");
                        }
                    });

                    const q1Sitadoc = document.querySelector('input[name="q1"][value="SITADOC"]');
                    const q1Iata = document.querySelector('input[name="q1"][value="IATA"]');
                    const q1Repli = document.querySelector('input[name="q1"][value="REPLI"]');

                    if (q1Sitadoc?.parentElement) q1Sitadoc.parentElement.style.backgroundColor = "#d4edda";
                    if (q1Iata?.parentElement) q1Iata.parentElement.style.backgroundColor = "#d4edda";
                    if (q1Repli?.checked && q1Repli.parentElement) {
                        q1Repli.parentElement.style.backgroundColor = "#f8d7da";
                        q1Repli.parentElement.style.color = "#721c24";
                    }
                }

                // Q2 à Q5
                Object.entries(d.reponses || {}).forEach(([name, value]) => {
                    if (name === "q1") return;

                    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
                    if (!el) return;

                    el.checked = true;
                    el.setAttribute("checked", "checked");

                    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                        const label = r.parentElement;
                        if (!label) return;

                        if (label.textContent.trim().includes(solutions[name] || "")) {
                            label.style.backgroundColor = "#d4edda";
                            label.style.fontWeight = "bold";
                        }
                    });

                    const selectedLabel = el.parentElement;
                    if (
                        selectedLabel &&
                        !selectedLabel.textContent.trim().includes(solutions[name] || "")
                    ) {
                        selectedLabel.style.backgroundColor = "#f8d7da";
                        selectedLabel.style.color = "#721c24";
                    }
                });

                document.querySelectorAll(".btn-area, #custom-alert").forEach(el => el.remove());
            }""",
            data.model_dump(),
        )

        await asyncio.sleep(1)

        await page.pdf(
            {
                "path": pdf_filename,
                "format": "A4",
                "printBackground": True,
                "preferCSSPageSize": True,
                "margin": {
                    "top": "0mm",
                    "bottom": "0mm",
                    "left": "5mm",
                    "right": "5mm",
                },
            }
        )

    finally:
        await browser.close()

    return pdf_filename


@app.post("/generate")
async def generate(data: EvalDGR):
    file_path = await generer_pdf_dgr(data)
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=file_path,
    )