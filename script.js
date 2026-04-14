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
    let score = 0;
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // --- Logique Q1 (Cases à cocher) ---
    const q1Corrects = ["SITADOC", "IATA"];
    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    const q1Inputs = document.querySelectorAll('input[name="q1"]');
    
    q1Inputs.forEach(input => {
        // Reset et met en vert les bonnes solutions par défaut avec !important pour le PDF
        if (q1Corrects.includes(input.value)) {
            input.parentElement.style.setProperty('background-color', '#d4edda', 'important');
        } else {
            input.parentElement.style.setProperty('background-color', 'transparent', 'important');
        }
    });

    let q1Error = false;
    q1Choices.forEach(choice => {
        if (!q1Corrects.includes(choice.value)) {
            // Rouge forcé pour l'erreur
            choice.parentElement.style.setProperty('background-color', '#f8d7da', 'important');
            q1Error = true;
        }
    });

    // Calcul des points Q1 : 20 pts si au moins une bonne réponse et aucune erreur
    const q1Points = (q1Choices.length > 0 && !q1Error) ? 20 : 0;
    score += q1Points;
    const resQ1 = document.getElementById('res-q1');
    if(resQ1) {
        resQ1.textContent = `+${q1Points} pts`;
        resQ1.style.setProperty('color', q1Points > 0 ? 'green' : 'red', 'important');
    }

    // --- Logique Q2 à Q5 (Boutons Radio) ---
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);
        
        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            // Met systématiquement la bonne réponse en vert avec !important
            if (input.parentElement.textContent.includes(solutions[qName])) {
                input.parentElement.style.setProperty('background-color', '#d4edda', 'important');
            } else {
                input.parentElement.style.setProperty('background-color', 'transparent', 'important');
            }
        });

        if (userChoice) {
            const parent = userChoice.parentElement;
            if (parent.textContent.includes(solutions[qName])) {
                score += 20;
                if(resSpan) {
                    resSpan.textContent = "+20 pts";
                    resSpan.style.setProperty('color', 'green', 'important');
                }
            } else {
                // APPLIQUE LE ROUGE FORCÉ SUR LE MAUVAIS CHOIX
                parent.style.setProperty('background-color', '#f8d7da', 'important');
                if(resSpan) {
                    resSpan.textContent = "+0 pt";
                    resSpan.style.setProperty('color', 'red', 'important');
                }
            }
        }
    }

    // Mise à jour des scores dans le HTML
    const pointsElem = document.getElementById('points-result');
    const percentElem = document.getElementById('percent-result');
    
    if(pointsElem) pointsElem.textContent = score; 
    if(percentElem) percentElem.textContent = score; 
    
    const status = document.getElementById('status-result');
    if(status) {
        status.innerText = score >= 80 ? "✅ RÉUSSI" : "❌ ÉCHEC";
        status.style.setProperty('color', score >= 80 ? 'green' : 'red', 'important');
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