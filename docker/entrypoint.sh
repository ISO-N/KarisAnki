#!/usr/bin/env bash
set -u

java -jar /app/app.jar &
java_pid=$!

node /app/frontend/server.js &
node_pid=$!

cleanup() {
  trap - INT TERM EXIT
  kill "$java_pid" "$node_pid" 2>/dev/null || true
  wait "$java_pid" 2>/dev/null || true
  wait "$node_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait -n "$java_pid" "$node_pid"
status=$?
cleanup
exit "$status"
