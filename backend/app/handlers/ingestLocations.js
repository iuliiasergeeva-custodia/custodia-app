const db = require('../db');

const API_KEY = process.env.LOCATIONS_API_KEY || 'abs123qwe';

function extractApiKey(req) {
    const headerKey = req.header('x-api-key');
    if (headerKey && headerKey.trim() !== '') {
        return headerKey.trim();
    }

    const authHeader = req.header('authorization');
    if (!authHeader) {
        return null;
    }

    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    return authHeader.trim();
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function normalizeTrackerSlug(slug) {
    if (typeof slug !== 'string') {
        return null;
    }
    return slug.trim();
}

async function getDefaultClientId(client) {
    const preferred = await client.query(
        `SELECT id FROM clients WHERE slug = $1 LIMIT 1`,
        ['custodia']
    );
    if (preferred.rowCount > 0) {
        return preferred.rows[0].id;
    }

    const anyClient = await client.query(
        `SELECT id FROM clients ORDER BY id LIMIT 1`
    );
    if (anyClient.rowCount > 0) {
        return anyClient.rows[0].id;
    }

    const inserted = await client.query(
        `INSERT INTO clients (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        ['Default Client', 'default-client']
    );
    return inserted.rows[0].id;
}

async function findOrCreateTracker(client, trackerSlug, packetTimestamp, batteryVoltage) {
    const normalized = normalizeTrackerSlug(trackerSlug);
    if (!normalized) {
        throw new Error('Invalid tracker ID');
    }

    const altSlug = normalized.toLowerCase();
    const result = await client.query(
        `SELECT id, slug, client_id, initial_battery_voltage FROM trackers WHERE slug = $1 OR slug = $2 LIMIT 1`,
        [normalized, altSlug]
    );

    if (result.rowCount > 0) {
        if (!result.rows[0].client_id) {
            const defaultClientId = await getDefaultClientId(client);
            await client.query(
                `UPDATE trackers SET client_id = $1 WHERE id = $2`,
                [defaultClientId, result.rows[0].id]
            );
        }
        if (batteryVoltage !== undefined && batteryVoltage !== null && result.rows[0].initial_battery_voltage === null) {
            await client.query(
                `UPDATE trackers SET initial_battery_voltage = $1 WHERE id = $2`,
                [batteryVoltage, result.rows[0].id]
            );
        }
        return {
            id: result.rows[0].id,
            slug: result.rows[0].slug,
            created: false,
        };
    }

    const defaultClientId = await getDefaultClientId(client);

    const insertResult = await client.query(
        `INSERT INTO trackers (client_id, slug, last_seen, last_battery_voltage, initial_battery_voltage)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, slug`,
        [defaultClientId, normalized, packetTimestamp, batteryVoltage, batteryVoltage]
    );

    return {
        id: insertResult.rows[0].id,
        slug: insertResult.rows[0].slug,
        created: true,
    };
}

function normalizePacketsFromDeviceFormat(payload, errors) {
    if (!Array.isArray(payload.data)) {
        errors.push('data must be an array');
        return [];
    }

    return payload.data.map((packet, index) => {
        if (!packet || typeof packet !== 'object') {
            errors.push(`data[${index}] must be an object`);
            return null;
        }

        const deviceId = packet.device_id;
        if (deviceId === undefined || deviceId === null || Number.isNaN(Number(deviceId))) {
            errors.push(`data[${index}].device_id is required and must be numeric`);
        }

        const trackerSlug = String(Number(deviceId) - 1000).padStart(3, '0');

        const timestamp = normalizeTimestamp(packet.timestamp ? packet.timestamp * 1000 : null);
        if (!timestamp) {
            errors.push(`data[${index}].timestamp must be a valid Unix timestamp (seconds)`);
        }

        const latitude = normalizeNumber(packet.latitude);
        if (latitude === null || latitude < -90 || latitude > 90) {
            errors.push(`data[${index}].latitude must be a number between -90 and 90`);
        }

        const longitude = normalizeNumber(packet.longitude);
        if (longitude === null || longitude < -180 || longitude > 180) {
            errors.push(`data[${index}].longitude must be a number between -180 and 180`);
        }

        const voltage = normalizeNumber(packet.voltage);
        if (voltage === null) {
            errors.push(`data[${index}].voltage must be numeric`);
        }

        if (errors.length > 0) {
            return null;
        }

        return {
            tracker_id: trackerSlug,
            timestamp_utc: timestamp,
            latitude,
            longitude,
            battery_voltage: voltage,
            fix_number: null,
        };
    }).filter(Boolean);
}

function normalizeTimestamp(value) {
    if (!value && value !== 0) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
}
function normalizePayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        errors.push('Body must be a JSON object');
        return { errors, packets: [], repeaterId: null, repeaterTimestamp: null };
    }

    const repeaterId = typeof payload.repeater_id === 'string' && payload.repeater_id.trim() !== ''
        ? payload.repeater_id.trim()
        : 'UNKNOWN-REPEATER';

    let repeaterTimestamp = null;

    const packets = [];

    if (!Array.isArray(payload.data)) {
        errors.push('Request must include data[] array');
    } else {
        const normalizedPackets = normalizePacketsFromDeviceFormat(payload, errors);
        packets.push(...normalizedPackets);
    }

    if (!repeaterTimestamp && packets.length > 0) {
        repeaterTimestamp = packets.reduce((latest, packet) => {
            const currentTime = Date.parse(packet.timestamp_utc);
            if (!latest) {
                return packet.timestamp_utc;
            }
            return currentTime > Date.parse(latest) ? packet.timestamp_utc : latest;
        }, null);
    }

    if (!repeaterTimestamp) {
        repeaterTimestamp = new Date().toISOString();
    }

    return {
        errors,
        repeaterId,
        repeaterTimestamp,
        packets,
    };
}

module.exports = async function ingestLocations(req, res) {
    try {
        const providedKey = extractApiKey(req);
        if (providedKey !== API_KEY) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid API key',
            });
        }

        const { errors, packets, repeaterId, repeaterTimestamp } = normalizePayload(req.body);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payload',
                details: errors,
            });
        }

        if (!packets || packets.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payload',
                message: 'No packets to ingest',
            });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const repeaterResult = await client.query(
                `INSERT INTO repeaters (repeater_id, last_seen)
                 VALUES ($1, $2)
                 ON CONFLICT (repeater_id) DO UPDATE
                 SET last_seen = EXCLUDED.last_seen
                 RETURNING id`,
                [repeaterId, repeaterTimestamp]
            );

            const repeaterDbId = repeaterResult.rows[0].id;
            let inserted = 0;
            const updatedTrackerIds = new Set();
            const fixCounters = new Map();

            for (const packet of packets) {
                const trackerInfo = await findOrCreateTracker(
                    client,
                    packet.tracker_id,
                    packet.timestamp_utc,
                    packet.battery_voltage
                );

                let fixNumber = packet.fix_number;
                if (fixNumber === null || fixNumber === undefined) {
                    if (!fixCounters.has(trackerInfo.id)) {
                        const maxFixResult = await client.query(
                            `SELECT COALESCE(MAX(fix_number), 0) as max_fix
                             FROM locations
                             WHERE tracker_id = $1`,
                            [trackerInfo.id]
                        );
                        fixCounters.set(trackerInfo.id, Number(maxFixResult.rows[0].max_fix) || 0);
                    }
                    const nextFix = fixCounters.get(trackerInfo.id) + 1;
                    fixCounters.set(trackerInfo.id, nextFix);
                    fixNumber = nextFix;
                } else {
                    fixCounters.set(trackerInfo.id, fixNumber);
                }

                await client.query(
                    `INSERT INTO locations
                        (tracker_id, repeater_id, longitude, latitude, timestamp, battery_voltage, fix_number)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        trackerInfo.id,
                        repeaterDbId,
                        packet.longitude,
                        packet.latitude,
                        packet.timestamp_utc,
                        packet.battery_voltage,
                        fixNumber,
                    ]
                );
                inserted += 1;

                await client.query(
                    `UPDATE trackers
                     SET last_seen = $1,
                         last_battery_voltage = $2,
                         initial_battery_voltage = COALESCE(initial_battery_voltage, $4)
                     WHERE id = $3`,
                    [packet.timestamp_utc, packet.battery_voltage, trackerInfo.id, packet.battery_voltage]
                );
                updatedTrackerIds.add(trackerInfo.id);
            }

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                inserted,
                updated_trackers: updatedTrackerIds.size,
                message: `${inserted} location packets saved from repeater ${repeaterId}`,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ [INGEST] Transaction failed:', error);
            return res.status(500).json({
                success: false,
                error: 'Ingestion failed',
                message: error.message,
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ [INGEST] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Unexpected server error',
        });
    }
};

