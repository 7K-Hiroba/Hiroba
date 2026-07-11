#!/usr/bin/env bash
# Render a package's composition locally for validation.
# Usage: render-validate.sh <package-dir>  (e.g. packages/postgres)
#
# The compositions delegate to function-platform, so this script starts the
# function from source with --insecure (Development runtime, localhost:9443),
# runs `crossplane composition render`, then shuts the function down.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
PKG_DIR="$REPO/$1"
BIN="$(mktemp -d)/function-platform"

cd "$REPO/functions/platform"
go build -o "$BIN" ./cmd
"$BIN" --insecure &
FN_PID=$!
trap 'kill "$FN_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if (exec 3<>/dev/tcp/127.0.0.1/9443) 2>/dev/null; then
    exec 3>&- 3<&-
    break
  fi
  sleep 1
done

cd "$PKG_DIR"
crossplane composition render \
  test/fixtures/xr.yaml \
  dist/composition.k8s.yaml \
  --xrd=dist/xrd.k8s.yaml \
  test/fixtures/functions.yaml \
  --include-full-xr
