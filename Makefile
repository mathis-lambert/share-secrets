.PHONY: dev-server dev-web build lint test lint-server lint-web test-server test-web fmt image run

# The single definition of checks: CI runs these same targets.

dev-server: ## API on :8080, file storage in ./data, serving web/dist if built
	cd server && DATA_DIR=../data STATIC_DIR=../web/dist cargo run

dev-web: ## Vite dev server on :5173, proxying /api to :8080
	cd web && npm run dev

build: lint-web
	cd web && npm run build
	cd server && cargo build --release --locked

lint: lint-server lint-web
test: test-server test-web

lint-server:
	cd server && cargo fmt --check && cargo clippy --all-targets --locked -- -D warnings

lint-web:
	cd web && npm run typecheck

test-server: ## PostgreSQL store tests run when TEST_DATABASE_URL is set
	cd server && cargo test --locked

test-web:
	cd web && npm test

fmt:
	cd server && cargo fmt

image:
	docker build -t share-secrets:local .

run: image
	docker run --rm -p 8080:8080 -v share-secrets-data:/data share-secrets:local
