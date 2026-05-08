// Dashboard JavaScript

// Remove ES6 import - use direct constants instead
// import { API_BASE_URL } from '../../shared/constants.js';
// Auto-detect API base URL (works in both local and production)
const API_BASE_URL = window.location.origin;

// Dashboard state
let map = null;
let animals = [];
let locations = [];
let markers = {};
let polylines = {}; // Store polylines for path visualization
let repeaters = []; // Repeaters with lat/lng for map icons
let repeaterMarkers = []; // Leaflet markers for repeaters (cleared on updateMap)
let repeaterCircles = []; // 7km coverage circles (cleared on updateMap)
let selectedAnimalId = null;
/** When set, the selected location marker is emphasized and all others faded */
let selectedLocation = null; // { lat, lng } or null
let animalColors = {}; // Store color assignments for each animal
let animalLabelsVisible = {}; // Track which animals have labels visible
let detectedTimezone = 'UTC'; // Detected timezone based on location coordinates
let totalDbLocationCount = null; // Total unfiltered location count from database
let allSelectedTrackerIds = new Set(); // When sidebar tracker filter is removed, all trackers are selected

/** Sidebar quick chips: narrow list + map via getFilterSelections() */
let sidebarQuickFilter = { mode: 'all', typeValue: null };

// Edit Tracker Modal state
let currentEditingTracker = null;

// Detail card tab/nav state
let detailCardCurrentTab = 'detail';
let detailCardAnimalId = null;
let _detailCardInited = false;
let _detailLocSorted = [];   // locations newest-first for current animal
let _detailLocCurrentIdx = 0;

// Edit Tracker Modal Functions (defined early so they're available)
window.openEditTrackerModal = async function(trackerSlug) {
    console.log('[openEditTrackerModal] Opening modal for tracker:', trackerSlug);
    const modal = document.getElementById('editTrackerModal');
    if (!modal) {
        console.error('Edit tracker modal not found in DOM');
        console.error('Available elements:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
        alert('Error: Edit modal not found. Please refresh the page.');
        return;
    }
    console.log('[openEditTrackerModal] Modal found:', modal);
    
    currentEditingTracker = trackerSlug;
    modal.style.display = 'block';
    
    // Fetch tracker data
    try {
        const response = await fetch(`/api/trackers/${trackerSlug}`, { credentials: 'include' });
        const data = await response.json();
        
        if (!data.success || !data.tracker) {
            throw new Error('Failed to fetch tracker data');
        }
        
        const tracker = data.tracker;
        
        // Populate form fields
        document.getElementById('editAnimalName').value = tracker.animal_name || '';
        document.getElementById('editTrackerId').value = tracker.id;
        
        // Populate dropdowns with existing values
        populateTypeDropdown(tracker.animal_type);
        populateFamilyDropdown(tracker.family);
        
        // Render management lists (if visible)
        const typesList = document.getElementById('typesList');
        if (typesList && typesList.style.display !== 'none') {
            renderTypesList();
        }
        const familiesList = document.getElementById('familiesList');
        if (familiesList && familiesList.style.display !== 'none') {
            renderFamiliesList();
        }
        
        // Set current values
        if (tracker.animal_type) {
            const typeSelect = document.getElementById('editAnimalType');
            const option = Array.from(typeSelect.options).find(opt => opt.value === tracker.animal_type);
            if (option) {
                typeSelect.value = tracker.animal_type;
                typeSelect.style.display = 'block';
                document.getElementById('editAnimalTypeNew').style.display = 'none';
            } else {
                // Value not in dropdown, show input field
                document.getElementById('editAnimalTypeNew').value = tracker.animal_type;
                document.getElementById('editAnimalType').style.display = 'none';
                document.getElementById('editAnimalTypeNew').style.display = 'block';
            }
        }
        
        if (tracker.family) {
            const familySelect = document.getElementById('editFamily');
            const option = Array.from(familySelect.options).find(opt => opt.value === tracker.family);
            if (option) {
                familySelect.value = tracker.family;
                familySelect.style.display = 'block';
                document.getElementById('editFamilyNew').style.display = 'none';
            } else {
                // Value not in dropdown, show input field
                document.getElementById('editFamilyNew').value = tracker.family;
                document.getElementById('editFamily').style.display = 'none';
                document.getElementById('editFamilyNew').style.display = 'block';
            }
        }
        
    } catch (error) {
        console.error('Error loading tracker data:', error);
        showError('Failed to load tracker data. Please try again.');
        closeEditTrackerModal();
    }
};

function populateTypeDropdown(currentValue = null) {
    const select = document.getElementById('editAnimalType');
    if (!select) return;
    
    // Get all unique animal types from current animals
    const types = new Set();
    animals.forEach(animal => {
        const type = normalizeAttribute(animal.type);
        if (type) {
            types.add(type);
        }
    });
    
    // Clear existing options except first one
    select.innerHTML = '<option value="">Select or type new...</option>';
    
    // Add options
    Array.from(types).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        if (currentValue === type) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function populateFamilyDropdown(currentValue = null) {
    const select = document.getElementById('editFamily');
    if (!select) return;
    
    // Get all unique families from current animals
    const families = new Set();
    animals.forEach(animal => {
        const family = normalizeAttribute(animal.family);
        if (family) {
            families.add(family);
        }
    });
    
    // Clear existing options except first one
    select.innerHTML = '<option value="">Select or type new...</option>';
    
    // Add options
    Array.from(families).sort().forEach(family => {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = family;
        if (currentValue === family) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function closeEditTrackerModal() {
    const modal = document.getElementById('editTrackerModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentEditingTracker = null;
    
    // Reset form
    const form = document.getElementById('editTrackerForm');
    if (form) {
        form.reset();
    }
    
    // Reset dropdown/input toggles
    const typeSelect = document.getElementById('editAnimalType');
    const typeInput = document.getElementById('editAnimalTypeNew');
    const familySelect = document.getElementById('editFamily');
    const familyInput = document.getElementById('editFamilyNew');
    
    if (typeSelect) typeSelect.style.display = 'block';
    if (typeInput) typeInput.style.display = 'none';
    if (familySelect) familySelect.style.display = 'block';
    if (familyInput) familyInput.style.display = 'none';
    
    // Hide manage lists
    const typesList = document.getElementById('typesList');
    const familiesList = document.getElementById('familiesList');
    if (typesList) typesList.style.display = 'none';
    if (familiesList) familiesList.style.display = 'none';
    
    // Reset button text
    const manageTypesBtn = document.getElementById('manageTypesBtn');
    const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
    if (manageTypesBtn) manageTypesBtn.textContent = 'Manage Types';
    if (manageFamiliesBtn) manageFamiliesBtn.textContent = 'Manage Families';
    
    // Reset toggle button text
    const toggleTypeBtn = document.getElementById('toggleTypeNew');
    const toggleFamilyBtn = document.getElementById('toggleFamilyNew');
    if (toggleTypeBtn) toggleTypeBtn.textContent = '+ Add New Type';
    if (toggleFamilyBtn) toggleFamilyBtn.textContent = '+ Add New Family';
}

/**
 * Render types list with edit/delete buttons
 */
function renderTypesList() {
    const typesList = document.getElementById('typesList');
    if (!typesList) return;
    
    // Get all unique types
    const types = new Set();
    animals.forEach(animal => {
        const type = normalizeAttribute(animal.type);
        if (type && type !== 'Unknown') {
            types.add(type);
        }
    });
    
    if (types.size === 0) {
        typesList.innerHTML = '<p class="empty-options">No types available</p>';
        return;
    }
    
    typesList.innerHTML = Array.from(types).sort().map(type => {
        // Count how many trackers use this type
        const trackerCount = animals.filter(a => normalizeAttribute(a.type) === type).length;
        return `
            <div class="option-item" data-type="${escapeHtml(type)}">
                <span class="option-name">${escapeHtml(type)}</span>
                <span class="option-count">(${trackerCount} tracker${trackerCount !== 1 ? 's' : ''})</span>
                <div class="option-actions">
                    <button type="button" class="btn-option-edit" data-type="${escapeHtml(type)}" title="Edit type">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn-option-delete" data-type="${escapeHtml(type)}" title="Delete type">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    typesList.querySelectorAll('.btn-option-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            editType(type);
        });
    });
    
    typesList.querySelectorAll('.btn-option-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            deleteType(type);
        });
    });
}

/**
 * Render families list with edit/delete buttons
 */
function renderFamiliesList() {
    const familiesList = document.getElementById('familiesList');
    if (!familiesList) return;
    
    // Get all unique families
    const families = new Set();
    animals.forEach(animal => {
        const family = normalizeAttribute(animal.family);
        if (family && family !== 'Unknown') {
            families.add(family);
        }
    });
    
    if (families.size === 0) {
        familiesList.innerHTML = '<p class="empty-options">No families available</p>';
        return;
    }
    
    familiesList.innerHTML = Array.from(families).sort().map(family => {
        // Count how many trackers use this family
        const trackerCount = animals.filter(a => normalizeAttribute(a.family) === family).length;
        return `
            <div class="option-item" data-family="${escapeHtml(family)}">
                <span class="option-name">${escapeHtml(family)}</span>
                <span class="option-count">(${trackerCount} tracker${trackerCount !== 1 ? 's' : ''})</span>
                <div class="option-actions">
                    <button type="button" class="btn-option-edit" data-family="${escapeHtml(family)}" title="Edit family">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn-option-delete" data-family="${escapeHtml(family)}" title="Delete family">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    familiesList.querySelectorAll('.btn-option-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const family = btn.dataset.family;
            editFamily(family);
        });
    });
    
    familiesList.querySelectorAll('.btn-option-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const family = btn.dataset.family;
            deleteFamily(family);
        });
    });
}

/**
 * Edit a type (rename it across all trackers)
 */
async function editType(oldType) {
    const newType = prompt(`Edit type "${oldType}":`, oldType);
    if (!newType || newType.trim() === oldType) {
        return;
    }
    
    const normalizedNew = normalizeForDuplicateCheck(newType.trim());
    if (!normalizedNew) {
        showError('Invalid type name');
        return;
    }
    
    // Check for duplicates
    const existingTypes = new Set();
    animals.forEach(animal => {
        if (animal.type) {
            existingTypes.add(normalizeForDuplicateCheck(animal.type));
        }
    });
    
    if (existingTypes.has(normalizedNew) && normalizedNew !== normalizeForDuplicateCheck(oldType)) {
        showError(`Type "${normalizedNew}" already exists`);
        return;
    }
    
    // Confirm action
    const trackerCount = animals.filter(a => normalizeAttribute(a.type) === oldType).length;
    if (!confirm(`Are you sure you want to rename "${oldType}" to "${normalizedNew}"?\n\nThis will affect ${trackerCount} tracker${trackerCount !== 1 ? 's' : ''}.`)) {
        return;
    }
    
    // Update all trackers with this type
    try {
        const updates = animals
            .filter(a => normalizeAttribute(a.type) === oldType)
            .map(a => 
                fetch(`/api/trackers/${a.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        animal_type: normalizedNew,
                        animal_name: a.name,
                        family: a.family || null
                    })
                })
            );
        
        await Promise.all(updates);
        
        showSuccess(`Type renamed from "${oldType}" to "${normalizedNew}"`);
        
        // Reload data and refresh UI
        await loadMockData();
        if (currentEditingTracker) {
            // Refresh modal if open
            await openEditTrackerModal(currentEditingTracker);
        }
        renderTypesList();
        
    } catch (error) {
        console.error('Error updating type:', error);
        showError('Failed to update type: ' + error.message);
    }
}

/**
 * Delete a type (remove it from all trackers - sets to "Unknown")
 */
async function deleteType(type) {
    const trackerCount = animals.filter(a => normalizeAttribute(a.type) === type).length;
    
    if (!confirm(`Are you sure you want to delete type "${type}"?\n\nThis will set the type to "Unknown" for ${trackerCount} tracker${trackerCount !== 1 ? 's' : ''}. You can edit them later to assign a new type.`)) {
        return;
    }
    
    // Set type to "Unknown" for all trackers with this type
    try {
        const updates = animals
            .filter(a => normalizeAttribute(a.type) === type)
            .map(a => 
                fetch(`/api/trackers/${a.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        animal_type: 'Unknown',
                        animal_name: a.name,
                        family: a.family || null
                    })
                })
            );
        
        await Promise.all(updates);
        
        showSuccess(`Type "${type}" removed from all trackers (set to "Unknown")`);
        
        // Reload data and refresh UI
        await loadMockData();
        if (currentEditingTracker) {
            // Refresh modal if open
            await openEditTrackerModal(currentEditingTracker);
        }
        renderTypesList();
        
    } catch (error) {
        console.error('Error deleting type:', error);
        showError('Failed to delete type: ' + error.message);
    }
}

/**
 * Edit a family (rename it across all trackers)
 */
async function editFamily(oldFamily) {
    const newFamily = prompt(`Edit family "${oldFamily}":`, oldFamily);
    if (!newFamily || newFamily.trim() === oldFamily) {
        return;
    }
    
    const normalizedNew = normalizeForDuplicateCheck(newFamily.trim());
    if (!normalizedNew) {
        showError('Invalid family name');
        return;
    }
    
    // Check for duplicates
    const existingFamilies = new Set();
    animals.forEach(animal => {
        if (animal.family) {
            existingFamilies.add(normalizeForDuplicateCheck(animal.family));
        }
    });
    
    if (existingFamilies.has(normalizedNew) && normalizedNew !== normalizeForDuplicateCheck(oldFamily)) {
        showError(`Family "${normalizedNew}" already exists`);
        return;
    }
    
    // Confirm action
    const trackerCount = animals.filter(a => normalizeAttribute(a.family) === oldFamily).length;
    if (!confirm(`Are you sure you want to rename "${oldFamily}" to "${normalizedNew}"?\n\nThis will affect ${trackerCount} tracker${trackerCount !== 1 ? 's' : ''}.`)) {
        return;
    }
    
    // Update all trackers with this family
    try {
        const updates = animals
            .filter(a => normalizeAttribute(a.family) === oldFamily)
            .map(a => 
                fetch(`/api/trackers/${a.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        family: normalizedNew,
                        animal_name: a.name,
                        animal_type: a.type
                    })
                })
            );
        
        await Promise.all(updates);
        
        showSuccess(`Family renamed from "${oldFamily}" to "${normalizedNew}"`);
        
        // Reload data and refresh UI
        await loadMockData();
        if (currentEditingTracker) {
            // Refresh modal if open
            await openEditTrackerModal(currentEditingTracker);
        }
        renderFamiliesList();
        
    } catch (error) {
        console.error('Error updating family:', error);
        showError('Failed to update family: ' + error.message);
    }
}

/**
 * Delete a family (remove it from all trackers)
 */
async function deleteFamily(family) {
    const trackerCount = animals.filter(a => normalizeAttribute(a.family) === family).length;
    
    if (!confirm(`Are you sure you want to delete family "${family}"?\n\nThis will remove the family from ${trackerCount} tracker${trackerCount !== 1 ? 's' : ''}. The trackers will have no family assigned.`)) {
        return;
    }
    
    // Remove family from all trackers (set to null)
    try {
        const updates = animals
            .filter(a => normalizeAttribute(a.family) === family)
            .map(a => 
                fetch(`/api/trackers/${a.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        family: null,
                        animal_name: a.name,
                        animal_type: a.type
                    })
                })
            );
        
        await Promise.all(updates);
        
        showSuccess(`Family "${family}" removed from all trackers`);
        
        // Reload data and refresh UI
        await loadMockData();
        if (currentEditingTracker) {
            // Refresh modal if open
            await openEditTrackerModal(currentEditingTracker);
        }
        renderFamiliesList();
        
    } catch (error) {
        console.error('Error deleting family:', error);
        showError('Failed to delete family: ' + error.message);
    }
}

// Current user (set after auth check)
let currentUser = null;

/**
 * Check auth; redirect to login if not authenticated. Returns user or null after redirect.
 */
async function checkAuth() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search || '/pages/dashboard');
        window.location.replace('/pages/auth/login?redirect=' + redirect);
        return null;
    }
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    currentUser = data.user || null;
    return currentUser;
}

/**
 * Log out and redirect to login
 */
async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.replace('/pages/auth/login?redirect=' + encodeURIComponent('/pages/dashboard'));
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    (async function() {
        try {
            const user = await checkAuth();
            if (!user) return;
            if (!user.clientSlug) {
                window.location.replace('/pages/auth/pending');
                return;
            }
            const emailEl = document.getElementById('userEmail');
            if (emailEl) emailEl.textContent = user.email || '';
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.addEventListener('click', logout);
            initDashboard();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    })();
});

/**
 * Initialize dashboard
 */
function initDashboard() {
    // Sync header height so the main area fills exactly the remaining viewport
    const header = document.querySelector('.dashboard-header');
    if (header) {
        const setHeaderH = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
        setHeaderH();
        new ResizeObserver(setHeaderH).observe(header);
    }
    initMap();
    initEventListeners();
    initFiltersToggle();
    initMobileSidebarToggle();
    initTrackerMultiselect();
    initSidebarQuickFilters();
    loadMockData();
}

function initMobileSidebarToggle() {
    const hamburger = document.getElementById('dashboardHamburger');
    const sidebar = document.getElementById('dashboardSidebar');
    if (!hamburger || !sidebar) return;
    
    hamburger.addEventListener('click', () => {
        // Only treat as overlay on small screens
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('is-open');
        }
    });
}

/**
 * Initialize map
 */
function initMap() {
    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('Map element not found!');
            return;
        }
        
        console.log('Initializing map...');
        
        // Initialize Leaflet map centered on a default location (can be adjusted)
        map = L.map('map', { zoomControl: false }).setView([24.7136, 46.6753], 8); // Default: Riyadh area
        
        // Base map: higher-contrast style (adjustable – see MAP_TILE_OPTIONS below)
        const MAP_TILE_OPTIONS = {
            voyagerNoLabels: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
            voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            positronNoLabels: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
            positron: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        };
        const mapTileUrl = MAP_TILE_OPTIONS.voyagerNoLabels; // clearer contrast than Positron
        L.tileLayer(mapTileUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
        
        console.log('Map initialized successfully');
        
        // Map control buttons
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const centerMapBtn = document.getElementById('centerMapBtn');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                map.zoomIn();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                map.zoomOut();
            });
        }
        
        if (centerMapBtn) {
            centerMapBtn.addEventListener('click', () => {
                centerMapOnAnimals();
            });
        }
    } catch (error) {
        console.error('Error initializing map:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

/**
 * Get URL parameter by name
 */
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Load mock data from CSV
 */
async function loadMockData() {
    try {
        console.log('Loading location data...');
        // Auth-scoped API: backend uses logged-in user's client; no client param
        let response = await fetch('/api/locations', { credentials: 'include' });
        if (response.status === 401) {
            window.location.replace('/pages/auth/login?redirect=' + encodeURIComponent('/pages/dashboard'));
            return;
        }
        if (!response.ok) {
            // Try to get error details from response
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = `${errorData.error}${errorData.details ? ': ' + errorData.details : ''}`;
                    if (errorData.hint) {
                        console.warn('💡 Hint:', errorData.hint);
                    }
                }
            } catch (e) {
                // Response is not JSON, use status text
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const csvText = await response.text();
        const dataSource = response.headers.get('X-Data-Source') || 'unknown';
        const locationCount = response.headers.get('X-Location-Count') || 'unknown';
        const warning = response.headers.get('X-Warning');
        
        if (warning) {
            console.warn('⚠️ Warning:', warning);
        }
        
        console.log('📊 Data loaded from: /api/locations (auth-scoped)');
        console.log('📦 Data source:', dataSource === 'database' ? '✅ DATABASE (PostgreSQL)' : '❓ Unknown');
        if (dataSource === 'database') {
            console.log('✅ Location count from database:', locationCount);
            totalDbLocationCount = locationCount !== 'unknown' ? parseInt(locationCount, 10) : null;
            showDataSourceIndicator('database', locationCount);
        } else {
            totalDbLocationCount = null;
        }
        console.log('📏 CSV length:', csvText.length);
        console.log('📝 First 200 chars:', csvText.substring(0, 200));
        
        locations = parseCSV(csvText);
        console.log('Parsed locations:', locations.length);
        
        // If no locations found, show helpful message
        if (locations.length === 0) {
            console.warn('⚠️ No locations found in data');
            if (warning) {
                showError('No location data available. ' + warning);
            }
        }
        
        // Process locations to create animals list
        processLocations(locations);
        console.log('Processed animals:', animals.length);
        
        // Fetch repeaters (auth-scoped; backend uses logged-in user's client)
        try {
            const repeaterRes = await fetch('/api/repeaters', { credentials: 'include' });
            if (repeaterRes.ok) {
                const data = await repeaterRes.json();
                repeaters = (data.repeaters || []).filter(r => r.latitude != null && r.longitude != null);
                console.log('Repeaters loaded:', repeaters.length);
            } else {
                repeaters = [];
            }
        } catch (e) {
            console.warn('Could not load repeaters:', e);
            repeaters = [];
        }
        // If API returned no repeaters but we have locations, show seed fallback so repeater markers always appear
        if (repeaters.length === 0 && locations.length > 0) {
            repeaters = [
                { repeater_id: 'RPT-THUWAL-N', latitude: 22.285, longitude: 39.1036 },
                { repeater_id: 'RPT-THUWAL-S', latitude: 22.251, longitude: 39.0982 }
            ];
            console.log('Using fallback repeater locations (2) for map');
        }
        
        // Set date filter defaults (earliest date to current date)
        setDateFilterDefaults(locations);
        
        // Populate tracker filter (MUST be called before updateMap/updateStatistics)
        populateTrackerFilter();
        populateAttributeFilters();
        
        // When sidebar tracker filter is removed, allSelectedTrackerIds is set in processLocations
        const trackerFilterEl = document.getElementById('trackerFilter');
        if (trackerFilterEl && (!trackerFilterEl.selectedTrackerIds || trackerFilterEl.selectedTrackerIds.size === 0)) {
            trackerFilterEl.selectedTrackerIds = new Set(animals.map(a => String(a.id)));
        }
        
        // Render animals list
        renderAnimalList();
        
        // Update map with markers (this will use all selected trackers by default)
        console.log('About to call updateMap()...');
        updateMap();
        
        // Update statistics (this will use all selected trackers by default)
        updateStatistics();
        
        // Center map on average center of all locations
        const center = getAverageCenterFromLocations(locations);
        if (map && center) {
            map.setView([center.lat, center.lng], 10, { animate: false });
            console.log('[loadMockData] Map centered on average of all locations:', center);
        }
        
        console.log('Dashboard loaded successfully');
        
    } catch (error) {
        console.error('Error loading mock data:', error);
        console.error('Error details:', error.message, error.stack);
        showError('Failed to load location data: ' + error.message);
        
        // Show error in UI
        const animalList = document.getElementById('animalList');
        if (animalList) {
            animalList.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading data: ${error.message}</p></div>`;
        }
    }
}

/**
 * Parse CSV text to array of objects
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        data.push(obj);
    }
    
    return data;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Format distance for display
 */
function formatDistance(km) {
    if (km < 1) {
        return (km * 1000).toFixed(0) + ' m';
    } else if (km < 10) {
        return km.toFixed(2) + ' km';
    } else {
        return km.toFixed(1) + ' km';
    }
}

/**
 * Detect timezone from coordinates
 * Returns IANA timezone identifier (e.g., 'Asia/Riyadh' for Saudi Arabia)
 */
function detectTimezoneFromCoordinates(lat, lng) {
    // Saudi Arabia region: approximately 16-32°N, 34-55°E
    // Riyadh is approximately 24.7136°N, 46.6753°E
    if (lat >= 16 && lat <= 32 && lng >= 34 && lng <= 55) {
        return 'Asia/Riyadh'; // KSA timezone (UTC+3)
    }
    
    // Default to UTC if we can't determine
    // In the future, this could be expanded with more regions or use a timezone lookup library
    return 'UTC';
}

/**
 * Compute average center of all locations (for initial map view)
 * Returns { lat, lng } or null if no valid coordinates
 */
function getAverageCenterFromLocations(locations) {
    if (!locations || locations.length === 0) return null;
    let sumLat = 0, sumLng = 0, count = 0;
    locations.forEach(loc => {
        const lat = parseFloat(loc.latitude || loc.lat);
        const lng = parseFloat(loc.longitude || loc.lng || loc.lon);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            sumLat += lat;
            sumLng += lng;
            count++;
        }
    });
    if (count === 0) return null;
    return { lat: sumLat / count, lng: sumLng / count };
}

/**
 * Get timezone for locations (detected from coordinates)
 * If multiple locations exist, uses the first valid location's coordinates
 */
function getTimezoneForLocations(locations) {
    if (!locations || locations.length === 0) {
        return 'UTC';
    }
    
    // Find first valid location with coordinates
    for (const location of locations) {
        const lat = location.lat;
        const lng = location.lng || location.lon;
        if (!isNaN(lat) && !isNaN(lng)) {
            return detectTimezoneFromCoordinates(lat, lng);
        }
    }
    
    return 'UTC';
}

/**
 * Convert date to timezone-specific date string (YYYY-MM-DD)
 */
function getDateStringInTimezone(date, timezone) {
    if (!date) return null;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    
    // Use Intl.DateTimeFormat to get date in specific timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return formatter.format(dateObj); // Returns YYYY-MM-DD format
}

/**
 * Format date/time in specific timezone
 */
function formatDateInTimezone(date, timezone, options = {}) {
    if (!date) return 'Never';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Never';
    
    const defaultOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    const formatOptions = { ...defaultOptions, ...options };
    
    return dateObj.toLocaleString('en-US', formatOptions);
}

/**
 * Calculate distance statistics for a tracker
 * Returns total distance and average distance per day
 * Average distance per day = (sum of daily distances) / (number of days with locations)
 */
function calculateDistanceStatistics(locations) {
    if (!locations || locations.length < 2) {
        return {
            totalDistance: 0,
            avgDistancePerDay: 0
        };
    }
    
    // Sort locations by timestamp
    const sortedLocations = [...locations].sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateA - dateB;
    });
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < sortedLocations.length; i++) {
        const prev = sortedLocations[i - 1];
        const curr = sortedLocations[i];
        
        // Validate coordinates
        if (isNaN(prev.lat) || isNaN(prev.lng) || isNaN(curr.lat) || isNaN(curr.lng)) {
            continue;
        }
        
        const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        totalDistance += distance;
    }
    
    // Group locations by day and calculate distance per day
    const dailyDistances = new Map(); // Map of dateString -> distance for that day
    const locationByDay = new Map(); // Map of dateString -> array of locations for that day
    
    // Detect timezone from locations (use first valid location)
    const timezone = getTimezoneForLocations(sortedLocations);
    
    // Group locations by day (YYYY-MM-DD format) in the detected timezone
    sortedLocations.forEach(location => {
        const timestamp = new Date(location.timestamp);
        if (isNaN(timestamp.getTime())) return;
        
        // Get date string in the detected timezone
        const dateString = getDateStringInTimezone(timestamp, timezone);
        if (!dateString) return;
        
        if (!locationByDay.has(dateString)) {
            locationByDay.set(dateString, []);
        }
        locationByDay.get(dateString).push(location);
    });
    
    // Calculate distance for each day
    locationByDay.forEach((dayLocations, dateString) => {
        if (dayLocations.length < 2) {
            // Single location on this day - no distance to calculate
            dailyDistances.set(dateString, 0);
            return;
        }
        
        // Sort locations for this day by timestamp
        dayLocations.sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Calculate total distance traveled on this day
        let dayDistance = 0;
        for (let i = 1; i < dayLocations.length; i++) {
            const prev = dayLocations[i - 1];
            const curr = dayLocations[i];
            
            if (isNaN(prev.lat) || isNaN(prev.lng) || isNaN(curr.lat) || isNaN(curr.lng)) {
                continue;
            }
            
            const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            dayDistance += distance;
        }
        
        dailyDistances.set(dateString, dayDistance);
    });
    
    // Calculate average: sum of daily distances / number of days with locations
    const daysWithLocations = dailyDistances.size;
    const sumDailyDistances = Array.from(dailyDistances.values()).reduce((sum, dist) => sum + dist, 0);
    const avgDistancePerDay = daysWithLocations > 0 ? sumDailyDistances / daysWithLocations : 0;
    
    return {
        totalDistance: totalDistance,
        avgDistancePerDay: avgDistancePerDay
    };
}

/**
 * Filter out isolated locations for a specific tracker
 * A location is filtered if:
 * 1. It's more than 100km from all other locations of the same tracker, OR
 * 2. It's more than 200km from the average center of all locations for this tracker
 * NOTE: This only affects map display - all locations remain in the database
 */
function filterIsolatedLocationsForTracker(trackerLocations, trackerId) {
    if (trackerLocations.length === 0) return [];
    if (trackerLocations.length === 1) return trackerLocations; // Single location is always valid
    
    const MAX_DISTANCE_FROM_OTHER_KM = 100;
    const MAX_DISTANCE_FROM_CENTER_KM = 200;
    
    // First, calculate the average center of all locations
    let sumLat = 0;
    let sumLng = 0;
    let validCount = 0;
    
    trackerLocations.forEach(location => {
        const lat = location.lat;
        const lng = location.lng;
        if (!isNaN(lat) && !isNaN(lng)) {
            sumLat += lat;
            sumLng += lng;
            validCount++;
        }
    });
    
    if (validCount === 0) return [];
    
    const avgCenterLat = sumLat / validCount;
    const avgCenterLng = sumLng / validCount;
    
    const filteredLocations = [];
    
    trackerLocations.forEach(location => {
        const lat1 = location.lat;
        const lng1 = location.lng;
        
        // Skip if coordinates are invalid
        if (isNaN(lat1) || isNaN(lng1)) {
            return;
        }
        
        // Check 1: Distance from average center (must be within 200km)
        const distanceFromCenter = calculateDistance(lat1, lng1, avgCenterLat, avgCenterLng);
        if (distanceFromCenter > MAX_DISTANCE_FROM_CENTER_KM) {
            console.warn(`[Isolated Location Filtered] Tracker ${trackerId}, Fix ${location.fix_number || 'N/A'}: More than ${MAX_DISTANCE_FROM_CENTER_KM}km from average center. Coordinates: ${lat1}, ${lng1}, Distance: ${distanceFromCenter.toFixed(2)}km`);
            return;
        }
        
        // Check 2: Must be within 100km of at least one other location
        let hasNearbyLocation = false;
        
        for (const otherLocation of trackerLocations) {
            if (location === otherLocation) continue; // Skip self
            
            const lat2 = otherLocation.lat;
            const lng2 = otherLocation.lng;
            
            if (isNaN(lat2) || isNaN(lng2)) continue;
            
            const distance = calculateDistance(lat1, lng1, lat2, lng2);
            
            if (distance <= MAX_DISTANCE_FROM_OTHER_KM) {
                hasNearbyLocation = true;
                break; // Found at least one nearby location, no need to check others
            }
        }
        
        if (hasNearbyLocation) {
            filteredLocations.push(location);
        } else {
            console.warn(`[Isolated Location Filtered] Tracker ${trackerId}, Fix ${location.fix_number || 'N/A'}: More than ${MAX_DISTANCE_FROM_OTHER_KM}km from all other locations of this tracker. Coordinates: ${lat1}, ${lng1}`);
        }
    });
    
    return filteredLocations;
}

/**
 * Process locations to create animals list
 */
function processLocations(locations) {
    // Detect timezone from first valid location coordinates
    detectedTimezone = getTimezoneForLocations(locations);
    console.log('[processLocations] Detected timezone:', detectedTimezone);
    
    // Group locations by tracker ID
    const animalMap = new Map();
    
    locations.forEach(location => {
        // Use new column names: tracker_id, animal_name, animal_type, battery_voltage
        const trackerId = location.tracker_id || location.trackerId || 'unknown';
        const animalName = location.animal_name || location.name || `Tracker ${trackerId}`;
        const familyValue = normalizeAttribute(location.family || location.family_name || location.group);
        const typeValue = normalizeAttribute(location.animal_type || location.type);
        const initialBatteryVoltage = location.initial_battery_voltage ? parseFloat(location.initial_battery_voltage) : null;
        
        if (!animalMap.has(trackerId)) {
            animalMap.set(trackerId, {
                id: trackerId,
                name: animalName,
                type: typeValue,
                family: familyValue,
                locations: [],
                lastUpdate: null,
                batteryVoltage: null,
                batteryPercent: null,
                initialBatteryVoltage,
                status: 'active'
            });
        }
        
        const animal = animalMap.get(trackerId);
        let timestamp = location.timestamp || location.time || new Date().toISOString();
        const lat = parseFloat(location.latitude || location.lat);
        const lng = parseFloat(location.longitude || location.lng || location.lon);
        const batteryVoltage = location.battery_voltage ? parseFloat(location.battery_voltage) : null;
        const family = normalizeAttribute(location.family || location.family_name || location.group || animal.family);
        const type = normalizeAttribute(location.animal_type || location.type || animal.type);
        
        // Data health check: Fix future timestamps
        const timestampDate = new Date(timestamp);
        const now = new Date();
        
        if (!isNaN(timestampDate.getTime())) {
            // If timestamp is in the future (more than 1 minute ahead), fix it to current time
            if (timestampDate > now + 60000) { // Allow 1 minute clock skew
                console.warn(`[Data Health Check] Future timestamp detected for tracker ${trackerId}: ${timestamp}. Fixing to current time.`);
                timestamp = now.toISOString();
            }
        } else {
            // Invalid timestamp, use current time
            console.warn(`[Data Health Check] Invalid timestamp for tracker ${trackerId}: ${timestamp}. Using current time.`);
            timestamp = now.toISOString();
        }
        
        // Filter out invalid coordinates: NaN, null, or 0.0 (invalid GPS data)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0.0 && lng !== 0.0) {
            animal.locations.push({
                id: location.location_id ? parseInt(location.location_id) : null,
                lat,
                lng,
                timestamp,
                batteryVoltage,
                fix_number: location.fix_number ? parseInt(location.fix_number) : null
            });
            
            // Update last update time - ensure we parse dates correctly for comparison
            const correctedTimestampDate = new Date(timestamp);
            const currentLastUpdate = animal.lastUpdate ? new Date(animal.lastUpdate) : null;
            
            // Only update if timestamp is valid and is newer than current last update
            if (!isNaN(correctedTimestampDate.getTime())) {
                if (!currentLastUpdate || isNaN(currentLastUpdate.getTime()) || correctedTimestampDate > currentLastUpdate) {
                    // Store as ISO string for consistent parsing later
                    animal.lastUpdate = correctedTimestampDate.toISOString();
                    animal.batteryVoltage = batteryVoltage;
                    animal.initialBatteryVoltage = initialBatteryVoltage || animal.initialBatteryVoltage || batteryVoltage;
                    animal.batteryPercent = calculateBatteryPercentage(animal.batteryVoltage, animal.initialBatteryVoltage);
                    animal.family = family || animal.family || 'Unknown';
                    animal.type = type || animal.type || 'Unknown';
                }
            }
        }
    });
    
    // Convert map to array and calculate status
    // Data health issues (future timestamps) are already fixed above during data processing
    // NOTE: Isolated location filtering is disabled - showing ALL locations
    animals = Array.from(animalMap.values()).map(animal => {
        // Show all locations (no filtering of isolated/outlier locations)
        console.log(`[Tracker ${animal.id}] Showing all ${animal.locations.length} locations (no filtering)`);
        
        // Recalculate lastUpdate from all locations
        // This ensures lastUpdate matches what's actually displayed on the map
        if (animal.locations.length > 0) {
            // Sort locations by timestamp and get the most recent one
            const sortedLocations = [...animal.locations].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            const lastLocation = sortedLocations[sortedLocations.length - 1];
            const lastTimestamp = new Date(lastLocation.timestamp);
            
            if (!isNaN(lastTimestamp.getTime())) {
                animal.lastUpdate = lastTimestamp.toISOString();
                // Also update battery voltage from the last location
                if (lastLocation.batteryVoltage !== null) {
                    animal.batteryVoltage = lastLocation.batteryVoltage;
                    animal.batteryPercent = calculateBatteryPercentage(animal.batteryVoltage, animal.initialBatteryVoltage);
                }
            }
        }
        
        // Calculate distance statistics using all locations
        const distanceStats = calculateDistanceStatistics(animal.locations);
        animal.totalDistance = distanceStats.totalDistance;
        animal.avgDistancePerDay = distanceStats.avgDistancePerDay;
        
        // Calculate status based on battery level and last update time
        animal.status = calculateAnimalStatus(animal);
        return animal;
    }).sort((a, b) => {
        if (!a.lastUpdate) return 1;
        if (!b.lastUpdate) return -1;
        return new Date(b.lastUpdate) - new Date(a.lastUpdate);
    });
    
    // Assign colors to all animals
    animals.forEach(animal => {
        getAnimalColor(animal.id);
    });
    
    // When sidebar tracker filter is removed, treat all trackers as selected
    allSelectedTrackerIds = new Set(animals.map(a => String(a.id)));

    // Update animal count
    const animalCountEl = document.getElementById('animalCount');
    if (animalCountEl) {
        animalCountEl.textContent = animals.length;
    }

    // Update header status pills
    updateHeaderStatusCounts();

    renderSidebarQuickFilterChips();
}

/**
 * Update the header active / alert count pills from the current animals array.
 */
function updateHeaderStatusCounts() {
    const activeCount = animals.filter(a => a.status === 'active').length;
    const alertCount = animals.filter(a => a.status === 'alert').length;
    const activeEl = document.getElementById('headerActiveCount');
    const alertEl = document.getElementById('headerAlertCount');
    if (activeEl) activeEl.textContent = activeCount;
    if (alertEl) alertEl.textContent = alertCount;
}

/**
 * Emoji/icon hint from animal type (sidebar cards + multiselect dots use status colors).
 */
function getTrackerTypeEmoji(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('gazelle')) return '🦌';
    if (t.includes('camel')) return '🐪';
    if (t.includes('reem')) return '🦌';
    if (t.includes('oryx')) return '🦌';
    if (t.includes('myriota') || t.includes('satellite')) return '📡';
    if (t.includes('lora')) return '📶';
    return '📍';
}

function updateTrackerMultiselectLabel() {
    const label = document.getElementById('trackerMultiselectLabel');
    const trackerFilter = document.getElementById('trackerFilter');
    if (!label || !trackerFilter) return;
    const sel = trackerFilter.selectedTrackerIds || new Set();
    const total = trackerFilter.querySelectorAll('.tracker-filter-item').length;
    if (total === 0) {
        label.textContent = 'Filter by tracker...';
        return;
    }
    if (sel.size === total) {
        label.textContent = 'All trackers';
    } else if (sel.size === 0) {
        label.textContent = 'No trackers selected';
    } else {
        label.textContent = `${sel.size} tracker${sel.size === 1 ? '' : 's'} selected`;
    }
}

function syncTrackerFilterSelectAllCheckbox() {
    const trackerFilter = document.getElementById('trackerFilter');
    const selectAllCb = document.getElementById('trackerFilterSelectAll');
    if (!trackerFilter || !selectAllCb) return;
    const selectedTrackerIds = trackerFilter.selectedTrackerIds || new Set();
    const allItems = trackerFilter.querySelectorAll('.tracker-filter-item');
    const n = allItems.length;
    selectAllCb.checked = n > 0 && selectedTrackerIds.size === n;
    selectAllCb.indeterminate = selectedTrackerIds.size > 0 && selectedTrackerIds.size < n;
}

/**
 * Build quick filter chips: All + animal types (up to 5)
 */
function renderSidebarQuickFilterChips() {
    const container = document.getElementById('sidebarQuickFilters');
    if (!container) return;

    const types = new Set();
    animals.forEach(a => {
        const t = normalizeAttribute(a.type);
        if (t && t !== 'Unknown') types.add(t);
    });
    const sortedTypes = sortFilterValues(Array.from(types)).slice(0, 5);
    const chips = [
        { mode: 'all', typeValue: '', label: 'All' },
        ...sortedTypes.map(t => ({ mode: 'type', typeValue: t, label: t })),
    ];

    container.innerHTML = chips
        .map(
            c => `<button type="button" class="sidebar-quick-filter-chip" data-mode="${escapeHtml(c.mode)}" data-type-value="${escapeHtml(c.typeValue)}">${escapeHtml(c.label)}</button>`
        )
        .join('');

    container.querySelectorAll('.sidebar-quick-filter-chip').forEach(btn => {
        const m = btn.dataset.mode;
        const tv = btn.dataset.typeValue || '';
        const active =
            (sidebarQuickFilter.mode === 'all' && m === 'all') ||
            (sidebarQuickFilter.mode === 'alerts' && m === 'alerts') ||
            (sidebarQuickFilter.mode === 'type' && m === 'type' && tv === (sidebarQuickFilter.typeValue || ''));
        if (active) btn.classList.add('is-active');
    });
}

function initTrackerMultiselect() {
    const root = document.getElementById('trackerMultiselect');
    const btn = document.getElementById('trackerMultiselectBtn');
    const panel = document.getElementById('trackerMultiselectPanel');
    if (!root || !btn || !panel || root.dataset.bound) return;
    root.dataset.bound = '1';
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = panel.hasAttribute('hidden');
        if (open) {
            panel.removeAttribute('hidden');
            btn.setAttribute('aria-expanded', 'true');
            btn.classList.add('is-open');
        } else {
            panel.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('is-open');
        }
    });
    document.addEventListener('click', () => {
        if (!panel.hasAttribute('hidden')) {
            panel.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('is-open');
        }
    });
    root.addEventListener('click', e => e.stopPropagation());
}

function initSidebarQuickFilters() {
    const container = document.getElementById('sidebarQuickFilters');
    if (!container || container.dataset.bound) return;
    container.dataset.bound = '1';
    container.addEventListener('click', e => {
        const chip = e.target.closest('.sidebar-quick-filter-chip');
        if (!chip) return;
        const mode = chip.dataset.mode;
        const typeValue = mode === 'type' ? chip.dataset.typeValue || null : null;
        sidebarQuickFilter = { mode, typeValue };
        container.querySelectorAll('.sidebar-quick-filter-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        updateMap();
        updateStatistics();
        renderAnimalList();
    });
}

/**
 * Populate tracker filter list
 */
function populateTrackerFilter() {
    const trackerFilter = document.getElementById('trackerFilter');
    if (!trackerFilter) {
        allSelectedTrackerIds = new Set(animals.map(a => a.id));
        return;
    }
    
    // Clear existing items
    trackerFilter.innerHTML = '';
    
    // Sort animals by name for better UX
    const sortedAnimals = [...animals].sort((a, b) => a.name.localeCompare(b.name));
    
    // Track selected trackers (all selected by default); IDs as strings for consistent matching
    let selectedTrackerIds = new Set(sortedAnimals.map(a => String(a.id)));
    
    // Store selected trackers in the element BEFORE creating items
    // This ensures it's available when updateMap() and updateStatistics() are called
    trackerFilter.selectedTrackerIds = selectedTrackerIds;
    
    console.log(`[populateTrackerFilter] Stored ${selectedTrackerIds.size} selected trackers:`, Array.from(selectedTrackerIds));
    
    // Add all trackers as items (checkbox + status dot + name)
    sortedAnimals.forEach(animal => {
        const item = document.createElement('div');
        item.className = 'tracker-filter-item selected';
        item.dataset.trackerId = String(animal.id);
        const st = ['active', 'alert', 'inactive'].includes(animal.status) ? animal.status : 'inactive';
        item.innerHTML = `
            <span class="tracker-filter-checkbox" aria-hidden="true"></span>
            <span class="tracker-filter-dot ${st}" aria-hidden="true"></span>
            <span class="tracker-filter-item-name">${escapeHtml(animal.name)}</span>
        `;

        item.addEventListener('click', () => {
            const currentSelected = trackerFilter.selectedTrackerIds || new Set();
            const idKey = String(animal.id);
            const isSelected = currentSelected.has(idKey);
            if (isSelected) {
                currentSelected.delete(idKey);
                item.classList.remove('selected');
            } else {
                currentSelected.add(idKey);
                item.classList.add('selected');
            }
            trackerFilter.selectedTrackerIds = currentSelected;
            updateMap();
            updateStatistics();
            renderAnimalList();
            updateToggleAllButton();
        });

        trackerFilter.appendChild(item);
    });

    updateToggleAllButton();
    updateTrackerMultiselectLabel();
    
    console.log(`Tracker filter populated with ${sortedAnimals.length} trackers, all selected by default`);
    console.log('Selected tracker IDs:', Array.from(selectedTrackerIds));
}

function populateAttributeFilters() {
    const typeFilterBar = document.getElementById('typeFilterBar');
    const familyFilterBar = document.getElementById('familyFilterBar');
    if (!typeFilterBar || !familyFilterBar) {
        return;
    }

    const previousType = typeFilterBar.value || 'all';
    const previousFamily = familyFilterBar.value || 'all';

    const typeValues = new Set();
    const familyValues = new Set();

    animals.forEach(animal => {
        typeValues.add(normalizeAttribute(animal.type));
        familyValues.add(normalizeAttribute(animal.family));
    });

    const sortedTypes = sortFilterValues(Array.from(typeValues));
    const sortedFamilies = sortFilterValues(Array.from(familyValues));

    populateFilterSelect(typeFilterBar, sortedTypes, 'All Types', previousType);
    populateFilterSelect(familyFilterBar, sortedFamilies, 'Any family', previousFamily);
}

function sortFilterValues(values) {
    return values.sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
}

function populateFilterSelect(selectEl, values, allLabel, previousValue) {
    const currentSelection = previousValue || 'all';

    while (selectEl.firstChild) {
        selectEl.removeChild(selectEl.firstChild);
    }

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = allLabel;
    selectEl.appendChild(allOption);

    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        selectEl.appendChild(option);
    });

    if (currentSelection !== 'all' && values.includes(currentSelection)) {
        selectEl.value = currentSelection;
    } else {
        selectEl.value = 'all';
    }
}

/**
 * Update toggle all button text based on current selection
 */
function updateToggleAllButton() {
    const trackerFilter = document.getElementById('trackerFilter');
    if (!trackerFilter) return;
    syncTrackerFilterSelectAllCheckbox();
    updateTrackerMultiselectLabel();

    const toggleAllBtn = document.getElementById('toggleAllTrackers');
    const toggleAllText = document.getElementById('toggleAllText');
    if (!toggleAllBtn || !toggleAllText) return;

    const selectedTrackerIds = trackerFilter.selectedTrackerIds || new Set();
    const allItems = trackerFilter.querySelectorAll('.tracker-filter-item');
    if (selectedTrackerIds.size === allItems.length && allItems.length > 0) {
        toggleAllText.textContent = 'Deselect All';
    } else {
        toggleAllText.textContent = 'Select All';
    }
}

/**
 * Toggle all trackers (select/deselect all)
 */
function toggleAllTrackers() {
    const trackerFilter = document.getElementById('trackerFilter');
    if (!trackerFilter) return; // Sidebar filter removed
    
    const selectedTrackerIds = trackerFilter.selectedTrackerIds || new Set();
    const allItems = trackerFilter.querySelectorAll('.tracker-filter-item');
    
    // Check if all are selected
    const allSelected = selectedTrackerIds.size === allItems.length && allItems.length > 0;
    
    // Select or deselect all
    allItems.forEach(item => {
        const trackerId = item.dataset.trackerId;
        if (allSelected) {
            selectedTrackerIds.delete(trackerId);
            item.classList.remove('selected');
        } else {
            selectedTrackerIds.add(trackerId);
            item.classList.add('selected');
        }
    });
    
    // Update the stored set
    trackerFilter.selectedTrackerIds = selectedTrackerIds;
    
    console.log(`[toggleAllTrackers] ${allSelected ? 'Deselected' : 'Selected'} all trackers. Selected IDs:`, Array.from(selectedTrackerIds));
    
    // Update button text
    updateToggleAllButton();
    
    // Update map and statistics
    updateMap();
    updateStatistics();
    renderAnimalList();
}

/**
 * Set date filter defaults based on location data
 */
function setDateFilterDefaults(locations) {
    if (!locations || locations.length === 0) {
        return;
    }
    
    // Find earliest and latest timestamps
    let earliestDate = null;
    let latestDate = null;
    
    locations.forEach(location => {
        // Use new column name: timestamp
        const timestamp = location.timestamp || location.time;
        if (timestamp) {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                if (!earliestDate || date < earliestDate) {
                    earliestDate = date;
                }
                if (!latestDate || date > latestDate) {
                    latestDate = date;
                }
            }
        }
    });
    
    const dateFromInput = document.getElementById('dateFromBar');
    const dateToInput = document.getElementById('dateToBar');
    const today = new Date();
    const tz = detectedTimezone || 'UTC';
    
    // Set dateFrom: default and min to earliest date from database (in detected timezone)
    if (dateFromInput && earliestDate) {
        const earliestDateStr = getDateStringInTimezone(earliestDate, tz);
        if (earliestDateStr) {
        dateFromInput.value = earliestDateStr;
        dateFromInput.setAttribute('placeholder', earliestDateStr);
        dateFromInput.setAttribute('min', earliestDateStr);
            // Set max to today (can't select future dates)
            const todayStr = getDateStringInTimezone(today, tz);
            if (todayStr) {
                dateFromInput.setAttribute('max', todayStr);
            }
        }
    }
    
    // Set dateTo: default and max to today (in detected timezone)
    if (dateToInput) {
        const todayStr = getDateStringInTimezone(today, tz);
        if (todayStr) {
            dateToInput.value = todayStr;
            dateToInput.setAttribute('placeholder', todayStr);
            dateToInput.setAttribute('max', todayStr); // Can't select future dates
        if (earliestDate) {
                const earliestDateStr = getDateStringInTimezone(earliestDate, tz);
                if (earliestDateStr) {
                    dateToInput.setAttribute('min', earliestDateStr); // Can't select before earliest date
        }
            }
            console.log('[setDateFilterDefaults] Set dateTo to:', todayStr, '(today in', tz, 'timezone)');
        }
    }
    
    console.log('Date filter defaults set:', {
        from: earliestDate ? getDateStringInTimezone(earliestDate, tz) : null,
        to: getDateStringInTimezone(today, tz), // Always defaults to today
        earliestInData: earliestDate ? earliestDate.toISOString() : null,
        latestInData: latestDate ? latestDate.toISOString() : null,
        timezone: tz
    });
}

/**
 * Render animal list
 */
function renderAnimalList() {
    const animalList = document.getElementById('animalList');
    if (!animalList) {
        console.warn('animalList element not found, skipping render');
        return;
    }
    
    const { status, type, family } = getFilterSelections();
    
    // Get selected trackers (sidebar filter removed: use all or fallback set)
    const trackerFilterList = document.getElementById('trackerFilter');
    let selectedTrackerIds = [];
    if (trackerFilterList && trackerFilterList.selectedTrackerIds && trackerFilterList.selectedTrackerIds.size > 0) {
        selectedTrackerIds = Array.from(trackerFilterList.selectedTrackerIds).map(String);
    } else {
        selectedTrackerIds = (allSelectedTrackerIds.size > 0 ? Array.from(allSelectedTrackerIds) : animals.map(a => a.id)).map(String);
    }
    
    // Search query (top bar)
    const searchInput = document.getElementById('searchTrackersInput');
    const searchQuery = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';
    const matchesSearch = (animal) => {
        if (!searchQuery) return true;
        const name = (animal.name || '').toLowerCase();
        const id = (animal.id || '').toLowerCase();
        const typeStr = (animal.type || '').toLowerCase();
        const familyStr = (animal.family || '').toLowerCase();
        return name.includes(searchQuery) || id.includes(searchQuery) || typeStr.includes(searchQuery) || familyStr.includes(searchQuery);
    };

    // Filter animals based on status, selected trackers, and search
    const filteredAnimals = animals.filter(animal =>
        selectedTrackerIds.includes(String(animal.id)) &&
        (status === 'all' || animal.status === status) &&
        matchesFilter(animal.type, type) &&
        matchesFilter(animal.family, family) &&
        matchesSearch(animal)
    ).sort((a, b) => {
        // Sort by most recent location update (most recent first)
        // Trackers without lastUpdate go to the bottom
        if (!a.lastUpdate) return 1;
        if (!b.lastUpdate) return -1;
        return new Date(b.lastUpdate) - new Date(a.lastUpdate);
    });
    
    // Render animal list
    if (filteredAnimals.length === 0) {
        animalList.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No animals found</p></div>';
        return;
    }
    
    const tz = detectedTimezone || 'UTC';
    animalList.innerHTML = filteredAnimals.map(animal => {
        const lastSeen = animal.lastUpdate
            ? (() => {
                const d = new Date(animal.lastUpdate);
                return isNaN(d.getTime()) ? 'Never' : formatDateInTimezone(d, tz);
            })()
            : 'Never';
        const batteryText = formatBattery(animal.batteryVoltage, animal.batteryPercent);
        const typePart = normalizeAttribute(animal.type).replace(/\bUnknown\b/g, '').trim();
        const familyPart = normalizeAttribute(animal.family).replace(/\bUnknown\b/g, '').trim();
        const subLine = [typePart, familyPart].filter(Boolean).join(' · ') || '—';
        const statusLabel = animal.status === 'active' ? 'active' : animal.status === 'alert' ? 'alert' : 'inactive';
        const statusHint = getStatusHint(animal);
        const stClass = ['active', 'alert', 'inactive'].includes(animal.status) ? animal.status : 'inactive';
        const pctRaw = animal.batteryPercent != null && !Number.isNaN(animal.batteryPercent) ? animal.batteryPercent : 0;
        const pct = Math.min(100, Math.max(0, pctRaw));
        const emoji = getTrackerTypeEmoji(animal.type);

        return `
            <div class="tracker-card ${String(selectedAnimalId) === String(animal.id) ? 'active' : ''}" 
                 data-animal-id="${animal.id}">
                <div class="tracker-card-header">
                    <div class="tracker-card-title-row">
                        <span class="tracker-card-emoji" aria-hidden="true">${emoji}</span>
                        <span class="tracker-card-name">${escapeHtml(animal.name)}</span>
                    </div>
                    <span class="tracker-card-badge tracker-card-badge--${stClass}" title="${escapeHtml(statusHint)}">${escapeHtml(statusLabel)}</span>
                </div>
                <div class="tracker-card-sub">${escapeHtml(subLine)}</div>
                <div class="tracker-card-meta">
                    <div class="tracker-card-meta-item">
                        <span class="tracker-card-meta-label">Battery</span>
                        <span class="tracker-card-meta-value">${escapeHtml(batteryText)}</span>
                    </div>
                    <div class="tracker-card-meta-item">
                        <span class="tracker-card-meta-label">Last seen</span>
                        <span class="tracker-card-meta-value">${escapeHtml(lastSeen)}</span>
                    </div>
                </div>
                <div class="tracker-card-battery-bar" aria-hidden="true">
                    <div class="tracker-card-battery-fill" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners (support both .tracker-card and .animal-item for compatibility)
    animalList.querySelectorAll('.tracker-card, .animal-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-tracker')) {
                e.stopPropagation();
                const editBtn = e.target.closest('.btn-edit-tracker');
                if (editBtn && editBtn.dataset.trackerId) {
                    openEditTrackerModal(editBtn.dataset.trackerId);
                }
                return;
            }
            const animalId = item.dataset.animalId;
            if (animalId) selectAnimal(animalId);
        });
    });
}

/** True if two lat/lng points are the same (for selected location highlight) */
function isSameLocation(a, b) {
    if (!a || !b) return false;
    return Math.abs((a.lat || a[0]) - (b.lat || b[0])) < 1e-6 && Math.abs((a.lng || a[1]) - (b.lng || b[1])) < 1e-6;
}

/**
 * Select animal and focus on map
 * @param {string|number} animalId
 * @param {{ lat: number, lng: number }} [locationOptional] - when provided (e.g. from marker click), this location is highlighted; otherwise last location is used
 * @param {{ panToLocation?: boolean }} [options] - if panToLocation is true, map pans/zooms to locationOptional (e.g. location log). Marker clicks omit this so the view stays put.
 */
function selectAnimal(animalId, locationOptional, options = {}) {
    // Support both string (from dataset) and number ids
    const animal = animals.find(a => a.id == animalId || String(a.id) === String(animalId));
    
    if (!animal) {
        console.warn('[selectAnimal] Animal not found for id:', animalId, 'available:', animals.map(a => a.id));
        return;
    }
    
    const id = animal.id;
    selectedAnimalId = id;
    if (locationOptional && typeof locationOptional.lat === 'number' && typeof locationOptional.lng === 'number') {
        selectedLocation = { lat: locationOptional.lat, lng: locationOptional.lng };
    } else if (animal.locations && animal.locations.length > 0) {
        const sorted = [...animal.locations].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const last = sorted[sorted.length - 1];
        selectedLocation = { lat: last.lat, lng: last.lng };
    } else {
        selectedLocation = null;
    }
    
    // Show detail card immediately so it's visible even if later steps throw
    updateTrackerDetailCard(animal);
    
    // Add animal to selected trackers in the filter
    const trackerFilter = document.getElementById('trackerFilter');
    if (trackerFilter && trackerFilter.selectedTrackerIds) {
        const selectedTrackerIds = trackerFilter.selectedTrackerIds;
        const idStr = String(id);
        if (!selectedTrackerIds.has(idStr)) {
            selectedTrackerIds.add(idStr);
            trackerFilter.selectedTrackerIds = selectedTrackerIds;

            const trackerItem = Array.from(trackerFilter.querySelectorAll('.tracker-filter-item')).find(
                el => el.dataset.trackerId === idStr
            );
            if (trackerItem) {
                trackerItem.classList.add('selected');
            }
            
            // Update toggle all button
            updateToggleAllButton();
        }
    }
    
    updateMap();
    updateStatistics();
    
    if (map && animal.locations && animal.locations.length > 0) {
        let panTarget = null;
        if (options.panToLocation && locationOptional && typeof locationOptional.lat === 'number' && typeof locationOptional.lng === 'number') {
            panTarget = locationOptional;
        } else if (locationOptional == null) {
            const sortedLocations = [...animal.locations].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            panTarget = sortedLocations[sortedLocations.length - 1];
        }
        if (panTarget) {
            map.setView([panTarget.lat, panTarget.lng], 13, {
                animate: true,
                duration: 0.5
            });
        }
    }
    
    renderAnimalList();
}

/**
 * Update map with markers (filtered by date range)
 */
function updateMap() {
    console.log('[updateMap] Function called');
    
    // Check if map is initialized
    if (!map) {
        console.error('[updateMap] Map not initialized!');
        return;
    }
    
    // Clear existing repeater markers and coverage circles
    repeaterMarkers.forEach(m => {
        if (m && map.hasLayer(m)) map.removeLayer(m);
    });
    repeaterMarkers = [];
    repeaterCircles.forEach(c => {
        if (c && map.hasLayer(c)) map.removeLayer(c);
    });
    repeaterCircles = [];
    
    // Clear existing markers - need to handle both single markers and arrays
    Object.values(markers).forEach(marker => {
        if (Array.isArray(marker)) {
            marker.forEach(m => {
                if (m && map.hasLayer(m)) {
                    map.removeLayer(m);
                }
            });
        } else {
            if (marker && map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
    });
    markers = {};
    
    // Clear existing polylines
    Object.values(polylines).forEach(polyline => {
        if (Array.isArray(polyline)) {
            polyline.forEach(p => {
                if (p && map.hasLayer(p)) {
                    map.removeLayer(p);
                }
            });
        } else {
            if (polyline && map.hasLayer(polyline)) {
                map.removeLayer(polyline);
            }
        }
    });
    polylines = {};
    
    // Also clear all markers and polylines that might be left over (safety check)
    // This ensures we don't have orphaned layers from previous renders
    map.eachLayer(layer => {
        // Only remove markers and polylines, keep tile layers
        if ((layer instanceof L.Marker || layer instanceof L.Polyline) && !(layer instanceof L.TileLayer)) {
            try {
                map.removeLayer(layer);
            } catch (e) {
                // Layer might already be removed, ignore error
            }
        }
    });
    
    // Get filter values
    const dateFromInput = document.getElementById('dateFromBar');
    const dateToInput = document.getElementById('dateToBar');
    const trackerFilter = document.getElementById('trackerFilter');
    const { status: statusFilter, type: typeFilter, family: familyFilter } = getFilterSelections();
    const visualizationModeSelect = document.getElementById('visualizationMode');
    
    // Get status filter value
    console.log('[updateMap] Filters:', { statusFilter, typeFilter, familyFilter });
    const dateFrom = dateFromInput ? dateFromInput.value : null;
    const dateTo = dateToInput ? dateToInput.value : null;
    const visualizationMode = visualizationModeSelect ? visualizationModeSelect.value : 'markers';
    
    console.log('[updateMap] Date filters:', { dateFrom, dateTo });
    console.log('[updateMap] Visualization mode:', visualizationMode);
    console.log('[updateMap] Date filter values:', { 
        dateFromRaw: dateFromInput?.value, 
        dateToRaw: dateToInput?.value,
        dateFrom: dateFrom,
        dateTo: dateTo
    });
    
    // If date filters are set but might be filtering everything, warn
    if ((dateFrom && dateFrom.trim() !== '') || (dateTo && dateTo.trim() !== '')) {
        console.log('[updateMap] Date filters are active - locations will be filtered by date');
    } else {
        console.log('[updateMap] No date filters active - showing all locations');
    }
    
    // Get selected tracker IDs from custom filter
    const trackerFilterList = document.getElementById('trackerFilter');
    let selectedTrackerIds;
    
    if (trackerFilterList && trackerFilterList.selectedTrackerIds && trackerFilterList.selectedTrackerIds.size > 0) {
        selectedTrackerIds = Array.from(trackerFilterList.selectedTrackerIds).map(String);
        console.log('[updateMap] Using trackers from filter:', selectedTrackerIds.length);
    } else {
        selectedTrackerIds = (allSelectedTrackerIds.size > 0 ? Array.from(allSelectedTrackerIds) : animals.map(a => a.id)).map(String);
        console.log('[updateMap] Using all trackers (no sidebar filter):', selectedTrackerIds.length);
    }
    
    console.log('[updateMap] Total animals available:', animals.length);
    console.log('[updateMap] Selected tracker IDs count:', selectedTrackerIds.length);
    console.log('[updateMap] Selected tracker IDs:', selectedTrackerIds);
    console.log('[updateMap] Animal IDs:', animals.map(a => a.id));
    
    // Add markers for each animal (filtered by tracker and date)
    let markersAdded = 0;
    let skippedCount = 0;
    
    console.log('[updateMap] Filtering animals by selected tracker IDs:', selectedTrackerIds);
    console.log('[updateMap] Selected tracker count:', selectedTrackerIds.length);
    
    // If no trackers are selected, show nothing
    if (selectedTrackerIds.length === 0) {
        console.log('[updateMap] WARNING: No trackers selected! Showing empty map.');
        return;
    }
    
    animals.forEach(animal => {
        // Filter by tracker selection - STRICT CHECK
        if (!selectedTrackerIds.includes(String(animal.id))) {
            skippedCount++;
            console.log(`[updateMap] SKIPPING ${animal.id} (${animal.name}) - NOT in selected list`);
            return; // Skip this animal if not selected
        }
        
        // Filter by status
        if (statusFilter !== 'all' && animal.status !== statusFilter) {
            skippedCount++;
            console.log(`[updateMap] SKIPPING ${animal.id} (${animal.name}) - Status ${animal.status} doesn't match filter ${statusFilter}`);
            return; // Skip this animal if status doesn't match
        }

        if (!matchesFilter(animal.type, typeFilter)) {
            skippedCount++;
            console.log(`[updateMap] SKIPPING ${animal.id} (${animal.name}) - Type ${animal.type} doesn't match filter ${typeFilter}`);
            return;
        }

        if (!matchesFilter(animal.family, familyFilter)) {
            skippedCount++;
            console.log(`[updateMap] SKIPPING ${animal.id} (${animal.name}) - Family ${animal.family} doesn't match filter ${familyFilter}`);
            return;
        }
        
        console.log(`[updateMap] INCLUDING ${animal.id} (${animal.name}) - IS in selected list and matches status filter`);
        
        console.log(`[updateMap] Processing ${animal.id} - ${animal.name}, locations: ${animal.locations.length}`);
        
        // Filter locations by date range
        let filteredLocations = animal.locations;
        console.log(`[updateMap] ${animal.id} - Initial locations: ${animal.locations.length}`);
        
        // Only apply date filter if dates are actually set (not just empty strings)
        // Use detected timezone for date comparisons
        if ((dateFrom && dateFrom.trim() !== '') || (dateTo && dateTo.trim() !== '')) {
            const beforeFilter = filteredLocations.length;
            const tz = detectedTimezone || 'UTC';
            
            filteredLocations = animal.locations.filter(loc => {
                const locDate = new Date(loc.timestamp);
                if (isNaN(locDate.getTime())) {
                    console.log(`[updateMap] Invalid date for ${animal.id}: ${loc.timestamp}`);
                    return false;
                }
                
                // Get date string in detected timezone for comparison
                const locDateStr = getDateStringInTimezone(locDate, tz);
                if (!locDateStr) return false;
                
                if (dateFrom && dateFrom.trim() !== '') {
                    // Compare date strings (YYYY-MM-DD format) in detected timezone
                    if (locDateStr < dateFrom) {
                        console.log(`[updateMap] ${animal.id} - Location date ${locDateStr} (${locDate.toISOString()}) is before dateFrom ${dateFrom} (timezone: ${tz})`);
                            return false;
                    }
                }
                
                if (dateTo && dateTo.trim() !== '') {
                    // Compare date strings (YYYY-MM-DD format) in detected timezone
                    if (locDateStr > dateTo) {
                        console.log(`[updateMap] ${animal.id} - Location date ${locDateStr} (${locDate.toISOString()}) is after dateTo ${dateTo} (timezone: ${tz})`);
                            return false;
                    }
                }
                
                return true;
            });
            console.log(`[updateMap] ${animal.id} - After date filter: ${filteredLocations.length} (was ${beforeFilter})`);
        }
        
        if (filteredLocations.length > 0) {
            console.log(`[updateMap] ${animal.id} - Processing ${filteredLocations.length} locations with mode: ${visualizationMode}`);
            
            // Sort locations by timestamp to ensure correct order
            const sortedLocations = [...filteredLocations].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            // Get or assign a unique color for this animal
            let iconColor = getAnimalColor(animal.id);
            
            // Render based on visualization mode
            if (visualizationMode === 'markers') {
                // Only markers mode: show all locations but not connected
                renderMarkersOnly(animal, sortedLocations, iconColor);
                markersAdded += sortedLocations.length;
            } else if (visualizationMode === 'path') {
                // Path mode: show all markers and connect them with polylines
                renderPath(animal, sortedLocations, iconColor);
                markersAdded += sortedLocations.length;
            } else if (visualizationMode === 'pathWithDirections') {
                // Path with directions: show all markers, polylines, and directional arrows
                renderPathWithDirections(animal, sortedLocations, iconColor);
                markersAdded += sortedLocations.length;
            }
        }
    });
    
    console.log(`[updateMap] Total markers added to map: ${markersAdded}`);
    console.log(`[updateMap] Skipped ${skippedCount} animals (not selected)`);
    
    if (markersAdded === 0 && animals.length > 0) {
        console.warn('[updateMap] WARNING: No markers added despite having animals!');
        console.warn('[updateMap] This could mean:');
        console.warn('  1. No trackers are selected');
        console.warn('  2. Animal IDs don\'t match selected tracker IDs');
        console.warn('  3. All locations are filtered out by date range');
    }
    
    // Restore label visibility state after markers are created
    Object.keys(animalLabelsVisible).forEach(animalId => {
        if (animalLabelsVisible[animalId]) {
            const animalMarkers = markers[animalId];
            if (animalMarkers) {
                if (Array.isArray(animalMarkers)) {
                    animalMarkers.forEach(marker => {
                        if (marker) {
                            marker.openPopup();
                        }
                    });
                } else {
                    animalMarkers.openPopup();
                }
            }
        }
    });
    
    // Add repeater coverage circles (7km radius, 10% opacity, no border) then markers (80px icon)
    const REPEATER_RADIUS_M = 7000; // 7 km
    const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    const repeaterImgUrl = origin + '/static/assets/icons/repeater.png';
    const repeaterIcon = L.divIcon({
        className: 'repeater-marker',
        html: '<span class="repeater-icon-inner" style="background-image:url(\'' + repeaterImgUrl + '\')"></span>',
        iconSize: [80, 80],
        iconAnchor: [40, 40]
    });
    const { showRepeaterCoverage } = getFilterSelections();
    repeaters.forEach(r => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        if (showRepeaterCoverage) {
            const circle = L.circle([lat, lng], {
                radius: REPEATER_RADIUS_M,
                fillColor: '#374151',
                fillOpacity: 0.1,
                color: 'transparent',
                weight: 0
            }).addTo(map);
            repeaterCircles.push(circle);
        }
        const marker = L.marker([lat, lng], { icon: repeaterIcon, zIndexOffset: 500 })
            .addTo(map)
            .bindTooltip(r.repeater_id || 'Repeater', { permanent: false, direction: 'top' });
        repeaterMarkers.push(marker);
    });
    if (repeaters.length > 0) {
        console.log('[updateMap] Added', repeaters.length, 'repeater marker(s)');
    }
}

/**
 * Center map on all animals
 */
function centerMapOnAnimals() {
    if (animals.length === 0) return;
    
    const bounds = [];
    animals.forEach(animal => {
        animal.locations.forEach(location => {
            bounds.push([location.lat, location.lng]);
        });
    });
    
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

/**
 * Update statistics (filtered by date range)
 */
function updateStatistics() {
    const dateFromInput = document.getElementById('dateFromBar');
    const dateToInput = document.getElementById('dateToBar');
    const { status, type, family } = getFilterSelections();
    const dateFrom = dateFromInput ? dateFromInput.value : null;
    const dateTo = dateToInput ? dateToInput.value : null;
    const avgUpdateEl = document.getElementById('avgUpdateTime');
    const avgBatteryEl = document.getElementById('avgBattery');
    const alertsEl = document.getElementById('alertsCount');
    
    const trackerFilterList = document.getElementById('trackerFilter');
    const selectedTrackerIds = (
        trackerFilterList && trackerFilterList.selectedTrackerIds && trackerFilterList.selectedTrackerIds.size > 0
            ? Array.from(trackerFilterList.selectedTrackerIds)
            : allSelectedTrackerIds.size > 0 ? Array.from(allSelectedTrackerIds) : animals.map(a => a.id)
    ).map(String);

    // Count locations from animal.locations to match what's displayed
    // This ensures dashboard count matches what's actually shown on map and exported in CSV
    let filteredLocationCount = 0;
    const tz = detectedTimezone || 'UTC';
    
    animals.forEach(animal => {
        // Apply tracker filter
        if (!selectedTrackerIds.includes(String(animal.id))) {
            return;
        }

        // Apply status filter
        if (status !== 'all' && animal.status !== status) {
            return;
        }

        // Apply type filter
        if (type !== 'all' && !matchesFilter(animal.type, type)) {
            return;
        }

        // Apply family filter
        if (family !== 'all' && !matchesFilter(animal.family, family)) {
            return;
        }

        // Count locations from animal.locations (already filtered for outliers)
        // Apply date filter to these locations (using timezone-aware logic)
        animal.locations.forEach(location => {
            if (dateFrom || dateTo) {
                const locDate = new Date(location.timestamp);
                if (isNaN(locDate.getTime())) {
                    return;
                }
                
                // Get date string in detected timezone for comparison
                const locDateStr = getDateStringInTimezone(locDate, tz);
                if (!locDateStr) return;
                
                // Compare date strings (YYYY-MM-DD format) in detected timezone
                if (dateFrom && locDateStr < dateFrom) {
                    return;
                }
                if (dateTo && locDateStr > dateTo) {
                    return;
        }
            }
            
            filteredLocationCount++;
    });
    });
    
    const totalLocationsEl = document.getElementById('totalLocations');
    const lastUpdateEl = document.getElementById('lastUpdateTime');
    
    // Always show filtered count (what's actually displayed on map)
    const displayCount = filteredLocationCount;
    console.log(`[updateStatistics] Showing filtered count: ${displayCount}`);
    
    // Update scorecard
    if (totalLocationsEl) {
        totalLocationsEl.textContent = displayCount;
    }
    
    // Update header to match scorecard
    if (lastUpdateEl && totalDbLocationCount !== null) {
        // Only update if we have DB data (not CSV fallback)
        const dataSource = lastUpdateEl.getAttribute('data-source') || 'database';
        if (dataSource === 'database') {
            lastUpdateEl.innerHTML = `<span style="color: #10b981; font-weight: 600;">DB: ${displayCount} locations</span>`;
            lastUpdateEl.title = `Data loaded from PostgreSQL database (${displayCount} locations - showing filtered)`;
        }
    }
    
    const filteredAnimals = animals.filter(animal =>
        selectedTrackerIds.includes(String(animal.id)) &&
        (status === 'all' || animal.status === status) &&
        matchesFilter(animal.type, type) &&
        matchesFilter(animal.family, family)
    );

    if (filteredAnimals.length > 0) {
        const now = new Date();
        const updateTimes = filteredAnimals
            .filter(a => {
                if (!a.lastUpdate) {
                    console.log(`[updateStatistics] Animal ${a.id} (${a.name}) has no lastUpdate`);
            return false;
        }
                const lastUpdateDate = new Date(a.lastUpdate);
                const isValid = !isNaN(lastUpdateDate.getTime());
                const isNotFuture = lastUpdateDate <= now + 60000; // Allow 1 minute clock skew
                
                if (!isValid) {
                    console.log(`[updateStatistics] Animal ${a.id} (${a.name}) has invalid lastUpdate: ${a.lastUpdate}`);
                } else if (!isNotFuture) {
                    console.log(`[updateStatistics] Animal ${a.id} (${a.name}) has future lastUpdate: ${a.lastUpdate} (now: ${now.toISOString()})`);
                }
                
                // Only include valid dates that are in the past (or very recent future due to clock skew)
                return isValid && isNotFuture;
            })
            .map(a => {
                const lastUpdateDate = new Date(a.lastUpdate);
                // Calculate time difference (should always be positive for past dates)
                const diff = now - lastUpdateDate;
                // Use absolute value as safety, but should already be positive
                return Math.abs(diff);
            });
        
        console.log(`[updateStatistics] Found ${updateTimes.length} valid update times out of ${filteredAnimals.length} filtered animals`);
        
        if (updateTimes.length > 0) {
            const avgMs = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
            if (avgUpdateEl && avgMs >= 0) {
                avgUpdateEl.textContent = formatTimeAgo(avgMs);
            } else if (avgUpdateEl) {
                avgUpdateEl.textContent = '--';
            }
        } else {
            console.warn(`[updateStatistics] No valid update times found. Showing '--'`);
            if (avgUpdateEl) {
                avgUpdateEl.textContent = '--';
            }
        }
    } else {
        if (avgUpdateEl) {
            avgUpdateEl.textContent = '--';
        }
    }

    const batteries = filteredAnimals
        .map(a => a.batteryPercent)
        .filter(b => b !== null && !Number.isNaN(b));
    
    if (batteries.length > 0) {
        const avg = Math.round(batteries.reduce((a, b) => a + b, 0) / batteries.length);
        if (avgBatteryEl) {
            avgBatteryEl.textContent = `${avg}%`;
    }
    } else {
        if (avgBatteryEl) {
            avgBatteryEl.textContent = 'N/A';
        }
    }

    const alertsCount = filteredAnimals.filter(a => a.status === 'alert').length;
    if (alertsEl) {
        alertsEl.textContent = alertsCount;
    }
}


/**
 * Initialize event listeners
 */
/**
 * Initialize filters toggle functionality
 */
function initFiltersToggle() {
    // Sidebar filters removed; filters are in the top bar dropdown only
}

/**
 * Download CSV with filtered location data
 */
function downloadCSV() {
    try {
        // Get current filter selections
        const { status: statusFilter, type: typeFilter, family: familyFilter } = getFilterSelections();
        const dateFromInput = document.getElementById('dateFromBar');
        const dateToInput = document.getElementById('dateToBar');
        const trackerFilter = document.getElementById('trackerFilter');
        
        const dateFrom = dateFromInput ? dateFromInput.value : null;
        const dateTo = dateToInput ? dateToInput.value : null;
        const selectedTrackerIds = (
            trackerFilter && trackerFilter.selectedTrackerIds && trackerFilter.selectedTrackerIds.size > 0
                ? Array.from(trackerFilter.selectedTrackerIds)
                : allSelectedTrackerIds.size > 0 ? Array.from(allSelectedTrackerIds) : animals.map(a => a.id)
        ).map(String);

        // Collect all locations from filtered animals
        const csvData = [];

        animals.forEach(animal => {
            // Apply tracker filter
            if (!selectedTrackerIds.includes(String(animal.id))) {
                return;
            }
            
            // Apply status filter
            if (statusFilter !== 'all' && animal.status !== statusFilter) {
                return;
            }
            
            // Apply type filter
            if (typeFilter !== 'all' && !matchesFilter(animal.type, typeFilter)) {
                return;
            }
            
            // Apply family filter
            if (familyFilter !== 'all' && !matchesFilter(animal.family, familyFilter)) {
                return;
            }
            
            // Process each location
            animal.locations.forEach(location => {
                // Apply date filter
                if (dateFrom || dateTo) {
                    const locDate = new Date(location.timestamp);
                    if (isNaN(locDate.getTime())) {
                        return;
                    }
                    
                    const tz = detectedTimezone || 'UTC';
                    const locDateStr = getDateStringInTimezone(locDate, tz);
                    if (!locDateStr) return;
                    
                    if (dateFrom && locDateStr < dateFrom) {
                        return;
                    }
                    if (dateTo && locDateStr > dateTo) {
                        return;
                    }
                }
                
                // Format timestamp for CSV
                const timestamp = new Date(location.timestamp).toISOString();
                
                // Add row to CSV data
                csvData.push({
                    tracker_id: animal.id || '',
                    tracker_name: animal.name || '',
                    tracker_family: animal.family || '',
                    tracker_type: animal.type || '',
                    tracker_status: animal.status || '',
                    lat: !isNaN(location.lat) ? location.lat.toString() : '',
                    long: !isNaN(location.lng) ? location.lng.toString() : '',
                    timestamp: timestamp
                });
            });
        });
        
        // Check if there's any data to export
        if (csvData.length === 0) {
            alert('No location data available to download. Please check your filters or refresh the data.');
            return;
        }
        
        // Sort by timestamp (oldest first)
        csvData.sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Generate CSV content
        const headers = ['tracker_id', 'tracker_name', 'tracker_family', 'tracker_type', 'tracker_status', 'lat', 'long', 'timestamp'];
        const csvRows = csvData.map(row => {
            return headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        
        const csvContent = headers.join(',') + '\n' + csvRows.join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `tracker_locations_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`[downloadCSV] Downloaded CSV with ${csvData.length} locations`);
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Error downloading CSV: ' + error.message);
    }
}

function initEventListeners() {
    // Sidebar fold/collapse
    const sidebar = document.getElementById('dashboardSidebar');
    const sidebarFoldBtn = document.getElementById('sidebarFoldBtn');
    if (sidebar && sidebarFoldBtn) {
        sidebarFoldBtn.addEventListener('click', () => {
            const collapsed = sidebar.classList.toggle('sidebar-collapsed');
            sidebar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            sidebarFoldBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
            sidebarFoldBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        });
    }

    // Download CSV button
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', downloadCSV);
    }
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        const btn = document.getElementById('refreshBtn');
        btn.classList.add('loading');
        loadMockData().finally(() => {
            btn.classList.remove('loading');
        });
    });
    
    // Toggle all trackers button (legacy; sidebar uses #trackerFilterSelectAll)
    const toggleAllBtn = document.getElementById('toggleAllTrackers');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', toggleAllTrackers);
    }

    const trackerFilterSelectAll = document.getElementById('trackerFilterSelectAll');
    if (trackerFilterSelectAll) {
        trackerFilterSelectAll.addEventListener('change', () => {
            const trackerFilter = document.getElementById('trackerFilter');
            if (!trackerFilter) return;
            const allItems = trackerFilter.querySelectorAll('.tracker-filter-item');
            const selected = trackerFilter.selectedTrackerIds || new Set();
            if (trackerFilterSelectAll.checked) {
                allItems.forEach(item => {
                    selected.add(item.dataset.trackerId);
                    item.classList.add('selected');
                });
            } else {
                allItems.forEach(item => {
                    selected.delete(item.dataset.trackerId);
                    item.classList.remove('selected');
                });
            }
            trackerFilter.selectedTrackerIds = selected;
            trackerFilterSelectAll.indeterminate = false;
            updateMap();
            updateStatistics();
            renderAnimalList();
            updateTrackerMultiselectLabel();
        });
    }
    
    ['statusFilter', 'typeFilter', 'familyFilter'].forEach(filterId => {
        const filterEl = document.getElementById(filterId);
        if (filterEl) {
            filterEl.addEventListener('change', () => {
                console.log(`[${filterId}] Filter changed, updating views`);
        updateMap();
        updateStatistics();
        renderAnimalList();
            });
        }
    });
    
    // Search trackers (top bar)
    const searchTrackersInput = document.getElementById('searchTrackersInput');
    if (searchTrackersInput) {
        searchTrackersInput.addEventListener('input', () => {
            renderAnimalList();
        });
    }

    // Visualization mode tabs (Live, Path, Heatmap, Timeline)
    const vizTabs = document.querySelectorAll('.viz-tab');
    const visualizationModeSelect = document.getElementById('visualizationMode');
    if (vizTabs.length && visualizationModeSelect) {
        vizTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                if (!mode) return;
                vizTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                visualizationModeSelect.value = mode;
                const showDistanceGroup = document.getElementById('showDistanceGroup');
                if (showDistanceGroup) {
                    showDistanceGroup.style.display = (mode === 'path' || mode === 'pathWithDirections') ? 'block' : 'none';
                }
                updateMap();
            });
        });
    }

    // Filters dropdown (top bar): toggle panel; filters are only in the top bar now
    const filtersDropdownBtn = document.getElementById('filtersDropdownBtn');
    const filtersDropdownPanel = document.getElementById('filtersDropdownPanel');
    const applyBarFilters = () => {
        updateMap();
        updateStatistics();
        renderAnimalList();
    };
    if (filtersDropdownBtn && filtersDropdownPanel) {
        filtersDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = filtersDropdownPanel.getAttribute('hidden') === null;
            if (isOpen) {
                filtersDropdownPanel.setAttribute('hidden', '');
                filtersDropdownBtn.setAttribute('aria-expanded', 'false');
            } else {
                filtersDropdownPanel.removeAttribute('hidden');
                filtersDropdownBtn.setAttribute('aria-expanded', 'true');
            }
        });
        ['statusFilterBar', 'typeFilterBar', 'familyFilterBar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyBarFilters);
        });
        const dateFromBar = document.getElementById('dateFromBar');
        const dateToBar = document.getElementById('dateToBar');
        if (dateFromBar) dateFromBar.addEventListener('change', applyBarFilters);
        if (dateToBar) dateToBar.addEventListener('change', applyBarFilters);
        const repeaterCoverageFilter = document.getElementById('repeaterCoverageFilter');
        if (repeaterCoverageFilter) repeaterCoverageFilter.addEventListener('change', applyBarFilters);
        document.addEventListener('click', () => {
            if (filtersDropdownPanel.getAttribute('hidden') === null) {
                filtersDropdownPanel.setAttribute('hidden', '');
                filtersDropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });
        filtersDropdownPanel.addEventListener('click', (e) => e.stopPropagation());
    }
    
    // Visualization mode listener
    const visualizationMode = document.getElementById('visualizationMode');
    const showDistanceGroup = document.getElementById('showDistanceGroup');
    const showDistanceCheckbox = document.getElementById('showDistanceCheckbox');
    
    if (visualizationMode) {
        // Show/hide distance checkbox based on mode
        const updateDistanceCheckboxVisibility = () => {
            const mode = visualizationMode.value;
            if (showDistanceGroup) {
                if (mode === 'path' || mode === 'pathWithDirections') {
                    showDistanceGroup.style.display = 'block';
                } else {
                    showDistanceGroup.style.display = 'none';
                    if (showDistanceCheckbox) {
                        showDistanceCheckbox.checked = false;
                    }
                }
            }
        };
        
        // Initial state
        updateDistanceCheckboxVisibility();
        
        visualizationMode.addEventListener('change', () => {
            updateDistanceCheckboxVisibility();
            updateMap();
        });
        
        // Distance checkbox listener
        if (showDistanceCheckbox) {
            showDistanceCheckbox.addEventListener('change', () => {
            updateMap();
        });
    }
}

    // Modal event listeners
    initModalEventListeners();
}

/**
 * Initialize modal event listeners
 */
function initModalEventListeners() {
    const modal = document.getElementById('editTrackerModal');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditModal');
    const form = document.getElementById('editTrackerForm');
    
    if (!modal) {
        console.warn('Edit tracker modal not found - modal functionality will not work');
        return;
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeEditTrackerModal();
        }
    });
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeEditTrackerModal);
    }
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeEditTrackerModal);
    }

    // Tracker detail card (overlay on map): Close and Edit
    const detailCardClose = document.getElementById('detailCardClose');
    const detailCardEditBtn = document.getElementById('detailCardEditBtn');
    if (detailCardClose) {
        detailCardClose.addEventListener('click', function() {
            hideTrackerDetailCard();
            selectedAnimalId = null;
            selectedLocation = null;
            updateMap();
            renderAnimalList();
        });
    }
    if (detailCardEditBtn) {
        detailCardEditBtn.addEventListener('click', function() {
            const trackerId = detailCardEditBtn.dataset.trackerId;
            if (trackerId) openEditTrackerModal(trackerId);
        });
    }
    
    // Toggle between dropdown and input for animal type
    const toggleTypeBtn = document.getElementById('toggleTypeNew');
    const typeSelect = document.getElementById('editAnimalType');
    const typeInput = document.getElementById('editAnimalTypeNew');
    
    if (toggleTypeBtn && typeSelect && typeInput) {
        toggleTypeBtn.addEventListener('click', function() {
            if (typeInput.style.display === 'none') {
                typeSelect.style.display = 'none';
                typeInput.style.display = 'block';
                typeInput.value = typeSelect.value || '';
                typeInput.focus();
                toggleTypeBtn.textContent = '← Use Existing Type';
            } else {
                typeInput.style.display = 'none';
                typeSelect.style.display = 'block';
                typeSelect.value = '';
                toggleTypeBtn.textContent = '+ Add New Type';
            }
        });
    }
    
    // Toggle between dropdown and input for family
    const toggleFamilyBtn = document.getElementById('toggleFamilyNew');
    const familySelect = document.getElementById('editFamily');
    const familyInput = document.getElementById('editFamilyNew');
    
    if (toggleFamilyBtn && familySelect && familyInput) {
        toggleFamilyBtn.addEventListener('click', function() {
            if (familyInput.style.display === 'none') {
                familySelect.style.display = 'none';
                familyInput.style.display = 'block';
                familyInput.value = familySelect.value || '';
                familyInput.focus();
                toggleFamilyBtn.textContent = '← Use Existing Family';
            } else {
                familyInput.style.display = 'none';
                familySelect.style.display = 'block';
                familySelect.value = '';
                toggleFamilyBtn.textContent = '+ Add New Family';
            }
        });
    }
    
    // Manage Types button
    const manageTypesBtn = document.getElementById('manageTypesBtn');
    const typesList = document.getElementById('typesList');
    if (manageTypesBtn && typesList) {
        manageTypesBtn.addEventListener('click', function() {
            if (typesList.style.display === 'none') {
                typesList.style.display = 'block';
                renderTypesList();
                manageTypesBtn.textContent = 'Hide Types';
            } else {
                typesList.style.display = 'none';
                manageTypesBtn.textContent = 'Manage Types';
            }
        });
    }
    
    // Manage Families button
    const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
    const familiesList = document.getElementById('familiesList');
    if (manageFamiliesBtn && familiesList) {
        manageFamiliesBtn.addEventListener('click', function() {
            if (familiesList.style.display === 'none') {
                familiesList.style.display = 'block';
                renderFamiliesList();
                manageFamiliesBtn.textContent = 'Hide Families';
            } else {
                familiesList.style.display = 'none';
                manageFamiliesBtn.textContent = 'Manage Families';
            }
        });
    }
    
    // Form submission
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!currentEditingTracker) {
                showError('No tracker selected for editing');
                return;
            }
            
            // Get form values
            const animalName = document.getElementById('editAnimalName').value.trim();
            let animalType = '';
            let family = '';
            
            // Get animal type (from dropdown or input)
            const typeSelectEl = document.getElementById('editAnimalType');
            const typeInputEl = document.getElementById('editAnimalTypeNew');
            if (typeInputEl && typeInputEl.style.display !== 'none' && typeInputEl.value.trim()) {
                animalType = typeInputEl.value.trim();
            } else if (typeSelectEl && typeSelectEl.value) {
                animalType = typeSelectEl.value;
            }
            
            // Get family (from dropdown or input)
            const familySelectEl = document.getElementById('editFamily');
            const familyInputEl = document.getElementById('editFamilyNew');
            if (familyInputEl && familyInputEl.style.display !== 'none' && familyInputEl.value.trim()) {
                family = familyInputEl.value.trim();
            } else if (familySelectEl && familySelectEl.value) {
                family = familySelectEl.value;
            }
            
            // Validate
            if (!animalName) {
                showError('Animal name is required');
                return;
            }
            
            if (!animalType) {
                showError('Animal type is required');
                return;
            }
            
            // Normalize and check for duplicates
            if (animalType) {
                const normalizedType = normalizeForDuplicateCheck(animalType);
                
                // Check if this type already exists (case-insensitive)
                const existingTypes = new Set();
                animals.forEach(animal => {
                    if (animal.type) {
                        existingTypes.add(normalizeForDuplicateCheck(animal.type));
                    }
                });
                
                // Also check current dropdown options
                if (typeSelectEl) {
                    Array.from(typeSelectEl.options).forEach(opt => {
                        if (opt.value) {
                            existingTypes.add(normalizeForDuplicateCheck(opt.value));
                        }
                    });
                }
                
                // Check for duplicate (but allow if it's the same as current tracker's type)
                const currentTracker = animals.find(a => a.id === currentEditingTracker);
                const currentNormalized = currentTracker && currentTracker.type ? normalizeForDuplicateCheck(currentTracker.type) : null;
                
                if (existingTypes.has(normalizedType) && normalizedType !== currentNormalized) {
                    if (!confirm(`The type "${normalizedType}" already exists. Do you want to use the existing type instead?`)) {
                        return;
                    }
                    // Use the existing normalized value
                    const existingType = Array.from(existingTypes).find(t => normalizeForDuplicateCheck(t) === normalizedType);
                    animalType = existingType || normalizedType;
                } else {
                    animalType = normalizedType;
                }
            }
            
            if (family) {
                const normalizedFamily = normalizeForDuplicateCheck(family);
                
                // Check if this family already exists
                const existingFamilies = new Set();
                animals.forEach(animal => {
                    if (animal.family) {
                        existingFamilies.add(normalizeForDuplicateCheck(animal.family));
                    }
                });
                
                // Also check current dropdown options
                if (familySelectEl) {
                    Array.from(familySelectEl.options).forEach(opt => {
                        if (opt.value) {
                            existingFamilies.add(normalizeForDuplicateCheck(opt.value));
                        }
                    });
                }
                
                // Check for duplicate (but allow if it's the same as current tracker's family)
                const currentTracker = animals.find(a => a.id === currentEditingTracker);
                const currentNormalized = currentTracker && currentTracker.family ? normalizeForDuplicateCheck(currentTracker.family) : null;
                
                if (existingFamilies.has(normalizedFamily) && normalizedFamily !== currentNormalized) {
                    if (!confirm(`The family "${normalizedFamily}" already exists. Do you want to use the existing family instead?`)) {
                        return;
                    }
                    // Use the existing normalized value
                    const existingFamily = Array.from(existingFamilies).find(f => normalizeForDuplicateCheck(f) === normalizedFamily);
                    family = existingFamily || normalizedFamily;
                } else {
                    family = normalizedFamily;
                }
            }
            
            // Submit update
            try {
                const response = await fetch(`/api/trackers/${currentEditingTracker}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        animal_name: animalName,
                        animal_type: animalType,
                        family: family || null
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Failed to update tracker');
                }
                
                // Success - show message but keep modal open
                showSuccess('Tracker updated successfully');
                
                // Reload dashboard data
                await loadMockData();
                
                // Refresh the dropdowns with updated data (new types/families will appear)
                const tracker = data.tracker;
                populateTypeDropdown(tracker.animal_type);
                populateFamilyDropdown(tracker.family);
                
                // Update form fields with saved values
                document.getElementById('editAnimalName').value = tracker.animal_name || '';
                
                // Set the current values in dropdowns/inputs
                const typeSelect = document.getElementById('editAnimalType');
                const typeInput = document.getElementById('editAnimalTypeNew');
                const toggleTypeBtn = document.getElementById('toggleTypeNew');
                
                if (tracker.animal_type && typeSelect) {
                    // Check if value exists in dropdown (it should now after refresh)
                    const option = Array.from(typeSelect.options).find(opt => opt.value === tracker.animal_type);
                    if (option) {
                        typeSelect.value = tracker.animal_type;
                        typeSelect.style.display = 'block';
                        if (typeInput) typeInput.style.display = 'none';
                        if (toggleTypeBtn) toggleTypeBtn.textContent = '+ Add New Type';
                    } else {
                        // Still not in dropdown - show in input field
                        if (typeInput) {
                            typeInput.value = tracker.animal_type;
                            typeInput.style.display = 'block';
                            typeSelect.style.display = 'none';
                            if (toggleTypeBtn) toggleTypeBtn.textContent = '← Use Existing Type';
                        }
                    }
                }
                
                const familySelect = document.getElementById('editFamily');
                const familyInput = document.getElementById('editFamilyNew');
                const toggleFamilyBtn = document.getElementById('toggleFamilyNew');
                
                if (tracker.family && familySelect) {
                    // Check if value exists in dropdown (it should now after refresh)
                    const option = Array.from(familySelect.options).find(opt => opt.value === tracker.family);
                    if (option) {
                        familySelect.value = tracker.family;
                        familySelect.style.display = 'block';
                        if (familyInput) familyInput.style.display = 'none';
                        if (toggleFamilyBtn) toggleFamilyBtn.textContent = '+ Add New Family';
                    } else {
                        // Still not in dropdown - show in input field
                        if (familyInput) {
                            familyInput.value = tracker.family;
                            familyInput.style.display = 'block';
                            familySelect.style.display = 'none';
                            if (toggleFamilyBtn) toggleFamilyBtn.textContent = '← Use Existing Family';
                        }
                    }
                }
                
            } catch (error) {
                console.error('Error updating tracker:', error);
                showError('Failed to update tracker: ' + error.message);
            }
        });
    }
}


/**
 * Format time for display (using detected timezone)
 */
function formatTime(date) {
    if (!date) return 'Never';
    
    // Handle string dates
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return 'Never';
    
    const now = new Date();
    const diff = now - dateObj;
    
    // Use detected timezone for formatting
    const timezone = detectedTimezone || 'UTC';
    
    // Handle negative diff (future dates or clock skew) - should show as actual date
    if (diff < 0) {
        return formatDateInTimezone(dateObj, timezone);
    }
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour - show minutes
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    
    // Less than 24 hours - show hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    // More than 24 hours - show full date and time in detected timezone
    return formatDateInTimezone(dateObj, timezone);
}

/**
 * Format time ago
 */
function formatTimeAgo(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show data source indicator in the UI
 */
function showDataSourceIndicator(source, count) {
    const lastUpdateEl = document.getElementById('lastUpdateTime');
    if (lastUpdateEl) {
        // Store data source for later reference
        lastUpdateEl.setAttribute('data-source', source);
        lastUpdateEl.setAttribute('data-total-count', count !== 'unknown' ? count : '0');
        
        if (source === 'database') {
            // Initially show total DB count, but updateStatistics will sync it with scorecard
            const initialCount = count !== 'unknown' ? parseInt(count, 10) : 0;
            lastUpdateEl.innerHTML = `<span style="color: #10b981; font-weight: 600;">DB: ${initialCount} locations</span>`;
            lastUpdateEl.title = `Data loaded from PostgreSQL database (${initialCount} locations)`;
        } else if (source === 'csv') {
            lastUpdateEl.innerHTML = `<span style="color: #f59e0b; font-weight: 600;">CSV (fallback)</span>`;
            lastUpdateEl.title = 'Data loaded from CSV file (database unavailable)';
        }
    }
}

/**
 * Show error message
 */
function showError(message) {
    console.error(message);
    // Could add a toast notification here
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log(message);
    // Could add a toast notification here
    alert('Success: ' + message);
}

/**
 * Render all markers without connections (for "Only Markers" mode)
 */
function renderMarkersOnly(animal, sortedLocations, iconColor) {
    console.log(`[renderMarkersOnly] Rendering ${sortedLocations.length} markers for ${animal.id} (${animal.name})`);
    const animalMarkers = [];
    
    sortedLocations.forEach((location, index) => {
        const isSelected = selectedAnimalId != null && selectedLocation != null && isSameLocation(location, selectedLocation) && animal.id === selectedAnimalId;
        const isFaded = selectedAnimalId != null && !isSelected;
        const baseSize = index === sortedLocations.length - 1 ? 24 : 18;
        const size = isSelected ? Math.max(baseSize + 10, 32) : baseSize;
        const opacity = isFaded ? 0.35 : 1;
        
        const icon = L.divIcon({
            className: 'custom-marker' + (isSelected ? ' marker-selected' : '') + (isFaded ? ' marker-faded' : ''),
            html: `<div style="
                width: ${size}px;
                height: ${size}px;
                background: ${iconColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                opacity: ${opacity};
            "></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
        
        const marker = L.marker([location.lat, location.lng], {
            icon,
            zIndexOffset: isSelected ? 1000 : 0
        })
            .addTo(map)
            .on('click', () => { selectAnimal(animal.id, location); });
        
        animalMarkers.push(marker);
    });
    
    markers[animal.id] = animalMarkers;
}

/**
 * Render path with markers and polylines
 */
function renderPath(animal, sortedLocations, iconColor) {
    const animalMarkers = [];
    const pathCoordinates = [];
    const distanceLabels = [];
    
    // Check if distance checkbox is checked
    const showDistanceCheckbox = document.getElementById('showDistanceCheckbox');
    const showDistances = showDistanceCheckbox && showDistanceCheckbox.checked;
    
    sortedLocations.forEach((location, index) => {
        let distanceFromPrevious = null;
        if (index > 0) {
            const prevLocation = sortedLocations[index - 1];
            distanceFromPrevious = calculateDistance(prevLocation.lat, prevLocation.lng, location.lat, location.lng);
        }
        const isSelected = selectedAnimalId != null && selectedLocation != null && isSameLocation(location, selectedLocation) && animal.id === selectedAnimalId;
        const isFaded = selectedAnimalId != null && !isSelected;
        const baseSize = index === sortedLocations.length - 1 ? 24 : 16;
        const size = isSelected ? Math.max(baseSize + 10, 32) : baseSize;
        const opacity = isFaded ? 0.35 : 1;
        
        const icon = L.divIcon({
            className: 'custom-marker' + (isSelected ? ' marker-selected' : '') + (isFaded ? ' marker-faded' : ''),
            html: `<div style="
                width: ${size}px;
                height: ${size}px;
                background: ${iconColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                opacity: ${opacity};
            "></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
        
        const marker = L.marker([location.lat, location.lng], {
            icon,
            zIndexOffset: isSelected ? 1000 : 0
        })
            .addTo(map)
            .on('click', () => { selectAnimal(animal.id, location); });
        
        animalMarkers.push(marker);
        pathCoordinates.push([location.lat, location.lng]);
        
        if (index > 0 && distanceFromPrevious !== null && showDistances) {
            const prevLocation = sortedLocations[index - 1];
            const midLat = (prevLocation.lat + location.lat) / 2;
            const midLng = (prevLocation.lng + location.lng) / 2;
            
            const distanceText = formatDistance(distanceFromPrevious);
            // Estimate width based on text length (smaller boxes)
            const estimatedWidth = Math.max(45, distanceText.length * 6 + 10);
            const labelHeight = 18;
            
            const distanceLabel = L.divIcon({
                className: 'distance-label',
                html: `<div style="
                    background: white;
                    border: 2px solid ${iconColor};
                    border-radius: 4px;
                    padding: 2px 6px;
                    font-size: 11px;
                    font-weight: bold;
                    color: ${iconColor};
                    white-space: nowrap;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    text-align: center;
                    pointer-events: none;
                    font-family: Arial, sans-serif;
                    line-height: ${labelHeight - 4}px;
                    min-width: ${estimatedWidth}px;
                ">${distanceText}</div>`,
                iconSize: [estimatedWidth, labelHeight],
                iconAnchor: [estimatedWidth / 2, labelHeight / 2]
            });
            
            const labelMarker = L.marker([midLat, midLng], {
                icon: distanceLabel,
                interactive: false,
                zIndexOffset: 1000
            }).addTo(map);
            
            console.log(`[renderPath] Added distance label: ${distanceText} at (${midLat.toFixed(4)}, ${midLng.toFixed(4)})`);
            distanceLabels.push(labelMarker);
        }
    });
    
    // Store all markers as an array so they can all be cleared
    markers[animal.id] = animalMarkers;
    
    if (pathCoordinates.length > 1) {
        const lineOpacity = selectedAnimalId != null && animal.id !== selectedAnimalId ? 0.3 : 0.7;
        const polyline = L.polyline(pathCoordinates, {
            color: iconColor,
            weight: 3,
            opacity: lineOpacity,
            smoothFactor: 1
        }).addTo(map);
        polylines[animal.id] = [polyline, ...distanceLabels];
    }
}

/**
 * Render path with directions (markers, polylines, and directional arrows)
 */
function renderPathWithDirections(animal, sortedLocations, iconColor) {
    console.log(`[renderPathWithDirections] Rendering path with directions for ${animal.id} (${animal.name}) with ${sortedLocations.length} locations`);
    const animalMarkers = [];
    const pathCoordinates = [];
    const arrowMarkers = [];
    
    // Check if distance checkbox is checked
    const showDistanceCheckbox = document.getElementById('showDistanceCheckbox');
    const showDistances = showDistanceCheckbox && showDistanceCheckbox.checked;
    
    sortedLocations.forEach((location, index) => {
        const isSelected = selectedAnimalId != null && selectedLocation != null && isSameLocation(location, selectedLocation) && animal.id === selectedAnimalId;
        const isFaded = selectedAnimalId != null && !isSelected;
        const baseSize = index === sortedLocations.length - 1 ? 24 : 16;
        const size = isSelected ? Math.max(baseSize + 10, 32) : baseSize;
        const opacity = isFaded ? 0.35 : 1;
        
        const icon = L.divIcon({
            className: 'custom-marker' + (isSelected ? ' marker-selected' : '') + (isFaded ? ' marker-faded' : ''),
            html: `<div style="
                width: ${size}px;
                height: ${size}px;
                background: ${iconColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                opacity: ${opacity};
            "></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
        
        const marker = L.marker([location.lat, location.lng], {
            icon,
            zIndexOffset: isSelected ? 1000 : 0
        })
            .addTo(map)
            .on('click', () => { selectAnimal(animal.id, location); });
        
        animalMarkers.push(marker);
        pathCoordinates.push([location.lat, location.lng]);
    });
    
    const arrowOpacity = selectedAnimalId != null && animal.id !== selectedAnimalId ? 0.35 : 1;
    // Add directional arrows and distance labels after all markers are created
    sortedLocations.forEach((location, index) => {
        if (index < sortedLocations.length - 1) {
            const nextLocation = sortedLocations[index + 1];
            const midLat = (location.lat + nextLocation.lat) / 2;
            const midLng = (location.lng + nextLocation.lng) / 2;
            
            const distance = calculateDistance(
                location.lat, location.lng,
                nextLocation.lat, nextLocation.lng
            );
            
            const bearing = calculateBearing(location.lat, location.lng, nextLocation.lat, nextLocation.lng);
            console.log(`[renderPathWithDirections] Adding arrow at index ${index}, bearing: ${bearing.toFixed(1)}°`);
            
            const arrowSize = 28;
            const arrowIcon = L.divIcon({
                className: 'direction-arrow',
                html: `<div style="
                    width: ${arrowSize}px;
                    height: ${arrowSize}px;
                    transform: rotate(${bearing}deg);
                    transform-origin: center;
                    opacity: ${arrowOpacity};
                ">
                    <svg width="${arrowSize}" height="${arrowSize}" viewBox="0 0 ${arrowSize} ${arrowSize}" style="display: block;">
                        <path d="M ${arrowSize/2} 2 L ${arrowSize/2} ${arrowSize-6} L ${arrowSize/2-6} ${arrowSize-8} Z" 
                              fill="${iconColor}" 
                              opacity="1"/>
                        <path d="M ${arrowSize/2} 2 L ${arrowSize/2} ${arrowSize-6} L ${arrowSize/2+6} ${arrowSize-8} Z" 
                              fill="${iconColor}" 
                              opacity="1"/>
                    </svg>
                </div>`,
                iconSize: [arrowSize, arrowSize],
                iconAnchor: [arrowSize/2, arrowSize/2]
            });
            
            const arrowMarker = L.marker([midLat, midLng], { 
                icon: arrowIcon,
                interactive: false,
                zIndexOffset: 1500  // High z-index to ensure arrows are always visible above everything
            }).addTo(map);
            
            arrowMarkers.push(arrowMarker);
            
            // Add distance label only if checkbox is checked
            if (showDistances) {
                // Position distance label along the line path to avoid arrow overlap
                // Arrow is at midpoint (0.5), so we place label closer to start/end (15% or 85%) for maximum separation
                const labelPosition = index % 2 === 0 ? 0.15 : 0.85; // Alternate between 15% and 85% along segment
                const labelLat = location.lat + (nextLocation.lat - location.lat) * labelPosition;
                const labelLng = location.lng + (nextLocation.lng - location.lng) * labelPosition;
                
                const distanceText = formatDistance(distance);
                // Estimate width based on text length (smaller boxes)
                const estimatedWidth = Math.max(45, distanceText.length * 6 + 10);
                const labelHeight = 18;
                
                const distanceLabel = L.divIcon({
                    className: 'distance-label',
                    html: `<div style="
                        background: white;
                        border: 2px solid ${iconColor};
                        border-radius: 4px;
                        padding: 2px 6px;
                        font-size: 11px;
                        font-weight: bold;
                        color: ${iconColor};
                        white-space: nowrap;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                        text-align: center;
                        pointer-events: none;
                        font-family: Arial, sans-serif;
                        line-height: ${labelHeight - 4}px;
                        min-width: ${estimatedWidth}px;
                    ">${distanceText}</div>`,
                    iconSize: [estimatedWidth, labelHeight],
                    iconAnchor: [estimatedWidth / 2, labelHeight / 2]
                });
                
                const labelMarker = L.marker([labelLat, labelLng], {
                    icon: distanceLabel,
                    interactive: false,
                    zIndexOffset: 1400  // Lower than arrows but still high
                }).addTo(map);
                
                console.log(`[renderPathWithDirections] Added distance label: ${distanceText} at (${labelLat.toFixed(4)}, ${labelLng.toFixed(4)})`);
                arrowMarkers.push(labelMarker);
            }
            
            console.log(`[renderPathWithDirections] Arrow and distance label added at (${midLat.toFixed(4)}, ${midLng.toFixed(4)})`);
        }
    });
    
    console.log(`[renderPathWithDirections] Created ${animalMarkers.length} markers and ${arrowMarkers.length} arrows`);
    
    // Store all markers as an array so they can all be cleared
    markers[animal.id] = animalMarkers;
    
    if (pathCoordinates.length > 1) {
        const lineOpacity = selectedAnimalId != null && animal.id !== selectedAnimalId ? 0.3 : 0.7;
        const polyline = L.polyline(pathCoordinates, {
            color: iconColor,
            weight: 3,
            opacity: lineOpacity,
            smoothFactor: 1
        }).addTo(map);
        polylines[animal.id] = [polyline, ...arrowMarkers];
        console.log(`[renderPathWithDirections] Polyline created with ${pathCoordinates.length} points`);
    }
}

/**
 * Calculate bearing (direction) between two points in degrees
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * Get or assign a unique color for an animal
 */
function getAnimalColor(animalId) {
    // If color already assigned, return it
    if (animalColors[animalId]) {
        return animalColors[animalId];
    }
    
    // Color palette - distinct colors that work well on maps
    const colorPalette = [
        '#3B82F6', // Blue
        '#10B981', // Green
        '#F59E0B', // Amber/Orange
        '#EF4444', // Red
        '#8B5CF6', // Purple
        '#06B6D4', // Cyan
        '#F97316', // Orange
        '#84CC16', // Lime
        '#EC4899', // Pink
        '#14B8A6', // Teal
        '#6366F1', // Indigo
        '#F43F5E', // Rose
        '#22C55E', // Emerald
        '#A855F7', // Violet
        '#0EA5E9'  // Sky Blue
    ];
    
    // Assign color based on animal index (use hash of ID for consistency)
    const animalIndex = animals.findIndex(a => a.id === animalId);
    const colorIndex = animalIndex >= 0 ? animalIndex % colorPalette.length : Math.abs(hashCode(animalId)) % colorPalette.length;
    const color = colorPalette[colorIndex];
    
    // Store the color assignment
    animalColors[animalId] = color;
    
    console.log(`[getAnimalColor] Assigned color ${color} to animal ${animalId}`);
    
    return color;
}

/**
 * Simple hash function for consistent color assignment
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Calculate battery percentage based on current and initial voltages
 */
function calculateBatteryPercentage(currentVoltage, initialVoltage) {
    if (currentVoltage === null || currentVoltage === undefined) {
        return null;
    }
    const initial = initialVoltage || currentVoltage;
    if (!initial || initial <= 0) {
        return null;
    }
    const percentage = (currentVoltage / initial) * 100;
    return Math.max(0, Math.min(100, Math.round(percentage)));
}

/**
 * Format battery display string showing voltage and percentage (if available)
 */
function formatBattery(currentVoltage, percentage) {
    if (currentVoltage === null || currentVoltage === undefined) {
        return 'N/A';
    }
    const voltageText = `${currentVoltage.toFixed(2)}V`;
    if (percentage === null || Number.isNaN(percentage)) {
        return voltageText;
    }
    return `${voltageText} (${percentage}%)`;
}

function normalizeAttribute(value) {
    if (value === undefined || value === null) {
        return 'Unknown';
    }
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : 'Unknown';
}

/**
 * Normalize attribute value for duplicate checking
 * Converts to consistent format (title case, trimmed, no extra spaces)
 */
function normalizeForDuplicateCheck(value) {
    if (!value || typeof value !== 'string') return '';
    // Trim and replace multiple spaces with single space
    const normalized = value.trim().replace(/\s+/g, ' ');
    // Convert to title case: first letter of each word uppercase
    return normalized
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function matchesFilter(value, filterValue) {
    if (!filterValue || filterValue === 'all') {
        return true;
    }
    return normalizeAttribute(value) === filterValue;
}

function getFilterSelections() {
    const status = document.getElementById('statusFilterBar')?.value || 'all';
    const type = document.getElementById('typeFilterBar')?.value || 'all';
    const family = document.getElementById('familyFilterBar')?.value || 'all';
    const showRepeaterCoverage = document.getElementById('repeaterCoverageFilter')?.checked === true;

    let effectiveStatus = status;
    let effectiveType = type;
    if (sidebarQuickFilter.mode === 'alerts') {
        effectiveStatus = 'alert';
    } else if (sidebarQuickFilter.mode === 'type' && sidebarQuickFilter.typeValue) {
        effectiveType = sidebarQuickFilter.typeValue;
    }

    return { status: effectiveStatus, type: effectiveType, family, showRepeaterCoverage };
}

/**
 * Calculate animal status based on battery level and last update time
 * Returns: 'active', 'inactive', or 'alert'
 */
function calculateAnimalStatus(animal) {
    const now = new Date();
    const lastUpdateTime = animal.lastUpdate ? new Date(animal.lastUpdate) : null;
    
    // Check if animal has no updates (inactive)
    if (!lastUpdateTime) {
        return 'inactive';
    }
    
    // Calculate time since last update (in hours)
    const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
    
    // Check battery level
    const batteryLevel = animal.batteryPercent;
    
    // Alert conditions:
    // 1. Battery is low (< 20%)
    // 2. No update for more than 24 hours (but less than 72 hours)
    if (batteryLevel !== null && batteryLevel < 20) {
        return 'alert'; // Low battery alert
    }
    
    // Inactive conditions:
    // 1. No update for more than 72 hours
    if (hoursSinceUpdate > 72) {
        return 'inactive';
    }
    
    // Alert conditions (continued):
    // 2. No update for more than 24 hours but less than 72 hours
    if (hoursSinceUpdate > 24) {
        return 'alert'; // No update for more than 24 hours
    }
    
    // Default: active
    return 'active';
}

/**
 * Get hint text explaining the status
 */
function getStatusHint(animal) {
    const now = new Date();
    const lastUpdateTime = animal.lastUpdate ? new Date(animal.lastUpdate) : null;
    const batteryLevel = animal.batteryPercent;
    
    if (animal.status === 'alert') {
        let reasons = [];
        if (batteryLevel !== null && batteryLevel < 20) {
            reasons.push(`Low battery: ${batteryLevel}%`);
        }
        if (lastUpdateTime) {
            const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
            if (hoursSinceUpdate > 24) {
                reasons.push(`No update for ${Math.round(hoursSinceUpdate)} hours`);
            }
        }
        return `Alert: ${reasons.join(', ')}`;
    } else if (animal.status === 'inactive') {
        if (lastUpdateTime) {
            const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
            return `Inactive: No update for ${Math.round(hoursSinceUpdate)} hours`;
        }
        return 'Inactive: No location updates';
    } else {
        // active
        if (lastUpdateTime) {
            const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
            if (hoursSinceUpdate < 1) {
                return `Active: Updated ${Math.round(hoursSinceUpdate * 60)} minutes ago`;
            }
            return `Active: Updated ${Math.round(hoursSinceUpdate)} hours ago`;
        }
        return 'Active: Tracker is functioning normally';
    }
}

/**
 * Distance from previous fix (last two locations) in km
 */
function getDistanceFromPrevious(animal) {
    if (!animal || !animal.locations || animal.locations.length < 2) return 0;
    const sorted = [...animal.locations].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    const prev = sorted[sorted.length - 2];
    const last = sorted[sorted.length - 1];
    const prevLat = prev.lat ?? prev.latitude;
    const prevLng = prev.lng ?? prev.longitude;
    const lastLat = last.lat ?? last.latitude;
    const lastLng = last.lng ?? last.longitude;
    if (prevLat == null || prevLng == null || lastLat == null || lastLng == null) return 0;
    return calculateDistance(prevLat, prevLng, lastLat, lastLng);
}

/**
 * Get distance from the previous location to the given location (in sorted order). Returns 0 if first or not found.
 */
function getDistanceFromPreviousToLocation(animal, targetLocation) {
    if (!animal || !animal.locations || animal.locations.length < 2 || !targetLocation) return 0;
    const sorted = [...animal.locations].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    const idx = sorted.findIndex(loc => isSameLocation(loc, targetLocation));
    if (idx <= 0) return 0;
    const prev = sorted[idx - 1];
    const last = sorted[idx];
    const prevLat = prev.lat ?? prev.latitude;
    const prevLng = prev.lng ?? prev.longitude;
    const lastLat = last.lat ?? last.latitude;
    const lastLng = last.lng ?? last.longitude;
    if (prevLat == null || prevLng == null || lastLat == null || lastLng == null) return 0;
    return calculateDistance(prevLat, prevLng, lastLat, lastLng);
}

/**
 * Show and populate the tracker detail card overlay, or hide it
 * When selectedLocation is set for this animal, shows that location's info; otherwise shows last location.
 */
// ── Tab map ────────────────────────────────────────────────────────────────
const TDC_TAB_PANELS = { detail: 'tdcPanelDetail', locations: 'tdcPanelLocations' };

function switchDetailTab(tabName) {
    detailCardCurrentTab = tabName;
    const card = document.getElementById('trackerDetailCard');
    if (!card) return;
    card.querySelectorAll('.tdc-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));
    card.querySelectorAll('.tdc-panel').forEach(p => { p.hidden = p.id !== TDC_TAB_PANELS[tabName]; });
}

function initDetailCardTabs() {
    if (_detailCardInited) return;
    _detailCardInited = true;
    const card = document.getElementById('trackerDetailCard');
    if (!card) return;

    // Tab clicks
    card.addEventListener('click', e => {
        const tab = e.target.closest('.tdc-tab[data-tab]');
        if (tab) switchDetailTab(tab.dataset.tab);
    });

    // Prev / Next
    document.getElementById('tdcLocPrev')?.addEventListener('click', () => navigateDetailLoc(-1));
    document.getElementById('tdcLocNext')?.addEventListener('click', () => navigateDetailLoc(1));

    // Jump input
    document.getElementById('tdcLocJumpInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= 1 && n <= _detailLocSorted.length) {
                const loc = _detailLocSorted[n - 1];
                _detailLocCurrentIdx = n - 1;
                const a = animals.find(x => String(x.id) === String(detailCardAnimalId));
                if (a && loc) selectAnimal(a.id, loc, { panToLocation: true });
            }
            e.target.value = '';
        }
    });
}

function navigateDetailLoc(delta) {
    const newIdx = Math.max(0, Math.min(_detailLocSorted.length - 1, _detailLocCurrentIdx + delta));
    if (newIdx === _detailLocCurrentIdx) return;
    const loc = _detailLocSorted[newIdx];
    const a = animals.find(x => String(x.id) === String(detailCardAnimalId));
    if (a && loc) { _detailLocCurrentIdx = newIdx; selectAnimal(a.id, loc, { panToLocation: true }); }
}

// ── Activity bar chart ──────────────────────────────────────────────────────
function drawDetailActivityChart(sortedAsc) {
    const canvas = document.getElementById('tdcActivityChart');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    const cssW = parent ? parent.clientWidth - 32 : 340;
    const cssH = 56;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const now = Date.now();
    const hourCounts = new Array(24).fill(0);
    sortedAsc.forEach(loc => {
        const ms = new Date(loc.timestamp).getTime();
        if (!isNaN(ms) && now - ms < 86400000) {
            hourCounts[new Date(loc.timestamp).getHours()]++;
        }
    });

    const maxCount = Math.max(1, ...hourCounts);
    const barSlot = cssW / 24;
    const gap = 2;
    const barW = Math.max(barSlot - gap, 2);

    ctx.clearRect(0, 0, cssW, cssH);
    hourCounts.forEach((count, i) => {
        const barH = count === 0 ? 3 : Math.max(6, (count / maxCount) * (cssH - 4));
        const x = i * barSlot + gap / 2;
        const y = cssH - barH;
        ctx.fillStyle = count === 0 ? 'rgba(196,165,116,0.14)' : `rgba(196,165,116,${0.45 + (count / maxCount) * 0.55})`;
        ctx.fillRect(x, y, barW, barH);
    });
}

// ── Render locations list ───────────────────────────────────────────────────
function renderDetailLocationsTab(animal, sortedDesc, currentIdx) {
    const tz = detectedTimezone || 'UTC';
    const n = sortedDesc.length;
    const sortedAsc = [...sortedDesc].reverse();

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('tdcLocEmoji', getTrackerTypeEmoji(animal.type));
    setEl('tdcLocName', animal.name || '--');
    setEl('tdcLocSubtitle', `${n} location${n !== 1 ? 's' : ''} recorded`);
    setEl('tdcLocFooter', `Showing ${n} of ${n} · Type a number + Enter to jump`);

    const prevBtn = document.getElementById('tdcLocPrev');
    const nextBtn = document.getElementById('tdcLocNext');
    if (prevBtn) prevBtn.disabled = currentIdx <= 0;
    if (nextBtn) nextBtn.disabled = currentIdx >= n - 1;

    const listEl = document.getElementById('tdcLocList');
    if (!listEl) return;
    listEl.innerHTML = '';

    sortedDesc.forEach((loc, idx) => {
        // Distance to previous (chronologically earlier = one index up in ascending array)
        const ascIdx = n - 1 - idx;
        let dist = '0 m';
        if (ascIdx > 0) {
            const prev = sortedAsc[ascIdx - 1];
            dist = formatDistance(calculateDistance(prev.lat, prev.lng, loc.lat, loc.lng));
        }

        const lat = Number(loc.lat).toFixed(4);
        const lng = Number(loc.lng).toFixed(4);
        let timeStr = '--';
        try {
            const d = new Date(loc.timestamp);
            timeStr = formatDateInTimezone(d, tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (_) {}

        const isAdmin = currentUser?.role === 'admin';
        const row = document.createElement('div');
        row.className = `tdc-loc-row${idx === currentIdx ? ' is-selected' : ''}`;
        row.dataset.locIdx = String(idx);
        row.innerHTML = `
            <span class="tdc-loc-index">#${idx + 1}</span>
            <div class="tdc-loc-body">
                <div class="tdc-loc-coords">${idx === currentIdx ? '' : escapeHtml(`${lat}, ${lng}`)}</div>
                <div class="tdc-loc-time">${escapeHtml(timeStr)}</div>
            </div>
            <span class="tdc-loc-dist">${escapeHtml(dist)}</span>
            ${isAdmin && loc.id ? `<button class="tdc-loc-delete-btn" title="Delete location" data-loc-id="${loc.id}">✕</button>` : ''}`;

        row.addEventListener('click', e => {
            if (e.target.closest('.tdc-loc-delete-btn')) return;
            _detailLocCurrentIdx = idx;
            const a = animals.find(x => String(x.id) === String(detailCardAnimalId));
            if (a) selectAnimal(a.id, loc, { panToLocation: true });
        });

        if (isAdmin && loc.id) {
            row.querySelector('.tdc-loc-delete-btn').addEventListener('click', e => {
                e.stopPropagation();
                deleteLocation(loc.id, animal.name, timeStr);
            });
        }

        listEl.appendChild(row);
    });

    // Scroll selected into view
    listEl.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
}

async function deleteLocation(locId, trackerName, timeStr) {
    const confirmed = window.confirm(
        `Delete location #${locId} from "${trackerName}"?\n\nTimestamp: ${timeStr}\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/locations/${locId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showError(data.error || 'Failed to delete location');
            return;
        }
        // Reload data to reflect the deletion
        await loadMockData();
    } catch (err) {
        showError('Failed to delete location: ' + err.message);
    }
}

// ── Main update function ────────────────────────────────────────────────────
function updateTrackerDetailCard(animal) {
    const card = document.getElementById('trackerDetailCard');
    if (!card) return;
    if (!animal) { card.style.display = 'none'; return; }

    initDetailCardTabs();
    card.style.display = 'flex';

    // Reset to Detail tab only when switching to a different animal
    const isNewAnimal = String(animal.id) !== String(detailCardAnimalId);
    if (isNewAnimal) {
        detailCardAnimalId = String(animal.id);
        switchDetailTab('detail');
    }

    const tz = detectedTimezone || 'UTC';
    const locs = Array.isArray(animal.locations) ? animal.locations : [];
    const sortedAsc = locs.length > 0 ? [...locs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
    const lastLoc = sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1] : null;
    const selectedLoc = (selectedLocation && String(animal.id) === String(selectedAnimalId))
        ? sortedAsc.find(l => isSameLocation(l, selectedLocation)) : null;
    const displayLoc = selectedLoc || lastLoc;

    // ── Detail tab fields ──────────────────────────────────────────────────
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '--'; };

    setEl('tdcAvatar', getTrackerTypeEmoji(animal.type));
    setEl('tdcName', animal.name || '--');
    const typePart  = normalizeAttribute(animal.type).replace(/\bUnknown\b/g, '').trim();
    const famPart   = normalizeAttribute(animal.family).replace(/\bUnknown\b/g, '').trim();
    setEl('tdcSub', [typePart, famPart].filter(Boolean).join(' · ') || '—');

    const statusBadge = document.getElementById('tdcStatusBadge');
    if (statusBadge) {
        const st = animal.status || 'inactive';
        statusBadge.className = `tdc-status-badge ${st}`;
        statusBadge.textContent = st;
    }

    let lastSeenStr = '--';
    if (displayLoc?.timestamp) {
        try { lastSeenStr = formatDateInTimezone(new Date(displayLoc.timestamp), tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }); } catch (_) {}
    }
    setEl('tdcLastSeen', lastSeenStr);

    const editBtn = document.getElementById('detailCardEditBtn');
    if (editBtn) editBtn.dataset.trackerId = animal.id;

    // Battery
    const pct = animal.batteryPercent != null ? Math.min(100, Math.max(0, Number(animal.batteryPercent))) : null;
    setEl('tdcBatteryPct', pct != null ? `${Math.round(pct)}%` : '--');
    const fillEl = document.getElementById('tdcBatteryFill');
    if (fillEl) fillEl.style.width = `${pct ?? 0}%`;

    setEl('tdcVoltage', animal.batteryVoltage != null ? `${Number(animal.batteryVoltage).toFixed(2)}V` : '--');
    setEl('tdcTotalDist', animal.totalDistance != null ? formatDistance(animal.totalDistance) : '--');
    setEl('tdcAvgDay', animal.avgDistancePerDay != null ? formatDistance(animal.avgDistancePerDay) : '--');
    setEl('tdcLocCount', sortedAsc.length);

    // Connectivity: Satellite (Myriota) or LoRa
    const nl = (animal.name || '').toLowerCase();
    const tl = (animal.type || '').toLowerCase();
    const isSatellite = nl.includes('myriota') || tl.includes('myriota') || nl.includes('satellite') || tl.includes('satellite');
    setEl('tdcConnectivity', isSatellite ? '🛰️ Satellite' : '📶 LoRa');

    // Activity chart
    requestAnimationFrame(() => drawDetailActivityChart(sortedAsc));

    // ── Locations tab ──────────────────────────────────────────────────────
    const sortedDesc = [...sortedAsc].reverse();
    _detailLocSorted = sortedDesc;

    let curIdx = 0;
    if (displayLoc) {
        const fi = sortedDesc.findIndex(l => isSameLocation(l, displayLoc));
        if (fi >= 0) curIdx = fi;
    }
    _detailLocCurrentIdx = curIdx;

    renderDetailLocationsTab(animal, sortedDesc, curIdx);
}

function hideTrackerDetailCard() {
    const card = document.getElementById('trackerDetailCard');
    if (card) card.style.display = 'none';
}


// ── Theme toggle ────────────────────────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('custodia-theme') || 'dark';
    applyTheme(saved);

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    });
})();

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('custodia-theme', theme);

    const icon = document.getElementById('themeToggleIcon');
    if (icon) {
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
}
