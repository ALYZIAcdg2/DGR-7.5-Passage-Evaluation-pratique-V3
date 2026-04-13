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

async function genererPDF() {
    // On s'assure que le score est calculé
    calculerScore();

    const data = {
        nom_agent: document.getElementById('nom-agent').value,
        prenom_agent: document.getElementById('prenom-agent').value,
        nom_eval: document.getElementById('nom-eval').value,
        prenom_eval: document.getElementById('prenom-eval').value,
        fonction_eval: document.getElementById('fonction-eval').value,
        date_eval: document.getElementById('date-eval').value,
        lieu_eval: document.getElementById('lieu-eval').value,
        points: parseInt(document.getElementById('points-result').textContent),
        pourcentage: parseFloat(document.getElementById('percent-result').textContent),
        status: document.getElementById('status-result').innerText
    };

    // Appel au serveur Render pour générer le PDF parfait
    const response = await fetch('/submit?action=download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EVAL_DGR_${data.nom_agent.toUpperCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        showAlert("Erreur lors de la génération du PDF par le serveur.");
    }
}

async function envoyerEmail() {
    calculerScore();

    const data = {
        nom_agent: document.getElementById('nom-agent').value,
        prenom_agent: document.getElementById('prenom-agent').value,
        nom_eval: document.getElementById('nom-eval').value,
        prenom_eval: document.getElementById('prenom-eval').value,
        fonction_eval: document.getElementById('fonction-eval').value,
        date_eval: document.getElementById('date-eval').value,
        lieu_eval: document.getElementById('lieu-eval').value,
        points: parseInt(document.getElementById('points-result').textContent),
        pourcentage: parseFloat(document.getElementById('percent-result').textContent),
        status: document.getElementById('status-result').innerText
    };

    showAlert("Envoi du mail en cours...");

    const response = await fetch('/submit?action=email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        showAlert("✅ Email envoyé avec succès à Xavier Oliere !");
    } else {
        showAlert("❌ Erreur lors de l'envoi de l'email.");
    }
}
