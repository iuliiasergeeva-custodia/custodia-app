(function () {
    const form = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const errorEl = document.getElementById('registerError');
    const submitBtn = document.getElementById('submitBtn');

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
    }

    function hideError() {
        errorEl.hidden = true;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        hideError();
        const name = (nameInput.value || '').trim();
        const email = (emailInput.value || '').trim();
        const password = passwordInput.value || '';
        const confirm = confirmInput.value || '';
        if (!name) {
            showError('Please enter your name.');
            return;
        }
        if (!email) {
            showError('Please enter your email.');
            return;
        }
        if (password.length < 8) {
            showError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            showError('Passwords do not match.');
            return;
        }
        submitBtn.disabled = true;
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showError(data.error || data.message || 'Registration failed. Please try again.');
                return;
            }
            window.location.replace('/pages/dashboard');
        } catch (err) {
            showError('Unable to connect. Please try again.');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
