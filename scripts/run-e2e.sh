#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PORT="${DB_PORT:-18080}"
BACKEND_PORT="${TEST_BACKEND_PORT:-18081}"
FRONTEND_PORT="${TEST_FRONTEND_PORT:-18082}"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ]; then
    if command -v taskkill >/dev/null 2>&1; then taskkill //F //T //PID "$BACKEND_PID" >/dev/null 2>&1 || true; else kill "$BACKEND_PID" 2>/dev/null || true; fi
  fi
  if [ -n "$FRONTEND_PID" ]; then
    if command -v taskkill >/dev/null 2>&1; then taskkill //F //T //PID "$FRONTEND_PID" >/dev/null 2>&1 || true; else kill "$FRONTEND_PID" 2>/dev/null || true; fi
  fi
}
trap cleanup EXIT

echo "Starting test PostgreSQL on ${DB_PORT}..."
docker compose -f "$ROOT/docker-compose.test.yml" up -d
for _ in $(seq 1 60); do
  if docker exec karisanki-test-postgres pg_isready -U karisanki -d karisanki_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec karisanki-test-postgres pg_isready -U karisanki -d karisanki_test >/dev/null

echo "Starting backend on ${BACKEND_PORT}..."
cd "$ROOT/backend"
DB_URL="jdbc:postgresql://localhost:${DB_PORT}/karisanki_test" \
DB_USERNAME=karisanki \
DB_PASSWORD=karisanki \
SERVER_PORT="$BACKEND_PORT" \
KARISANKI_REGISTRATION_ENABLED=true \
KARISANKI_INVITE_CODES=testcode,othercode \
KARISANKI_RATE_LIMIT_MAX_ATTEMPTS=1000 \
KARISANKI_RATE_LIMIT_WINDOW=1h \
./mvnw -q -DskipTests spring-boot:run &
BACKEND_PID=$!

echo "Starting frontend on ${FRONTEND_PORT}..."
cd "$ROOT/frontend"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}" \
PORT="$FRONTEND_PORT" \
npm run dev &
FRONTEND_PID=$!

echo "Waiting for frontend and backend..."
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/api/auth/registration-status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/api/auth/registration-status" >/dev/null

cd "$ROOT/frontend"
TEST_BACKEND_PORT="$BACKEND_PORT" TEST_FRONTEND_PORT="$FRONTEND_PORT" npx playwright test ${E2E_SPEC:-}
