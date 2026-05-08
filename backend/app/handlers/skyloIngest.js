const db = require('../db');

function u8(hex, byteOffset) {
    return parseInt(hex.substr(byteOffset * 2, 2), 16);
}
function i8(hex, byteOffset) {
    const v = u8(hex, byteOffset);
    return v > 127 ? v - 256 : v;
}
function u16le(hex, byteOffset) {
    return (u8(hex, byteOffset + 1) << 8) | u8(hex, byteOffset);
}
function i16le(hex, byteOffset) {
    const v = u16le(hex, byteOffset);
    return v > 32767 ? v - 65536 : v;
}
function u32le(hex, byteOffset) {
    return (
        ((u8(hex, byteOffset + 3) << 24) >>> 0) |
        (u8(hex, byteOffset + 2) << 16) |
        (u8(hex, byteOffset + 1) << 8) |
        u8(hex, byteOffset)
    ) >>> 0;
}
function i32le(hex, byteOffset) {
    const v = u32le(hex, byteOffset);
    return v > 2147483647 ? v - 4294967296 : v;
}

function parseHexPayload(raw) {
    const hex = raw.replace(/^0x/i, '').replace(/[\s\r\n]+/g, '').toLowerCase();
    if (hex.length === 0) throw new Error('Empty payload');
    if (hex.length % 36 !== 0) throw new Error(`Bad length: ${hex.length} chars`);

    const recordCount = hex.length / 36;
    const records = [];
    for (let r = 0; r < recordCount; r++) {
        const off = r * 18;
        const time_s = u32le(hex, off + 1);
        records.push({
            device_id:  u8(hex, off + 0),
            timestamp:  time_s > 0 ? new Date(time_s * 1000).toISOString() : new Date().toISOString(),
            latitude:   i32le(hex, off + 5) / 10000000,
            longitude:  i32le(hex, off + 9) / 10000000,
            alt_m:      i16le(hex, off + 13),
            temp_c:     i8(hex, off + 15),
            battery_v:  u16le(hex, off + 16) / 1000,
        });
    }
    return records;
}

async function getOrCreateTracker(device_id) {
    const existing = await db.query(
        'SELECT id FROM trackers WHERE device_id = $1',
        [device_id]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const slug = `skylo_${device_id}`;
    const inserted = await db.query(
        `INSERT INTO trackers (client_id, device_id, slug, created_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (slug) DO UPDATE SET device_id = EXCLUDED.device_id
         RETURNING id`,
        [device_id, slug]
    );
    console.log(`🆕 [Skylo] Auto-created tracker: slug=${slug}, device_id=${device_id}`);
    return inserted.rows[0].id;
}

async function skyloIngest(req, res) {
    // Accept hex from body as plain text, JSON field, or query param
    let raw = '';
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
        raw = req.body.trim();
    } else if (req.body && req.body.payload) {
        raw = String(req.body.payload).trim();
    } else if (req.body && req.body.data) {
        raw = String(req.body.data).trim();
    } else if (req.query && req.query.payload) {
        raw = String(req.query.payload).trim();
    }

    if (!raw) {
        return res.status(400).json({ error: 'No payload found. Send hex as plain text body, or JSON field "payload" or "data".' });
    }

    let records;
    try {
        records = parseHexPayload(raw);
    } catch (err) {
        console.error(`❌ [Skylo] Parse error: ${err.message} — raw: ${raw}`);
        return res.status(400).json({ error: err.message });
    }

    let inserted = 0;
    for (const record of records) {
        try {
            const tracker_id = await getOrCreateTracker(record.device_id);

            await db.query(
                `INSERT INTO locations
                    (tracker_id, latitude, longitude, timestamp, battery_voltage, temperature_c, source, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'skylo', NOW())`,
                [tracker_id, record.latitude, record.longitude, record.timestamp, record.battery_v, record.temp_c]
            );

            await db.query(
                `UPDATE trackers
                 SET last_seen = $1, last_battery_voltage = $2, updated_at = NOW()
                 WHERE id = $3`,
                [record.timestamp, record.battery_v, tracker_id]
            );

            console.log(
                `✅ [Skylo] Inserted — device_id=${record.device_id} ` +
                `lat=${record.latitude} lon=${record.longitude} ` +
                `batt=${record.battery_v}V temp=${record.temp_c}°C`
            );
            inserted++;
        } catch (err) {
            console.error(`❌ [Skylo] DB error for device_id=${record.device_id}: ${err.message}`);
            return res.status(500).json({ error: 'Database insert failed', detail: err.message });
        }
    }

    return res.status(200).json({ ok: true, records_inserted: inserted });
}

module.exports = skyloIngest;
