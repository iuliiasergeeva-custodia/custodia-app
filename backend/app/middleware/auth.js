/**
 * Authentication middleware.
 * Verifies JWT from cookie (preferred) or Authorization: Bearer header.
 * Sets req.user = { userId, clientId, email, name, role, clientSlug }.
 */

const jwt = require('jsonwebtoken');

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
 */
function requireAuth(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return sendUnauthorized(req, res);
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            clientId: decoded.clientId,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            clientSlug: decoded.clientSlug,
        };
        next();
    } catch (err) {
        return sendUnauthorized(req, res);
    }
}

function sendUnauthorized(req, res) {
    const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (wantsJson || req.path.startsWith('/api/')) {
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
