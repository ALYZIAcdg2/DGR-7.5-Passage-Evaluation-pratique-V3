function calculerScore() {
    const fields = ['nom-agent', 'prenom-agent', 'nom-eval', 'prenom-eval', 'fonction-eval', 'lieu-eval'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = el.value.toUpperCase(); });

    let score = 0;
    const solutions = {
        q2: "Toxique",
        q3: "Une cigarette électronique",
        q4: "Je préviens un responsable + périmètre de sécurité de 25m",
        q5: "Une boîte sécurisée de cartouches de chasse (4.5Kg brut)"
    };

    // Calcul visuel local
    const q1_sitadoc = document.querySelector('input[name="q1"][value="SITADOC"]');
    const q1_iata = document.querySelector('input[name="q1"][value="IATA"]');
    if (q1_sitadoc?.checked || q1_iata?.checked) score += 20;

    for (let i = 2; i <= 5; i++) {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        if (sel && sel.parentElement.textContent.includes(solutions[`q${i}`])) score += 20;
    }

    document.getElementById('points-result').textContent = score;
    document.getElementById('percent-result').textContent = score;
    const status = document.getElementById('status-result');
    status.innerText = score >= 80 ? "✅ Évaluation validée" : "❌ Évaluation non validée";
}

async function communiquerServeur(action) {
    calculerScore();
    const reponses = {};
    document.querySelectorAll('input:checked').forEach(i => { reponses[i.name] = i.value; });

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
        status: document.getElementById('status-result').innerText,
        sig_eval: document.getElementById('sig-eval').innerText,
        sig_stagiaire: document.getElementById('sig-stagiaire').innerText,
        reponses: reponses
    };

    const resp = await fetch(`/submit?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (action === 'download' && resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EVAL_DGR_${data.nom_agent}.pdf`;
        a.click();
    } else if (resp.ok) {
        alert("Email envoyé avec succès !");
    }
}

function genererPDF() { communiquerServeur('download'); }
function envoyerEmail() { communiquerServeur('email'); }