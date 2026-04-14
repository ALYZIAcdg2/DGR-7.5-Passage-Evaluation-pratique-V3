// Affiche l'alerte personnalisée Alyzia
function showAlert(message) {
    const modal = document.getElementById('custom-alert');
    const msgElem = document.getElementById('alert-message');
    if (modal && msgElem) {
        msgElem.textContent = message;
        modal.style.display = 'flex';
    } else { alert(message); }
}

// Variable pour suivre si le score a été validé
let scoreValide = false; // Bloque l'affichage au départ

function calculerScore(isManualClick = false) {
    // 1. SI CLIC SUR BOUTON : ON VÉRIFIE LES CHAMPS
    if (isManualClick) {
        const nomAgent = document.getElementById('nom-agent').value.trim();
        const nomEval = document.getElementById('nom-eval').value.trim();
        const dateEval = document.getElementById('date-eval').value.trim();
        const lieuEval = document.getElementById('lieu-eval').value.trim();
        const sigEval = document.getElementById('sig-eval').innerText.trim();
        const sigStag = document.getElementById('sig-stagiaire').innerText.trim();

        if (!nomAgent || !nomEval || !dateEval || !lieuEval || !sigEval || !sigStag) {
            showAlert("Veuillez remplir tous les champs (Nom, Date, Lieu et Signatures) avant de valider.");
            return;
        }

        // Vérifier que toutes les questions ont une réponse
        for (let i = 1; i <= 5; i++) {
            if (!document.querySelector(`input[name="q${i}"]:checked`)) {
                showAlert(`Veuillez répondre à la question ${i} avant de valider.`);
                return;
            }
        }
        scoreValide = true; // Autorise l'affichage des couleurs
    }

    // 2. SI PAS ENCORE VALIDÉ, ON ARRÊTE ICI (Pas de couleurs)
    if (!scoreValide) return;

    let score = 0;
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // --- QUESTION 1 ---
    const q1Corrects = ["SITADOC", "IATA"];
    const q1Inputs = document.querySelectorAll('input[name="q1"]');
    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    let q1Error = false;

    q1Inputs.forEach(input => {
        const isSolution = q1Corrects.includes(input.value);
        input.parentElement.style.setProperty('background-color', isSolution ? '#d4edda' : 'transparent', 'important');
    });

    q1Choices.forEach(choice => {
        if (!q1Corrects.includes(choice.value)) {
            choice.parentElement.style.setProperty('background-color', '#f8d7da', 'important');
            q1Error = true;
        }
    });

    const q1Points = (q1Choices.length > 0 && !q1Error) ? 20 : 0;
    score += q1Points;
    document.getElementById('res-q1').innerHTML = `<span style="color:${q1Points > 0 ? 'green' : 'red'}">+${q1Points} pts</span>`;

    // --- QUESTIONS 2 À 5 ---
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);
        
        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            const isSolution = input.value === solutions[qName];
            input.parentElement.style.setProperty('background-color', isSolution ? '#d4edda' : 'transparent', 'important');
        });

        if (userChoice) {
            if (userChoice.value === solutions[qName]) {
                score += 20;
                resSpan.innerHTML = `<span style="color:green">+20 pts</span>`;
            } else {
                userChoice.parentElement.style.setProperty('background-color', '#f8d7da', 'important');
                resSpan.innerHTML = `<span style="color:red">+0 pt</span>`;
            }
        }
    }

    // --- AFFICHAGE FINAL ---
    document.getElementById('points-result').innerText = score;
    document.getElementById('percent-result').innerText = score;
    
    const status = document.getElementById('status-result');
    status.innerHTML = score >= 80 ? '<span style="color:green">☑ RÉUSSI</span>' : '<span style="color:red">☑ ÉCHEC</span>';
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