// Expenses admin — JWT cookie auth, matches admin page patterns

const SAR_PER_USD = 3.75; // SAR is pegged to USD

// Default exchange rates (1 unit of currency → USD)
const DEFAULT_RATES = {
    USD: 1.0,
    SAR: 1 / 3.75,       // ≈ 0.26667
    EUR: 1.09,
    GBP: 1.27,
    AED: 1 / 3.6725,     // ≈ 0.2723
    JPY: 0.0065,
    CNY: 0.138,
    KWD: 3.25,
    OTHER: 1.0,
};

const CATEGORIES = [
    'Travel', 'Accommodation', 'Electronics', 'Enclosure / Hardware',
    'Lab Supplies', 'Software / Subscriptions', 'Food & Meals',
    'Shipping & Logistics', 'Office Supplies', 'Tools & Equipment',
    'Maintenance & Repair', 'Printing & Documents', 'Communication',
    'Visa & Government Fees', 'Conference & Events', 'Other',
];

let allExpenses = [];
let editingId = null;
let deletingId = null;

// ── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
        window.location.replace('/pages/auth/login?redirect=/pages/admin/expenses');
        return;
    }
    const data = await res.json().catch(() => ({}));
    if (!data.user || data.user.role !== 'admin') {
        window.location.replace('/pages/dashboard');
        return;
    }

    populateCategoryFilter();

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('newExpenseBtn').addEventListener('click', () => openModal(null));
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
    document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

    // Modal controls
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', closeModal);
    document.getElementById('modalSave').addEventListener('click', handleSave);

    // Delete modal
    document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteCancelBtn2').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteBackdrop').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteConfirmBtn').addEventListener('click', handleDelete);

    // Conditional field logic
    document.getElementById('fPaidByField').addEventListener('change', onPaidByChange);
    document.getElementById('fFundField').addEventListener('change', onFundChange);
    document.getElementById('fCurrency').addEventListener('change', onCurrencyChange);
    document.getElementById('fAmount').addEventListener('input', updateConvertedPreview);
    document.getElementById('fRate').addEventListener('input', updateConvertedPreview);

    // Filter changes
    ['fDateFrom', 'fDateTo', 'fPaidBy', 'fFund', 'fCategory', 'fItemStatus', 'fReimbStatus']
        .forEach(id => document.getElementById(id).addEventListener('change', renderTable));

    await loadAll();
});

// ── Auth ─────────────────────────────────────────────────────────────────────

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.replace('/pages/auth/login');
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadAll() {
    await Promise.all([loadExpenses(), loadSummary()]);
}

async function loadExpenses() {
    try {
        const res = await fetch('/api/admin/expenses', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        allExpenses = data.expenses;
        renderTable();
    } catch (err) {
        document.getElementById('expTableBody').innerHTML =
            `<tr><td colspan="12" class="exp-empty" style="color:var(--red)">Failed to load: ${err.message}</td></tr>`;
    }
}

async function loadSummary() {
    try {
        const res = await fetch('/api/admin/expenses/summary', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;
        const s = data.summary;
        document.getElementById('sumTotal').textContent = s.total_count;
        document.getElementById('sumTotalUsd').textContent = fmtUsd(s.total_usd);
        document.getElementById('sumTotalSar').textContent = fmtSar(s.total_usd * SAR_PER_USD);
        document.getElementById('sumKaust').textContent = fmtUsd(s.kaust_usd);
        document.getElementById('sumPersonal').textContent = fmtUsd(s.personal_usd);
        document.getElementById('sumPendingReimb').textContent = fmtUsd(s.pending_reimb_usd);
    } catch (_) {}
}

// ── Filters + table render ────────────────────────────────────────────────────

function getFilters() {
    return {
        dateFrom: document.getElementById('fDateFrom').value,
        dateTo:   document.getElementById('fDateTo').value,
        paidBy:   document.getElementById('fPaidBy').value,
        fund:     document.getElementById('fFund').value,
        category: document.getElementById('fCategory').value,
        itemStatus: document.getElementById('fItemStatus').value,
        reimbStatus: document.getElementById('fReimbStatus').value,
    };
}

function applyFilters(rows) {
    const f = getFilters();
    return rows.filter(e => {
        if (f.dateFrom && e.date < f.dateFrom) return false;
        if (f.dateTo   && e.date > f.dateTo)   return false;
        if (f.paidBy   && e.paid_by !== f.paidBy) return false;
        if (f.fund     && e.fund !== f.fund) return false;
        if (f.category && e.category !== f.category) return false;
        if (f.itemStatus  && e.item_status !== f.itemStatus) return false;
        if (f.reimbStatus && e.reimbursement_status !== f.reimbStatus) return false;
        return true;
    });
}

function clearFilters() {
    ['fDateFrom','fDateTo','fPaidBy','fFund','fCategory','fItemStatus','fReimbStatus']
        .forEach(id => { document.getElementById(id).value = ''; });
    renderTable();
}

function renderTable() {
    const filtered = applyFilters(allExpenses);
    const meta = document.getElementById('topbarMeta');
    meta.textContent = `${filtered.length} of ${allExpenses.length} expense${allExpenses.length !== 1 ? 's' : ''}`;

    const tbody = document.getElementById('expTableBody');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="exp-empty">No expenses match the current filters.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(e => {
        const amtUsd = parseFloat(e.amount_usd) || 0;
        const amtSar = amtUsd * SAR_PER_USD;
        const paidByLabel = e.paid_by === 'Other' && e.paid_by_other ? e.paid_by_other : e.paid_by;

        return `
        <tr>
            <td>${fmtDate(e.date)}</td>
            <td class="exp-td-desc">
                <div style="font-weight:500">${esc(e.description)}</div>
                ${e.vendor ? `<div style="color:var(--text-3);font-size:0.75rem">${esc(e.vendor)}</div>` : ''}
            </td>
            <td>${esc(e.category)}</td>
            <td>${esc(paidByLabel)}</td>
            <td class="exp-td-right">${fmtAmt(e.amount, e.currency)}</td>
            <td class="exp-td-right">${fmtUsd(amtUsd)}</td>
            <td class="exp-td-right">${fmtSar(amtSar)}</td>
            <td>${fundBadge(e.fund)}</td>
            <td>${statusBadge(e.item_status)}</td>
            <td>${statusBadge(e.reimbursement_status)}</td>
            <td class="exp-td-comment">${e.comment ? esc(e.comment) : ''}</td>
            <td>
                <div class="exp-row-actions">
                    <button class="exp-icon-btn" onclick="openModal(${e.id})" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="exp-icon-btn exp-icon-btn--del" onclick="confirmDelete(${e.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Category filter population ────────────────────────────────────────────────

function populateCategoryFilter() {
    const sel = document.getElementById('fCategory');
    CATEGORIES.forEach(c => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        sel.appendChild(o);
    });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(id) {
    editingId = id;
    clearFormError();

    if (id === null) {
        // New expense
        document.getElementById('modalTitle').textContent = 'New expense';
        document.getElementById('fId').value = '';
        document.getElementById('expForm').reset();
        document.getElementById('fDate').value = todayIso();
        document.getElementById('fCurrency').value = 'USD';
        document.getElementById('fRate').value = '1';
        document.getElementById('paidByOtherWrap').style.display = 'none';
        document.getElementById('reimbWrap').style.display = 'none';
        updateConvertedPreview();
    } else {
        const e = allExpenses.find(x => x.id === id);
        if (!e) return;
        document.getElementById('modalTitle').textContent = 'Edit expense';
        document.getElementById('fId').value = e.id;
        document.getElementById('fDate').value = e.date ? e.date.substring(0, 10) : '';
        document.getElementById('fCategoryField').value = e.category;
        document.getElementById('fDesc').value = e.description;
        document.getElementById('fVendor').value = e.vendor || '';
        document.getElementById('fPaidByField').value = e.paid_by;
        document.getElementById('fPaidByOther').value = e.paid_by_other || '';
        document.getElementById('paidByOtherWrap').style.display = e.paid_by === 'Other' ? '' : 'none';
        document.getElementById('fAmount').value = e.amount;
        document.getElementById('fCurrency').value = e.currency;
        document.getElementById('fRate').value = e.exchange_rate_to_usd;
        document.getElementById('fFundField').value = e.fund;
        document.getElementById('reimbWrap').style.display = e.fund === 'KAUST' ? '' : 'none';
        document.getElementById('mReimbStatus').value = e.reimbursement_status || '';
        document.getElementById('mItemStatus').value = e.item_status || '';
        document.getElementById('fComment').value = e.comment || '';
        updateConvertedPreview();
    }

    document.getElementById('expModal').hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('expModal').hidden = true;
    document.body.style.overflow = '';
    editingId = null;
}

// ── Conditional field visibility ──────────────────────────────────────────────

function onPaidByChange() {
    const val = document.getElementById('fPaidByField').value;
    document.getElementById('paidByOtherWrap').style.display = val === 'Other' ? '' : 'none';
    if (val !== 'Other') document.getElementById('fPaidByOther').value = '';
}

function onFundChange() {
    const val = document.getElementById('fFundField').value;
    document.getElementById('reimbWrap').style.display = val === 'KAUST' ? '' : 'none';
    if (val !== 'KAUST') document.getElementById('mReimbStatus').value = '';
}

function onCurrencyChange() {
    const cur = document.getElementById('fCurrency').value;
    const rate = DEFAULT_RATES[cur] ?? 1.0;
    document.getElementById('fRate').value = rate.toFixed(cur === 'JPY' ? 6 : cur === 'SAR' || cur === 'AED' ? 6 : 4);
    updateConvertedPreview();
}

function updateConvertedPreview() {
    const amount = parseFloat(document.getElementById('fAmount').value) || 0;
    const rate   = parseFloat(document.getElementById('fRate').value) || 1;
    const usd    = amount * rate;
    const sar    = usd * SAR_PER_USD;
    document.getElementById('convertedPreview').textContent =
        amount > 0 ? `${fmtUsd(usd)} / ${fmtSar(sar)}` : '—';
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function handleSave() {
    clearFormError();

    const id       = document.getElementById('fId').value;
    const paidBy   = document.getElementById('fPaidByField').value;
    const fund     = document.getElementById('fFundField').value;

    const payload = {
        date:                 document.getElementById('fDate').value,
        description:          document.getElementById('fDesc').value.trim(),
        vendor:               document.getElementById('fVendor').value.trim(),
        category:             document.getElementById('fCategoryField').value,
        paid_by:              paidBy,
        paid_by_other:        paidBy === 'Other' ? document.getElementById('fPaidByOther').value.trim() : '',
        fund,
        amount:               document.getElementById('fAmount').value,
        currency:             document.getElementById('fCurrency').value,
        exchange_rate_to_usd: document.getElementById('fRate').value || '1',
        item_status:          document.getElementById('mItemStatus').value,
        reimbursement_status: fund === 'KAUST' ? document.getElementById('mReimbStatus').value : '',
        comment:              document.getElementById('fComment').value.trim(),
    };

    // Basic client-side validation
    if (!payload.date || !payload.description || !payload.category || !payload.paid_by || !payload.fund || !payload.amount) {
        showFormError('Please fill in all required fields.');
        return;
    }
    if (payload.paid_by === 'Other' && !payload.paid_by_other) {
        showFormError('Please specify who paid.');
        return;
    }

    const btn = document.getElementById('modalSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const method = id ? 'PUT' : 'POST';
        const url    = id ? `/api/admin/expenses/${id}` : '/api/admin/expenses';
        const res = await fetch(url, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');

        closeModal();
        await loadAll();
    } catch (err) {
        showFormError(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────

function confirmDelete(id) {
    deletingId = id;
    const e = allExpenses.find(x => x.id === id);
    document.getElementById('deleteConfirmText').textContent =
        e ? `Delete "${e.description}" (${fmtAmt(e.amount, e.currency)})? This cannot be undone.`
          : 'This action cannot be undone.';
    document.getElementById('deleteModal').hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').hidden = true;
    document.body.style.overflow = '';
    deletingId = null;
}

async function handleDelete() {
    if (!deletingId) return;
    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
        const res = await fetch(`/api/admin/expenses/${deletingId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        closeDeleteModal();
        await loadAll();
    } catch (err) {
        alert('Delete failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Delete';
    }
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv() {
    const filtered = applyFilters(allExpenses);
    if (!filtered.length) { alert('No expenses to export.'); return; }

    const headers = [
        'ID', 'Date', 'Description', 'Vendor', 'Category',
        'Paid By', 'Paid By (detail)', 'Fund',
        'Amount', 'Currency', 'Exchange Rate to USD', 'Amount USD', 'Amount SAR',
        'Item Status', 'Reimbursement Status', 'Comment',
        'Created At', 'Updated At'
    ];

    const rows = filtered.map(e => {
        const amtUsd = parseFloat(e.amount_usd) || 0;
        const amtSar = (amtUsd * SAR_PER_USD).toFixed(2);
        return [
            e.id,
            e.date ? e.date.substring(0, 10) : '',
            csvEsc(e.description),
            csvEsc(e.vendor || ''),
            csvEsc(e.category),
            csvEsc(e.paid_by),
            csvEsc(e.paid_by_other || ''),
            csvEsc(e.fund),
            e.amount,
            csvEsc(e.currency),
            e.exchange_rate_to_usd,
            amtUsd.toFixed(2),
            amtSar,
            csvEsc(e.item_status || ''),
            csvEsc(e.reimbursement_status || ''),
            csvEsc(e.comment || ''),
            e.created_at ? e.created_at.substring(0, 19).replace('T', ' ') : '',
            e.updated_at ? e.updated_at.substring(0, 19).replace('T', ' ') : '',
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `custodia-expenses-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
    if (!d) return '—';
    return d.substring(0, 10);
}

function fmtUsd(n) {
    const num = parseFloat(n) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSar(n) {
    const num = parseFloat(n) || 0;
    return '﷼' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAmt(amount, currency) {
    const n = parseFloat(amount) || 0;
    const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${currency}`;
}

function statusBadge(status) {
    if (!status) return '<span style="color:var(--text-3)">—</span>';
    return `<span class="exp-badge exp-badge--${status.toLowerCase()}">${status}</span>`;
}

function fundBadge(fund) {
    if (!fund) return '—';
    const cls = fund === 'KAUST' ? 'kaust' : fund === 'personal' ? 'personal' : 'other';
    const label = fund === 'KAUST' ? 'KAUST' : fund.charAt(0).toUpperCase() + fund.slice(1);
    return `<span class="exp-badge exp-badge--${cls}">${label}</span>`;
}

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function csvEsc(s) {
    const str = String(s ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function todayIso() {
    return new Date().toISOString().substring(0, 10);
}

function showFormError(msg) {
    const el = document.getElementById('formError');
    el.textContent = msg;
    el.style.display = '';
}

function clearFormError() {
    const el = document.getElementById('formError');
    el.style.display = 'none';
    el.textContent = '';
}

// Expose to inline onclick handlers
window.openModal = openModal;
window.confirmDelete = confirmDelete;
