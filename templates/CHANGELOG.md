# Changelog

## [0.2.0](https://github.com/7K-Hiroba/Hiroba/compare/app-template-v0.1.0...app-template-v0.2.0) (2026-06-01)


### ⚠ BREAKING CHANGES

* move hiroba to use a centralized library for resources ([#52](https://github.com/7K-Hiroba/Hiroba/issues/52))

### Features

* add .gitignore and envFrom to deployment ([#63](https://github.com/7K-Hiroba/Hiroba/issues/63)) ([b0c471b](https://github.com/7K-Hiroba/Hiroba/commit/b0c471b1ffa5addc69d94198aca388ec588f1b70))
* add helm test and values.schema, update docs and roadmap ([7029bce](https://github.com/7K-Hiroba/Hiroba/commit/7029bce9170595fccf9d26bd4dfc1adc5130e078))
* add helm tests and schema validation ([35e7bda](https://github.com/7K-Hiroba/Hiroba/commit/35e7bda4e37fce57b1cac87b8b721b0b27af8568))
* add helm-docs generation to skeleton charts ([#57](https://github.com/7K-Hiroba/Hiroba/issues/57)) ([c7025bb](https://github.com/7K-Hiroba/Hiroba/commit/c7025bb1a744672b69fa229f41b964cfa34714a4))
* add skills and update gitops baseline implementations skeleton ([#47](https://github.com/7K-Hiroba/Hiroba/issues/47)) ([ba77ef7](https://github.com/7K-Hiroba/Hiroba/commit/ba77ef7f0126a91406a7ed4e7acd7b5fec199cce))
* added add artifacthub yaml and baseline chart README ([38f0f40](https://github.com/7K-Hiroba/Hiroba/commit/38f0f4009d2e28fb09861dbd2d2829a6ed46fa06))
* create baseline ignore files for docker and helm ([#30](https://github.com/7K-Hiroba/Hiroba/issues/30)) ([535d0ef](https://github.com/7K-Hiroba/Hiroba/commit/535d0ef19ce8dbff1f48f49d30875c999ecb4dad))
* create skills for Hiroba skeletons and update gitops to include basel… ([#46](https://github.com/7K-Hiroba/Hiroba/issues/46)) ([8691dc5](https://github.com/7K-Hiroba/Hiroba/commit/8691dc5c4907ab5e7a79931a13e2e5c672302856))
* create stack template ([#28](https://github.com/7K-Hiroba/Hiroba/issues/28)) ([00efaeb](https://github.com/7K-Hiroba/Hiroba/commit/00efaebbee07ebfe1aa5039fc47b516ceb417337))
* **helm-lib:** add startupProbe, defaultFilters, StatefulSet, and scaleTargetKind ([2ac54d8](https://github.com/7K-Hiroba/Hiroba/commit/2ac54d8135ca3a264ec4ea9b1f613967f82b72c6))
* load config maps to deployment as mounts ([#59](https://github.com/7K-Hiroba/Hiroba/issues/59)) ([5e9bd43](https://github.com/7K-Hiroba/Hiroba/commit/5e9bd432ad73d37f5835860f038e3e3f7ace9431))
* move hiroba to use a centralized library for resources ([#52](https://github.com/7K-Hiroba/Hiroba/issues/52)) ([2a36ca6](https://github.com/7K-Hiroba/Hiroba/commit/2a36ca69d9ad628c5f43696cd9c576c484615dd9))
* update helm skeleton for pdb, observability improvements and relevant docs ([#24](https://github.com/7K-Hiroba/Hiroba/issues/24)) ([6585bc7](https://github.com/7K-Hiroba/Hiroba/commit/6585bc7a74930844b738e709fd1d093dc71a39c4))
* update skeleton for artifacthub release ([#26](https://github.com/7K-Hiroba/Hiroba/issues/26)) ([38f0f40](https://github.com/7K-Hiroba/Hiroba/commit/38f0f4009d2e28fb09861dbd2d2829a6ed46fa06))
* wire backstage doc engine to template and hiroba docs ([50e2c19](https://github.com/7K-Hiroba/Hiroba/commit/50e2c198425a235952374656fe2fdf32bae6d60a))
* wire clusterRefNamespace to garage buckets ([06378a1](https://github.com/7K-Hiroba/Hiroba/commit/06378a1428ab061019afbfa9ad1715a3b47aaa12))
* wire region to object store and garage key ([#67](https://github.com/7K-Hiroba/Hiroba/issues/67)) ([21be804](https://github.com/7K-Hiroba/Hiroba/commit/21be804126b8c770455da85a7adf68df4410a6fe))
* wire s3 buckets per provider, create cnpg backup ([#70](https://github.com/7K-Hiroba/Hiroba/issues/70)) ([6f67311](https://github.com/7K-Hiroba/Hiroba/commit/6f673116684db25eb8bffe8148c8d94a92de0669))


### Bug Fixes

* add ci-api-versions to platform helm unittests and standardize artifacthub project names ([#29](https://github.com/7K-Hiroba/Hiroba/issues/29)) ([439810a](https://github.com/7K-Hiroba/Hiroba/commit/439810a04ee1804e016e08e303e0ac235d79a37c))
* add contents write and pr write ([#27](https://github.com/7K-Hiroba/Hiroba/issues/27)) ([9d66552](https://github.com/7K-Hiroba/Hiroba/commit/9d66552af53812af85a6f9f3a8e5a2d5eea7252c))
* add instructions for chart icons ([0b21ef3](https://github.com/7K-Hiroba/Hiroba/commit/0b21ef3f72c3ab538f5a3d164fbc17188c8fdc77))
* add mkdocs config for backstage doc engine ([a3f37cd](https://github.com/7K-Hiroba/Hiroba/commit/a3f37cd628b3b7df2af43d8264faa0046583676f))
* bad maintainer name or helm charts, selected 7k-hiroba ([975d31c](https://github.com/7K-Hiroba/Hiroba/commit/975d31cf16722e29f12f9981cd775904402a6a35))
* change changelog-type to default ([f6a08ef](https://github.com/7K-Hiroba/Hiroba/commit/f6a08ef2564e0cf2fdb68d20b57464454d81fb6e))
* change default runtime image to distroless ([d342572](https://github.com/7K-Hiroba/Hiroba/commit/d3425727c9b50e29d3770a63e55ff1ba32c8925b))
* docker image not building due to already existing userid ([d342572](https://github.com/7K-Hiroba/Hiroba/commit/d3425727c9b50e29d3770a63e55ff1ba32c8925b))
* fix skeleton template not being templated ([715cf11](https://github.com/7K-Hiroba/Hiroba/commit/715cf11e6b107740628af361791b5d5ac647380b))
* helm-docs workflow ([2ac54d8](https://github.com/7K-Hiroba/Hiroba/commit/2ac54d8135ca3a264ec4ea9b1f613967f82b72c6))
* move Issue template bug report to correct folder ([e9585a3](https://github.com/7K-Hiroba/Hiroba/commit/e9585a354eb281c925de331320d6af682aef4a4b))
* remove index.md and update links to redirect to correct github organization ([#19](https://github.com/7K-Hiroba/Hiroba/issues/19)) ([31a4d5e](https://github.com/7K-Hiroba/Hiroba/commit/31a4d5e376a5feca8c003e6ef5c6df7a4e7821dc))
* rename skeleton backstage config file to catalog-info ([9714c68](https://github.com/7K-Hiroba/Hiroba/commit/9714c68fd64678bf2b62078f7483d067c1ff4e5e))
* template improvements ([af5e2ff](https://github.com/7K-Hiroba/Hiroba/commit/af5e2fff40bdac21fdb148af78b2e8dcbfec5491))
* template improvements ([d674dba](https://github.com/7K-Hiroba/Hiroba/commit/d674dba6a66e6a70728091db014b106e605529b4))
* typo in ci ([975d31c](https://github.com/7K-Hiroba/Hiroba/commit/975d31cf16722e29f12f9981cd775904402a6a35))
* updated docker default port to 8080 ([975d31c](https://github.com/7K-Hiroba/Hiroba/commit/975d31cf16722e29f12f9981cd775904402a6a35))
