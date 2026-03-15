/**
 * Repeater coverage alert service.
 * Checks locations against repeater coverage (7 km radius) and sends email alerts
 * when a location is in the "border zone" (6.5–7 km) or out of coverage (> 7 km).
 */

const nodemailer = require('nodemailer');

const COVERAGE_RADIUS_KM = 7;
const BORDER_INNER_KM = 6.5; // Alert when distance is between BORDER_INNER_KM and COVERAGE_RADIUS_KM (border) or > COVERAGE_RADIUS_KM (out of coverage)
const ALERT_EMAIL_TO = 'julia@custodia.world';

/**
 * Haversine distance between two points in km.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in kilometers
 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Get minimum distance from a point to any repeater.
 * @param {number} lat
 * @param {number} lng
 * @param {Array<{ latitude: number, longitude: number, repeater_id?: string }>} repeaters
 * @returns {{ distanceKm: number, nearestRepeaterId: string | null }}
 */
function minDistanceToRepeaters(lat, lng, repeaters) {
    let minKm = Infinity;
    let nearestRepeaterId = null;
    for (const r of repeaters) {
        const latR = parseFloat(r.latitude);
        const lngR = parseFloat(r.longitude);
        if (Number.isFinite(latR) && Number.isFinite(lngR)) {
            const d = haversineKm(lat, lng, latR, lngR);
            if (d < minKm) {
                minKm = d;
                nearestRepeaterId = r.repeater_id || null;
            }
        }
    }
    return { distanceKm: minKm === Infinity ? null : minKm, nearestRepeaterId };
}

/**
 * Check which locations are in the coverage border zone (6.5–7 km) or out of coverage (> 7 km).
 * @param {Array<{ lat: number, lng: number, tracker_slug?: string, timestamp?: string, repeater_id?: string }>} locations
 * @param {Array<{ latitude: number, longitude: number, repeater_id?: string }>} repeaters
 * @param {Object} options
 * @param {number} [options.borderMinKm=6.5]
 * @param {number} [options.borderMaxKm=7]
 * @returns {{ borderZone: Array, outOfCoverage: Array }} locations in border zone (6.5–7 km) and out of coverage (> 7 km)
 */
function getLocationsInCoverageZone(locations, repeaters, options = {}) {
    const borderMinKm = options.borderMinKm ?? BORDER_INNER_KM;
    const borderMaxKm = options.borderMaxKm ?? COVERAGE_RADIUS_KM;

    const borderZone = [];
    const outOfCoverage = [];

    if (!repeaters || repeaters.length === 0) {
        // No repeaters with coordinates: treat all locations as "out of coverage" for alerting
        locations.forEach((loc) => {
            outOfCoverage.push({
                ...loc,
                distanceKm: null,
                nearestRepeaterId: null,
                zone: 'out_of_coverage',
            });
        });
        return { borderZone, outOfCoverage };
    }

    for (const loc of locations) {
        const lat = parseFloat(loc.lat ?? loc.latitude);
        const lng = parseFloat(loc.lng ?? loc.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const { distanceKm, nearestRepeaterId } = minDistanceToRepeaters(lat, lng, repeaters);
        if (distanceKm == null) continue;

        const entry = {
            ...loc,
            distanceKm,
            nearestRepeaterId,
        };

        if (distanceKm > borderMaxKm) {
            entry.zone = 'out_of_coverage';
            outOfCoverage.push(entry);
        } else if (distanceKm >= borderMinKm && distanceKm <= borderMaxKm) {
            entry.zone = 'border';
            borderZone.push(entry);
        }
    }

    return { borderZone, outOfCoverage };
}

/**
 * Send one email to ALERT_EMAIL_TO listing locations in border zone and/or out of coverage.
 * Uses env EMAIL_USER / EMAIL_PASS (same as contact form). In EMAIL_TEST_MODE, logs only.
 * @param {{ borderZone: Array, outOfCoverage: Array }} alertResults from getLocationsInCoverageZone
 * @returns {Promise<void>}
 */
async function sendCoverageAlertEmail(alertResults) {
    const { borderZone = [], outOfCoverage = [] } = alertResults;
    const total = borderZone.length + outOfCoverage.length;
    if (total === 0) return;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
    });

    const formatLoc = (loc) => {
        const lat = loc.lat ?? loc.latitude;
        const lng = loc.lng ?? loc.longitude;
        const ts = loc.timestamp ? new Date(loc.timestamp).toISOString() : '—';
        const dist = loc.distanceKm != null ? `${loc.distanceKm.toFixed(2)} km` : '—';
        return `  • ${loc.tracker_slug || 'Tracker'} @ (${lat}, ${lng}) — ${dist} from ${loc.nearestRepeaterId || 'N/A'} — ${ts}`;
    };

    const borderList = borderZone.map(formatLoc).join('\n');
    const outList = outOfCoverage.map(formatLoc).join('\n');

    const subject = `[Custodia] Coverage alert: ${total} location(s) near or outside repeater coverage`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #1a365d;">Repeater coverage alert</h2>
      <p>${total} location(s) are in the coverage border zone (6.5–7 km) or outside coverage (> 7 km).</p>
      ${borderZone.length > 0 ? `
      <h3 style="color: #2d3748;">Border zone (6.5–7 km)</h3>
      <pre style="background: #f7fafc; padding: 12px; border-radius: 8px; font-size: 13px;">${borderList || '—'}</pre>
      ` : ''}
      ${outOfCoverage.length > 0 ? `
      <h3 style="color: #2d3748;">Out of coverage (> 7 km)</h3>
      <pre style="background: #fed7d7; padding: 12px; border-radius: 8px; font-size: 13px;">${outList || '—'}</pre>
      ` : ''}
      <p style="color: #718096; font-size: 14px; margin-top: 24px;">Custodia coverage alert — ${new Date().toISOString()}</p>
    </div>
    `;
    const text = [
        `Repeater coverage alert: ${total} location(s) near or outside repeater coverage`,
        borderZone.length > 0 ? `Border zone (6.5–7 km):\n${borderList}` : '',
        outOfCoverage.length > 0 ? `Out of coverage (> 7 km):\n${outList}` : '',
    ]
        .filter(Boolean)
        .join('\n\n');

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: ALERT_EMAIL_TO,
        subject,
        html,
        text,
    };

    if (process.env.EMAIL_TEST_MODE === 'true') {
        console.log('📧 [COVERAGE ALERT – TEST MODE] Would send to', ALERT_EMAIL_TO);
        console.log('Subject:', subject);
        console.log('Border zone:', borderZone.length, 'Out of coverage:', outOfCoverage.length);
        return;
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Coverage alert email sent to', ALERT_EMAIL_TO);
    } catch (err) {
        console.error('❌ Failed to send coverage alert email:', err.message || err);
    }
}

module.exports = {
    haversineKm,
    minDistanceToRepeaters,
    getLocationsInCoverageZone,
    sendCoverageAlertEmail,
    COVERAGE_RADIUS_KM,
    BORDER_INNER_KM,
    ALERT_EMAIL_TO,
};
