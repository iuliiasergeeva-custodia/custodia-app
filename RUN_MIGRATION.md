# Run Database Migration via Shell

## Option 1: Using DATABASE_URL (Easiest)

### Step 1: Get your DATABASE_URL from Render

1. Go to Render Dashboard → Your PostgreSQL Database
2. Look for **"Connection String"** or **"Internal Database URL"**
3. It should look like: `postgresql://user:password@hostname:port/database`

### Step 2: Run the migration

From your project root directory (`/Users/julysergeeva/Desktop/custodia`), run:

```bash
# Set the DATABASE_URL (replace with your actual connection string)
export DATABASE_URL="postgresql://user:password@hostname:port/database"

# Run the migration
psql $DATABASE_URL < backend/app/database/migrations/20250101_add_news_tables.sql
```

**Or run it in one line:**
```bash
psql "postgresql://user:password@hostname:port/database" < backend/app/database/migrations/20250101_add_news_tables.sql
```

## Option 2: Using Individual Connection Parameters

If you have individual parameters (host, user, database, password):

```bash
psql -h hostname -U username -d database_name -f backend/app/database/migrations/20250101_add_news_tables.sql
```

It will prompt for password.

## Option 3: Copy SQL Content Directly

If `psql` isn't working, you can copy the SQL directly:

1. Open the file: `backend/app/database/migrations/20250101_add_news_tables.sql`
2. Copy all the SQL content
3. In Render Dashboard → Database → Query tab, paste and run

## Option 4: Using Node.js Script (No psql needed)

You can also create a simple Node.js script:

```bash
node -e "
const db = require('./backend/app/db.js');
const fs = require('fs');
const sql = fs.readFileSync('./backend/app/database/migrations/20250101_add_news_tables.sql', 'utf8');
db.query(sql).then(() => {
  console.log('✅ Migration successful!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
"
```

## Troubleshooting

**If you don't have psql installed:**
- macOS: `brew install postgresql`
- Or use Option 3 or 4 above

**If connection fails:**
- Make sure you're using the **Internal Database URL** (not external)
- Check that your IP is allowed (for external connections)
- Try using Render's Query tab instead (Option 3)
