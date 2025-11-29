# Production Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Code Review
- ✅ Authentication handler created (`backend/app/handlers/auth.js`)
- ✅ Session management configured
- ✅ Client-based data filtering implemented
- ✅ Frontend auth modal added
- ✅ All endpoints protected with authentication

### 2. Dependencies
- ✅ `bcrypt` - Password hashing
- ✅ `express-session` - Session management
- ✅ All dependencies in `package.json`

### 3. Environment Variables Needed

**In Render Dashboard → Environment Variables:**

| Variable | Required | How to Set | Value |
|----------|----------|------------|-------|
| `SESSION_SECRET` | **YES** | Manual (sync: false) | Generate strong random key (see below) |
| `DATABASE_URL` | Yes | Auto (fromDatabase) | Automatically linked from PostgreSQL |
| `NODE_ENV` | Yes | Auto (value: production) | Set in render.yaml |
| `LOCATIONS_API_KEY` | Yes | Auto | Set in render.yaml |
| `ADMIN_API_KEY` | Yes | Auto | Set in render.yaml |
| `EMAIL_USER` | Optional | Manual | For contact form |
| `EMAIL_PASS` | Optional | Manual | For contact form |

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use online generator: https://randomkeygen.com/

### 4. Database Setup

1. **Ensure schema is applied:**
   ```bash
   psql $DATABASE_URL < backend/app/database/schema.sql
   ```

2. **Verify tables exist:**
   ```sql
   \dt  -- List all tables
   SELECT * FROM clients;  -- Should show at least one client
   ```

3. **Create initial client (if needed):**
   ```sql
   INSERT INTO clients (name, slug) VALUES ('Default Client', 'default');
   ```

## 🚀 Deployment Steps

### Step 1: Update render.yaml (Already Done ✅)

The file has been updated with `SESSION_SECRET` placeholder.

### Step 2: Generate and Set SESSION_SECRET

1. **Generate secret key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **In Render Dashboard:**
   - Go to your Web Service
   - Navigate to "Environment" tab
   - Add new variable:
     - Key: `SESSION_SECRET`
     - Value: (paste generated key)
   - Click "Save Changes"

### Step 3: Commit and Push Code

```bash
git add .
git commit -m "Add client-based authentication system"
git push origin main  # or your deployment branch
```

### Step 4: Deploy to Render

- Render will automatically detect the push
- Build process runs: `npm install`
- Server starts: `node server.js`
- Check deployment logs for errors

### Step 5: Verify Deployment

1. **Check health endpoint:**
   ```bash
   curl https://your-app.onrender.com/api/health
   ```
   Should return: `{"status":"OK","database":"connected"}`

2. **Test authentication:**
   - Visit: `https://your-app.onrender.com/pages/dashboard`
   - Should see signup modal
   - Create account
   - Verify dashboard loads

3. **Test client isolation:**
   - Create two clients in database
   - Sign up two users (different clients)
   - Verify each sees only their client's data

## 🔒 Security Considerations

### ✅ Implemented
- Password hashing (bcrypt, 10 salt rounds)
- Session-based authentication
- Secure cookies (httpOnly, secure in production)
- SQL injection protection (parameterized queries)
- Client-based data isolation
- Input validation

### ⚠️ Recommended for Production

1. **Session Store (For Multi-Server):**
   - Current: In-memory (lost on restart)
   - Recommendation: Use Redis or PostgreSQL session store
   - Not critical for single-server deployment

2. **Rate Limiting:**
   - Add to auth endpoints to prevent brute force
   - Currently not implemented

3. **Email Verification:**
   - Currently users can signup with any email
   - Consider adding email verification step

4. **Password Reset:**
   - Currently not implemented
   - Consider adding password reset flow

5. **HTTPS:**
   - ✅ Already configured (secure cookies)
   - Render provides HTTPS automatically

## 📊 Testing in Production

### Test Authentication Flow:

1. **Signup:**
   ```
   POST https://your-app.onrender.com/api/auth/signup
   Body: { email, password, name, client_slug? }
   ```

2. **Login:**
   ```
   POST https://your-app.onrender.com/api/auth/login
   Body: { email, password }
   ```

3. **Check Session:**
   ```
   GET https://your-app.onrender.com/api/auth/session
   ```

4. **Get Locations (requires auth):**
   ```
   GET https://your-app.onrender.com/api/locations
   ```

### Test Client Isolation:

1. Create Client A:
   ```sql
   INSERT INTO clients (name, slug) VALUES ('Client A', 'client-a');
   ```

2. User signs up with client-a:
   - URL: `https://app.com/pages/dashboard?client=client-a`
   - Verify user assigned to Client A

3. Create trackers for Client A:
   ```sql
   INSERT INTO trackers (client_id, slug, animal_name) VALUES
   (1, 'tracker-1', 'Animal 1');
   ```

4. Verify user only sees Client A data

## 🐛 Troubleshooting

### Issue: "Session not persisting"
- Check SESSION_SECRET is set in Render
- Verify cookies are enabled in browser
- Check Render logs for session errors

### Issue: "Authentication required" on dashboard
- Verify user is logged in
- Check browser cookies
- Check session in database/Redis (if using store)

### Issue: "Client not found" during signup
- Verify client exists in database
- Or leave client_slug empty to use default

### Issue: "Database connection failed"
- Verify DATABASE_URL in Render environment
- Check database is running
- Check internal vs external URL

## 📝 Post-Deployment

1. **Monitor logs** for authentication errors
2. **Test with real users** from different clients
3. **Verify data isolation** works correctly
4. **Set up monitoring** for session issues
5. **Document client creation process** for admins

## 🎯 Summary

**Status: READY FOR DEPLOYMENT** ✅

The authentication system is fully implemented and production-ready. Just need to:
1. Set `SESSION_SECRET` in Render dashboard
2. Deploy code
3. Test authentication flow

All client isolation and security features are in place!

