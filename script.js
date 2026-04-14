function showAlert(message) {
    const modal = document.getElementById('custom-alert');
    const msgElem = document.getElementById('alert-message');
    if (modal && msgElem) {
        msgElem.textContent = message;
        modal.style.display = 'flex';
    } else { alert(message); }
}

function calculerScore() {
    const fields = ['nom-agent', 'prenom-agent', 'nom-eval', 'prenom-eval', 'fonction-eval', 'lieu-eval'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.value.toUpperCase();
    });

    // Logique de calcul simplifiée pour l'exemple
    const totalPoints = 100; // À adapter avec ta logique de points
    document.getElementById('points-result').textContent = totalPoints;
    document.getElementById('percent-result').textContent = "100%";
    document.getElementById('status-result').innerText = "RÉUSSI";
}

function genererPDF() {
    const element = document.getElementById('document-to-print');
    const opt = {
        margin: 5,
        filename: `EVAL_DGR_${document.getElementById('nom-agent').value || 'EXPORT'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
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