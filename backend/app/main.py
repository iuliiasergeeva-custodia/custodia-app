"""
FastAPI application for Custodia project.
Serves frontend and handles API endpoints.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, field_validator
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re

from .database import init_db

@app.on_event("startup")
def on_startup():
    init_db()

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


# Contact form models
class ContactFormData(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str
    message: Optional[str] = ""
    timestamp: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, v):
            raise ValueError('Invalid email format')
        return v

    @field_validator('firstName', 'lastName', 'phone')
    @classmethod
    def validate_required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Field is required')
        return v.strip()


def send_email_sync(email_data: ContactFormData) -> bool:
    """Send email using SMTP (synchronous)."""
    email_user = os.getenv("EMAIL_USER")
    email_pass = os.getenv("EMAIL_PASS")
    email_test_mode = os.getenv("EMAIL_TEST_MODE", "false").lower() == "true"
    
    if not email_user:
        print("⚠️ EMAIL_USER not set in environment variables")
        return False
    
    if email_test_mode:
        print("📧 [TEST MODE] Email would be sent:")
        print(f"   To: {email_user}")
        print(f"   From: {email_data.firstName} {email_data.lastName} ({email_data.email})")
        print(f"   Subject: New Contact Form Submission from {email_data.firstName} {email_data.lastName}")
        print(f"   Message: {email_data.message}")
        return True
    
    if not email_pass:
        print("⚠️ EMAIL_PASS not set in environment variables")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = email_user
        msg['To'] = email_user
        msg['Subject'] = f"New Contact Form Submission from {email_data.firstName} {email_data.lastName}"
        
        # Create HTML email
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a365d;">New Contact Form Submission</h2>
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2d3748; margin-top: 0;">Contact Information</h3>
                <p><strong>Name:</strong> {email_data.firstName} {email_data.lastName}</p>
                <p><strong>Email:</strong> <a href="mailto:{email_data.email}">{email_data.email}</a></p>
                <p><strong>Phone:</strong> <a href="tel:{email_data.phone}">{email_data.phone}</a></p>
                <p><strong>Submitted:</strong> {datetime.fromisoformat(email_data.timestamp.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            {f'''
            <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2d3748; margin-top: 0;">Message</h3>
                <p style="white-space: pre-wrap;">{email_data.message}</p>
            </div>
            ''' if email_data.message else ''}
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #718096; font-size: 14px;">
                    This message was sent from the Custodia website contact form.
                </p>
            </div>
        </div>
        """
        
        # Create plain text email
        text_content = f"""
        New Contact Form Submission
        
        Name: {email_data.firstName} {email_data.lastName}
        Email: {email_data.email}
        Phone: {email_data.phone}
        Submitted: {datetime.fromisoformat(email_data.timestamp.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')}
        
        {f'Message:\n{email_data.message}' if email_data.message else ''}
        
        This message was sent from the Custodia website contact form.
        """
        
        # Attach both parts
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email via Gmail SMTP
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15) as server:
            server.login(email_user, email_pass)
            server.send_message(msg)
        
        print(f"✅ Email sent successfully to {email_user}")
        return True
        
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        return False


async def send_email(email_data: ContactFormData) -> bool:
    """Send email using SMTP (async wrapper)."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, send_email_sync, email_data)


@app.post("/api/contact")
async def handle_contact_form(data: ContactFormData):
    """Handle contact form submissions."""
    print(f"\n=== Contact Form Submission ===")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"Form data: {data.model_dump()}")
    
    try:
        # Validate data (Pydantic handles this automatically)
        # Send email
        email_sent = await send_email(data)
        
        if not email_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send email. Please check server configuration."
            )
        
        print(f"✅ Contact form processed successfully")
        print(f"=== End Contact Form Submission ===\n")
        
        return {
            "success": True,
            "message": "Message sent successfully"
        }
        
    except ValueError as e:
        # Validation errors from Pydantic
        print(f"❌ Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error processing contact form: {str(e)}")
        print(f"=== End Contact Form Submission (ERROR) ===\n")
        raise HTTPException(
            status_code=500,
            detail="Failed to send message. Please try again later."
        )


# API version prefix
@app.get("/api/v1/test")
async def test_api():
    """Test API endpoint."""
    return {"message": "Custodia backend is running 🚀"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
