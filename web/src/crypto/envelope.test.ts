import { describe, expect, it } from "vitest";
import { deriveKeys, open, parseLinkKey, seal } from "./envelope";

describe("envelope", () => {
  it("round-trips without a passphrase", async () => {
    const sealed = await seal("hunter2 🔐");
    const key = parseLinkKey(`#${sealed.linkKey}`);
    expect(key).not.toBeNull();
    const { encKey, auth } = await deriveKeys(key!, sealed.salt);
    expect(auth).toEqual(sealed.auth);
    expect(await open(encKey, sealed.ciphertext, sealed.iv)).toBe("hunter2 🔐");
  });

  it("requires the passphrase", async () => {
    const sealed = await seal("db password", "correct horse");
    const key = parseLinkKey(sealed.linkKey)!;
    const params = sealed.passphrase!;

    const good = await deriveKeys(key, sealed.salt, { value: "correct horse", params });
    expect(good.auth).toEqual(sealed.auth);
    expect(await open(good.encKey, sealed.ciphertext, sealed.iv)).toBe("db password");

    const bad = await deriveKeys(key, sealed.salt, { value: "wrong", params });
    expect(bad.auth).not.toEqual(sealed.auth);
    await expect(open(bad.encKey, sealed.ciphertext, sealed.iv)).rejects.toThrow();
  });

  it("rejects malformed link keys", () => {
    expect(parseLinkKey("")).toBeNull();
    expect(parseLinkKey("#abc")).toBeNull();
    expect(parseLinkKey("#" + "!".repeat(43))).toBeNull();
  });
});
