# Quick Fix: Create News Database Tables

## The Problem
You're getting "Failed to save news post" because the database tables don't exist yet.

## Solution: Run the Migration SQL

### Step 1: Go to Render Dashboard

1. Go to https://dashboard.render.com
2. Click on your **Database** (PostgreSQL)
3. Click on **"Connect"** or **"Query"** tab

### Step 2: Run This SQL

Copy and paste this entire SQL script into the query editor:

```sql
-- Create News Posts Table
CREATE TABLE IF NOT EXISTS news_posts (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    excerpt TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create News Media Table
CREATE TABLE IF NOT EXISTS news_media (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(100) NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
    src VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_news_posts_date ON news_posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_created_at ON news_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_media_post_id ON news_media(post_id);
CREATE INDEX IF NOT EXISTS idx_news_media_display_order ON news_media(post_id, display_order);
```

### Step 3: Click "Run" or "Execute"

After running, you should see success messages.

### Step 4: Try Again

Go back to your admin page and try creating a post again. It should work now!

## Alternative: Use psql Command Line

If you have `psql` installed and your `DATABASE_URL`, you can run:

```bash
psql $DATABASE_URL < backend/app/database/migrations/20250101_add_news_tables.sql
```

## Why This Happened

The code was recently updated to use PostgreSQL instead of JSON files (to prevent data loss during deployments). But the database tables need to be created first - this is a one-time setup step.
