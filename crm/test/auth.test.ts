import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { consumeChallenge, storeChallenge } from "../src/auth/challenges";
import { CHALLENGE_TTL_MS } from "../src/config";
import { BASE, createTestSession, jsonInit } from "./helpers";

describe("bootstrap gating", () => {
  beforeEach(async () => {
    // Storage isolation is per-file: earlier tests in this file may have
    // closed the bootstrap gate or consumed the setup rate limit.
    await env.DB.prepare("DELETE FROM settings WHERE key = 'bootstrap_done'").run();
    await env.DB.prepare("DELETE FROM rate_limits WHERE key LIKE 'setup:%'").run();
  });

  it("rejects a missing or wrong setup token", async () => {
    const noToken = await SELF.fetch(`${BASE}/api/setup/options`, { method: "POST" });
    expect(noToken.status).toBe(403);

    const wrong = await SELF.fetch(`${BASE}/api/setup/options`, {
      method: "POST",
      headers: { "X-Setup-Token": "wrong-token" },
    });
    expect(wrong.status).toBe(403);
  });

  it("returns registration options with the correct token, then refuses after bootstrap_done", async () => {
    const ok = await SELF.fetch(`${BASE}/api/setup/options`, {
      method: "POST",
      headers: { "X-Setup-Token": "test-setup-token-for-vitest-only" },
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as {
      data: { options: { challenge: string; rp: { id: string } }; challengeId: string };
    };
    expect(body.data.options.challenge.length).toBeGreaterThan(20);
    expect(body.data.challengeId.length).toBeGreaterThan(10);

    // Simulate completed setup → gate closes even with the right token.
    await env.DB.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('bootstrap_done', '1', 0)",
    ).run();
    const closed = await SELF.fetch(`${BASE}/api/setup/options`, {
      method: "POST",
      headers: { "X-Setup-Token": "test-setup-token-for-vitest-only" },
    });
    expect(closed.status).toBe(403);
  });

  it("rejects garbage attestation on verify", async () => {
    const options = await SELF.fetch(`${BASE}/api/setup/options`, {
      method: "POST",
      headers: { "X-Setup-Token": "test-setup-token-for-vitest-only" },
    });
    const body = (await options.json()) as { data: { challengeId: string } };
    const verify = await SELF.fetch(`${BASE}/api/setup/verify`, {
      method: "POST",
      headers: {
        "X-Setup-Token": "test-setup-token-for-vitest-only",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challengeId: body.data.challengeId,
        label: "Test",
        response: { id: "fake", rawId: "fake", type: "public-key", response: {} },
      }),
    });
    expect(verify.status).toBe(400);
  });
});

describe("challenges", () => {
  it("is single-use", async () => {
    const id = await storeChallenge(env, "authentication", "challenge-value");
    expect(await consumeChallenge(env, id, "authentication")).toBe("challenge-value");
    expect(await consumeChallenge(env, id, "authentication")).toBeNull();
  });

  it("rejects wrong type and expiry", async () => {
    const a = await storeChallenge(env, "registration", "c1");
    expect(await consumeChallenge(env, a, "authentication")).toBeNull();

    const now = Date.now();
    const b = await storeChallenge(env, "registration", "c2", now);
    expect(
      await consumeChallenge(env, b, "registration", now + CHALLENGE_TTL_MS + 1),
    ).toBeNull();
  });
});

describe("passkey login endpoints", () => {
  it("issues authentication options publicly", async () => {
    const res = await SELF.fetch(`${BASE}/api/auth/login/options`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { options: { challenge: string } } };
    expect(body.data.options.challenge.length).toBeGreaterThan(20);
  });

  it("fails cleanly on an unknown credential", async () => {
    const options = await SELF.fetch(`${BASE}/api/auth/login/options`, {
      method: "POST",
    });
    const body = (await options.json()) as { data: { challengeId: string } };
    const res = await SELF.fetch(`${BASE}/api/auth/login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: body.data.challengeId,
        response: { id: "unknown-credential", rawId: "x", type: "public-key", response: {} },
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe("passphrase fallback", () => {
  it("configures via session then logs in; wrong guess fails", async () => {
    const cookie = await createTestSession();
    const config = await SELF.fetch(
      `${BASE}/api/auth/passphrase-config`,
      jsonInit("PUT", { passphrase: "orbit-walnut-ember-quilt-stone" }, cookie),
    );
    expect(config.status).toBe(200);

    const good = await SELF.fetch(
      `${BASE}/api/auth/passphrase`,
      jsonInit("POST", { passphrase: "orbit-walnut-ember-quilt-stone" }),
    );
    expect(good.status).toBe(200);
    expect(good.headers.get("Set-Cookie")).toContain("session=");

    const bad = await SELF.fetch(
      `${BASE}/api/auth/passphrase`,
      jsonInit("POST", { passphrase: "wrong-guess-entirely" }),
    );
    expect(bad.status).toBe(401);
  });

  it("rejects a short passphrase on configure", async () => {
    const cookie = await createTestSession();
    const res = await SELF.fetch(
      `${BASE}/api/auth/passphrase-config`,
      jsonInit("PUT", { passphrase: "short" }, cookie),
    );
    expect(res.status).toBe(400);
  });

  it("rate limits repeated guesses", async () => {
    for (let i = 0; i < 5; i++) {
      await SELF.fetch(
        `${BASE}/api/auth/passphrase`,
        jsonInit("POST", { passphrase: `guess-${i}-is-wrong-here` }),
      );
    }
    const sixth = await SELF.fetch(
      `${BASE}/api/auth/passphrase`,
      jsonInit("POST", { passphrase: "guess-6-is-wrong-here" }),
    );
    expect(sixth.status).toBe(429);
  });
});

describe("session-gated surface", () => {
  it("401s without a cookie on every protected route", async () => {
    const cases: Array<[string, string]> = [
      ["GET", "/api/auth/me"],
      ["GET", "/api/files"],
      ["GET", "/api/links"],
      ["GET", "/api/notes"],
      ["GET", "/api/clipboard"],
      ["GET", "/api/shares"],
      ["GET", "/api/passkeys"],
      ["POST", "/api/files"],
      ["POST", "/api/shares"],
    ];
    for (const [method, path] of cases) {
      const res = await SELF.fetch(`${BASE}${path}`, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("rejects cross-site mutations even with a valid session", async () => {
    const cookie = await createTestSession();
    const res = await SELF.fetch(`${BASE}/api/links`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({ title: "x", url: "https://example.com" }),
    });
    expect(res.status).toBe(403);
  });

  it("me + logout round trip", async () => {
    const cookie = await createTestSession();
    const me = await SELF.fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);

    const out = await SELF.fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(out.status).toBe(200);

    const after = await SELF.fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    expect(after.status).toBe(401);
  });
});
