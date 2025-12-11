# Deploying Fake Tracker Data Script to Render

This guide explains how to deploy and run the `scheduled_fake_tracker_data.js` script on Render to generate demo data for your live dashboard.

## Option 1: Background Worker Service (Recommended)

This creates a separate service that runs continuously and sends tracker data every 15 minutes.

### Step 1: Update render.yaml

Add a background worker service to your `render.yaml`:

```yaml
services:
  - type: web
    name: custodia-web
    # ... existing web service config ...
  
  - type: worker
    name: custodia-tracker-simulator
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node backend/scripts/scheduled_fake_tracker_data.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: custodia-db
          property: connectionString
      - key: LOCATIONS_API_KEY
        value: abs123qwe
```

### Step 2: Push to GitHub

```bash
git add render.yaml package.json backend/scripts/scheduled_fake_tracker_data.js
git commit -m "Add fake tracker data simulator script"
git push origin dev
```

### Step 3: Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Background Worker"**
3. Connect your GitHub repository
4. Render should auto-detect the worker from `render.yaml`
5. Or manually configure:
   - **Name**: `custodia-tracker-simulator`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node backend/scripts/scheduled_fake_tracker_data.js`
   - **Plan**: Free

### Step 4: Set Environment Variables

In the worker service settings, ensure these are set:
- `LOCATIONS_API_KEY` = `abs123qwe` (or your API key)
- `DATABASE_URL` = (auto-linked from database)
- `NODE_ENV` = `production`

### Step 5: Start the Worker

1. The worker will start automatically after deployment
2. Check the **Logs** tab to see it running
3. You should see: `🚀 Starting scheduled fake tracker data simulation...`

## Option 2: Manual Execution via Render Shell

If you only want to run it occasionally, you can execute it manually:

### Step 1: Access Render Shell

1. Go to your **Web Service** in Render Dashboard
2. Click **"Shell"** (or **"Connect"** → **"Render Shell"**)

### Step 2: Run the Script

```bash
# Navigate to the project directory
cd /opt/render/project/src

# Install axios if not already installed
npm install axios

# Run the script
node backend/scripts/scheduled_fake_tracker_data.js
```

**Note**: This will run in the foreground. To run in background, use:
```bash
nohup node backend/scripts/scheduled_fake_tracker_data.js > tracker-simulator.log 2>&1 &
```

### Step 3: Check Logs

```bash
# View logs
tail -f tracker-simulator.log
```

## Option 3: One-Time Execution (For Testing)

For a quick test, you can run it once:

```bash
# In Render Shell
cd /opt/render/project/src
node backend/scripts/scheduled_fake_tracker_data.js
```

Press `Ctrl+C` to stop when done testing.

## Verifying It's Working

### Check Dashboard

1. Go to your dashboard: `https://custodia.world/pages/dashboard`
2. You should see 3 trackers (Gazelle, Ibex, Fox) moving around
3. Locations should update every 15 minutes

### Check Logs

In Render Dashboard → Worker Service → Logs, you should see:
```
🚀 Starting scheduled fake tracker data simulation...
📍 API Endpoint: https://custodia.world/api/repeater-ingest
⏱️  Interval: 15 minutes
✅ [timestamp] Tracker 1001 (Gazelle): Sent location...
```

### Check Database

```bash
# In Render Shell (for your database service)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM locations WHERE tracker_id IN ('001', '002', '003');"
```

## Troubleshooting

### Script Not Starting

1. **Check axios is installed**: The script requires `axios` package
   ```bash
   npm list axios
   ```
   If not installed, add it: `npm install axios`

2. **Check API endpoint**: Verify `https://custodia.world/api/repeater-ingest` is accessible
   ```bash
   curl -X POST https://custodia.world/api/repeater-ingest \
     -H "Content-Type: application/json" \
     -H "x-api-key: abs123qwe" \
     -d '{"repeater_id":"TEST","timestamp":1699123456,"packets":[]}'
   ```

3. **Check API key**: Ensure `LOCATIONS_API_KEY` matches your server's expected key

### No Data Appearing on Dashboard

1. **Check database**: Verify locations are being inserted
   ```bash
   psql $DATABASE_URL -c "SELECT tracker_id, COUNT(*) FROM locations GROUP BY tracker_id;"
   ```

2. **Check tracker IDs**: The script uses device_id 1001, 1002, 1003 which map to tracker_id '001', '002', '003'
   ```bash
   psql $DATABASE_URL -c "SELECT DISTINCT tracker_id FROM locations;"
   ```

3. **Check timestamps**: Ensure timestamps are recent
   ```bash
   psql $DATABASE_URL -c "SELECT tracker_id, MAX(timestamp) FROM locations GROUP BY tracker_id;"
   ```

### Worker Keeps Restarting

- Check logs for errors
- Verify all environment variables are set
- Check that the API endpoint is accessible
- Ensure the script has proper error handling (it does)

## Stopping the Script

### If Running as Background Worker

1. Go to Render Dashboard → Worker Service
2. Click **"Manual Deploy"** → **"Suspend"** (or delete the service)

### If Running Manually

Press `Ctrl+C` in the shell, or:
```bash
# Find the process
ps aux | grep scheduled_fake_tracker_data

# Kill it
kill <PID>
```

## Customization

### Change Interval

Edit `backend/scripts/scheduled_fake_tracker_data.js`:
```javascript
const INTERVAL_MINUTES = 30; // Change from 15 to 30 minutes
```

### Change Stop Time

Edit the `getStopTime()` function:
```javascript
tomorrow.setUTCHours(18, 0, 0, 0); // Change to 18:00 UTC (21:00 AST)
```

### Change Routes

Edit the `ROUTES` object in the script to customize paths.

## Notes

- **Free Tier**: Render's free tier may spin down after inactivity. The worker service should keep running.
- **API Endpoint**: Make sure `https://custodia.world` is your actual domain
- **Battery Simulation**: Batteries will gradually decrease over time (realistic simulation)
- **Auto-Stop**: Script automatically stops tomorrow at 16:00 AST

## Next Steps

1. ✅ Deploy the script (Option 1 recommended)
2. ✅ Verify it's sending data (check logs)
3. ✅ Check dashboard shows the trackers
4. ✅ Monitor for a few hours to ensure it's working
5. ✅ Adjust routes/timing as needed
