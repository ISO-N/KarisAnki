#!/usr/bin/env bash
set -euo pipefail

GH_TOKEN="${GH_TOKEN:-}"
GH_CLI="${GH_CLI:-gh}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
KEEP_VERSIONS="${KEEP_VERSIONS:-2}"

if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN is required" >&2
  exit 1
fi

if [ -z "$GITHUB_REPOSITORY" ]; then
  echo "GITHUB_REPOSITORY is required" >&2
  exit 1
fi

owner="${GITHUB_REPOSITORY%%/*}"
owner_type="$("$GH_CLI" api "repos/${GITHUB_REPOSITORY}" --jq '.owner.type')"
if [[ "${owner_type}" == "Organization" ]]; then
  package_url="orgs/${owner}/packages/container/karisanki"
else
  package_url="users/${owner}/packages/container/karisanki"
fi

versions=""
if ! versions="$("$GH_CLI" api "${package_url}/versions?per_page=100" --paginate --jq '[.[] | {id, created_at, tags: (.metadata.container.tags // [])}] | sort_by(.created_at) | reverse' 2>"${TMPDIR:-/tmp}/ghcr-error.log")"; then
  if grep -Eq '"Not Found"|Not Found' "${TMPDIR:-/tmp}/ghcr-error.log"; then
    echo "GHCR package does not exist yet; nothing to prune."
    exit 0
  fi
  cat "${TMPDIR:-/tmp}/ghcr-error.log" >&2
  exit 1
fi

echo "$versions" | node -e '
  const fs = require("fs");
  const versions = JSON.parse(fs.readFileSync(0, "utf8"));
  versions.sort((a, b) => b.created_at.localeCompare(a.created_at));
  versions.forEach((version, index) => {
    const tags = (version.tags || []).join(",");
    console.log([index + 1, version.id, version.created_at, tags].join("\t"));
  });
' | while IFS=$'\t' read -r idx id created tags; do
  if [[ ",${tags}," == *,latest,* ]]; then
    echo "keep[latest] id=${id} tags=[${tags}]"
    continue
  fi
  if (( idx <= KEEP_VERSIONS )); then
    echo "keep[recent #${idx}] id=${id} tags=[${tags}]"
    continue
  fi
  echo "delete id=${id} tags=[${tags}]"
  "$GH_CLI" api -X DELETE "${package_url}/versions/${id}"
done
