# Fix DNS Error: getaddrinfo EAI_AGAIN custodia.world

## Problem

The script is failing with:
```
❌ Failed after 2 attempts: getaddrinfo EAI_AGAIN custodia.world
```

This means the DNS cannot resolve `custodia.world` from the Render server.

## Solution

Use the Render service URL instead of the custom domain. The script now automatically uses the Render service URL.

### Option 1: Use Render Service URL (Automatic)

The `render.yaml` is now configured to automatically set `RENDER_SERVICE_URL` which the script will use.

1. **Push the updated code:**
   ```bash
   git add render.yaml backend/scripts/scheduled_fake_tracker_data.js
   git commit -m "Fix DNS error - use Render service URL"
   git push origin dev
   ```

2. **Redeploy the worker service** on Render

3. The script will now use: `https://custodia-web.onrender.com/api/locations`

### Option 2: Set API_ENDPOINT Manually

If you want to use a different URL, set the `API_ENDPOINT` environment variable in Render:

1. Go to Render Dashboard → Worker Service → Environment
2. Add environment variable:
   - **Key**: `API_ENDPOINT`
   - **Value**: `https://custodia-web.onrender.com/api/locations`
   (Replace `custodia-web` with your actual Render service name)

### Option 3: Use Internal Service URL (Same Region)

If both services are in the same region, you can use the internal URL:

1. Go to Render Dashboard → Web Service → Info
2. Copy the **Internal URL** (e.g., `https://custodia-web:10000`)
3. Set `API_ENDPOINT` to: `https://custodia-web:10000/api/locations`

**Note**: Internal URLs only work between services in the same region.

## Verify the Fix

After deploying, check the logs:

```bash
# In Render Shell or Logs
# You should see:
📍 API Endpoint: https://custodia-web.onrender.com/api/locations
✅ [timestamp] Tracker 1001 (Gazelle): Sent location...
```

## Test the Endpoint

Test if the endpoint is accessible:

```bash
# In Render Shell
curl -X POST https://custodia-web.onrender.com/api/locations \
  -H "Content-Type: application/json" \
  -H "x-api-key: abs123qwe" \
  -d '{
    "repeater_id": "TEST",
    "timestamp": 1699123456,
    "packets": [{
      "device_id": 1001,
      "timestamp": 1699123456,
      "latitude": 22.3085,
      "longitude": 39.1025,
      "voltage": 3.90
    }]
  }'
```

Should return: `{"success":true}` or similar.

## Important Notes

- The endpoint is `/api/locations` (POST), not `/api/repeater-ingest`
- Make sure your Render service name matches (check in Render Dashboard)
- The script will automatically use the Render service URL if `RENDER_SERVICE_URL` is set
- If `custodia.world` is your custom domain, make sure DNS is properly configured
