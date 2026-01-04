/**
 * Simple script to run the news database migration
 * Usage: node run-migration.js
 * 
 * Make sure your .env file has DATABASE_URL set (or DB_HOST, DB_USER, etc.)
 */

require('dotenv').config();
const db = require('./backend/app/db.js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const migrationPath = path.join(__dirname, 'backend/app/database/migrations/20250101_add_news_tables.sql');
    
    console.log('📖 Reading migration file...');
    let sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove comments and clean up
    sql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .replace(/\n\s*\n/g, '\n');
    
    console.log('🚀 Running migration...');
    console.log('📊 Connecting to database...');
    
    try {
        // Test connection first
        await db.testConnection();
        
        // Execute each statement separately (PostgreSQL requires this)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                console.log(`   Running statement ${i + 1}/${statements.length}...`);
                await db.query(statement);
            }
        }
        
        console.log('✅ Migration successful!');
        console.log('📝 News tables created:');
        console.log('   - news_posts');
        console.log('   - news_media');
        console.log('🔍 You can now create news posts!');
        
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('ℹ️  Tables already exist - that\'s okay! Migration is complete.');
            process.exit(0);
        } else {
            console.error('Full error:', error);
            process.exit(1);
        }
    }
}

runMigration();
