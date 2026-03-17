-- Migration: add device_id and updated_at to trackers
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE trackers
    ADD COLUMN IF NOT EXISTS device_id INTEGER UNIQUE;

ALTER TABLE trackers
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

