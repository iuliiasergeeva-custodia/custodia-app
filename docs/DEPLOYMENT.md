# Deployment Guide for Render.com

This guide explains how to deploy the Custodia application to Render.com with both the Landing Page and Dashboard working.

## Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be pushed to a GitHub repository
3. **Environment Variables**: Prepare your email credentials

## Deployment Steps

### 1. Push Code to GitHub

Make sure all your code is committed and pushed to GitHub:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (if not already connected)
4. Select your repository

### 3. Configure the Service

**Basic Settings:**
- **Name**: `custodia-web` (or any name you prefer)
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (root of repo)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (or paid if you need more resources)

### 4. Set Environment Variables

In the Render dashboard, go to **"Environment"** section and add:

```
NODE_ENV=production
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_TEST_MODE=false
```

**Note**: For Gmail, you'll need to use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### 5. Deploy

Click **"Create Web Service"** and Render will:
1. Clone your repository
2. Run `npm install`
3. Start the server with `npm start`
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

### ✅ API Endpoints
- `GET /api/health` - Health check
- `GET /api/mock-locations` - Mock location data (CSV)
- `POST /api/contact` - Contact form submission

## Troubleshooting

### Static Files Not Loading

If CSS/images aren't loading:
- Check that paths in HTML are relative (they should be)
- Verify `express.static` is configured correctly in `server.js`
- Check browser console for 404 errors

### Dashboard Not Loading Data

If dashboard shows no data:
1. Check browser console for errors
2. Verify `/api/mock-locations` endpoint returns data
3. Check that CSV file path is correct in `server.js`

### Email Not Working

If contact form doesn't send emails:
1. Verify `EMAIL_USER` and `EMAIL_PASS` are set correctly
2. Use Gmail App Password (not regular password)
3. Check Render logs for email errors
4. Set `EMAIL_TEST_MODE=true` to test without sending emails

### Port Issues

Render automatically sets the `PORT` environment variable. The server is configured to use `process.env.PORT || 3000`, which should work automatically.

## Custom Domain (Optional)

1. Go to your service settings
2. Click **"Custom Domains"**
3. Add your domain and follow DNS instructions

## Automatic Deployments

Render automatically deploys when you push to your main branch. You can:
- View deployment logs in the Render dashboard
- Roll back to previous deployments
- Set up preview deployments for pull requests

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `PORT` | No | Server port (auto-set by Render) | `3000` |
| `EMAIL_USER` | Yes | Gmail address for contact form | `your-email@gmail.com` |
| `EMAIL_PASS` | Yes | Gmail App Password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_TEST_MODE` | No | Disable email sending | `false` |

## Next Steps

Once deployed, you can:
1. Set up a custom domain
2. Add database (PostgreSQL) for future features
3. Set up monitoring and alerts
4. Configure CDN for static assets (if needed)

## Notes

- **Free Tier**: Render's free tier spins down after 15 minutes of inactivity. First request after spin-down may take 30-60 seconds.
- **Database**: Currently not needed for LP and Dashboard (using mock data)
- **Authentication**: Not implemented yet (as requested)

