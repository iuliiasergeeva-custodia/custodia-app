(function () {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    const form = document.getElementById('resetForm');
    const tokenInput = document.getElementById('token');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmInput = document.getElementById('confirmPassword');
    const errorEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    const submitBtn = document.getElementById('submitBtn');

    if (tokenFromUrl) {
        tokenInput.value = tokenFromUrl;
    } else {
        errorEl.textContent = 'Invalid reset link. Please use the link from your email or request a new one.';
        errorEl.hidden = false;
        form.querySelector('button[type="submit"]').disabled = true;
    }

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
        const token = (tokenInput.value || '').trim();
        const newPassword = newPasswordInput.value || '';
        const confirm = confirmInput.value || '';
        if (!token) {
            showError('Invalid reset link. Please use the link from your email.');
            return;
        }
        if (newPassword.length < 8) {
            showError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirm) {
            showError('Passwords do not match.');
            return;
        }
        submitBtn.disabled = true;
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showError(data.error || data.message || 'Failed to reset password. The link may have expired.');
                return;
            }
            showSuccess(data.message || 'Password has been reset. You can log in now.');
            form.reset();
            tokenInput.value = tokenFromUrl || '';
            setTimeout(function () {
                window.location.href = '/pages/auth/login';
            }, 2000);
        } catch (err) {
            showError('Unable to connect. Please try again.');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
