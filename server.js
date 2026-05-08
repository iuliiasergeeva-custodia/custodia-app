const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'ADMIN_API_KEY', 'LOCATIONS_API_KEY'];
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    const msg = `Missing required environment variables: ${missingVars.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
        throw new Error(msg);
    } else {
        console.warn(`⚠️  [STARTUP] ${msg} — using insecure defaults for development`);
    }
}
const ingestLocations = require('./backend/app/handlers/ingestLocations');
const adminRouter = require('./backend/app/handlers/admin');
const newsRouter = require('./backend/app/handlers/news');
const expensesRouter = require('./backend/app/handlers/expenses');
const authHandler = require('./backend/app/handlers/auth');
const { requireAuth } = require('./backend/app/middleware/auth');
const myriotaWebhook = require('./backend/app/handlers/myriotaWebhook');

const app = express();
// Use PORT from environment, or default to 3000 for local development
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: whitelist specific origins (set ALLOWED_ORIGINS env var in production)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // server-to-server / curl
        if (!allowedOrigins) return callback(null, true); // dev: no whitelist configured
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Request logging middleware (for debugging)
app.use((req, res, next) => {
    if (req.path === '/api/contact') {
        console.log(`\n📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    }
    next();
});

// Serve landing page at root (custodia.world shows landing directly, no redirect)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'landing', 'index.html'));
});

// Admin pages — must be registered BEFORE express.static to prevent static bypass
// express.static would otherwise redirect /pages/admin → /pages/admin/ and serve HTML without auth
app.get(['/pages/admin', '/pages/admin/'], requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.redirect(302, '/pages/dashboard');
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'admin', 'index.html'));
});
app.get(['/pages/admin/news', '/pages/admin/news/'], requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.redirect(302, '/pages/dashboard');
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'admin', 'news', 'index.html'));
});
app.get(['/pages/admin/expenses', '/pages/admin/expenses/'], requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.redirect(302, '/pages/dashboard');
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'admin', 'expenses', 'index.html'));
});

// Quote page — public, no auth required
app.get(['/pages/quote', '/pages/quote/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'quote', 'index.html'));
});

// Serve static files from frontend
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// Serve static files from /static path for dashboard assets
app.use('/static', express.static(path.join(__dirname, 'frontend')));

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Rate limiting for contact form
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many contact form submissions, please try again later.'
    }
});

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL for port 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 15000,
    socketTimeout: 15000,
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
    logger: process.env.NODE_ENV === 'development'
});

// Verify email configuration on startup (non-blocking)
if (process.env.EMAIL_TEST_MODE !== 'true') {
    transporter.verify(function(error, success) {
        if (error) {
            console.error('❌ Email configuration error:', error.message || error);
            console.error('Email service may not work. Check your .env file.');
            console.error('Tip: Set EMAIL_TEST_MODE=true in .env to test form without sending emails');
        } else {
            console.log('✅ Email service is ready to send messages');
        }
    });
} else {
    console.log('📧 Email service in TEST MODE - form submissions will be logged only');
}

// Auth rate limiting (login, forgot-password)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts. Try again later.' }
});

// Auth routes (login, register, logout, me, forgot-password, reset-password)
app.post('/api/auth/login', authLimiter, (req, res) => authHandler.login(req, res));
app.post('/api/auth/register', authLimiter, (req, res) => authHandler.register(req, res, transporter));
app.post('/api/auth/logout', (req, res) => authHandler.logout(req, res));
app.get('/api/auth/me', requireAuth, (req, res) => authHandler.me(req, res));
app.post('/api/auth/forgot-password', authLimiter, (req, res) => authHandler.forgotPassword(req, res, transporter));
app.post('/api/auth/reset-password', authLimiter, (req, res) => authHandler.resetPassword(req, res));

// Myriota webhook endpoint - receives satellite packets and stores locations
app.post('/api/myriota/webhook', myriotaWebhook);

// Contact form endpoint
app.post('/api/contact', contactLimiter, async (req, res) => {
    console.log('\n=== Contact Form Submission ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
        const { firstName, lastName, email, phone, message, timestamp } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            console.log('❌ Validation failed: Missing required fields');
            console.log('Received fields:', { firstName: !!firstName, lastName: !!lastName, email: !!email, phone: !!phone });
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('❌ Validation failed: Invalid email format');
            console.log('Email received:', email);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }
        
        console.log('✅ Form validation passed');
        console.log('Sending email to:', process.env.EMAIL_USER);

        // Prepare email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `New Contact Form Submission from ${firstName} ${lastName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a365d;">New Contact Form Submission</h2>
                    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2d3748; margin-top: 0;">Contact Information</h3>
                        <p><strong>Name:</strong> ${escapeHtml(firstName)} ${escapeHtml(lastName)}</p>
                        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
                        <p><strong>Phone:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>
                        <p><strong>Submitted:</strong> ${escapeHtml(new Date(timestamp).toLocaleString())}</p>
                    </div>
                    ${message ? `
                    <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2d3748; margin-top: 0;">Message</h3>
                        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
                    </div>
                    ` : ''}
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <p style="color: #718096; font-size: 14px;">
                            This message was sent from the Custodia website contact form.
                        </p>
                    </div>
                </div>
            `,
            text: `
                New Contact Form Submission
                
                Name: ${firstName} ${lastName}
                Email: ${email}
                Phone: ${phone}
                Submitted: ${new Date(timestamp).toLocaleString()}
                
                ${message ? `Message:\n${message}` : ''}
                
                This message was sent from the Custodia website contact form.
            `
        };

        // Send email with timeout (or test mode)
        if (process.env.EMAIL_TEST_MODE === 'true') {
            // Test mode: log instead of sending email
            console.log('📧 [TEST MODE] Form submission logged (email sending disabled)');
            console.log('Email would be sent to:', process.env.EMAIL_USER);
            console.log('Subject:', mailOptions.subject);
            console.log('Form data:', { firstName, lastName, email, phone, message });
        } else {
            console.log('📧 Attempting to send email...');
            console.log('Email config:', {
                user: process.env.EMAIL_USER,
                passSet: !!process.env.EMAIL_PASS
            });
            
            // Add timeout to email sending
            const emailPromise = transporter.sendMail(mailOptions);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Email sending timeout after 15 seconds')), 15000)
            );
            
            await Promise.race([emailPromise, timeoutPromise]);
            console.log('✅ Email sent successfully!');
        }

        // Log the submission
        console.log(`Contact form submission from ${firstName} ${lastName} (${email})`);
        console.log('=== End Contact Form Submission ===\n');

        res.json({
            success: true,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error('❌ Error sending email:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response,
            responseCode: error.responseCode,
            command: error.command
        });
        console.log('=== End Contact Form Submission (ERROR) ===\n');
        res.status(500).json({
            error: 'Failed to send message. Please try again later.'
        });
    }
});

// Quote submission endpoint
const quoteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.post('/api/quote/submit', quoteLimiter, async (req, res) => {
    try {
        const { contact, devices, specs } = req.body;

        if (!contact || !contact.email || !contact.first || !contact.last || !contact.org) {
            return res.status(400).json({ success: false, error: 'Missing required contact fields' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.email)) {
            return res.status(400).json({ success: false, error: 'Invalid email address' });
        }

        const DEVICE_LABELS = {
            lora:      'LoRa tracking collar',
            satellite: 'Hybrid satellite collar',
            repeater:  'LoRa repeater',
            camera:    'AI camera trap',
        };

        function row(k, v) {
            return `<tr><td style="padding:4px 10px 4px 0;color:#666;width:160px">${escapeHtml(k)}</td><td style="padding:4px 0;font-weight:600;color:#1F1F1F">${escapeHtml(String(v))}</td></tr>`;
        }

        function deviceBlock(device) {
            const s = specs[device];
            if (!s) return '';
            let rows = '';
            let qty = '';

            if (device === 'lora' || device === 'satellite') {
                qty = `×${s.qty}`;
                rows = [
                    row('Battery', `${s.battery} mAh`),
                    row('GPS fixes/day', s.gps),
                    row('TX/day', s.tx),
                    row('Material', s.material === 'nylon' ? 'Nylon + neoprene' : 'Biothane'),
                    row('Neck circ.', `${s.neck} cm`),
                    row('Drop-off', s.dropoff ? 'Yes' : 'No'),
                    device === 'satellite' && s.country ? row('Country', s.country) : '',
                    s.species ? row('Species', s.species) : '',
                ].join('');
            } else if (device === 'repeater') {
                qty = `×${s.count}`;
                rows = [
                    row('Count', s.count),
                    row('Mounting', s.mounting),
                    s.species ? row('Use case', s.species) : '',
                ].join('');
            } else if (device === 'camera') {
                qty = `×${s.count}`;
                const aiList = [
                    s.ai_species  ? 'Species counting' : '',
                    s.ai_human    ? 'Intrusion alerts' : '',
                    s.ai_tamper   ? 'Tamper detection' : '',
                    s.ai_gunshot  ? 'Gunshot detection' : '',
                ].filter(Boolean).join(', ') || 'None';
                rows = [
                    row('Count', s.count),
                    row('Battery target', `${s.battery_target} months`),
                    row('Night vision', s.night_vision === 'ir' ? 'IR only' : 'Colour night'),
                    row('Trigger', s.trigger),
                    row('Storage', s.storage === 'cloud' ? 'SD + cloud sync' : 'SD card only'),
                    row('Image TX', s.transmission ? 'Yes' : 'No'),
                    row('AI features', aiList),
                    s.species ? row('Species', s.species) : '',
                ].join('');
            }

            return `
            <div style="background:#fdf8f4;border:1px solid #e8ddd4;border-radius:6px;padding:16px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <strong style="font-size:15px;color:#1F1F1F">${escapeHtml(DEVICE_LABELS[device] || device)}</strong>
                    <span style="background:rgba(138,106,79,0.15);color:#8A6A4F;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px">${qty}</span>
                </div>
                <table style="border-collapse:collapse;width:100%">${rows}</table>
            </div>`;
        }

        const deviceBlocks = (devices || []).map(deviceBlock).join('');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            replyTo: contact.email,
            subject: `New quote request — ${escapeHtml(contact.first)} ${escapeHtml(contact.last)} (${escapeHtml(contact.org)})`,
            html: `
            <div style="font-family:'Open Sans',Arial,sans-serif;max-width:640px;margin:0 auto;background:#F4F4F2">
                <div style="background:#1F1F1F;padding:20px 28px">
                    <h2 style="color:#F4F4F2;margin:0;font-size:18px">New quote request</h2>
                    <p style="color:rgba(244,244,242,0.6);margin:4px 0 0;font-size:13px">Custodia · ${new Date().toUTCString()}</p>
                </div>
                <div style="padding:24px 28px">
                    <h3 style="font-size:13px;font-weight:700;letter-spacing:0.06em;color:#8C8C8C;text-transform:uppercase;margin:0 0 10px">Contact</h3>
                    <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
                        ${row('Name', `${contact.first} ${contact.last}`)}
                        ${row('Organisation', contact.org)}
                        ${row('Email', contact.email)}
                        ${contact.country ? row('Country', contact.country) : ''}
                        ${contact.timeline ? row('Timeline', contact.timeline) : ''}
                    </table>
                    <h3 style="font-size:13px;font-weight:700;letter-spacing:0.06em;color:#8C8C8C;text-transform:uppercase;margin:0 0 10px">Devices &amp; Specifications</h3>
                    ${deviceBlocks}
                    ${contact.notes ? `
                    <h3 style="font-size:13px;font-weight:700;letter-spacing:0.06em;color:#8C8C8C;text-transform:uppercase;margin:16px 0 10px">Notes</h3>
                    <div style="background:#fff;border:1px solid #D6D6D4;border-radius:6px;padding:14px;color:#1F1F1F;white-space:pre-wrap;font-size:14px">${escapeHtml(contact.notes)}</div>
                    ` : ''}
                </div>
                <div style="border-top:1px solid #D6D6D4;padding:16px 28px">
                    <p style="color:#8C8C8C;font-size:12px;margin:0">Sent from the Custodia quote form · <a href="https://custodia.world/pages/quote" style="color:#8A6A4F">custodia.world/pages/quote</a></p>
                </div>
            </div>`,
        };

        if (process.env.EMAIL_TEST_MODE === 'true') {
            console.log('📧 [TEST MODE] Quote request logged:', JSON.stringify({ contact, devices }, null, 2));
        } else {
            const emailPromise = transporter.sendMail(mailOptions);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Email timeout')), 15000)
            );
            await Promise.race([emailPromise, timeoutPromise]);
        }

        console.log(`✅ [QUOTE] Request from ${contact.first} ${contact.last} <${contact.email}> — devices: ${(devices || []).join(', ')}`);
        res.json({ success: true });

    } catch (err) {
        console.error('❌ [QUOTE] Submit error:', err);
        res.status(500).json({ success: false, error: 'Failed to send quote request. Please try again.' });
    }
});

// Database connection
const db = require('./backend/app/db.js');

// API endpoints (before catch-all routes)
// IMPORTANT: More specific routes must come BEFORE less specific ones

// Debug middleware to see which route is hit
app.use('/api/admin/news', (req, res, next) => {
    console.log('📍 [ROUTE] Request to /api/admin/news - using news router');
    next();
});
app.use('/api/admin/news', newsRouter.admin);      // Must come before /api/admin
app.use('/api/admin/expenses', expensesRouter);    // Must come before /api/admin

app.use('/api/admin', (req, res, next) => {
    const cookieKeys = Object.keys(req.cookies || {}).join(',') || '(none)';
    console.log(`📍 [ROUTE] /api/admin${req.path} | cookies: ${cookieKeys} | rawCookie: ${req.headers.cookie || '(none)'}`);
    next();
});
app.use('/api/admin', adminRouter);

app.use('/api/news', newsRouter);
app.post('/api/locations', ingestLocations);

// Tracker management (requires auth; scoped to user's client)
app.get('/api/trackers/:slug', requireAuth, async (req, res) => {
    try {
        const clientSlug = req.user.clientSlug;
        if (!clientSlug) return res.status(403).json({ success: false, error: 'Forbidden' });
        const { slug } = req.params;
        const result = await db.query(
            `SELECT id, slug, animal_type, animal_name, family FROM trackers
             WHERE slug = $1 AND client_id = (SELECT id FROM clients WHERE slug = $2)`,
            [slug, clientSlug]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tracker not found' });
        }
        res.json({ success: true, tracker: result.rows[0] });
    } catch (error) {
        console.error('❌ [TRACKER API] Error fetching tracker:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tracker', message: error.message });
    }
});

app.put('/api/trackers/:slug', requireAuth, async (req, res) => {
    try {
        const clientSlug = req.user.clientSlug;
        if (!clientSlug) return res.status(403).json({ success: false, error: 'Forbidden' });
        const { slug } = req.params;
        const { animal_type, animal_name, family } = req.body;
        if (!animal_type || !animal_name) {
            return res.status(400).json({ success: false, error: 'Missing required fields: animal_type and animal_name are required' });
        }
        const result = await db.query(
            `UPDATE trackers SET animal_type = $1, animal_name = $2, family = $3
             WHERE slug = $4 AND client_id = (SELECT id FROM clients WHERE slug = $5)
             RETURNING id, slug, animal_type, animal_name, family`,
            [animal_type, animal_name, family || null, slug, clientSlug]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tracker not found' });
        }
        res.json({ success: true, tracker: result.rows[0] });
    } catch (error) {
        console.error('❌ [TRACKER API] Error updating tracker:', error);
        res.status(500).json({ success: false, error: 'Failed to update tracker', message: error.message });
    }
});

// Database endpoint - fetches locations from PostgreSQL (requires auth; scoped to user's client)
app.get('/api/locations', requireAuth, async (req, res) => {
    try {
        const clientSlug = req.user.clientSlug;
        if (!clientSlug) {
            return res.status(403).json({ error: 'Forbidden', message: 'No client associated with your account' });
        }
        console.log('📊 [DATABASE] Fetching locations for client:', clientSlug);
        
        const connectionTest = await db.testConnection();
        if (!connectionTest) {
            console.error('❌ [DATABASE] Connection test failed');
            throw new Error('Database connection failed. Please check DATABASE_URL and ensure database is accessible.');
        }
        
        const isAdmin = req.user.role === 'admin';
        let query, queryParams;
        if (isAdmin) {
            query = `
                SELECT
                    l.id as location_id,
                    t.slug as tracker_id,
                    c.slug as client_slug,
                    t.animal_type,
                    t.animal_name,
                    t.family,
                    t.initial_battery_voltage,
                    l.latitude,
                    l.longitude,
                    l.timestamp,
                    l.battery_voltage,
                    l.fix_number
                FROM locations l
                JOIN trackers t ON l.tracker_id = t.id
                LEFT JOIN clients c ON t.client_id = c.id
                ORDER BY l.timestamp ASC
            `;
            queryParams = [];
        } else {
            query = `
                SELECT
                    l.id as location_id,
                    t.slug as tracker_id,
                    c.slug as client_slug,
                    t.animal_type,
                    t.animal_name,
                    t.family,
                    t.initial_battery_voltage,
                    l.latitude,
                    l.longitude,
                    l.timestamp,
                    l.battery_voltage,
                    l.fix_number
                FROM locations l
                JOIN trackers t ON l.tracker_id = t.id
                LEFT JOIN clients c ON t.client_id = c.id
                WHERE c.slug = $1
                ORDER BY l.timestamp ASC
            `;
            queryParams = [clientSlug];
        }
        const result = await db.query(query, queryParams);
        console.log(`✅ [DATABASE] Fetched ${result.rows.length} locations${isAdmin ? ' (admin: all clients)' : ` for client: ${clientSlug}`}`);

        // If no data, return empty CSV with header
        if (result.rows.length === 0) {
            console.warn('⚠️  [DATABASE] No locations found in database. Database may need to be seeded.');
            const csvHeader = 'location_id,tracker_id,client_slug,animal_type,animal_name,family,initial_battery_voltage,latitude,longitude,timestamp,battery_voltage,fix_number\n';
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('X-Data-Source', 'database');
            res.setHeader('X-Location-Count', '0');
            res.setHeader('X-Warning', 'Database is empty. Please seed the database.');
            return res.send(csvHeader);
        }

        // Convert to CSV format
        const csvHeader = 'location_id,tracker_id,client_slug,animal_type,animal_name,family,initial_battery_voltage,latitude,longitude,timestamp,battery_voltage,fix_number\n';
        const csvRows = result.rows.map(row => {
            const timestamp = new Date(row.timestamp).toISOString();
            const rowClientSlug = row.client_slug || 'unknown';
            const animalType = row.animal_type || '';
            const animalName = row.animal_name || '';
            const family = row.family || '';
            const initialBatteryVoltage = row.initial_battery_voltage || '';
            return `${row.location_id},${row.tracker_id},${rowClientSlug},${animalType},${animalName},${family},${initialBatteryVoltage},${row.latitude},${row.longitude},${timestamp},${row.battery_voltage || ''},${row.fix_number || ''}`;
        }).join('\n');

        // Add header to response to identify data source
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('X-Data-Source', 'database');
        res.setHeader('X-Location-Count', result.rows.length);
        res.send(csvHeader + csvRows);
    } catch (error) {
        console.error('❌ [DATABASE] Error fetching locations from database:', error);
        console.error('❌ [DATABASE] Error stack:', error.stack);
        
        // Return a more helpful error response
        const errorMessage = error.message || 'Unknown database error';
        const isConnectionError = errorMessage.includes('connection') || 
                                  errorMessage.includes('ECONNREFUSED') ||
                                  errorMessage.includes('timeout') ||
                                  errorMessage.includes('ENOTFOUND');
        
        if (isConnectionError) {
            console.error('❌ [DATABASE] Connection error - DATABASE_URL may be incorrect or database is not accessible');
            res.status(503).json({ 
                error: 'Database connection failed', 
                details: errorMessage,
                hint: 'Please check DATABASE_URL environment variable and ensure database is running and accessible.'
            });
        } else if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
            console.error('❌ [DATABASE] Table does not exist - database schema may not be initialized');
            res.status(503).json({ 
                error: 'Database tables not found', 
                details: errorMessage,
                hint: 'Please run schema.sql to create the database tables.'
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to fetch locations from database', 
                details: errorMessage 
            });
        }
    }
});

// Delete a single location (admin only)
app.delete('/api/locations/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden: admin only' });
    }
    const locId = parseInt(req.params.id, 10);
    if (!locId || isNaN(locId)) {
        return res.status(400).json({ success: false, error: 'Invalid location id' });
    }
    try {
        // Verify the location exists before deleting
        const check = await db.query('SELECT id FROM locations WHERE id = $1', [locId]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }
        await db.query('DELETE FROM locations WHERE id = $1', [locId]);
        console.log(`🗑️  [ADMIN] Location ${locId} deleted by user ${req.user.userId} (${req.user.email})`);
        return res.json({ success: true });
    } catch (err) {
        console.error('❌ [ADMIN] Error deleting location:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete location' });
    }
});

// Repeaters with coordinates (requires auth; scoped to user's client)
app.get('/api/repeaters', requireAuth, async (req, res) => {
    try {
        const clientSlug = req.user.clientSlug;
        if (!clientSlug) {
            return res.status(403).json({ success: false, error: 'No client associated with your account' });
        }
        const query = `
            SELECT id, repeater_id, latitude, longitude, height, total_locations_collected, last_seen
            FROM repeaters
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            AND client_id = (SELECT id FROM clients WHERE slug = $1)
            ORDER BY repeater_id
        `;
        const result = await db.query(query, [clientSlug]);
        res.json({
            success: true,
            repeaters: result.rows.map(r => ({
                id: r.id,
                repeater_id: r.repeater_id,
                latitude: parseFloat(r.latitude),
                longitude: parseFloat(r.longitude),
                height: r.height != null ? parseFloat(r.height) : null,
                total_locations_collected: r.total_locations_collected,
                last_seen: r.last_seen
            }))
        });
    } catch (error) {
        console.error('❌ [API] Error fetching repeaters:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fallback CSV endpoint (for when database is not available)
app.get('/api/mock-locations', (req, res) => {
    console.log('📄 [CSV] Serving mock CSV file (fallback)');
    const csvPath = path.join(__dirname, 'frontend', 'pages', 'dashboard', 'assets', 'mock_locations.csv');
    const fs = require('fs');
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
        console.warn('⚠️  [CSV] Mock CSV file not found:', csvPath);
        // Return empty CSV with header instead of 404
        const csvHeader = 'tracker_id,client_slug,animal_type,animal_name,family,initial_battery_voltage,latitude,longitude,timestamp,battery_voltage,fix_number\n';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('X-Data-Source', 'csv-file');
        res.setHeader('X-Location-Count', '0');
        res.setHeader('X-Warning', 'CSV file not found. Please use database endpoint /api/locations or seed the database.');
        return res.send(csvHeader);
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('X-Data-Source', 'csv-file');
    res.sendFile(csvPath);
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        const dbConnected = await db.testConnection();
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbConnected ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'error',
            error: error.message
        });
    }
});


// Serve the dashboard page (requires auth; redirects to login if not authenticated)
app.get('/pages/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'dashboard', 'index.html'));
});

// Catch-all handler for other frontend routes (keep at end before 404)
app.get('/pages/*', (req, res, next) => {
    // Only handle routes without file extensions, let static files pass through
    if (!req.path.includes('.')) {
        const routePath = req.path.replace('/pages/', '');
        const filePath = path.join(__dirname, 'frontend', 'pages', routePath, 'index.html');
        res.sendFile(filePath, (err) => {
            if (err) {
                next(); // Pass to 404 handler if file not found
            }
        });
    } else {
        next();
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Start server
require('./backend/app/handlers/skyloTCP');
app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on port ${PORT}`);
    console.log(`📄 Landing Page: http://localhost:${PORT}/`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/pages/dashboard`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📦 Mock CSV: http://localhost:${PORT}/api/mock-locations`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
