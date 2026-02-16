// API client for making HTTP requests

import { API_BASE_URL } from './constants.js';

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    };

    console.log('🌐 API Request:', {
        url: url,
        method: defaultOptions.method || 'GET',
        body: defaultOptions.body
    });

    try {
        const response = await fetch(url, defaultOptions);
        
        console.log('📡 API Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ API Error Response:', errorData);
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ API Success:', data);
        return data;
    } catch (error) {
        console.error('❌ API Error:', error);
        throw error;
    }
}

/**
 * Contact form submission
 */
export async function submitContactForm(formData) {
    const data = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        message: formData.get('message'),
        timestamp: new Date().toISOString()
    };
    const utmSource = formData.get('utm_source');
    const utmMedium = formData.get('utm_medium');
    const utmCampaign = formData.get('utm_campaign');
    if (utmSource) data.utm_source = utmSource;
    if (utmMedium) data.utm_medium = utmMedium;
    if (utmCampaign) data.utm_campaign = utmCampaign;

    return fetchAPI('/api/contact', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

/**
 * Health check
 */
export async function checkHealth() {
    return fetchAPI('/api/health');
}

