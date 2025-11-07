const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware (for debugging)
app.use((req, res, next) => {
    if (req.path === '/api/contact') {
        console.log(`\n📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    }
    next();
});

// Serve static files from frontend
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// Serve static files from /static path for dashboard assets
app.use('/static', express.static(path.join(__dirname, 'frontend')));

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
                        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
                        <p><strong>Submitted:</strong> ${new Date(timestamp).toLocaleString()}</p>
                    </div>
                    ${message ? `
                    <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2d3748; margin-top: 0;">Message</h3>
                        <p style="white-space: pre-wrap;">${message}</p>
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

// Serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'landing', 'index.html'));
});

// API endpoints (before catch-all routes)
app.get('/api/mock-locations', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'pages', 'dashboard', 'assets', 'mock_locations.csv'), {
        headers: {
            'Content-Type': 'text/csv'
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve the dashboard page (specific route)
app.get('/pages/dashboard', (req, res) => {
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
app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on port ${PORT}`);
    console.log(`📄 Landing Page: http://localhost:${PORT}/`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/pages/dashboard`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📦 Mock CSV: http://localhost:${PORT}/api/mock-locations`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
