// Fonction pour afficher une alerte personnalisée
function showAlert(message) {
    const modal = document.getElementById('custom-alert');
    const msgElem = document.getElementById('alert-message');
    if (modal && msgElem) {
        msgElem.textContent = message;
        modal.style.display = 'flex';
    } else {
        alert(message);
    }
}

function calculerScore() {
    // Liste des champs à transformer en majuscules automatiquement
    const fieldsToUppercase = [
        'nom-agent', 'prenom-agent',
        'nom-eval', 'prenom-eval', 'fonction-eval',
        'lieu-eval'
    ];

    fieldsToUppercase.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.value.toUpperCase();
    });

    // --- 1. VÉRIFICATION DES INFOS GÉNÉRALES ---
    const inputDate = document.getElementById('date-eval');
    const inputLieu = document.getElementById('lieu-eval');

    if (!inputDate || inputDate.value === "") {
        showAlert("Action bloquée : La Date de l'évaluation est obligatoire.");
        return;
    }
    if (!inputLieu || inputLieu.value.trim() === "") {
        showAlert("Action bloquée : Le Lieu d'évaluation est obligatoire.");
        return;
    }

    // --- 2. VÉRIFICATION AGENT ÉVALUÉ ---
    const nomAgent = document.getElementById('nom-agent');
    const prenomAgent = document.getElementById('prenom-agent');

    if (!nomAgent || nomAgent.value.trim() === "") {
        showAlert("Action bloquée : Le Nom de l'agent est obligatoire.");
        return;
    }
    if (!prenomAgent || prenomAgent.value.trim() === "") {
        showAlert("Action bloquée : Le Prénom de l'agent est obligatoire.");
        return;
    }

    // --- 3. VÉRIFICATION ÉVALUATEUR ---
    const nomEval = document.getElementById('nom-eval');
    const prenomEval = document.getElementById('prenom-eval');
    const fonctionEval = document.getElementById('fonction-eval');

    if (!nomEval || nomEval.value.trim() === "") {
        showAlert("Action bloquée : Le Nom de l'évaluateur est obligatoire.");
        return;
    }
    if (!prenomEval || prenomEval.value.trim() === "") {
        showAlert("Action bloquée : Le Prénom de l'évaluateur est obligatoire.");
        return;
    }
    if (!fonctionEval || fonctionEval.value.trim() === "") {
        showAlert("Action bloquée : La Fonction de l'évaluateur est obligatoire.");
        return;
    }

    // --- 4. VÉRIFICATION SIGNATURES ---
    const sigEval = document.getElementById('sig-eval');
    const sigStagiaire = document.getElementById('sig-stagiaire');

    if (!sigEval || sigEval.innerText.trim() === "") {
        showAlert("Action bloquée : La signature/commentaire de l'évaluateur est obligatoire.");
        return;
    }
    if (!sigStagiaire || sigStagiaire.innerText.trim() === "") {
        showAlert("Action bloquée : La signature du stagiaire est obligatoire.");
        return;
    }

    // --- 5. VÉRIFICATION DES RÉPONSES ---
    const questions = ['q1', 'q2', 'q3', 'q4', 'q5'];
    let toutesRepondues = true;

    questions.forEach(q => {
        const res = document.querySelector(`input[name="${q}"]:checked`);
        if (!res) toutesRepondues = false;
    });

    if (!toutesRepondues) {
        showAlert("Action bloquée : Vous devez répondre à toutes les questions.");
        return;
    }

    let score = 0;

    // Nettoyage styles
    const labels = document.querySelectorAll('.question-card label');
    labels.forEach(label => {
        label.style.backgroundColor = "transparent";
        label.style.color = "black";
        label.style.fontWeight = "normal";
    });

    for (let i = 1; i <= 5; i++) {
        const span = document.getElementById(`res-q${i}`);
        if (span) span.textContent = "";
    }

    // Logique Q1
    const q1_SITADOC = document.querySelector('input[name="q1"][value="SITADOC"]');
    const q1_IATA = document.querySelector('input[name="q1"][value="IATA"]');
    const q1_REPLI = document.querySelector('input[name="q1"][value="REPLI"]');
    const resQ1 = document.getElementById('res-q1');

    if (q1_SITADOC) q1_SITADOC.parentElement.style.backgroundColor = "#d4edda";
    if (q1_IATA) q1_IATA.parentElement.style.backgroundColor = "#d4edda";

    if (q1_REPLI && q1_SITADOC && q1_IATA && !q1_REPLI.checked && (q1_SITADOC.checked || q1_IATA.checked)) {
        score += 20;
        if (resQ1) {
            resQ1.textContent = "+20 pts";
            resQ1.style.color = "green";
        }
    } else {
        if (resQ1) {
            resQ1.textContent = "+0 pt";
            resQ1.style.color = "red";
        }
        if (q1_REPLI && q1_REPLI.checked) {
            q1_REPLI.parentElement.style.backgroundColor = "#f8d7da";
            q1_REPLI.parentElement.style.color = "#721c24";
        }
    }

    // Logique Q2-Q5
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const radios = document.querySelectorAll(`input[name="${qName}"]`);
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-q${i}`);
        let isCorrect = false;

        radios.forEach(r => {
            if (r.parentElement.textContent.trim().includes(solutions[qName])) {
                r.parentElement.style.backgroundColor = "#d4edda";
                r.parentElement.style.fontWeight = "bold";
            }
        });

        if (userChoice && userChoice.parentElement.textContent.trim().includes(solutions[qName])) {
            score += 20;
            isCorrect = true;
        } else if (userChoice) {
            userChoice.parentElement.style.backgroundColor = "#f8d7da";
            userChoice.parentElement.style.color = "#721c24";
        }

        if (resSpan) {
            resSpan.textContent = isCorrect ? "+20 pts" : "+0 pt";
            resSpan.style.color = isCorrect ? "green" : "red";
        }
    }

    const pct = (score / 100) * 100;
    document.getElementById('points-result').textContent = score;
    document.getElementById('percent-result').textContent = pct;

    const status = document.getElementById('status-result');
    if (pct >= 80) {
        status.innerHTML = "<strong>✅ L'évaluation a été validée.</strong>";
        status.style.color = "green";
    } else {
        status.innerHTML = "<strong>❌ L'évaluation n'a pas été validée.</strong>";
        status.style.color = "red";
    }
}

function genererPDF() {
    const element = document.getElementById('document-to-print');
    const btnArea = document.querySelector('.btn-area');

    if (typeof html2pdf === "undefined") {
        showAlert("Erreur : la librairie PDF n'est pas chargée.");
        return;
    }

    if (btnArea) btnArea.style.display = 'none';

    // Synchronisation forcée des données saisies
    const inputs = element.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) {
                input.setAttribute('checked', 'checked');
            } else {
                input.removeAttribute('checked');
            }
        } else {
            input.setAttribute('value', (input.value || '').toUpperCase());
        }
    });

    const sigs = element.querySelectorAll('.sig-content');
    sigs.forEach(sig => {
        sig.innerHTML = sig.innerText.toUpperCase();
    });

    const nom = document.getElementById('nom-agent').value || "AGENT";

    const opt = {
        margin: [5, 5, 5, 5],
        filename: `EVAL_DGR_${nom}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 1,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            letterRendering: true
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        }
    };

    html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
            if (btnArea) btnArea.style.display = 'block';
        })
        .catch(err => {
            if (btnArea) btnArea.style.display = 'block';
            console.error("Erreur PDF:", err);
            showAlert("Erreur lors de la génération du PDF.");
        });
}

function envoyerEmail() {
    const nom = document.getElementById('nom-agent').value;
    const score = document.getElementById('points-result').textContent;
    const statusText = document.getElementById('status-result').innerText;

    const sujet = encodeURIComponent(`Évaluation DGR 7.5 - ${nom}`);
    const corps = encodeURIComponent(`Agent : ${nom}\nScore : ${score}/100\nRésultat : ${statusText}`);
    window.location.href = `mailto:xavier.oliere@alyzia.com?subject=${sujet}&body=${corps}`;
}