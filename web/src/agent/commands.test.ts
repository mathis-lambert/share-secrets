import { describe, expect, it } from "vitest";
import { createApi } from "@/api/client";
import { create, info, parseTtl, remove, reveal } from "./commands";

const ORIGIN = "https://secrets.test";

/** An in-memory instance speaking the real API, so the wire format is exercised too. */
function fakeInstance() {
  const secrets = new Map<string, Record<string, unknown> & { auth: string; views: number }>();
  let next = 0;
  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const notFound = () => json(404, { error: "not_found", message: "gone" });

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const [, , resource, id, action] = url.pathname.split("/");
    if (url.pathname === "/api/config") {
      return json(200, { siteName: "t", maxSecretSize: 1024, ttlOptions: [3600, 86400], defaultTtl: 86400, maxViews: 5 });
    }
    if (resource !== "secrets") return notFound();
    if (!id && init?.method === "POST") {
      const newId = `id${String(next++).padStart(14, "0")}`;
      secrets.set(newId, { ...body, views: body.views });
      return json(201, { id: newId, expiresAt: 2_000_000_000 });
    }
    const s = id ? secrets.get(id) : undefined;
    if (!s) return notFound();
    if (init?.method === "GET") {
      return json(200, { salt: s.salt, passphrase: s.passphrase, expiresAt: 2_000_000_000, viewsLeft: s.views });
    }
    if (body.auth !== s.auth) return json(403, { error: "wrong_key", message: "wrong" });
    if (init?.method === "DELETE") {
      secrets.delete(id!);
      return json(204);
    }
    if (action === "reveal") {
      s.views -= 1;
      if (s.views === 0) secrets.delete(id!);
      return json(200, { ciphertext: s.ciphertext, iv: s.iv, viewsLeft: s.views });
    }
    return notFound();
  }) as typeof fetch;

  return { api: createApi(ORIGIN, fetchImpl), secrets };
}

describe("agent commands", () => {
  it("creates a link that reveals once, with only ciphertext on the server", async () => {
    const { api, secrets } = fakeInstance();
    const out = await create(api, ORIGIN, { text: "s3cr3t" });
    expect(out.link).toMatch(/^https:\/\/secrets\.test\/s\/[\w-]{16}#[\w-]{43}$/);
    expect(JSON.stringify([...secrets.values()])).not.toContain("s3cr3t");

    expect(await info(api, out.link)).toMatchObject({ viewsLeft: 1, passphrase: false });
    expect(await reveal(api, out.link)).toEqual({ secret: "s3cr3t", viewsLeft: 0 });
    await expect(reveal(api, out.link)).rejects.toMatchObject({ code: "not_found" });
  });

  it("needs the passphrase and can delete", async () => {
    const { api } = fakeInstance();
    const { link } = await create(api, ORIGIN, { text: "db", passphrase: "horse", views: 2 });
    await expect(reveal(api, link, "wrong")).rejects.toMatchObject({ code: "wrong_key" });
    await expect(reveal(api, link)).rejects.toThrow(/needs a passphrase/);
    expect((await reveal(api, link, "horse")).secret).toBe("db");
    await remove(api, link, "horse");
    await expect(info(api, link)).rejects.toMatchObject({ code: "not_found" });
  });

  it("validates input against the instance", async () => {
    const { api } = fakeInstance();
    await expect(create(api, ORIGIN, { text: "" })).rejects.toThrow(/empty/);
    await expect(create(api, ORIGIN, { text: "x", ttl: "2h" })).rejects.toThrow(/--ttl/);
    await expect(create(api, ORIGIN, { text: "x", views: 9 })).rejects.toThrow(/--views/);
    await expect(create(api, ORIGIN, { text: "x".repeat(2000) })).rejects.toThrow(/exceeds/);
    await expect(reveal(api, `${ORIGIN}/s/abc`)).rejects.toThrow(/share link/);
  });

  it("parses durations", () => {
    expect(parseTtl("1d")).toBe(86_400);
    expect(parseTtl("90m")).toBe(5_400);
    expect(parseTtl("3600")).toBe(3_600);
    expect(() => parseTtl("1w")).toThrow();
  });
});
