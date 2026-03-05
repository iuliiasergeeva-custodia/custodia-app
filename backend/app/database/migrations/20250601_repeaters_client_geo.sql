-- Migration: Repeaters – client_id, coordinates, height, total_locations_collected, created_at
-- Keeps existing repeaters table intact; adds columns for multi-tenant and geo/stats.
-- Idempotent: safe to run multiple times.

-- Add client_id (multi-tenant link to clients)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'repeaters' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE repeaters
            ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add longitude
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'repeaters' AND column_name = 'longitude'
    ) THEN
        ALTER TABLE repeaters ADD COLUMN longitude DECIMAL(9,6);
    END IF;
END $$;

-- Add latitude
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'repeaters' AND column_name = 'latitude'
    ) THEN
        ALTER TABLE repeaters ADD COLUMN latitude DECIMAL(9,6);
    END IF;
END $$;

-- Add height (e.g. antenna height in meters)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'repeaters' AND column_name = 'height'
    ) THEN
        ALTER TABLE repeaters ADD COLUMN height DECIMAL(8,2);
    END IF;
END $$;

-- Add total_locations_collected (counter of locations relayed via this repeater)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'repeaters' AND column_name = 'total_locations_collected'
    ) THEN
        ALTER TABLE repeaters ADD COLUMN total_locations_collected INTEGER DEFAULT 0 NOT NULL;
    END IF;
END $$;

-- Add created_at if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'repeaters' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE repeaters ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Index for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_repeaters_client_id ON repeaters(client_id);

-- Optional: index for geo queries
CREATE INDEX IF NOT EXISTS idx_repeaters_latitude_longitude ON repeaters(latitude, longitude);

COMMENT ON COLUMN repeaters.client_id IS 'Client that owns this repeater (multi-tenant)';
COMMENT ON COLUMN repeaters.longitude IS 'Repeater longitude';
COMMENT ON COLUMN repeaters.latitude IS 'Repeater latitude';
COMMENT ON COLUMN repeaters.height IS 'Height e.g. antenna in meters';
COMMENT ON COLUMN repeaters.total_locations_collected IS 'Total locations relayed via this repeater';
COMMENT ON COLUMN repeaters.created_at IS 'When the repeater record was created';
