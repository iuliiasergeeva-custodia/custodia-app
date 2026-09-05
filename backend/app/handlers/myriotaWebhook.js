const db = require('../db');

// Hex helpers (little-endian, signed/unsigned)
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

async function myriotaWebhook(req, res) {
    const body = req.body || {};

    // Validation: Data field must exist and be non-empty
    if (!body.Data || typeof body.Data !== 'string' || body.Data.trim() === '') {
        return res.status(400).json({ error: 'Missing Data field' });
    }

    let parsed;
    try {
        // Outer JSON already parsed by express.json; Data is a JSON string
        parsed = JSON.parse(body.Data);
    } catch (err) {
        console.error('❌ [Myriota] Failed to parse Data JSON:', err.message || err);
        // Do not trigger retries – return 200 with received = 0
        return res.status(200).json({ received: 0 });
    }

    const packets = Array.isArray(parsed.Packets) ? parsed.Packets : [];
    let received = 0;
    const trackerCache = new Map(); // device_id -> tracker_id

    for (const packet of packets) {
        const valueHex = (packet && typeof packet.Value === 'string') ? packet.Value.trim().toLowerCase() : '';
        if (!valueHex) {
            continue;
        }

        if (valueHex.length % 36 !== 0) {
            console.error('❌ [Myriota] Value hex length not multiple of 36:', valueHex.length);
            // As per spec: log error, but return 200 overall; skip this packet
            continue;
        }

        const recordCount = valueHex.length / 36;

        for (let r = 0; r < recordCount; r += 1) {
            const chunk = valueHex.slice(r * 36, r * 36 + 36);
            const fixNumber = r + 1; // 1-based index within this payload

            try {
                const deviceId = u8(chunk, 0);
                const timestamp_s = u32le(chunk, 1);
                const timestamp = new Date(timestamp_s * 1000);
                const latRaw = i32le(chunk, 5);
                const lonRaw = i32le(chunk, 9);
                const lat = latRaw / 10_000_000;
                const lon = lonRaw / 10_000_000;
                const alt_m = i16le(chunk, 13); // not stored, but useful for logs
                const tempC = i8(chunk, 15);
                const batteryMv = u16le(chunk, 16);
                const batteryVoltage = batteryMv / 1000;

                let trackerId = trackerCache.get(deviceId);
                if (!trackerId) {
                    // Step 1: tracker lookup / creation by device_id (scoped to
                    // type='myriota' — device_id alone is not globally unique
                    // across ingestion sources)
                    const existing = await db.query(
                        `SELECT id FROM trackers WHERE device_id = $1 AND type = 'myriota'`,
                        [deviceId]
                    );
                    if (existing.rows.length > 0) {
                        trackerId = existing.rows[0].id;
                        await db.query(
                            'UPDATE trackers SET updated_at = NOW(), last_seen = $2, last_battery_voltage = $3 WHERE id = $1',
                            [trackerId, timestamp, batteryVoltage]
                        );
                    } else {
                        // Determine client_id for new trackers (similar to sign‑up logic)
                        let clientId;
                        const defaultSlug = process.env.SIGNUP_DEFAULT_CLIENT_SLUG || 'custodia';
                        const clientRes = await db.query(
                            'SELECT id FROM clients WHERE slug = $1 LIMIT 1',
                            [defaultSlug]
                        );
                        if (clientRes.rows.length > 0) {
                            clientId = clientRes.rows[0].id;
                        } else {
                            const first = await db.query('SELECT id FROM clients ORDER BY id LIMIT 1');
                            if (first.rows.length === 0) {
                                console.error('❌ [Myriota] No clients found; cannot create tracker for device_id', deviceId);
                                continue;
                            }
                            clientId = first.rows[0].id;
                        }

                        const slug = `myriota_${deviceId}`;
                        const insertedTracker = await db.query(
                            `INSERT INTO trackers (client_id, device_id, type, slug, updated_at, last_seen, last_battery_voltage, initial_battery_voltage)
                             VALUES ($1, $2, 'myriota', $3, NOW(), $4, $5, $5)
                             RETURNING id`,
                            [clientId, deviceId, slug, timestamp, batteryVoltage]
                        );
                        trackerId = insertedTracker.rows[0].id;
                    }
                    trackerCache.set(deviceId, trackerId);
                } else {
                    await db.query(
                        'UPDATE trackers SET updated_at = NOW(), last_seen = $2, last_battery_voltage = $3 WHERE id = $1',
                        [trackerId, timestamp, batteryVoltage]
                    );
                }

                // Step 2: duplicate check
                const dup = await db.query(
                    `SELECT id FROM locations
                     WHERE tracker_id = $1
                       AND timestamp = $2
                       AND source = 'myriota'
                     LIMIT 1`,
                    [trackerId, timestamp]
                );
                if (dup.rows.length > 0) {
                    console.log(
                        `[Myriota] duplicate skipped for tracker_id ${trackerId} at ${timestamp.toISOString()}`
                    );
                    continue;
                }

                // Step 3: insert location
                await db.query(
                    `INSERT INTO locations (
                        tracker_id,
                        repeater_id,
                        latitude,
                        longitude,
                        timestamp,
                        battery_voltage,
                        temperature_c,
                        fix_number,
                        source,
                        created_at
                    ) VALUES (
                        $1, NULL, $2, $3, $4, $5, $6, $7, 'myriota', NOW()
                    )`,
                    [
                        trackerId,
                        lat,
                        lon,
                        timestamp,
                        batteryVoltage,
                        tempC,
                        fixNumber,
                    ]
                );

                received += 1;
                console.log(
                    `[Myriota] inserted location: tracker_id=${trackerId}, device_id=${deviceId}, lat=${lat}, lon=${lon}, alt_m=${alt_m}, temp_c=${tempC}, battery=${batteryVoltage}`
                );
            } catch (err) {
                // Per-record error: log and continue
                console.error(
                    '❌ [Myriota] Error processing record chunk:',
                    { error: err.message || err, chunk }
                );
                continue;
            }
        }
    }

    // Always return 200 to avoid Myriota retries
    return res.status(200).json({ received });
}

module.exports = myriotaWebhook;

