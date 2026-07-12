#!/usr/bin/env bash
# Render a package's composition locally for validation.
# Usage: render-validate.sh <package-dir>  (e.g. packages/postgres)
#
# The compositions delegate to function-platform, so this script builds the
# function, scans it with govulncheck, and ensures the crossplane CLI (all in
# parallel); then starts the function with --insecure (Development runtime,
# localhost:9443), runs `crossplane composition render`, and shuts it down.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
# HIROBA_ROOT points at the Hiroba framework repo (function source). Defaults to
# this repo; consumer repos set it to their sibling Hiroba checkout.
HIROBA_ROOT="${HIROBA_ROOT:-$REPO}"
PKG_DIR="$REPO/$1"
BIN="$(mktemp -d)/function-platform"
XP_VERSION="${CROSSPLANE_VERSION:-v2.3.3}"
XP_BIN="$(mktemp -d)/crossplane"

cd "$HIROBA_ROOT/functions/platform"

# Build the function, scan for vulnerabilities, and fetch the crossplane CLI
# concurrently to save time.
go build -o "$BIN" ./cmd &
BUILD_PID=$!

go run golang.org/x/vuln/cmd/govulncheck@latest ./... &
VULN_PID=$!

XP_PID=""
if ! command -v crossplane >/dev/null 2>&1; then
  (
    echo "crossplane CLI not found, installing ${XP_VERSION}..."
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="amd64"
    curl -sL "https://releases.crossplane.io/stable/${XP_VERSION}/bin/${OS}_${ARCH}/crank" -o "$XP_BIN"
    chmod +x "$XP_BIN"
  ) &
  XP_PID=$!
fi

wait "$BUILD_PID"
wait "$VULN_PID"
if [ -n "$XP_PID" ]; then
  wait "$XP_PID"
  crossplane() { "$XP_BIN" "$@"; }
fi

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
