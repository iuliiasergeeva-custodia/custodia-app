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
├── backend/                # Backend (Python - coming soon)
│   ├── app/               # Application code
│   │   ├── routers/       # API routes
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   └── requirements.txt   # Python dependencies
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

**Future Backend:**
- Python (FastAPI)
- PostgreSQL
- JWT Authentication

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

## Database Setup

### Initial Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Set up PostgreSQL database:**
   - Create a PostgreSQL database named `custodia`
   - Update `DATABASE_URL` in your `.env` file:
     ```
     DATABASE_URL=postgresql://postgres:password@localhost:5432/custodia
     ```

3. **Create database tables:**
   ```bash
   python -m backend.app.main
   ```

4. **Seed the database with mock data:**
   ```bash
   python -m backend.app.seed_db
   # OR
   python backend/seed_database.py
   ```

   This will create:
   - 1 client (Custodia)
   - 3 sample users (admin, manager, viewer)
   - 5 trackers (from CSV data)
   - 23 location records (from CSV data)

### Test User Credentials

After seeding, you can use these test accounts:
- **Admin**: admin@custodia.world / admin123
- **Manager**: manager@custodia.world / manager123
- **Viewer**: viewer@custodia.world / viewer123

## Deployment

The application can be deployed to Render.com:

1. **Web Service**: Deploy `server.js` as a Node.js service
2. **PostgreSQL**: Create a managed PostgreSQL database (for future backend)
3. **Environment Variables**: Set `EMAIL_USER`, `EMAIL_PASS`, `PORT`, `DATABASE_URL` in Render dashboard

## License

MIT

## Contact

- Email: info@custodia.world
- Website: [Coming Soon]
