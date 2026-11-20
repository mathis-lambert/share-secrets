import type { Api } from "@/api/client";
import type { SecretInfo } from "@/api/wire";
import { deriveKeys, open, type DerivedKeys } from "@/crypto/envelope";

/** The server accepted the key, but the ciphertext does not decrypt. */
export class UndecryptableError extends Error {
  constructor() {
    super("the secret could not be decrypted: the link is damaged");
  }
}

/** Derives the keys for a secret from its link key and, if it has one, the passphrase. */
export function keysFor(info: SecretInfo, linkKey: Uint8Array, passphrase?: string): Promise<DerivedKeys> {
  const stretched = info.passphrase ? { value: passphrase ?? "", params: info.passphrase } : undefined;
  return deriveKeys(linkKey, info.salt, stretched);
}

/**
 * Proves the key, consumes one read and decrypts locally. API errors
 * (not_found, wrong_key…) propagate as ApiError.
 */
export async function revealSecret(api: Api, id: string, keys: DerivedKeys) {
  const out = await api.reveal(id, keys.auth);
  try {
    return { text: await open(keys.encKey, out.ciphertext, out.iv), viewsLeft: out.viewsLeft };
  } catch {
    throw new UndecryptableError();
  }
}
