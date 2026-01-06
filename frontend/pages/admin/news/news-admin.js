// Admin News Editor JavaScript

const ADMIN_KEY_STORAGE = 'admin_key';

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initLoginForm();
    initPostForm();
    initLogout();
});

// Check if user is authenticated
function checkAuth() {
    const adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (adminKey) {
        showAdminInterface();
        loadPosts();
    } else {
        showLoginGate();
    }
}

// Show login gate
function showLoginGate() {
    document.getElementById('loginGate').style.display = 'flex';
    document.getElementById('adminInterface').style.display = 'none';
}

// Show admin interface
function showAdminInterface() {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('adminInterface').style.display = 'block';
}

// Initialize login form
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const password = document.getElementById('adminPassword').value;
        
        // Store in sessionStorage (simple auth check)
        // The actual validation happens on the backend
        sessionStorage.setItem(ADMIN_KEY_STORAGE, password);
        
        // Test the key by trying to fetch posts (which requires auth)
        try {
            console.log('🔐 [ADMIN] Attempting login with password length:', password.length);
            const response = await fetch('/api/admin/news', {
                method: 'GET',
                headers: {
                    'X-ADMIN-KEY': password
                }
            });
            
            console.log('🔐 [ADMIN] Response status:', response.status);
            
            if (response.ok) {
                // Key is valid
                showAdminInterface();
                loadPosts();
                loginError.style.display = 'none';
            } else {
                // Invalid key - get error message
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ [ADMIN] Login failed:', errorData);
                sessionStorage.removeItem(ADMIN_KEY_STORAGE);
                loginError.textContent = errorData.message || 'Invalid admin password. Please try again.';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('❌ [ADMIN] Login error:', error);
            sessionStorage.removeItem(ADMIN_KEY_STORAGE);
            loginError.textContent = 'Error connecting to server. Please try again.';
            loginError.style.display = 'block';
        }
    });
}

// Initialize logout
function initLogout() {
    document.getElementById('logoutBtn').addEventListener('click', function() {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        showLoginGate();
        document.getElementById('loginForm').reset();
        document.getElementById('postForm').reset();
        document.getElementById('uploadedMedia').innerHTML = '';
    });
}

// Get admin key from storage
function getAdminKey() {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

// Global variable for current media (needed for edit functionality)
let currentMedia = [];

// Initialize post form
function initPostForm() {
    const postForm = document.getElementById('postForm');
    const mediaFiles = document.getElementById('mediaFiles');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Handle file selection
    mediaFiles.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        const uploadProgress = document.getElementById('uploadProgress');
        const uploadedMediaDiv = document.getElementById('uploadedMedia');
        
        uploadProgress.style.display = 'block';
        
        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            
            const response = await fetch('/api/admin/news/upload', {
                method: 'POST',
                headers: {
                    'X-ADMIN-KEY': getAdminKey()
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }
            
            const result = await response.json();
            currentMedia = [...currentMedia, ...result.media];
            renderMediaPreviews();
            
        } catch (error) {
            alert('Error uploading files: ' + error.message);
        } finally {
            uploadProgress.style.display = 'none';
            mediaFiles.value = '';
        }
    });
    
    // Render media previews (make it accessible globally)
    window.renderMediaPreviews = function() {
        const uploadedMediaDiv = document.getElementById('uploadedMedia');
        if (!uploadedMediaDiv) return;
        
        uploadedMediaDiv.innerHTML = currentMedia.map((media, index) => {
            if (media.type === 'image') {
                return `
                    <div class="media-preview">
                        <img src="${media.src}" alt="Preview">
                        <button type="button" class="remove-media" data-index="${index}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            } else {
                return `
                    <div class="media-preview">
                        <video src="${media.src}" muted></video>
                        <button type="button" class="remove-media" data-index="${index}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }
        }).join('');
        
        // Add remove handlers
        uploadedMediaDiv.querySelectorAll('.remove-media').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                currentMedia.splice(index, 1);
                window.renderMediaPreviews();
            });
        });
    };
    
    // Also keep local reference for convenience
    const renderMediaPreviews = window.renderMediaPreviews;
    
    // Handle form submission
    postForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const postId = document.getElementById('postId').value;
        const title = document.getElementById('postTitle').value;
        const date = document.getElementById('postDate').value;
        const excerpt = document.getElementById('postExcerpt').value;
        const content = document.getElementById('postContent').value;
        
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        try {
            const payload = {
                title,
                content,
                media: currentMedia
            };
            
            if (postId) payload.id = postId;
            if (date) payload.date = new Date(date).toISOString();
            if (excerpt) payload.excerpt = excerpt;
            
            const response = await fetch('/api/admin/news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-ADMIN-KEY': getAdminKey()
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save post');
            }
            
            // Reset form
            postForm.reset();
            currentMedia = [];
            renderMediaPreviews();
            document.getElementById('postId').value = '';
            document.getElementById('formTitle').textContent = 'Create New Post';
            cancelBtn.style.display = 'none';
            
            // Reload posts list
            loadPosts();
            
            // Show success message
            showSuccess('Post saved successfully!');
            
        } catch (error) {
            alert('Error saving post: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Post';
        }
    });
    
    // Handle cancel
    cancelBtn.addEventListener('click', function() {
        postForm.reset();
        currentMedia = [];
        renderMediaPreviews();
        document.getElementById('postId').value = '';
        document.getElementById('formTitle').textContent = 'Create New Post';
        cancelBtn.style.display = 'none';
    });
    
    // Edit post handler (accessible globally)
    window.editPost = function(post) {
        if (!post || !post.id) {
            console.error('Invalid post data:', post);
            return;
        }
        
        document.getElementById('postId').value = post.id;
        document.getElementById('postTitle').value = post.title || '';
        document.getElementById('postContent').value = post.content || '';
        document.getElementById('postExcerpt').value = post.excerpt || '';
        
        if (post.date) {
            const date = new Date(post.date);
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
            document.getElementById('postDate').value = localDate.toISOString().slice(0, 16);
        } else {
            document.getElementById('postDate').value = '';
        }
        
        currentMedia = Array.isArray(post.media) ? [...post.media] : [];
        window.renderMediaPreviews();
        
        document.getElementById('formTitle').textContent = 'Edit Post';
        cancelBtn.style.display = 'inline-block';
        
        // Scroll to form
        const form = document.querySelector('.post-form');
        if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    
    // Helper function to edit post from button click
    window.editPostFromButton = function(button) {
        const postData = button.getAttribute('data-post');
        if (postData) {
            try {
                // Decode base64 and parse JSON
                const decoded = atob(postData);
                const post = JSON.parse(decoded);
                window.editPost(post);
            } catch (error) {
                console.error('Error parsing post data:', error);
                console.error('Post data:', postData);
                alert('Error loading post data. Please refresh the page.');
            }
        } else {
            console.error('No post data found on button');
        }
    };
}

// Load posts list
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    postsList.innerHTML = '<div class="loading">Loading posts...</div>';
    
    try {
        const response = await fetch('/api/news', {
            headers: {
                'X-ADMIN-KEY': getAdminKey()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch posts');
        }
        
        const posts = await response.json();
        
        if (posts.length === 0) {
            postsList.innerHTML = '<div class="empty-state">No posts yet. Create your first post above!</div>';
            return;
        }
        
        postsList.innerHTML = posts.map((post, index) => {
            const date = post.date ? new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'No date';
            
            // Store post data in a data attribute - use base64 encoding to avoid escaping issues
            const postData = btoa(JSON.stringify(post));
            
            return `
                <div class="post-item">
                    <div class="post-item-info">
                        <div class="post-item-title">${escapeHtml(post.title)}</div>
                        <div class="post-item-meta">${date} • ${post.media ? post.media.length : 0} media file(s)</div>
                    </div>
                    <div class="post-item-actions">
                        <button class="btn btn-secondary btn-icon" onclick="editPostFromButton(this)" data-post="${postData}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="deletePost('${post.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading posts:', error);
        postsList.innerHTML = '<div class="empty-state">Error loading posts. Please refresh the page.</div>';
    }
}

// Delete post
window.deletePost = async function(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/news/${postId}`, {
            method: 'DELETE',
            headers: {
                'X-ADMIN-KEY': getAdminKey()
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete post');
        }
        
        loadPosts();
        showSuccess('Post deleted successfully!');
        
    } catch (error) {
        alert('Error deleting post: ' + error.message);
    }
};

// Show success message
function showSuccess(message) {
    const existing = document.querySelector('.success-message');
    if (existing) existing.remove();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    const form = document.getElementById('postForm');
    form.insertBefore(successDiv, form.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    if (typeof text === 'object') {
        return JSON.stringify(text).replace(/"/g, '&quot;');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
