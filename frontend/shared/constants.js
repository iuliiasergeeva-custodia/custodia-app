// Shared constants for the Custodia application

// Auto-detect API base URL (works in both local and production)
export const API_BASE_URL = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'http://localhost:3000';

export const ROUTES = {
    LANDING: '/',
    DASHBOARD: '/pages/dashboard',
    LOGIN: '/pages/auth/login',
    REGISTER: '/pages/auth/register',
    ABOUT: '/pages/about'
};

export const COLORS = {
    PRIMARY: '#183227',
    PRIMARY_LIGHT: '#254f3b',
    SECONDARY: '#5C6B58',
    ACCENT: '#74875E',
    ACCENT_2: '#8B9C74',
    TEXT_PRIMARY: '#183227',
    TEXT_SECONDARY: '#5C6B58',
    TEXT_LIGHT: '#8B9C74',
    BACKGROUND_PRIMARY: '#ffffff',
    BACKGROUND_SECONDARY: '#f6f8f6',
    BACKGROUND_DARK: '#183227'
};

export const BREAKPOINTS = {
    MOBILE: '480px',
    TABLET: '768px',
    DESKTOP: '1024px',
    WIDE: '1200px'
};

