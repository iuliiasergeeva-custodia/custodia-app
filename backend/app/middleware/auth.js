/**
 * Authentication middleware.
 * Verifies JWT from cookie (preferred) or Authorization: Bearer header.
 * Always does a live DB lookup for role and clientSlug so that admin
 * changes (assigning a client, changing role) are reflected immediately
 * without requiring the user to log out and back in.
 * Sets req.user = { userId, clientId, email, name, role, clientSlug }.
 */

const jwt = require('jsonwebtoken');
const db = require('../db');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const COOKIE_NAME = 'custodia_token';

function getTokenFromRequest(req) {
    const cookie = req.cookies && req.cookies[COOKIE_NAME];
    if (cookie) return cookie;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }
    return null;
}

/**
 * Require valid auth. On failure: API requests get 401 JSON; page requests redirect to login.
 * Always fetches live role and clientSlug from DB so stale JWT values never cause access issues.
 */
async function requireAuth(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return sendUnauthorized(req, res);
    }
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return sendUnauthorized(req, res);
    }

    // Live DB lookup — always use fresh role and clientSlug from the database
    try {
        const result = await db.query(
            `SELECT u.role, u.client_id, c.slug AS client_slug
             FROM users u
             LEFT JOIN clients c ON c.id = u.client_id
             WHERE u.id = $1`,
            [decoded.userId]
        );
        if (result.rows.length === 0) {
            // User was deleted from DB
            return sendUnauthorized(req, res);
        }
        const row = result.rows[0];
        req.user = {
            userId: decoded.userId,
            clientId: row.client_id ?? null,
            email: decoded.email,
            name: decoded.name,
            role: row.role,
            clientSlug: row.client_slug ?? null,
        };
    } catch (err) {
        // DB unavailable — fall back to JWT values so the app stays usable
        console.error('⚠️  [AUTH] DB lookup failed, falling back to JWT values:', err.message);
        req.user = {
            userId: decoded.userId,
            clientId: decoded.clientId ?? null,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            clientSlug: decoded.clientSlug ?? null,
        };
    }

    next();
}

function sendUnauthorized(req, res) {
    // Inside routers mounted under /api/..., req.path is only the suffix (often "/"), not "/api/...".
    const isApi = (req.originalUrl || '').split('?')[0].startsWith('/api/');
    const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (wantsJson || isApi) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    return res.redirect(302, '/pages/auth/login?redirect=' + encodeURIComponent(req.originalUrl || '/pages/dashboard'));
}

module.exports = {
    requireAuth,
    getTokenFromRequest,
    COOKIE_NAME,
    JWT_SECRET,
};
