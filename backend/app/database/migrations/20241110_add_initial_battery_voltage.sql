ALTER TABLE trackers
    ADD COLUMN IF NOT EXISTS initial_battery_voltage DECIMAL(5,2);

UPDATE trackers
SET initial_battery_voltage = COALESCE(initial_battery_voltage, 4.20)
WHERE initial_battery_voltage IS NULL;

