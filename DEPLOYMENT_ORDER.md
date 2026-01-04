# Deployment Order - News Feature Migration

## ⚠️ IMPORTANT: Do these steps in order!

### Step 1: Run Database Migration FIRST ⏱️

**BEFORE deploying**, you need to create the database tables on Render.

**Option A: Using the Node.js script (Easiest)**
```bash
# Set your Render DATABASE_URL (get it from Render Dashboard → Database)
export DATABASE_URL="postgresql://user:password@hostname:port/database"

# Run the migration
node run-migration.js
```

**Option B: Via Render Dashboard**
1. Go to Render Dashboard → Your PostgreSQL Database
2. Click "Connect" or "Query" tab
3. Copy/paste the SQL from `backend/app/database/migrations/20250101_add_news_tables.sql`
4. Run it

### Step 2: Verify Migration Worked ✅

After running the migration, you should see:
- ✅ Migration successful!
- Tables created: news_posts, news_media

### Step 3: Then Deploy the Code 🚀

Once the database tables exist, deploy:

```bash
git add .
git commit -m "Migrate news feature to PostgreSQL database"
git push origin dev  # or main, depending on your branch
```

### Step 4: Test After Deployment ✅

After Render finishes deploying:
1. Go to your admin page: `https://your-app.onrender.com/pages/admin/news`
2. Try creating a test post
3. It should work now! 🎉

## Why This Order?

- **Current code** expects database tables to exist
- If you deploy first, creating posts will fail with "Failed to save news post"
- If you run migration first, everything will work immediately after deployment

## Quick Checklist

- [ ] Run database migration (Step 1)
- [ ] Verify migration success (Step 2)  
- [ ] Commit and push code (Step 3)
- [ ] Test on Render (Step 4)
