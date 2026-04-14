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

    // --- Logique Q1 ---
    const q1Corrects = ["SITADOC", "IATA"];
    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    const labelsQ1 = document.querySelectorAll('input[name="q1"]');
    
    // Reset et coloration Q1
    labelsQ1.forEach(input => {
        input.parentElement.style.backgroundColor = "transparent";
        if (q1Corrects.includes(input.value)) {
            input.parentElement.style.backgroundColor = "#d4edda"; // Vert pour les bonnes réponses
        }
    });

    let q1Points = 0;
    q1Choices.forEach(choice => {
        if (!q1Corrects.includes(choice.value)) {
            choice.parentElement.style.backgroundColor = "#f8d7da"; // Rouge si "Salle de repli" est coché
        }
    });
    // Validation spécifique Q1 (doit avoir les bons et pas le mauvais)
    const isQ1Valid = Array.from(q1Choices).some(c => q1Corrects.includes(c.value)) && 
                     !Array.from(q1Choices).some(c => c.value === "REPLI");
    
    if (isQ1Valid) q1Points = 20;
    document.getElementById('res-q1').textContent = `+${q1Points} pts`;
    document.getElementById('res-q1').style.color = q1Points > 0 ? "green" : "red";

    // --- Logique Q2 à Q5 ---
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);
        
        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            input.parentElement.style.backgroundColor = "transparent";
            // Toujours mettre la bonne réponse en vert
            if (input.parentElement.textContent.trim().includes(solutions[qName])) {
                input.parentElement.style.backgroundColor = "#d4edda";
            }
        });

        if (userChoice) {
            if (userChoice.parentElement.textContent.trim().includes(solutions[qName])) {
                resSpan.textContent = "+20 pts";
                resSpan.style.color = "green";
            } else {
                userChoice.parentElement.style.backgroundColor = "#f8d7da"; // Rouge pour la mauvaise réponse
                resSpan.textContent = "+0 pt";
                resSpan.style.color = "red";
            }
        }
    }

    // Affichage des résultats
    document.getElementById('points-result').textContent = score;
    document.getElementById('percent-result').textContent = score; 
// (Car le % est déjà écrit en dur dans le HTML à côté du strong)
    
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
    // On force le calcul pour avoir les couleurs
    calculerScore();

    const element = document.getElementById('document-to-print');
    
    // Paramètres pour haute qualité et masquage des boutons
    const opt = {
        margin: [0, 0], // Marges à zéro car gérées par le CSS
        filename: `EVAL_DGR_${document.getElementById('nom-agent').value}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { 
            scale: 3, // Augmente la netteté
            useCORS: true,
            logging: false,
            ignoreElements: (el) => el.classList.contains('no-print') || el.classList.contains('btn-area')
        },
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