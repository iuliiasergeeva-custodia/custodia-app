(function () {
    const form = document.getElementById('forgotForm');
    const emailInput = document.getElementById('email');
    const errorEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');
    const submitBtn = document.getElementById('submitBtn');

    function showError(msg) {
        successEl.hidden = true;
        errorEl.textContent = msg;
        errorEl.hidden = false;
    }

    function showSuccess(msg) {
        errorEl.hidden = true;
        successEl.textContent = msg;
        successEl.hidden = false;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        errorEl.hidden = true;
        successEl.hidden = true;
        const email = (emailInput.value || '').trim();
        if (!email) {
            showError('Please enter your email.');
            return;
        }
        submitBtn.disabled = true;
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showError(data.error || data.message || 'Something went wrong. Please try again.');
                return;
            }
            showSuccess(data.message || 'If an account exists with this email, you will receive a reset link shortly.');
        } catch (err) {
            showError('Unable to connect. Please try again.');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
