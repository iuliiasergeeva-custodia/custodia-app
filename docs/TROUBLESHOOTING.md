# Troubleshooting Guide

## Database Connection Issues

### Error: "Database connection failed" (503)

**Symptoms:**
- Dashboard shows error: "Database connection failed"
- Server logs show: "❌ [DATABASE] Connection error"
- Health check shows: `"database": "error"`

**Solutions:**

1. **Check DATABASE_URL is set:**
   ```bash
   # On Render, check Environment variables
   # Should have: DATABASE_URL = postgresql://...
   ```

2. **Verify database is running:**
   - Go to Render Dashboard → PostgreSQL service
   - Check status is "Available"
   - If paused, click "Resume"

3. **Check database name in render.yaml:**
   ```yaml
   - key: DATABASE_URL
     fromDatabase:
       name: custodia-db  # Must match your Render database name
   ```

4. **Test connection manually:**
   ```bash
   # Using Render Shell
   psql $DATABASE_URL -c "SELECT NOW();"
   ```

### Error: "Database tables not found" (503)

**Symptoms:**
- Error: "relation 'locations' does not exist"
- Error: "table does not exist"

**Solutions:**

1. **Run schema.sql:**
   ```bash
   # Using Render Shell
   psql $DATABASE_URL < backend/app/database/schema.sql
   ```

2. **Verify tables exist:**
   ```bash
   psql $DATABASE_URL -c "\dt"
   # Should show: clients, users, trackers, locations
   ```

3. **Check schema file path:**
   - Make sure `backend/app/database/schema.sql` exists
   - Verify it's committed to Git

### Error: "No locations found" (Empty Database)

**Symptoms:**
- Dashboard loads but shows no markers
- Console shows: "Parsed locations: 0"
- Warning: "Database is empty"

**Solutions:**

1. **Seed the database:**
   ```bash
   # Using Render Shell
   psql $DATABASE_URL < backend/app/database/seed.sql
   ```

2. **Verify data exists:**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM locations;"
   # Should return a number > 0
   ```

3. **Check seed file:**
   - Make sure `backend/app/database/seed.sql` exists
   - Verify it's committed to Git

## CSV Fallback Issues

### Error: "CSV file not found" (404)

**Symptoms:**
- Error: "Mock CSV file not found"
- Dashboard tries CSV fallback but fails

**Solutions:**

1. **This is expected if using database:**
   - CSV file is optional fallback
   - Database should be primary data source
   - If database is working, this error is harmless

2. **If you need CSV fallback:**
   - Create file: `frontend/pages/dashboard/assets/mock_locations.csv`
   - Commit to Git
   - Deploy again

## Deployment Issues

### Error: "Failed to fetch locations" (500)

**Symptoms:**
- Dashboard shows: "Failed to load location data"
- Server returns 500 error

**Solutions:**

1. **Check Render logs:**
   - Go to Render Dashboard → Your Web Service → Logs
   - Look for database connection errors
   - Check for stack traces

2. **Verify environment variables:**
   - `DATABASE_URL` should be set
   - `NODE_ENV` should be `production`

3. **Check database service:**
   - Ensure PostgreSQL service is running
   - Check it's in the same region as web service
   - Verify it's not paused

### Error: "Static files not loading" (404)

**Symptoms:**
- Dashboard has no styling
- Images don't load
- Console shows 404 for CSS/JS files

**Solutions:**

1. **Check file paths:**
   - All paths should use `/static/` prefix
   - Example: `/static/pages/dashboard/dashboard.js`

2. **Verify static file mounts:**
   - Check `server.js` has: `app.use('/static', express.static(...))`
   - Verify `frontend` directory exists

3. **Check file structure:**
   ```
   frontend/
     pages/
       dashboard/
         dashboard.js
         dashboard.css
         index.html
   ```

## Health Check Issues

### Health check shows database disconnected

**Symptoms:**
- `/api/health` returns: `"database": "disconnected"`
- Dashboard can't load data

**Solutions:**

1. **Check DATABASE_URL:**
   ```bash
   # In Render Shell
   echo $DATABASE_URL
   # Should show connection string
   ```

2. **Test connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Check SSL settings:**
   - Render requires SSL in production
   - Code automatically enables SSL when `NODE_ENV=production`
   - Verify `NODE_ENV` is set correctly

## Common Error Messages

### "ECONNREFUSED"
- **Cause**: Database is not accessible
- **Fix**: Check database is running, verify DATABASE_URL

### "ENOTFOUND"
- **Cause**: Database hostname is incorrect
- **Fix**: Check DATABASE_URL hostname matches Render database

### "relation does not exist"
- **Cause**: Tables not created
- **Fix**: Run `schema.sql`

### "authentication failed"
- **Cause**: Wrong username/password
- **Fix**: Check DATABASE_URL credentials

### "timeout"
- **Cause**: Database is slow or unreachable
- **Fix**: Check database status, verify network connectivity

## Quick Diagnostic Commands

### Check Database Connection
```bash
# In Render Shell
psql $DATABASE_URL -c "SELECT NOW();"
```

### Check Tables Exist
```bash
psql $DATABASE_URL -c "\dt"
```

### Check Data Exists
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM locations;"
```

### Check Environment Variables
```bash
# In Render Shell
echo $DATABASE_URL
echo $NODE_ENV
```

### Test API Endpoint
```bash
curl https://your-app.onrender.com/api/health
curl https://your-app.onrender.com/api/locations
```

## Getting Help

If issues persist:

1. **Check Render Logs:**
   - Go to Render Dashboard → Your Web Service → Logs
   - Look for error messages and stack traces

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for error messages
   - Check Network tab for failed requests

3. **Verify Setup:**
   - Database is created on Render
   - Schema is run (tables exist)
   - Data is seeded (locations exist)
   - DATABASE_URL is set correctly
   - render.yaml database name matches

4. **Test Locally:**
   - Set up local PostgreSQL
   - Test with local DATABASE_URL
   - Verify everything works locally first

