/**
 * What the agent client can do, independent of the command line: easy to
 * test with a fake API. Encryption and decryption happen here, locally.
 */
import type { Api } from "@/api/client";
import { parseLink, parseLinkId } from "@/secrets/link";
import { keysFor, revealSecret } from "@/secrets/open";
import { shareSecret } from "@/secrets/share";

/** "90s", "30m", "12h", "7d", or plain seconds. */
export function parseTtl(value: string): number {
  const m = /^(\d+)([smhd]?)$/.exec(value.trim());
  if (!m) throw new Error(`invalid --ttl ${JSON.stringify(value)}: use e.g. 1h, 1d or 7d`);
  const scale = { "": 1, s: 1, m: 60, h: 3_600, d: 86_400 }[m[2] as "" | "s" | "m" | "h" | "d"];
  return Number(m[1]) * scale;
}

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();

export interface CreateInput {
  text: string;
  ttl?: string;
  views?: number;
  passphrase?: string;
}

export async function create(api: Api, origin: string, input: CreateInput) {
  if (!input.text) throw new Error("the secret on stdin is empty");
  const config = await api.config();
  const ttl = input.ttl === undefined ? config.defaultTtl : parseTtl(input.ttl);
  if (!config.ttlOptions.includes(ttl)) {
    const allowed = config.ttlOptions.map((s) => `${s}s`).join(", ");
    throw new Error(`--ttl must be one of the instance's options: ${allowed}`);
  }
  const views = input.views ?? 1;
  if (!Number.isInteger(views) || views < 1 || views > config.maxViews) {
    throw new Error(`--views must be between 1 and ${config.maxViews}`);
  }
  if (new TextEncoder().encode(input.text).length > config.maxSecretSize) {
    throw new Error(`the secret exceeds ${config.maxSecretSize} bytes`);
  }
  const shared = await shareSecret(api, origin, input.text, { ttl, views, passphrase: input.passphrase });
  return {
    link: shared.link,
    expiresAt: iso(shared.expiresAt),
    views,
    passphrase: shared.hasPassphrase,
  };
}

/** Public facts about a secret. Consumes nothing, and works without the key. */
export async function info(api: Api, link: string) {
  const i = await api.inspect(parseLinkId(link));
  return { expiresAt: iso(i.expiresAt), viewsLeft: i.viewsLeft, passphrase: i.passphrase !== null };
}

/**
 * Keys for a link. Refuses locally when a passphrase is required but missing:
 * a blind attempt would count as a failure and bring deletion closer.
 */
async function keysForLink(api: Api, link: string, passphrase?: string) {
  const { id, key } = parseLink(link);
  const secret = await api.inspect(id);
  if (secret.passphrase && !passphrase) {
    throw new Error("this secret needs a passphrase: ask the user for it and pass --passphrase-env");
  }
  return { id, keys: await keysFor(secret, key, passphrase) };
}

/** Decrypts a secret. Consumes one read; the last read deletes it. */
export async function reveal(api: Api, link: string, passphrase?: string) {
  const { id, keys } = await keysForLink(api, link, passphrase);
  const { text, viewsLeft } = await revealSecret(api, id, keys);
  return { secret: text, viewsLeft };
}

/** Deletes a secret now. Needs the full link, like reading it. */
export async function remove(api: Api, link: string, passphrase?: string) {
  const { id, keys } = await keysForLink(api, link, passphrase);
  await api.destroy(id, keys.auth);
  return { deleted: true };
}
