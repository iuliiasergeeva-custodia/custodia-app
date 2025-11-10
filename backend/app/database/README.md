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

