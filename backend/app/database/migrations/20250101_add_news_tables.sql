-- Migration: Add news posts and media tables
-- Created: 2025-01-01
-- Description: Migrate news feature from JSON files to PostgreSQL database

-- News Posts Table
CREATE TABLE IF NOT EXISTS news_posts (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    excerpt TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- News Media Table (for images/videos associated with posts)
CREATE TABLE IF NOT EXISTS news_media (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(100) NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
    src VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_posts_date ON news_posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_created_at ON news_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_media_post_id ON news_media(post_id);
CREATE INDEX IF NOT EXISTS idx_news_media_display_order ON news_media(post_id, display_order);

-- Comments
COMMENT ON TABLE news_posts IS 'News posts and updates';
COMMENT ON TABLE news_media IS 'Media files (images/videos) associated with news posts';
