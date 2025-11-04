#!/usr/bin/env python3
"""
Convenience script to seed the database.
Run from project root: python backend/seed_database.py
"""
import sys
import os

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Now import and run the seed script
from backend.app.seed_db import seed_database

if __name__ == "__main__":
    seed_database()

