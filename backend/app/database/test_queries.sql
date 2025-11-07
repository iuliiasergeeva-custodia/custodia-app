-- ==============================
-- CUSTODIA DATABASE TEST QUERIES
-- ==============================
-- Optional testing queries for database verification

-- ==============================
-- BASIC QUERIES
-- ==============================

-- Get all clients
SELECT * FROM clients;

-- Get all users with their client info
SELECT u.id, u.name, u.email, u.role, c.name as client_name
FROM users u
JOIN clients c ON u.client_id = c.id;

-- Get all trackers with their client info
SELECT t.id, t.slug, t.animal_name, t.animal_type, t.family, c.name as client_name
FROM trackers t
JOIN clients c ON t.client_id = c.id;

-- Get location count per tracker
SELECT t.animal_name, COUNT(l.id) as location_count
FROM trackers t
LEFT JOIN locations l ON t.id = l.tracker_id
GROUP BY t.id, t.animal_name
ORDER BY location_count DESC;

-- ==============================
-- LOCATION QUERIES
-- ==============================

-- Get latest location for each tracker
SELECT 
    t.animal_name,
    l.latitude,
    l.longitude,
    l.timestamp,
    l.battery_voltage
FROM trackers t
JOIN locations l ON t.id = l.tracker_id
WHERE (t.id, l.timestamp) IN (
    SELECT tracker_id, MAX(timestamp)
    FROM locations
    GROUP BY tracker_id
)
ORDER BY t.animal_name;

-- Get all locations for a specific tracker (by slug)
SELECT 
    l.latitude,
    l.longitude,
    l.timestamp,
    l.battery_voltage,
    l.fix_number
FROM locations l
JOIN trackers t ON l.tracker_id = t.id
WHERE t.slug = 'trk_001'
ORDER BY l.timestamp;

-- Get locations within a date range
SELECT 
    t.animal_name,
    l.latitude,
    l.longitude,
    l.timestamp,
    l.battery_voltage
FROM locations l
JOIN trackers t ON l.tracker_id = t.id
WHERE l.timestamp BETWEEN '2025-11-01 10:00:00' AND '2025-11-01 12:00:00'
ORDER BY l.timestamp;

-- ==============================
-- STATISTICS QUERIES
-- ==============================

-- Average battery voltage per tracker
SELECT 
    t.animal_name,
    ROUND(AVG(l.battery_voltage)::numeric, 2) as avg_battery,
    MIN(l.battery_voltage) as min_battery,
    MAX(l.battery_voltage) as max_battery
FROM trackers t
JOIN locations l ON t.id = l.tracker_id
GROUP BY t.id, t.animal_name
ORDER BY avg_battery DESC;

-- Total locations per animal type
SELECT 
    t.animal_type,
    COUNT(l.id) as total_locations
FROM trackers t
LEFT JOIN locations l ON t.id = l.tracker_id
GROUP BY t.animal_type
ORDER BY total_locations DESC;

-- Latest update time per tracker
SELECT 
    t.animal_name,
    MAX(l.timestamp) as last_update,
    NOW() - MAX(l.timestamp) as time_since_update
FROM trackers t
LEFT JOIN locations l ON t.id = l.tracker_id
GROUP BY t.id, t.animal_name
ORDER BY last_update DESC;

-- ==============================
-- GEOGRAPHIC QUERIES
-- ==============================

-- Get all locations within a bounding box (example: around Riyadh area)
SELECT 
    t.animal_name,
    l.latitude,
    l.longitude,
    l.timestamp
FROM locations l
JOIN trackers t ON l.tracker_id = t.id
WHERE l.latitude BETWEEN 24.70 AND 24.76
  AND l.longitude BETWEEN 46.67 AND 46.72
ORDER BY l.timestamp;

-- Calculate distance between first and last location for each tracker
-- (using simple Euclidean distance approximation)
SELECT 
    t.animal_name,
    COUNT(l.id) as location_count,
    MIN(l.timestamp) as first_location,
    MAX(l.timestamp) as last_location
FROM trackers t
JOIN locations l ON t.id = l.tracker_id
GROUP BY t.id, t.animal_name
HAVING COUNT(l.id) > 1
ORDER BY location_count DESC;

