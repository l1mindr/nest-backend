#!/bin/sh
set -e

echo "Running build..."
pnpm run build

echo "Running migrations..."
pnpm run migration:run

echo "Running tests..."
pnpm run test:e2e
