const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const router = express.Router();

// Cloudinary setup (optional - falls back to filesystem if not configured)
let cloudinary = null;
const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME && 
                      process.env.CLOUDINARY_API_KEY && 
                      process.env.CLOUDINARY_API_SECRET;

if (useCloudinary) {
    try {
        cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        console.log('✅ [NEWS] Cloudinary configured - media will be stored in cloud');
    } catch (error) {
        console.warn('⚠️ [NEWS] Cloudinary package not installed, using filesystem storage');
        console.warn('   Run: npm install cloudinary');
    }
} else {
    console.log('ℹ️ [NEWS] Cloudinary not configured - using filesystem storage (files may be lost on deployment)');
}

// Admin key check middleware
const crypto = require('crypto');
if (!process.env.ADMIN_KEY && !process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_KEY environment variable is required');
}
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ADMIN_API_KEY;

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Debug: Log if admin key is loaded (remove after testing)
if (process.env.NODE_ENV === 'development') {
    console.log('🔑 [NEWS] Admin key loaded:', ADMIN_KEY ? 'YES (length: ' + ADMIN_KEY.length + ')' : 'NO');
}

function checkAdminKey(req, res, next) {
    const providedKey = req.header('X-ADMIN-KEY');
    
    if (!ADMIN_KEY) {
        console.error('❌ [NEWS] Admin key not configured in environment');
        return res.status(500).json({
            success: false,
            error: 'Admin key is not configured'
        });
    }
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
        console.log('🔐 [NEWS] Auth check:', {
            provided: providedKey ? `"${providedKey}" (length: ${providedKey.length})` : 'NOT PROVIDED',
            expected: `"${ADMIN_KEY}" (length: ${ADMIN_KEY.length})`,
            match: providedKey === ADMIN_KEY
        });
    }
    
    if (!safeCompare(providedKey, ADMIN_KEY)) {
        console.warn('⚠️ [NEWS] Invalid admin key provided');
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid admin key'
        });
    }
    
    next();
}

// Configure multer for file uploads
const newsAssetsDir = path.join(__dirname, '../../../frontend/assets/news');
const upload = multer({
    dest: newsAssetsDir,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images and videos
        const allowedMimes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and videos are allowed.'));
        }
    }
});

// Ensure directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(newsAssetsDir, { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Initialize directories on module load
ensureDirectories();

// Database functions
async function getAllPosts() {
    try {
        // Get all posts with their media
        const postsResult = await db.query(
            'SELECT id, title, date, excerpt, content, created_at, updated_at FROM news_posts ORDER BY date DESC, created_at DESC'
        );
        
        const posts = postsResult.rows;
        
        // Get media for all posts
        if (posts.length > 0) {
            const postIds = posts.map(p => p.id);
            const mediaResult = await db.query(
                'SELECT post_id, type, src, display_order FROM news_media WHERE post_id = ANY($1) ORDER BY post_id, display_order',
                [postIds]
            );
            
            // Group media by post_id
            const mediaByPost = {};
            mediaResult.rows.forEach(media => {
                if (!mediaByPost[media.post_id]) {
                    mediaByPost[media.post_id] = [];
                }
                mediaByPost[media.post_id].push({
                    type: media.type,
                    src: media.src
                });
            });
            
            // Attach media to posts
            posts.forEach(post => {
                post.media = mediaByPost[post.id] || [];
            });
        }
        
        return posts;
    } catch (error) {
        console.error('❌ [NEWS DB] Error fetching posts:', error);
        throw error;
    }
}

async function getPostById(id) {
    try {
        const postResult = await db.query(
            'SELECT id, title, date, excerpt, content, created_at, updated_at FROM news_posts WHERE id = $1',
            [id]
        );
        
        if (postResult.rows.length === 0) {
            return null;
        }
        
        const post = postResult.rows[0];
        
        // Get media for this post
        const mediaResult = await db.query(
            'SELECT type, src, display_order FROM news_media WHERE post_id = $1 ORDER BY display_order',
            [id]
        );
        
        post.media = mediaResult.rows.map(m => ({
            type: m.type,
            src: m.src
        }));
        
        return post;
    } catch (error) {
        console.error('❌ [NEWS DB] Error fetching post:', error);
        throw error;
    }
}

async function savePost(postData) {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const { id, title, date, excerpt, content, media } = postData;
        const postDate = date || new Date().toISOString();
        
        if (id) {
            // Update existing post
            await client.query(
                'UPDATE news_posts SET title = $1, date = $2, excerpt = $3, content = $4, updated_at = NOW() WHERE id = $5',
                [title, postDate, excerpt || null, content, id]
            );
            
            // Delete existing media
            await client.query('DELETE FROM news_media WHERE post_id = $1', [id]);
        } else {
            // Create new post
            const newId = `news-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            await client.query(
                'INSERT INTO news_posts (id, title, date, excerpt, content) VALUES ($1, $2, $3, $4, $5)',
                [newId, title, postDate, excerpt || null, content]
            );
            postData.id = newId;
        }
        
        // Insert media
        if (media && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
                const mediaItem = media[i];
                await client.query(
                    'INSERT INTO news_media (post_id, type, src, display_order) VALUES ($1, $2, $3, $4)',
                    [postData.id, mediaItem.type, mediaItem.src, i]
                );
            }
        }
        
        await client.query('COMMIT');
        
        // Return the saved post
        return await getPostById(postData.id);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function deletePost(id) {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        // Get media paths before deleting
        const mediaResult = await client.query(
            'SELECT src FROM news_media WHERE post_id = $1',
            [id]
        );
        
        // Delete post (cascade will delete media records)
        const result = await client.query('DELETE FROM news_posts WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        
        // Delete media files (from Cloudinary or filesystem)
        for (const media of mediaResult.rows) {
            if (media.src) {
                // Check if it's a Cloudinary URL
                if (media.src.includes('cloudinary.com') || media.src.includes('res.cloudinary.com')) {
                    // Extract public_id from Cloudinary URL
                    try {
                        const urlParts = media.src.split('/');
                        const folderIndex = urlParts.findIndex(part => part === 'custodia');
                        if (folderIndex !== -1) {
                            const publicId = urlParts.slice(folderIndex).join('/').replace(/\.[^/.]+$/, '');
                            const resourceType = media.src.includes('/video/') ? 'video' : 'image';
                            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                            console.log(`✅ [NEWS] Deleted from Cloudinary: ${publicId}`);
                        }
                    } catch (error) {
                        console.warn('Could not delete from Cloudinary:', media.src, error.message);
                    }
                } else {
                    // Delete from filesystem
                    const filePath = path.join(__dirname, '../../../frontend', media.src);
                    try {
                        await fs.unlink(filePath);
                    } catch (error) {
                        // Ignore errors if file doesn't exist
                        console.warn('Could not delete media file:', filePath);
                    }
                }
            }
        }
        
        await client.query('COMMIT');
        return id;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Public router for GET /api/news
const publicRouter = express.Router();

// GET /api/news - Public endpoint to get all news posts
publicRouter.get('/', async (req, res) => {
    try {
        const posts = await getAllPosts();
        res.json(posts);
    } catch (error) {
        console.error('❌ [NEWS API] Error fetching news:', error);
        res.status(500).json({
            error: 'Failed to fetch news',
            message: error.message
        });
    }
});

// Admin router for /api/admin/news/*
const adminRouter = express.Router();

// GET /api/admin/news - Get all posts (admin, same as public but requires auth)
adminRouter.get('/', checkAdminKey, async (req, res) => {
    try {
        const posts = await getAllPosts();
        res.json(posts);
    } catch (error) {
        console.error('❌ [NEWS API] Error fetching news:', error);
        res.status(500).json({
            error: 'Failed to fetch news',
            message: error.message
        });
    }
});

// POST /api/admin/news/upload - Upload media files
adminRouter.post('/upload', checkAdminKey, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }
        
        const uploadedFiles = [];
        
        for (const file of req.files) {
            // Determine file type
            const isImage = file.mimetype.startsWith('image/');
            const isVideo = file.mimetype.startsWith('video/');
            
            if (!isImage && !isVideo) {
                // Remove file if invalid type
                await fs.unlink(file.path).catch(() => {});
                continue;
            }
            
            let publicPath;
            
            if (cloudinary && useCloudinary) {
                // Upload to Cloudinary
                try {
                    const uploadOptions = {
                        folder: 'custodia/news',
                        resource_type: isVideo ? 'video' : 'image',
                        use_filename: true,
                        unique_filename: true,
                        overwrite: false
                    };
                    
                    const result = await cloudinary.uploader.upload(file.path, uploadOptions);
                    publicPath = result.secure_url; // Use HTTPS URL
                    
                    // Clean up temporary file
                    await fs.unlink(file.path).catch(() => {});
                    
                    console.log(`✅ [NEWS] Uploaded to Cloudinary: ${publicPath}`);
                } catch (cloudinaryError) {
                    console.error('❌ [NEWS] Cloudinary upload failed, falling back to filesystem:', cloudinaryError.message);
                    // Fall back to filesystem
                    const ext = path.extname(file.originalname) || (isImage ? '.jpg' : '.mp4');
                    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
                    const newPath = path.join(newsAssetsDir, uniqueName);
                    await fs.rename(file.path, newPath);
                    publicPath = `/frontend/assets/news/${uniqueName}`;
                }
            } else {
                // Use filesystem storage (local dev or fallback)
                const ext = path.extname(file.originalname) || (isImage ? '.jpg' : '.mp4');
                const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
                const newPath = path.join(newsAssetsDir, uniqueName);
                await fs.rename(file.path, newPath);
                publicPath = `/frontend/assets/news/${uniqueName}`;
            }
            
            uploadedFiles.push({
                type: isImage ? 'image' : 'video',
                src: publicPath
            });
        }
        
        if (uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid files uploaded'
            });
        }
        
        res.json({
            success: true,
            media: uploadedFiles
        });
    } catch (error) {
        console.error('❌ [NEWS API] Error uploading files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload files',
            message: error.message
        });
    }
});

// POST /api/admin/news - Create or update news post
adminRouter.post('/', checkAdminKey, async (req, res) => {
    try {
        const { id, title, date, excerpt, content, media } = req.body;
        
        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Title and content are required'
            });
        }
        
        // Auto-generate excerpt if not provided
        let finalExcerpt = excerpt;
        if (!finalExcerpt && content) {
            finalExcerpt = content.substring(0, 150).trim();
            if (content.length > 150) {
                finalExcerpt += '...';
            }
        }
        
        const postData = {
            id,
            title,
            date,
            excerpt: finalExcerpt,
            content,
            media: media || []
        };
        
        const savedPost = await savePost(postData);
        
        res.json({
            success: true,
            post: savedPost
        });
    } catch (error) {
        console.error('❌ [NEWS API] Error saving news post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save news post',
            message: error.message
        });
    }
});

// DELETE /api/admin/news/:id - Delete news post
adminRouter.delete('/:id', checkAdminKey, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedId = await deletePost(id);
        
        if (!deletedId) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        res.json({
            success: true,
            deletedId: deletedId
        });
    } catch (error) {
        console.error('❌ [NEWS API] Error deleting news post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete news post',
            message: error.message
        });
    }
});

// Export both routers
module.exports = publicRouter;
module.exports.admin = adminRouter;
