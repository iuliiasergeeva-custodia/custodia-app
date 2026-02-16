// Landing Page JavaScript

import { submitContactForm } from '/frontend/shared/api.js';
import { 
    validateEmail, 
    validatePhone, 
    getFieldLabel,
    smoothScrollTo 
} from '/frontend/shared/utils.js';

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initContactForm();
    initScrollEffects();
    initAnimations();
    initNews();
    initURLSectionScroll();
});

// Navigation functionality
function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking on links
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (hamburger) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    });

    // Smooth scrolling for anchor links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                smoothScrollTo(targetId, 20);
            }
        });
    });

    // Smooth scrolling for hero buttons
    const heroButtons = document.querySelectorAll('.hero-buttons a');
    heroButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                smoothScrollTo(targetId, 20);
            }
        });
    });

    // Header scroll effect
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (window.scrollY > 100) {
            header.style.background = 'rgba(24, 50, 39, 0.98)';
        } else {
            header.style.background = '#183227';
        }
    });
}

// Contact form functionality
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    const submitButton = contactForm.querySelector('.btn-submit');
    const btnText = submitButton.querySelector('.btn-text');
    const btnLoading = submitButton.querySelector('.btn-loading');

    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm(contactForm)) {
            return;
        }

        // Show loading state
        submitButton.classList.add('loading');
        submitButton.disabled = true;

        try {
            // Get form data
            const formData = new FormData(contactForm);
            
            console.log('📝 Form submission started');
            console.log('Form data:', {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                message: formData.get('message')
            });

            // Submit via API
            console.log('📤 Sending request to /api/contact...');
            const response = await submitContactForm(formData);
            console.log('✅ Form submitted successfully!', response);

            showSuccessMessage(contactForm);
            contactForm.reset();
            removeValidationErrors(contactForm);

        } catch (error) {
            console.error('❌ Error sending message:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            showErrorMessage(contactForm, error.message || 'Failed to send message. Please try again.');
        } finally {
            // Hide loading state
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    });

    // Real-time validation
    const inputs = contactForm.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
}

// Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });

    return isValid;
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';

    // Remove existing error state
    field.classList.remove('error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = `${getFieldLabel(fieldName)} is required`;
    }

    // Email validation
    if (fieldName === 'email' && value) {
        if (!validateEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }

    // Phone validation
    if (fieldName === 'phone' && value) {
        if (!validatePhone(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }
    }

    // Show error if invalid
    if (!isValid) {
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        field.parentNode.appendChild(errorDiv);
    }

    return isValid;
}

function removeValidationErrors(form) {
    const errorFields = form.querySelectorAll('.error');
    const errorMessages = form.querySelectorAll('.error-message');
    
    errorFields.forEach(field => field.classList.remove('error'));
    errorMessages.forEach(message => message.remove());
}

function showSuccessMessage(form) {
    let successMessage = form.querySelector('.success-message');
    
    if (!successMessage) {
        successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.innerHTML = '<i class="fas fa-check-circle"></i> Thank you! Your message has been sent successfully. We\'ll get back to you soon.';
        form.insertBefore(successMessage, form.firstChild);
    }
    
    successMessage.classList.add('show');
    
    // Hide after 5 seconds
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 5000);
}

function showErrorMessage(form, message) {
    let errorMessage = form.querySelector('.error-message');
    
    if (!errorMessage) {
        errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.style.cssText = 'background: #fed7d7; color: #c53030; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; display: block;';
        form.insertBefore(errorMessage, form.firstChild);
    }
    
    errorMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Scroll effects
function initScrollEffects() {
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.product-card, .feature-card, .team-member, .partner-logo');
    animateElements.forEach(el => {
        observer.observe(el);
    });
}

// Animations
function initAnimations() {
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .product-card, .feature-card, .team-member, .partner-logo {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.6s ease-out;
        }
        
        .product-card.animate-in, .feature-card.animate-in, 
        .team-member.animate-in, .partner-logo.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .partner-logo:nth-child(1) { transition-delay: 0.1s; }
        .partner-logo:nth-child(2) { transition-delay: 0.2s; }
        .partner-logo:nth-child(3) { transition-delay: 0.3s; }
        .partner-logo:nth-child(4) { transition-delay: 0.4s; }
        
        .product-card:nth-child(1) { transition-delay: 0.1s; }
        .product-card:nth-child(2) { transition-delay: 0.2s; }
        
        .feature-card:nth-child(1) { transition-delay: 0.1s; }
        .feature-card:nth-child(2) { transition-delay: 0.2s; }
        .feature-card:nth-child(3) { transition-delay: 0.3s; }
        .feature-card:nth-child(4) { transition-delay: 0.4s; }
        
        .team-member:nth-child(1) { transition-delay: 0.1s; }
        .team-member:nth-child(2) { transition-delay: 0.2s; }
    `;
    document.head.appendChild(style);
}

// News functionality
async function initNews() {
    const newsContainer = document.getElementById('newsCards');
    if (!newsContainer) return;
    
    try {
        const response = await fetch('/api/news');
        if (!response.ok) {
            throw new Error('Failed to fetch news');
        }
        
        const posts = await response.json();
        
        // Show only latest 6 posts
        const latestPosts = posts.slice(0, 6);
        
        if (latestPosts.length === 0) {
            newsContainer.innerHTML = '<div class="news-empty">No news posts yet. Check back soon!</div>';
            return;
        }
        
        newsContainer.innerHTML = latestPosts.map(post => createNewsCard(post)).join('');
        
        // Add click handlers
        newsContainer.querySelectorAll('.news-card').forEach(card => {
            card.addEventListener('click', function() {
                const postId = this.dataset.postId;
                window.location.href = `/pages/news?post=${postId}`;
            });
        });
        
    } catch (error) {
        console.error('Error loading news:', error);
        newsContainer.innerHTML = '<div class="news-empty">Unable to load news. Please try again later.</div>';
    }
}

function createNewsCard(post) {
    // Get thumbnail (first image or video)
    let thumbnail = '';
    if (post.media && post.media.length > 0) {
        const firstMedia = post.media[0];
        if (firstMedia.type === 'image') {
            // Add error handler for broken images
            thumbnail = `<img src="${firstMedia.src}" alt="${post.title}" class="news-card-thumbnail" onerror="this.style.display='none'; this.parentElement.classList.add('news-card-no-thumbnail');">`;
        } else if (firstMedia.type === 'video') {
            thumbnail = `<video class="news-card-thumbnail" muted onerror="this.style.display='none'; this.parentElement.classList.add('news-card-no-thumbnail');"><source src="${firstMedia.src}" type="video/mp4"></video>`;
        }
    }
    
    // Format date
    const date = post.date ? new Date(post.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';
    
    // Add class if no thumbnail for different styling
    const noThumbnailClass = !thumbnail ? 'news-card-no-thumbnail' : '';
    
    // For cards without thumbnails, use more content if excerpt is short
    let displayText = post.excerpt || '';
    if (!thumbnail && post.content && (!post.excerpt || post.excerpt.length < 200)) {
        // Use first 400 characters of content for cards without images
        displayText = post.content.substring(0, 400).trim();
        if (post.content.length > 400) {
            displayText += '...';
        }
    }
    
    return `
        <div class="news-card ${noThumbnailClass}" data-post-id="${post.id}">
            ${thumbnail}
            <div class="news-card-content">
                <h3 class="news-card-title">${escapeHtml(post.title)}</h3>
                ${date ? `<div class="news-card-date">${date}</div>` : ''}
                ${displayText ? `<p class="news-card-excerpt">${escapeHtml(displayText)}</p>` : ''}
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// URL parameter and hash section scrolling – same logic as header links
const SCROLL_OFFSET = 20; // same as header nav links

function initURLSectionScroll() {
    // Hash in URL (e.g. /#how-it-works, /#contact) – scroll like header click
    const hash = window.location.hash;
    if (hash) {
        const sectionId = hash.replace(/^#/, '');
        if (sectionId && document.getElementById(sectionId)) {
            setTimeout(() => {
                smoothScrollTo(sectionId, SCROLL_OFFSET);
            }, 100);
            return;
        }
    }

    // Query param ?section=news etc.
    const urlParams = new URLSearchParams(window.location.search);
    const sectionParam = urlParams.get('section');

    if (sectionParam) {
        const sectionMap = {
            'news': 'news',
            'partners': 'partners',
            'products': 'our-products',
            'about': 'about',
            'team': 'team',
            'contact': 'contact'
        };

        const sectionId = sectionMap[sectionParam.toLowerCase()];

        if (sectionId) {
            setTimeout(() => {
                smoothScrollTo(sectionId, SCROLL_OFFSET);
            }, 300);
        }
    }
}

