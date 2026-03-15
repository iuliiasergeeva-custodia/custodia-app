/**
 * Authentication handler: login, logout, me, forgot-password, reset-password.
 * Uses JWT in httpOnly cookie for security. Passwords hashed with bcrypt.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { COOKIE_NAME, JWT_SECRET } = require('../middleware/auth');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '7d';
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res) {
    try {
        const { email, password } = req.body || {};
        if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const emailNorm = email.trim().toLowerCase();
        const result = await db.query(
            `SELECT u.id, u.client_id, u.name, u.email, u.password_hash, u.role, c.slug AS client_slug
             FROM users u
             JOIN clients c ON c.id = u.client_id
             WHERE LOWER(u.email) = $1`,
            [emailNorm]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const payload = {
            userId: user.id,
            clientId: user.client_id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientSlug: user.client_slug,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                clientSlug: user.client_slug,
            },
        });
    } catch (err) {
        console.error('❌ [AUTH] Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
}

/**
 * POST /api/auth/logout
 */
function logout(req, res) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.json({ success: true });
}

/**
 * GET /api/auth/me
 * Requires auth. Returns current user (no password).
 */
async function me(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({
        success: true,
        user: {
            id: req.user.userId,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            clientSlug: req.user.clientSlug,
        },
    });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always returns same message to avoid email enumeration.
 */
async function forgotPassword(req, res, transporter) {
    try {
        const { email } = req.body || {};
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }
        const emailNorm = email.trim().toLowerCase();
        const userResult = await db.query(
            'SELECT id, name, email FROM users WHERE LOWER(email) = $1',
            [emailNorm]
        );
        const genericMessage = 'If an account exists with this email, you will receive a password reset link shortly.';
        if (userResult.rows.length === 0) {
            return res.json({ success: true, message: genericMessage });
        }
        const user = userResult.rows[0];
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
        await db.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
            [user.id, tokenHash, expiresAt]
        );
        const baseUrl = process.env.APP_BASE_URL || (req.protocol + '://' + req.get('host'));
        const resetLink = `${baseUrl}/pages/auth/reset-password?token=${rawToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: '[Custodia] Password reset',
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Password reset</h2>
                    <p>Hi ${user.name || 'User'},</p>
                    <p>You requested a password reset. Click the link below (valid for 1 hour):</p>
                    <p><a href="${resetLink}">${resetLink}</a></p>
                    <p>If you did not request this, you can ignore this email.</p>
                    <p>— Custodia</p>
                </div>
            `,
            text: `Password reset: ${resetLink} (valid for 1 hour). If you did not request this, ignore this email.`,
        };
        if (process.env.EMAIL_TEST_MODE === 'true') {
            console.log('📧 [TEST] Forgot password link:', resetLink);
            return res.json({ success: true, message: genericMessage });
        }
        await transporter.sendMail(mailOptions);
        return res.json({ success: true, message: genericMessage });
    } catch (err) {
        console.error('❌ [AUTH] Forgot password error:', err);
        return res.json({ success: true, message: 'If an account exists with this email, you will receive a password reset link shortly.' });
    }
}

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body || {};
        if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const tokenHash = hashToken(token.trim());
        const tokenResult = await db.query(
            `SELECT id, user_id, expires_at FROM password_reset_tokens
             WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
            [tokenHash]
        );
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
        }
        const row = tokenResult.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
            await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        return res.json({ success: true, message: 'Password has been reset. You can log in now.' });
    } catch (err) {
        console.error('❌ [AUTH] Reset password error:', err);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
}

module.exports = {
    login,
    logout,
    me,
    forgotPassword,
    resetPassword,
    SALT_ROUNDS,
};
