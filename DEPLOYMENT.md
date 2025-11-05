# Deployment Guide for Render.com

This guide explains how to deploy the Custodia application to Render.com using Python/FastAPI with both the Landing Page and Dashboard working.

## Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be pushed to a GitHub repository
3. **PostgreSQL Database** (optional): For database features, create a PostgreSQL database on Render
4. **Environment Variables**: Prepare your database connection string

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
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (root of repo)
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free (or paid if you need more resources)

**Or use `render.yaml`** (recommended):
- If you have `render.yaml` in your repo root, Render will automatically detect and use it
- The file is already configured for Python deployment

### 4. Set Environment Variables

In the Render dashboard, go to **"Environment"** section and add:

```
DATABASE_URL=postgresql://user:password@host:port/database
PYTHON_VERSION=3.11
PORT=10000  # This is auto-set by Render, but you can specify it
```

**Note**: 
- `DATABASE_URL` is required if you're using the database features
- `PORT` is automatically set by Render, but the app uses `$PORT` environment variable
- For PostgreSQL, create a database service on Render and use its connection string

### 5. Deploy

Click **"Create Web Service"** and Render will:
1. Clone your repository
2. Run `pip install -r backend/requirements.txt`
3. Start the server with uvicorn
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
- Check that paths in HTML match the FastAPI routes
- Verify static file mounts in `backend/app/main.py`
- Check browser console for 404 errors
- Ensure files exist in the correct directories

### Dashboard Not Loading Data

If dashboard shows no data:
1. Check browser console for errors
2. Verify `/api/mock-locations` endpoint returns data
3. Check that CSV file path is correct (`frontend/pages/dashboard/assets/mock_locations.csv`)
4. Check Render logs for any errors

### Database Connection Issues

If database features aren't working:
1. Verify `DATABASE_URL` is set correctly in Render dashboard
2. Check that PostgreSQL database is created and running
3. Ensure database tables are created (run `python -m backend.app.main` locally first)
4. Check Render logs for database connection errors

### Port Issues

Render automatically sets the `PORT` environment variable. The FastAPI app uses `$PORT` from the environment, which should work automatically.

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
| `DATABASE_URL` | Yes* | PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `PORT` | No | Server port (auto-set by Render) | `10000` |
| `PYTHON_VERSION` | No | Python version to use | `3.11` |

*Required if using database features

## Next Steps

Once deployed, you can:
1. Set up a custom domain
2. Add database (PostgreSQL) for future features
3. Set up monitoring and alerts
4. Configure CDN for static assets (if needed)

## Notes

- **Free Tier**: Render's free tier spins down after 15 minutes of inactivity. First request after spin-down may take 30-60 seconds.
- **Database**: PostgreSQL database is optional. The app works with mock CSV data without a database.
- **Python Version**: Specified in `backend/runtime.txt` (Python 3.11.0)
- **Authentication**: Not implemented yet (as requested)

## Database Setup (Optional)

If you want to use the database features:

1. **Create PostgreSQL Database on Render:**
   - Go to Render dashboard → **"New +"** → **"PostgreSQL"**
   - Create a new database
   - Copy the connection string (Internal Database URL)

2. **Set Environment Variable:**
   - Add `DATABASE_URL` to your web service environment variables
   - Use the Internal Database URL from your PostgreSQL service

3. **Initialize Database:**
   - Run `python -m backend.app.main` locally to create tables
   - Or add a build script to create tables on deployment

4. **Seed Database (Optional):**
   - Run `python -m backend.app.seed_db` to populate with test data

