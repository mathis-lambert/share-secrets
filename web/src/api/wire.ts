/**
 * Conversions between the envelope's bytes and the API's JSON. Base64url
 * exists only here: the rest of the app handles Uint8Array.
 */
import { fromBase64Url, toBase64Url } from "@/crypto/encoding";
import type { PassphraseParams, Sealed } from "@/crypto/envelope";
import type { CreateRequest, InspectResponse, PassphraseDto, RevealResponse } from "./types";

export interface SecretInfo {
  salt: Uint8Array<ArrayBuffer>;
  passphrase: PassphraseParams | null;
  /** Unix seconds. */
  expiresAt: number;
  viewsLeft: number;
}

export interface RevealedCiphertext {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  viewsLeft: number;
}

/** Exactly what is uploaded for a sealed secret. */
export function toCreateRequest(sealed: Sealed, { ttl, views }: { ttl: number; views: number }): CreateRequest {
  return {
    ciphertext: toBase64Url(sealed.ciphertext),
    iv: toBase64Url(sealed.iv),
    salt: toBase64Url(sealed.salt),
    passphrase: sealed.passphrase && {
      salt: toBase64Url(sealed.passphrase.salt),
      iterations: sealed.passphrase.iterations,
    },
    auth: toBase64Url(sealed.auth),
    ttl,
    views,
  };
}

const decodePassphrase = (p: PassphraseDto | null): PassphraseParams | null =>
  p && { salt: fromBase64Url(p.salt), iterations: p.iterations };

export const decodeInfo = (r: InspectResponse): SecretInfo => ({
  salt: fromBase64Url(r.salt),
  passphrase: decodePassphrase(r.passphrase),
  expiresAt: r.expiresAt,
  viewsLeft: r.viewsLeft,
});

export const decodeRevealed = (r: RevealResponse): RevealedCiphertext => ({
  ciphertext: fromBase64Url(r.ciphertext),
  iv: fromBase64Url(r.iv),
  viewsLeft: r.viewsLeft,
});

export const encodeAuth = (auth: Uint8Array) => ({ auth: toBase64Url(auth) });
