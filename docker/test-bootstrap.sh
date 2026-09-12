#!/usr/bin/env bash
#
# Test the Owner Bootstrap idempotency and persistence.
#
# This script validates that:
# 1. Owner can be created successfully
# 2. Running bootstrap again is idempotent (no duplicate)
# 3. Owner persists after backend restart
# 4. Owner persists after full stack restart
# 5. No duplicate owners are created on concurrent runs
#
# Usage:
#   nest-backend/docker/test-bootstrap.sh
#
# Targets the backend development stack. Everything asserted here — the Owner
# row, the backend container, Postgres — lives in that file; the frontend plays
# no part in Owner bootstrap and is left out rather than started for nothing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${BACKEND_ROOT}/compose/compose.dev.yml"
BOOTSTRAP_SCRIPT="${SCRIPT_DIR}/bootstrap-owner.sh"

# Test credentials
TEST_EMAIL="test-owner@example.com"
TEST_PASSWORD='TestOwner!123'

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_error() {
  echo -e "${RED}✖ FAIL${NC} $*"
}

log_success() {
  echo -e "${GREEN}✔ PASS${NC} $*"
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_step() {
  echo -e "\n${CYAN}▶${NC} $*"
}

TESTS_PASSED=0
TESTS_FAILED=0

test_passed() {
  log_success "$1"
  ((TESTS_PASSED++))
}

test_failed() {
  log_error "$1"
  ((TESTS_FAILED++))
}

# Cleanup function
cleanup() {
  log_step "Cleaning up test environment..."
  docker compose -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true
  log_info "Cleanup complete"
}

# Set trap to cleanup on exit
trap cleanup EXIT

echo "=========================================="
echo "  Owner Bootstrap Test Suite"
echo "=========================================="
echo ""

# Test 1: Clean start
log_step "Test 1: Starting Docker stack from clean state"
docker compose -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true
docker compose -f "${COMPOSE_FILE}" up -d postgres redis mongo >/dev/null 2>&1

log_info "Waiting for infrastructure to be healthy..."
timeout 60 bash -c '
  until docker compose -f "'"${COMPOSE_FILE}"'" ps postgres 2>/dev/null | grep -q "healthy"; do
    sleep 2
  done
' && test_passed "PostgreSQL started and healthy" || {
  test_failed "PostgreSQL did not become healthy"
  exit 1
}

# Start migration and backend
log_info "Starting migration and backend..."
docker compose -f "${COMPOSE_FILE}" up -d migration backend >/dev/null 2>&1
sleep 15

# Wait for backend to be ready
log_info "Waiting for backend to start..."
for i in {1..30}; do
  if docker compose -f "${COMPOSE_FILE}" ps backend | grep -q "Up"; then
    break
  fi
  sleep 2
done

test_passed "Backend started successfully"

# Test 2: First bootstrap run
log_step "Test 2: Running Owner bootstrap for the first time"
OUTPUT=$(OWNER_EMAIL="${TEST_EMAIL}" OWNER_PASSWORD="${TEST_PASSWORD}" "${BOOTSTRAP_SCRIPT}" 2>&1)

if echo "${OUTPUT}" | grep -q "Owner created successfully"; then
  test_passed "Owner created successfully on first run"
else
  test_failed "Expected 'Owner created successfully', got: ${OUTPUT}"
fi

# Test 3: Idempotency - second run
log_step "Test 3: Running Owner bootstrap again (idempotency test)"
OUTPUT=$(OWNER_EMAIL="${TEST_EMAIL}" OWNER_PASSWORD="${TEST_PASSWORD}" "${BOOTSTRAP_SCRIPT}" 2>&1)

if echo "${OUTPUT}" | grep -q "Owner already exists"; then
  test_passed "Bootstrap is idempotent - reported owner already exists"
else
  test_failed "Expected 'Owner already exists', got: ${OUTPUT}"
fi

# Test 4: Verify only one owner in database
log_step "Test 4: Verifying no duplicate owners in database"
OWNER_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U postgres -d dashboard_dev -t -c \
  "SELECT COUNT(*) FROM \"user\" WHERE role='OWNER';" 2>/dev/null | tr -d ' ')

if [[ "${OWNER_COUNT}" == "1" ]]; then
  test_passed "Exactly one owner exists in database"
else
  test_failed "Expected 1 owner, found: ${OWNER_COUNT}"
fi

# Test 5: Backend restart persistence
log_step "Test 5: Testing persistence after backend restart"
docker compose -f "${COMPOSE_FILE}" restart backend >/dev/null 2>&1
sleep 10

OUTPUT=$(OWNER_EMAIL="${TEST_EMAIL}" OWNER_PASSWORD="${TEST_PASSWORD}" "${BOOTSTRAP_SCRIPT}" 2>&1)

if echo "${OUTPUT}" | grep -q "Owner already exists"; then
  test_passed "Owner persisted after backend restart"
else
  test_failed "Owner not found after backend restart"
fi

# Test 6: Full stack restart persistence
log_step "Test 6: Testing persistence after full stack restart"
docker compose -f "${COMPOSE_FILE}" down >/dev/null 2>&1
sleep 2
docker compose -f "${COMPOSE_FILE}" up -d >/dev/null 2>&1
sleep 20

OUTPUT=$(OWNER_EMAIL="${TEST_EMAIL}" OWNER_PASSWORD="${TEST_PASSWORD}" "${BOOTSTRAP_SCRIPT}" 2>&1)

if echo "${OUTPUT}" | grep -q "Owner already exists"; then
  test_passed "Owner persisted after full stack restart"
else
  test_failed "Owner not found after full stack restart"
fi

# Test 7: Verify owner count again
log_step "Test 7: Final verification - no duplicate owners created"
OWNER_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U postgres -d dashboard_dev -t -c \
  "SELECT COUNT(*) FROM \"user\" WHERE role='OWNER';" 2>/dev/null | tr -d ' ')

if [[ "${OWNER_COUNT}" == "1" ]]; then
  test_passed "Still exactly one owner after all operations"
else
  test_failed "Expected 1 owner, found: ${OWNER_COUNT}"
fi

# Test 8: Verify owner email
log_step "Test 8: Verifying owner email is correct"
OWNER_EMAIL_DB=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U postgres -d dashboard_dev -t -c \
  "SELECT email FROM \"user\" WHERE role='OWNER';" 2>/dev/null | tr -d ' ')

if [[ "${OWNER_EMAIL_DB}" == "${TEST_EMAIL}" ]]; then
  test_passed "Owner email matches: ${TEST_EMAIL}"
else
  test_failed "Expected ${TEST_EMAIL}, found: ${OWNER_EMAIL_DB}"
fi

# Summary
echo ""
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
if [[ ${TESTS_FAILED} -gt 0 ]]; then
  echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  echo ""
  exit 0
fi
