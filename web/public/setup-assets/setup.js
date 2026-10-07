let currentStep = 1;
const TOTAL = 4;
let verifiedToken = '';

function goStep(n) {
    document.getElementById(`step${currentStep}`).classList.remove('active');
    document.getElementById(`ps${currentStep}`).classList.remove('active');
    if (n > currentStep) document.getElementById(`ps${currentStep}`).classList.add('done');
    currentStep = n;
    document.getElementById(`step${currentStep}`).classList.add('active');
    document.getElementById(`ps${currentStep}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePw(id, btn) {
    const inp = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        inp.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function checkPwStrength(pw) {
    const bar = document.getElementById('pw-strength');
    const hint = document.getElementById('pw-hint');
    bar.style.display = pw.length > 0 ? 'block' : 'none';
    let score = 0;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
    const labels = ['Schwach', 'Mittel', 'Gut', 'Stark'];
    bar.style.width = score * 25 + '%';
    bar.style.background = colors[score - 1] || '#334155';
    hint.style.color = '';
    hint.textContent =
        score > 0
            ? 'Passwortstärke: ' + (labels[score - 1] || '')
            : 'Mind. 12 Zeichen, Groß-/Kleinbuchstaben, Zahlen';
    document.getElementById('pw-confirm-hint').textContent = '';
}

async function verifyTokenAndNext() {
    const token = document.getElementById('setupToken').value.trim();
    const adminPass = document.getElementById('adminPass').value;
    const adminPassConfirm = document.getElementById('adminPassConfirm').value;
    const errorEl = document.getElementById('step1-error');
    const tokenStatus = document.getElementById('token-status');

    errorEl.style.display = 'none';

    if (!token) {
        errorEl.textContent = 'Bitte den Setup-Token eingeben.';
        errorEl.style.display = 'block';
        return;
    }
    if (!adminPass || adminPass.length < 12) {
        const h = document.getElementById('pw-hint');
        h.textContent = 'Passwort muss mindestens 12 Zeichen lang sein.';
        h.style.color = 'var(--danger)';
        return;
    }
    if (adminPass !== adminPassConfirm) {
        const h = document.getElementById('pw-confirm-hint');
        h.textContent = 'Passwörter stimmen nicht überein.';
        h.style.color = 'var(--danger)';
        return;
    }

    tokenStatus.style.display = 'flex';
    tokenStatus.className = 'status-badge checking';
    tokenStatus.innerHTML = '<i class="fas fa-circle-notch spin"></i> Token wird geprüft...';

    try {
        const r = await fetch('/api/setup/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        const data = await r.json();
        if (data.valid) {
            verifiedToken = token;
            tokenStatus.className = 'status-badge ok';
            tokenStatus.innerHTML = '<i class="fas fa-circle-check"></i> Token bestätigt';
            setTimeout(() => goStep(2), 500);
        } else {
            tokenStatus.className = 'status-badge error';
            tokenStatus.innerHTML = `<i class="fas fa-circle-xmark"></i> ${data.reason || 'Ungültiger Token'}`;
        }
    } catch (e) {
        tokenStatus.className = 'status-badge error';
        tokenStatus.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Verbindungsfehler';
    }
}

function validateRestaurantAndNext() {
    const name = document.getElementById('restName').value.trim();
    const errorEl = document.getElementById('step2-error');
    if (!name) {
        errorEl.textContent = 'Restaurantname ist erforderlich.';
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';
    goStep(3);
}

function copyCode(code, btn) {
    navigator.clipboard
        .writeText(code)
        .then(() => {
            const orig = btn.textContent;
            btn.textContent = '✓ Kopiert';
            setTimeout(() => {
                btn.textContent = orig;
            }, 1500);
        })
        .catch(() => {});
}

async function finishSetup() {
    const btn = document.getElementById('btn-finish');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch spin"></i> Wird gespeichert...';

    const restName = document.getElementById('restName').value.trim();
    const smtpUser = document.getElementById('smtpUser').value.trim();
    const smtpFrom = document.getElementById('smtpFrom').value.trim();

    const payload = {
        setupToken: verifiedToken,
        licenseKey: document.getElementById('licenseKey').value.trim(),
        smtp: {
            host: document.getElementById('smtpHost').value.trim(),
            port: parseInt(document.getElementById('smtpPort').value) || 465,
            secure: document.getElementById('smtpSecure').value === 'true',
            user: smtpUser,
            pass: document.getElementById('smtpPass').value,
            from: smtpUser ? `"${smtpFrom || restName}" <${smtpUser}>` : '',
        },
        restaurant: {
            name: restName,
            phone: document.getElementById('restPhone').value.trim(),
            address: document.getElementById('restAddress').value.trim(),
            website: document.getElementById('restWebsite').value.trim(),
            lang: document.getElementById('restLang').value,
            timezone: document.getElementById('restTz').value,
        },
        adminUser: 'admin',
        adminName: document.getElementById('adminName').value.trim(),
        adminEmail: document.getElementById('adminEmail').value.trim(),
        adminPass: document.getElementById('adminPass').value,
    };

    try {
        const res = await fetch('/api/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await res.json();

        if (result.success) {
            document.getElementById('success-user').textContent = result.adminUser || 'admin';
            document.getElementById('success-email').textContent = payload.adminEmail || '–';

            const listEl = document.getElementById('recovery-codes-list');
            if (result.recovery_codes && result.recovery_codes.length) {
                listEl.innerHTML = result.recovery_codes
                    .map(
                        (code) =>
                            `<div class="recovery-code">
            <span>${code}</span>
            <button class="copy-btn" onclick="copyCode('${code}', this)">Kopieren</button>
        </div>`
                    )
                    .join('');
            }

            for (let i = 1; i <= TOTAL; i++) {
                document.getElementById(`ps${i}`).classList.remove('active');
                document.getElementById(`ps${i}`).classList.add('done');
            }
            document.getElementById(`step${currentStep}`).classList.remove('active');
            document.getElementById('success-screen').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert('Fehler: ' + (result.reason || result.message || 'Unbekannter Fehler'));
            btn.disabled = false;
            btn.innerHTML = 'Setup abschließen <i class="fas fa-check"></i>';
        }
    } catch (e) {
        alert('Netzwerkfehler beim Speichern.\n\nDetails: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = 'Setup abschließen <i class="fas fa-check"></i>';
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        if (data.setupComplete) {
            window.location.href = '/admin';
        }
    } catch (_) {}
});
