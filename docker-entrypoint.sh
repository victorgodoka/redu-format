#!/bin/sh
set -e

echo "Running database migrations..."
node lib/backend/db/run-migrate.js

echo "Migrations complete. Starting application..."
exec "$@"
