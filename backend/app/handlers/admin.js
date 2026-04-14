const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, COOKIE_NAME, getTokenFromRequest } = require('../middleware/auth');

const router = express.Router();

if (!process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_API_KEY environment variable is required');
}
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'abs123qwe';
const BCRYPT_ROUNDS = 12;

// Returns a filter function that handles comma-separated multi-select values as SQL IN (...)
function multiIn(col) {
    return (v, p) => {
        const vals = v.split(',').map(s => s.trim()).filter(Boolean);
        if (!vals.length) return null;
        const ph = vals.map(val => { p.push(val); return `$${p.length}`; });
        return vals.length === 1 ? `${col} = $${p.length}` : `${col} IN (${ph.join(',')})`;
    };
}

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const TABLE_CONFIG = {
    clients: {
        primaryKey: 'id',
        table: 'clients',
        columns: ['id', 'name', 'slug', 'created_at'],
        writable: ['name', 'slug'],
        searchable: ['name', 'slug'],
    },
    users: {
        primaryKey: 'id',
        table: 'users',
        from:   'users u LEFT JOIN clients c ON u.client_id = c.id',
        select: 'u.id, COALESCE(c.slug, \'(pending)\') AS client_slug, u.name, u.email, u.role, u.created_at',
        columns: ['id', 'client_slug', 'name', 'email', 'role', 'created_at'],
        sortMap: { id: 'u.id', client_slug: 'c.slug', name: 'u.name', email: 'u.email', role: 'u.role', created_at: 'u.created_at' },
        writable: ['client_id', 'name', 'email', 'role'],
        searchable: ['u.name', 'u.email', 'u.role', 'c.slug'],
        extraFilters: {
            filter_role:   (v, p) => { p.push(v); return `u.role = $${p.length}`; },
            filter_client: multiIn('c.slug'),
        },
    },
    trackers: {
        primaryKey: 'id',
        table: 'trackers',
        from:   'trackers t LEFT JOIN clients c ON t.client_id = c.id',
        select: 't.id, c.slug AS client_slug, t.slug, t.animal_type, t.animal_name, t.family, t.last_seen, t.last_battery_voltage, t.created_at',
        columns: ['id', 'client_slug', 'slug', 'animal_type', 'animal_name', 'family', 'last_seen', 'last_battery_voltage', 'created_at'],
        sortMap: {
            id: 't.id', client_slug: 'c.slug', slug: 't.slug', animal_type: 't.animal_type',
            animal_name: 't.animal_name', family: 't.family', last_seen: 't.last_seen',
            last_battery_voltage: 't.last_battery_voltage', created_at: 't.created_at',
        },
        writable: [
            'client_id', 'slug', 'animal_type', 'animal_name', 'family',
            'expected_battery_life', 'frequency_acquisition', 'frequency_sending',
            'last_seen', 'last_battery_voltage', 'initial_battery_voltage',
        ],
        searchable: ['t.slug', 't.animal_type', 't.animal_name', 't.family', 'c.slug'],
        extraFilters: {
            filter_client:          multiIn('c.slug'),
            filter_animal_type:     multiIn('t.animal_type'),
            filter_family:          multiIn('t.family'),
            filter_last_seen_from:  (v, p) => { p.push(v); return `t.last_seen >= $${p.length}`; },
            filter_last_seen_to:    (v, p) => { p.push(v); return `t.last_seen <= $${p.length}`; },
            filter_created_from:    (v, p) => { p.push(v); return `t.created_at >= $${p.length}`; },
            filter_created_to:      (v, p) => { p.push(v); return `t.created_at <= $${p.length}`; },
            filter_battery_min:     (v, p) => { const n = parseFloat(v); if (isNaN(n)) return null; p.push(n); return `t.last_battery_voltage >= $${p.length}`; },
            filter_battery_max:     (v, p) => { const n = parseFloat(v); if (isNaN(n)) return null; p.push(n); return `t.last_battery_voltage <= $${p.length}`; },
        },
    },
    locations: {
        primaryKey: 'id',
        table: 'locations',
        from:   'locations l JOIN trackers t ON l.tracker_id = t.id LEFT JOIN clients c ON t.client_id = c.id',
        select: 'l.id, t.slug AS tracker_slug, c.slug AS client_slug, l.longitude, l.latitude, l.timestamp, l.battery_voltage, l.fix_number',
        columns: ['id', 'tracker_slug', 'client_slug', 'longitude', 'latitude', 'timestamp', 'battery_voltage', 'fix_number'],
        sortMap: {
            id: 'l.id', tracker_slug: 't.slug', client_slug: 'c.slug',
            longitude: 'l.longitude', latitude: 'l.latitude', timestamp: 'l.timestamp',
            battery_voltage: 'l.battery_voltage', fix_number: 'l.fix_number',
        },
        writable: ['tracker_id', 'repeater_id', 'longitude', 'latitude', 'timestamp', 'battery_voltage', 'fix_number'],
        searchable: ['t.slug', 'c.slug'],
        extraFilters: {
            filter_client:          multiIn('c.slug'),
            filter_timestamp_from:  (v, p) => { p.push(v); return `l.timestamp >= $${p.length}`; },
            filter_timestamp_to:    (v, p) => { p.push(v); return `l.timestamp <= $${p.length}`; },
        },
    },
    repeaters: {
        primaryKey: 'id',
        table: 'repeaters',
        from:   'repeaters r LEFT JOIN clients c ON r.client_id = c.id',
        select: 'r.id, r.repeater_id, c.slug AS client_slug, r.latitude, r.longitude, r.last_seen',
        columns: ['id', 'repeater_id', 'client_slug', 'latitude', 'longitude', 'last_seen'],
        sortMap: {
            id: 'r.id', repeater_id: 'r.repeater_id', client_slug: 'c.slug',
            latitude: 'r.latitude', longitude: 'r.longitude', last_seen: 'r.last_seen',
        },
        writable: ['repeater_id', 'client_id', 'last_seen', 'latitude', 'longitude'],
        searchable: ['r.repeater_id', 'c.slug'],
        extraFilters: {
            filter_client: multiIn('c.slug'),
        },
    },
};

function extractApiKey(req) {
    const headerKey = req.header('x-api-key');
    if (headerKey && headerKey.trim() !== '') return headerKey.trim();
    const authHeader = req.header('authorization');
    if (!authHeader) return null;
    if (authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice(7).trim();
    return authHeader.trim();
}

// Auth middleware: accepts API key OR JWT cookie with live admin role check
router.use(async (req, res, next) => {
    // Option 1: API key
    const apiKey = extractApiKey(req);
    if (apiKey && ADMIN_API_KEY && safeCompare(apiKey, ADMIN_API_KEY)) return next();

    // Option 2: JWT cookie (or Bearer header) with live DB role check
    // Use the same getTokenFromRequest as requireAuth to ensure identical cookie reading
    const token = getTokenFromRequest(req);
    console.log(`[ADMIN AUTH] ${req.method} ${req.path} | cookieKeys=${Object.keys(req.cookies||{}).join(',')} | rawCookie=${req.headers.cookie||'(none)'} | hasToken=${!!token}`);
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const r = await db.query('SELECT role FROM users WHERE id = $1', [decoded.userId]);
            const role = r.rows[0]?.role;
            console.log(`[ADMIN AUTH] userId=${decoded.userId} role=${role}`);
            if (role === 'admin') return next();
            return res.status(403).json({ success: false, error: 'Forbidden', message: 'Admin role required' });
        } catch (err) {
            console.log(`[ADMIN AUTH] JWT/DB error: ${err.message}`);
        }
    }

    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Admin access required' });
});

// GET /api/admin/filter-options/:field — distinct values for multi-select filters
const FILTER_OPTIONS_QUERIES = {
    client_slug:  `SELECT DISTINCT slug AS value FROM clients WHERE slug IS NOT NULL ORDER BY slug`,
    animal_type:  `SELECT DISTINCT animal_type AS value FROM trackers WHERE animal_type IS NOT NULL ORDER BY animal_type`,
    family:       `SELECT DISTINCT family AS value FROM trackers WHERE family IS NOT NULL ORDER BY family`,
};

router.get('/filter-options/:field', async (req, res) => {
    const query = FILTER_OPTIONS_QUERIES[req.params.field];
    if (!query) return res.status(404).json({ success: false, error: 'Unknown filter field' });
    try {
        const result = await db.query(query);
        res.json({ success: true, values: result.rows.map(r => r.value) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/tables — list tables with live row counts
router.get('/tables', async (req, res) => {
    try {
        const tables = Object.keys(TABLE_CONFIG);
        const counts = await Promise.all(
            tables.map(name => {
                const cfg = TABLE_CONFIG[name];
                return db.query(`SELECT COUNT(*) as c FROM ${cfg.table || name}`)
                    .then(r => parseInt(r.rows[0].c, 10))
                    .catch(() => 0);
            })
        );
        res.json({
            success: true,
            tables: tables.map((name, i) => ({
                name,
                count: counts[i],
                columns: TABLE_CONFIG[name].columns,
                writable: TABLE_CONFIG[name].writable,
                primaryKey: TABLE_CONFIG[name].primaryKey,
            })),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/stats/:table — table-specific summary stats
router.get('/stats/:table', async (req, res) => {
    const { table } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) return res.status(404).json({ success: false, error: 'Table not found' });

    try {
        let stats;
        if (table === 'users') {
            const r = await db.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(CASE WHEN role = 'admin' THEN 1 END) AS admins,
                    COUNT(CASE WHEN role = 'manager' THEN 1 END) AS managers,
                    COUNT(CASE WHEN role = 'viewer' THEN 1 END) AS viewers
                FROM users
            `);
            const row = r.rows[0];
            stats = [
                { label: 'Total users', value: row.total },
                { label: 'Admins', value: row.admins },
                { label: 'Managers', value: row.managers },
                { label: 'Viewers', value: row.viewers },
            ];
        } else if (table === 'trackers') {
            const r = await db.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(CASE WHEN animal_name IS NOT NULL AND animal_name != '' THEN 1 END) AS assigned,
                    COUNT(CASE WHEN animal_name IS NULL OR animal_name = '' THEN 1 END) AS unassigned
                FROM trackers
            `);
            const row = r.rows[0];
            stats = [
                { label: 'Total', value: row.total },
                { label: 'Assigned', value: row.assigned },
                { label: 'Unassigned', value: row.unassigned },
                { label: 'Columns', value: config.columns.length },
            ];
        } else {
            const r = await db.query(`SELECT COUNT(*) AS total FROM ${table}`);
            stats = [
                { label: 'Records', value: r.rows[0].total },
                { label: 'Editable', value: config.writable.length },
                { label: 'Columns', value: config.columns.length },
                { label: 'Primary key', value: config.primaryKey, isText: true },
            ];
        }
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/admin/tables/:table — paginated, searchable, sortable rows
router.get('/tables/:table', async (req, res) => {
    const { table } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) return res.status(404).json({ success: false, error: 'Table not found' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = (req.query.search || '').trim();
    const sortBy = config.columns.includes(req.query.sort_by) ? req.query.sort_by : config.primaryKey;
    const sortDir = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';

    const fromClause   = config.from   || (config.table || table);
    const selectClause = config.select || config.columns.join(', ');
    const sortExpr     = config.sortMap?.[sortBy] || sortBy;

    try {
        const searchable = config.searchable || [];
        const params = [];
        const conditions = [];

        if (search && searchable.length > 0) {
            params.push(`%${search}%`);
            const sc = searchable.map(col => `${col}::text ILIKE $${params.length}`);
            conditions.push(`(${sc.join(' OR ')})`);
        }

        // Apply generic extra filters defined in TABLE_CONFIG
        if (config.extraFilters) {
            for (const [key, filterFn] of Object.entries(config.extraFilters)) {
                const val = (req.query[key] || '').trim();
                if (val) {
                    const clause = filterFn(val, params);
                    if (clause) conditions.push(clause);
                }
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const dataQuery = `
            SELECT ${selectClause}
            FROM ${fromClause}
            ${whereClause}
            ORDER BY ${sortExpr} ${sortDir}
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;

        const countParams = params.slice(0, params.length - 2);
        const countQuery = `SELECT COUNT(*) AS total FROM ${fromClause} ${whereClause}`;

        const [dataResult, countResult] = await Promise.all([
            db.query(dataQuery, params),
            db.query(countQuery, countParams),
        ]);

        res.json({
            success: true,
            rows: dataResult.rows,
            count: dataResult.rowCount,
            total: parseInt(countResult.rows[0].total, 10),
            limit,
            offset,
        });
    } catch (error) {
        console.error('❌ [ADMIN] Error fetching table:', table, error);
        res.status(500).json({ success: false, error: 'Failed to fetch table data', message: error.message });
    }
});

// POST /api/admin/tables/:table — insert row
router.post('/tables/:table', async (req, res) => {
    const { table } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) return res.status(404).json({ success: false, error: 'Table not found' });

    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Handle password for users table
    let extraColumns = [];
    let extraValues = [];
    if (table === 'users' && data.password) {
        extraColumns.push('password_hash');
        extraValues.push(await bcrypt.hash(String(data.password), BCRYPT_ROUNDS));
    }

    const columns = Object.keys(data).filter(key => config.writable.includes(key));
    if (columns.length === 0 && extraColumns.length === 0) {
        return res.status(400).json({ success: false, error: 'No writable fields provided' });
    }

    const allColumns = [...columns, ...extraColumns];
    const allValues = [...columns.map(col => data[col]), ...extraValues];
    const placeholders = allValues.map((_, i) => `$${i + 1}`);
    const baseTable = config.table || table;

    try {
        const query = `
            INSERT INTO ${baseTable} (${allColumns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING id
        `;
        const result = await db.query(query, allValues);
        res.status(201).json({ success: true, row: result.rows[0] });
    } catch (error) {
        console.error('❌ [ADMIN] Error inserting into table:', table, error);
        res.status(500).json({ success: false, error: 'Failed to insert row', message: error.message });
    }
});

// PUT /api/admin/tables/:table/:id — update row
router.put('/tables/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) return res.status(404).json({ success: false, error: 'Table not found' });

    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const columns = Object.keys(data).filter(key => config.writable.includes(key));

    // Handle password change for users
    let extraColumns = [];
    let extraValues = [];
    if (table === 'users' && data.password) {
        extraColumns.push('password_hash');
        extraValues.push(await bcrypt.hash(String(data.password), BCRYPT_ROUNDS));
    }

    const allColumns = [...columns, ...extraColumns];
    const allValues = [...columns.map(col => data[col]), ...extraValues];

    if (allColumns.length === 0) {
        return res.status(400).json({ success: false, error: 'No writable fields provided' });
    }

    const setClauses = allColumns.map((col, idx) => `${col} = $${idx + 2}`);
    const baseTable = config.table || table;

    try {
        const query = `
            UPDATE ${baseTable}
            SET ${setClauses.join(', ')}
            WHERE id = $1
            RETURNING id
        `;
        const result = await db.query(query, [id, ...allValues]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Row not found' });
        res.json({ success: true, row: result.rows[0] });
    } catch (error) {
        console.error('❌ [ADMIN] Error updating table:', table, error);
        res.status(500).json({ success: false, error: 'Failed to update row', message: error.message });
    }
});

// DELETE /api/admin/tables/:table/:id — delete row
router.delete('/tables/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const config = TABLE_CONFIG[table];
    if (!config) return res.status(404).json({ success: false, error: 'Table not found' });

    try {
        const baseTable = config.table || table;
        const result = await db.query(
            `DELETE FROM ${baseTable} WHERE id = $1 RETURNING id`,
            [id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Row not found' });
        res.json({ success: true, deletedId: result.rows[0].id });
    } catch (error) {
        console.error('❌ [ADMIN] Error deleting from table:', table, error);
        res.status(500).json({ success: false, error: 'Failed to delete row', message: error.message });
    }
});

module.exports = router;
