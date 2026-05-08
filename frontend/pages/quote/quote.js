// Quote flow — 4-step booking

// ── State ─────────────────────────────────────────────────────────────────────

const DEVICES = ['lora', 'satellite', 'repeater', 'camera'];

const DEVICE_LABELS = {
    lora:      'LoRa tracking collar',
    satellite: 'Hybrid satellite collar',
    repeater:  'LoRa repeater',
    camera:    'AI camera trap',
};

const BASE_PRICES = { lora: 256, satellite: 380, repeater: 890, camera: 320 };

const QTY_DISCOUNTS = [
    { qty: 1,   discount: 0,    label: 'No discount' },
    { qty: 5,   discount: 0.01, label: '1% off' },
    { qty: 10,  discount: 0.02, label: '2% off' },
    { qty: 25,  discount: 0.03, label: '3% off' },
    { qty: 50,  discount: 0.04, label: '4% off' },
    { qty: 100, discount: 0.05, label: '5% off' },
];

const state = {
    step: 1,
    selected: new Set(),
    activeSpecDevice: null,
    specs: {
        lora:      { battery: 3000, gps: 12, tx: 12, neck: 45, width: 30, material: 'nylon', dropoff: false, qty: 1, species: '' },
        satellite: { battery: 3000, gps: 12, tx: 12, neck: 45, width: 30, material: 'nylon', dropoff: false, qty: 1, country: '', species: '' },
        repeater:  { count: 1, mounting: 'pole', species: '' },
        camera:    { count: 1, battery_target: '6', night_vision: 'colour', trigger: 'medium', storage: 'cloud', transmission: true, ai_species: true, ai_human: false, ai_tamper: true, ai_gunshot: false, species: '' },
    },
};

// ── Step navigation ───────────────────────────────────────────────────────────

function goToStep(n) {
    const panels = [null, 'step1','step2','step3','step4'];
    panels.slice(1).forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.style.display = (i + 1 === n) ? '' : 'none';
    });

    state.step = n;
    updateStepIndicator(n);

    if (n === 2) buildSpecTabs();
    if (n === 3) buildReviewCards();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicator(active) {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`si-${i}`);
        if (!el) continue;
        el.classList.remove('q-step--active', 'q-step--done');
        if (i < active) el.classList.add('q-step--done');
        else if (i === active) el.classList.add('q-step--active');
    }
}

// ── Step 1: device selection ──────────────────────────────────────────────────

function toggleDevice(device) {
    if (state.selected.has(device)) {
        state.selected.delete(device);
        document.getElementById(`card-${device}`).classList.remove('q-device-card--selected');
    } else {
        state.selected.add(device);
        document.getElementById(`card-${device}`).classList.add('q-device-card--selected');
    }
    updateSelectionCount();
}

function updateSelectionCount() {
    const n = state.selected.size;
    document.getElementById('selectionCount').textContent =
        n === 0 ? '0 products selected' : `${n} product${n > 1 ? 's' : ''} selected`;
    document.getElementById('step1Next').disabled = n === 0;
}

// ── Step 2: spec tabs ─────────────────────────────────────────────────────────

function buildSpecTabs() {
    const devices = DEVICES.filter(d => state.selected.has(d));
    const tabsEl   = document.getElementById('specTabs');
    const tabNavEl = document.getElementById('specTabNav');

    if (devices.length <= 1) {
        tabsEl.style.display = 'none';
        tabNavEl.innerHTML = '';
    } else {
        tabsEl.style.display = 'flex';
        tabsEl.innerHTML = devices.map(d =>
            `<button class="q-spec-tab" id="tab-${d}" onclick="switchSpecTab('${d}')">${DEVICE_LABELS[d]}</button>`
        ).join('');

        tabNavEl.innerHTML = devices.map((d, i) =>
            `<button class="q-tab-dot" id="dot-${d}" onclick="switchSpecTab('${d}')" title="${DEVICE_LABELS[d]}"></button>`
        ).join('');
    }

    // Show first device's panel
    const first = devices[0];
    state.activeSpecDevice = first;
    devices.forEach(d => {
        document.getElementById(`spec-${d}`).style.display = d === first ? '' : 'none';
    });

    activateTab(first);

    // Init all spec UIs
    updateLora();
    updateSat();
    updateRep();
    updateCam();
}

function switchSpecTab(device) {
    const devices = DEVICES.filter(d => state.selected.has(d));
    devices.forEach(d => {
        document.getElementById(`spec-${d}`).style.display = d === device ? '' : 'none';
    });
    state.activeSpecDevice = device;
    activateTab(device);
}

function activateTab(device) {
    DEVICES.forEach(d => {
        const tab = document.getElementById(`tab-${d}`);
        const dot = document.getElementById(`dot-${d}`);
        if (tab) tab.classList.toggle('q-spec-tab--active', d === device);
        if (dot) dot.classList.toggle('q-tab-dot--active', d === device);
    });
}

function nextSpecOrReview() {
    // If multiple devices, step through them before going to step 3
    const devices = DEVICES.filter(d => state.selected.has(d));
    if (devices.length > 1) {
        const idx = devices.indexOf(state.activeSpecDevice);
        if (idx < devices.length - 1) {
            switchSpecTab(devices[idx + 1]);
            return;
        }
    }
    goToStep(3);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function setToggle(groupId, val, callback) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.q-toggle').forEach(btn => {
        btn.classList.toggle('q-toggle--active', btn.dataset.val === val);
    });
    if (callback) callback();
}

function getToggleVal(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return null;
    const active = group.querySelector('.q-toggle--active');
    return active ? active.dataset.val : null;
}

function setQty(device, qty) {
    const grid = document.getElementById(`${device}-qty`);
    if (!grid) return;
    grid.querySelectorAll('.q-qty-btn').forEach(btn => {
        btn.classList.toggle('q-qty-btn--active', parseInt(btn.dataset.qty) === qty);
    });
    if (device === 'lora') { state.specs.lora.qty = qty; updateLora(); }
    if (device === 'sat')  { state.specs.satellite.qty = qty; updateSat(); }
}

function configRow(k, v, greenV = false) {
    return `<div class="q-config-row">
        <span class="q-config-row-k">${k}</span>
        <span class="q-config-row-v${greenV ? ' q-config-row-v--green' : ''}">${v}</span>
    </div>`;
}

function calcCollarPrice(base, dropoff, material, qty) {
    let unit = base + (dropoff ? 40 : 0) + (material === 'biothane' ? 30 : 0);
    const disc = QTY_DISCOUNTS.slice().reverse().find(d => qty >= d.qty) || QTY_DISCOUNTS[0];
    const total = unit * qty * (1 - disc.discount);
    return { unit, total, discount: disc.discount };
}

function calcBatteryLife(battery, gps, tx) {
    // Calibrated: 3000 mAh, 12 GPS/day, 12 TX/day ≈ 32 months
    const months = Math.round(32 * (battery / 3000) * Math.sqrt(12 / Math.max(gps, 1)) * Math.sqrt(12 / Math.max(tx, 1)));
    return Math.max(1, months);
}

function calcWeight(neck, width, material) {
    const base = 85 + (neck - 25) * 0.5 + (width - 15) * 1.5;
    return Math.round(base + (material === 'biothane' ? 20 : 0));
}

function fmtUsd(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
}

// ── LoRa collar ───────────────────────────────────────────────────────────────

function updateLora() {
    const s = state.specs.lora;
    s.battery   = parseInt(document.getElementById('lora-battery').value);
    s.gps       = parseInt(document.getElementById('lora-gps').value);
    s.tx        = parseInt(document.getElementById('lora-tx').value);
    s.neck      = parseInt(document.getElementById('lora-neck').value);
    s.width     = parseInt(document.getElementById('lora-width').value);
    s.material  = getToggleVal('lora-material') || 'nylon';
    s.dropoff   = document.getElementById('lora-dropoff').checked;
    s.species   = document.getElementById('lora-species').value;

    document.getElementById('lora-battery-val').textContent = `${s.battery} mAh`;
    document.getElementById('lora-gps-val').textContent     = `${s.gps} /day`;
    document.getElementById('lora-tx-val').textContent      = `${s.tx} /day`;
    document.getElementById('lora-neck-val').textContent    = `${s.neck} cm`;
    document.getElementById('lora-width-val').textContent   = `${s.width} mm`;

    const months = calcBatteryLife(s.battery, s.gps, s.tx);
    document.getElementById('lora-battery-life').textContent = months;

    const { unit, total, discount } = calcCollarPrice(BASE_PRICES.lora, s.dropoff, s.material, s.qty);
    document.getElementById('lora-total').textContent        = fmtUsd(total);
    const discLabel = discount > 0 ? ` · ${Math.round(discount*100)}% off` : '';
    document.getElementById('lora-price-detail').textContent = `${fmtUsd(unit)} per unit × ${s.qty}${discLabel}`;

    const weight = calcWeight(s.neck, s.width, s.material);
    document.getElementById('lora-config-rows').innerHTML = [
        configRow('Battery', `${s.battery} mAh`),
        configRow('GPS fixes', `${s.gps} / day`),
        configRow('LoRa TX', `${s.tx} / day`),
        configRow('Material', s.material === 'nylon' ? 'Nylon + neoprene' : 'Biothane'),
        configRow('Neck circ.', `${s.neck} cm`),
        configRow('Est. weight', `${weight} g (est.)`),
        configRow('Drop-off', s.dropoff ? 'Yes' : 'No'),
        configRow('Quantity', `${s.qty} unit${s.qty > 1 ? 's' : ''}`),
        configRow('Est. battery life', `${months} months`, true),
    ].join('');
}

// ── Satellite collar ──────────────────────────────────────────────────────────

function updateSat() {
    const s = state.specs.satellite;
    s.battery   = parseInt(document.getElementById('sat-battery').value);
    s.gps       = parseInt(document.getElementById('sat-gps').value);
    s.tx        = parseInt(document.getElementById('sat-tx').value);
    s.neck      = parseInt(document.getElementById('sat-neck').value);
    s.width     = parseInt(document.getElementById('sat-width').value);
    s.material  = getToggleVal('sat-material') || 'nylon';
    s.dropoff   = document.getElementById('sat-dropoff').checked;
    s.country   = document.getElementById('sat-country').value;
    s.species   = document.getElementById('sat-species').value;

    document.getElementById('sat-battery-val').textContent = `${s.battery} mAh`;
    document.getElementById('sat-gps-val').textContent     = `${s.gps} /day`;
    document.getElementById('sat-tx-val').textContent      = `${s.tx} /day`;
    document.getElementById('sat-neck-val').textContent    = `${s.neck} cm`;
    document.getElementById('sat-width-val').textContent   = `${s.width} mm`;

    // Satellite TX is more power-hungry, multiply effective TX by 3
    const months = calcBatteryLife(s.battery, s.gps, s.tx * 3);
    document.getElementById('sat-battery-life').textContent = months;

    const { unit, total, discount } = calcCollarPrice(BASE_PRICES.satellite, s.dropoff, s.material, s.qty);
    document.getElementById('sat-total').textContent        = fmtUsd(total);
    const discLabel = discount > 0 ? ` · ${Math.round(discount*100)}% off` : '';
    document.getElementById('sat-price-detail').textContent = `${fmtUsd(unit)} per unit × ${s.qty}${discLabel}`;

    const weight = calcWeight(s.neck, s.width, s.material);
    document.getElementById('sat-config-rows').innerHTML = [
        configRow('Battery', `${s.battery} mAh`),
        configRow('GPS fixes', `${s.gps} / day`),
        configRow('TX / day', `${s.tx} / day`),
        configRow('Material', s.material === 'nylon' ? 'Nylon + neoprene' : 'Biothane'),
        configRow('Neck circ.', `${s.neck} cm`),
        configRow('Est. weight', `${weight} g (est.)`),
        configRow('Drop-off', s.dropoff ? 'Yes' : 'No'),
        configRow('Country', s.country || '—'),
        configRow('Quantity', `${s.qty} unit${s.qty > 1 ? 's' : ''}`),
        configRow('Est. battery life', `${months} months`, true),
    ].join('');
}

// ── Repeater ──────────────────────────────────────────────────────────────────

function updateRep() {
    const s = state.specs.repeater;
    s.count    = parseInt(document.getElementById('rep-count').value) || 1;
    s.mounting = getToggleVal('rep-mounting') || 'pole';
    s.species  = document.getElementById('rep-species').value;
}

// ── Camera ────────────────────────────────────────────────────────────────────

function updateCam() {
    const s = state.specs.camera;
    s.count         = parseInt(document.getElementById('cam-count').value) || 1;
    s.battery_target= getToggleVal('cam-battery') || '6';
    s.night_vision  = getToggleVal('cam-nightvision') || 'colour';
    s.trigger       = getToggleVal('cam-trigger') || 'medium';
    s.storage       = getToggleVal('cam-storage') || 'cloud';
    s.transmission  = document.getElementById('cam-transmission').checked;
    s.ai_species    = document.getElementById('cam-ai-species').checked;
    s.ai_human      = document.getElementById('cam-ai-human').checked;
    s.ai_tamper     = document.getElementById('cam-ai-tamper').checked;
    s.ai_gunshot    = document.getElementById('cam-ai-gunshot').checked;
    s.species       = document.getElementById('cam-species').value;
}

// ── Step 3: review cards ──────────────────────────────────────────────────────

function buildReviewCards() {
    const container = document.getElementById('reviewCards');
    const devices = DEVICES.filter(d => state.selected.has(d));
    container.innerHTML = devices.map(d => reviewCardHtml(d)).join('');
}

function reviewCardHtml(device) {
    let rows = '';
    let qtyBadge = '';

    if (device === 'lora') {
        const s = state.specs.lora;
        const months = calcBatteryLife(s.battery, s.gps, s.tx);
        qtyBadge = `×${s.qty}`;
        rows = [
            rr('Battery', `${s.battery} mAh`),
            rr('GPS fixes/day', s.gps),
            rr('TX/day', s.tx),
            rr('Material', s.material === 'nylon' ? 'Nylon + neoprene' : 'Biothane'),
            rr('Neck circ.', `${s.neck} cm`),
            rr('Drop-off', s.dropoff ? 'Yes' : 'No'),
            rrGreen('Est. battery life', `${months} months`),
            s.species ? rr('Species', s.species) : '',
        ].join('');
    } else if (device === 'satellite') {
        const s = state.specs.satellite;
        const months = calcBatteryLife(s.battery, s.gps, s.tx * 3);
        qtyBadge = `×${s.qty}`;
        rows = [
            rr('Battery', `${s.battery} mAh`),
            rr('GPS fixes/day', s.gps),
            rr('TX/day', s.tx),
            rr('Material', s.material === 'nylon' ? 'Nylon + neoprene' : 'Biothane'),
            rr('Neck circ.', `${s.neck} cm`),
            rr('Drop-off', s.dropoff ? 'Yes' : 'No'),
            s.country ? rr('Country', s.country) : '',
            rrGreen('Est. battery life', `${months} months`),
            s.species ? rr('Species', s.species) : '',
        ].join('');
    } else if (device === 'repeater') {
        const s = state.specs.repeater;
        qtyBadge = `×${s.count}`;
        rows = [
            rr('Mounting', s.mounting.charAt(0).toUpperCase() + s.mounting.slice(1)),
            s.species ? rr('Use case', s.species) : '',
        ].join('');
    } else if (device === 'camera') {
        const s = state.specs.camera;
        qtyBadge = `×${s.count}`;
        const aiList = [
            s.ai_species  ? 'Species counting' : '',
            s.ai_human    ? 'Intrusion alerts' : '',
            s.ai_tamper   ? 'Tamper detection' : '',
            s.ai_gunshot  ? 'Gunshot detection' : '',
        ].filter(Boolean);
        rows = [
            rr('Battery target', `${s.battery_target} months`),
            rr('Night vision', s.night_vision === 'ir' ? 'IR only' : 'Colour night'),
            rr('Trigger', s.trigger.charAt(0).toUpperCase() + s.trigger.slice(1)),
            rr('Storage', s.storage === 'cloud' ? 'SD + cloud sync' : 'SD card only'),
            rr('Image TX', s.transmission ? 'Yes' : 'No'),
            aiList.length ? rr('AI features', aiList.join(', ')) : '',
            s.species ? rr('Species', s.species) : '',
        ].join('');
    }

    return `<div class="q-review-card">
        <div class="q-review-card-header">
            <span class="q-review-card-name">${DEVICE_LABELS[device]}</span>
            <span class="q-review-qty-badge">${qtyBadge}</span>
        </div>
        <div class="q-review-rows">${rows}</div>
    </div>`;
}

function rr(k, v) {
    return `<div class="q-review-row"><span class="q-review-row-k">${k}</span><span class="q-review-row-v">${v}</span></div>`;
}
function rrGreen(k, v) {
    return `<div class="q-review-row"><span class="q-review-row-k">${k}</span><span class="q-review-row-v q-review-row-v--green">${v}</span></div>`;
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function handleSubmit() {
    const first   = document.getElementById('cf-first').value.trim();
    const last    = document.getElementById('cf-last').value.trim();
    const org     = document.getElementById('cf-org').value.trim();
    const email   = document.getElementById('cf-email').value.trim();
    const country = document.getElementById('cf-country').value.trim();
    const timeline= document.getElementById('cf-timeline').value;
    const notes   = document.getElementById('cf-notes').value.trim();

    const errEl = document.getElementById('submitError');
    errEl.style.display = 'none';

    if (!first || !last || !org || !email) {
        errEl.textContent = 'Please fill in all required fields.';
        errEl.style.display = '';
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.style.display = '';
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

    const devices = DEVICES.filter(d => state.selected.has(d));
    const payload = {
        contact: { first, last, org, email, country, timeline, notes },
        devices,
        specs: state.specs,
    };

    try {
        const res = await fetch('/api/quote/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Submission failed');
        goToStep(4);
    } catch (err) {
        errEl.textContent = err.message || 'Something went wrong. Please try again.';
        errEl.style.display = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Submit quote request <i class="fas fa-arrow-right"></i>';
    }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetQuote() {
    state.selected.clear();
    state.activeSpecDevice = null;
    DEVICES.forEach(d => {
        document.getElementById(`card-${d}`)?.classList.remove('q-device-card--selected');
    });
    // Reset specs to defaults
    state.specs.lora      = { battery:3000, gps:12, tx:12, neck:45, width:30, material:'nylon', dropoff:false, qty:1, species:'' };
    state.specs.satellite = { battery:3000, gps:12, tx:12, neck:45, width:30, material:'nylon', dropoff:false, qty:1, country:'', species:'' };
    state.specs.repeater  = { count:1, mounting:'pole', species:'' };
    state.specs.camera    = { count:1, battery_target:'6', night_vision:'colour', trigger:'medium', storage:'cloud', transmission:true, ai_species:true, ai_human:false, ai_tamper:true, ai_gunshot:false, species:'' };
    updateSelectionCount();
    goToStep(1);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    updateSelectionCount();
    goToStep(1);
});
