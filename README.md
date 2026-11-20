<div align="center">

# share-secrets

**Share passwords, keys and tokens through links that self-destruct.**<br>
Encrypted in the browser. The server stores ciphertext it cannot read.

[![CI](https://github.com/mathis-lambert/share-secrets/actions/workflows/ci.yml/badge.svg)](https://github.com/mathis-lambert/share-secrets/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/mathis-lambert/share-secrets?sort=semver)](https://github.com/mathis-lambert/share-secrets/releases)
[![Image](https://img.shields.io/badge/image-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/mathis-lambert/share-secrets/pkgs/container/share-secrets)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<img src="docs/assets/encrypt.gif" alt="Typing a secret, setting it to expire in 7 days, then creating the link: the text turns into ciphertext and the share dialog opens" width="880">

</div>

## Why

Pasting a password into a chat or a ticket leaves it there forever, in every
backup and search index. share-secrets gives you a link instead: the recipient
opens it once, the secret is gone, and the server never had a way to read it.

- **End-to-end encrypted.** AES-256-GCM with a random 256-bit key, generated in
  your browser. The key lives in the link's `#fragment`, which browsers never
  send to servers.
- **Burn after reading.** Deleted after the allowed number of reads (one by
  default) or at expiry, whichever comes first.
- **Optional passphrase.** Stretched with PBKDF2 and mixed into the key: a leaked
  link alone is not enough.
- **Safe from link previews.** Chat apps and mail scanners that fetch the link
  load a page, not the secret. Reading takes a click and a proof of the key.
- **Brute-force resistant.** Wrong passphrases are rejected before a read is
  spent, and the secret is deleted after five failures.
- **Small and boring to run.** One ~12 MB distroless image for amd64 and arm64,
  PostgreSQL or plain files, no accounts, no cookies, no analytics.

## Screenshots

| Create | Share |
| --- | --- |
| ![Editor with a secret and its options](docs/assets/create.png) | ![Share dialog with the link split into server, id and key](docs/assets/share.png) |
| **Receive** | **Read** |
| ![A sealed secret waiting to be decrypted](docs/assets/sealed.png) | ![The decrypted secret, deleted from the server](docs/assets/revealed.png) |

<details>
<summary>More: options, confirmation, light theme, documentation page</summary>

![Reads option open in a popover](docs/assets/options.png)
![Decrypt confirmation dialog](docs/assets/confirm.png)
![Light theme](docs/assets/create-light.png)
![How it works page](docs/assets/how-it-works.png)
![Decrypting animation](docs/assets/decrypt.gif)

</details>

## Quick start

Try it locally, with secrets stored as files in a volume:

```bash
docker run -d --name share-secrets -p 8080:8080 -v share-secrets:/data \
  ghcr.io/mathis-lambert/share-secrets:latest
```

Open <http://localhost:8080>.

### With PostgreSQL

[`examples/compose.yaml`](examples/compose.yaml) runs the app with a PostgreSQL
database. The schema is created and migrated at startup.

```bash
curl -O https://raw.githubusercontent.com/mathis-lambert/share-secrets/main/examples/compose.yaml
POSTGRES_PASSWORD=$(openssl rand -hex 24) docker compose up -d
```

To use an existing server instead, set `DATABASE_URL`:

```bash
docker run -d -p 8080:8080 \
  -e DATABASE_URL=postgres://share_secrets:password@db.internal:5432/share_secrets \
  ghcr.io/mathis-lambert/share-secrets:latest
```

### In production

Browsers only allow the WebCrypto API on HTTPS pages (and `localhost`), so put a
TLS reverse proxy in front, then set `TRUST_PROXY=true` and `HSTS=true`. With
[Caddy](examples/Caddyfile):

```caddyfile
secrets.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

The container listens on `8080`, runs as a non-root user and works with a
read-only root filesystem. `GET /healthz` answers `200` when it is up, and the
image has a built-in `HEALTHCHECK`.

Image tags follow releases: `latest`, `0.1`, `0.1.0`. Pin a version (or a
digest) in production.

## Configuration

Everything is set through environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | unset | PostgreSQL URL. When unset, secrets are stored as files in `DATA_DIR` |
| `DATA_DIR` | `/data` | File storage directory, used without `DATABASE_URL` |
| `SITE_NAME` | `Share Secrets` | Name shown in the header and the page title |
| `TTL_OPTIONS` | `1h,1d,7d` | Expiry choices (`s`, `m`, `h`, `d`), each between 1m and 365d |
| `DEFAULT_TTL` | `1d` | Preselected expiry, one of `TTL_OPTIONS` |
| `MAX_VIEWS` | `10` | Highest number of reads a sender can allow (1 to 100) |
| `MAX_SECRET_SIZE` | `65536` | Largest secret, in bytes |
| `MAX_FAILED_ATTEMPTS` | `5` | Wrong keys or passphrases before a secret is deleted |
| `RATE_LIMIT` | `60` | API requests per minute and client IP, `0` to disable |
| `TRUST_PROXY` | `false` | Take the client IP from the last `X-Forwarded-For` entry |
| `HSTS` | `false` | Send `Strict-Transport-Security` |
| `LEGAL_PUBLISHER` | unset | Operator name on the `/legal` page |
| `LEGAL_CONTACT` | unset | Contact on the `/legal` page; an email becomes a `mailto:` link |
| `LEGAL_HOSTING` | unset | Hosting provider on the `/legal` page |
| `LISTEN_ADDR` | `0.0.0.0:8080` | Listen address |
| `SWEEP_INTERVAL` | `1m` | How often expired secrets are purged |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` or `debug` |

## How it works

```
https://secrets.example.com/s/KXNoeJnUBjLgJXdP#R9O_Ou4kMQdzWkK9kQlu-lrEGI7qTuQXoFrK2_MhT10
                              └─── id ───────┘└──────────────── key ────────────────────┘
                              sent to server   never leaves the browser
```

| Step | Browser | Server |
| --- | --- | --- |
| Create | Draws a 32-byte key and a salt, derives an AES-256-GCM key and a *proof of key* with HKDF-SHA256, encrypts | Stores ciphertext, IV, salt and `SHA-256(proof)` |
| Open the link | Reads the key from the fragment, fetches the public salt | Returns the salt, consumes nothing |
| Decrypt | Re-derives the proof and sends it | Checks it in constant time, spends a read, deletes on the last one, returns the ciphertext |
| Read | Decrypts locally and removes the key from the address bar | |

With a passphrase, `PBKDF2-SHA256(passphrase, 600 000 iterations)` is mixed into
the key before HKDF. The server logs routes and status codes only: no secret
ids, no IP addresses. The full threat model, including what this does *not*
protect against, is in [SECURITY.md](SECURITY.md). The app also ships a
how-it-works page at `/how-it-works`.

## Development

```
server/              Rust (axum) API, also serves the web client
  src/config/        environment settings
  src/domain/        secret model and identifiers
  src/storage/       Store trait, PostgreSQL and file backends
  src/service/       lifecycle: create, inspect, reveal, destroy, sweep
  src/http/          routes, handlers, middleware (rate limit, headers, logs)
  src/web/           static files with SPA fallback
  migrations/        PostgreSQL schema, embedded in the binary
web/                 React + TypeScript client (Vite)
  src/crypto/        envelope: key derivation, sealing, opening
  src/features/      create, reveal, how-it-works and legal pages
  src/ui/            components, motion, formatting
examples/            docker compose with PostgreSQL, Caddy config
```

```bash
make dev-server   # API on :8080, file storage in ./data
make dev-web      # client on :5173, proxies /api to :8080
make lint test
make image        # docker build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the PostgreSQL tests and the release
process.

## Security

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/mathis-lambert/share-secrets/security/advisories/new),
not in public issues.

## License

[MIT](LICENSE)
