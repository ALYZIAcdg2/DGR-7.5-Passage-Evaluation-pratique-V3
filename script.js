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
let scoreValide = false; // Bloque l'affichage tant qu'on n'a pas validé

// Fonction pour limiter à un seul choix (Questions 2 à 5)
document.querySelectorAll('.q-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        if (this.checked) {
            const name = this.getAttribute('name');
            if (name !== 'q1') { // On ne bloque pas la Q1 qui est multi-choix
                document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
                    if (cb !== this) cb.checked = false;
                });
            }
        }
        // Si on a déjà validé, on met à jour les couleurs en temps réel
        if (scoreValide) calculerScore(false);
    });
});

function calculerScore(isManualClick = false) {
    // 1. VERIFICATION DES CHAMPS
    if (isManualClick) {
        const nomAgent = document.getElementById('nom-agent').value.trim();
        const sigEval = document.getElementById('sig-eval').innerText.trim();
        const sigStag = document.getElementById('sig-stagiaire').innerText.trim();

        if (!nomAgent || !sigEval || !sigStag) {
            showAlert("Veuillez remplir le Nom de l'agent et les Signatures avant de valider.");
            return;
        }
        scoreValide = true; 
    }

    if (!scoreValide) return;

    let score = 0;
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // --- CORRECTION Q1 ---
    const q1Corrects = ["SITADOC", "IATA"];
    document.querySelectorAll('input[name="q1"]').forEach(input => {
        const isSol = q1Corrects.includes(input.value);
        if (isSol) {
            input.parentElement.style.cssText = "background-color: #d4edda !important; display: block; padding: 2px;";
        }
    });

    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    let q1Error = false;
    q1Choices.forEach(choice => {
        if (!q1Corrects.includes(choice.value)) {
            choice.parentElement.style.cssText = "background-color: #f8d7da !important; display: block; padding: 2px;";
            q1Error = true;
        }
    });
    const ptsQ1 = (q1Choices.length === 2 && !q1Error) ? 20 : 0;
    score += ptsQ1;
    document.getElementById('res-q1').innerHTML = `<b style="color:${ptsQ1 > 0 ? 'green' : 'red'} !important;">+${ptsQ1} pts</b>`;

    // --- CORRECTION Q2 à Q5 ---
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);
        
        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            if (input.value === solutions[qName]) {
                input.parentElement.style.cssText = "background-color: #d4edda !important; display: block; padding: 2px;";
            }
        });

        if (userChoice) {
            if (userChoice.value === solutions[qName]) {
                score += 20;
                resSpan.innerHTML = `<b style="color:green !important;">+20 pts</b>`;
            } else {
                userChoice.parentElement.style.cssText = "background-color: #f8d7da !important; display: block; padding: 2px;";
                resSpan.innerHTML = `<b style="color:red !important;">+0 pt</b>`;
            }
        }
    }

    // --- MISE À JOUR DU SCORE (Indispensable pour le mail) ---
    const pointsFinal = document.getElementById('points-result');
    const percentFinal = document.getElementById('percent-result');
    const statusFinal = document.getElementById('status-result');

    pointsFinal.innerText = score; 
    percentFinal.innerText = score;

    if (score >= 80) {
        statusFinal.innerHTML = '<b style="color:green !important;">☑ RÉUSSI</b>';
    } else {
        statusFinal.innerHTML = '<b style="color:red !important;">☑ ÉCHEC</b>';
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