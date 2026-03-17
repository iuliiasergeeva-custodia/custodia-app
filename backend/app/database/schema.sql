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
    device_id INTEGER UNIQUE,
    slug VARCHAR(50) UNIQUE NOT NULL,
    animal_type VARCHAR(50),
    animal_name VARCHAR(100),
    family VARCHAR(50),
    expected_battery_life INTEGER,
    frequency_acquisition INTEGER,
    frequency_sending INTEGER,
    last_seen TIMESTAMP,
    updated_at TIMESTAMP,
    last_battery_voltage DECIMAL(5,2),
    initial_battery_voltage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================
-- REPEATERS TABLE
-- ==============================
CREATE TABLE repeaters (
    id SERIAL PRIMARY KEY,
    repeater_id VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    longitude DECIMAL(9,6),
    latitude DECIMAL(9,6),
    height DECIMAL(8,2),
    total_locations_collected INTEGER NOT NULL DEFAULT 0,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
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
    source VARCHAR(20),
    temperature_c DECIMAL(4,1),
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
CREATE INDEX idx_repeaters_client_id ON repeaters(client_id);
CREATE INDEX idx_repeaters_latitude_longitude ON repeaters(latitude, longitude);
CREATE INDEX idx_locations_tracker_id ON locations(tracker_id);
CREATE INDEX idx_locations_repeater_id ON locations(repeater_id);
CREATE INDEX idx_locations_timestamp ON locations(timestamp);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);

-- ==============================
-- PASSWORD RESET TOKENS
-- ==============================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- ==============================
-- COMMENTS FOR DOCUMENTATION
-- ==============================
COMMENT ON TABLE clients IS 'Client organizations using the Custodia system';
COMMENT ON TABLE users IS 'User accounts belonging to clients';
COMMENT ON TABLE trackers IS 'Animal tracking devices';
COMMENT ON TABLE locations IS 'GPS location data from trackers';

