const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');

const router = express.Router();

/**
 * Sign up a new user
 * POST /api/auth/signup
 * Body: { email, password, name, client_slug? }
 */
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name, client_slug } = req.body;
        
        // Validate input
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
        
        // Validate password strength (minimum 6 characters)
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters long'
            });
        }
        
        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        
        // Find or get default client
        let clientId;
        if (client_slug) {
            const clientResult = await db.query(
                'SELECT id FROM clients WHERE slug = $1',
                [client_slug]
            );
            if (clientResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Client not found'
                });
            }
            clientId = clientResult.rows[0].id;
        } else {
            // Get default client (first client or create one)
            const defaultClient = await db.query(
                'SELECT id FROM clients ORDER BY id LIMIT 1'
            );
            if (defaultClient.rows.length === 0) {
                // Create default client if none exists
                const newClient = await db.query(
                    'INSERT INTO clients (name, slug) VALUES ($1, $2) RETURNING id',
                    ['Default Client', 'default']
                );
                clientId = newClient.rows[0].id;
            } else {
                clientId = defaultClient.rows[0].id;
            }
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await db.query(
            `INSERT INTO users (client_id, name, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, client_id, name, email, role, created_at`,
            [clientId, name, email.toLowerCase(), passwordHash, 'viewer']
        );
        
        const user = result.rows[0];
        
        // Get client info
        const clientResult = await db.query(
            'SELECT id, name, slug FROM clients WHERE id = $1',
            [clientId]
        );
        
        // Set session
        req.session.userId = user.id;
        req.session.clientId = user.client_id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                client: clientResult.rows[0]
            },
            message: 'Account created successfully'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during signup'
        });
    }
});

/**
 * Log in a user
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        // Find user
        const result = await db.query(
            `SELECT u.id, u.client_id, u.name, u.email, u.password_hash, u.role, c.name as client_name, c.slug as client_slug
             FROM users u
             JOIN clients c ON u.client_id = c.id
             WHERE u.email = $1`,
            [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        const user = result.rows[0];
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        // Set session
        req.session.userId = user.id;
        req.session.clientId = user.client_id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                client: {
                    id: user.client_id,
                    name: user.client_name,
                    slug: user.client_slug
                }
            },
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during login'
        });
    }
});

/**
 * Log out a user
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                error: 'Error during logout'
            });
        }
        res.clearCookie('connect.sid');
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

/**
 * Check current session
 * GET /api/auth/session
 */
router.get('/session', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({
                success: false,
                authenticated: false
            });
        }
        
        // Get user and client info
        const result = await db.query(
            `SELECT u.id, u.client_id, u.name, u.email, u.role, c.name as client_name, c.slug as client_slug
             FROM users u
             JOIN clients c ON u.client_id = c.id
             WHERE u.id = $1`,
            [req.session.userId]
        );
        
        if (result.rows.length === 0) {
            // User not found, clear session
            req.session.destroy();
            return res.json({
                success: false,
                authenticated: false
            });
        }
        
        const user = result.rows[0];
        
        res.json({
            success: true,
            authenticated: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                client: {
                    id: user.client_id,
                    name: user.client_name,
                    slug: user.client_slug
                }
            }
        });
    } catch (error) {
        console.error('Session check error:', error);
        res.status(500).json({
            success: false,
            error: 'Error checking session'
        });
    }
});

module.exports = router;

