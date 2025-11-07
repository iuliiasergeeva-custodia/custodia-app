/**
 * PostgreSQL Database Connection Module
 * Uses pg (node-postgres) for database connectivity
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
// Render provides DATABASE_URL, or use individual connection parameters for local development
let poolConfig;

if (process.env.DATABASE_URL) {
    // Use DATABASE_URL (for Render or other cloud providers)
    // Format: postgresql://user:password@host:port/database
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        // Connection pool settings
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
    console.log('📊 Using DATABASE_URL for database connection');
} else {
    // Use individual connection parameters (for local development)
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'custodia_local',
        user: process.env.DB_USER || process.env.USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        // Connection pool settings
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
    console.log('📊 Using individual connection parameters for database connection');
}

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Execute a query and return results
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters (optional)
 * @returns {Promise} Query result
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Query error', { text, error: error.message });
        throw error;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<PoolClient>} Pool client
 */
async function getClient() {
    return await pool.connect();
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
    try {
        const result = await query('SELECT NOW() as current_time');
        console.log('✅ Database connection test successful:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        return false;
    }
}

/**
 * Close all database connections
 */
async function close() {
    await pool.end();
    console.log('Database pool closed');
}

// Export functions
module.exports = {
    query,
    getClient,
    testConnection,
    close,
    pool, // Export pool for advanced usage
};

