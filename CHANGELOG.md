# Changelog

All notable changes are listed here. Versions follow [Semantic Versioning](https://semver.org).

## 0.2.1

- The interface says it is open source and links to the repository (footer,
  how-it-works with a "Run your own" section, legal page).
- The share link stays on one line and scrolls sideways, so the Copy button
  no longer moves under it.

## 0.2.0

- AI agents: `/llms.txt` with a usage policy, `/openapi.json` (OpenAPI 3.1),
  and a zero-dependency client at `/agent/share.mjs` that encrypts on the
  agent's side (`create`, `info`, `reveal`, `delete`).
- API errors keep one shape for every failure, including oversized bodies
  (`413`, `too_large`) and malformed JSON (`422`).
- `/api/config` exposes `maxFailedAttempts`.
- Static files are compressed (brotli, gzip).
- File storage writes bytes as base64url: records are about 3x smaller. Files
  written by 0.1.0 are not readable by 0.2.0; with file storage, upgrade when
  no secret is pending.

## 0.1.0

First release.

- End-to-end encryption in the browser: AES-256-GCM, HKDF-SHA256, key in the
  URL fragment.
- Optional passphrase, stretched with PBKDF2 (600 000 iterations).
- Burn after reading, configurable number of reads and expiry.
- Proof of key: only holders of the full link can consume or delete a secret;
  too many wrong attempts delete it.
- PostgreSQL storage, or files when no database is configured.
- Multi-arch image (amd64, arm64) on GHCR, distroless, non-root.
