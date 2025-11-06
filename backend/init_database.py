#!/usr/bin/env python3
"""
Convenience script to initialize and seed the database.
Run from project root: python backend/init_database.py
"""
import sys
import os

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Now import and run the init script
from backend.app.init_db import seed_database

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

