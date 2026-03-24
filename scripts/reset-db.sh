#!/bin/bash
# Reset the CrewSplit database — drops all tables and re-creates from schema + seed
# Usage: ./scripts/reset-db.sh
# Requires DATABASE_URL environment variable

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_URL="${DATABASE_URL:-postgresql://crewsplit:crewsplit@localhost:5432/crewsplit}"

echo "⚠️  This will DROP all tables and recreate the database!"
echo "Database: $DB_URL"
echo ""

# Drop all tables in reverse dependency order
psql "$DB_URL" -c "
DROP TABLE IF EXISTS car_passengers CASCADE;
DROP TABLE IF EXISTS cars CASCADE;
DROP TABLE IF EXISTS settlement_audit_log CASCADE;
DROP TABLE IF EXISTS wallet_settled CASCADE;
DROP TABLE IF EXISTS wallet_audit_log CASCADE;
DROP TABLE IF EXISTS wallet_expense_splits CASCADE;
DROP TABLE IF EXISTS wallet_expenses CASCADE;
DROP TABLE IF EXISTS shopping_items CASCADE;
DROP TABLE IF EXISTS logbook CASCADE;
DROP TABLE IF EXISTS menu_plan CASCADE;
DROP TABLE IF EXISTS itinerary CASCADE;
DROP TABLE IF EXISTS checklist CASCADE;
DROP TABLE IF EXISTS exchange_rates_daily CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS boats CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
" 2>&1

echo "✅ Tables dropped"

# Recreate schema
psql "$DB_URL" < "$SCRIPT_DIR/schema.sql" 2>&1
echo "✅ Schema created"

# Generate avatars if not already present
if [ ! -f "$SCRIPT_DIR/../public/avatars/seed_user_1.svg" ]; then
  echo "📸 Generating avatars..."
  bash "$SCRIPT_DIR/generate-avatars.sh"
fi

# Seed data
psql "$DB_URL" < "$SCRIPT_DIR/seed.sql" 2>&1
echo "✅ Seed data loaded"

echo ""
echo "🎉 Database reset complete!"
echo "   Admin password: admin123"
echo "   All user passwords: pass1234"
