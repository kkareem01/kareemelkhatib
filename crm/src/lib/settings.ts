/** Tiny KV over the settings table (single-user account state). */

import type { Env } from "../types";

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row === null ? null : row.value;
}

export async function setSetting(
  env: Env,
  key: string,
  value: string,
  now = Date.now(),
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
  )
    .bind(key, value, now, value, now)
    .run();
}
