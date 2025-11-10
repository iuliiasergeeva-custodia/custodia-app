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

function isIsoTimestamp(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }
    const parsed = Date.parse(value);
    return !Number.isNaN(parsed);
}

function normalizeTrackerSlug(slug) {
    if (typeof slug !== 'string') {
        return null;
    }
    return slug.trim();
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

async function findOrCreateTracker(client, trackerSlug, packetTimestamp, batteryVoltage) {
    const normalized = normalizeTrackerSlug(trackerSlug);
    if (!normalized) {
        throw new Error('Invalid tracker ID');
    }

    const altSlug = normalized.toLowerCase();
    const result = await client.query(
        `SELECT id, slug FROM trackers WHERE slug = $1 OR slug = $2 LIMIT 1`,
        [normalized, altSlug]
    );

    if (result.rowCount > 0) {
        return {
            id: result.rows[0].id,
            slug: result.rows[0].slug,
            created: false,
        };
    }

    const insertResult = await client.query(
        `INSERT INTO trackers (client_id, slug, last_seen, last_battery_voltage)
         VALUES ($1, $2, $3, $4)
         RETURNING id, slug`,
        [null, normalized, packetTimestamp, batteryVoltage]
    );

    return {
        id: insertResult.rows[0].id,
        slug: insertResult.rows[0].slug,
        created: true,
    };
}

function validatePayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        errors.push('Body must be a JSON object');
        return { errors };
    }

    if (!payload.repeater_id || typeof payload.repeater_id !== 'string') {
        errors.push('repeater_id is required and must be a string');
    }

    if (!payload.timestamp_utc || !isIsoTimestamp(payload.timestamp_utc)) {
        errors.push('timestamp_utc is required and must be a valid ISO timestamp');
    }

    if (!Array.isArray(payload.packets)) {
        errors.push('packets must be an array');
        return { errors };
    }

    const sanitizedPackets = [];

    payload.packets.forEach((packet, index) => {
        if (!packet || typeof packet !== 'object') {
            errors.push(`packets[${index}] must be an object`);
            return;
        }

        const trackerSlug = normalizeTrackerSlug(packet.tracker_id);
        if (!trackerSlug) {
            errors.push(`packets[${index}].tracker_id is required`);
        }

        if (!isIsoTimestamp(packet.timestamp_utc)) {
            errors.push(`packets[${index}].timestamp_utc must be a valid ISO timestamp`);
        }

        const latitude = normalizeNumber(packet.latitude);
        if (latitude === null || latitude < -90 || latitude > 90) {
            errors.push(`packets[${index}].latitude must be a number between -90 and 90`);
        }

        const longitude = normalizeNumber(packet.longitude);
        if (longitude === null || longitude < -180 || longitude > 180) {
            errors.push(`packets[${index}].longitude must be a number between -180 and 180`);
        }

        const batteryVoltage = normalizeNumber(packet.battery_voltage);
        if (packet.battery_voltage !== undefined && batteryVoltage === null) {
            errors.push(`packets[${index}].battery_voltage must be numeric when provided`);
        }

        const fixNumber = packet.fix_number === undefined ? null : Number(packet.fix_number);
        if (packet.fix_number !== undefined && !Number.isInteger(fixNumber)) {
            errors.push(`packets[${index}].fix_number must be an integer when provided`);
        }

        sanitizedPackets.push({
            tracker_id: trackerSlug,
            timestamp_utc: packet.timestamp_utc,
            latitude,
            longitude,
            battery_voltage: batteryVoltage,
            fix_number: fixNumber,
        });
    });

    return { errors, packets: sanitizedPackets };
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

        const { errors, packets } = validatePayload(req.body);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payload',
                details: errors,
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
                [req.body.repeater_id.trim(), req.body.timestamp_utc]
            );

            const repeaterDbId = repeaterResult.rows[0].id;
            let inserted = 0;
            const updatedTrackerIds = new Set();

            for (const packet of packets) {
                const trackerInfo = await findOrCreateTracker(
                    client,
                    packet.tracker_id,
                    packet.timestamp_utc,
                    packet.battery_voltage
                );

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
                        packet.fix_number,
                    ]
                );
                inserted += 1;

                await client.query(
                    `UPDATE trackers
                     SET last_seen = $1,
                         last_battery_voltage = $2
                     WHERE id = $3`,
                    [packet.timestamp_utc, packet.battery_voltage, trackerInfo.id]
                );
                updatedTrackerIds.add(trackerInfo.id);
            }

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                inserted,
                updated_trackers: updatedTrackerIds.size,
                message: `${inserted} location packets saved from repeater ${req.body.repeater_id}`,
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

