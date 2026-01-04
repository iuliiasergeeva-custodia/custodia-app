# Migrate News from JSON to Database

## Problem
News posts stored in `/frontend/data/news.json` are lost during Render deployments because the filesystem is ephemeral.

## Solution
Migrate news posts to PostgreSQL database which persists across deployments.

## Steps to Deploy

### 1. Run Database Migration

Connect to your Render database and run the migration:

```bash
# Get your DATABASE_URL from Render dashboard
# Then run:
psql $DATABASE_URL < backend/app/database/migrations/20250101_add_news_tables.sql
```

Or from Render's database dashboard, copy the connection string and run:
```sql
-- Copy and paste the contents of:
-- backend/app/database/migrations/20250101_add_news_tables.sql
```

### 2. (Optional) Migrate Existing Data

If you have existing posts in `news.json` that you want to keep, you can migrate them:

```bash
# Run this script to migrate existing JSON data to database
node backend/app/database/migrate-news-from-json.js
```

### 3. Deploy Updated Code

The updated `backend/app/handlers/news.js` now uses the database instead of JSON files.

```bash
git add .
git commit -m "Migrate news feature from JSON to PostgreSQL database"
git push origin dev  # or main
```

### 4. Verify

After deployment:
1. Check that news posts load from database
2. Create a test post
3. Restart the service - posts should persist!

## Database Schema

- **news_posts**: Stores post data (id, title, date, excerpt, content)
- **news_media**: Stores media references (post_id, type, src, display_order)

## Notes

- Media files are still stored in `/frontend/assets/news/` on filesystem
- For production, consider using cloud storage (S3, Cloudinary) for media files
- The database migration is idempotent (safe to run multiple times)
