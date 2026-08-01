/** Nightly cron: D1 has no TTLs, so expired rows are purged here.
 * Soft-deleted files older than 30 days also get their R2 objects removed. */

import { AUDIT_RETENTION_MS, SOFT_DELETE_PURGE_MS } from "../config";
import type { Env, FileRecord } from "../types";

export async function cleanup(env: Env, now = Date.now()): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare("DELETE FROM challenges WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare(
    "DELETE FROM shares WHERE expires_at <= ? OR revoked_at IS NOT NULL",
  )
    .bind(now)
    .run();
  await env.DB.prepare("DELETE FROM audit_log WHERE ts <= ?")
    .bind(now - AUDIT_RETENTION_MS)
    .run();
  await env.DB.prepare("DELETE FROM rate_limits WHERE window_start <= ?")
    .bind(now - 24 * 60 * 60 * 1000)
    .run();

  const cutoff = now - SOFT_DELETE_PURGE_MS;
  const purgeable = await env.DB.prepare(
    "SELECT id, r2_key FROM files WHERE deleted_at IS NOT NULL AND deleted_at <= ?",
  )
    .bind(cutoff)
    .all<Pick<FileRecord, "id" | "r2_key">>();

  for (const file of purgeable.results) {
    await env.VAULT.delete(file.r2_key);
    await env.DB.prepare("DELETE FROM shares WHERE file_id = ?").bind(file.id).run();
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(file.id).run();
  }
}
