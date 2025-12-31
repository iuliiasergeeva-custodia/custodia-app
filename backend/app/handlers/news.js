const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Admin key check middleware
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ADMIN_API_KEY;

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
    
    if (providedKey !== ADMIN_KEY) {
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
        const dataDir = path.join(__dirname, '../../../frontend/data');
        await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Initialize directories on module load
ensureDirectories();

// Get news data file path
function getNewsDataPath() {
    return path.join(__dirname, '../../../frontend/data/news.json');
}

// Read news data
async function readNewsData() {
    try {
        const dataPath = getNewsDataPath();
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return empty array
            return [];
        }
        throw error;
    }
}

// Write news data
async function writeNewsData(data) {
    const dataPath = getNewsDataPath();
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

// Public router for GET /api/news
const publicRouter = express.Router();

// GET /api/news - Public endpoint to get all news posts
publicRouter.get('/', async (req, res) => {
    try {
        const posts = await readNewsData();
        // Sort by date descending (newest first)
        const sortedPosts = posts.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        res.json(sortedPosts);
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
        const posts = await readNewsData();
        // Sort by date descending (newest first)
        const sortedPosts = posts.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        res.json(sortedPosts);
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
            
            // Generate unique filename
            const ext = path.extname(file.originalname) || 
                       (isImage ? '.jpg' : '.mp4');
            const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
            const newPath = path.join(newsAssetsDir, uniqueName);
            
            // Rename file
            await fs.rename(file.path, newPath);
            
            // Create public path (matches static file serving)
            const publicPath = `/frontend/assets/news/${uniqueName}`;
            
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
        
        const posts = await readNewsData();
        
        // Auto-generate excerpt if not provided
        let finalExcerpt = excerpt;
        if (!finalExcerpt && content) {
            finalExcerpt = content.substring(0, 150).trim();
            if (content.length > 150) {
                finalExcerpt += '...';
            }
        }
        
        // Use current date if not provided
        const postDate = date || new Date().toISOString();
        
        if (id) {
            // Update existing post
            const index = posts.findIndex(p => p.id === id);
            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'Post not found'
                });
            }
            
            posts[index] = {
                ...posts[index],
                title,
                date: postDate,
                excerpt: finalExcerpt,
                content,
                media: media || []
            };
            
            await writeNewsData(posts);
            
            res.json({
                success: true,
                post: posts[index]
            });
        } else {
            // Create new post
            const newId = `news-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const newPost = {
                id: newId,
                title,
                date: postDate,
                excerpt: finalExcerpt,
                content,
                media: media || []
            };
            
            posts.push(newPost);
            await writeNewsData(posts);
            
            res.json({
                success: true,
                post: newPost
            });
        }
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
        const posts = await readNewsData();
        
        const index = posts.findIndex(p => p.id === id);
        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        // Optionally delete associated media files
        const post = posts[index];
        if (post.media && Array.isArray(post.media)) {
            for (const mediaItem of post.media) {
                if (mediaItem.src) {
                    const filePath = path.join(__dirname, '../../../frontend', mediaItem.src);
                    try {
                        await fs.unlink(filePath);
                    } catch (error) {
                        // Ignore errors if file doesn't exist
                        console.warn('Could not delete media file:', filePath);
                    }
                }
            }
        }
        
        posts.splice(index, 1);
        await writeNewsData(posts);
        
        res.json({
            success: true,
            deletedId: id
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
const newsRouters = {
    public: publicRouter,
    admin: adminRouter
};

module.exports = publicRouter;
module.exports.admin = adminRouter;
