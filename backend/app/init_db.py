"""
Initialize and populate the database with mock data.
This script creates all tables and populates them with sample data.

Usage:
    python -m backend.app.init_db
    OR
    python backend/app/init_db.py
"""
import os
import sys
from pathlib import Path
from datetime import datetime
import csv

# Handle imports - works when run as module or directly
try:
    from app.database import SessionLocal, engine, Base
    from app.models import Client, User, Tracker, Location
except ImportError:
    # Fallback for direct execution
    project_root = Path(__file__).parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    from backend.app.database import SessionLocal, engine, Base
    from backend.app.models import Client, User, Tracker, Location

from werkzeug.security import generate_password_hash


def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully.")


def clear_database(db):
    """Clear all existing data from the database."""
    print("\nClearing existing data...")
    db.query(Location).delete()
    db.query(Tracker).delete()
    db.query(User).delete()
    db.query(Client).delete()
    db.commit()
    print("✅ Database cleared.")


def create_client(db, slug: str, name: str):
    """Create or get a client."""
    client = db.query(Client).filter(Client.slug == slug).first()
    if not client:
        client = Client(slug=slug, name=name)
        db.add(client)
        db.commit()
        db.refresh(client)
        print(f"✅ Created client: {name} (slug: {slug})")
    else:
        print(f"ℹ️  Client already exists: {name} (slug: {slug})")
    return client


def create_users(db, client_id: int):
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
        existing_user = db.query(User).filter(User.email == user_data["email"]).first()
        if existing_user:
            print(f"ℹ️  User already exists: {user_data['email']}")
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
        print(f"✅ Created user: {user_data['name']} ({user_data['email']}) - Role: {user_data['role']}")
    
    db.commit()
    return users


def create_trackers_from_csv(db, client_id: int, csv_path: str):
    """Create trackers and locations from CSV file."""
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return []
    
    print(f"\nReading tracker data from: {csv_path}")
    
    # Track unique trackers by tracker_id
    trackers_dict = {}
    locations_data = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tracker_id = row['tracker_id']
            animal_name = row['animal_name']
            animal_type = row['animal_type']
            
            # Store tracker info (will create unique trackers)
            if tracker_id not in trackers_dict:
                trackers_dict[tracker_id] = {
                    'tracker_id': tracker_id,
                    'slug': tracker_id.lower().replace('-', '_'),
                    'animal_name': animal_name,
                    'animal_type': animal_type,
                    'family': animal_type,  # Use animal_type as family
                    'expected_battery_life': 365,  # 1 year default
                    'acquisition_frequency': 15,  # 15 minutes default
                    'send_frequency': 60,  # 1 hour default
                }
            
            # Store location data
            locations_data.append({
                'tracker_id': tracker_id,
                'latitude': float(row['latitude']),
                'longitude': float(row['longitude']),
                'date_time': datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00')),
                'battery_voltage': float(row['battery_voltage']) if row['battery_voltage'] else None,
                'fix_number': int(row['fix_number'])
            })
    
    # Create trackers
    trackers = []
    for tracker_data in trackers_dict.values():
        # Check if tracker already exists
        existing_tracker = db.query(Tracker).filter(
            Tracker.tracker_id == tracker_data['tracker_id']
        ).first()
        
        if existing_tracker:
            print(f"ℹ️  Tracker already exists: {tracker_data['tracker_id']} ({tracker_data['animal_name']})")
            trackers.append(existing_tracker)
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
        trackers.append(tracker)
        print(f"✅ Created tracker: {tracker_data['tracker_id']} ({tracker_data['animal_name']})")
    
    db.commit()
    
    # Refresh trackers to get their IDs
    for tracker in trackers:
        db.refresh(tracker)
    
    # Create locations
    print(f"\nCreating {len(locations_data)} location records...")
    location_count = 0
    
    for loc_data in locations_data:
        # Find the tracker by tracker_id
        tracker = next((t for t in trackers if t.tracker_id == loc_data['tracker_id']), None)
        if not tracker:
            print(f"⚠️  Tracker {loc_data['tracker_id']} not found, skipping location")
            continue
        
        location = Location(
            tracker_id=tracker.id,  # Use the database ID
            latitude=loc_data['latitude'],
            longitude=loc_data['longitude'],
            date_time=loc_data['date_time'],
            battery_voltage=loc_data['battery_voltage'],
            fix_number=loc_data['fix_number']
        )
        db.add(location)
        location_count += 1
    
    db.commit()
    print(f"✅ Created {location_count} location records.")
    
    return trackers


def seed_database(clear_existing: bool = True):
    """Main function to seed the database."""
    print("=" * 60)
    print("Database Initialization and Seeding")
    print("=" * 60)
    
    # Create tables
    create_tables()
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Clear existing data if requested
        if clear_existing:
            clear_database(db)
        
        # Create client
        client = create_client(db, slug="custodia", name="Custodia")
        
        # Create users
        print("\n" + "-" * 60)
        print("Creating Users")
        print("-" * 60)
        users = create_users(db, client.id)
        
        # Create trackers and locations from CSV
        print("\n" + "-" * 60)
        print("Creating Trackers and Locations")
        print("-" * 60)
        
        # Find CSV file
        project_root = Path(__file__).parent.parent.parent
        csv_path = project_root / "frontend" / "pages" / "dashboard" / "assets" / "mock_locations.csv"
        
        if not csv_path.exists():
            # Try alternative path
            csv_path = Path(__file__).parent.parent.parent / "frontend" / "pages" / "dashboard" / "assets" / "mock_locations.csv"
        
        trackers = create_trackers_from_csv(db, client.id, str(csv_path))
        
        # Summary
        print("\n" + "=" * 60)
        print("Database Seeding Complete!")
        print("=" * 60)
        print(f"✅ Client: 1 (Custodia)")
        print(f"✅ Users: {len(users)}")
        print(f"✅ Trackers: {len(trackers)}")
        
        # Count locations
        location_count = db.query(Location).count()
        print(f"✅ Locations: {location_count}")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize and seed the database")
    parser.add_argument(
        "--keep-data",
        action="store_true",
        help="Keep existing data (don't clear before seeding)"
    )
    
    args = parser.parse_args()
    
    seed_database(clear_existing=not args.keep_data)

