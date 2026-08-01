import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BASE, createTestSession, jsonInit, uploadTestFile } from "./helpers";

async function mintShare(
  cookie: string,
  fileId: string,
  expiry = "24h",
  maxDownloads?: number,
): Promise<{ id: string; url: string }> {
  const res = await SELF.fetch(
    `${BASE}/api/shares`,
    jsonInit("POST", { fileId, expiry, maxDownloads }, cookie),
  );
  if (res.status !== 201) throw new Error(`share failed: ${res.status}`);
  const body = (await res.json()) as { data: { id: string; url: string } };
  return body.data;
}

describe("share links", () => {
  it("redeems a valid share publicly (no cookie)", async () => {
    const cookie = await createTestSession();
    const file = await uploadTestFile(cookie, "shared.txt", "shared bytes");
    const share = await mintShare(cookie, file.id);

    const redeem = await SELF.fetch(share.url);
    expect(redeem.status).toBe(200);
    expect(await redeem.text()).toBe("shared bytes");
  });

  it("rejects invalid expiry preset and unknown file", async () => {
    const cookie = await createTestSession();
    const file = await uploadTestFile(cookie);
    const badExpiry = await SELF.fetch(
      `${BASE}/api/shares`,
      jsonInit("POST", { fileId: file.id, expiry: "forever" }, cookie),
    );
    expect(badExpiry.status).toBe(400);

    const badFile = await SELF.fetch(
      `${BASE}/api/shares`,
      jsonInit("POST", { fileId: "does-not-exist", expiry: "1h" }, cookie),
    );
    expect(badFile.status).toBe(404);
  });

  it("returns identical 404s for bad, expired, and revoked tokens", async () => {
    const cookie = await createTestSession();
    const file = await uploadTestFile(cookie);

    const bad = await SELF.fetch(`${BASE}/s/${"x".repeat(43)}`);
    expect(bad.status).toBe(404);
    const badText = await bad.text();

    const share = await mintShare(cookie, file.id);
    await env.DB.prepare("UPDATE shares SET expires_at = 1 WHERE id = ?")
      .bind(share.id)
      .run();
    const expired = await SELF.fetch(share.url);
    expect(expired.status).toBe(404);
    expect(await expired.text()).toBe(badText);

    const share2 = await mintShare(cookie, file.id);
    const revoke = await SELF.fetch(`${BASE}/api/shares/${share2.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(revoke.status).toBe(200);
    const revoked = await SELF.fetch(share2.url);
    expect(revoked.status).toBe(404);
    expect(await revoked.text()).toBe(badText);
  });

  it("enforces max downloads atomically", async () => {
    const cookie = await createTestSession();
    const file = await uploadTestFile(cookie, "limited.txt", "only twice");
    const share = await mintShare(cookie, file.id, "1h", 2);

    expect((await SELF.fetch(share.url)).status).toBe(200);
    expect((await SELF.fetch(share.url)).status).toBe(200);
    expect((await SELF.fetch(share.url)).status).toBe(404);
  });

  it("lists active shares and hides revoked/expired ones", async () => {
    const cookie = await createTestSession();
    const file = await uploadTestFile(cookie);
    const live = await mintShare(cookie, file.id);
    const dead = await mintShare(cookie, file.id);
    await SELF.fetch(`${BASE}/api/shares/${dead.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });

    const list = await SELF.fetch(`${BASE}/api/shares`, {
      headers: { Cookie: cookie },
    });
    const body = (await list.json()) as { data: Array<{ id: string }> };
    const ids = body.data.map((s) => s.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(dead.id);
  });

  it("share URLs never expose the raw token in storage", async () => {
    const cookie = await createTestSession();
    const file = await uploadTestFile(cookie);
    const share = await mintShare(cookie, file.id);
    const token = share.url.split("/s/")[1] ?? "";
    const row = await env.DB.prepare("SELECT token_hash FROM shares WHERE id = ?")
      .bind(share.id)
      .first<{ token_hash: string }>();
    expect(row).not.toBeNull();
    expect(row?.token_hash).not.toBe(token);
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
