#!/bin/bash
# Database Setup Script
# This script helps set up the Custodia database locally

set -e

DB_NAME="custodia_local"
SCHEMA_FILE="backend/app/database/schema.sql"
SEED_FILE="backend/app/database/seed.sql"

echo "🗄️  Custodia Database Setup"
echo "============================"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed."
    echo "   Install it with: brew install postgresql"
    exit 1
fi

echo "✅ PostgreSQL is installed"

# Check if PostgreSQL is running
if ! pg_isready &> /dev/null; then
    echo "⚠️  PostgreSQL is not running."
    echo "   Start it with: brew services start postgresql"
    exit 1
fi

echo "✅ PostgreSQL is running"
echo ""

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "⚠️  Database '$DB_NAME' already exists."
    read -p "   Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping existing database..."
        dropdb "$DB_NAME" || true
    else
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Create database
echo "📦 Creating database '$DB_NAME'..."
createdb "$DB_NAME" || {
    echo "❌ Failed to create database. Make sure you have permissions."
    exit 1
}

echo "✅ Database created"
echo ""

# Run schema
echo "📋 Creating database schema..."
psql "$DB_NAME" < "$SCHEMA_FILE" || {
    echo "❌ Failed to create schema."
    exit 1
}

echo "✅ Schema created"
echo ""

# Run seed data
echo "🌱 Seeding database with mock data..."
psql "$DB_NAME" < "$SEED_FILE" || {
    echo "❌ Failed to seed database."
    exit 1
}

echo "✅ Database seeded"
echo ""

# Verify
echo "🔍 Verifying database setup..."
psql "$DB_NAME" -c "
SELECT 
    'Clients: ' || COUNT(*) FROM clients
UNION ALL
SELECT 'Users: ' || COUNT(*) FROM users
UNION ALL
SELECT 'Trackers: ' || COUNT(*) FROM trackers
UNION ALL
SELECT 'Locations: ' || COUNT(*) FROM locations;
"

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Add database config to .env file:"
echo "      DB_HOST=localhost"
echo "      DB_PORT=5432"
echo "      DB_NAME=custodia_local"
echo "      DB_USER=postgres"
echo "      DB_PASSWORD="
echo ""
echo "   2. Test the connection:"
echo "      node -e \"require('./backend/app/db.js').testConnection().then(() => process.exit())\""
echo ""
echo "   3. Run test queries:"
echo "      psql $DB_NAME < backend/app/database/test_queries.sql"
echo ""

