-- ==============================
-- CUSTODIA DATABASE SEED DATA
-- ==============================
-- This file contains mock data for testing
-- 4 trackers, 5 locations each in Jeddah/Thuwal region; 2 repeaters

-- Clear existing data (in reverse order of dependencies)
TRUNCATE TABLE locations, repeaters, trackers, users, clients RESTART IDENTITY CASCADE;

-- ==============================
-- INSERT CLIENT
-- ==============================
INSERT INTO clients (name, slug) VALUES
('Custodia', 'custodia');

-- ==============================
-- INSERT USERS
-- ==============================
-- Password hashes: bcrypt 12 rounds for 'admin123', 'manager123', 'viewer123'
INSERT INTO users (client_id, name, email, password_hash, role) VALUES
(1, 'Admin User', 'admin@custodia.world', '$2b$12$5EPRgva7qJt/pUhLJUJWCOqK3RyY3zFSfCIL81Tm049KahoU.jblK', 'admin'),
(1, 'Manager User', 'manager@custodia.world', '$2b$12$TMoja9L/5fXHOYP6GOy/Ve8qJIa4tFPMUG9ak1Hv0NUZ43bgk1oPS', 'manager'),
(1, 'Viewer User', 'viewer@custodia.world', '$2b$12$nCKtsvANW9NbK/jS2WffUOeTOC.AUQjtzocv.CqxgpKTvwrx6keJe', 'viewer');

-- ==============================
-- INSERT TRACKERS (4 test trackers)
-- ==============================
INSERT INTO trackers (client_id, slug, animal_type, animal_name, family, expected_battery_life, frequency_acquisition, frequency_sending, initial_battery_voltage) VALUES
(1, 'trk_001', 'Leopard', 'Leopard Alpha', 'Big Cat', 365, 15, 60, 4.20),
(1, 'trk_002', 'Oryx', 'Oryx Beta', 'Antelope', 365, 15, 60, 4.20),
(1, 'trk_003', 'Leopard', 'Leopard Gamma', 'Big Cat', 365, 15, 60, 4.20),
(1, 'trk_004', 'Oryx', 'Oryx Delta', 'Antelope', 365, 15, 60, 4.20);

-- ==============================
-- INSERT REPEATERS (2 repeaters, Jeddah/Thuwal region)
-- ==============================
-- Repeater 1: Thuwal north; Repeater 2: Thuwal south (lat/lon, height in meters, total_locations_collected)
INSERT INTO repeaters (repeater_id, client_id, longitude, latitude, height, total_locations_collected, last_seen) VALUES
('RPT-THUWAL-N', 1, 39.103600, 22.285000, 45.00, 10, '2025-11-01 14:00:00+00'),
('RPT-THUWAL-S', 1, 39.098200, 22.251000, 32.50, 10, '2025-11-01 14:00:00+00');

-- ==============================
-- INSERT LOCATIONS (5 per tracker, Jeddah / Thuwal region)
-- ==============================
-- Coordinates in Thuwal (22.25–22.29°N, 39.09–39.12°E) and nearby Jeddah coast
-- Some locations via repeater 1 (id=1), some via repeater 2 (id=2), some NULL
INSERT INTO locations (tracker_id, repeater_id, latitude, longitude, timestamp, battery_voltage, fix_number) VALUES
-- TRK-001 (Leopard Alpha) - 5 locations
(1, 1, 22.2820, 39.1010, '2025-11-01 08:00:00+00', 92.0, 1),
(1, 1, 22.2785, 39.1045, '2025-11-01 09:30:00+00', 91.0, 2),
(1, NULL, 22.2750, 39.1080, '2025-11-01 11:00:00+00', 90.0, 3),
(1, 2, 22.2710, 39.1100, '2025-11-01 12:30:00+00', 89.0, 4),
(1, 2, 22.2670, 39.1120, '2025-11-01 14:00:00+00', 88.0, 5),
-- TRK-002 (Oryx Beta) - 5 locations
(2, 1, 22.2840, 39.0990, '2025-11-01 08:15:00+00', 88.0, 1),
(2, 1, 22.2800, 39.1020, '2025-11-01 09:45:00+00', 87.0, 2),
(2, 2, 22.2760, 39.1055, '2025-11-01 11:15:00+00', 86.0, 3),
(2, 2, 22.2720, 39.1090, '2025-11-01 12:45:00+00', 85.0, 4),
(2, NULL, 22.2680, 39.1115, '2025-11-01 14:15:00+00', 84.0, 5),
-- TRK-003 (Leopard Gamma) - 5 locations
(3, NULL, 22.2790, 39.1000, '2025-11-01 08:30:00+00', 79.0, 1),
(3, 1, 22.2755, 39.1030, '2025-11-01 10:00:00+00', 78.0, 2),
(3, 1, 22.2720, 39.1060, '2025-11-01 11:30:00+00', 77.0, 3),
(3, 2, 22.2685, 39.1095, '2025-11-01 13:00:00+00', 76.0, 4),
(3, 2, 22.2650, 39.1130, '2025-11-01 14:30:00+00', 75.0, 5),
-- TRK-004 (Oryx Delta) - 5 locations
(4, 2, 22.2770, 39.0970, '2025-11-01 08:45:00+00', 85.0, 1),
(4, 2, 22.2735, 39.1005, '2025-11-01 10:15:00+00', 84.0, 2),
(4, NULL, 22.2700, 39.1040, '2025-11-01 11:45:00+00', 83.0, 3),
(4, 1, 22.2665, 39.1075, '2025-11-01 13:15:00+00', 82.0, 4),
(4, 1, 22.2630, 39.1110, '2025-11-01 14:45:00+00', 81.0, 5);

-- ==============================
-- VERIFY DATA
-- ==============================
SELECT 'Clients:' as info, COUNT(*) as count FROM clients
UNION ALL
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Trackers:', COUNT(*) FROM trackers
UNION ALL
SELECT 'Repeaters:', COUNT(*) FROM repeaters
UNION ALL
SELECT 'Locations:', COUNT(*) FROM locations;

