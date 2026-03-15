# Deploy Auth & Recent Changes — Full Instructions

This guide covers deploying the latest changes (auth, repeater coverage, dashboard updates) to Render and how to test everything.

---

## What changed since last deploy

- **Auth:** Login required for dashboard and data APIs. JWT in httpOnly cookie. Users see only their company’s data.
- **Login / Logout / Forgot / Reset password:** New auth pages and APIs; password reset uses email or test-mode console link.
- **API protection:** `/api/locations`, `/api/repeaters`, `/api/trackers/:slug` require auth and are scoped by the logged-in user’s client.
- **Dashboard:** Header layout (logo left, location count + download/refresh center, email + logout right). No client in URL; data comes from token.
- **Repeaters on map:** Repeater icons (80px) and optional 7 km coverage circles; filter to show/hide coverage.
- **Coverage alert:** On location ingest, if a location is in the 6.5–7 km “border” or > 7 km from repeaters, an email is sent to julia@custodia.world.
- **DB:** New table `password_reset_tokens`; seed users have real bcrypt password hashes.

---

## Part 1: What to do locally (before deploy)

### 1.1 Commit and push

```bash
cd /path/to/custodia
git status
git add .
git commit -m "Auth, repeater coverage, dashboard header, coverage alerts, password reset"
git push origin dev   # or your branch: main, etc.
```

### 1.2 Generate a strong JWT secret (for Render)

```bash
openssl rand -hex 32
```

Copy the output; you’ll add it as `JWT_SECRET` in Render.

### 1.3 (Optional) Test locally

```bash
npm install
npm run dev
```

- Open `http://localhost:1000/pages/dashboard` → should redirect to login.
- Log in with `admin@custodia.world` / `admin123`.
- Check header (logo, center group, email + logout), map, repeaters, Filters → Repeater coverage, logout.

---

## Part 2: What to do in Render

### 2.1 Environment variables (Dashboard → custodia-web → Environment)

Add or update:

| Key | Value | Notes |
|-----|--------|------|
| `JWT_SECRET` | *(paste output of `openssl rand -hex 32`)* | **Required** for auth. Use a long random string. |
| `APP_BASE_URL` | `https://custodia.world` (or your live URL) | **Required** for password reset links in emails. No trailing slash. |
| `EMAIL_USER` | Your Gmail | Already there for contact form; also used for password reset emails. |
| `EMAIL_PASS` | Gmail App Password | Same as above. |
| `EMAIL_TEST_MODE` | `false` | Set to `true` only if you want reset links in logs instead of email. |
| `DATABASE_URL` | *(from Render PostgreSQL)* | Already set if you use Render DB. |
| `NODE_ENV` | `production` | Usually already set. |

Do **not** commit `.env` or put real secrets in the repo.

### 2.2 Run database migration (password_reset_tokens)

Your production DB must have the `password_reset_tokens` table.

**Option A — From your machine (recommended)**  
Render’s database shell doesn’t have your repo files, so run the migration from your machine:

1. Render Dashboard → your **PostgreSQL** service → **Info** → copy **External Database URL**.
2. Locally:

```bash
cd /path/to/custodia
psql "YOUR_EXTERNAL_DATABASE_URL" -f backend/app/database/migrations/20250602_password_reset_tokens.sql
```

**Option B — Render Shell (paste SQL)**  
1. Render Dashboard → **PostgreSQL** service → **Connect** → **Shell**.  
2. Run `psql $DATABASE_URL` (or use the connection string Render shows).  
3. Paste and run this SQL:

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

### 2.3 (Optional) Reseed production users

Only if you want to reset passwords to the known seed passwords (`admin123`, `manager123`, `viewer123`). **Warning:** This truncates and reseeds locations, trackers, repeaters, users, clients.

- If you **do not** reseed, ensure production already has users with valid bcrypt `password_hash` in the `users` table.  
- If you **do** reseed, from your machine (with External Database URL):

```bash
cd /path/to/custodia
psql "YOUR_EXTERNAL_DATABASE_URL" -f backend/app/database/seed.sql
```

(Or use your usual seed process if different.)

### 2.4 Deploy

- If **auto-deploy** is on: push to the branch connected to Render; wait for the build to finish.  
- If **manual**: Render Dashboard → custodia-web → **Manual Deploy** → **Deploy latest commit**.

Check the **Logs** tab for errors. Health check is `GET /api/health`.

---

## Part 3: How to test all changes after deploy

Use your live URL (e.g. `https://custodia.world` or `https://custodia-web.onrender.com`).

### 3.1 Unauthenticated access

- [ ] Open `https://YOUR-URL/pages/dashboard` in an **incognito/private** window (or logged out).
  - **Expected:** Redirect to `https://YOUR-URL/pages/auth/login?redirect=...`.
- [ ] Open `https://YOUR-URL/api/locations` in the browser.
  - **Expected:** `401` JSON (e.g. `{"error":"Unauthorized",...}`).
- [ ] Landing page `https://YOUR-URL/` still loads and contact form is visible.

### 3.2 Login

- [ ] Go to `https://YOUR-URL/pages/auth/login`.
- [ ] Log in with a user that exists in production (e.g. `admin@custodia.world` / `admin123` if you seeded).
- [ ] **Expected:** Redirect to dashboard; header shows email and logout button; map and trackers load.

### 3.3 Dashboard layout and data

- [ ] **Header:** Logo left; in the center: “DB: N locations” and download/refresh buttons; on the right: email and logout. No extra box around the center group.
- [ ] **Data:** Trackers and locations for your company only (no other clients’ data).
- [ ] **Repeaters:** Repeater icons (80px) visible on the map; if you have repeater coverage filter, toggling it shows/hides 7 km circles.

### 3.4 Repeater coverage filter

- [ ] Open **Filters** → find **Repeater coverage** (toggle).
- [ ] Turn **on** → 7 km circles appear around repeaters.
- [ ] Turn **off** → circles disappear; repeater icons stay.

### 3.5 Logout

- [ ] Click **Log out** in the header.
- [ ] **Expected:** Redirect to login; visiting `/pages/dashboard` again requires login.

### 3.6 Forgot password

- [ ] On login page, click **Forgot password?**.
- [ ] Enter an email that exists in production (e.g. `admin@custodia.world`).
- [ ] **Expected:** Green message: “If an account exists with this email, you will receive a password reset link shortly.”
- [ ] If `EMAIL_TEST_MODE=false`: check that inbox for the reset email.
- [ ] If `EMAIL_TEST_MODE=true`: check Render **Logs** for a line like `📧 [TEST] Forgot password link: https://...`.

### 3.7 Reset password

- [ ] Open the reset link from the email (or from logs in test mode). URL like:  
  `https://YOUR-URL/pages/auth/reset-password?token=...`
- [ ] Enter a new password (≥ 8 characters) and confirm; submit.
- [ ] **Expected:** Success message, then redirect to login.
- [ ] Log in with the **new** password.
- [ ] **Expected:** Login works; dashboard loads.

### 3.8 API (with auth)

- [ ] While logged in, open the dashboard (so the auth cookie is set).
- [ ] In the same browser, open `https://YOUR-URL/api/auth/me`.
  - **Expected:** JSON with `user` (id, email, name, role, clientSlug).
- [ ] Open `https://YOUR-URL/api/locations` (same browser).
  - **Expected:** CSV or data for your client only (not 401).

### 3.9 Coverage alert (optional)

- [ ] If you have location ingest (e.g. POST `/api/locations` with API key) and repeaters with coordinates, trigger an ingest with a location that is 6.5–7 km or > 7 km from all repeaters.
- [ ] **Expected:** julia@custodia.world receives an email about the coverage alert (or check logs if email fails).

---

## Quick checklist summary

| Area | What to test |
|------|----------------------|
| **Deploy** | Push → set `JWT_SECRET`, `APP_BASE_URL` (and other env) in Render → run `password_reset_tokens` migration → deploy. |
| **Auth** | Dashboard redirects to login when not logged in; login with real user; logout works. |
| **Data scope** | After login, only your company’s trackers/locations/repeaters. |
| **Header** | Logo left, center group (locations + buttons), email + logout right; no box around center. |
| **Repeaters** | Icons on map; Filters → Repeater coverage toggles 7 km circles. |
| **Password reset** | Forgot password → email or console link → reset page → new password → login with new password. |

---

## Troubleshooting

- **Dashboard always redirects to login even after logging in**  
  - Check that `JWT_SECRET` is set in Render and is the same on every instance.  
  - Ensure cookies are allowed and `APP_BASE_URL` uses the same domain you’re visiting (no mixed http/https if possible).

- **Reset link says “Invalid or expired”**  
  - Token is one-time and expires in 1 hour. Request a new link.  
  - Ensure `password_reset_tokens` table exists and migration ran.

- **No email for password reset**  
  - Set `EMAIL_TEST_MODE=false` and check `EMAIL_USER` / `EMAIL_PASS` in Render.  
  - Check Render logs for email errors.  
  - For testing, use `EMAIL_TEST_MODE=true` and get the link from logs.

- **401 on /api/locations or /api/repeaters**  
  - Those endpoints require auth. Log in via the dashboard first (same origin) so the cookie is set, or call them from a context that sends the auth cookie.

If you tell me your exact Render service name and branch, I can adapt the URLs and steps (e.g. `custodia-web.onrender.com` vs custom domain).
