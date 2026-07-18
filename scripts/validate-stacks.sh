#!/usr/bin/env bash
# Validate KRO ResourceGraphDefinitions under stacks/.
#
# Checks:
#   - every .yaml file parses as YAML;
#   - every RGD has the expected apiVersion/kind;
#   - resource ids are unique within each RGD;
#   - every resource has a template.
#
# Does NOT require a Kubernetes cluster. For deeper validation (CEL syntax,
# CRD existence), use a live KRO instance.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO"

python3 - <<'PYEOF'
import sys
from pathlib import Path

import yaml

errors = []

for path in sorted(Path("stacks").rglob("*.yaml")):
    try:
        docs = list(yaml.safe_load_all(path.read_text()))
    except yaml.YAMLError as exc:
        errors.append(f"{path}: YAML parse error: {exc}")
        continue

    for idx, doc in enumerate(docs):
        if doc is None:
            continue
        if not isinstance(doc, dict):
            errors.append(f"{path}: document {idx} is not a mapping")
            continue

        # Non-RGD documents are allowed (e.g. kustomization snippets) but warned.
        if doc.get("apiVersion") != "kro.run/v1alpha1":
            continue
        if doc.get("kind") != "ResourceGraphDefinition":
            errors.append(f"{path}: document {idx} has apiVersion kro.run/v1alpha1 but kind {doc.get('kind')!r}")
            continue

        spec = doc.get("spec", {})
        schema = spec.get("schema", {})
        resources = spec.get("resources", [])

        if not schema:
            errors.append(f"{path}: RGD missing spec.schema")
        if not resources:
            errors.append(f"{path}: RGD has no spec.resources")

        ids = []
        for r in resources:
            rid = r.get("id") if isinstance(r, dict) else None
            if not rid:
                errors.append(f"{path}: resource missing id")
                continue
            ids.append(rid)
            if "template" not in r:
                errors.append(f"{path}: resource {rid!r} missing template")

        if len(ids) != len(set(ids)):
            duplicates = {i for i in ids if ids.count(i) > 1}
            errors.append(f"{path}: duplicate resource ids: {sorted(duplicates)}")

        print(f"OK: {path} ({len(resources)} resources)")

if errors:
    print("\nValidation failed:", file=sys.stderr)
    for err in errors:
        print(f"  - {err}", file=sys.stderr)
    sys.exit(1)

print("\nAll stack RGDs passed validation.")
PYEOF
