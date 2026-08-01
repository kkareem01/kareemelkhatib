import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BASE, createTestSession, jsonInit } from "./helpers";

describe("quick links", () => {
  it("creates, lists, updates, deletes", async () => {
    const cookie = await createTestSession();
    const created = await SELF.fetch(
      `${BASE}/api/links`,
      jsonInit("POST", { title: "Bank", url: "https://bank.example.com", icon: "🏦" }, cookie),
    );
    expect(created.status).toBe(201);
    const link = ((await created.json()) as { data: { id: string } }).data;

    const list = await SELF.fetch(`${BASE}/api/links`, { headers: { Cookie: cookie } });
    const listBody = (await list.json()) as { data: Array<{ id: string; title: string }> };
    expect(listBody.data.some((l) => l.id === link.id)).toBe(true);

    const updated = await SELF.fetch(
      `${BASE}/api/links/${link.id}`,
      jsonInit("PATCH", { title: "My Bank", position: 5 }, cookie),
    );
    expect(updated.status).toBe(200);

    const del = await SELF.fetch(`${BASE}/api/links/${link.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);

    const gone = await SELF.fetch(
      `${BASE}/api/links/${link.id}`,
      jsonInit("PATCH", { title: "X" }, cookie),
    );
    expect(gone.status).toBe(404);
  });

  it("rejects dangerous URLs", async () => {
    const cookie = await createTestSession();
    const res = await SELF.fetch(
      `${BASE}/api/links`,
      jsonInit("POST", { title: "XSS", url: "javascript:alert(1)" }, cookie),
    );
    expect(res.status).toBe(400);
  });
});

describe("notes", () => {
  it("full CRUD", async () => {
    const cookie = await createTestSession();
    const created = await SELF.fetch(
      `${BASE}/api/notes`,
      jsonInit("POST", { title: "Ideas", body: "# heading\ntext" }, cookie),
    );
    expect(created.status).toBe(201);
    const note = ((await created.json()) as { data: { id: string } }).data;

    const got = await SELF.fetch(`${BASE}/api/notes/${note.id}`, {
      headers: { Cookie: cookie },
    });
    expect(got.status).toBe(200);
    expect(((await got.json()) as { data: { body: string } }).data.body).toContain("heading");

    const updated = await SELF.fetch(
      `${BASE}/api/notes/${note.id}`,
      jsonInit("PUT", { body: "revised" }, cookie),
    );
    expect(updated.status).toBe(200);

    const del = await SELF.fetch(`${BASE}/api/notes/${note.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);
    const gone = await SELF.fetch(`${BASE}/api/notes/${note.id}`, {
      headers: { Cookie: cookie },
    });
    expect(gone.status).toBe(404);
  });
});

describe("clipboard sync", () => {
  it("polling with rev returns unchanged flag", async () => {
    const cookie = await createTestSession();
    const first = await SELF.fetch(`${BASE}/api/clipboard`, {
      headers: { Cookie: cookie },
    });
    const firstBody = (await first.json()) as { data: { rev: number } };
    const rev = firstBody.data.rev;

    const poll = await SELF.fetch(`${BASE}/api/clipboard?since=${rev}`, {
      headers: { Cookie: cookie },
    });
    const pollBody = (await poll.json()) as { data: { unchanged?: boolean } };
    expect(pollBody.data.unchanged).toBe(true);
  });

  it("save bumps rev; stale base rev conflicts with current content", async () => {
    const cookie = await createTestSession();
    const state = await SELF.fetch(`${BASE}/api/clipboard`, {
      headers: { Cookie: cookie },
    });
    const rev = ((await state.json()) as { data: { rev: number } }).data.rev;

    const save = await SELF.fetch(
      `${BASE}/api/clipboard`,
      jsonInit("PUT", { content: "from phone", rev }, cookie),
    );
    expect(save.status).toBe(200);
    const saved = (await save.json()) as { data: { rev: number } };
    expect(saved.data.rev).toBe(rev + 1);

    const conflict = await SELF.fetch(
      `${BASE}/api/clipboard`,
      jsonInit("PUT", { content: "from laptop", rev }, cookie),
    );
    expect(conflict.status).toBe(409);
    const conflictBody = (await conflict.json()) as {
      data: { content: string; rev: number };
    };
    expect(conflictBody.data.content).toBe("from phone");
    expect(conflictBody.data.rev).toBe(rev + 1);
  });
});
