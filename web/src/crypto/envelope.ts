/**
 * Client-side encryption. The server never sees the key or the plaintext.
 *
 *   linkKey     32 random bytes, carried in the URL fragment (never sent)
 *   passKey     PBKDF2-SHA256(passphrase, pSalt, 600k) when a passphrase is set
 *   ikm         linkKey || passKey
 *   encKey      HKDF-SHA256(ikm, salt, "share-secrets/v1/encrypt") → AES-256-GCM
 *   auth        HKDF-SHA256(ikm, salt, "share-secrets/v1/auth")    → 32 bytes
 *
 * `auth` lets the server check that a reader holds the full key (and the
 * passphrase) before it consumes a view, without learning either: it only
 * stores SHA-256(auth), and auth reveals nothing about encKey.
 */

import { concat, fromBase64Url, randomBytes, toBase64Url } from "./encoding";

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
export const PBKDF2_ITERATIONS = 600_000;
const INFO_ENCRYPT = new TextEncoder().encode("share-secrets/v1/encrypt");
const INFO_AUTH = new TextEncoder().encode("share-secrets/v1/auth");
const AAD = new TextEncoder().encode("share-secrets/v1");

export interface PassphraseParams {
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
}

export interface Sealed {
  /** Goes in the link fragment. */
  linkKey: string;
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  salt: Uint8Array<ArrayBuffer>;
  passphrase: PassphraseParams | null;
  auth: Uint8Array<ArrayBuffer>;
}

export interface DerivedKeys {
  encKey: CryptoKey;
  auth: Uint8Array<ArrayBuffer>;
}

async function stretchPassphrase(passphrase: string, params: PassphraseParams): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: params.salt, iterations: params.iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

/** Derives the encryption key and proof of key from the link key (and passphrase). */
export async function deriveKeys(
  linkKey: Uint8Array,
  salt: Uint8Array<ArrayBuffer>,
  passphrase?: { value: string; params: PassphraseParams },
): Promise<DerivedKeys> {
  const ikm = passphrase
    ? concat(linkKey, await stretchPassphrase(passphrase.value, passphrase.params))
    : concat(linkKey);
  const hkdf = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey", "deriveBits"]);
  const encKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO_ENCRYPT },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const auth = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: INFO_AUTH }, hkdf, 256),
  );
  return { encKey, auth };
}

/** Encrypts `plaintext` under a fresh random key. */
export async function seal(plaintext: string, passphrase?: string): Promise<Sealed> {
  const linkKey = randomBytes(KEY_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const params = passphrase ? { salt: randomBytes(SALT_BYTES), iterations: PBKDF2_ITERATIONS } : null;
  const { encKey, auth } = await deriveKeys(
    linkKey,
    salt,
    params && passphrase ? { value: passphrase, params } : undefined,
  );
  const iv = randomBytes(IV_BYTES);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: AAD },
      encKey,
      new TextEncoder().encode(plaintext),
    ),
  );
  return { linkKey: toBase64Url(linkKey), ciphertext, iv, salt, passphrase: params, auth };
}

/** Decrypts a sealed secret; throws if the key is wrong or data was altered. */
export async function open(
  encKey: CryptoKey,
  ciphertext: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: AAD }, encKey, ciphertext);
  return new TextDecoder("utf-8", { fatal: true }).decode(plain);
}

/** Parses the link key from a URL fragment, or null if it is malformed. */
export function parseLinkKey(fragment: string): Uint8Array | null {
  try {
    const bytes = fromBase64Url(fragment.replace(/^#/, ""));
    return bytes.length === KEY_BYTES ? bytes : null;
  } catch {
    return null;
  }
}
