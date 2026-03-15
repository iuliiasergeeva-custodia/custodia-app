# Testing auth locally

## 1. Environment

Your `.env` already has:
- `JWT_SECRET` (required)
- `APP_BASE_URL=http://localhost:1000` (for password-reset links)
- Local DB: `DB_HOST`, `DB_PORT`, `DB_NAME`, etc.

Optional for **password reset** without sending real email:
```bash
EMAIL_TEST_MODE=true
```
Then the reset link is printed in the server console instead of emailed.

---

## 2. Database

**Apply schema (if not already):**
```bash
psql -h localhost -p 5432 -U $(whoami) -d custodia_local -f backend/app/database/schema.sql
```

**If the DB was created before `password_reset_tokens` existed, run the migration:**
```bash
psql -h localhost -p 5432 -U $(whoami) -d custodia_local -f backend/app/database/migrations/20250602_password_reset_tokens.sql
```

**Seed users and data:**
```bash
npm run db:seed
```
This creates 3 users (same client, Custodia):

| Email                  | Password   |
|------------------------|------------|
| admin@custodia.world   | admin123   |
| manager@custodia.world | manager123 |
| viewer@custodia.world  | viewer123  |

---

## 3. Start the server

```bash
npm run dev
```
Server runs on **http://localhost:1000** (from your `PORT=1000`).

---

## 4. Test flows

### Login and dashboard

1. Open **http://localhost:1000/pages/dashboard**
   - You should be **redirected** to **http://localhost:1000/pages/auth/login?redirect=...**
2. Log in with **admin@custodia.world** / **admin123**
3. You should land on the dashboard and see only that client’s trackers/locations.
4. Header should show the user email and a **Log out** button.

### Logout

1. Click **Log out** in the dashboard header.
2. You should be redirected to the login page.

### Forgot password

1. On the login page, click **Forgot password?**
2. Enter **admin@custodia.world** and submit.
3. **Without** `EMAIL_TEST_MODE`: check the inbox for the reset link (needs working email config).
4. **With** `EMAIL_TEST_MODE=true`: check the **server terminal** for a line like:
   ```text
   📧 [TEST] Forgot password link: http://localhost:1000/pages/auth/reset-password?token=...
   ```
5. Open that URL in the browser, set a new password, submit.
6. You should see a success message and then be redirected to login; log in with the new password.

### Reset password page without token

1. Open **http://localhost:1000/pages/auth/reset-password** (no `?token=...`).
2. You should see an error like “Invalid reset link”.

---

## 5. Quick checklist

- [ ] `.env` has `JWT_SECRET` and `APP_BASE_URL=http://localhost:1000`
- [ ] Schema + migration applied, `npm run db:seed` run
- [ ] `npm run dev` → server on port 1000
- [ ] `/pages/dashboard` redirects to login when not logged in
- [ ] Login with admin@custodia.world / admin123 works
- [ ] Dashboard shows data and logout works
- [ ] (Optional) Forgot password with `EMAIL_TEST_MODE=true` and use console link to test reset
