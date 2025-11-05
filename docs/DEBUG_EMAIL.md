# Email Configuration Debugging Guide

## Current Issue
The server is getting a **Connection Timeout (ETIMEDOUT)** when trying to connect to Gmail's SMTP server.

## Diagnosis
The server resolves Gmail's IP address correctly but cannot establish a connection. This is likely a network/firewall issue.

## Solutions to Try

### 1. Check Network Connection
```bash
# Test if you can reach Gmail's SMTP server
telnet smtp.gmail.com 465
# or
telnet smtp.gmail.com 587
```

If this times out, your network/firewall is blocking SMTP connections.

### 2. Check macOS Firewall
- System Settings → Network → Firewall
- Make sure Node.js is allowed to accept incoming connections

### 3. Check VPN/Network Restrictions
- If you're on a corporate network or VPN, SMTP ports might be blocked
- Try from a different network (home network, mobile hotspot)

### 4. Alternative: Use Test Mode (Skip Email)
For development/testing, you can modify the server to log form submissions instead of sending emails:

In `server.js`, temporarily replace the email sending with:
```javascript
// For testing: Log instead of sending email
console.log('📧 Form submission received (email sending disabled for testing)');
console.log('Would send email to:', process.env.EMAIL_USER);
console.log('Data:', mailOptions);

// Uncomment this when email works:
// await transporter.sendMail(mailOptions);
```

### 5. Alternative Email Services
Consider using email services with better reliability:
- **SendGrid** (free tier: 100 emails/day)
- **Mailgun** (free tier: 100 emails/month)
- **AWS SES** (very cheap, $0.10 per 1000 emails)
- **Resend** (modern, developer-friendly)

### 6. Test Email Script
Run the test script to verify email configuration:
```bash
node test-email.js
```

## Current Configuration
- **Service**: Gmail
- **Port**: 465 (SSL)
- **Email**: julser2001@gmail.com
- **Auth**: App Password configured

## Next Steps
1. Try from a different network (mobile hotspot, home network)
2. Check if your ISP blocks SMTP ports
3. Consider using an alternative email service
4. For development, use test mode to log submissions instead of sending emails
