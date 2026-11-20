.PHONY: dev-server dev-web build test lint fmt image run

dev-server: ## API on :8080, serving web/dist if built
	cd server && DATA_DIR=../data STATIC_DIR=../web/dist cargo run

dev-web: ## Vite dev server on :5173, proxying /api to :8080
	cd web && npm run dev

build:
	cd web && npm ci && npm run build
	cd server && cargo build --release --locked

test:
	cd server && cargo test --locked
	cd web && npm test

lint:
	cd server && cargo fmt --check && cargo clippy --all-targets --locked -- -D warnings
	cd web && npm run typecheck

fmt:
	cd server && cargo fmt

image:
	docker build -t share-secrets:local .

run: image
	docker run --rm -p 8080:8080 -v share-secrets-data:/data share-secrets:local
