// Affiche l'alerte personnalisée Alyzia
function showAlert(message) {
    const modal = document.getElementById('custom-alert');
    const msgElem = document.getElementById('alert-message');
    if (modal && msgElem) {
        msgElem.textContent = message;
        modal.style.display = 'flex';
    } else { alert(message); }
}

// Variable globale pour bloquer l'affichage tant qu'on n'a pas validé
window.scoreValide = false; 

// --- LOGIQUE CHOIX UNIQUE Q2 à Q5 ---
document.querySelectorAll('.q-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        if (this.checked) {
            const name = this.getAttribute('name');
            if (name !== 'q1') { 
                document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
                    if (cb !== this) cb.checked = false;
                });
            }
        }
        if (window.scoreValide) calculerScore(false);
    });
});

function calculerScore(isManualClick = false) {

    if (isManualClick) {
        const nomAgent = document.getElementById('nom-agent').value.trim();
        const sigEval = document.getElementById('sig-eval').innerText.trim();
        const sigStag = document.getElementById('sig-stagiaire').innerText.trim();

        if (!nomAgent || !sigEval || !sigStag) {
            showAlert("Veuillez remplir le Nom de l'agent et les Signatures avant de valider.");
            return;
        }

        for (let i = 1; i <= 5; i++) {
            if (!document.querySelector(`input[name="q${i}"]:checked`)) {
                showAlert(`Veuillez répondre à la question ${i} avant de valider.`);
                return;
            }
        }
        window.scoreValide = true; 
    }

    if (!window.scoreValide) return;

    let score = 0;

    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // Q1
    const q1Corrects = ["SITADOC", "IATA"];
    const q1Inputs = document.querySelectorAll('input[name="q1"]');
    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    let q1Error = false;

    q1Inputs.forEach(input => {
        if (q1Corrects.includes(input.value)) {
            input.parentElement.style.cssText = "background-color:#d4edda!important;display:block;padding:2px;border-radius:4px;";
        } else {
            input.parentElement.style.backgroundColor = "transparent";
        }
    });

    q1Choices.forEach(choice => {
        if (!q1Corrects.includes(choice.value)) {
            choice.parentElement.style.cssText = "background-color:#f8d7da!important;display:block;padding:2px;border-radius:4px;";
            q1Error = true;
        }
    });

    const ptsQ1 = (q1Choices.length === 2 && !q1Error) ? 20 : 0;
    score += ptsQ1;

    document.getElementById('res-q1').innerHTML =
        `<b style="color:${ptsQ1 > 0 ? 'green' : 'red'};float:right;">+${ptsQ1} pts</b>`;

    // Q2 à Q5
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);

        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            if (input.value === solutions[qName]) {
                input.parentElement.style.cssText = "background-color:#d4edda!important;display:block;padding:2px;border-radius:4px;";
            } else {
                input.parentElement.style.backgroundColor = "transparent";
            }
        });

        if (userChoice) {
            if (userChoice.value === solutions[qName]) {
                score += 20;
                resSpan.innerHTML = `<b style="color:green;float:right;">+20 pts</b>`;
            } else {
                userChoice.parentElement.style.cssText = "background-color:#f8d7da!important;display:block;padding:2px;border-radius:4px;";
                resSpan.innerHTML = `<b style="color:red;float:right;">+0 pt</b>`;
            }
        }
    }

    document.getElementById('points-result').innerText = score; 
    document.getElementById('percent-result').innerText = score;

    const statusFinal = document.getElementById('status-result');
    statusFinal.innerHTML = score >= 80
        ? '<b style="color:green;">☑ RÉUSSI</b>'
        : '<b style="color:red;">☑ ÉCHEC</b>';
}


// 🔥 VERSION FULL SYNC PDF (PAS DE SCALE JS)
function genererPDF() {

    if (!window.scoreValide) {
        showAlert("Veuillez d'abord cliquer sur 'VALIDER SCORE'");
        return;
    }

    const element = document.getElementById('document-to-print');
    const nomAgent = document.getElementById('nom-agent').value || "Inconnu";

    const opt = {
        margin: 0,
        filename: `EVALUATION_DGR_${nomAgent.toUpperCase()}.pdf`,
        image: { type: 'jpeg', quality: 1 },

        html2canvas: { 
            scale: 2,
            useCORS: true,
            scrollY: 0
        },

        jsPDF: { 
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        }
    };

    document.querySelectorAll('.btn-area, .no-print')
        .forEach(el => el.style.display = 'none');

    html2pdf().set(opt).from(element).save().then(() => {

        document.querySelectorAll('.btn-area, .no-print')
            .forEach(el => el.style.display = 'flex');

    });
}


// --- EMAIL (inchangé)
async function envoyerEmail() {

    if (!window.scoreValide) {
        showAlert("Veuillez d'abord cliquer sur 'VALIDER SCORE'");
        return;
    }

    const btn = document.querySelector('.envoyer');
    btn.disabled = true;
    btn.textContent = "Envoi...";

    const q1Selected = Array.from(document.querySelectorAll('input[name="q1"]:checked'))
        .map(el => el.value);

    const data = {
        nom_agent: document.getElementById('nom-agent').value,
        prenom_agent: document.getElementById('prenom-agent').value,
        nom_eval: document.getElementById('nom-eval').value,
        prenom_eval: document.getElementById('prenom-eval').value,
        fonction_eval: document.getElementById('fonction-eval').value,
        date_eval: document.getElementById('date-eval').value,
        lieu_eval: document.getElementById('lieu-eval').value,
        points: parseInt(document.getElementById('points-result').innerText) || 0,
        pourcentage: parseFloat(document.getElementById('percent-result').innerText) || 0,
        status: document.getElementById('status-result').innerText,
        sig_eval: document.getElementById('sig-eval').innerText,
        sig_stagiaire: document.getElementById('sig-stagiaire').innerText,
        reponses: {
            q1: q1Selected,
            q2: document.querySelector('input[name="q2"]:checked')?.value || "",
            q3: document.querySelector('input[name="q3"]:checked')?.value || "",
            q4: document.querySelector('input[name="q4"]:checked')?.value || "",
            q5: document.querySelector('input[name="q5"]:checked')?.value || ""
        }
    };

    try {
        const response = await fetch('/submit?action=email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showAlert("Félicitations ! Email envoyé avec succès.");
        } else {
            const err = await response.json();
            showAlert("Erreur : " + err.detail);
        }

    } catch (e) {
        showAlert("Erreur de connexion au serveur.");
    } finally {
        btn.disabled = false;
        btn.textContent = "ENVOYER EMAIL";
    }
}