import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuthConfig, SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from "../src/config";
import { createSession, destroySession, getSession } from "../src/lib/session";

const URL_DEV = new URL("http://localhost/");
const cfg = getAuthConfig(env, URL_DEV);

function reqWithCookie(cookie: string): Request {
  return new Request("http://localhost/api/auth/me", {
    headers: { Cookie: cookie },
  });
}

describe("session lifecycle", () => {
  it("creates a session and validates its cookie", async () => {
    const now = Date.now();
    const created = await createSession(env, new Request("http://localhost/"), cfg, now);
    expect(created.cookie).toContain("session=");
    expect(created.cookie).toContain("HttpOnly");
    expect(created.cookie).toContain("SameSite=Strict");

    const session = await getSession(env, reqWithCookie(`session=${created.token}`), cfg, now);
    expect(session).not.toBeNull();
  });

  it("rejects a garbage token and a missing cookie", async () => {
    expect(await getSession(env, reqWithCookie("session=nope"), cfg)).toBeNull();
    expect(await getSession(env, new Request("http://localhost/"), cfg)).toBeNull();
  });

  it("expires after the idle TTL and deletes the row", async () => {
    const now = Date.now();
    const created = await createSession(env, new Request("http://localhost/"), cfg, now);
    const later = now + SESSION_IDLE_TTL_MS + 1000;
    expect(
      await getSession(env, reqWithCookie(`session=${created.token}`), cfg, later),
    ).toBeNull();
    // second lookup also null (row deleted, not just filtered)
    expect(
      await getSession(env, reqWithCookie(`session=${created.token}`), cfg, now),
    ).toBeNull();
  });

  it("slides expiry on activity but never past the absolute cap", async () => {
    const now = Date.now();
    const created = await createSession(env, new Request("http://localhost/"), cfg, now);
    const req = reqWithCookie(`session=${created.token}`);

    // Regular activity keeps sliding the 7-day idle window…
    const day = 24 * 60 * 60 * 1000;
    for (const d of [6, 12, 18, 24]) {
      expect(await getSession(env, req, cfg, now + d * day), `day ${d}`).not.toBeNull();
    }
    // …day-24 touch caps expiry at the absolute limit (day 30), so day 29
    // still works but nothing survives past the cap.
    expect(await getSession(env, req, cfg, now + 29 * day)).not.toBeNull();
    const past = now + SESSION_ABSOLUTE_TTL_MS + 60 * 60 * 1000;
    expect(await getSession(env, req, cfg, past)).toBeNull();
  });

  it("destroySession deletes the row and returns a clearing cookie", async () => {
    const now = Date.now();
    const created = await createSession(env, new Request("http://localhost/"), cfg, now);
    const req = reqWithCookie(`session=${created.token}`);
    const clear = await destroySession(env, req, cfg);
    expect(clear).toContain("Max-Age=0");
    expect(await getSession(env, req, cfg, now)).toBeNull();
  });
});
