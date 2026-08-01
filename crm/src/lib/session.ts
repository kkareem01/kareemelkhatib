/** Session lifecycle: 256-bit token in an HttpOnly cookie, only its
 * sha256 stored in D1. Sliding idle expiry with an absolute cap. */

import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
  type AuthConfig,
} from "../config";
import type { Env, SessionRecord } from "../types";
import { randomToken, sha256Hex } from "./crypto";
import { clientIp } from "./http";

export interface NewSession {
  readonly token: string;
  readonly cookie: string;
}

export async function createSession(
  env: Env,
  req: Request,
  cfg: AuthConfig,
  now = Date.now(),
): Promise<NewSession> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = Math.min(now + SESSION_IDLE_TTL_MS, now + SESSION_ABSOLUTE_TTL_MS);
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, created_at, last_seen_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      tokenHash,
      now,
      now,
      expiresAt,
      clientIp(req),
      req.headers.get("User-Agent") ?? null,
    )
    .run();
  return { token, cookie: buildCookie(cfg, token, SESSION_ABSOLUTE_TTL_MS) };
}

/** Returns the session if the request carries a valid, unexpired cookie;
 * touches last_seen (throttled) to implement sliding expiry. */
export async function getSession(
  env: Env,
  req: Request,
  cfg: AuthConfig,
  now = Date.now(),
): Promise<SessionRecord | null> {
  const token = readCookie(req, cfg.cookieName);
  if (token === null) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT * FROM sessions WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<SessionRecord>();
  if (row === null) return null;
  if (row.expires_at <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
    return null;
  }
  if (now - row.last_seen_at >= SESSION_TOUCH_INTERVAL_MS) {
    const slid = Math.min(
      now + SESSION_IDLE_TTL_MS,
      row.created_at + SESSION_ABSOLUTE_TTL_MS,
    );
    await env.DB.prepare(
      "UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?",
    )
      .bind(now, slid, tokenHash)
      .run();
  }
  return row;
}

export async function destroySession(
  env: Env,
  req: Request,
  cfg: AuthConfig,
): Promise<string> {
  const token = readCookie(req, cfg.cookieName);
  if (token !== null) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }
  return buildCookie(cfg, "", 0); // expired cookie clears it
}

function buildCookie(cfg: AuthConfig, value: string, maxAgeMs: number): string {
  const base = `${cfg.cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
  // __Host- prefix requires Secure (and HTTPS); dev runs on http://localhost.
  return cfg.dev ? base : `${base}; Secure`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie");
  if (header === null) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
