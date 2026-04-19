const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(requireAuth, (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden: admin only' });
    }
    next();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWhereClause(query) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.paid_by) {
        conditions.push(`paid_by = $${idx++}`);
        params.push(query.paid_by);
    }
    if (query.fund) {
        conditions.push(`fund = $${idx++}`);
        params.push(query.fund);
    }
    if (query.category) {
        conditions.push(`category = $${idx++}`);
        params.push(query.category);
    }
    if (query.item_status) {
        conditions.push(`item_status = $${idx++}`);
        params.push(query.item_status);
    }
    if (query.reimbursement_status) {
        conditions.push(`reimbursement_status = $${idx++}`);
        params.push(query.reimbursement_status);
    }
    if (query.date_from) {
        conditions.push(`date >= $${idx++}`);
        params.push(query.date_from);
    }
    if (query.date_to) {
        conditions.push(`date <= $${idx++}`);
        params.push(query.date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params };
}

// ── GET /api/admin/expenses ───────────────────────────────────────────────────
// Returns all expenses (optionally filtered), sorted by date desc.

router.get('/', async (req, res) => {
    try {
        const { where, params } = buildWhereClause(req.query);
        const sql = `
            SELECT id, date, description, vendor, category,
                   paid_by, paid_by_other, fund,
                   amount, currency, exchange_rate_to_usd, amount_usd,
                   item_status, reimbursement_status, comment,
                   created_at, updated_at
            FROM expenses
            ${where}
            ORDER BY date DESC, created_at DESC
        `;
        const result = await db.query(sql, params);
        res.json({ success: true, expenses: result.rows });
    } catch (err) {
        console.error('❌ [EXPENSES] GET error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/admin/expenses/summary ──────────────────────────────────────────
// Returns aggregate stats for the header cards.

router.get('/summary', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*)::int                                      AS total_count,
                COALESCE(SUM(amount_usd), 0)::numeric(12,2)        AS total_usd,
                COALESCE(SUM(CASE WHEN fund = 'KAUST'     THEN amount_usd ELSE 0 END), 0)::numeric(12,2) AS kaust_usd,
                COALESCE(SUM(CASE WHEN fund = 'personal'  THEN amount_usd ELSE 0 END), 0)::numeric(12,2) AS personal_usd,
                COALESCE(SUM(CASE WHEN fund = 'KAUST' AND (reimbursement_status IS DISTINCT FROM 'received') THEN amount_usd ELSE 0 END), 0)::numeric(12,2) AS pending_reimb_usd
            FROM expenses
        `);
        res.json({ success: true, summary: result.rows[0] });
    } catch (err) {
        console.error('❌ [EXPENSES] summary error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/admin/expenses ──────────────────────────────────────────────────
// Create a new expense.

router.post('/', async (req, res) => {
    try {
        const {
            date, description, vendor, category,
            paid_by, paid_by_other, fund,
            amount, currency, exchange_rate_to_usd,
            item_status, reimbursement_status, comment
        } = req.body;

        if (!date || !description || !category || !paid_by || !fund || amount == null || !currency) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const rate = parseFloat(exchange_rate_to_usd) || 1.0;
        const amountUsd = (parseFloat(amount) * rate).toFixed(2);

        const result = await db.query(`
            INSERT INTO expenses
                (date, description, vendor, category, paid_by, paid_by_other, fund,
                 amount, currency, exchange_rate_to_usd, amount_usd,
                 item_status, reimbursement_status, comment)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING *
        `, [
            date, description, vendor || null, category,
            paid_by, paid_by === 'Other' ? (paid_by_other || null) : null, fund,
            parseFloat(amount), currency, rate, parseFloat(amountUsd),
            item_status || null,
            fund === 'KAUST' ? (reimbursement_status || null) : null,
            comment || null
        ]);

        res.json({ success: true, expense: result.rows[0] });
    } catch (err) {
        console.error('❌ [EXPENSES] POST error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── PUT /api/admin/expenses/:id ───────────────────────────────────────────────
// Update an existing expense.

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date, description, vendor, category,
            paid_by, paid_by_other, fund,
            amount, currency, exchange_rate_to_usd,
            item_status, reimbursement_status, comment
        } = req.body;

        if (!date || !description || !category || !paid_by || !fund || amount == null || !currency) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const rate = parseFloat(exchange_rate_to_usd) || 1.0;
        const amountUsd = (parseFloat(amount) * rate).toFixed(2);

        const result = await db.query(`
            UPDATE expenses SET
                date = $1, description = $2, vendor = $3, category = $4,
                paid_by = $5, paid_by_other = $6, fund = $7,
                amount = $8, currency = $9, exchange_rate_to_usd = $10, amount_usd = $11,
                item_status = $12, reimbursement_status = $13, comment = $14,
                updated_at = NOW()
            WHERE id = $15
            RETURNING *
        `, [
            date, description, vendor || null, category,
            paid_by, paid_by === 'Other' ? (paid_by_other || null) : null, fund,
            parseFloat(amount), currency, rate, parseFloat(amountUsd),
            item_status || null,
            fund === 'KAUST' ? (reimbursement_status || null) : null,
            comment || null,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Expense not found' });
        }

        res.json({ success: true, expense: result.rows[0] });
    } catch (err) {
        console.error('❌ [EXPENSES] PUT error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── DELETE /api/admin/expenses/:id ────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Expense not found' });
        }
        res.json({ success: true, deletedId: result.rows[0].id });
    } catch (err) {
        console.error('❌ [EXPENSES] DELETE error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
