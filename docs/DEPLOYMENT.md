# Deployment Guide for Render.com

This guide explains how to deploy the Custodia application to Render.com using Node.js/Express.

## Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be pushed to a GitHub repository
3. **Environment Variables**: Prepare your email credentials for the contact form

## Deployment Steps

### 1. Push Code to GitHub

Make sure all your code is committed and pushed to GitHub:

```bash
git add .
git commit -m "Ready for deployment"
git push origin dev  # or main
```

### 2. Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (if not already connected)
4. Select your repository

### 3. Configure the Service

**Using `render.yaml` (recommended):**
- If you have `render.yaml` in your repo root, Render will automatically detect and use it
- The file is already configured for Node.js deployment

**Manual Configuration:**
- **Name**: `custodia-web` (or any name you prefer)
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `dev` or `main` (your default branch)
- **Root Directory**: Leave empty (root of repo)
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Plan**: Free (or paid if you need more resources)

### 4. Set Environment Variables

In the Render dashboard, go to **"Environment"** section and add:

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_TEST_MODE=false
NODE_ENV=production
PORT=10000  # This is auto-set by Render
```

**Note**: 
- `EMAIL_USER` and `EMAIL_PASS` are required for the contact form to work
- `PORT` is automatically set by Render, but the app uses `$PORT` environment variable
- For Gmail, you'll need to create an [App Password](https://support.google.com/accounts/answer/185833)

### 5. Deploy

Click **"Create Web Service"** and Render will:
1. Clone your repository
2. Run `npm install`
3. Start the server with `node server.js`
4. Make it available at a URL like `https://custodia-web.onrender.com`

### 6. Verify Deployment

Once deployed, test these URLs:

- **Landing Page**: `https://your-app.onrender.com/`
- **Dashboard**: `https://your-app.onrender.com/pages/dashboard`
- **Health Check**: `https://your-app.onrender.com/api/health`
- **API Endpoint**: `https://your-app.onrender.com/api/mock-locations`

## What's Included

### ✅ Landing Page (`/`)
- Fully functional contact form
- All static assets (images, styles)
- Responsive design

### ✅ Dashboard (`/pages/dashboard`)
- Interactive map with Leaflet
- Mock data from CSV file
- All filters and visualization modes
- Animal cards with status indicators
- All assets served from `/static/` paths

### ✅ API Endpoints
- `GET /api/health` - Health check
- `GET /api/mock-locations` - Mock location data (CSV)
- `POST /api/contact` - Contact form submission

## Troubleshooting

### Static Files Not Loading

If CSS/images aren't loading:
- Check that paths in HTML use `/static/` prefix
- Verify static file mounts in `server.js`
- Check browser console for 404 errors
- Ensure files exist in the correct directories

### Dashboard Not Loading Data

If dashboard shows no data:
1. Check browser console for errors
2. Verify `/api/mock-locations` endpoint returns data
3. Check that CSV file path is correct (`frontend/pages/dashboard/assets/mock_locations.csv`)
4. Check Render logs for any errors

### Contact Form Not Working

If contact form doesn't send emails:
1. Verify `EMAIL_USER` and `EMAIL_PASS` are set correctly in Render dashboard
2. Check that you're using an App Password (not your regular Gmail password)
3. Set `EMAIL_TEST_MODE=true` to test without sending emails
4. Check Render logs for email errors

### Port Issues

Render automatically sets the `PORT` environment variable. The server uses `process.env.PORT || 3000`, which should work automatically.

## Custom Domain (Optional)

1. Go to your service settings
2. Click **"Custom Domains"**
3. Add your domain and follow DNS instructions

## Automatic Deployments

Render automatically deploys when you push to your configured branch. You can:
- View deployment logs in the Render dashboard
- Roll back to previous deployments
- Set up preview deployments for pull requests

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EMAIL_USER` | Yes | Gmail address for contact form | `your-email@gmail.com` |
| `EMAIL_PASS` | Yes | Gmail App Password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_TEST_MODE` | No | Test mode (logs instead of sending) | `false` |
| `PORT` | No | Server port (auto-set by Render) | `10000` |
| `NODE_ENV` | No | Environment mode | `production` |

## Local Testing

Before deploying, test locally:

```bash
# Install dependencies
npm install

# Start server
npm start
# or
PORT=3000 node server.js
```

Then visit:
- Landing Page: `http://localhost:3000/`
- Dashboard: `http://localhost:3000/pages/dashboard`

## Notes

- **Free Tier**: Render's free tier spins down after 15 minutes of inactivity. First request after spin-down may take 30-60 seconds.
- **Email Service**: Uses Gmail SMTP. Make sure to create an App Password in your Google Account settings.
- **Static Assets**: All dashboard assets are served from `/static/` paths for consistent loading.
