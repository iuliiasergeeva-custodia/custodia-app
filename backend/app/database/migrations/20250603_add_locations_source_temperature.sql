-- Migration: add source and temperature_c columns to locations
-- Safe to run multiple times (uses IF NOT EXISTS)

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS source VARCHAR(20);

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS temperature_c DECIMAL(4,1);

