# Custodia Frontend

This directory contains the frontend application for Custodia.

## Structure

```
frontend/
├── pages/           # Page-specific files
│   ├── landing/     # Landing page
│   ├── dashboard/   # Tracker dashboard
│   ├── auth/        # Authentication pages
│   └── about/       # About page
├── shared/          # Shared utilities and components
├── assets/          # Static assets (images, icons, fonts)
├── styles/          # Global design system styles
└── index.html       # Main entry point
```

## Pages

### Landing Page
- **Location**: `pages/landing/`
- **Files**: `index.html`, `landing.css`, `landing.js`
- **Components**: `components/navbar.html`, `components/footer.html`

### Dashboard (Coming Soon)
- **Location**: `pages/dashboard/`
- Will contain tracker dashboard with map visualization

### Auth (Coming Soon)
- **Location**: `pages/auth/`
- Will contain login, register, and password reset pages

## Shared Resources

### Utilities (`shared/`)
- `api.js` - API client for HTTP requests
- `utils.js` - Utility functions (date formatting, validation, etc.)
- `constants.js` - Application constants and configuration
- `layout.css` - Global layout styles
- `guards.js` - Page access control (authentication checks)

### Styles (`styles/`)
- `variables.css` - CSS variables (colors, fonts, spacing)
- `buttons.css` - Button component styles
- `forms.css` - Form component styles

## Assets

- `assets/images/` - Images and photos
- `assets/icons/` - Icon files
- `assets/fonts/` - Custom fonts (if any)

## Development

The frontend is served by the Express server in the root directory. Run:

```bash
npm start
```

Then visit `http://localhost:3000/` to view the landing page.

