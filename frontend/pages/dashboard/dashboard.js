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
let selectedAnimalId = null;
let animalColors = {}; // Store color assignments for each animal
let animalLabelsVisible = {}; // Track which animals have labels visible

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    try {
        initDashboard();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        console.error('Error details:', error.message, error.stack);
    }
});

/**
 * Initialize dashboard
 */
function initDashboard() {
    initMap();
    loadMockData();
    initEventListeners();
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
        map = L.map('map').setView([24.7136, 46.6753], 8); // Default: Riyadh area
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
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
 * Load mock data from CSV
 */
async function loadMockData() {
    try {
        console.log('Loading location data...');
        
        // Try database endpoint first, then fallback to CSV
        let csvPath = '/api/locations';
        let response = await fetch(csvPath);
        
        if (!response.ok) {
            console.log('Database endpoint failed, trying CSV fallback...');
            // Fallback to CSV endpoint
            csvPath = '/api/mock-locations';
            response = await fetch(csvPath);
        }
        
        if (!response.ok) {
            // Final fallback to static file path
            csvPath = '/frontend/pages/dashboard/assets/mock_locations.csv';
            console.log('Trying static file fallback:', csvPath);
            response = await fetch(csvPath);
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
        
        console.log('📊 Data loaded from:', csvPath);
        console.log('📦 Data source:', dataSource === 'database' ? '✅ DATABASE (PostgreSQL)' : dataSource === 'csv-file' ? '📄 CSV FILE (fallback)' : '❓ Unknown');
        if (dataSource === 'database') {
            console.log('✅ Location count from database:', locationCount);
            // Show success message in UI
            showDataSourceIndicator('database', locationCount);
        } else if (dataSource === 'csv-file') {
            console.warn('⚠️ Using CSV fallback - database may not be available');
            showDataSourceIndicator('csv', null);
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
        
        // Set date filter defaults (earliest date to current date)
        setDateFilterDefaults(locations);
        
        // Populate tracker filter (MUST be called before updateMap/updateStatistics)
        populateTrackerFilter();
        populateAttributeFilters();
        
        // Ensure trackerFilter.selectedTrackerIds is set before calling updateMap
        const trackerFilterEl = document.getElementById('trackerFilter');
        if (!trackerFilterEl || !trackerFilterEl.selectedTrackerIds || trackerFilterEl.selectedTrackerIds.size === 0) {
            console.warn('Tracker filter not properly initialized, re-initializing...');
            // Re-initialize with all trackers
            if (trackerFilterEl) {
                trackerFilterEl.selectedTrackerIds = new Set(animals.map(a => a.id));
            }
        }
        
        // Render animals list
        renderAnimalList();
        
        // Update map with markers (this will use all selected trackers by default)
        console.log('About to call updateMap()...');
        updateMap();
        
        // Update statistics (this will use all selected trackers by default)
        updateStatistics();
        
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
 * Filter out isolated locations for a specific tracker
 * A location is considered isolated if it's more than 100km from all other locations of the same tracker
 * NOTE: This only affects map display - all locations remain in the database
 */
function filterIsolatedLocationsForTracker(trackerLocations, trackerId) {
    if (trackerLocations.length === 0) return [];
    if (trackerLocations.length === 1) return trackerLocations; // Single location is always valid
    
    const MAX_DISTANCE_KM = 100;
    const filteredLocations = [];
    
    trackerLocations.forEach(location => {
        const lat1 = location.lat;
        const lng1 = location.lng;
        
        // Skip if coordinates are invalid
        if (isNaN(lat1) || isNaN(lng1)) {
            return;
        }
        
        // Check if this location is within MAX_DISTANCE_KM of any other location from the same tracker
        let hasNearbyLocation = false;
        
        for (const otherLocation of trackerLocations) {
            if (location === otherLocation) continue; // Skip self
            
            const lat2 = otherLocation.lat;
            const lng2 = otherLocation.lng;
            
            if (isNaN(lat2) || isNaN(lng2)) continue;
            
            const distance = calculateDistance(lat1, lng1, lat2, lng2);
            
            if (distance <= MAX_DISTANCE_KM) {
                hasNearbyLocation = true;
                break; // Found at least one nearby location, no need to check others
            }
        }
        
        if (hasNearbyLocation) {
            filteredLocations.push(location);
        } else {
            console.warn(`[Isolated Location Filtered] Tracker ${trackerId}, Fix ${location.fix_number || 'N/A'}: More than ${MAX_DISTANCE_KM}km from all other locations of this tracker. Coordinates: ${lat1}, ${lng1}`);
        }
    });
    
    return filteredLocations;
}

/**
 * Process locations to create animals list
 */
function processLocations(locations) {
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
        const timestamp = location.timestamp || location.time || new Date().toISOString();
        const lat = parseFloat(location.latitude || location.lat);
        const lng = parseFloat(location.longitude || location.lng || location.lon);
        const batteryVoltage = location.battery_voltage ? parseFloat(location.battery_voltage) : null;
        const family = normalizeAttribute(location.family || location.family_name || location.group || animal.family);
        const type = normalizeAttribute(location.animal_type || location.type || animal.type);
        
        if (!isNaN(lat) && !isNaN(lng)) {
            animal.locations.push({
                lat,
                lng,
                timestamp,
                batteryVoltage,
                fix_number: location.fix_number ? parseInt(location.fix_number) : null
            });
            
            // Update last update time - ensure we parse dates correctly for comparison
            const timestampDate = new Date(timestamp);
            const currentLastUpdate = animal.lastUpdate ? new Date(animal.lastUpdate) : null;
            
            // Only update if timestamp is valid and is newer than current last update
            if (!isNaN(timestampDate.getTime())) {
                if (!currentLastUpdate || isNaN(currentLastUpdate.getTime()) || timestampDate > currentLastUpdate) {
                    // Store as ISO string for consistent parsing later
                    animal.lastUpdate = timestampDate.toISOString();
                    animal.batteryVoltage = batteryVoltage;
                    animal.initialBatteryVoltage = initialBatteryVoltage || animal.initialBatteryVoltage || batteryVoltage;
                    animal.batteryPercent = calculateBatteryPercentage(animal.batteryVoltage, animal.initialBatteryVoltage);
                    animal.family = family || animal.family || 'Unknown';
                    animal.type = type || animal.type || 'Unknown';
                }
            }
        }
    });
    
    // Convert map to array, filter isolated locations per tracker, and calculate status
    animals = Array.from(animalMap.values()).map(animal => {
        // Filter out isolated locations for this tracker (>100km from other locations of same tracker)
        // Note: All locations remain in the database, this only affects what's shown on the map
        const originalCount = animal.locations.length;
        animal.locations = filterIsolatedLocationsForTracker(animal.locations, animal.id);
        const filteredCount = animal.locations.length;
        
        if (originalCount !== filteredCount) {
            console.log(`[Tracker ${animal.id}] Filtered ${originalCount - filteredCount} isolated locations (${filteredCount}/${originalCount} remaining)`);
        }
        
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
    
    // Update animal count
    const animalCountEl = document.getElementById('animalCount');
    if (animalCountEl) {
        animalCountEl.textContent = animals.length;
    }
}

/**
 * Populate tracker filter list
 */
function populateTrackerFilter() {
    const trackerFilter = document.getElementById('trackerFilter');
    if (!trackerFilter) return;
    
    // Clear existing items
    trackerFilter.innerHTML = '';
    
    // Sort animals by name for better UX
    const sortedAnimals = [...animals].sort((a, b) => a.name.localeCompare(b.name));
    
    // Track selected trackers (all selected by default)
    let selectedTrackerIds = new Set(sortedAnimals.map(a => a.id));
    
    // Store selected trackers in the element BEFORE creating items
    // This ensures it's available when updateMap() and updateStatistics() are called
    trackerFilter.selectedTrackerIds = selectedTrackerIds;
    
    console.log(`[populateTrackerFilter] Stored ${selectedTrackerIds.size} selected trackers:`, Array.from(selectedTrackerIds));
    
    // Add all trackers as items
    sortedAnimals.forEach(animal => {
        const item = document.createElement('div');
        item.className = 'tracker-filter-item selected';
        item.dataset.trackerId = animal.id;
        
        item.innerHTML = `
            <div class="tracker-filter-item-info">
                <div class="tracker-filter-item-name">${escapeHtml(animal.name)}</div>
                <div class="tracker-filter-item-id">${escapeHtml(animal.id)}</div>
            </div>
            <div class="tracker-filter-item-remove" title="Remove tracker">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        // Toggle selection on item click
        item.addEventListener('click', (e) => {
            // Don't toggle if clicking the remove button (handled separately)
            if (e.target.closest('.tracker-filter-item-remove')) {
                return;
            }
            
            // Get the current selected tracker IDs from the element
            const currentSelected = trackerFilter.selectedTrackerIds || new Set();
            const isSelected = currentSelected.has(animal.id);
            
            if (isSelected) {
                currentSelected.delete(animal.id);
                item.classList.remove('selected');
            } else {
                currentSelected.add(animal.id);
                item.classList.add('selected');
            }
            
            // Update the stored Set on the element
            trackerFilter.selectedTrackerIds = currentSelected;
            
            updateMap();
            updateStatistics();
            renderAnimalList();
            updateToggleAllButton();
        });
        
        // Remove button click handler
        const removeBtn = item.querySelector('.tracker-filter-item-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Get the current selected tracker IDs from the element
            const currentSelected = trackerFilter.selectedTrackerIds || new Set();
            currentSelected.delete(animal.id);
            item.classList.remove('selected');
            
            // Update the stored Set on the element
            trackerFilter.selectedTrackerIds = currentSelected;
            
            updateMap();
            updateStatistics();
            renderAnimalList();
            updateToggleAllButton();
        });
        
        trackerFilter.appendChild(item);
    });
    
    // Update toggle all button text
    updateToggleAllButton();
    
    console.log(`Tracker filter populated with ${sortedAnimals.length} trackers, all selected by default`);
    console.log('Selected tracker IDs:', Array.from(selectedTrackerIds));
}

function populateAttributeFilters() {
    const typeFilter = document.getElementById('typeFilter');
    const familyFilter = document.getElementById('familyFilter');
    if (!typeFilter || !familyFilter) {
        return;
    }

    const previousType = typeFilter.value || 'all';
    const previousFamily = familyFilter.value || 'all';

    const typeValues = new Set();
    const familyValues = new Set();

    animals.forEach(animal => {
        typeValues.add(normalizeAttribute(animal.type));
        familyValues.add(normalizeAttribute(animal.family));
    });

    const sortedTypes = sortFilterValues(Array.from(typeValues));
    const sortedFamilies = sortFilterValues(Array.from(familyValues));

    populateFilterSelect(typeFilter, sortedTypes, 'All Types', previousType);
    populateFilterSelect(familyFilter, sortedFamilies, 'All Families', previousFamily);
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
    const toggleAllBtn = document.getElementById('toggleAllTrackers');
    const toggleAllText = document.getElementById('toggleAllText');
    const trackerFilter = document.getElementById('trackerFilter');
    
    if (!toggleAllBtn || !toggleAllText || !trackerFilter) return;
    
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
    if (!trackerFilter) return;
    
    const selectedTrackerIds = trackerFilter.selectedTrackerIds || new Set();
    const allItems = trackerFilter.querySelectorAll('.tracker-filter-item');
    
    // Check if all are selected
    const allSelected = selectedTrackerIds.size === allItems.length && allItems.length > 0;
    
    // Select or deselect all
    allItems.forEach(item => {
        const trackerId = item.dataset.trackerId;
        
        if (allSelected) {
            // Deselect all
            selectedTrackerIds.delete(trackerId);
            item.classList.remove('selected');
        } else {
            // Select all
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
    
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    
    // Set date from to earliest date (format: YYYY-MM-DD)
    if (dateFromInput && earliestDate) {
        const earliestDateStr = earliestDate.toISOString().split('T')[0];
        dateFromInput.value = earliestDateStr;
        dateFromInput.setAttribute('placeholder', earliestDateStr);
        dateFromInput.setAttribute('min', earliestDateStr);
    }
    
    // Set date to to latest date in data (or current date if later)
    if (dateToInput) {
        const today = new Date();
        // Use latest date from data
        const latestDateToUse = latestDate || today;
        const dateToStr = latestDateToUse.toISOString().split('T')[0];
        dateToInput.value = dateToStr;
        dateToInput.setAttribute('placeholder', dateToStr);
        dateToInput.setAttribute('max', today.toISOString().split('T')[0]);
        if (earliestDate) {
            const earliestDateStr = earliestDate.toISOString().split('T')[0];
            dateToInput.setAttribute('min', earliestDateStr);
        }
        console.log('[setDateFilterDefaults] Set dateTo to:', dateToStr, 'from latestDate:', latestDate ? latestDate.toISOString() : 'none', 'today:', today.toISOString());
    }
    
    console.log('Date filter defaults set:', {
        from: earliestDate ? earliestDate.toISOString().split('T')[0] : null,
        to: latestDate ? latestDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        earliestInData: earliestDate ? earliestDate.toISOString() : null,
        latestInData: latestDate ? latestDate.toISOString() : null
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
    
    // Get selected trackers from tracker filter
    const trackerFilterList = document.getElementById('trackerFilter');
    let selectedTrackerIds = [];
    if (trackerFilterList && trackerFilterList.selectedTrackerIds && trackerFilterList.selectedTrackerIds.size > 0) {
        selectedTrackerIds = Array.from(trackerFilterList.selectedTrackerIds);
    } else {
        selectedTrackerIds = animals.map(a => a.id);
    }
    
    // Filter animals based on status and selected trackers
    const filteredAnimals = animals.filter(animal => 
        selectedTrackerIds.includes(animal.id) &&
        (status === 'all' || animal.status === status) &&
        matchesFilter(animal.type, type) &&
        matchesFilter(animal.family, family)
    );
    
    // Render animal list
    if (filteredAnimals.length === 0) {
        animalList.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No animals found</p></div>';
        return;
    }
    
    animalList.innerHTML = filteredAnimals.map(animal => {
        const lastUpdate = animal.lastUpdate 
            ? formatTime(new Date(animal.lastUpdate))
            : 'Never';
        
        const batteryText = formatBattery(animal.batteryVoltage, animal.batteryPercent);
        
        // Get status hint text
        const statusHint = getStatusHint(animal);
        
        return `
            <div class="animal-item ${selectedAnimalId === animal.id ? 'active' : ''}" 
                 data-animal-id="${animal.id}">
                <div class="animal-item-header">
                    <span class="animal-name">${escapeHtml(animal.name)}</span>
                    <span class="animal-status ${animal.status}" title="${escapeHtml(statusHint)}">${animal.status}</span>
                </div>
                <div class="animal-details">
                    <div class="animal-details-row">
                        <span class="animal-details-label">Type:</span>
                        <span>${escapeHtml(normalizeAttribute(animal.type))}</span>
                    </div>
                    <div class="animal-details-row">
                        <span class="animal-details-label">Family:</span>
                        <span>${escapeHtml(normalizeAttribute(animal.family))}</span>
                    </div>
                    <div class="animal-details-row">
                        <span class="animal-details-label">Last Update:</span>
                        <span>${lastUpdate}</span>
                    </div>
                    <div class="animal-details-row">
                        <span class="animal-details-label">Battery:</span>
                        <span>${batteryText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners
    animalList.querySelectorAll('.animal-item').forEach(item => {
        item.addEventListener('click', () => {
            const animalId = item.dataset.animalId;
            selectAnimal(animalId);
        });
    });
}

/**
 * Select animal and focus on map
 */
function selectAnimal(animalId) {
    const animal = animals.find(a => a.id === animalId);
    
    if (!animal) {
        console.warn(`[selectAnimal] Animal ${animalId} not found`);
        return;
    }
    
    // Toggle label visibility for this animal
    const currentlyVisible = animalLabelsVisible[animalId] || false;
    animalLabelsVisible[animalId] = !currentlyVisible;
    
    // Show or hide all marker labels (popups) for this animal
    const animalMarkers = markers[animalId];
    if (animalMarkers) {
        if (Array.isArray(animalMarkers)) {
            // Multiple markers (path modes)
            animalMarkers.forEach(marker => {
                if (marker) {
                    if (animalLabelsVisible[animalId]) {
                        marker.openPopup();
                    } else {
                        marker.closePopup();
                    }
                }
            });
        } else {
            // Single marker (markers only mode)
            if (animalLabelsVisible[animalId]) {
                animalMarkers.openPopup();
            } else {
                animalMarkers.closePopup();
            }
        }
    }
    
    // Update selected animal ID
    selectedAnimalId = animalId;
    
    // Add animal to selected trackers in the filter
    const trackerFilter = document.getElementById('trackerFilter');
    if (trackerFilter && trackerFilter.selectedTrackerIds) {
        const selectedTrackerIds = trackerFilter.selectedTrackerIds;
        if (!selectedTrackerIds.has(animalId)) {
            selectedTrackerIds.add(animalId);
            trackerFilter.selectedTrackerIds = selectedTrackerIds;
            
            // Update the tracker filter UI to show it as selected
            const trackerItem = trackerFilter.querySelector(`[data-tracker-id="${animalId}"]`);
            if (trackerItem) {
                trackerItem.classList.add('selected');
            }
            
            // Update toggle all button
            updateToggleAllButton();
        }
    }
    
    // Update map and statistics first to ensure markers are created
    updateMap();
    updateStatistics();
    
    // Zoom to animal's last location after map is updated
    if (animal.locations.length > 0) {
        // Get the last location (most recent)
        const sortedLocations = [...animal.locations].sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        const lastLocation = sortedLocations[sortedLocations.length - 1];
        
        // Center map on last location with appropriate zoom level
        map.setView([lastLocation.lat, lastLocation.lng], 13, {
            animate: true,
            duration: 0.5
        });
        
        // After zoom animation, open popup if labels should be visible
        setTimeout(() => {
            const animalMarkers = markers[animalId];
            if (animalMarkers && animalLabelsVisible[animalId]) {
                if (Array.isArray(animalMarkers) && animalMarkers.length > 0) {
                    // Open the last marker's popup (most recent location)
                    animalMarkers[animalMarkers.length - 1].openPopup();
                } else if (animalMarkers) {
                    animalMarkers.openPopup();
                }
            }
        }, 600);
    }
    
    // Re-render list to update active state
    renderAnimalList();
    
    console.log(`[selectAnimal] Toggled labels for ${animalId}: ${animalLabelsVisible[animalId] ? 'visible' : 'hidden'}`);
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
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
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
    
    if (trackerFilterList && trackerFilterList.selectedTrackerIds) {
        // Use selected trackers from filter (even if empty - this means show nothing)
        selectedTrackerIds = Array.from(trackerFilterList.selectedTrackerIds);
        console.log('[updateMap] Using trackers from filter:', selectedTrackerIds);
        console.log('[updateMap] Filter has been initialized, selected count:', selectedTrackerIds.length);
    } else {
        // Default to all trackers ONLY if filter hasn't been initialized yet
        // This happens on initial page load before populateTrackerFilter() runs
        selectedTrackerIds = animals.map(a => a.id);
        console.log('[updateMap] Tracker filter not initialized yet, defaulting to ALL trackers:', selectedTrackerIds);
        console.log('[updateMap] Available animals:', animals.map(a => a.id));
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
        if (!selectedTrackerIds.includes(animal.id)) {
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
        if ((dateFrom && dateFrom.trim() !== '') || (dateTo && dateTo.trim() !== '')) {
            const beforeFilter = filteredLocations.length;
            filteredLocations = animal.locations.filter(loc => {
                const locDate = new Date(loc.timestamp);
                if (isNaN(locDate.getTime())) {
                    console.log(`[updateMap] Invalid date for ${animal.id}: ${loc.timestamp}`);
                    return false;
                }
                
                if (dateFrom && dateFrom.trim() !== '') {
                    // Parse dateFrom as YYYY-MM-DD and set to start of day UTC
                    const fromDate = new Date(dateFrom + 'T00:00:00Z');
                    if (isNaN(fromDate.getTime())) {
                        console.warn(`[updateMap] Invalid dateFrom: ${dateFrom}`);
                    } else {
                        // Compare dates at start of day
                        const locDateStart = new Date(locDate);
                        locDateStart.setUTCHours(0, 0, 0, 0);
                        if (locDateStart < fromDate) {
                            console.log(`[updateMap] ${animal.id} - Location date ${locDateStart.toISOString()} is before dateFrom ${fromDate.toISOString()}`);
                            return false;
                        }
                    }
                }
                
                if (dateTo && dateTo.trim() !== '') {
                    // Parse dateTo as YYYY-MM-DD and set to end of day UTC
                    const toDate = new Date(dateTo + 'T23:59:59.999Z');
                    if (isNaN(toDate.getTime())) {
                        console.warn(`[updateMap] Invalid dateTo: ${dateTo}`);
                    } else {
                        // Compare dates - location is included if it's on or before dateTo
                        if (locDate > toDate) {
                            console.log(`[updateMap] ${animal.id} - Location date ${locDate.toISOString()} is after dateTo ${toDate.toISOString()}`);
                            return false;
                        }
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
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const { status, type, family } = getFilterSelections();
    const dateFrom = dateFromInput ? dateFromInput.value : null;
    const dateTo = dateToInput ? dateToInput.value : null;
    const avgUpdateEl = document.getElementById('avgUpdateTime');
    const avgBatteryEl = document.getElementById('avgBattery');
    const alertsEl = document.getElementById('alertsCount');

    const trackerFilterList = document.getElementById('trackerFilter');
    const selectedTrackerIds = trackerFilterList && trackerFilterList.selectedTrackerIds ?
        Array.from(trackerFilterList.selectedTrackerIds) :
        animals.map(a => a.id);

    const animalsById = new Map(animals.map(a => [a.id, a]));

    const filteredLocations = locations.filter(loc => {
        const trackerId = (loc.tracker_id || loc.trackerId || loc.animal_id || loc.animalId || '').toString();
        if (trackerId && !selectedTrackerIds.includes(trackerId)) {
            return false;
        }

        const animal = animalsById.get(trackerId);
        if (!animal) {
            return false;
        }

        if (status !== 'all' && animal.status !== status) {
            return false;
        }

        if (!matchesFilter(animal.type, type) || !matchesFilter(animal.family, family)) {
            return false;
        }

        const timestamp = loc.timestamp || loc.time;
        if (!timestamp) return false;

        const locDate = new Date(timestamp);
        if (isNaN(locDate.getTime())) return false;

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (locDate < fromDate) return false;
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (locDate > toDate) return false;
        }

        return true;
    });

    const totalLocationsEl = document.getElementById('totalLocations');
    if (totalLocationsEl) {
        totalLocationsEl.textContent = filteredLocations.length;
    }

    const filteredAnimals = animals.filter(animal =>
        selectedTrackerIds.includes(animal.id) &&
        (status === 'all' || animal.status === status) &&
        matchesFilter(animal.type, type) &&
        matchesFilter(animal.family, family)
    );

    if (filteredAnimals.length > 0) {
        const now = new Date();
        const updateTimes = filteredAnimals
            .filter(a => {
                if (!a.lastUpdate) return false;
                const lastUpdateDate = new Date(a.lastUpdate);
                // Only include valid dates that are in the past (or very recent future due to clock skew)
                return !isNaN(lastUpdateDate.getTime()) && lastUpdateDate <= now + 60000; // Allow 1 minute clock skew
            })
            .map(a => {
                const lastUpdateDate = new Date(a.lastUpdate);
                // Calculate time difference (should always be positive for past dates)
                const diff = now - lastUpdateDate;
                // Use absolute value as safety, but should already be positive
                return Math.abs(diff);
            });

        if (updateTimes.length > 0) {
            const avgMs = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
            if (avgUpdateEl && avgMs >= 0) {
                avgUpdateEl.textContent = formatTimeAgo(avgMs);
            } else if (avgUpdateEl) {
                avgUpdateEl.textContent = '--';
            }
        } else {
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
function initEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        const btn = document.getElementById('refreshBtn');
        btn.classList.add('loading');
        loadMockData().finally(() => {
            btn.classList.remove('loading');
        });
    });
    
    // Toggle all trackers button
    const toggleAllBtn = document.getElementById('toggleAllTrackers');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', toggleAllTrackers);
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
    
    // Date filter listeners
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (dateFrom) {
        dateFrom.addEventListener('change', () => {
            updateMap();
            updateStatistics();
        });
    }
    
    if (dateTo) {
        dateTo.addEventListener('change', () => {
            updateMap();
            updateStatistics();
        });
    }
    
    // Visualization mode listener
    const visualizationMode = document.getElementById('visualizationMode');
    if (visualizationMode) {
        visualizationMode.addEventListener('change', () => {
            updateMap();
        });
    }
}


/**
 * Format time for display
 */
function formatTime(date) {
    if (!date) return 'Never';
    
    // Handle string dates
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return 'Never';
    
    const now = new Date();
    const diff = now - dateObj;
    
    // Handle negative diff (future dates or clock skew) - should show as actual date
    if (diff < 0) {
        return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour - show minutes
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    
    // Less than 24 hours - show hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    // More than 24 hours - show full date and time
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
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
        if (source === 'database') {
            lastUpdateEl.innerHTML = `<span style="color: #10b981; font-weight: 600;">DB: ${count} locations</span>`;
            lastUpdateEl.title = `Data loaded from PostgreSQL database (${count} locations)`;
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
}

/**
 * Render all markers without connections (for "Only Markers" mode)
 */
function renderMarkersOnly(animal, sortedLocations, iconColor) {
    console.log(`[renderMarkersOnly] Rendering ${sortedLocations.length} markers for ${animal.id} (${animal.name})`);
    const animalMarkers = [];
    
    // Create markers for all locations
    sortedLocations.forEach((location, index) => {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: ${index === sortedLocations.length - 1 ? '24px' : '18px'};
                height: ${index === sortedLocations.length - 1 ? '24px' : '18px'};
                background: ${iconColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [index === sortedLocations.length - 1 ? 24 : 18, index === sortedLocations.length - 1 ? 24 : 18],
            iconAnchor: [index === sortedLocations.length - 1 ? 12 : 9, index === sortedLocations.length - 1 ? 12 : 9]
        });
        
        const marker = L.marker([location.lat, location.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <strong>${escapeHtml(animal.name)}</strong><br>
                Type: ${escapeHtml(normalizeAttribute(animal.type))}<br>
                Family: ${escapeHtml(normalizeAttribute(animal.family))}<br>
                Time: ${formatTime(new Date(location.timestamp))}<br>
                Battery: ${location.batteryVoltage !== null ? formatBattery(location.batteryVoltage, calculateBatteryPercentage(location.batteryVoltage, animal.initialBatteryVoltage)) : 'N/A'}<br>
                Location ${index + 1} of ${sortedLocations.length}
            `);
        
        animalMarkers.push(marker);
    });
    
    // Store all markers as an array so they can all be cleared
    markers[animal.id] = animalMarkers;
}

/**
 * Render path with markers and polylines
 */
function renderPath(animal, sortedLocations, iconColor) {
    const animalMarkers = [];
    const pathCoordinates = [];
    
    // Create markers for all locations
    sortedLocations.forEach((location, index) => {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: ${index === sortedLocations.length - 1 ? '24px' : '16px'};
                height: ${index === sortedLocations.length - 1 ? '24px' : '16px'};
                background: ${iconColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [index === sortedLocations.length - 1 ? 24 : 16, index === sortedLocations.length - 1 ? 24 : 16],
            iconAnchor: [index === sortedLocations.length - 1 ? 12 : 8, index === sortedLocations.length - 1 ? 12 : 8]
        });
        
        const marker = L.marker([location.lat, location.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <strong>${escapeHtml(animal.name)}</strong><br>
                Type: ${escapeHtml(normalizeAttribute(animal.type))}<br>
                Family: ${escapeHtml(normalizeAttribute(animal.family))}<br>
                Time: ${formatTime(new Date(location.timestamp))}<br>
                Battery: ${location.batteryVoltage !== null ? formatBattery(location.batteryVoltage, calculateBatteryPercentage(location.batteryVoltage, animal.initialBatteryVoltage)) : 'N/A'}<br>
                Location ${index + 1} of ${sortedLocations.length}
            `);
        
        animalMarkers.push(marker);
        pathCoordinates.push([location.lat, location.lng]);
    });
    
    // Store all markers as an array so they can all be cleared
    markers[animal.id] = animalMarkers;
    
    // Create polyline connecting all locations
    if (pathCoordinates.length > 1) {
        const polyline = L.polyline(pathCoordinates, {
            color: iconColor,
            weight: 3,
            opacity: 0.7,
            smoothFactor: 1
        }).addTo(map);
        
        polylines[animal.id] = polyline;
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
    
    // Create markers for all locations
    sortedLocations.forEach((location, index) => {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: ${index === sortedLocations.length - 1 ? '24px' : '16px'};
                height: ${index === sortedLocations.length - 1 ? '24px' : '16px'};
                background: ${iconColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [index === sortedLocations.length - 1 ? 24 : 16, index === sortedLocations.length - 1 ? 24 : 16],
            iconAnchor: [index === sortedLocations.length - 1 ? 12 : 8, index === sortedLocations.length - 1 ? 12 : 8]
        });
        
        const marker = L.marker([location.lat, location.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <strong>${escapeHtml(animal.name)}</strong><br>
                Type: ${escapeHtml(normalizeAttribute(animal.type))}<br>
                Family: ${escapeHtml(normalizeAttribute(animal.family))}<br>
                Time: ${formatTime(new Date(location.timestamp))}<br>
                Battery: ${location.batteryVoltage !== null ? formatBattery(location.batteryVoltage, calculateBatteryPercentage(location.batteryVoltage, animal.initialBatteryVoltage)) : 'N/A'}<br>
                Location ${index + 1} of ${sortedLocations.length}
            `);
        
        animalMarkers.push(marker);
        pathCoordinates.push([location.lat, location.lng]);
    });
    
    // Add directional arrows after all markers are created
    sortedLocations.forEach((location, index) => {
        // Add directional arrow between consecutive locations (except for the last location)
        if (index < sortedLocations.length - 1) {
            const nextLocation = sortedLocations[index + 1];
            const midLat = (location.lat + nextLocation.lat) / 2;
            const midLng = (location.lng + nextLocation.lng) / 2;
            
            // Calculate bearing for arrow direction
            const bearing = calculateBearing(location.lat, location.lng, nextLocation.lat, nextLocation.lng);
            console.log(`[renderPathWithDirections] Adding arrow at index ${index}, bearing: ${bearing.toFixed(1)}°`);
            
            // Create arrow icon rotated to show direction using SVG
            // Arrow points from current location to next location
            // Use a flat, solid color design for better visibility
            const arrowSize = 28; // Larger size for better visibility
            const arrowIcon = L.divIcon({
                className: 'direction-arrow',
                html: `<div style="
                    width: ${arrowSize}px;
                    height: ${arrowSize}px;
                    transform: rotate(${bearing}deg);
                    transform-origin: center;
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
                zIndexOffset: 500  // Higher z-index to ensure arrows are visible above polylines
            }).addTo(map);
            
            arrowMarkers.push(arrowMarker);
            console.log(`[renderPathWithDirections] Arrow added at (${midLat.toFixed(4)}, ${midLng.toFixed(4)})`);
        }
    });
    
    console.log(`[renderPathWithDirections] Created ${animalMarkers.length} markers and ${arrowMarkers.length} arrows`);
    
    // Store all markers as an array so they can all be cleared
    markers[animal.id] = animalMarkers;
    
    // Create polyline connecting all locations
    if (pathCoordinates.length > 1) {
        const polyline = L.polyline(pathCoordinates, {
            color: iconColor,
            weight: 3,
            opacity: 0.7,
            smoothFactor: 1
        }).addTo(map);
        
        // Store both polyline and arrow markers
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

function matchesFilter(value, filterValue) {
    if (!filterValue || filterValue === 'all') {
        return true;
    }
    return normalizeAttribute(value) === filterValue;
}

function getFilterSelections() {
    const status = document.getElementById('statusFilter')?.value || 'all';
    const type = document.getElementById('typeFilter')?.value || 'all';
    const family = document.getElementById('familyFilter')?.value || 'all';
    return { status, type, family };
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

