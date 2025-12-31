// News Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    loadNews();
});

// Navigation functionality
function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (hamburger) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    });
}

// Load and display news posts
async function loadNews() {
    const postsContainer = document.getElementById('newsPosts');
    if (!postsContainer) return;
    
    try {
        // Check if we should show a specific post
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        
        const response = await fetch('/api/news');
        if (!response.ok) {
            throw new Error('Failed to fetch news');
        }
        
        const posts = await response.json();
        
        if (posts.length === 0) {
            postsContainer.innerHTML = '<div class="news-empty">No news posts yet. Check back soon!</div>';
            return;
        }
        
        if (postId) {
            // Show specific post
            const post = posts.find(p => p.id === postId);
            if (post) {
                postsContainer.innerHTML = createNewsPost(post);
            } else {
                postsContainer.innerHTML = '<div class="news-empty">Post not found.</div>';
            }
        } else {
            // Show all posts
            postsContainer.innerHTML = posts.map(post => createNewsPost(post)).join('');
        }
        
    } catch (error) {
        console.error('Error loading news:', error);
        postsContainer.innerHTML = '<div class="news-empty">Unable to load news. Please try again later.</div>';
    }
}

function createNewsPost(post) {
    // Format date
    const date = post.date ? new Date(post.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';
    
    // Create media HTML - group by 4 and make scrollable
    let mediaHTML = '';
    if (post.media && post.media.length > 0) {
        // Group media items into groups of 4
        const mediaGroups = [];
        for (let i = 0; i < post.media.length; i += 4) {
            mediaGroups.push(post.media.slice(i, i + 4));
        }
        
        // If more than one group, make it scrollable
        const isScrollable = mediaGroups.length > 1;
        mediaHTML = `<div class="news-post-media-container ${isScrollable ? 'scrollable' : ''}">`;
        
        mediaGroups.forEach((group, groupIndex) => {
            mediaHTML += '<div class="news-post-media-group">';
            group.forEach(mediaItem => {
                if (mediaItem.type === 'image') {
                    mediaHTML += `
                        <div class="news-post-media-item">
                            <img src="${mediaItem.src}" alt="${escapeHtml(post.title)}">
                        </div>
                    `;
                } else if (mediaItem.type === 'video') {
                    mediaHTML += `
                        <div class="news-post-media-item">
                            <video controls>
                                <source src="${mediaItem.src}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    `;
                }
            });
            mediaHTML += '</div>';
        });
        
        mediaHTML += '</div>';
    }
    
    // Format content (preserve line breaks)
    const content = post.content ? post.content.split('\n').map(p => `<p>${escapeHtml(p)}</p>`).join('') : '';
    
    return `
        <article class="news-post">
            <div class="news-post-header">
                <h2 class="news-post-title">${escapeHtml(post.title)}</h2>
                ${date ? `<div class="news-post-date">${date}</div>` : ''}
            </div>
            ${mediaHTML}
            <div class="news-post-content">
                ${content}
            </div>
        </article>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
