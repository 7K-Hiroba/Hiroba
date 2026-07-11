#!/usr/bin/env bash
# Aggregate member primitive packages into this Configuration package root.
# Copies each member's synthesized manifests (dist/*.k8s.yaml) next to
# crossplane.yaml so `crossplane xpkg build --package-root=.` bundles the union.
# Files are prefixed with the member name to avoid collisions between members.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"

members=(
  "@7k-hiroba/postgres"
  "@7k-hiroba/object-storage"
)
dirs=(
  "$REPO/packages/postgres"
  "$REPO/packages/object-storage"
)

# Clean previously aggregated manifests (keep crossplane.yaml + sources).
rm -f "$ROOT"/*.k8s.yaml "$ROOT"/*.xpkg

for i in "${!members[@]}"; do
  ws="${members[$i]}"
  dir="${dirs[$i]}"
  member="$(basename "$dir")"
  if ! ls "$dir"/dist/*.k8s.yaml >/dev/null 2>&1; then
    echo "==> synthesizing $ws"
    (cd "$REPO" && npm run synth -w "$ws")
  fi
  for f in "$dir"/dist/*.k8s.yaml; do
    base="$(basename "$f")"
    cp "$f" "$ROOT/${member}-${base}"
  done
done

echo "Aggregated manifests into $ROOT:"
ls -1 "$ROOT"/*.k8s.yaml
