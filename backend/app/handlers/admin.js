const express = require('express');
const db = require('../db');

const router = express.Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'abs123qwe';

const TABLE_CONFIG = {
    clients: {
        primaryKey: 'id',
        columns: ['id', 'name', 'slug', 'created_at'],
        writable: ['name', 'slug'],
    },
    users: {
        primaryKey: 'id',
        columns: ['id', 'client_id', 'name', 'email', 'role', 'created_at'],
        writable: ['client_id', 'name', 'email', 'role'],
    },
    trackers: {
        primaryKey: 'id',
        columns: [
            'id',
            'client_id',
            'slug',
            'animal_type',
            'animal_name',
            'family',
            'expected_battery_life',
            'frequency_acquisition',
            'frequency_sending',
            'last_seen',
            'last_battery_voltage',
            'initial_battery_voltage',
            'created_at',
        ],
        writable: [
            'client_id',
            'slug',
            'animal_type',
            'animal_name',
            'family',
            'expected_battery_life',
            'frequency_acquisition',
            'frequency_sending',
            'last_seen',
            'last_battery_voltage',
            'initial_battery_voltage',
        ],
    },
    repeaters: {
        primaryKey: 'id',
        columns: ['id', 'repeater_id', 'last_seen'],
        writable: ['repeater_id', 'last_seen'],
    },
    locations: {
        primaryKey: 'id',
        columns: [
            'id',
            'tracker_id',
            'repeater_id',
            'longitude',
            'latitude',
            'timestamp',
            'battery_voltage',
            'fix_number',
            'created_at',
        ],
        writable: [
            'tracker_id',
            'repeater_id',
            'longitude',
            'latitude',
            'timestamp',
            'battery_voltage',
            'fix_number',
        ],
    },
};

function extractApiKey(req) {
    const headerKey = req.header('x-api-key');
    if (headerKey && headerKey.trim() !== '') {
        return headerKey.trim();
    }

    const authHeader = req.header('authorization');
    if (!authHeader) {
        return null;
    }

    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    return authHeader.trim();
}

router.use((req, res, next) => {
    if (!ADMIN_API_KEY) {
        return res.status(500).json({
            success: false,
            error: 'Admin API key is not configured',
        });
    }

    const providedKey = extractApiKey(req);
    if (providedKey !== ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid API key',
        });
    }

    next();
});

router.get('/tables', (req, res) => {
    res.json({
        success: true,
        tables: Object.keys(TABLE_CONFIG).map((tableName) => ({
            name: tableName,
            columns: TABLE_CONFIG[tableName].columns,
            writable: TABLE_CONFIG[tableName].writable,
            primaryKey: TABLE_CONFIG[tableName].primaryKey,
        })),
    });
});

router.get('/tables/:table', async (req, res) => {
    const { table } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) {
        return res.status(404).json({
            success: false,
            error: 'Table not found',
        });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    try {
        const columns = config.columns.join(', ');
        const query = `
            SELECT ${columns}
            FROM ${table}
            ORDER BY ${config.primaryKey} DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await db.query(query, [limit, offset]);
        res.json({
            success: true,
            rows: result.rows,
            count: result.rowCount,
            limit,
            offset,
        });
    } catch (error) {
        console.error('❌ [ADMIN] Error fetching table:', table, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch table data',
            message: error.message,
        });
    }
});

router.post('/tables/:table', async (req, res) => {
    const { table } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) {
        return res.status(404).json({
            success: false,
            error: 'Table not found',
        });
    }

    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid payload',
            message: 'Request body must be a JSON object',
        });
    }

    const columns = Object.keys(data).filter((key) => config.writable.includes(key));
    if (columns.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No writable fields provided',
        });
    }

    const values = columns.map((col) => data[col]);
    const placeholders = columns.map((_, idx) => `$${idx + 1}`);

    const returningColumns = config.columns.join(', ');

    try {
        const query = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING ${returningColumns}
        `;
        const result = await db.query(query, values);
        res.status(201).json({
            success: true,
            row: result.rows[0],
        });
    } catch (error) {
        console.error('❌ [ADMIN] Error inserting into table:', table, error);
        res.status(500).json({
            success: false,
            error: 'Failed to insert row',
            message: error.message,
        });
    }
});

router.put('/tables/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) {
        return res.status(404).json({
            success: false,
            error: 'Table not found',
        });
    }

    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid payload',
            message: 'Request body must be a JSON object',
        });
    }

    const columns = Object.keys(data).filter((key) => config.writable.includes(key));
    if (columns.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No writable fields provided',
        });
    }

    const values = columns.map((col) => data[col]);
    const setClauses = columns.map((col, idx) => `${col} = $${idx + 2}`);

    const returningColumns = config.columns.join(', ');

    try {
        const query = `
            UPDATE ${table}
            SET ${setClauses.join(', ')}
            WHERE ${config.primaryKey} = $1
            RETURNING ${returningColumns}
        `;
        const result = await db.query(query, [id, ...values]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Row not found',
            });
        }

        res.json({
            success: true,
            row: result.rows[0],
        });
    } catch (error) {
        console.error('❌ [ADMIN] Error updating table:', table, error);
        res.status(500).json({
            success: false,
            error: 'Failed to update row',
            message: error.message,
        });
    }
});

router.delete('/tables/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) {
        return res.status(404).json({
            success: false,
            error: 'Table not found',
        });
    }

    try {
        const query = `
            DELETE FROM ${table}
            WHERE ${config.primaryKey} = $1
            RETURNING ${config.primaryKey}
        `;
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Row not found',
            });
        }

        res.json({
            success: true,
            deletedId: result.rows[0][config.primaryKey],
        });
    } catch (error) {
        console.error('❌ [ADMIN] Error deleting from table:', table, error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete row',
            message: error.message,
        });
    }
});

module.exports = router;

