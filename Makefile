.PHONY: install lint test build synth validate package publish clean e2e-setup test-e2e

install:
	npm install

lint:
	npm run lint

test:
	npm run test:unit

build:
	npm run build

synth:
	npm run synth

validate:
	npm run validate

package:
	npm run package

publish:
	npm run publish

clean:
	rm -rf dist/**/ dist/*/
	find . -type d -name 'dist' -exec rm -rf {} + 2>/dev/null || true

e2e-setup:
	./scripts/e2e-setup.sh

test-e2e: e2e-setup
	npm run test:e2e
