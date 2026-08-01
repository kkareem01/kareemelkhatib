import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { cleanup } from "../src/jobs/cleanup";
import { AUDIT_RETENTION_MS, SOFT_DELETE_PURGE_MS } from "../src/config";

describe("health + headers", () => {
  it("health endpoint responds with security headers", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("unknown API paths 404 as JSON without internals", async () => {
    const res = await SELF.fetch("http://localhost/api/definitely-not-real");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not_found");
  });
});

describe("cleanup cron", () => {
  it("purges expired sessions, challenges, shares, old audit rows, and old soft-deleted files", async () => {
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO sessions (token_hash, created_at, last_seen_at, expires_at)
       VALUES ('dead', 0, 0, 1), ('alive', ?, ?, ?)`,
    )
      .bind(now, now, now + 100_000)
      .run();
    await env.DB.prepare(
      `INSERT INTO challenges (id, type, challenge, expires_at)
       VALUES ('dead', 'registration', 'x', 1), ('alive', 'registration', 'y', ?)`,
    )
      .bind(now + 100_000)
      .run();
    await env.DB.prepare(
      `INSERT INTO audit_log (ts, event) VALUES (?, 'old'), (?, 'recent')`,
    )
      .bind(now - AUDIT_RETENTION_MS - 1000, now)
      .run();

    // Soft-deleted file past the purge window, with an R2 object.
    await env.VAULT.put("files/purge-me", "bytes");
    await env.DB.prepare(
      `INSERT INTO files (id, r2_key, name, mime, size, tags, created_at, updated_at, deleted_at)
       VALUES ('purge-me', 'files/purge-me', 'old.txt', 'text/plain', 5, '[]', 0, 0, ?)`,
    )
      .bind(now - SOFT_DELETE_PURGE_MS - 1000)
      .run();

    await cleanup(env, now);

    const sessions = await env.DB.prepare("SELECT token_hash FROM sessions").all();
    expect(sessions.results.map((r) => r.token_hash)).toEqual(["alive"]);

    const challenges = await env.DB.prepare("SELECT id FROM challenges").all();
    expect(challenges.results.map((r) => r.id)).toEqual(["alive"]);

    const audit = await env.DB.prepare("SELECT event FROM audit_log").all();
    expect(audit.results.map((r) => r.event)).toEqual(["recent"]);

    const files = await env.DB.prepare(
      "SELECT id FROM files WHERE id = 'purge-me'",
    ).all();
    expect(files.results.length).toBe(0);
    expect(await env.VAULT.get("files/purge-me")).toBeNull();
  });
});
