#!/bin/sh

set -e

echo "Running database migrations..."

pnpm run migration:run

echo "Starting application..."

node dist/main.js
