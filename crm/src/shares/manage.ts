/** List active shares + revoke. */

import { writeAudit } from "../lib/audit";
import { badRequest, json, notFound } from "../lib/http";
import type { Ctx, ShareRecord } from "../types";

interface ShareWithFile extends ShareRecord {
  readonly file_name: string;
}

export async function listShares(ctx: Ctx): Promise<Response> {
  const now = Date.now();
  const rows = await ctx.env.DB.prepare(
    `SELECT shares.*, files.name AS file_name
     FROM shares JOIN files ON files.id = shares.file_id
     WHERE shares.revoked_at IS NULL AND shares.expires_at > ?
     ORDER BY shares.created_at DESC`,
  )
    .bind(now)
    .all<ShareWithFile>();

  return json({
    ok: true,
    data: rows.results.map((s) => ({
      id: s.id,
      fileId: s.file_id,
      fileName: s.file_name,
      expiresAt: s.expires_at,
      maxDownloads: s.max_downloads,
      downloadCount: s.download_count,
      createdAt: s.created_at,
    })),
  });
}

export async function revokeShare(ctx: Ctx): Promise<Response> {
  const id = ctx.params.id ?? "";
  if (id.length === 0 || id.length > 64) return badRequest("Invalid share id.");

  const result = await ctx.env.DB.prepare(
    "UPDATE shares SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  )
    .bind(Date.now(), id)
    .run();
  if (result.meta.changes === 0) return notFound();

  await writeAudit(ctx.env, ctx.req, "share_revoke", { share: id });
  return json({ ok: true, data: { revoked: true } });
}
