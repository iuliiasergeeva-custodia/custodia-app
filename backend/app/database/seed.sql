-- ==============================
-- CUSTODIA DATABASE SEED DATA
-- ==============================
-- This file contains mock data for testing
-- Based on mock_locations.csv

-- Clear existing data (in reverse order of dependencies)
TRUNCATE TABLE locations, trackers, users, clients RESTART IDENTITY CASCADE;

-- ==============================
-- INSERT CLIENT
-- ==============================
INSERT INTO clients (name, slug) VALUES
('Custodia', 'custodia');

-- ==============================
-- INSERT USERS
-- ==============================
-- Note: password_hash values are bcrypt hashes for 'admin123', 'manager123', 'viewer123'
-- In production, use proper password hashing
INSERT INTO users (client_id, name, email, password_hash, role) VALUES
(1, 'Admin User', 'admin@custodia.world', '$2b$10$rOzJqZqZqZqZqZqZqZqZqO', 'admin'),
(1, 'Manager User', 'manager@custodia.world', '$2b$10$rOzJqZqZqZqZqZqZqZqZqO', 'manager'),
(1, 'Viewer User', 'viewer@custodia.world', '$2b$10$rOzJqZqZqZqZqZqZqZqZqO', 'viewer');

-- ==============================
-- INSERT TRACKERS
-- ==============================
INSERT INTO trackers (client_id, slug, animal_type, animal_name, family, expected_battery_life, frequency_acquisition, frequency_sending) VALUES
(1, 'trk_001', 'Leopard', 'Leopard Alpha', 'Big Cat', 365, 15, 60),
(1, 'trk_002', 'Oryx', 'Oryx Beta', 'Antelope', 365, 15, 60),
(1, 'trk_003', 'Leopard', 'Leopard Gamma', 'Big Cat', 365, 15, 60),
(1, 'trk_004', 'Leopard', 'Leopard Delta', 'Big Cat', 365, 15, 60),
(1, 'trk_005', 'Oryx', 'Oryx Epsilon', 'Antelope', 365, 15, 60);

-- ==============================
-- INSERT LOCATIONS
-- ==============================
-- Based on mock_locations.csv data
INSERT INTO locations (tracker_id, latitude, longitude, timestamp, battery_voltage, fix_number) VALUES
-- TRK-001 (Leopard Alpha) - tracker_id = 1
(1, 24.7136, 46.6753, '2025-11-01 10:00:00+00', 85.0, 1),
(1, 24.7146, 46.6763, '2025-11-01 10:30:00+00', 84.0, 2),
(1, 24.7156, 46.6773, '2025-11-01 11:15:00+00', 83.0, 3),
(1, 24.7166, 46.6783, '2025-11-01 12:00:00+00', 82.0, 4),
(1, 24.7176, 46.6793, '2025-11-01 13:00:00+00', 81.0, 5),
(1, 24.7186, 46.6803, '2025-11-01 13:45:00+00', 80.0, 6),
(1, 24.7196, 46.6813, '2025-11-01 14:45:00+00', 79.0, 7),

-- TRK-002 (Oryx Beta) - tracker_id = 2
(2, 24.7236, 46.6853, '2025-11-01 10:15:00+00', 92.0, 1),
(2, 24.7246, 46.6863, '2025-11-01 11:00:00+00', 91.0, 2),
(2, 24.7256, 46.6873, '2025-11-01 11:45:00+00', 90.0, 3),
(2, 24.7266, 46.6883, '2025-11-01 12:45:00+00', 89.0, 4),
(2, 24.7276, 46.6893, '2025-11-01 13:30:00+00', 88.0, 5),
(2, 24.7286, 46.6903, '2025-11-01 14:30:00+00', 87.0, 6),
(2, 24.7296, 46.6913, '2025-11-01 15:15:00+00', 86.0, 7),

-- TRK-003 (Leopard Gamma) - tracker_id = 3
(3, 24.7336, 46.6953, '2025-11-01 10:45:00+00', 78.0, 1),
(3, 24.7346, 46.6963, '2025-11-01 12:30:00+00', 77.0, 2),
(3, 24.7356, 46.6973, '2025-11-01 14:15:00+00', 76.0, 3),

-- TRK-004 (Leopard Delta) - tracker_id = 4
(4, 24.7436, 46.7053, '2025-11-01 11:30:00+00', 76.0, 1),
(4, 24.7446, 46.7063, '2025-11-01 13:15:00+00', 75.0, 2),
(4, 24.7456, 46.7073, '2025-11-01 15:00:00+00', 74.0, 3),

-- TRK-005 (Oryx Epsilon) - tracker_id = 5
(5, 24.7536, 46.7153, '2025-11-01 12:15:00+00', 88.0, 1),
(5, 24.7546, 46.7163, '2025-11-01 14:00:00+00', 87.0, 2);

-- ==============================
-- VERIFY DATA
-- ==============================
SELECT 'Clients:' as info, COUNT(*) as count FROM clients
UNION ALL
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Trackers:', COUNT(*) FROM trackers
UNION ALL
SELECT 'Locations:', COUNT(*) FROM locations;

