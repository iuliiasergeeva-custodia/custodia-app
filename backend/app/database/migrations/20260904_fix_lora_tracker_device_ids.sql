-- Migration: fix LoRa tracker device_id mapping and merge duplicate trackers
--
-- Context: before commit 8a6739e, LoRa ingestion (ingestLocations.js) matched
-- trackers by a slug derived as `device_id - 1000`, leaving trackers.device_id
-- null. After the fix (which matches on device_id), ingestion couldn't find
-- those old rows and created new duplicate trackers (lora_2, lora_3, lora_4,
-- lora_6) for any device that reported again. This merges the duplicates back
-- onto the original rows (which hold the full location history) and sets the
-- correct device_id/slug on all 6 original rows so devices 1 and 5 (which
-- haven't reported since the fix) don't get duplicated too.
--
-- NOT idempotent (ids are specific to this one-time data fix) — verify the
-- ids below still match current data before running. Wrapped in a
-- transaction so it's all-or-nothing.

BEGIN;

-- Merge duplicates: move locations from the new (post-fix) tracker back onto
-- the original orphan tracker, then remove the duplicate row.
UPDATE locations SET tracker_id = 46 WHERE tracker_id = 52; -- device 4: orphan -996 <- lora_4
DELETE FROM trackers WHERE id = 52;

UPDATE locations SET tracker_id = 47 WHERE tracker_id = 53; -- device 2: orphan -998 <- lora_2
DELETE FROM trackers WHERE id = 53;

UPDATE locations SET tracker_id = 50 WHERE tracker_id = 54; -- device 3: orphan -997 <- lora_3
DELETE FROM trackers WHERE id = 54;

UPDATE locations SET tracker_id = 51 WHERE tracker_id = 55; -- device 6: orphan -994 <- lora_6
DELETE FROM trackers WHERE id = 55;

-- Set correct device_id / slug on all 6 original orphan trackers.
UPDATE trackers SET device_id = 1, slug = 'lora_1' WHERE id = 48; -- was -999
UPDATE trackers SET device_id = 2, slug = 'lora_2' WHERE id = 47; -- was -998
UPDATE trackers SET device_id = 3, slug = 'lora_3' WHERE id = 50; -- was -997
UPDATE trackers SET device_id = 4, slug = 'lora_4' WHERE id = 46; -- was -996
UPDATE trackers SET device_id = 5, slug = 'lora_5' WHERE id = 49; -- was -995
UPDATE trackers SET device_id = 6, slug = 'lora_6' WHERE id = 51; -- was -994

-- Recompute last_seen / last_battery_voltage from the merged location history
-- (the orphan row's last_seen may now be stale relative to the merged data).
UPDATE trackers t
SET last_seen = l.timestamp,
    last_battery_voltage = l.battery_voltage
FROM (
    SELECT DISTINCT ON (tracker_id) tracker_id, timestamp, battery_voltage
    FROM locations
    WHERE tracker_id IN (46, 47, 48, 49, 50, 51)
    ORDER BY tracker_id, timestamp DESC
) l
WHERE t.id = l.tracker_id;

COMMIT;
