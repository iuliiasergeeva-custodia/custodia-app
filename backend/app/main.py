"""
FastAPI application for Custodia project.
Serves frontend and handles API endpoints.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

app = FastAPI(
    title="Custodia API",
    description="Custodia - Smart Animal Tracking Systems",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
FRONTEND_DIR = project_root / "frontend"
STATIC_DIR = FRONTEND_DIR / "assets"
STYLES_DIR = FRONTEND_DIR / "styles"
SHARED_DIR = FRONTEND_DIR / "shared"
DASHBOARD_DIR = FRONTEND_DIR / "pages" / "dashboard"
DASHBOARD_ASSETS_DIR = DASHBOARD_DIR / "assets"
MOCK_DATA_DIR = DASHBOARD_ASSETS_DIR / "mock_data"

# Serve static assets (images, fonts, icons, etc.)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR)), name="assets")
    app.mount("/frontend/assets", StaticFiles(directory=str(STATIC_DIR)), name="frontend-assets")

# Serve styles directory
if STYLES_DIR.exists():
    app.mount("/frontend/styles", StaticFiles(directory=str(STYLES_DIR)), name="frontend-styles")

# Serve shared resources
if SHARED_DIR.exists():
    app.mount("/shared", StaticFiles(directory=str(SHARED_DIR)), name="shared")
    app.mount("/frontend/shared", StaticFiles(directory=str(SHARED_DIR)), name="frontend-shared")

# Serve dashboard assets
if DASHBOARD_ASSETS_DIR.exists():
    app.mount("/pages/dashboard/assets", StaticFiles(directory=str(DASHBOARD_ASSETS_DIR)), name="dashboard-assets")


# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "OK",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "custodia-api"
    }


# API endpoint for mock locations CSV
@app.get("/api/mock-locations")
async def get_mock_locations():
    """Serve the mock locations CSV file."""
    csv_path = DASHBOARD_ASSETS_DIR / "mock_locations.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Mock locations file not found")
    return FileResponse(
        path=str(csv_path),
        media_type="text/csv",
        filename="mock_locations.csv"
    )


# Serve landing page
@app.get("/")
async def serve_landing():
    """Serve the landing page."""
    landing_path = FRONTEND_DIR / "pages" / "landing" / "index.html"
    if not landing_path.exists():
        raise HTTPException(status_code=404, detail="Landing page not found")
    return FileResponse(path=str(landing_path))


# Serve dashboard page
@app.get("/pages/dashboard")
async def serve_dashboard():
    """Serve the dashboard page."""
    dashboard_path = DASHBOARD_DIR / "index.html"
    if not dashboard_path.exists():
        raise HTTPException(status_code=404, detail="Dashboard page not found")
    return FileResponse(path=str(dashboard_path))


# Serve other frontend pages
@app.get("/pages/{page_name}")
async def serve_page(page_name: str):
    """Serve other frontend pages dynamically."""
    page_path = FRONTEND_DIR / "pages" / page_name / "index.html"
    if not page_path.exists():
        raise HTTPException(status_code=404, detail=f"Page '{page_name}' not found")
    return FileResponse(path=str(page_path))


# Serve static files from frontend root (CSS, JS files in pages subdirectories)
@app.get("/pages/{page_name}/{file_path:path}")
async def serve_page_static(page_name: str, file_path: str):
    """Serve static files from page directories (CSS, JS, etc.)."""
    file_full_path = FRONTEND_DIR / "pages" / page_name / file_path
    
    # Security: prevent directory traversal
    try:
        file_full_path.resolve().relative_to(FRONTEND_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists() or not file_full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type = "text/plain"
    if file_path.endswith(".css"):
        content_type = "text/css"
    elif file_path.endswith(".js"):
        content_type = "application/javascript"
    elif file_path.endswith(".html"):
        content_type = "text/html"
    elif file_path.endswith(".json"):
        content_type = "application/json"
    
    return FileResponse(path=str(file_full_path), media_type=content_type)


# Serve frontend paths with absolute paths (for landing page)
@app.get("/frontend/pages/{page_name}/{file_path:path}")
async def serve_frontend_page_static(page_name: str, file_path: str):
    """Serve static files from frontend/pages directory (for absolute paths)."""
    file_full_path = FRONTEND_DIR / "pages" / page_name / file_path
    
    # Security: prevent directory traversal
    try:
        file_full_path.resolve().relative_to(FRONTEND_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists() or not file_full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type = "text/plain"
    if file_path.endswith(".css"):
        content_type = "text/css"
    elif file_path.endswith(".js"):
        content_type = "application/javascript"
    elif file_path.endswith(".html"):
        content_type = "text/html"
    
    return FileResponse(path=str(file_full_path), media_type=content_type)


# Serve shared files (CSS, JS from shared directory)
@app.get("/shared/{file_path:path}")
async def serve_shared(file_path: str):
    """Serve files from the shared directory."""
    file_full_path = SHARED_DIR / file_path
    
    # Security: prevent directory traversal
    try:
        file_full_path.resolve().relative_to(SHARED_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists() or not file_full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type = "text/plain"
    if file_path.endswith(".css"):
        content_type = "text/css"
    elif file_path.endswith(".js"):
        content_type = "application/javascript"
    
    return FileResponse(path=str(file_full_path), media_type=content_type)


# API version prefix
@app.get("/api/v1/test")
async def test_api():
    """Test API endpoint."""
    return {"message": "Custodia backend is running 🚀"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
