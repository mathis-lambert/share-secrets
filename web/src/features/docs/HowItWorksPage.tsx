import { ArrowRight, Ban, FileLock2, FileText, KeyRound, Monitor, Server, ShieldCheck } from "lucide-react";
import { Link } from "@/app/router";

/** Plain documentation of the scheme; deeper material folds away. */
export function HowItWorksPage() {
  return (
    <article className="doc">
      <h1>How it works</h1>
      <p className="doc-lead">
        Your secret is encrypted in your browser before anything is sent. The server stores a blob it cannot read, hands
        it back once, then deletes it.
      </p>

      <Wire />

      <h2>The link</h2>
      <p>A link has three parts, and only the first two ever reach the server.</p>
      <pre className="doc-code">
        <span className="part-host">https://host/s/</span>
        <span className="part-id">KXNoeJnUBjLgJXdP</span>
        <span className="part-key">#R9O_Ou4kMQdzWkK9kQlu-lrEGI7qTuQXoFrK2_MhT10</span>
      </pre>
      <p>
        The <span className="part-id">id</span> tells the server which blob to look up. The{" "}
        <span className="part-key">key</span> sits after the <code>#</code>, in the fragment: browsers keep fragments
        to themselves and never put them in requests, so the key never shows up in server or proxy logs.
      </p>

      <h2>Creating a secret</h2>
      <ol className="doc-steps">
        <li>Your browser draws a random 256-bit key and a random salt.</li>
        <li>
          From them it derives two independent values with HKDF-SHA256: an AES-256-GCM encryption key, and a proof of
          key.
        </li>
        <li>It encrypts your text and uploads the ciphertext, the salt and the proof of key. Not the key.</li>
        <li>The server keeps a SHA-256 hash of the proof, and returns an id.</li>
      </ol>

      <h2>Reading it</h2>
      <ol className="doc-steps">
        <li>Opening the link loads the page and the public salt. Nothing is consumed yet.</li>
        <li>On Decrypt, the browser re-derives the proof of key from the fragment and sends it.</li>
        <li>
          If it matches, the server counts a read, deletes the secret if it was the last one, and returns the ciphertext.
        </li>
        <li>The browser decrypts it locally and removes the key from the address bar.</li>
      </ol>
      <p>
        Chat apps and mail scanners that preview links only load the page, so they cannot burn a secret by accident.
      </p>

      <h2>What the server knows</h2>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Stored</th>
            <th>Never seen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ciphertext, IV, salt</td>
            <td>Your text</td>
          </tr>
          <tr>
            <td>SHA-256 of the proof of key</td>
            <td>The key</td>
          </tr>
          <tr>
            <td>Expiry, reads left, failed attempts</td>
            <td>Your passphrase</td>
          </tr>
        </tbody>
      </table>
      <p>Logs record the route and the status code of each request. No ids, no IP addresses.</p>

      <h2>Under the hood</h2>
      <details className="doc-details">
        <summary>Key derivation</summary>
        <pre className="doc-code">{`ikm     = linkKey                          // 32 random bytes
        || PBKDF2-SHA256(passphrase, pSalt, 600 000)   // only with a passphrase
encKey  = HKDF-SHA256(ikm, salt, "share-secrets/v1/encrypt")  → AES-256-GCM
auth    = HKDF-SHA256(ikm, salt, "share-secrets/v1/auth")     → 32 bytes`}</pre>
        <p>
          The two HKDF outputs are independent: knowing <code>auth</code> tells nothing about <code>encKey</code>.
        </p>
      </details>
      <details className="doc-details">
        <summary>Passphrases</summary>
        <p>
          A passphrase is stretched with PBKDF2 and mixed into the key, so the link alone is useless. A wrong passphrase
          produces a wrong proof of key: the server refuses it without spending a read, and deletes the secret after five
          failures, which caps online guessing.
        </p>
      </details>
      <details className="doc-details">
        <summary>Limits</summary>
        <p>
          Like every web-based encryption tool, this relies on the server sending honest JavaScript. Someone who reads
          the link before the recipient can read the secret; the recipient will then find it gone, which at least makes
          the interception visible. A compromised device on either end defeats any scheme.
        </p>
      </details>
      <details className="doc-details">
        <summary>API</summary>
        <pre className="doc-code">{`GET    /api/config
POST   /api/secrets              { ciphertext, iv, salt, passphrase, auth, ttl, views }
GET    /api/secrets/{id}         → { salt, passphrase, expiresAt, viewsLeft }
POST   /api/secrets/{id}/reveal  { auth } → { ciphertext, iv, viewsLeft }
DELETE /api/secrets/{id}         { auth }`}</pre>
      </details>

      <p className="doc-end">
        <Link to="/" className="btn btn-primary">
          New secret
        </Link>
      </p>
    </article>
  );
}

/** Browser on the left, server on the right, and what crosses between them. */
function Wire() {
  return (
    <figure className="wire" aria-label="What leaves your browser">
      <div className="wire-lane">
        <span className="wire-title">
          <Monitor size={14} aria-hidden="true" /> your browser
        </span>
        <span className="wire-item">
          <FileText size={13} aria-hidden="true" /> plaintext
        </span>
        <span className="wire-item wire-key">
          <KeyRound size={13} aria-hidden="true" /> key
        </span>
      </div>
      <div className="wire-mid">
        <span className="wire-packet">
          <ArrowRight size={12} aria-hidden="true" /> ciphertext, salt, iv
        </span>
        <span className="wire-packet">
          <ArrowRight size={12} aria-hidden="true" /> proof of key
        </span>
        <span className="wire-blocked">
          <Ban size={12} aria-hidden="true" /> key stays here
        </span>
      </div>
      <div className="wire-lane">
        <span className="wire-title">
          <Server size={14} aria-hidden="true" /> server
        </span>
        <span className="wire-item wire-server">
          <FileLock2 size={13} aria-hidden="true" /> ciphertext
        </span>
        <span className="wire-item wire-server">
          <ShieldCheck size={13} aria-hidden="true" /> sha256(proof)
        </span>
      </div>
    </figure>
  );
}
