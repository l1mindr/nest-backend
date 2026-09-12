#!/usr/bin/env bash
#
# Bootstrap the system Owner account.
#
# This script runs the backend's idempotent `seed:owner` command against the
# Docker PostgreSQL database. It is safe to run multiple times: once an Owner
# exists, the script reports that fact and makes no changes.
#
# Usage:
#   nest-backend/docker/bootstrap-owner.sh [email] [password]
#
# If email/password are not provided as arguments, they are read from
# OWNER_EMAIL and OWNER_PASSWORD environment variables.
#
# Example:
#   nest-backend/docker/bootstrap-owner.sh owner@example.com 'SecurePass!123'
#
# Or with environment variables:
#   OWNER_EMAIL=owner@example.com OWNER_PASSWORD='SecurePass!123' \
#     nest-backend/docker/bootstrap-owner.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${BACKEND_ROOT}/compose/compose.dev.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_error() {
  echo -e "${RED}✖${NC} $*" >&2
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✔${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $*"
}

# Parse arguments or environment
OWNER_EMAIL="${1:-${OWNER_EMAIL:-}}"
OWNER_PASSWORD="${2:-${OWNER_PASSWORD:-}}"

if [[ -z "${OWNER_EMAIL}" ]]; then
  log_error "OWNER_EMAIL is required"
  echo ""
  echo "Usage:"
  echo "  $0 <email> <password>"
  echo "  OWNER_EMAIL=<email> OWNER_PASSWORD=<password> $0"
  exit 1
fi

if [[ -z "${OWNER_PASSWORD}" ]]; then
  log_error "OWNER_PASSWORD is required"
  echo ""
  echo "Usage:"
  echo "  $0 <email> <password>"
  echo "  OWNER_EMAIL=<email> OWNER_PASSWORD=<password> $0"
  exit 1
fi

# Validate that Docker is running
if ! docker info >/dev/null 2>&1; then
  log_error "Docker is not running or not accessible"
  exit 1
fi

# Check if postgres service is running
log_info "Checking Docker stack status..."

if ! docker compose -f "${COMPOSE_FILE}" ps postgres 2>/dev/null | grep -q "Up"; then
  log_warning "PostgreSQL service is not running"
  log_info "Starting PostgreSQL..."
  docker compose -f "${COMPOSE_FILE}" up -d postgres

  log_info "Waiting for PostgreSQL to become healthy..."
  timeout 60 bash -c '
    until docker compose -f "'"${COMPOSE_FILE}"'" ps postgres 2>/dev/null | grep -q "healthy"; do
      sleep 2
    done
  ' || {
    log_error "PostgreSQL did not become healthy within 60 seconds"
    log_info "Check logs with: docker compose -f ${COMPOSE_FILE} logs postgres"
    exit 1
  }
  log_success "PostgreSQL is healthy"
fi

# Check if backend service exists (needed for the seed command)
log_info "Checking backend service availability..."

if ! docker compose -f "${COMPOSE_FILE}" ps backend 2>/dev/null | grep -q "backend"; then
  log_warning "Backend service is not running"
  log_info "The backend service must be available to run the bootstrap"
  log_info "Starting backend dependencies (this may take a few minutes)..."
  docker compose -f "${COMPOSE_FILE}" up -d backend

  log_info "Waiting for backend to start..."
  sleep 10
fi

# Report configuration (never print credentials)
log_info "Environment: ${NODE_ENV:-development}"
log_info "Database: dashboard_dev (Docker PostgreSQL on service 'postgres')"
log_info "Owner email: ${OWNER_EMAIL}"

echo ""
log_info "Running Owner bootstrap..."
echo ""

# Run the seed command inside the backend container
# Pass credentials via environment, never as arguments
if docker compose -f "${COMPOSE_FILE}" exec -T \
  -e OWNER_EMAIL="${OWNER_EMAIL}" \
  -e OWNER_PASSWORD="${OWNER_PASSWORD}" \
  backend pnpm run seed:owner; then

  echo ""
  log_success "Owner bootstrap completed successfully"
  log_info "You can now log in at http://localhost:3000 with the Owner credentials"
  exit 0
else
  EXIT_CODE=$?
  echo ""
  log_error "Owner bootstrap failed with exit code ${EXIT_CODE}"
  log_info "Check backend logs with: docker compose -f ${COMPOSE_FILE} logs backend"
  exit "${EXIT_CODE}"
fi
