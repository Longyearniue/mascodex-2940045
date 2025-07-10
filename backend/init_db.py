#!/usr/bin/env python3
"""
Database initialization script for AI CEO Clone Interface
"""

from database import init_db
from config import settings
import os

def main():
    """Initialize the database"""
    print("Initializing AI CEO Clone Interface database...")
    
    # Create upload directories
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "documents"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "voice_samples"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "voices"), exist_ok=True)
    
    # Initialize database
    init_db()
    
    print("Database initialized successfully!")
    print(f"Database file: {settings.database_url}")
    print(f"Upload directory: {settings.upload_dir}")

if __name__ == "__main__":
    main()