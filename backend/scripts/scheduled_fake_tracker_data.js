#!/usr/bin/env node

/**
 * Scheduled Fake Tracker Data Generator
 * 
 * Simulates realistic animal movement inside KAUST campus for demo purposes.
 * Sends GPS coordinates every 15 minutes to the /api/locations API endpoint.
 * 
 * Usage: node scheduled_fake_tracker_data.js
 */

const axios = require('axios');

// Configuration
// Use API_ENDPOINT env var, or construct from RENDER_SERVICE_URL, or fallback
// The endpoint should be /api/locations (POST) for repeater data ingestion
const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || process.env.RENDER_EXTERNAL_URL;
const DEFAULT_ENDPOINT = RENDER_SERVICE_URL 
    ? `${RENDER_SERVICE_URL}/api/locations`
    : 'http://localhost:3000/api/locations';
const API_ENDPOINT = process.env.API_ENDPOINT || DEFAULT_ENDPOINT;
const API_KEY = process.env.LOCATIONS_API_KEY || 'abs123qwe';
const INTERVAL_MINUTES = 15;
const REPEATER_ID = 'DEMO-RPT-001';

// Trackers configuration
const TRACKERS = {
    1001: { name: 'Gazelle', voltage: 3.90 },
    1002: { name: 'Ibex', voltage: 3.87 },
    1003: { name: 'Fox', voltage: 3.92 }
};

// KAUST Campus Routes (realistic coordinates)
// KAUST is located at approximately 22.3°N, 39.1°E

const ROUTES = {
    // Tracker 1001 (Gazelle) - Discovery Square loop
    1001: [
        { lat: 22.3085, lng: 39.1025 }, // Discovery Square center
        { lat: 22.3090, lng: 39.1030 },
        { lat: 22.3095, lng: 39.1035 },
        { lat: 22.3100, lng: 39.1030 },
        { lat: 22.3105, lng: 39.1025 },
        { lat: 22.3100, lng: 39.1020 },
        { lat: 22.3095, lng: 39.1015 },
        { lat: 22.3090, lng: 39.1020 },
        { lat: 22.3085, lng: 39.1025 } // Back to start
    ],
    
    // Tracker 1002 (Ibex) - Harbor Walk path
    1002: [
        { lat: 22.3120, lng: 39.1050 }, // Harbor start
        { lat: 22.3125, lng: 39.1055 },
        { lat: 22.3130, lng: 39.1060 },
        { lat: 22.3135, lng: 39.1055 },
        { lat: 22.3140, lng: 39.1050 },
        { lat: 22.3135, lng: 39.1045 },
        { lat: 22.3130, lng: 39.1040 },
        { lat: 22.3125, lng: 39.1045 },
        { lat: 22.3120, lng: 39.1050 } // Back to start
    ],
    
    // Tracker 1003 (Fox) - Beacon area and lake path
    1003: [
        { lat: 22.3060, lng: 39.1000 }, // Beacon area
        { lat: 22.3065, lng: 39.1005 },
        { lat: 22.3070, lng: 39.1010 },
        { lat: 22.3075, lng: 39.1005 },
        { lat: 22.3080, lng: 39.1000 },
        { lat: 22.3075, lng: 39.0995 },
        { lat: 22.3070, lng: 39.0990 },
        { lat: 22.3065, lng: 39.0995 },
        { lat: 22.3060, lng: 39.1000 } // Back to start
    ]
};

// Tracker state
const trackerState = {
    1001: { routeIndex: 0, currentPosition: { ...ROUTES[1001][0] }, voltage: TRACKERS[1001].voltage },
    1002: { routeIndex: 0, currentPosition: { ...ROUTES[1002][0] }, voltage: TRACKERS[1002].voltage },
    1003: { routeIndex: 0, currentPosition: { ...ROUTES[1003][0] }, voltage: TRACKERS[1003].voltage }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Interpolate between two points with smooth movement
 */
function interpolatePoint(start, end, progress) {
    // Smooth easing function (ease-in-out)
    const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    const lat = start.lat + (end.lat - start.lat) * eased;
    const lng = start.lng + (end.lng - start.lng) * eased;
    
    return { lat, lng };
}

/**
 * Get next position for a tracker with natural movement
 */
function getNextPosition(trackerId) {
    const state = trackerState[trackerId];
    const route = ROUTES[trackerId];
    
    // Calculate how far we should move in 15 minutes
    // Assuming walking speed of ~1-2 m/s, in 15 minutes we cover ~900-1800 meters
    // For a route segment, we'll move about 5-10% of the segment per step
    const segmentProgress = 0.05 + Math.random() * 0.05; // 5-10% progress per step
    
    const currentWaypoint = route[state.routeIndex];
    const nextWaypointIndex = (state.routeIndex + 1) % route.length;
    const nextWaypoint = route[nextWaypointIndex];
    
    // Interpolate between current waypoint and next waypoint
    const distance = calculateDistance(
        state.currentPosition.lat,
        state.currentPosition.lng,
        nextWaypoint.lat,
        nextWaypoint.lng
    );
    
    // If we're close to the next waypoint, move to it and advance
    if (distance < 50) { // Less than 50 meters
        state.routeIndex = nextWaypointIndex;
        state.currentPosition = { ...nextWaypoint };
    } else {
        // Interpolate position
        const newPosition = interpolatePoint(state.currentPosition, nextWaypoint, segmentProgress);
        state.currentPosition = newPosition;
    }
    
    // Add random offset (±5-12 meters) for natural movement
    const randomOffsetLat = (Math.random() - 0.5) * 0.00015; // ~±12 meters
    const randomOffsetLng = (Math.random() - 0.5) * 0.00015;
    
    return {
        lat: state.currentPosition.lat + randomOffsetLat,
        lng: state.currentPosition.lng + randomOffsetLng
    };
}

/**
 * Decrease battery voltage slightly
 */
function decreaseVoltage(trackerId) {
    const state = trackerState[trackerId];
    const decrease = 0.001 + Math.random() * 0.004; // 0.001-0.005 V decrease
    state.voltage = Math.max(3.0, state.voltage - decrease); // Don't go below 3.0V
    return state.voltage;
}

/**
 * Send location data to API with retry logic
 */
async function sendLocationData(trackerId, position, voltage, timestamp) {
    const payload = {
        repeater_id: REPEATER_ID,
        timestamp: Math.floor(timestamp / 1000), // Convert to Unix seconds
        packets: [
            {
                device_id: trackerId,
                timestamp: Math.floor(timestamp / 1000),
                latitude: position.lat,
                longitude: position.lng,
                voltage: parseFloat(voltage.toFixed(3))
            }
        ]
    };
    
    const maxRetries = 1;
    let attempt = 0;
    
    while (attempt <= maxRetries) {
        try {
            const response = await axios.post(API_ENDPOINT, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                },
                timeout: 10000 // 10 second timeout
            });
            
            console.log(`✅ [${new Date().toISOString()}] Tracker ${trackerId} (${TRACKERS[trackerId].name}): Sent location (${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}) - Voltage: ${voltage.toFixed(3)}V - Status: ${response.status}`);
            return true;
        } catch (error) {
            attempt++;
            if (attempt > maxRetries) {
                console.error(`❌ [${new Date().toISOString()}] Tracker ${trackerId} (${TRACKERS[trackerId].name}): Failed after ${maxRetries + 1} attempts:`, error.message);
                return false;
            }
            console.warn(`⚠️  [${new Date().toISOString()}] Tracker ${trackerId}: Retry attempt ${attempt}/${maxRetries}`);
            // Wait 2 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return false;
}

/**
 * Get tomorrow at 16:00 AST (Arabia Standard Time = UTC+3)
 */
function getStopTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Set to 16:00 AST (which is 13:00 UTC)
    // Since AST = UTC+3, 16:00 AST = 13:00 UTC
    tomorrow.setUTCHours(13, 0, 0, 0); // 13:00 UTC = 16:00 AST
    
    return tomorrow;
}

/**
 * Format time remaining
 */
function formatTimeRemaining(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

/**
 * Main transmission function
 */
async function transmitAllTrackers() {
    const now = new Date();
    const timestamp = now.getTime();
    
    console.log(`\n📡 [${now.toISOString()}] Transmitting locations for all trackers...`);
    
    const promises = Object.keys(TRACKERS).map(async (trackerId) => {
        const trackerIdNum = parseInt(trackerId);
        const position = getNextPosition(trackerIdNum);
        const voltage = decreaseVoltage(trackerIdNum);
        
        await sendLocationData(trackerIdNum, position, voltage, timestamp);
    });
    
    await Promise.all(promises);
}

/**
 * Main scheduler loop
 */
async function startScheduler() {
    console.log('🚀 Starting scheduled fake tracker data simulation...');
    console.log(`📍 API Endpoint: ${API_ENDPOINT}`);
    console.log(`⏱️  Interval: ${INTERVAL_MINUTES} minutes`);
    console.log(`🛑 Stop time: Tomorrow at 16:00 AST`);
    console.log(`📊 Trackers: ${Object.keys(TRACKERS).map(id => `${id} (${TRACKERS[id].name})`).join(', ')}`);
    console.log('');
    
    const stopTime = getStopTime();
    console.log(`⏰ Simulation will stop at: ${stopTime.toISOString()} (16:00 AST tomorrow)`);
    console.log('');
    
    // Send first transmission immediately
    await transmitAllTrackers();
    
    // Calculate next transmission time
    let nextTransmission = new Date();
    nextTransmission.setMinutes(nextTransmission.getMinutes() + INTERVAL_MINUTES);
    nextTransmission.setSeconds(0);
    nextTransmission.setMilliseconds(0);
    
    // Schedule interval
    const intervalMs = INTERVAL_MINUTES * 60 * 1000;
    
    const intervalId = setInterval(async () => {
        const now = new Date();
        
        // Check if we've reached the stop time
        if (now >= stopTime) {
            console.log('\n✅ Simulation complete, shutting down...');
            clearInterval(intervalId);
            process.exit(0);
        }
        
        await transmitAllTrackers();
        
        // Update next transmission time
        nextTransmission = new Date(now.getTime() + intervalMs);
        const timeRemaining = stopTime - now;
        const nextTransmissionIn = nextTransmission - now;
        
        console.log(`⏳ Next transmission in ${Math.floor(nextTransmissionIn / 60000)} minutes`);
        console.log(`⏳ Time remaining until stop: ${formatTimeRemaining(timeRemaining)}`);
        console.log('');
    }, intervalMs);
    
    // Log countdown until next transmission
    const countdownInterval = setInterval(() => {
        const now = new Date();
        const timeUntilNext = nextTransmission - now;
        
        if (timeUntilNext <= 0) {
            clearInterval(countdownInterval);
            return;
        }
        
        if (timeUntilNext <= 60000) { // Less than 1 minute
            const seconds = Math.floor(timeUntilNext / 1000);
            if (seconds % 10 === 0 || seconds <= 5) {
                console.log(`⏱️  Next transmission in ${seconds} seconds...`);
            }
        }
    }, 1000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n⚠️  Received SIGINT, shutting down gracefully...');
        clearInterval(intervalId);
        clearInterval(countdownInterval);
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n\n⚠️  Received SIGTERM, shutting down gracefully...');
        clearInterval(intervalId);
        clearInterval(countdownInterval);
        process.exit(0);
    });
}

// Start the scheduler
startScheduler().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
