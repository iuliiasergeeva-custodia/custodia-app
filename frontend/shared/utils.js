// Shared utility functions

/**
 * Format date to readable string
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format timestamp to readable string
 */
export function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

/**
 * Debounce function for performance optimization
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for performance optimization
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Validate email format
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number
 */
export function validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d\s\-]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Smooth scroll to element
 */
export function smoothScrollTo(targetId, offset = 80) {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const targetPosition = targetElement.offsetTop - headerHeight - offset;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

/**
 * Get field label from field name
 */
export function getFieldLabel(fieldName) {
    const labels = {
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email',
        phone: 'Phone Number',
        message: 'Message'
    };
    return labels[fieldName] || fieldName;
}

