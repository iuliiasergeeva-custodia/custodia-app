# Deployment Guide - News Feature

## Current Setup

**Important Note:** The News feature currently stores data in JSON files (`/frontend/data/news.json`), not in the Render database. This is fine for MVP, but if you want to migrate to database storage later, we can do that.

## Step 1: Commit and Push to GitHub

### 1. Stage all changes:
```bash
git add .
```

### 2. Commit with a descriptive message:
```bash
git commit -m "Add News/Updates feature: landing page preview, public news page, and admin editor"
```

### 3. Push to GitHub:
```bash
git push origin dev
```

Or if you want to push to main:
```bash
git checkout main
git merge dev
git push origin main
```

## Step 2: Deploy to Render

### 1. Environment Variables in Render Dashboard

Go to your Render dashboard → Your Web Service → Environment

**Add/Update these variables:**
- `ADMIN_KEY` = Your secure admin password (e.g., `Memory_1111` or whatever you set)
- `ADMIN_API_KEY` = Already set in render.yaml
- All other existing variables should remain

### 2. Auto-Deploy

Render will automatically:
- Detect the new `render.yaml` configuration
- Install new dependencies (multer)
- Deploy the updated code

### 3. Verify Deployment

After deployment, test:
- Landing page: `https://your-app.onrender.com/` (check News section)
- Public news: `https://your-app.onrender.com/pages/news`
- Admin editor: `https://your-app.onrender.com/pages/admin/news`

## Step 3: Data Persistence

### Current Setup (JSON Files)
- News posts are stored in `/frontend/data/news.json`
- Media files are stored in `/frontend/assets/news/`
- These files persist on Render's filesystem

### Future: Database Migration (Optional)

If you want to move news to the database later:
1. Create a `news_posts` table in PostgreSQL
2. Create a `news_media` table for media references
3. Update the news handler to use database instead of JSON
4. Migrate existing data from JSON to database

For now, the JSON file approach works fine for MVP!

## Important Notes

1. **Admin Password**: Make sure `ADMIN_KEY` is set in Render dashboard (not just in render.yaml)
2. **Media Files**: Uploaded images/videos are stored in `/frontend/assets/news/` on Render's filesystem
3. **Data Backup**: Consider backing up `news.json` periodically if you have important posts
4. **Git Ignore**: The `news.json` file IS tracked in git (so it deploys), but you might want to add it to `.gitignore` if you prefer to manage it separately

## Troubleshooting

If deployment fails:
1. Check Render logs for errors
2. Verify `multer` is in `package.json` dependencies
3. Ensure `ADMIN_KEY` is set in Render dashboard
4. Check that all file paths are correct (Render uses different paths than local)
