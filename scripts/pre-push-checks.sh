#!/usr/bin/env bash
# Mirrors .github/workflows/ci.yml checks that are practical to run locally.
# Skipped: e2e (kind cluster), xpkg build/push (docker registry), PR title lint.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== cdk8s: lint =="
npm run lint --if-present

echo "== cdk8s: build =="
npm run build --if-present

echo "== cdk8s: unit tests =="
npm run test:unit --if-present

echo "== cdk8s: synth =="
npm run synth --if-present

echo "== cdk8s: validate =="
npm run validate --if-present

if command -v go >/dev/null; then
  echo "== go function: build =="
  (cd functions/platform && go build ./...)

  echo "== go function: vet =="
  (cd functions/platform && go vet ./...)

  echo "== go function: test -race =="
  (cd functions/platform && go test -race ./...)
else
  echo "!! go not installed, skipping go function checks"
fi

if command -v gitleaks >/dev/null; then
  echo "== secret scan =="
  gitleaks git --redact
else
  echo "!! gitleaks not installed, skipping secret scan"
fi

echo "== all pre-push checks passed =="
