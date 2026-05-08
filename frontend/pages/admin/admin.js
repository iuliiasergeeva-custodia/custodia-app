// ── State ──────────────────────────────────────────────────────────────────
const S = {
    activeTable:  null,
    tables:       [],   // [{ name, count, columns, writable, primaryKey }]
    rows:         [],
    total:        0,
    stats:        [],
    page:         1,
    pageSize:     50,
    search:       '',
    filters:      {},   // generic per-table filter values { filter_key: value }
    sortBy:       null,
    sortDir:      'desc',
    editRow:      undefined, // undefined = closed, null = new, object = edit
};

// Dot colours per table (sidebar)
const TABLE_COLORS = {
    clients:   '#f59e0b',
    users:     '#3b82f6',
    trackers:  '#22c55e',
    locations: '#8b5cf6',
    repeaters: '#f97316',
};

/** Seconds from fix `timestamp` to DB `created_at` (positive ≈ ingest delay; negative if stored before fix time). */
function formatLatencySeconds(sec) {
    if (sec === null || sec === undefined || sec === '') return '—';
    const n = Number(sec);
    if (!Number.isFinite(n)) return String(sec);
    const neg = n < 0;
    const abs = Math.abs(n);
    let body;
    if (abs < 60) body = `${abs.toFixed(1)} s`;
    else if (abs < 3600) body = `${(abs / 60).toFixed(1)} min`;
    else if (abs < 86400) body = `${(abs / 3600).toFixed(1)} h`;
    else body = `${(abs / 86400).toFixed(1)} d`;
    return (neg ? '-' : '') + body;
}

// Writable field config per table (for modal form generation)
const TABLE_FIELDS = {
    clients:   ['name', 'slug'],
    users:     ['client_id', 'name', 'email', 'role', 'password'],
    trackers:  ['client_id', 'slug', 'animal_type', 'animal_name', 'family',
                'expected_battery_life', 'frequency_acquisition', 'frequency_sending',
                'last_seen', 'last_battery_voltage', 'initial_battery_voltage'],
    locations: ['tracker_id', 'repeater_id', 'longitude', 'latitude', 'timestamp',
                'battery_voltage', 'fix_number'],
    repeaters: ['repeater_id', 'last_seen'],
};

// Fields rendered as <select>
const SELECT_FIELDS = {
    role: ['admin', 'manager', 'viewer'],
};

// Per-table filter bar definitions
const FILTER_CONFIG = {
    users: [
        { key: 'filter_role',   type: 'select',      options: ['', 'admin', 'manager', 'viewer'], labels: ['All roles', 'admin', 'manager', 'viewer'] },
        { key: 'filter_client', type: 'multiselect', source: '/filter-options/client_slug', placeholder: 'All clients' },
    ],
    trackers: [
        { key: 'filter_client',         type: 'multiselect', source: '/filter-options/client_slug', placeholder: 'All clients' },
        { key: 'filter_animal_type',    type: 'multiselect', source: '/filter-options/animal_type',  placeholder: 'All types'   },
        { key: 'filter_family',         type: 'multiselect', source: '/filter-options/family',       placeholder: 'All families'},
        { key: 'filter_last_seen_from', type: 'date',   label: 'Last seen' },
        { key: 'filter_last_seen_to',   type: 'date',   label: '→' },
        { key: 'filter_created_from',   type: 'date',   label: 'Created' },
        { key: 'filter_created_to',     type: 'date',   label: '→' },
        { key: 'filter_battery_min',    type: 'number', placeholder: 'Bat ≥', step: '0.01', min: '0' },
        { key: 'filter_battery_max',    type: 'number', placeholder: '≤',     step: '0.01', min: '0' },
    ],
    locations: [
        { key: 'filter_client',         type: 'multiselect', source: '/filter-options/client_slug', placeholder: 'All clients' },
        { key: 'filter_timestamp_from', type: 'date', label: 'From' },
        { key: 'filter_timestamp_to',   type: 'date', label: '→' },
    ],
    repeaters: [
        { key: 'filter_client', type: 'multiselect', source: '/filter-options/client_slug', placeholder: 'All clients' },
    ],
};

// ── Multi-select options cache ────────────────────────────────────────────────
const optionsCache = new Map(); // source → string[]

async function fetchFilterOptions(source) {
    if (optionsCache.has(source)) return optionsCache.get(source);
    const data = await api('GET', source);
    const values = data?.values || [];
    optionsCache.set(source, values);
    return values;
}

// ── API ─────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch('/api/admin' + path, opts);
    if (res.status === 401) {
        // Show error instead of looping back to login — helps diagnose auth issues
        document.getElementById('admContent').innerHTML = `
            <div class="adm-placeholder" style="color:#f87171">
                <p>Session expired or admin access required.</p>
                <p style="margin-top:8px;font-size:13px;opacity:0.7">Check the server console for [ADMIN AUTH] log lines.</p>
                <a href="/pages/auth/login?redirect=/pages/admin" style="color:#c4a574;text-decoration:underline;font-size:14px">← Back to login</a>
            </div>`;
        return null;
    }
    return res.json();
}

// ── Auth guard ───────────────────────────────────────────────────────────────
async function checkAuth() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
        window.location.replace('/pages/auth/login?redirect=' + encodeURIComponent('/pages/admin'));
        return false;
    }
    const data = await res.json().catch(() => ({}));
    if (data?.user?.role !== 'admin') {
        window.location.replace('/pages/dashboard');
        return false;
    }
    return true;
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    const ok = await checkAuth();
    if (!ok) return;

    setupApiKeyToggle();
    // Close any open multi-select dropdown when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.adm-ms-dropdown:not([hidden])').forEach(d => { d.hidden = true; });
    });
    document.getElementById('refreshBtn').addEventListener('click', () => loadTable(S.activeTable));
    document.getElementById('newRecordBtn').addEventListener('click', openNewModal);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('modalSave').addEventListener('click', saveRecord);

    await loadSidebar();
    // Auto-select first table
    if (S.tables.length > 0) selectTable(S.tables[0].name);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
async function loadSidebar() {
    const data = await api('GET', '/tables');
    if (!data?.success) return;
    S.tables = data.tables;
    renderSidebar();
}

function renderSidebar() {
    const nav = document.getElementById('tableNav');
    nav.innerHTML = '';
    S.tables.forEach(t => {
        const item = document.createElement('div');
        item.className = 'adm-table-nav-item' + (t.name === S.activeTable ? ' is-active' : '');
        item.innerHTML = `
            <span class="adm-table-dot" style="background:${TABLE_COLORS[t.name] || '#888'}"></span>
            <span class="adm-table-nav-name">${t.name}</span>
            <span class="adm-table-nav-count">${t.count}</span>`;
        item.addEventListener('click', () => selectTable(t.name));
        nav.appendChild(item);
    });
}

function selectTable(name) {
    S.activeTable = name;
    S.page = 1;
    S.search = '';
    S.filters = {};
    S.sortBy = null;
    S.sortDir = 'desc';
    // Update active state in sidebar
    document.querySelectorAll('.adm-table-nav-item').forEach(el => {
        el.classList.toggle('is-active', el.querySelector('.adm-table-nav-name')?.textContent === name);
    });
    loadTable(name);
}

// ── Load table ─────────────────────────────────────────────────────────────────
async function loadTable(table) {
    if (!table) return;

    const cfg = S.tables.find(t => t.name === table);
    const pk = cfg?.primaryKey || 'id';
    const sortBy = S.sortBy || pk;

    const params = new URLSearchParams({
        limit:    S.pageSize,
        offset:   (S.page - 1) * S.pageSize,
        sort_by:  sortBy,
        sort_dir: S.sortDir,
    });
    if (S.search) params.set('search', S.search);
    Object.entries(S.filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    const [statsData, tableData] = await Promise.all([
        api('GET', `/stats/${table}`),
        api('GET', `/tables/${table}?${params}`),
    ]);

    if (!tableData?.success) {
        toast('Failed to load table data', 'error');
        return;
    }

    S.rows  = tableData.rows || [];
    S.total = tableData.total || 0;
    S.stats = statsData?.stats || [];

    renderTopbar(table, tableData.total, pk);
    renderContent(table, cfg);

    // Refresh sidebar counts
    loadSidebar();
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function renderTopbar(table, total, pk) {
    document.getElementById('topbarTitle').textContent = table;
    document.getElementById('topbarMeta').textContent =
        `${total} record${total !== 1 ? 's' : ''} · pk: ${pk}`;
}

// ── Content ──────────────────────────────────────────────────────────────────
function renderContent(table, cfg) {
    const content = document.getElementById('admContent');
    content.innerHTML = `
        <div class="adm-stats-row" id="statsRow"></div>
        <div class="adm-columns-row" id="columnsRow"></div>
        <div class="adm-search-bar" id="searchBar"></div>
        <div class="adm-table-wrapper" id="tableWrapper">
            <table class="adm-table">
                <thead id="tableHead"></thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>
        <div class="adm-table-footer" id="tableFooter"></div>
    `;

    renderStats();
    renderColumnPills(cfg);
    renderSearchBar(table);
    renderTable(table, cfg);
    renderFooter();
}

// ── Stats ────────────────────────────────────────────────────────────────────
function renderStats() {
    const row = document.getElementById('statsRow');
    if (!row) return;
    row.innerHTML = S.stats.map(s => `
        <div class="adm-stat-card">
            <div class="adm-stat-value">${s.isText ? `<span style="font-size:1.1rem">${s.value}</span>` : s.value}</div>
            <div class="adm-stat-label">${s.label}</div>
        </div>
    `).join('');
}

// ── Column pills ──────────────────────────────────────────────────────────────
function renderColumnPills(cfg) {
    const row = document.getElementById('columnsRow');
    if (!row || !cfg) return;
    row.innerHTML = cfg.columns.map(col => {
        const isPk = col === cfg.primaryKey;
        const isWritable = cfg.writable.includes(col);
        let cls = 'adm-col-pill';
        if (isPk) cls += ' is-pk';
        else if (isWritable) cls += ' is-writable';
        const label = isPk ? `${col} pk` : col;
        return `<span class="${cls}">${label}</span>`;
    }).join('');
}

// ── Search bar ────────────────────────────────────────────────────────────────
function renderSearchBar(table) {
    const bar = document.getElementById('searchBar');
    if (!bar) return;

    const filterDefs = FILTER_CONFIG[table] || [];

    const filterControls = filterDefs.map(f => {
        const val = S.filters[f.key] || '';

        if (f.type === 'multiselect') {
            const selected = val ? val.split(',').filter(Boolean) : [];
            const chipHtml = selected.length
                ? selected.map(v => `<span class="adm-ms-chip">${escHtml(v)}</span>`).join('')
                : `<span class="adm-ms-ph">${escHtml(f.placeholder || 'All')}</span>`;
            return `<div class="adm-ms" data-filter="${f.key}" data-source="${f.source}" data-ph="${escHtml(f.placeholder || 'All')}">
                <button type="button" class="adm-ms-trigger">${chipHtml}<span class="adm-ms-arrow">▾</span></button>
                <div class="adm-ms-dropdown" hidden>
                    <input type="text" class="adm-ms-search" placeholder="Search…">
                    <div class="adm-ms-list"><span class="adm-ms-loading">Loading…</span></div>
                </div>
            </div>`;
        }

        if (f.type === 'select') {
            const opts = f.options.map((o, i) =>
                `<option value="${o}" ${val === o ? 'selected' : ''}>${f.labels?.[i] ?? o}</option>`
            ).join('');
            return `<select class="adm-filter-input adm-filter-select" data-filter="${f.key}">${opts}</select>`;
        }

        const label = f.label ? `<span class="adm-filter-label">${escHtml(f.label)}</span>` : '';
        const extra = f.step ? `step="${f.step}"` : '';
        const minAttr = f.min !== undefined ? `min="${f.min}"` : '';
        return `${label}<input type="${f.type}" class="adm-filter-input" data-filter="${f.key}"
            value="${escHtml(val)}" placeholder="${f.placeholder ? escHtml(f.placeholder) : ''}"
            ${extra} ${minAttr}>`;
    }).join('');

    bar.innerHTML = `
        <div class="adm-search-row">
            <div class="adm-search-wrap">
                <span class="adm-search-icon">🔍</span>
                <input type="text" class="adm-search-input" id="searchInput" placeholder="Search…" value="${escHtml(S.search)}">
            </div>
            <span class="adm-row-count" id="rowCount">${S.total} rows</span>
        </div>
        ${filterControls ? `<div class="adm-filter-row">${filterControls}</div>` : ''}
    `;

    let searchTimer;
    document.getElementById('searchInput').addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            S.search = e.target.value.trim();
            S.page = 1;
            loadTable(S.activeTable);
        }, 280);
    });

    // Plain select / text / date / number filters
    bar.querySelectorAll('[data-filter]:not(.adm-ms [data-filter])').forEach(el => {
        const event = el.tagName === 'SELECT' ? 'change' : 'input';
        let t;
        el.addEventListener(event, e => {
            clearTimeout(t);
            t = setTimeout(() => {
                S.filters[el.dataset.filter] = e.target.value.trim();
                S.page = 1;
                loadTable(S.activeTable);
            }, event === 'change' ? 0 : 400);
        });
    });

    // Multi-select dropdowns
    bar.querySelectorAll('.adm-ms').forEach(el => initMultiSelect(el));
}

function initMultiSelect(msEl) {
    const filterKey  = msEl.dataset.filter;
    const source     = msEl.dataset.source;
    const ph         = msEl.dataset.ph || 'All';
    const trigger    = msEl.querySelector('.adm-ms-trigger');
    const dropdown   = msEl.querySelector('.adm-ms-dropdown');
    const searchInp  = msEl.querySelector('.adm-ms-search');
    const listEl     = msEl.querySelector('.adm-ms-list');

    function getSelected() {
        return new Set((S.filters[filterKey] || '').split(',').filter(Boolean));
    }

    function refreshTrigger() {
        const sel = getSelected();
        const arrow = '<span class="adm-ms-arrow">▾</span>';
        trigger.innerHTML = sel.size
            ? [...sel].map(v => `<span class="adm-ms-chip">${escHtml(v)}</span>`).join('') + arrow
            : `<span class="adm-ms-ph">${escHtml(ph)}</span>${arrow}`;
    }

    function renderList(options, search = '') {
        const filtered = search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;
        const sel = getSelected();
        if (!filtered.length) { listEl.innerHTML = '<div class="adm-ms-empty">No options</div>'; return; }
        listEl.innerHTML = filtered.map(opt => `
            <label class="adm-ms-opt${sel.has(opt) ? ' is-on' : ''}">
                <input type="checkbox" value="${escHtml(opt)}" ${sel.has(opt) ? 'checked' : ''}>
                <span>${escHtml(opt)}</span>
            </label>`).join('');
        listEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
            cb.addEventListener('change', () => {
                const s = getSelected();
                cb.checked ? s.add(cb.value) : s.delete(cb.value);
                S.filters[filterKey] = [...s].join(',');
                cb.closest('.adm-ms-opt').classList.toggle('is-on', cb.checked);
                refreshTrigger();
                S.page = 1;
                loadTable(S.activeTable);
            });
        });
    }

    let allOptions = null;

    trigger.addEventListener('click', async e => {
        e.stopPropagation();
        const wasOpen = !dropdown.hidden;
        document.querySelectorAll('.adm-ms-dropdown:not([hidden])').forEach(d => { d.hidden = true; });
        if (wasOpen) return;
        dropdown.hidden = false;
        searchInp.value = '';
        searchInp.focus();
        if (!allOptions) allOptions = await fetchFilterOptions(source);
        renderList(allOptions, '');
    });

    searchInp.addEventListener('input', e => {
        if (allOptions) renderList(allOptions, e.target.value);
    });

    // Stop dropdown clicks from bubbling to document (which closes everything)
    dropdown.addEventListener('click', e => e.stopPropagation());
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(table, cfg) {
    const thead = document.getElementById('tableHead');
    const tbody = document.getElementById('tableBody');
    if (!thead || !tbody || !cfg) return;

    const cols = cfg.columns;
    const pk = cfg.primaryKey;
    const sortBy = S.sortBy || pk;

    // Header
    const thCells = cols.map(col => {
        const isActive = sortBy === col;
        const arrow = S.sortDir === 'asc' ? '↑' : '↓';
        return `<th class="${isActive ? 'sort-active' : ''}" data-col="${col}">
            ${col}<span class="adm-sort-arrow">${arrow}</span>
        </th>`;
    }).join('');
    thead.innerHTML = `<tr>${thCells}<th>Actions</th></tr>`;

    // Sort click
    thead.querySelectorAll('th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (S.sortBy === col) {
                S.sortDir = S.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                S.sortBy = col;
                S.sortDir = 'desc';
            }
            S.page = 1;
            loadTable(S.activeTable);
        });
    });

    // Body
    if (S.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length + 1}" class="adm-empty">No records found</td></tr>`;
        return;
    }

    tbody.innerHTML = S.rows.map(row => {
        const cells = cols.map(col => {
            const val = row[col];
            if (val === null || val === undefined || val === '') {
                return `<td class="is-null">null</td>`;
            }
            if (col === pk) {
                return `<td class="is-id">${escHtml(String(val))}</td>`;
            }
            if (col === 'role') {
                return `<td><span class="adm-role-badge role-${val}">${escHtml(val)}</span></td>`;
            }
            // Format timestamps nicely
            if (col === 'timestamp' || col === 'created_at' || col === 'last_seen') {
                const d = new Date(val);
                const formatted = isNaN(d) ? val : d.toISOString().replace('T', ' ').slice(0, 16);
                return `<td title="${escHtml(String(val))}">${escHtml(formatted)}</td>`;
            }
            if (col === 'latency') {
                const formatted = formatLatencySeconds(val);
                return `<td title="${escHtml(String(val))}">${escHtml(formatted)}</td>`;
            }
            return `<td title="${escHtml(String(val))}">${escHtml(String(val))}</td>`;
        }).join('');

        return `<tr>
            ${cells}
            <td class="adm-actions">
                <button class="adm-action-btn edit-btn" data-id="${row[pk]}">Edit</button>
                <button class="adm-action-btn del del-btn" data-id="${row[pk]}">Del</button>
            </td>
        </tr>`;
    }).join('');

    // Action button events
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = S.rows.find(r => String(r[cfg.primaryKey]) === String(btn.dataset.id));
            if (row) openEditModal(row, cfg);
        });
    });

    tbody.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteRecord(btn.dataset.id, cfg));
    });
}

// ── Footer / Pagination ──────────────────────────────────────────────────────
function renderFooter() {
    const footer = document.getElementById('tableFooter');
    if (!footer) return;

    const total    = S.total;
    const start    = (S.page - 1) * S.pageSize + 1;
    const end      = Math.min(S.page * S.pageSize, total);
    const totalPages = Math.max(1, Math.ceil(total / S.pageSize));

    // Build page buttons: always show first, last, and neighbors of current
    const pages = buildPageList(S.page, totalPages);

    footer.innerHTML = `
        <span class="adm-showing">Showing ${total > 0 ? start + '–' + end : 0} of ${total}</span>
        <button class="adm-download-btn" id="downloadCsvBtn" title="Download CSV">↓</button>
        <div class="adm-pagination" id="pagination">
            <button class="adm-page-btn" id="prevPage" ${S.page <= 1 ? 'disabled' : ''}>‹</button>
            ${pages.map(p =>
                p === '...'
                    ? `<button class="adm-page-btn" disabled>…</button>`
                    : `<button class="adm-page-btn ${p === S.page ? 'is-active' : ''}" data-page="${p}">${p}</button>`
            ).join('')}
            <button class="adm-page-btn" id="nextPage" ${S.page >= totalPages ? 'disabled' : ''}>›</button>
        </div>
    `;

    document.getElementById('prevPage')?.addEventListener('click', () => changePage(S.page - 1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(S.page + 1));
    footer.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => changePage(parseInt(btn.dataset.page, 10)));
    });
    document.getElementById('downloadCsvBtn')?.addEventListener('click', downloadCsv);
}

function buildPageList(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
    const result = [];
    let prev = null;
    for (const p of sorted) {
        if (prev !== null && p - prev > 1) result.push('...');
        result.push(p);
        prev = p;
    }
    return result;
}

function changePage(page) {
    const totalPages = Math.ceil(S.total / S.pageSize);
    if (page < 1 || page > totalPages) return;
    S.page = page;
    loadTable(S.activeTable);
}

// ── Download CSV ──────────────────────────────────────────────────────────────
function downloadCsv() {
    if (!S.rows.length) return;
    const cfg = S.tables.find(t => t.name === S.activeTable);
    if (!cfg) return;
    const cols = cfg.columns;
    const header = cols.join(',');
    const rows = S.rows.map(row =>
        cols.map(col => {
            const v = row[col];
            if (v === null || v === undefined) return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${S.activeTable}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openNewModal() {
    if (!S.activeTable) return;
    const cfg = S.tables.find(t => t.name === S.activeTable);
    S.editRow = null;
    document.getElementById('modalTitle').textContent = `New ${S.activeTable} record`;
    renderModalForm(cfg, null);
    document.getElementById('editModal').hidden = false;
}

function openEditModal(row, cfg) {
    S.editRow = row;
    document.getElementById('modalTitle').textContent = `Edit ${S.activeTable} #${row[cfg.primaryKey]}`;
    renderModalForm(cfg, row);
    document.getElementById('editModal').hidden = false;
}

function closeModal() {
    document.getElementById('editModal').hidden = true;
    S.editRow = undefined;
}

function renderModalForm(cfg, row) {
    const body = document.getElementById('modalBody');
    const fields = TABLE_FIELDS[S.activeTable] || cfg?.writable || [];

    body.innerHTML = fields.map(field => {
        const currentVal = row ? (row[field] ?? '') : '';
        const isPassword = field === 'password';

        if (SELECT_FIELDS[field]) {
            const options = SELECT_FIELDS[field].map(opt =>
                `<option value="${opt}" ${currentVal === opt ? 'selected' : ''}>${opt}</option>`
            ).join('');
            return `<div class="adm-field">
                <label for="field_${field}">${field}</label>
                <select id="field_${field}" name="${field}">${options}</select>
            </div>`;
        }

        const hint = isPassword && row
            ? `<span class="adm-field-hint">Leave blank to keep current password</span>`
            : '';

        return `<div class="adm-field">
            <label for="field_${field}">${field}${isPassword && row ? ' (new password)' : ''}</label>
            <input
                type="${isPassword ? 'password' : 'text'}"
                id="field_${field}"
                name="${field}"
                value="${isPassword ? '' : escHtml(String(currentVal))}"
                placeholder="${isPassword ? 'Enter new password…' : field}"
            >
            ${hint}
        </div>`;
    }).join('');
}

// ── Save record ────────────────────────────────────────────────────────────────
async function saveRecord() {
    const cfg = S.tables.find(t => t.name === S.activeTable);
    if (!cfg) return;

    const fields = TABLE_FIELDS[S.activeTable] || cfg.writable;
    const payload = {};

    for (const field of fields) {
        const el = document.getElementById(`field_${field}`);
        if (!el) continue;
        const val = el.value.trim();
        if (field === 'password' && !val) continue; // skip empty password on edit
        if (val !== '') payload[field] = val;
    }

    let data;
    if (S.editRow === null) {
        // New record
        data = await api('POST', `/tables/${S.activeTable}`, payload);
    } else {
        // Edit existing
        const pk = cfg.primaryKey;
        data = await api('PUT', `/tables/${S.activeTable}/${S.editRow[pk]}`, payload);
    }

    if (!data) return;
    if (!data.success) {
        toast(data.error || data.message || 'Save failed', 'error');
        return;
    }

    toast(S.editRow === null ? 'Record created' : 'Record updated', 'success');
    closeModal();
    loadTable(S.activeTable);
}

// ── Delete record ──────────────────────────────────────────────────────────────
async function deleteRecord(id, cfg) {
    const table = S.activeTable;
    if (!confirm(`Delete ${table} #${id}?\n\nThis action cannot be undone.`)) return;

    const data = await api('DELETE', `/tables/${table}/${id}`);
    if (!data) return;
    if (!data.success) {
        toast(data.error || 'Delete failed', 'error');
        return;
    }
    toast('Record deleted', 'success');
    loadTable(table);
}

// ── API key toggle ─────────────────────────────────────────────────────────────
function setupApiKeyToggle() {
    const dotsEl = document.getElementById('apiKeyDots');
    const btn    = document.getElementById('showApiKeyBtn');
    let revealed = false;

    // Fetch from env (not exposed to client) — just show the dots / toggle hint
    btn.addEventListener('click', async () => {
        if (revealed) {
            dotsEl.textContent = '••••••••••';
            btn.textContent = 'Show';
            revealed = false;
        } else {
            // The API key is server-side only; just show a hint
            try {
                const r = await fetch('/api/admin/tables', { credentials: 'include' });
                if (r.ok) {
                    dotsEl.textContent = '(set in env)';
                    btn.textContent = 'Hide';
                    revealed = true;
                }
            } catch (_) {}
        }
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg, type = '') {
    const existing = document.querySelector('.adm-toast');
    if (existing) existing.remove();
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.className = `adm-toast${type ? ' is-' + type : ''}`;
    el.textContent = msg;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 3000);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
