#!/usr/bin/env node
/**
 * Seed the database using the same connection as the app (from .env).
 * Run from project root: node backend/scripts/seed-db.js
 * Or: npm run db:seed
 */
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const seedPath = path.join(__dirname, '../app/database/seed.sql');

try {
    let opts = { stdio: 'inherit' };
    if (process.env.DATABASE_URL) {
        console.log('📊 Seeding database from DATABASE_URL (same DB the app uses)');
        opts.env = process.env;
        execSync(`psql "${process.env.DATABASE_URL}" -f "${seedPath}"`, opts);
    } else {
        const db = process.env.DB_NAME || 'custodia_local';
        const user = process.env.DB_USER || process.env.USER || 'postgres';
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 5432;
        console.log(`📊 Seeding database: ${db} at ${host}:${port} (same DB the app uses)`);
        const env = { ...process.env };
        if (process.env.DB_PASSWORD) env.PGPASSWORD = process.env.DB_PASSWORD;
        opts.env = env;
        execSync(`psql -h ${host} -p ${port} -U ${user} -d ${db} -f "${seedPath}"`, opts);
    }
    console.log('✅ Seed completed.');
} catch (e) {
    console.error('❌ Seed failed. Check that the database exists, schema is applied, and psql can connect.');
    process.exit(1);
}
