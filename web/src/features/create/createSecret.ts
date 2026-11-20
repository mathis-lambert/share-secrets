import { api } from "@/api/client";
import type { PublicConfig } from "@/api/types";
import { toCreateRequest } from "@/api/wire";
import { seal } from "@/crypto/envelope";

export interface Options {
  ttl: number;
  views: number;
  /** Empty for none. */
  passphrase: string;
}

export const defaultOptions = (config: PublicConfig): Options => ({
  ttl: config.defaultTtl,
  views: 1,
  passphrase: "",
});

export interface SharedSecret {
  id: string;
  link: string;
  expiresAt: number;
  views: number;
  hasPassphrase: boolean;
  /** Exactly what was uploaded, for display. */
  ciphertext: string;
  /** Kept in memory only, so the sender can delete the secret. */
  auth: Uint8Array;
}

/** Encrypts locally, uploads the ciphertext and builds the link. */
export async function createSecret(text: string, { ttl, views, passphrase }: Options): Promise<SharedSecret> {
  const sealed = await seal(text, passphrase || undefined);
  const request = toCreateRequest(sealed, { ttl, views });
  const { id, expiresAt } = await api.create(request);
  return {
    id,
    link: `${window.location.origin}/s/${id}#${sealed.linkKey}`,
    expiresAt,
    views,
    hasPassphrase: sealed.passphrase !== null,
    ciphertext: request.ciphertext,
    auth: sealed.auth,
  };
}
