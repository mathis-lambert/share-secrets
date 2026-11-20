/** Unpadded base64url, the encoding used in links and by the API. */

export function toBase64Url(bytes: Uint8Array): string {
  // Chunked: String.fromCharCode takes the bytes as arguments, so keep each
  // call well below the engine's argument limit.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("invalid base64url");
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
