/**
 * Migration script: Move news posts from JSON file to PostgreSQL database
 * Run this once to migrate existing data
 */

const db = require('../db');
const fs = require('fs').promises;
const path = require('path');

async function migrateNewsFromJSON() {
    const jsonPath = path.join(__dirname, '../../../frontend/data/news.json');
    
    try {
        // Read existing JSON file
        console.log('📖 Reading news.json...');
        const jsonData = await fs.readFile(jsonPath, 'utf8');
        const posts = JSON.parse(jsonData);
        
        if (!Array.isArray(posts) || posts.length === 0) {
            console.log('ℹ️  No posts found in news.json');
            return;
        }
        
        console.log(`📝 Found ${posts.length} posts to migrate`);
        
        // Check if database tables exist
        try {
            await db.query('SELECT 1 FROM news_posts LIMIT 1');
        } catch (error) {
            console.error('❌ Database tables not found. Please run the migration SQL first:');
            console.error('   psql $DATABASE_URL < backend/app/database/migrations/20250101_add_news_tables.sql');
            process.exit(1);
        }
        
        // Migrate each post
        let migrated = 0;
        let skipped = 0;
        
        for (const post of posts) {
            try {
                // Check if post already exists
                const existing = await db.query('SELECT id FROM news_posts WHERE id = $1', [post.id]);
                
                if (existing.rows.length > 0) {
                    console.log(`⏭️  Skipping post ${post.id} (already exists)`);
                    skipped++;
                    continue;
                }
                
                // Insert post
                await db.query(
                    'INSERT INTO news_posts (id, title, date, excerpt, content) VALUES ($1, $2, $3, $4, $5)',
                    [post.id, post.title, post.date || new Date().toISOString(), post.excerpt || null, post.content]
                );
                
                // Insert media
                if (post.media && Array.isArray(post.media) && post.media.length > 0) {
                    for (let i = 0; i < post.media.length; i++) {
                        const media = post.media[i];
                        await db.query(
                            'INSERT INTO news_media (post_id, type, src, display_order) VALUES ($1, $2, $3, $4)',
                            [post.id, media.type, media.src, i]
                        );
                    }
                }
                
                console.log(`✅ Migrated: ${post.title}`);
                migrated++;
            } catch (error) {
                console.error(`❌ Error migrating post ${post.id}:`, error.message);
            }
        }
        
        console.log(`\n✨ Migration complete!`);
        console.log(`   Migrated: ${migrated} posts`);
        console.log(`   Skipped: ${skipped} posts`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  news.json file not found. Nothing to migrate.');
        } else {
            console.error('❌ Migration error:', error);
            process.exit(1);
        }
    }
}

// Run migration
migrateNewsFromJSON()
    .then(() => {
        console.log('✅ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
