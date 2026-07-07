#!/bin/sh
set -e

echo "Running build..."
yarn build

echo "Running migrations..."
yarn migration:run

echo "Running tests..."
yarn test:e2e