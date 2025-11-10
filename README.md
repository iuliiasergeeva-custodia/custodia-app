# Custodia - Smart Animal Tracking Systems

Custodia builds a new generation of smart animal tracking systems for wildlife conservation and livestock management in remote areas.

## Project Structure

```
custodia/
├── frontend/              # Frontend (HTML, CSS, JS)
│   ├── pages/             # Page-specific files
│   │   ├── landing/       # Landing page
│   │   ├── dashboard/     # Tracker dashboard (coming soon)
│   │   ├── auth/          # Authentication pages (coming soon)
│   │   └── about/         # About page (coming soon)
│   ├── shared/            # Shared utilities and components
│   ├── assets/            # Static assets (images, icons, fonts)
│   ├── styles/            # Global design system styles
│   └── index.html         # Main entry point
├── server.js              # Node.js server (serves frontend + API)
├── package.json           # Node.js dependencies
└── README.md              # This file
```

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd custodia
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env to set EMAIL_USER and EMAIL_PASS for contact form
```

4. Start the development server:
```bash
npm start
```

5. Open your browser and visit:
```
http://localhost:3000/
```

## Features

### Landing Page
- **Hero Section**: Introduction to Custodia
- **Partners**: Built with field experts
- **Products**: Three tracking models
  - Myriota HyperPulse Model
  - LoRa + Mesh of Repeaters
  - LoRa + Satellite Model
- **Why Custodia**: Key features and benefits
- **Contact Form**: Submit inquiries (sends email)
- **Team**: Meet the team members

### Dashboard
- **Interactive Map**: Visualize tracker locations with multiple visualization modes
  - Only Markers: Show individual GPS location markers
  - Show Path: Connect all GPS locations with paths grouped by animal
  - Show Path with Directions: Show paths with directional arrows indicating movement
- **Tracker Filtering**: Filter by tracker, date range, and visualization mode
- **Animal Cards**: Click cards to zoom to animal locations and toggle marker labels
- **Status System**: Automatic status calculation based on battery and last update time

#### Tracker Status Logic

The dashboard automatically calculates tracker status based on battery level and time since last update. Each tracker can have one of three statuses: **ACTIVE**, **INACTIVE**, or **ALERT**.

**Status Calculation Rules:**

1. **ALERT** (orange/yellow badge):
   - Battery level is below 20%, OR
   - No update received for more than 24 hours (but less than 72 hours)

2. **INACTIVE** (red badge):
   - No update received for more than 72 hours, OR
   - Tracker has never sent a location update

3. **ACTIVE** (green badge):
   - Default status when:
     - Battery level is 20% or higher (if available), AND
     - Last update was received within the last 24 hours

**Status Priority:**
- No updates ever → **INACTIVE** (highest priority)
- Battery < 20% → **ALERT**
- No update > 72 hours → **INACTIVE**
- No update > 24 hours (but ≤ 72 hours) → **ALERT**
- Otherwise → **ACTIVE** (default)

**Thresholds:**
- Battery alert threshold: **20%**
- Alert threshold: **24 hours** (no update for > 24 hours but ≤ 72 hours)
- Inactive threshold: **72 hours** (no update for > 72 hours)

**Status Hints:**
Hover over any status badge to see a detailed tooltip explaining why that status was assigned, including specific battery levels and time since last update.

### Technology Stack

**Frontend:**
- HTML5
- CSS3 (with CSS Variables)
- Vanilla JavaScript (ES6 modules)
- Responsive design

**Backend:**
- Node.js + Express (contact form API)
- Nodemailer (email sending)

## Development

### Frontend Structure

The frontend follows a modular structure:

- **Pages**: Each main page has its own folder with HTML, CSS, and JS
- **Shared**: Common utilities, API client, constants
- **Styles**: Design system (variables, buttons, forms)
- **Assets**: Images, icons, fonts

### Adding a New Page

1. Create a new folder in `frontend/pages/`
2. Add `index.html`, `[page-name].css`, and `[page-name].js`
3. Update server.js to serve the new page
4. Add navigation links if needed

### API Endpoints

- `POST /api/contact` - Submit contact form
- `GET /api/health` - Health check
- `GET /api/locations` - Fetch tracker locations from PostgreSQL as CSV
- `POST /api/locations` - Ingest repeater packets (requires `LOCATIONS_API_KEY`)
- `GET|POST|PUT|DELETE /api/admin/tables/:table` - Admin CRUD endpoints protected by `ADMIN_API_KEY`

## Admin Console

Manage database records directly in the browser via the admin console at `/pages/admin`.

### Prerequisites

- Set `ADMIN_API_KEY` in your `.env` (mirrored in `render.yaml`)
- Deploy and restart the Render web service so the new key is available

### Using the Console

1. Visit `http://localhost:3000/pages/admin` (or your Render domain).
2. Enter the admin API key and click **Save Key** (stored in `localStorage`).
3. Choose a table, review data, and use **Edit**, **Delete**, or **New Record** actions.
4. JSON prompts allow precise control over writable columns listed in the UI.

> Tip: The console hits `/api/admin/*` endpoints. You can also script these endpoints directly if you prefer CLI automation.

## Deployment

The application can be deployed to Render.com:

1. **Web Service**: Deploy `server.js` as a Node.js service
2. **Environment Variables**: Set `EMAIL_USER`, `EMAIL_PASS`, `PORT` in Render dashboard
3. **Auto-deploy**: Render will auto-detect `render.yaml` and configure the service

See `render.yaml` for deployment configuration.

## License

MIT

## Contact

- Email: info@custodia.world
- Website: [Coming Soon]
