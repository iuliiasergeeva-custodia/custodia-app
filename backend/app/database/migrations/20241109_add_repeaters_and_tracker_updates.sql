-- Migration: add repeaters table and tracker metadata columns

ALTER TABLE trackers
    ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;

ALTER TABLE trackers
    ADD COLUMN IF NOT EXISTS last_battery_voltage DECIMAL(5,2);

CREATE TABLE IF NOT EXISTS repeaters (
    id SERIAL PRIMARY KEY,
    repeater_id VARCHAR(50) UNIQUE NOT NULL,
    last_seen TIMESTAMP DEFAULT NOW()
);

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS repeater_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'locations_repeater_id_fkey'
          AND table_name = 'locations'
    ) THEN
        ALTER TABLE locations
            ADD CONSTRAINT locations_repeater_id_fkey
            FOREIGN KEY (repeater_id)
            REFERENCES repeaters(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trackers_last_seen ON trackers(last_seen);
CREATE INDEX IF NOT EXISTS idx_repeaters_repeater_id ON repeaters(repeater_id);
CREATE INDEX IF NOT EXISTS idx_locations_repeater_id ON locations(repeater_id);

