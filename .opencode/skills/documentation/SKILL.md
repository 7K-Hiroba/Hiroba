---
name: documentation
description: Standards for TechDocs content in Hiroba repos covering structure, markdownlint rules, and Docusaurus conventions
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: docs
---

## What I cover

Every rule that applies when creating or editing Markdown documentation under `docs/` in app and stack repos, and under `website/` in the Hiroba root repo.

## Philosophy

Documentation is a first-class deliverable. Every chart change that affects user-facing behaviour — new values, changed defaults, new prerequisites, breaking changes — must include a matching docs update in the same PR. CI fails on markdownlint errors, so docs and code ship together or not at all.

## App repo doc structure

```
docs/
├── index.md          # Overview, architecture, prerequisites, quick start
├── helm-base.md      # Base chart: deployment, service, routing, scaling, probes
├── helm-platform.md  # Platform chart: postgres, s3, secrets, observability
├── container.md      # Dockerfile, build stages, image publishing
└── crossplane.md     # XRDs and Compositions this app exposes
```

Every file in this list must exist. Do not delete or rename them — Backstage TechDocs renders them by sidebar position.

### `sidebar_position` frontmatter

Every doc file must start with frontmatter declaring its sidebar position:

```yaml
---
sidebar_position: 1
---
```

Positions for the standard files:

| File | Position |
| --- | --- |
| `index.md` | 1 |
| `helm-base.md` | 2 |
| `helm-platform.md` | 3 (or 4 if container.md is 3) |
| `container.md` | 3 |
| `crossplane.md` | 5 |

## Stack repo doc structure

```
docs/
├── index.md          # Overview, GitOps layout, quick start bootstrap
├── architecture.md   # Cluster topology, operator dependencies, network diagram
├── adding-apps.md    # How to onboard a new application to the stack
└── security.md       # RBAC, network policies, secret management approach
```

Same rules apply: all four files must exist, frontmatter required.

## Markdownlint — zero tolerance

CI runs `markdownlint-cli2` on every PR. A single violation fails the build. Rules are configured in `.markdownlint.yaml` at the repo root (`MD013: false` — line length not enforced; all other rules active).

**Run the linter before every commit that touches a `.md` file:**

```bash
npx markdownlint-cli2 "**/*.md"
```

Fix every reported error. Do not disable rules inline or in config to silence warnings.

### Most common violations

| Rule | Description | Fix |
| --- | --- | --- |
| MD040 | Fenced code block missing language tag | Add language: ` ```yaml ` not ` ``` ` |
| MD041 | File does not start with top-level heading | Add `# Heading` as first non-frontmatter line |
| MD022 | Heading not surrounded by blank lines | Add blank line before and after every heading |
| MD032 | List not surrounded by blank lines | Add blank line before and after every list |
| MD024 | Duplicate heading text in same file | Make headings unique or use `<!-- markdownlint-disable MD024 -->` only when headings are in different sections and duplication is intentional |
| MD060 | Table separator row missing spaces around pipes | Use `| --- |` not `|---|` |

### Code blocks

Every fenced code block must declare a language:

```markdown
    ```yaml
    key: value
    ```
```

Common language tags used in this project: `yaml`, `bash`, `json`, `text`, `dockerfile`, `markdown`.

## Heading structure

- Every file must start with a single `# H1` heading (after frontmatter).
- Use `##` for major sections, `###` for subsections. Do not skip levels.
- Do not repeat the `# H1` text in any `##` heading within the same file.

## TODO comments

The skeleton ships `<!-- TODO: ... -->` comments in several docs as placeholders. These are intentional and must be replaced with real content before the app goes to production. They are invisible in rendered output (HTML comments). Do not convert them to visible text unless you are filling them in.

## Updating docs after chart changes

| Change | Doc file to update |
| --- | --- |
| New `values.yaml` key | Relevant section in `helm-base.md` or `helm-platform.md` |
| New platform provider | `helm-platform.md` — add provider sub-section with config example |
| Changed default value | Update the example in the relevant doc file |
| New prerequisite operator | Add to the Prerequisites section of the relevant file |
| Breaking change | Add a `## Migration` or `## Breaking changes` section with before/after examples |
| New Crossplane XRD | Document the Claim API in `crossplane.md` with an example |

## Cross-linking

Link between doc files using relative paths:

```markdown
See the [base chart](./helm-base.md#injecting-secrets) for wiring secrets into the Deployment.
```

Do not use absolute URLs to GitHub for docs within the same repo.

## README.md

The repo `README.md` is separate from TechDocs. It is the GitHub landing page. Keep it short: one-paragraph description, quick-start commands, link to full docs. Do not duplicate large sections from `docs/` into `README.md`.

## Checklist before committing

- [ ] `sidebar_position` frontmatter present in every doc file
- [ ] Every file starts with a `# H1` heading
- [ ] No heading levels skipped (`#` → `##` → `###`)
- [ ] All fenced code blocks have a language tag
- [ ] `npx markdownlint-cli2 "**/*.md"` reports zero errors
- [ ] Chart changes have matching doc updates in the same PR
- [ ] TODO placeholders replaced with real content (or left as HTML comments if content is genuinely TBD)
- [ ] Cross-links use relative paths, not absolute GitHub URLs
