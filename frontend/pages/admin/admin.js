const state = {
    apiKey: '',
    tables: [],
    tableConfigs: {},
    selectedTable: '',
    rows: [],
};

const elements = {
    apiKeyInput: document.querySelector('#apiKeyInput'),
    toggleApiKey: document.querySelector('#toggleApiKey'),
    setApiKey: document.querySelector('#setApiKey'),
    apiKeyStatus: document.querySelector('#apiKeyStatus'),
    tableSelect: document.querySelector('#tableSelect'),
    refreshTable: document.querySelector('#refreshTable'),
    createRow: document.querySelector('#createRow'),
    feedback: document.querySelector('#feedback'),
    tableMeta: document.querySelector('#tableMeta'),
    tableHead: document.querySelector('#dataTable thead'),
    tableBody: document.querySelector('#dataTable tbody'),
};

function showFeedback(message, type = 'info') {
    elements.feedback.textContent = message;
    elements.feedback.classList.remove('error', 'success');
    if (type === 'error') {
        elements.feedback.classList.add('error');
    } else if (type === 'success') {
        elements.feedback.classList.add('success');
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
    };
}

function loadApiKeyFromStorage() {
    const stored = localStorage.getItem('custodiaAdminApiKey');
    if (stored) {
        state.apiKey = stored;
        elements.apiKeyInput.value = stored;
        updateApiKeyStatus(true);
        fetchTables();
    }
}

function updateApiKeyStatus(isSet) {
    if (isSet) {
        elements.apiKeyStatus.textContent = 'Key loaded';
        elements.apiKeyStatus.classList.add('success');
    } else {
        elements.apiKeyStatus.textContent = 'Not set';
        elements.apiKeyStatus.classList.remove('success');
    }
}

async function fetchTables() {
    if (!state.apiKey) {
        showFeedback('Enter an admin API key to begin.');
        return;
    }

    try {
        showFeedback('Loading tables...');
        const response = await fetch('/api/admin/tables', {
            headers: getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        state.tables = payload.tables.map((table) => table.name);
        state.tableConfigs = payload.tables.reduce((acc, table) => {
            acc[table.name] = table;
            return acc;
        }, {});

        renderTableSelect();
        showFeedback('Tables loaded.', 'success');
    } catch (error) {
        console.error('Failed to fetch tables', error);
        showFeedback(`Failed to load tables: ${error.message}`, 'error');
    }
}

function renderTableSelect() {
    elements.tableSelect.innerHTML = '<option value="">Select a table...</option>';
    state.tables.forEach((table) => {
        const option = document.createElement('option');
        option.value = table;
        option.textContent = table;
        elements.tableSelect.appendChild(option);
    });
    elements.tableSelect.disabled = state.tables.length === 0;
    elements.createRow.disabled = !state.selectedTable;
    elements.refreshTable.disabled = !state.selectedTable;
}

function renderTableMeta() {
    if (!state.selectedTable) {
        elements.tableMeta.textContent = '';
        return;
    }
    const config = state.tableConfigs[state.selectedTable];
    elements.tableMeta.textContent = `Columns: ${config.columns.join(', ')} | Writable: ${config.writable.join(', ')} | Primary key: ${config.primaryKey}`;
}

function renderTable() {
    elements.tableHead.innerHTML = '';
    elements.tableBody.innerHTML = '';

    if (!state.selectedTable) {
        return;
    }

    const config = state.tableConfigs[state.selectedTable];
    const headerRow = document.createElement('tr');
    config.columns.forEach((column) => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    const actionsTh = document.createElement('th');
    actionsTh.textContent = 'Actions';
    headerRow.appendChild(actionsTh);
    elements.tableHead.appendChild(headerRow);

    if (state.rows.length === 0) {
        const emptyRow = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = config.columns.length + 1;
        td.textContent = 'No rows found.';
        td.style.textAlign = 'center';
        emptyRow.appendChild(td);
        elements.tableBody.appendChild(emptyRow);
        return;
    }

    // Helper function to format dates
    function formatDate(value) {
        if (!value) return '';
        
        // Try to parse as Date
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            // If not a valid date, return as-is
            return value;
        }
        
        // Format as yyyy-mm-dd hh:mm am/pm
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const formattedHours = String(hours).padStart(2, '0');
        
        return `${year}-${month}-${day} ${formattedHours}:${minutes} ${ampm}`;
    }
    
    // Identify date/timestamp columns (common patterns)
    const dateColumns = config.columns.filter(col => 
        col.toLowerCase().includes('timestamp') || 
        col.toLowerCase().includes('time') ||
        col.toLowerCase().includes('date') ||
        col.toLowerCase().includes('created_at') ||
        col.toLowerCase().includes('updated_at') ||
        col.toLowerCase().includes('last_seen')
    );

    state.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.dataset.rowId = row[config.primaryKey];
        config.columns.forEach((column) => {
            const td = document.createElement('td');
            const value = row[column];
            
            // Format if it's a date column
            if (value !== null && value !== undefined && dateColumns.includes(column)) {
                td.textContent = formatDate(value);
            } else {
                td.textContent = value === null || value === undefined ? '' : value;
            }
            
            tr.appendChild(td);
        });
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `
            <button class="btn-link edit-row" data-action="edit">Edit</button>
            <button class="btn-link delete-row" data-action="delete">Delete</button>
        `;
        tr.appendChild(actionsTd);
        elements.tableBody.appendChild(tr);
    });
}

async function loadTableData(tableName) {
    if (!tableName) {
        state.selectedTable = '';
        state.rows = [];
        renderTable();
        renderTableMeta();
        return;
    }

    state.selectedTable = tableName;
    renderTableMeta();

    try {
        showFeedback(`Loading ${tableName}...`);
        const response = await fetch(`/api/admin/tables/${tableName}?limit=200`, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        state.rows = payload.rows;
        renderTable();
        elements.createRow.disabled = false;
        elements.refreshTable.disabled = false;
        showFeedback(`Loaded ${payload.count} rows from ${tableName}.`, 'success');
    } catch (error) {
        console.error(`Failed to load table ${tableName}`, error);
        showFeedback(`Failed to load ${tableName}: ${error.message}`, 'error');
    }
}

function promptForJson(initialValue, title) {
    const input = prompt(title, initialValue);
    if (input === null) {
        return null;
    }
    try {
        return JSON.parse(input);
    } catch (error) {
        alert('Invalid JSON. Please try again.');
        return null;
    }
}

async function createRow() {
    if (!state.selectedTable) {
        return;
    }
    const config = state.tableConfigs[state.selectedTable];
    const templateObject = config.writable.reduce((acc, key) => {
        acc[key] = '';
        return acc;
    }, {});

    const payload = promptForJson(JSON.stringify(templateObject, null, 2), `New row for ${state.selectedTable}`);
    if (!payload) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/tables/${state.selectedTable}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || result.error || 'Unknown error');
        }

        showFeedback('Row created successfully.', 'success');
        loadTableData(state.selectedTable);
    } catch (error) {
        console.error('Failed to create row', error);
        showFeedback(`Failed to create row: ${error.message}`, 'error');
    }
}

async function editRow(rowId) {
    const config = state.tableConfigs[state.selectedTable];
    const row = state.rows.find((item) => String(item[config.primaryKey]) === rowId);
    if (!row) {
        showFeedback('Row not found.', 'error');
        return;
    }

    const editableData = config.writable.reduce((acc, key) => {
        if (row[key] !== undefined) {
            acc[key] = row[key];
        } else {
            acc[key] = null;
        }
        return acc;
    }, {});

    const payload = promptForJson(JSON.stringify(editableData, null, 2), `Edit row ${rowId}`);
    if (!payload) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/tables/${state.selectedTable}/${rowId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || result.error || 'Unknown error');
        }

        showFeedback('Row updated successfully.', 'success');
        loadTableData(state.selectedTable);
    } catch (error) {
        console.error('Failed to update row', error);
        showFeedback(`Failed to update row: ${error.message}`, 'error');
    }
}

async function deleteRow(rowId) {
    if (!confirm(`Are you sure you want to delete row ${rowId}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/tables/${state.selectedTable}/${rowId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || result.error || 'Unknown error');
        }

        showFeedback('Row deleted successfully.', 'success');
        loadTableData(state.selectedTable);
    } catch (error) {
        console.error('Failed to delete row', error);
        showFeedback(`Failed to delete row: ${error.message}`, 'error');
    }
}

// Event listeners
elements.toggleApiKey.addEventListener('click', () => {
    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.toggleApiKey.textContent = isPassword ? 'Hide' : 'Show';
});

elements.setApiKey.addEventListener('click', () => {
    const key = elements.apiKeyInput.value.trim();
    if (!key) {
        showFeedback('Please provide a valid API key.', 'error');
        state.apiKey = '';
        localStorage.removeItem('custodiaAdminApiKey');
        updateApiKeyStatus(false);
        return;
    }
    state.apiKey = key;
    localStorage.setItem('custodiaAdminApiKey', key);
    updateApiKeyStatus(true);
    fetchTables();
});

elements.tableSelect.addEventListener('change', (event) => {
    const tableName = event.target.value;
    loadTableData(tableName);
});

elements.refreshTable.addEventListener('click', () => {
    if (state.selectedTable) {
        loadTableData(state.selectedTable);
    }
});

elements.createRow.addEventListener('click', () => {
    if (state.selectedTable) {
        createRow();
    }
});

elements.tableBody.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) {
        return;
    }
    const rowElement = actionBtn.closest('tr');
    const rowId = rowElement?.dataset?.rowId;
    if (!rowId) {
        return;
    }

    const action = actionBtn.dataset.action;
    if (action === 'edit') {
        editRow(rowId);
    } else if (action === 'delete') {
        deleteRow(rowId);
    }
});

loadApiKeyFromStorage();

