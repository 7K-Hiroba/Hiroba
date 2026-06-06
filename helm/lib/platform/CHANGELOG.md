# Changelog

## [0.2.10](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.9...helm-platform-lib-v0.2.10) (2026-06-06)


### Features

* ommiting platform values defaults to false, update checks ([#86](https://github.com/7K-Hiroba/Hiroba/issues/86)) ([15be99c](https://github.com/7K-Hiroba/Hiroba/commit/15be99cac7a2cf397b832ebc1f155804e462e9f4))

## [0.2.9](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.8...helm-platform-lib-v0.2.9) (2026-06-01)


### Features

* add init containers do deployment and statefulset ([#82](https://github.com/7K-Hiroba/Hiroba/issues/82)) ([fb68243](https://github.com/7K-Hiroba/Hiroba/commit/fb682438ed52538a08c8bc4c96de0e7cfcbf442a))

## [0.2.8](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.7...helm-platform-lib-v0.2.8) (2026-06-01)


### Bug Fixes

* add persistentVolumeClaimSpec to dragonfly redis resources ([#80](https://github.com/7K-Hiroba/Hiroba/issues/80)) ([a4fb429](https://github.com/7K-Hiroba/Hiroba/commit/a4fb429f8885a261b5512f480dbf0a59a514162e))

## [0.2.7](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.6...helm-platform-lib-v0.2.7) (2026-06-01)


### Bug Fixes

* ommit dragonfly image when empty ([#77](https://github.com/7K-Hiroba/Hiroba/issues/77)) ([59fd8fd](https://github.com/7K-Hiroba/Hiroba/commit/59fd8fd357eb165ed47a7fec6eadcd1206f18f40))

## [0.2.6](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.5...helm-platform-lib-v0.2.6) (2026-06-01)


### Features

* add plugins to cnpg database and add redis dragonfly ([#73](https://github.com/7K-Hiroba/Hiroba/issues/73)) ([aeb0a97](https://github.com/7K-Hiroba/Hiroba/commit/aeb0a97f3c24157e6a31daf67424bd0936f1cd7b))

## [0.2.5](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.4...helm-platform-lib-v0.2.5) (2026-05-31)


### Features

* wire s3 buckets per provider, create cnpg backup ([#70](https://github.com/7K-Hiroba/Hiroba/issues/70)) ([6f67311](https://github.com/7K-Hiroba/Hiroba/commit/6f673116684db25eb8bffe8148c8d94a92de0669))

## [0.2.4](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.3...helm-platform-lib-v0.2.4) (2026-05-29)


### Features

* wire region to object store and garage key ([#67](https://github.com/7K-Hiroba/Hiroba/issues/67)) ([21be804](https://github.com/7K-Hiroba/Hiroba/commit/21be804126b8c770455da85a7adf68df4410a6fe))

## [0.2.3](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.2...helm-platform-lib-v0.2.3) (2026-05-29)


### Features

* wire clusterRefNamespace to garage buckets ([06378a1](https://github.com/7K-Hiroba/Hiroba/commit/06378a1428ab061019afbfa9ad1715a3b47aaa12))

## [0.2.2](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.1...helm-platform-lib-v0.2.2) (2026-05-29)


### Features

* **helm-lib:** add startupProbe, defaultFilters, StatefulSet, and scaleTargetKind ([2ac54d8](https://github.com/7K-Hiroba/Hiroba/commit/2ac54d8135ca3a264ec4ea9b1f613967f82b72c6))


### Bug Fixes

* helm-docs workflow ([2ac54d8](https://github.com/7K-Hiroba/Hiroba/commit/2ac54d8135ca3a264ec4ea9b1f613967f82b72c6))

## [0.2.1](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.2.0...helm-platform-lib-v0.2.1) (2026-05-21)


### Features

* add helm-docs generation to skeleton charts ([#57](https://github.com/7K-Hiroba/Hiroba/issues/57)) ([c7025bb](https://github.com/7K-Hiroba/Hiroba/commit/c7025bb1a744672b69fa229f41b964cfa34714a4))

## [0.2.0](https://github.com/7K-Hiroba/Hiroba/compare/helm-platform-lib-v0.1.0...helm-platform-lib-v0.2.0) (2026-05-21)


### ⚠ BREAKING CHANGES

* move hiroba to use a centralized library for resources ([#52](https://github.com/7K-Hiroba/Hiroba/issues/52))

### Features

* move hiroba to use a centralized library for resources ([#52](https://github.com/7K-Hiroba/Hiroba/issues/52)) ([2a36ca6](https://github.com/7K-Hiroba/Hiroba/commit/2a36ca69d9ad628c5f43696cd9c576c484615dd9))

## Changelog
