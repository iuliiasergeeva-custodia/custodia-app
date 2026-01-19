# Fix Missing Images and Videos

## What Happened

Your images and videos are missing because:

1. **Old files were deleted**: Images/videos were stored in `/frontend/assets/news/` on Render's filesystem
2. **Filesystem is ephemeral**: During deployment, Render wipes the filesystem
3. **Database still has references**: The database has the old file paths, but the actual files are gone

## Solution: Re-upload Your Media

### Option 1: Quick Fix - Re-upload Images

1. Go to admin page: `https://your-app.onrender.com/pages/admin/news`
2. For each post missing images:
   - Click **Edit** button
   - **Re-upload** the images/videos
   - Click **Save Post**
3. **New uploads will go to Cloudinary** (if configured) and persist forever!

### Option 2: Set Up Cloudinary First (Recommended)

**Before re-uploading**, set up Cloudinary so new uploads persist:

1. **Create Cloudinary account**: https://cloudinary.com/users/register/free
2. **Get credentials** from Cloudinary Dashboard
3. **Add to Render** environment variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. **Deploy** the code (already done if you pushed the Cloudinary changes)
5. **Then re-upload** - files will go to Cloudinary and persist!

## Why Images Show as Broken

The code now has error handling:
- Broken images will hide gracefully
- Cards without images will show more text content
- You'll see "Image not available" messages on the full news page

## After Re-uploading

Once you re-upload with Cloudinary configured:
- ✅ Images stored permanently in cloud
- ✅ Survive deployments
- ✅ Fast CDN delivery
- ✅ Automatic optimization

## Quick Checklist

- [ ] Set up Cloudinary account (if not done)
- [ ] Add Cloudinary credentials to Render
- [ ] Deploy code (if Cloudinary changes not deployed)
- [ ] Re-upload images for each post
- [ ] Verify images appear correctly
