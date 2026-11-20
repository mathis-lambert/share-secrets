import type { Api } from "@/api/client";
import { toCreateRequest } from "@/api/wire";
import { seal } from "@/crypto/envelope";
import { buildLink } from "./link";

export interface ShareOptions {
  /** Seconds; one of the instance's `ttlOptions`. */
  ttl: number;
  views: number;
  /** Empty or undefined for none. */
  passphrase?: string;
}

export interface Shared {
  id: string;
  link: string;
  /** Unix seconds. */
  expiresAt: number;
  /** Base64url ciphertext, exactly as uploaded. */
  ciphertext: string;
  hasPassphrase: boolean;
  /** Proof of key, for deleting the secret later. */
  auth: Uint8Array;
}

/** Encrypts locally, uploads the ciphertext, returns the link. */
export async function shareSecret(api: Api, origin: string, text: string, options: ShareOptions): Promise<Shared> {
  const sealed = await seal(text, options.passphrase || undefined);
  const request = toCreateRequest(sealed, options);
  const { id, expiresAt } = await api.create(request);
  return {
    id,
    link: buildLink(origin, id, sealed.linkKey),
    expiresAt,
    ciphertext: request.ciphertext,
    hasPassphrase: sealed.passphrase !== null,
    auth: sealed.auth,
  };
}
