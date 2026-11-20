# Contributing

Issues and pull requests are welcome. For anything larger than a fix, open an
issue first so we can agree on the approach.

## Setup

Requirements: Rust (stable), Node.js (see `web/.nvmrc`), and Docker for the
image and the optional PostgreSQL tests.

```bash
make dev-server   # API on :8080 (file storage in ./data)
make dev-web      # client on :5173, proxies /api to :8080
```

Run the PostgreSQL store tests against a throwaway database:

```bash
docker run -d --rm --name ss-pg -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:18-alpine
TEST_DATABASE_URL=postgres://postgres:test@localhost:5432/postgres make test
```

## Before opening a pull request

```bash
make lint test
```

- Keep the server free of anything that could see plaintext or keys.
- Changes to the cryptographic envelope need a new version label
  (`share-secrets/v2/…`) so existing links keep working.
- User-facing strings live in `web/src/content/strings.ts`.

## Releasing

1. Bump the version in `server/Cargo.toml` and `web/package.json`.
2. Update `CHANGELOG.md`.
3. Publish a GitHub release tagged `vX.Y.Z`. The release workflow builds and
   pushes `ghcr.io/mathis-lambert/share-secrets` for amd64 and arm64.

### Downstream deployments

Optionally, the release workflow can notify a deployment repository with a
`repository_dispatch` event (`share-secrets-release`, payload `version`). Set
the repository variable `DEPLOY_DISPATCH_REPO` and the secret
`DEPLOY_DISPATCH_TOKEN` to enable it; forks without them skip the step.
