/** Fixed-window rate limiter backed by D1. Key = "<scope>:<subject>"
 * (subject is usually an IP; "global" for account-wide caps). */

import type { Env } from "../types";

export interface RateLimitRule {
  readonly max: number;
  readonly windowMs: number;
}

/** Returns true when the attempt is allowed (and counts it). */
export async function checkRateLimit(
  env: Env,
  scope: string,
  subject: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<boolean> {
  const key = `${scope}:${subject}`;
  const row = await env.DB.prepare(
    "SELECT window_start, count FROM rate_limits WHERE key = ?",
  )
    .bind(key)
    .first<{ window_start: number; count: number }>();

  if (row === null || now - row.window_start >= rule.windowMs) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = ?, count = 1`,
    )
      .bind(key, now, now)
      .run();
    return rule.max >= 1;
  }

  if (row.count >= rule.max) return false;

  await env.DB.prepare(
    "UPDATE rate_limits SET count = count + 1 WHERE key = ?",
  )
    .bind(key)
    .run();
  return true;
}
