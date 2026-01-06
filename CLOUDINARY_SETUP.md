# Cloudinary Setup Guide - Persistent Media Storage

## Why Cloudinary?

Your uploaded images/videos are currently stored on Render's filesystem, which gets wiped during deployments. Cloudinary stores files permanently in the cloud, so they survive deployments and restarts.

## Step 1: Create Free Cloudinary Account

1. Go to **https://cloudinary.com/users/register/free**
2. Sign up (it's free - no credit card needed)
3. Free tier includes:
   - 25GB storage
   - 25GB bandwidth/month
   - Automatic image optimization
   - CDN for fast loading

## Step 2: Get Your Credentials

After signing up, go to your **Dashboard** (you'll see it automatically).

You'll find:
- **Cloud Name** (e.g., `dxyz1234`)
- **API Key** (e.g., `123456789012345`)
- **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123`)

**Important:** Keep your API Secret private!

## Step 3: Add to Render Environment Variables

1. Go to **Render Dashboard** → Your Web Service → **Environment**
2. Click **"Add Environment Variable"** for each:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name-here
CLOUDINARY_API_KEY=your-api-key-here
CLOUDINARY_API_SECRET=your-api-secret-here
```

3. Click **"Save Changes"**

## Step 4: Deploy

After adding the environment variables:

1. **Commit and push** the updated code:
   ```bash
   git add .
   git commit -m "Add Cloudinary integration for persistent media storage"
   git push origin dev  # or main
   ```

2. Render will automatically:
   - Install the `cloudinary` package
   - Redeploy your service
   - Start using Cloudinary for new uploads

## Step 5: Test

1. Go to your admin page: `https://your-app.onrender.com/pages/admin/news`
2. Create a new post with an image
3. The image should upload to Cloudinary
4. Check Cloudinary Dashboard → Media Library → `custodia/news` folder
5. Your files should appear there!

## How It Works

- **New uploads** → Go to Cloudinary (permanent storage)
- **Old files** → Still reference filesystem paths (may be broken)
- **Automatic fallback** → If Cloudinary fails, falls back to filesystem
- **Local development** → Uses filesystem (unless you add Cloudinary to `.env`)

## Benefits

✅ **Files persist forever** - No more lost images on deployment  
✅ **Automatic optimization** - Images are optimized automatically  
✅ **CDN delivery** - Fast loading worldwide  
✅ **Free tier** - 25GB is plenty for most sites  
✅ **Format conversion** - Automatic WebP, etc.  

## Troubleshooting

**"Cloudinary package not installed"**
- Make sure you've pushed the updated `package.json` with `cloudinary` dependency
- Render will install it on next deployment

**Files still going to filesystem**
- Check that all 3 environment variables are set in Render
- Check Render logs for Cloudinary configuration messages
- Should see: `✅ [NEWS] Cloudinary configured - media will be stored in cloud`

**Old images still broken**
- Old images were stored on filesystem and are lost
- You'll need to re-upload them (they'll go to Cloudinary now)
- Or migrate existing images manually

## Local Development (Optional)

To test Cloudinary locally, add to your `.env` file:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Then run `npm install` and restart your server.
