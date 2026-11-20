import { api } from "@/api/client";
import type { PublicConfig } from "@/api/types";
import { shareSecret, type ShareOptions, type Shared } from "@/secrets/share";

export interface Options extends ShareOptions {
  /** Empty for none. */
  passphrase: string;
}

export const defaultOptions = (config: PublicConfig): Options => ({
  ttl: config.defaultTtl,
  views: 1,
  passphrase: "",
});

export interface SharedSecret extends Shared {
  views: number;
}

/** Shares `text` on this instance. */
export async function createSecret(text: string, options: Options): Promise<SharedSecret> {
  const shared = await shareSecret(api, window.location.origin, text, options);
  return { ...shared, views: options.views };
}
