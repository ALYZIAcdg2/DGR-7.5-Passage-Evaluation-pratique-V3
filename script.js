// Affiche l'alerte personnalisée Alyzia
function showAlert(message) {
    const modal = document.getElementById('custom-alert');
    const msgElem = document.getElementById('alert-message');
    if (modal && msgElem) {
        msgElem.textContent = message;
        modal.style.display = 'flex';
    } else { alert(message); }
}

function calculerScore() {
    // Mise en majuscules automatique
    const fields = ['nom-agent', 'prenom-agent', 'nom-eval', 'prenom-eval', 'fonction-eval', 'lieu-eval'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.value.toUpperCase();
    });

    // Validation des champs obligatoires
    if (!document.getElementById('nom-agent').value || !document.getElementById('date-eval').value) {
        showAlert("Veuillez remplir les informations de l'agent et la date.");
        return;
    }

    let score = 0;
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // Nettoyage des anciens résultats sans vider les cases cochées
    document.querySelectorAll('.question-card label').forEach(l => {
        l.style.backgroundColor = "transparent";
        l.style.color = "black";
    });

    // Logique Q1 (SITADOC + IATA sont les bonnes réponses)
    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    const resQ1 = document.getElementById('res-q1');
    let q1Correct = Array.from(q1Choices).some(c => c.value === "SITADOC" || c.value === "IATA");
    
    if (q1Correct) {
        score += 20;
        resQ1.textContent = "+20 pts";
        resQ1.style.color = "green";
    } else {
        resQ1.textContent = "+0 pt";
        resQ1.style.color = "red";
    }

    // Logique Q2 à Q5
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);
        
        // Coloration de la bonne réponse en vert (systématique)
        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            if (input.parentElement.textContent.includes(solutions[qName])) {
                input.parentElement.style.backgroundColor = "#d4edda";
            }
        });

        if (userChoice && userChoice.parentElement.textContent.includes(solutions[qName])) {
            score += 20;
            resSpan.textContent = "+20 pts";
            resSpan.style.color = "green";
        } else if (userChoice) {
            userChoice.parentElement.style.backgroundColor = "#f8d7da";
            resSpan.textContent = "+0 pt";
            resSpan.style.color = "red";
        }
    }

    // Affichage des résultats
    document.getElementById('points-result').textContent = score;
    document.getElementById('percent-result').textContent = score + "%";
    
    const status = document.getElementById('status-result');
    if (score >= 80) {
        status.innerHTML = "<strong>✅ RÉUSSI - Évaluation validée</strong>";
        status.style.color = "green";
    } else {
        status.innerHTML = "<strong>❌ ÉCHEC - À refaire</strong>";
        status.style.color = "red";
    }
}

function genererPDF() {
    // On s'assure que le score est calculé avant de figer pour le PDF
    calculerScore();

    const element = document.getElementById('document-to-print');
    
    // Synchronisation pour html2pdf
    element.querySelectorAll('input').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) input.setAttribute('checked', 'checked');
            else input.removeAttribute('checked');
        } else {
            input.setAttribute('value', input.value);
        }
    });

    const opt = {
        margin: 5,
        filename: `EVAL_DGR_${document.getElementById('nom-agent').value}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

async function envoyerEmail() {
    const btn = document.querySelector('.envoyer');
    btn.disabled = true;
    btn.textContent = "Envoi...";

    const data = {
        nom_agent: document.getElementById('nom-agent').value,
        prenom_agent: document.getElementById('prenom-agent').value,
        nom_eval: document.getElementById('nom-eval').value,
        prenom_eval: document.getElementById('prenom-eval').value,
        fonction_eval: document.getElementById('fonction-eval').value,
        date_eval: document.getElementById('date-eval').value,
        lieu_eval: document.getElementById('lieu-eval').value,
        points: parseInt(document.getElementById('points-result').textContent) || 0,
        pourcentage: parseFloat(document.getElementById('percent-result').textContent) || 0,
        status: document.getElementById('status-result').innerText,
        sig_eval: document.getElementById('sig-eval').innerText,
        sig_stagiaire: document.getElementById('sig-stagiaire').innerText,
        reponses: {
            q1: document.querySelector('input[name="q1"]:checked')?.value || "",
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