# Changelog

All notable changes are listed here. Versions follow [Semantic Versioning](https://semver.org).

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
