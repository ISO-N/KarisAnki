#!/usr/bin/env bash
set -euo pipefail

DB_PORT="${DB_PORT:-18080}"
BACKEND_PORT="${BACKEND_PORT:-18081}"
FRONTEND_PORT="${FRONTEND_PORT:-18082}"
IMAGE="${SMOKE_IMAGE:-karisanki:smoke}"
NETWORK="${SMOKE_NETWORK:-karisanki-smoke-net}"
DB_CONTAINER="${SMOKE_DB_CONTAINER:-karisanki-smoke-db}"
APP_CONTAINER="${SMOKE_APP_CONTAINER:-karisanki-smoke-app}"

cleanup() {
  docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
  docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Building single image..."
docker build --build-arg BACKEND_URL=http://127.0.0.1:8080 -t "$IMAGE" .

cleanup
docker network create "$NETWORK"

echo "Starting PostgreSQL on host port ${DB_PORT}..."
docker run -d --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  -p "${DB_PORT}:5432" \
  -e POSTGRES_DB=karisanki \
  -e POSTGRES_USER=karisanki \
  -e POSTGRES_PASSWORD=karisanki \
  postgres:17-alpine

echo "Waiting for PostgreSQL..."
for _ in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" pg_isready -U karisanki -d karisanki >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$DB_CONTAINER" pg_isready -U karisanki -d karisanki >/dev/null

echo "Starting app with backend on ${BACKEND_PORT} and frontend on ${FRONTEND_PORT}..."
docker run -d --name "$APP_CONTAINER" \
  --network "$NETWORK" \
  -p "${BACKEND_PORT}:8080" \
  -p "${FRONTEND_PORT}:3000" \
  -e DB_URL=jdbc:postgresql://"$DB_CONTAINER":5432/karisanki \
  -e DB_USERNAME=karisanki \
  -e DB_PASSWORD=karisanki \
  -e KARISANKI_REGISTRATION_ENABLED=true \
  -e KARISANKI_INVITE_CODES=smoke \
  -e KARISANKI_RATE_LIMIT_MAX_ATTEMPTS=100 \
  "$IMAGE"

echo "Waiting for frontend proxy..."
for _ in $(seq 1 90); do
  if curl -fsS "http://localhost:${FRONTEND_PORT}/api/auth/registration-status" >/tmp/karisanki-smoke.json 2>/dev/null; then
    break
  fi
  sleep 1
done
response="$(curl -fsS "http://localhost:${FRONTEND_PORT}/api/auth/registration-status")"
echo "Frontend proxy response: $response"
grep -q '"enabled":true' <<<"$response"

echo "Verifying direct backend on ${BACKEND_PORT}..."
curl -fsS "http://localhost:${BACKEND_PORT}/api/auth/registration-status" >/dev/null

echo "Verifying entrypoint process-exit behavior..."
node_pid="$(docker exec "$APP_CONTAINER" sh -c 'ps -ef' | awk '/node|next-server|server\.js/ {print $1; exit}')"
if [ -z "$node_pid" ]; then
  echo "node process not found" >&2
  exit 1
fi
docker exec "$APP_CONTAINER" kill "$node_pid"

for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Running}}' "$APP_CONTAINER" 2>/dev/null || true)" = "false" ]; then
    echo "Container exited after frontend process termination."
    exit 0
  fi
  sleep 1
done

echo "Container did not exit after frontend process termination" >&2
exit 1
