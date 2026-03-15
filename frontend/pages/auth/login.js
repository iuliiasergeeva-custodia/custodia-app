(function () {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('submitBtn');

    function getRedirect() {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        return redirect && redirect.startsWith('/') ? redirect : '/pages/dashboard';
    }

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
        const email = (emailInput.value || '').trim();
        const password = passwordInput.value || '';
        if (!email || !password) {
            showError('Please enter your email and password.');
            return;
        }
        submitBtn.disabled = true;
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showError(data.error || data.message || 'Log in failed. Please try again.');
                return;
            }
            window.location.replace(getRedirect());
        } catch (err) {
            showError('Unable to connect. Please try again.');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
