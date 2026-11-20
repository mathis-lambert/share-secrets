# Working on share-secrets

Guidance for AI coding agents (and humans) changing this repository. For
*using* a running instance as an agent, see `web/public/llms.txt`, served at
`/llms.txt`.

## Ground rules

- The server must never be able to read a secret. Plaintext, link keys and
  passphrases exist only in the browser or the agent client. Any change that
  sends them to the server, or logs them anywhere, is wrong.
- Logs record route templates and status codes only: no secret ids, no IPs.
- The envelope (`web/src/crypto/envelope.ts`) is versioned by its HKDF labels
  (`share-secrets/v1/…`). Changing it needs new labels so old links keep working,
  plus updates to `SECURITY.md`, the how-it-works page and `llms.txt`.
- API changes go in `web/public/openapi.json` in the same change.

## Layout

- `server/`: Rust (axum). `config` → `domain` → `storage` (trait + Postgres and
  file backends) → `service` (rules) → `http` (handlers, middleware).
- `web/src/`: React. `crypto/` (envelope), `api/` (client, wire format),
  `secrets/` (share and open, shared by the UI and the agent client),
  `features/` (pages), `ui/`, `agent/` (CLI built to `/agent/share.mjs`).

## Checks

```bash
make lint test      # what CI runs
make dev-server     # API on :8080
make dev-web        # UI on :5173
```

Changes land on `main` through pull requests, squash-merged after the `server`,
`web` and `image` checks pass.
