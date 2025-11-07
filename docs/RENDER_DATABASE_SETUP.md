# Connecting Render PostgreSQL Database

This guide explains how to connect your Render PostgreSQL database to your Custodia application.

## Step 1: Create PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure the database:
   - **Name**: `custodia-db` (or any name you prefer)
   - **Database**: `custodia` (or leave default)
   - **User**: Auto-generated
   - **Region**: Choose closest to your web service
   - **Plan**: Free (or paid if needed)
4. Click **"Create Database"**

## Step 2: Get Connection String

After creating the database:

1. Go to your PostgreSQL service in Render dashboard
2. Find the **"Connections"** section
3. Copy the **"Internal Database URL"** (for services in the same region)
   - Format: `postgresql://user:password@host:port/database`
   - Example: `postgresql://custodia_user:password@dpg-xxxxx-a/custodia`

**Important**: Use **Internal Database URL** if your web service is in the same region, or **External Database URL** if they're in different regions.

## Step 3: Set Environment Variable in Render

### Option A: Using render.yaml (Recommended)

The `render.yaml` file is already configured to automatically link the database:

```yaml
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: custodia-db
      property: connectionString
```

**Important**: Make sure the database name in `render.yaml` matches your actual database service name on Render.

### Option B: Manual Setup

1. Go to your **Web Service** in Render dashboard
2. Go to **"Environment"** section
3. Add environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the connection string from Step 2
4. Click **"Save Changes"**

## Step 4: Initialize Database Schema

After connecting, you need to create the database tables:

### Option A: Using Render Shell (Recommended)

1. Go to your PostgreSQL service in Render dashboard
2. Click **"Connect"** → **"Render Shell"**
3. Run the schema file:
   ```bash
   psql $DATABASE_URL < backend/app/database/schema.sql
   ```
4. Seed the database:
   ```bash
   psql $DATABASE_URL < backend/app/database/seed.sql
   ```

### Option B: Using psql from Local Machine

1. Get the **External Database URL** from Render (if you need to connect from outside)
2. Run locally:
   ```bash
   psql "postgresql://user:password@host:port/database" < backend/app/database/schema.sql
   psql "postgresql://user:password@host:port/database" < backend/app/database/seed.sql
   ```

### Option C: Using Node.js Script

Create a script to run SQL files programmatically (useful for automated setup).

## Step 5: Verify Connection

1. Deploy your web service (or restart if already deployed)
2. Check the logs - you should see:
   ```
   📊 Using DATABASE_URL for database connection
   ✅ Connected to PostgreSQL database
   ```
3. Test the health endpoint:
   ```bash
   curl https://your-app.onrender.com/api/health
   ```
   Should show: `"database": "connected"`

4. Test the locations endpoint:
   ```bash
   curl https://your-app.onrender.com/api/locations | head -5
   ```
   Should return CSV data from your database.

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes* | Full PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `DB_HOST` | No | Database host (local only) | `localhost` |
| `DB_PORT` | No | Database port (local only) | `5432` |
| `DB_NAME` | No | Database name (local only) | `custodia_local` |
| `DB_USER` | No | Database user (local only) | `postgres` |
| `DB_PASSWORD` | No | Database password (local only) | `password` |

*Required on Render. For local development, you can use either `DATABASE_URL` or individual parameters.

## Troubleshooting

### Connection Refused

- Check that PostgreSQL service is running on Render
- Verify `DATABASE_URL` is set correctly
- Check if you're using Internal vs External URL correctly

### SSL Connection Error

- Render PostgreSQL requires SSL in production
- The code automatically enables SSL when `NODE_ENV=production`
- If you get SSL errors, check that `NODE_ENV` is set to `production`

### Authentication Failed

- Verify the connection string is correct
- Check that the database user has proper permissions
- Make sure you're using the correct password

### Database Not Found

- Verify the database name in the connection string
- Check that the database was created successfully
- Ensure you're connecting to the right database instance

### Tables Don't Exist

- Run the schema file: `psql $DATABASE_URL < backend/app/database/schema.sql`
- Check that the schema file ran without errors
- Verify tables exist: `psql $DATABASE_URL -c "\dt"`

## Local vs Production

- **Local**: Uses individual connection parameters (`DB_HOST`, `DB_PORT`, etc.) or `DATABASE_URL`
- **Production (Render)**: Uses `DATABASE_URL` from Render's PostgreSQL service
- The code automatically detects which to use based on environment variables

## Next Steps

After connecting:
1. ✅ Database is connected
2. ✅ Tables are created (run schema.sql)
3. ✅ Data is seeded (run seed.sql)
4. ✅ Dashboard loads data from database
5. ✅ Health check shows database connected

Your dashboard should now load data from your Render PostgreSQL database!

