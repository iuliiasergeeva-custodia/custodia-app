-- ==============================
-- CUSTODIA DATABASE SCHEMA
-- ==============================

-- ==============================
-- CLIENTS TABLE
-- ==============================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- USERS TABLE
-- ==============================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'manager', 'viewer')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- TRACKERS TABLE
-- ==============================
CREATE TABLE trackers (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    slug VARCHAR(50) UNIQUE NOT NULL,
    animal_type VARCHAR(50),
    animal_name VARCHAR(100),
    family VARCHAR(50),
    expected_battery_life INTEGER,
    frequency_acquisition INTEGER,
    frequency_sending INTEGER,
    last_seen TIMESTAMP,
    last_battery_voltage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- REPEATERS TABLE
-- ==============================
CREATE TABLE repeaters (
    id SERIAL PRIMARY KEY,
    repeater_id VARCHAR(50) UNIQUE NOT NULL,
    last_seen TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- LOCATIONS TABLE
-- ==============================
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    tracker_id INTEGER REFERENCES trackers(id) ON DELETE CASCADE,
    repeater_id INTEGER REFERENCES repeaters(id) ON DELETE SET NULL,
    longitude DECIMAL(9,6) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    battery_voltage DECIMAL(5,2),
    fix_number INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- INDEXES FOR PERFORMANCE
-- ==============================
CREATE INDEX idx_users_client_id ON users(client_id);
CREATE INDEX idx_trackers_client_id ON trackers(client_id);
CREATE INDEX idx_trackers_slug ON trackers(slug);
CREATE INDEX idx_trackers_last_seen ON trackers(last_seen);
CREATE INDEX idx_repeaters_repeater_id ON repeaters(repeater_id);
CREATE INDEX idx_locations_tracker_id ON locations(tracker_id);
CREATE INDEX idx_locations_repeater_id ON locations(repeater_id);
CREATE INDEX idx_locations_timestamp ON locations(timestamp);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);

-- ==============================
-- COMMENTS FOR DOCUMENTATION
-- ==============================
COMMENT ON TABLE clients IS 'Client organizations using the Custodia system';
COMMENT ON TABLE users IS 'User accounts belonging to clients';
COMMENT ON TABLE trackers IS 'Animal tracking devices';
COMMENT ON TABLE locations IS 'GPS location data from trackers';

