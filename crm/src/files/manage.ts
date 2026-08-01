/** Rename, retag, soft-delete. */

import { writeAudit } from "../lib/audit";
import { badRequest, json, notFound } from "../lib/http";
import { readJsonBody, validFileName, validTags } from "../lib/validate";
import type { Ctx } from "../types";
import { fileToDto } from "./dto";
import { findLiveFile } from "./content";

export async function updateFile(ctx: Ctx): Promise<Response> {
  const record = await findLiveFile(ctx.env, ctx.params.id);
  if (record === null) return notFound();

  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");

  let name = record.name;
  if (body.name !== undefined) {
    const valid = validFileName(body.name);
    if (valid === null) return badRequest("Invalid file name.");
    name = valid;
  }

  let tagsJson = record.tags;
  if (body.tags !== undefined) {
    const valid = validTags(body.tags);
    if (valid === null) return badRequest("Invalid tags.");
    tagsJson = JSON.stringify(valid);
  }

  const now = Date.now();
  await ctx.env.DB.prepare(
    "UPDATE files SET name = ?, tags = ?, updated_at = ? WHERE id = ?",
  )
    .bind(name, tagsJson, now, record.id)
    .run();

  return json({
    ok: true,
    data: fileToDto({ ...record, name, tags: tagsJson, updated_at: now }),
  });
}

/** Soft delete: row survives 30 days (cron purges R2 + row later); any
 * active shares for the file are revoked immediately. */
export async function deleteFile(ctx: Ctx): Promise<Response> {
  const record = await findLiveFile(ctx.env, ctx.params.id);
  if (record === null) return notFound();

  const now = Date.now();
  await ctx.env.DB.prepare("UPDATE files SET deleted_at = ? WHERE id = ?")
    .bind(now, record.id)
    .run();
  await ctx.env.DB.prepare(
    "UPDATE shares SET revoked_at = ? WHERE file_id = ? AND revoked_at IS NULL",
  )
    .bind(now, record.id)
    .run();

  await writeAudit(ctx.env, ctx.req, "file_delete", {
    id: record.id,
    name: record.name,
  });
  return json({ ok: true, data: { deleted: true } });
}
