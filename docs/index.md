# Hiroba Documentation

**Hiroba is 7KGroup's platform engineering framework.** It delivers self-service platform products to development teams using **Crossplane v2** for infrastructure orchestration and **CDK8s** for type-safe manifest generation. All reconciliation logic lives in a single Go orchestrator function; TypeScript packages emit XRDs and thin Pipeline Compositions only.

[:octicons-arrow-right-24: Hiroba on GitHub](https://github.com/7K-Hiroba/Hiroba){ .md-button }

---

## What lives here

| Section              | Contents                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guides**           | How to use and build on Hiroba: the [Usage Guide](usage-guide.md) for consuming platform products, the [Developer Guide](developer-guide.md) for contributing new primitives, and the [Architecture](architecture.md) overview of how the pieces fit together. |
| **Decisions (ADRs)** | The Architecture Decision Records behind the design — why Crossplane, why CDK8s, the orchestrator-function pattern, contract codegen, and more.                                                                                                                |
| **Runbooks**         | How we operate: adding providers, debugging stuck XRs, rotating credentials, upgrading compositions, and manual resource cleanup.                                                                                                                              |

## Why we publish this

Engineering buyers trust what they can read. Our architecture, our decisions, and our operational runbooks are public because they're the strongest evidence of how we work. If you're evaluating Hiroba, your engineers should start here.

## Related

- [7KGroup](https://7kgroup.org) — company site
- [Inari docs](https://docs.7kgroup.io/inari/) — the PTaaS offering built on Hiroba
- [github.com/7K-Hiroba](https://github.com/7K-Hiroba) — Hiroba repositories
