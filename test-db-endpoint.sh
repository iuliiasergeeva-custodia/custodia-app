#!/bin/bash
# Test script to verify database endpoint is working

echo "🧪 Testing Database Endpoint"
echo "============================"
echo ""

BASE_URL="${1:-http://localhost:3000}"

echo "1. Testing /api/health (should show database connection):"
curl -s "$BASE_URL/api/health" | jq . 2>/dev/null || curl -s "$BASE_URL/api/health"
echo ""
echo ""

echo "2. Testing /api/locations (should return CSV from database):"
echo "   Checking headers..."
curl -s -I "$BASE_URL/api/locations" | grep -E "X-Data-Source|X-Location-Count|Content-Type"
echo ""
echo "   First 5 lines of data:"
curl -s "$BASE_URL/api/locations" | head -5
echo ""
echo ""

echo "3. Verifying data source:"
SOURCE=$(curl -s -I "$BASE_URL/api/locations" | grep -i "X-Data-Source" | cut -d' ' -f2 | tr -d '\r\n')
COUNT=$(curl -s -I "$BASE_URL/api/locations" | grep -i "X-Location-Count" | cut -d' ' -f2 | tr -d '\r\n')

if [ "$SOURCE" = "database" ]; then
    echo "   ✅ Data source: DATABASE (PostgreSQL)"
    echo "   ✅ Location count: $COUNT"
    echo ""
    echo "   🎉 SUCCESS! Dashboard is using database data!"
else
    echo "   ⚠️  Data source: $SOURCE"
    echo "   ⚠️  Dashboard may be using CSV fallback"
    echo ""
    echo "   Check:"
    echo "   - Is PostgreSQL running?"
    echo "   - Is database seeded?"
    echo "   - Check server logs for errors"
fi

echo ""
echo "4. Testing /api/mock-locations (fallback CSV):"
curl -s -I "$BASE_URL/api/mock-locations" | grep -E "X-Data-Source|Content-Type" || echo "   CSV endpoint not available"
echo ""

