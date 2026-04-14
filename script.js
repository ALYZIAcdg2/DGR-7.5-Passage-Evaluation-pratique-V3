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
            // Q1 reste multi-choix, on ne traite que Q2 à Q5
            if (name !== 'q1') { 
                document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
                    if (cb !== this) cb.checked = false;
                });
            }
        }
        // Mise à jour visuelle en temps réel si déjà validé
        if (window.scoreValide) calculerScore(false);
    });
});

function calculerScore(isManualClick = false) {
    // 1. VERIFICATION DES CHAMPS OBLIGATOIRES (uniquement au clic bouton)
    if (isManualClick) {
        const nomAgent = document.getElementById('nom-agent').value.trim();
        const sigEval = document.getElementById('sig-eval').innerText.trim();
        const sigStag = document.getElementById('sig-stagiaire').innerText.trim();

        if (!nomAgent || !sigEval || !sigStag) {
            showAlert("Veuillez remplir le Nom de l'agent et les Signatures avant de valider.");
            return;
        }

        // Vérification que chaque question a au moins une réponse
        for (let i = 1; i <= 5; i++) {
            if (!document.querySelector(`input[name="q${i}"]:checked`)) {
                showAlert(`Veuillez répondre à la question ${i} avant de valider.`);
                return;
            }
        }
        window.scoreValide = true; 
    }

    // 2. BLOCAGE SI NON VALIDÉ
    if (!window.scoreValide) return;

    let score = 0;
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // --- CORRECTION Q1 (Multi-choix) ---
    const q1Corrects = ["SITADOC", "IATA"];
    const q1Inputs = document.querySelectorAll('input[name="q1"]');
    const q1Choices = document.querySelectorAll('input[name="q1"]:checked');
    let q1Error = false;

    q1Inputs.forEach(input => {
        if (q1Corrects.includes(input.value)) {
            // Vert forcé pour le PDF
            input.parentElement.style.cssText = "background-color: #d4edda !important; display: block; padding: 2px; border-radius: 4px;";
        } else {
            input.parentElement.style.backgroundColor = "transparent";
        }
    });

    q1Choices.forEach(choice => {
        if (!q1Corrects.includes(choice.value)) {
            // Rouge forcé pour l'erreur
            choice.parentElement.style.cssText = "background-color: #f8d7da !important; display: block; padding: 2px; border-radius: 4px;";
            q1Error = true;
        }
    });

    // Score Q1 : +20 si exactement les 2 bonnes réponses et aucune erreur
    const ptsQ1 = (q1Choices.length === 2 && !q1Error) ? 20 : 0;
    score += ptsQ1;
    document.getElementById('res-q1').innerHTML = `<b style="color:${ptsQ1 > 0 ? 'green' : 'red'} !important; float:right;">+${ptsQ1} pts</b>`;

    // --- CORRECTION Q2 à Q5 (Choix unique) ---
    for (let i = 2; i <= 5; i++) {
        const qName = `q${i}`;
        const userChoice = document.querySelector(`input[name="${qName}"]:checked`);
        const resSpan = document.getElementById(`res-${qName}`);
        
        document.querySelectorAll(`input[name="${qName}"]`).forEach(input => {
            if (input.value === solutions[qName]) {
                input.parentElement.style.cssText = "background-color: #d4edda !important; display: block; padding: 2px; border-radius: 4px;";
            } else {
                input.parentElement.style.backgroundColor = "transparent";
            }
        });

        if (userChoice) {
            if (userChoice.value === solutions[qName]) {
                score += 20;
                resSpan.innerHTML = `<b style="color:green !important; float:right;">+20 pts</b>`;
            } else {
                userChoice.parentElement.style.cssText = "background-color: #f8d7da !important; display: block; padding: 2px; border-radius: 4px;";
                resSpan.innerHTML = `<b style="color:red !important; float:right;">+0 pt</b>`;
            }
        }
    }

    // --- MISE À JOUR DU SCORE FINAL ---
    document.getElementById('points-result').innerText = score; 
    document.getElementById('percent-result').innerText = score;

    const statusFinal = document.getElementById('status-result');
    if (score >= 80) {
        statusFinal.innerHTML = '<b style="color:green !important;">☑ RÉUSSI</b>';
    } else {
        statusFinal.innerHTML = '<b style="color:red !important;">☑ ÉCHEC</b>';
    }
}

function genererPDF() {
    if (!window.scoreValide) {
        showAlert("Veuillez d'abord cliquer sur 'VALIDER SCORE' pour afficher les résultats.");
        return;
    }

    const element = document.getElementById('document-to-print');
    const nomAgent = document.getElementById('nom-agent').value || "Inconnu";

    // 🔥 RESET pour éviter bugs d’échelle
    document.body.style.zoom = "1";

    const opt = {
        margin: 0,
        filename: `EVALUATION_PRATIQUE_DGR 7.5_${nomAgent.toUpperCase()}.pdf`,
        image: { type: 'jpeg', quality: 1 },

        html2canvas: { 
            scale: 2,              // 🔥 qualité max
            useCORS: true,
            scrollY: 0             // 🔥 évite décalage
        },

        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        },

        pagebreak: { 
            mode: ['avoid-all']   // 🔥 anti coupure
        }
    };

    // 🔥 Masquer boutons
    document.querySelectorAll('.btn-area, .no-print')
        .forEach(el => el.style.display = 'none');

    // 🔥 CALCUL AUTO SCALE (clé du PERFECT)
    const elementHeight = element.scrollHeight;
    const elementWidth = element.scrollWidth;

    const ratio = Math.min(
        (1122 / elementHeight),   // hauteur A4 px
        (794 / elementWidth)      // largeur A4 px
    );

    element.style.transform = `scale(${ratio})`;
    element.style.transformOrigin = "top left";

    html2pdf().set(opt).from(element).save().then(() => {

        // 🔥 reset après génération
        element.style.transform = "scale(1)";

        document.querySelectorAll('.btn-area, .no-print')
            .forEach(el => el.style.display = 'flex');
    });
}

async function envoyerEmail() {
    if (!window.scoreValide) {
        showAlert("Veuillez d'abord cliquer sur 'VALIDER SCORE' avant d'envoyer l'email.");
        return;
    }

    const btn = document.querySelector('.envoyer');
    btn.disabled = true;
    btn.textContent = "Envoi...";

    // Capture des réponses (gestion spéciale pour Q1 multi-choix)
    const q1Selected = Array.from(document.querySelectorAll('input[name="q1"]:checked')).map(el => el.value);

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
            q1: q1Selected, // Envoie un tableau des réponses cochées
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