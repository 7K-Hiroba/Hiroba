#!/usr/bin/env bash
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

echo "== go function: build =="
(cd functions/platform && go build ./...)

echo "== go function: vet =="
(cd functions/platform && go vet ./...)

echo "== go function: test -race =="
(cd functions/platform && go test -race ./...)

echo "== all pre-push checks passed =="
