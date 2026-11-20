/**
 * Share links: https://host/s/{id}#{key}. The id is sent to the server; the
 * key stays in the fragment, which browsers and HTTP clients never send.
 */
import { parseLinkKey } from "@/crypto/envelope";

export const SECRET_ID = /^[A-Za-z0-9_-]{16}$/;

export const buildLink = (origin: string, id: string, linkKey: string) => `${origin}/s/${id}#${linkKey}`;

export interface ParsedLink {
  origin: string;
  id: string;
  key: Uint8Array;
}

function parseUrl(link: string): URL {
  try {
    return new URL(link);
  } catch {
    throw new Error("not a URL");
  }
}

/** The secret id of a link; the key is not needed for that. */
export function parseLinkId(link: string): string {
  const id = /^\/s\/([^/]+)\/?$/.exec(parseUrl(link).pathname)?.[1];
  if (!id || !SECRET_ID.test(id)) throw new Error("not a share link: expected /s/{id}#{key}");
  return id;
}

/** Splits a share link, or throws with a message saying what is wrong. */
export function parseLink(link: string): ParsedLink {
  const url = parseUrl(link);
  const id = parseLinkId(link);
  const key = parseLinkKey(url.hash);
  if (!key) throw new Error("the key after # is missing or truncated");
  return { origin: url.origin, id, key };
}
