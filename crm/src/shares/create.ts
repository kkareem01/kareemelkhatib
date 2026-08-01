/** Mint an expiring share link for a vault file. The raw token appears
 * only in the response URL; D1 stores its sha256. */

import { writeAudit } from "../lib/audit";
import { randomId, randomToken, sha256Hex } from "../lib/crypto";
import { badRequest, json, notFound } from "../lib/http";
import {
  readJsonBody,
  validExpiryPreset,
  validMaxDownloads,
} from "../lib/validate";
import { findLiveFile } from "../files/content";
import type { Ctx } from "../types";

export async function createShare(ctx: Ctx): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");

  const fileId = typeof body.fileId === "string" ? body.fileId : "";
  const file = await findLiveFile(ctx.env, fileId);
  if (file === null) return notFound();

  const expiryMs = validExpiryPreset(body.expiry);
  if (expiryMs === null) return badRequest("Invalid expiry — use 1h, 24h, or 7d.");
  const maxDownloads = validMaxDownloads(body.maxDownloads);
  if (maxDownloads === "invalid") return badRequest("Invalid max downloads.");

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const id = randomId();
  const expiresAt = now + expiryMs;

  await ctx.env.DB.prepare(
    `INSERT INTO shares (id, token_hash, file_id, expires_at, max_downloads, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, tokenHash, file.id, expiresAt, maxDownloads, now)
    .run();

  await writeAudit(ctx.env, ctx.req, "share_create", {
    share: id,
    file: file.id,
    expiresAt,
    maxDownloads,
  });

  return json(
    {
      ok: true,
      data: {
        id,
        url: `${ctx.url.origin}/s/${token}`,
        fileId: file.id,
        fileName: file.name,
        expiresAt,
        maxDownloads,
      },
    },
    201,
  );
}
