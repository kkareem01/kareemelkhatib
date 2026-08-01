import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BASE, createTestSession, jsonInit, uploadTestFile } from "./helpers";

describe("file vault lifecycle", () => {
  it("uploads, lists, fetches metadata and content", async () => {
    const cookie = await createTestSession();
    const uploaded = await uploadTestFile(cookie, "notes.txt", "vault content");

    const list = await SELF.fetch(`${BASE}/api/files`, { headers: { Cookie: cookie } });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      data: { files: Array<{ id: string; name: string }> };
    };
    expect(listBody.data.files.some((f) => f.id === uploaded.id)).toBe(true);

    const meta = await SELF.fetch(`${BASE}/api/files/${uploaded.id}`, {
      headers: { Cookie: cookie },
    });
    expect(meta.status).toBe(200);

    const content = await SELF.fetch(`${BASE}/api/files/${uploaded.id}/content`, {
      headers: { Cookie: cookie },
    });
    expect(content.status).toBe(200);
    expect(await content.text()).toBe("vault content");
    expect(content.headers.get("Content-Disposition")).toContain("inline");
    expect(content.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("rejects uploads without a valid filename header", async () => {
    const cookie = await createTestSession();
    const res = await SELF.fetch(`${BASE}/api/files`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: "data",
    });
    expect(res.status).toBe(400);
  });

  it("forces download for unsafe mime types (svg)", async () => {
    const cookie = await createTestSession();
    const uploaded = await uploadTestFile(
      cookie,
      "evil.svg",
      "<svg onload=alert(1)/>",
      "image/svg+xml",
    );
    const content = await SELF.fetch(`${BASE}/api/files/${uploaded.id}/content`, {
      headers: { Cookie: cookie },
    });
    expect(content.headers.get("Content-Disposition")).toContain("attachment");
    expect(content.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("renames and tags a file", async () => {
    const cookie = await createTestSession();
    const uploaded = await uploadTestFile(cookie);
    const patch = await SELF.fetch(
      `${BASE}/api/files/${uploaded.id}`,
      jsonInit("PATCH", { name: "renamed.txt", tags: ["Tax", "2026"] }, cookie),
    );
    expect(patch.status).toBe(200);
    const body = (await patch.json()) as {
      data: { name: string; tags: string[] };
    };
    expect(body.data.name).toBe("renamed.txt");
    expect(body.data.tags).toEqual(["tax", "2026"]);

    const bad = await SELF.fetch(
      `${BASE}/api/files/${uploaded.id}`,
      jsonInit("PATCH", { tags: ["***"] }, cookie),
    );
    expect(bad.status).toBe(400);
  });

  it("filters by search and tag", async () => {
    const cookie = await createTestSession();
    const a = await uploadTestFile(cookie, "alpha-report.pdf", "a", "application/pdf");
    await uploadTestFile(cookie, "beta-notes.txt", "b");
    await SELF.fetch(
      `${BASE}/api/files/${a.id}`,
      jsonInit("PATCH", { tags: ["work"] }, cookie),
    );

    const byName = await SELF.fetch(`${BASE}/api/files?q=alpha`, {
      headers: { Cookie: cookie },
    });
    const nameBody = (await byName.json()) as { data: { files: Array<{ name: string }> } };
    expect(nameBody.data.files.length).toBe(1);
    expect(nameBody.data.files[0]?.name).toBe("alpha-report.pdf");

    const byTag = await SELF.fetch(`${BASE}/api/files?tag=work`, {
      headers: { Cookie: cookie },
    });
    const tagBody = (await byTag.json()) as { data: { files: Array<{ id: string }> } };
    expect(tagBody.data.files.length).toBe(1);
    expect(tagBody.data.files[0]?.id).toBe(a.id);
  });

  it("soft-deletes: file vanishes from list/content and its shares are revoked", async () => {
    const cookie = await createTestSession();
    const uploaded = await uploadTestFile(cookie);

    const share = await SELF.fetch(
      `${BASE}/api/shares`,
      jsonInit("POST", { fileId: uploaded.id, expiry: "24h" }, cookie),
    );
    expect(share.status).toBe(201);
    const shareBody = (await share.json()) as { data: { url: string } };

    const del = await SELF.fetch(`${BASE}/api/files/${uploaded.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);

    const meta = await SELF.fetch(`${BASE}/api/files/${uploaded.id}`, {
      headers: { Cookie: cookie },
    });
    expect(meta.status).toBe(404);

    const redeem = await SELF.fetch(shareBody.data.url);
    expect(redeem.status).toBe(404);
  });
});
