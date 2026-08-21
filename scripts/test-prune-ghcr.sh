#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/versions.json" <<'JSON'
[
  {"id":"v5","created_at":"2026-01-05T00:00:00Z","metadata":{"container":{"tags":["latest","sha-5"]}}},
  {"id":"v4","created_at":"2026-01-04T00:00:00Z","metadata":{"container":{"tags":["sha-4"]}}},
  {"id":"v3","created_at":"2026-01-03T00:00:00Z","metadata":{"container":{"tags":["sha-3"]}}},
  {"id":"v2","created_at":"2026-01-02T00:00:00Z","metadata":{"container":{"tags":["sha-2"]}}},
  {"id":"v1","created_at":"2026-01-01T00:00:00Z","metadata":{"container":{"tags":["sha-1"]}}}
]
JSON

cat > "$TMP/gh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${FAKE_GH_MODE:-success}" == "not_found" && "$*" == *versions* ]]; then
  echo "Not Found" >&2
  exit 1
fi
if [[ "${FAKE_GH_MODE:-success}" == "failure" && "$*" == *versions* ]]; then
  echo "Internal Server Error" >&2
  exit 1
fi
if [[ "$*" == *"-X DELETE"* ]]; then
  echo "$*" >> "$FAKE_DELETE_LOG"
  exit 0
fi
if [[ "$*" == *versions* ]]; then
  cat "$FAKE_VERSIONS_FILE"
  exit 0
fi
echo "$FAKE_OWNER_TYPE"
SH
chmod +x "$TMP/gh"

export GH_TOKEN=test-token
export GH_CLI="$TMP/gh"
export GITHUB_REPOSITORY=test-owner/karisanki
export FAKE_OWNER_TYPE=User
export FAKE_VERSIONS_FILE="$TMP/versions.json"

echo "Case: prune old versions"
export FAKE_GH_MODE=success
export FAKE_DELETE_LOG="$TMP/delete.log"
: > "$FAKE_DELETE_LOG"
output="$("$ROOT/scripts/prune-ghcr.sh")"
echo "$output" | grep -q 'delete id=v3'
echo "$output" | grep -q 'delete id=v2'
echo "$output" | grep -q 'delete id=v1'
if grep -q 'id=v4' "$FAKE_DELETE_LOG" || grep -q 'id=v5' "$FAKE_DELETE_LOG"; then
  echo "latest/recent versions should not be deleted" >&2
  exit 1
fi

echo "Case: package does not exist"
export FAKE_GH_MODE=not_found
export FAKE_DELETE_LOG="$TMP/not-found-delete.log"
: > "$FAKE_DELETE_LOG"
output="$("$ROOT/scripts/prune-ghcr.sh")"
echo "$output" | grep -q 'nothing to prune'
if [ -s "$FAKE_DELETE_LOG" ]; then
  echo "not-found case should not delete versions" >&2
  exit 1
fi

echo "Case: release lookup failure does not delete"
export FAKE_GH_MODE=failure
export FAKE_DELETE_LOG="$TMP/failure-delete.log"
: > "$FAKE_DELETE_LOG"
if "$ROOT/scripts/prune-ghcr.sh" >/tmp/prune-failure.out 2>/dev/null; then
  echo "failure case should exit non-zero" >&2
  exit 1
fi
if [ -s "$FAKE_DELETE_LOG" ]; then
  echo "failure case should not delete versions" >&2
  exit 1
fi

echo "Prune GHCR script tests passed."
