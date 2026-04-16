/**
 * Runs the expenses table migration.
 * Usage: node run-expenses-migration.js
 *
 * Make sure your .env file has DATABASE_URL set.
 */

require('dotenv').config();
const db = require('./backend/app/db.js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const migrationPath = path.join(
        __dirname,
        'backend/app/database/migrations/20260416_add_expenses_table.sql'
    );

    console.log('📖 Reading migration file...');
    let sql = fs.readFileSync(migrationPath, 'utf8');

    // Strip comment lines
    sql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .replace(/\n\s*\n/g, '\n');

    console.log('📊 Connecting to database...');
    await db.testConnection();

    console.log('🚀 Running migration...');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

    for (let i = 0; i < statements.length; i++) {
        console.log(`   Statement ${i + 1}/${statements.length}…`);
        await db.query(statements[i]);
    }

    console.log('✅ Migration complete!');
    console.log('   Table created: expenses');
    console.log('   Indexes created: idx_expenses_date, idx_expenses_fund, idx_expenses_paid_by, idx_expenses_category');

    await db.close();
    process.exit(0);
}

runMigration().catch(err => {
    if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
        console.log('ℹ️  Table already exists — migration already applied.');
        process.exit(0);
    }
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
