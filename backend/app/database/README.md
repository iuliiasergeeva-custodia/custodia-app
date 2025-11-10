# Database Setup Guide

This directory contains the database schema, seed data, and connection utilities for the Custodia project.

## Files

- `schema.sql` - Database schema (tables, indexes, constraints)
- `seed.sql` - Mock data for testing (based on mock_locations.csv)
- `test_queries.sql` - Optional SQL queries for testing and verification
- `../db.js` - Node.js database connection module (using pg)

## Prerequisites

1. **Install PostgreSQL:**
   ```bash
   brew install postgresql
   ```

2. **Start PostgreSQL service:**
   ```bash
   brew services start postgresql
   ```

3. **Create local database:**
   ```bash
   psql postgres
   ```
   
   Then in psql:
   ```sql
   CREATE DATABASE custodia_local;
   \c custodia_local
   ```

## Setup Steps

### 1. Create Database Schema

Run the schema file to create all tables:

```bash
psql custodia_local < backend/app/database/schema.sql
```

Or from within psql:
```sql
\i backend/app/database/schema.sql
```

### 2. Seed Database with Mock Data

Load the seed data:

```bash
psql custodia_local < backend/app/database/seed.sql
```

Or from within psql:
```sql
\i backend/app/database/seed.sql
```

### 3. Verify Data

Run test queries to verify everything is set up correctly:

```bash
psql custodia_local < backend/app/database/test_queries.sql
```

### Updating Existing Databases

If your database was created before the repeaters feature, run the migration:

```bash
psql $DATABASE_URL < backend/app/database/migrations/20241109_add_repeaters_and_tracker_updates.sql
```

If your database existed before battery initialization was added, run:

```bash
psql $DATABASE_URL < backend/app/database/migrations/20241110_add_initial_battery_voltage.sql
```

Or test the connection from Node.js:

```bash
node -e "require('./backend/app/db.js').testConnection().then(() => process.exit())"
```

## Environment Variables

Add these to your `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=custodia_local
DB_USER=postgres
DB_PASSWORD=your_password
```

Or use the default values (localhost, postgres user, no password).

## Using the Database in Node.js

```javascript
const db = require('./backend/app/db.js');

// Simple query
const result = await db.query('SELECT * FROM trackers');
console.log(result.rows);

// Query with parameters
const locations = await db.query(
    'SELECT * FROM locations WHERE tracker_id = $1',
    [1]
);

// Test connection
await db.testConnection();
```

## Database Structure

- **clients** - Client organizations
- **users** - User accounts (admin, manager, viewer roles)
- **trackers** - Animal tracking devices
- **repeaters** - Edge devices forwarding tracker packets
- **locations** - GPS location data from trackers

### Field Glossary

**trackers**

| Field | Type / Unit | Description |
|-------|-------------|-------------|
| `slug` | text | Human-friendly tracker identifier (e.g. `trk_001`). |
| `animal_type` | text | Species or category (Leopard, Oryx, etc.). |
| `animal_name` | text | Individual animal name / label. |
| `family` | text | Optional taxonomic grouping or herd identifier. |
| `expected_battery_life` | days (integer) | Estimated battery lifespan under typical duty cycle. |
| `frequency_acquisition` | minutes (integer) | How often the tracker acquires a GPS fix. |
| `frequency_sending` | minutes (integer) | How often the tracker transmits collected fixes to the network. |
| `last_seen` | timestamp (UTC) | Time of the latest packet attributed to this tracker. |
| `last_battery_voltage` | volts (decimal) | Battery voltage from the most recent packet. |
| `initial_battery_voltage` | volts (decimal) | Baseline “full” battery voltage used to estimate remaining percentage. |
| `created_at` | timestamp | Record creation time (defaults to `NOW()`). |

**repeaters**

| Field | Type / Unit | Description |
|-------|-------------|-------------|
| `repeater_id` | text | Unique repeater identifier supplied by ingestion payloads (e.g. `RPT-001`). |
| `last_seen` | timestamp (UTC) | Latest time this repeater forwarded any tracker packets. |

**locations**

| Field | Type / Unit | Description |
|-------|-------------|-------------|
| `tracker_id` | FK | Reference to the tracker that generated the fix. |
| `repeater_id` | FK (nullable) | Repeater that forwarded the fix (when known). |
| `longitude` / `latitude` | decimal degrees | Position with 6-decimal precision. |
| `timestamp` | timestamp (UTC) | When the fix was recorded by the tracker. |
| `battery_voltage` | volts (decimal) | Battery level reported for that fix. |
| `fix_number` | integer | Sequential fix counter per tracker (auto-generated if absent). |
| `created_at` | timestamp | Insert time in the database (defaults to `NOW()`). |

## Seed Data

The seed data includes:
- 1 client (Custodia)
- 3 users (admin, manager, viewer)
- 5 trackers (TRK-001 to TRK-005)
- 23 location records (from mock_locations.csv)

## Troubleshooting

### Connection Issues

If you get connection errors:
1. Verify PostgreSQL is running: `brew services list | grep postgresql`
2. Check database exists: `psql -l | grep custodia_local`
3. Verify user permissions: `psql -U postgres -d custodia_local`

### Permission Issues

If you get permission errors:
```bash
# Grant permissions (if needed)
psql postgres
ALTER USER postgres WITH SUPERUSER;
```

### Port Already in Use

If port 5432 is already in use:
```bash
# Check what's using the port
lsof -i :5432

# Or use a different port in .env
DB_PORT=5433
```

