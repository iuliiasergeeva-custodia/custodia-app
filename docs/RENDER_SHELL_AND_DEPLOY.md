# Render Shell: migration + users only | Deploy to GitHub

**Goal:** Add the password-reset table and refresh only users. **Locations and trackers stay unchanged.**

---

## Part 1: Deploy your code to GitHub (from your machine)

Run these in your project folder (Terminal):

```bash
cd /Users/julysergeeva/Desktop/custodia

# See what changed
git status

# Stage all changes
git add .

# Commit with a message
git commit -m "Auth, repeater coverage, dashboard updates, password reset"

# Push to GitHub (use your branch name: main, dev, etc.)
git push origin main
```

If your branch is `dev` instead of `main`:

```bash
git push origin dev
```

After pushing, Render will deploy automatically if it’s connected to this repo and branch.

---

## Part 2: Render Shell — what to run

You only do two things in the database:

1. **Migration:** create the `password_reset_tokens` table (needed for “Forgot password”).
2. **Users only:** remove existing users and add the new ones (with working bcrypt passwords). **Locations and trackers are not touched.**

### Step 1: Open Render Shell

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Open your **PostgreSQL** service (e.g. `custodia-db`).
3. In the **Connect** section, use **Shell** (or the tab that gives you a shell with `psql` and `DATABASE_URL`).

### Step 2: Run the migration (new table only)

In the Render shell, run:

```bash
psql $DATABASE_URL
```

Then paste this SQL and press Enter:

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

Then type `\q` and Enter to exit psql.

This **only adds a new table**. It does not delete or change locations or trackers.

### Step 3: Replace users only (keep locations & trackers)

Still in the Render shell (or open `psql $DATABASE_URL` again), run this SQL.

**First check your client id** (you need it for the new users):

```sql
SELECT id, name, slug FROM clients;
```

Note the `id` (e.g. `1`). Use that value in place of `1` in the INSERT below if it’s different.

**Then clear users and reset tokens, and insert the new users:**

```sql
-- Remove old reset tokens (if any) and all users. Does NOT touch locations, trackers, repeaters, clients.
DELETE FROM password_reset_tokens;
DELETE FROM users;

-- Add 3 users. Replace 1 with your client id if different (from the SELECT above).
-- Passwords: admin123, manager123, viewer123
INSERT INTO users (client_id, name, email, password_hash, role) VALUES
(1, 'Admin User', 'admin@custodia.world', '$2b$12$5EPRgva7qJt/pUhLJUJWCOqK3RyY3zFSfCIL81Tm049KahoU.jblK', 'admin'),
(1, 'Manager User', 'manager@custodia.world', '$2b$12$TMoja9L/5fXHOYP6GOy/Ve8qJIa4tFPMUG9ak1Hv0NUZ43bgk1oPS', 'manager'),
(1, 'Viewer User', 'viewer@custodia.world', '$2b$12$nCKtsvANW9NbK/jS2WffUOeTOC.AUQjtzocv.CqxgpKTvwrx6keJe', 'viewer');
```

- **Locations and trackers:** unchanged.  
- **Repeaters and clients:** unchanged.  
- **Users:** replaced by these three; they belong to `client_id = 1` (or whatever you used).

Passwords for login:

- `admin@custodia.world` → **admin123**
- `manager@custodia.world` → **manager123**
- `viewer@custodia.world` → **viewer123**

---

## Summary

| Action | What it does |
|--------|------------------|
| **Migration (Step 2)** | Creates table `password_reset_tokens` only. Required for “Forgot password” to work. |
| **Replace users (Step 3)** | Deletes only `password_reset_tokens` and `users`, then inserts 3 new users. Locations, trackers, repeaters, clients stay as they are. |
| **Git push** | Sends your code to GitHub; Render deploys from there. |

After this, set **JWT_SECRET** and **APP_BASE_URL** in the Render **web service** Environment (not the DB), then use the dashboard and “Forgot password” to test.
