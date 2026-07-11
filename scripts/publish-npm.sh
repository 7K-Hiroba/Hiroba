#!/usr/bin/env bash
# Publish every public workspace package whose version is not yet on npm.
# Idempotent: safe to re-run after a partial failure.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

mapfile -t pkgs < <(node -e '
  const fs = require("fs"), path = require("path");
  const root = JSON.parse(fs.readFileSync("package.json"));
  const emit = (dir) => {
    const p = path.join(dir, "package.json");
    if (!fs.existsSync(p)) return;
    const pkg = JSON.parse(fs.readFileSync(p));
    if (!pkg.private) console.log(`${dir} ${pkg.name} ${pkg.version}`);
  };
  for (const ws of root.workspaces || []) {
    const base = ws.replace(/\*$/, "");
    if (!fs.existsSync(base)) continue;
    if (fs.existsSync(path.join(base, "package.json"))) emit(base);
    else for (const d of fs.readdirSync(base)) emit(path.join(base, d));
  }
')

for entry in "${pkgs[@]}"; do
  read -r dir name version <<< "$entry"
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "skip ${name}@${version} (already published)"
    continue
  fi
  echo "publish ${name}@${version} from ${dir}"
  npm publish --provenance --access public --workspace "${dir}"
done
