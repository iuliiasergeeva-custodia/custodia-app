# Git Workflow Guide

## Current Status

You have:
- ✅ GitHub remote configured: `https://github.com/iuliiasergeeva-custodia/custodia-app.git`
- ✅ Main branch locally
- ✅ `.gitignore` configured (includes `.env`, `node_modules`, etc.)

## Branch Strategy Options

### Option 1: Use Main Branch Directly (Recommended for Solo Projects)

**Pros:**
- Simpler workflow
- Faster deployment (push to main = deploy)
- Good for solo projects or early stages
- Render can auto-deploy from main branch

**Cons:**
- All changes go directly to production
- No testing environment before production

**Workflow:**
```bash
# Make changes
git add .
git commit -m "Your commit message"
git push origin main
# Render automatically deploys from main branch
```

### Option 2: Use Dev Branch (Recommended for Teams/Multiple Features)

**Pros:**
- Test changes before production
- Cleaner main branch history
- Can review changes before merging
- Better for collaboration

**Cons:**
- More complex workflow
- Need to merge dev → main manually
- Need to configure Render to deploy from main (or use dev for testing)

**Workflow:**
```bash
# Create and switch to dev branch
git checkout -b dev

# Make changes
git add .
git commit -m "Your commit message"
git push origin dev

# When ready for production, merge to main
git checkout main
git merge dev
git push origin main
# Render automatically deploys from main branch
```

## Recommendation

**For your current situation (solo project, deploying to Render):**

I recommend **Option 1 (Main Branch)** because:
1. You're working solo
2. Render can auto-deploy from main
3. Simpler workflow
4. You can always create a dev branch later if needed

However, if you want to test changes before production, **Option 2 (Dev Branch)** is better.

## Next Steps: Push to GitHub

### If using Main Branch (Option 1):

```bash
# Stage all changes
git add .

# Commit changes
git commit -m "Add dashboard, database models, and deployment configuration"

# Push to GitHub
git push origin main
```

### If using Dev Branch (Option 2):

```bash
# Create and switch to dev branch
git checkout -b dev

# Stage all changes
git add .

# Commit changes
git commit -m "Add dashboard, database models, and deployment configuration"

# Push dev branch to GitHub
git push origin dev

# Optional: Also push to main if you want to deploy now
git checkout main
git merge dev
git push origin main
```

## Important Notes

1. **Never commit `.env` file** - It's already in `.gitignore` ✅
2. **Make sure `env.example` is committed** - This shows what environment variables are needed
3. **Review changes before committing** - Use `git status` to see what will be committed
4. **Use descriptive commit messages** - Helps track changes later

## Quick Reference

```bash
# Check status
git status

# See what branch you're on
git branch

# Create new branch
git checkout -b branch-name

# Switch branches
git checkout branch-name

# Push branch to GitHub
git push origin branch-name

# View commit history
git log --oneline
```

