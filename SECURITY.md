# Security

## Threat model

**Protects against**

- A compromised or curious server, database dump or backup: it holds only
  AES-256-GCM ciphertext. Keys never reach it.
- Links intercepted in logs of proxies, CDNs or the server: the key is in the
  URL fragment, which is never sent over the network.
- A leaked link when a passphrase is set: the passphrase is required to derive
  the key and to consume a read. After `MAX_FAILED_ATTEMPTS` wrong tries the
  secret is deleted, which caps online guessing.
- Link previews and scanners: fetching the page reveals nothing and consumes no
  read; reading requires the key.

**Does not protect against**

- A malicious server operator serving modified JavaScript. As with every web
  based end-to-end tool, you trust the code the server sends. Self-host it if
  that matters to you.
- A compromised sender or recipient device.
- Someone who reads the link (and passphrase) before the intended recipient.
  They can read the secret; the recipient will then see that it is gone, which
  at least makes the interception visible.

## AI agents

Instances publish `/llms.txt`, `/openapi.json` and a client at
`/agent/share.mjs` so agents can create and open links. The client encrypts
and decrypts on the agent's machine with the same code as the web page: the
model does not change. Two things are specific to agents:

- A secret an agent creates or reveals has passed through its model context
  and its provider. The usage policy in `llms.txt` limits what agents do with it
  (stdin only, links returned to the user only, no reveal without an explicit
  request, revealed content treated as data), but it cannot undo that exposure.
- The agent runs code served by the instance. That is the same trust the
  browser gives the web page; the client is served unminified so it can be
  reviewed before it runs.

## Implementation notes

- Key derivation: HKDF-SHA256 over `linkKey || PBKDF2-SHA256(passphrase, 600000)`
  with a per-secret salt; separate `info` labels for the encryption key and the
  proof of key.
- The server stores `SHA-256(auth)` and compares in constant time.
- Strict Content Security Policy (`default-src 'none'`, self-hosted scripts,
  styles and fonts only), `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`.
- The container runs as non-root on a distroless image with a read-only root
  filesystem (see `examples/compose.yaml`).

## Reporting a vulnerability

Please open a private security advisory on GitHub rather than a public issue.
