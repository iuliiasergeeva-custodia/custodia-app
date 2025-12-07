# Testing Dashboard on Localhost

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables (Optional for local testing)
Create a `.env` file in the project root if you want to connect to a database:

```bash
# Copy example file
cp env.example .env

# Edit .env and add your database URL (optional - dashboard works without it for viewing)
DATABASE_URL=postgresql://user:pass@host:port/database
```

**Note:** The dashboard will work without a database connection - it will show an empty state or use mock data.

### 3. Start the Server
```bash
# Development mode (auto-restarts on file changes)
npm run dev

# OR regular mode
npm start
```

The server will start on **port 3000** by default.

### 4. Access the Dashboard
Open your browser and navigate to:

- **Dashboard:** http://localhost:3000/pages/dashboard
- **Landing Page:** http://localhost:3000/
- **Admin Page:** http://localhost:3000/pages/admin

## Testing the Tooltips

1. Navigate to http://localhost:3000/pages/dashboard
2. Hover over any of the four statistics cards at the top:
   - **Total Locations**
   - **Avg Update Time**
   - **Avg Battery**
   - **Active Alerts**
3. You should see a tooltip appear above the card with helpful information

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, you can change it:

```bash
PORT=3001 npm start
```

Or set it in your `.env` file:
```
PORT=3001
```

### Database Connection Issues
If you see database errors, you can:
1. Check your `.env` file has correct `DATABASE_URL`
2. Or comment out database-dependent features to test frontend only

### Tooltips Not Appearing
1. Open browser developer console (F12)
2. Check for JavaScript errors
3. Verify the page loaded the latest JavaScript
4. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Development Tips

### Hot Reload (with nodemon)
```bash
npm run dev
```
This will automatically restart the server when you make changes to `server.js` or other backend files.

For frontend changes (HTML, CSS, JS), you may need to do a hard refresh in the browser to see changes.

### Viewing Console Logs
The dashboard has console logging enabled. Open browser DevTools (F12) and check the Console tab to see:
- Data loading progress
- Filter changes
- Any errors

### Testing Different Scenarios
1. **With Data:** Connect to your database and load real tracker data
2. **Without Data:** The dashboard should show empty states gracefully
3. **With Filters:** Test date ranges, status filters, etc.

## File Locations

- **Dashboard HTML:** `frontend/pages/dashboard/index.html`
- **Dashboard CSS:** `frontend/pages/dashboard/dashboard.css`
- **Dashboard JavaScript:** `frontend/pages/dashboard/dashboard.js`
- **Server:** `server.js`

## Next Steps After Local Testing

Once you've verified everything works locally:

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin dev
   ```

2. **Deploy to Render** (or your hosting platform)
   - The changes will be automatically deployed if you have auto-deploy enabled

## Common Commands

```bash
# Start server
npm start

# Development mode (auto-restart)
npm run dev

# Check if port is in use
lsof -i :3000

# Kill process on port 3000 (if needed)
kill -9 $(lsof -t -i:3000)
```

