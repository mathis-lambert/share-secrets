import { api } from "@/api/client";
import { toBase64Url } from "@/crypto/encoding";
import { seal } from "@/crypto/envelope";

export interface CreateOptions {
  text: string;
  ttl: number;
  views: number;
  passphrase?: string;
}

export interface SharedSecret {
  id: string;
  link: string;
  expiresAt: number;
  views: number;
  hasPassphrase: boolean;
  /** Exactly what was uploaded, for display. */
  ciphertext: string;
  /** Kept in memory only, so the sender can delete the secret. */
  auth: string;
}

/** Encrypts locally, uploads the ciphertext and builds the link. */
export async function createSecret({ text, ttl, views, passphrase }: CreateOptions): Promise<SharedSecret> {
  const sealed = await seal(text, passphrase || undefined);
  const auth = toBase64Url(sealed.auth);
  const ciphertext = toBase64Url(sealed.ciphertext);
  const { id, expiresAt } = await api.create({
    ciphertext,
    iv: toBase64Url(sealed.iv),
    salt: toBase64Url(sealed.salt),
    passphrase: sealed.passphrase
      ? { salt: toBase64Url(sealed.passphrase.salt), iterations: sealed.passphrase.iterations }
      : null,
    auth,
    ttl,
    views,
  });
  return {
    id,
    link: `${window.location.origin}/s/${id}#${sealed.linkKey}`,
    expiresAt,
    views,
    hasPassphrase: Boolean(sealed.passphrase),
    ciphertext,
    auth,
  };
}
