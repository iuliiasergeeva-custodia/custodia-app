-- Migration: add trackers.type (ingestion source) and scope device_id
-- uniqueness per type instead of globally.
--
-- Context: trackers.device_id was UNIQUE across ALL ingestion pipelines
-- (LoRa gateway, Myriota satellite webhook, Skylo satellite ingest). All
-- three protocols encode device_id as a small integer/single byte, so a
-- LoRa collar and a satellite collar can legitimately end up with the same
-- device_id. Today that means whichever reports second either fails to
-- insert (unique violation) or, in one already-buggy path (Skylo's old
-- `ON CONFLICT (slug)` upsert, fixed alongside this migration in
-- skyloIngest.js), gets silently merged onto the wrong tracker.
--
-- This adds a `type` column set once per tracker, at creation, from the API
-- that ingested it ('lora' | 'myriota' | 'skylo') — never changed afterward,
-- same as device_id and id. It backfills existing rows from location
-- history and rescopes uniqueness to (device_id, type) so different device
-- families can safely reuse the same small integer IDs.
--
-- Idempotent — safe to run multiple times. Wrapped in a transaction so it's
-- all-or-nothing.

BEGIN;

ALTER TABLE trackers ADD COLUMN IF NOT EXISTS type VARCHAR(20);

-- Backfill from location history: a tracker's type is whichever source has
-- ingested the most locations for it (should be exactly one source per
-- tracker in practice; the ORDER BY picks deterministically for any tracker
-- that was ever double-fed by mistake).
UPDATE trackers t
SET type = sub.source
FROM (
    SELECT DISTINCT ON (tracker_id) tracker_id, source, cnt
    FROM (
        SELECT tracker_id, source, COUNT(*) AS cnt
        FROM locations
        WHERE source IS NOT NULL
        GROUP BY tracker_id, source
    ) counts
    ORDER BY tracker_id, cnt DESC
) sub
WHERE t.id = sub.tracker_id
  AND t.type IS NULL;

-- Fallback for trackers with no location history yet: infer from the
-- auto-generated slug prefix each ingestion handler uses for new trackers.
UPDATE trackers SET type = 'lora'    WHERE type IS NULL AND slug LIKE 'lora_%';
UPDATE trackers SET type = 'myriota' WHERE type IS NULL AND slug LIKE 'myriota_%';
UPDATE trackers SET type = 'skylo'   WHERE type IS NULL AND slug LIKE 'skylo_%';

-- Drop whatever the existing single-column uniqueness on device_id is
-- called (added as an inline UNIQUE in migration 20250604, so the name is
-- whatever Postgres auto-generated) and replace it with uniqueness scoped
-- per type.
DO $$
DECLARE
    con_name text;
BEGIN
    SELECT con.conname INTO con_name
    FROM pg_constraint con
    JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = con.conkey[1]
    WHERE con.conrelid = 'trackers'::regclass
      AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 1
      AND att.attname = 'device_id';

    IF con_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE trackers DROP CONSTRAINT %I', con_name);
    END IF;
END $$;

ALTER TABLE trackers DROP CONSTRAINT IF EXISTS trackers_device_id_type_key;
ALTER TABLE trackers ADD CONSTRAINT trackers_device_id_type_key UNIQUE (device_id, type);

COMMIT;

-- After running, check for any tracker with a device_id but no resolved
-- type (a manually-created row with no location history and a non-standard
-- slug). These can't collide with anything yet (NULL is distinct from NULL
-- in the new unique constraint) but should be given an explicit type by
-- hand before that device starts reporting:
--   SELECT id, slug, device_id, type FROM trackers WHERE device_id IS NOT NULL AND type IS NULL;
