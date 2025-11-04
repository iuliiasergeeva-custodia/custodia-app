"""
Script to populate the database with mock data from CSV file.
Run with: python -m backend.app.seed_db
         OR python backend/seed_database.py
"""
import csv
import os
import sys
from datetime import datetime
from sqlalchemy.orm import Session

# Handle imports - works when run as module or directly
try:
    from app.database import SessionLocal, engine, Base
    from app.models import Client, User, Tracker, Location
except ImportError:
    # Fallback for direct execution
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    from backend.app.database import SessionLocal, engine, Base
    from backend.app.models import Client, User, Tracker, Location

from werkzeug.security import generate_password_hash

# Path to the CSV file
CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "frontend", "pages", "dashboard", "assets", "mock_locations.csv"
)


def clear_database(db: Session):
    """Clear all existing data from the database."""
    print("Clearing existing data...")
    db.query(Location).delete()
    db.query(Tracker).delete()
    db.query(User).delete()
    db.query(Client).delete()
    db.commit()
    print("Database cleared.")


def create_client(db: Session, slug: str, name: str):
    """Create or get a client."""
    client = db.query(Client).filter(Client.slug == slug).first()
    if not client:
        client = Client(slug=slug, name=name)
        db.add(client)
        db.commit()
        db.refresh(client)
        print(f"Created client: {name} (slug: {slug})")
    else:
        print(f"Client already exists: {name} (slug: {slug})")
    return client


def create_users(db: Session, client_id: int):
    """Create sample users for the client."""
    users_data = [
        {
            "name": "Admin User",
            "email": "admin@custodia.world",
            "password": "admin123",
            "role": "admin"
        },
        {
            "name": "Manager User",
            "email": "manager@custodia.world",
            "password": "manager123",
            "role": "manager"
        },
        {
            "name": "Viewer User",
            "email": "viewer@custodia.world",
            "password": "viewer123",
            "role": "viewer"
        }
    ]
    
    users = []
    for user_data in users_data:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data["email"]).first()
        if existing_user:
            print(f"User already exists: {user_data['email']}")
            users.append(existing_user)
            continue
        
        user = User(
            client_id=client_id,
            name=user_data["name"],
            email=user_data["email"],
            password_hash=generate_password_hash(user_data["password"]),
            role=user_data["role"]
        )
        db.add(user)
        users.append(user)
        print(f"Created user: {user_data['name']} ({user_data['email']}) - Role: {user_data['role']}")
    
    db.commit()
    return users


def create_trackers_from_csv(db: Session, client_id: int, csv_path: str):
    """Read CSV and create trackers and locations."""
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return
    
    # Track unique trackers we've seen
    trackers_map = {}
    locations_data = []
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tracker_id = row['tracker_id'].strip()
            animal_type = row['animal_type'].strip()
            animal_name = row['animal_name'].strip()
            
            # Store tracker info if we haven't seen this tracker_id yet
            if tracker_id not in trackers_map:
                # Determine family based on animal_type
                family = "Big Cat" if "Leopard" in animal_type else "Antelope" if "Oryx" in animal_type else None
                
                trackers_map[tracker_id] = {
                    'tracker_id': tracker_id,
                    'slug': tracker_id.lower().replace('-', '_'),  # e.g., TRK-001 -> trk_001
                    'animal_type': animal_type,
                    'animal_name': animal_name,
                    'family': family,
                    'expected_battery_life': 90,  # Default: 90 days
                    'acquisition_frequency': 30,  # Default: 30 minutes
                    'send_frequency': 60,  # Default: 60 minutes
                }
            
            # Store location data
            locations_data.append({
                'tracker_id': tracker_id,
                'latitude': float(row['latitude']),
                'longitude': float(row['longitude']),
                'date_time': datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00')),
                'battery_voltage': float(row['battery_voltage']) if row['battery_voltage'] else None,
                'fix_number': int(row['fix_number']) if row['fix_number'] else None,
            })
    
    # Create trackers
    trackers_db_map = {}
    for tracker_id, tracker_data in trackers_map.items():
        # Check if tracker already exists
        existing_tracker = db.query(Tracker).filter(Tracker.tracker_id == tracker_id).first()
        if existing_tracker:
            print(f"Tracker already exists: {tracker_id} - {tracker_data['animal_name']}")
            trackers_db_map[tracker_id] = existing_tracker
            continue
        
        tracker = Tracker(
            client_id=client_id,
            tracker_id=tracker_data['tracker_id'],
            slug=tracker_data['slug'],
            animal_type=tracker_data['animal_type'],
            animal_name=tracker_data['animal_name'],
            family=tracker_data['family'],
            expected_battery_life=tracker_data['expected_battery_life'],
            acquisition_frequency=tracker_data['acquisition_frequency'],
            send_frequency=tracker_data['send_frequency']
        )
        db.add(tracker)
        db.flush()  # Flush to get the tracker ID
        trackers_db_map[tracker_id] = tracker
        print(f"Created tracker: {tracker_id} - {tracker_data['animal_name']} ({tracker_data['animal_type']})")
    
    db.commit()
    
    # Create locations
    print(f"\nCreating {len(locations_data)} location records...")
    for i, loc_data in enumerate(locations_data):
        tracker = trackers_db_map[loc_data['tracker_id']]
        
        location = Location(
            tracker_id=tracker.id,  # Use the database ID, not the tracker_id string
            latitude=loc_data['latitude'],
            longitude=loc_data['longitude'],
            date_time=loc_data['date_time'],
            battery_voltage=loc_data['battery_voltage'],
            fix_number=loc_data['fix_number']
        )
        db.add(location)
        
        if (i + 1) % 5 == 0:
            print(f"  Processed {i + 1}/{len(locations_data)} locations...")
    
    db.commit()
    print(f"Created {len(locations_data)} location records.")
    
    return trackers_db_map


def seed_database():
    """Main function to seed the database."""
    print("=" * 60)
    print("Seeding Custodia Database with Mock Data")
    print("=" * 60)
    
    # Create database tables if they don't exist
    print("\nCreating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables ready.")
    
    db = SessionLocal()
    try:
        # Clear existing data
        clear_database(db)
        
        # Create client
        print("\n" + "-" * 60)
        client = create_client(db, slug="custodia", name="Custodia")
        
        # Create users
        print("\n" + "-" * 60)
        users = create_users(db, client.id)
        
        # Create trackers and locations from CSV
        print("\n" + "-" * 60)
        trackers = create_trackers_from_csv(db, client.id, CSV_PATH)
        
        print("\n" + "=" * 60)
        print("Database seeding completed successfully!")
        print("=" * 60)
        print(f"\nSummary:")
        print(f"  - 1 client: {client.name}")
        print(f"  - {len(users)} users")
        print(f"  - {len(trackers)} trackers")
        
        # Count locations
        location_count = db.query(Location).count()
        print(f"  - {location_count} locations")
        
        print("\nTest user credentials:")
        print("  Admin:  admin@custodia.world / admin123")
        print("  Manager: manager@custodia.world / manager123")
        print("  Viewer: viewer@custodia.world / viewer123")
        
    except Exception as e:
        print(f"\nError seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

