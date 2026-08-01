/** Public share redemption. Invalid, expired, revoked, and exhausted all
 * return an identical 404 page — the endpoint is not an oracle. */

import { RATE_LIMITS } from "../config";
import { writeAudit } from "../lib/audit";
import { sha256Hex } from "../lib/crypto";
import { clientIp, shareNotFoundPage, tooManyRequests } from "../lib/http";
import { checkRateLimit } from "../lib/rate-limit";
import { buildFileResponse } from "../files/content";
import type { Ctx, FileRecord, ShareRecord } from "../types";

export async function redeemShare(ctx: Ctx): Promise<Response> {
  const allowed = await checkRateLimit(
    ctx.env,
    "share_redeem",
    clientIp(ctx.req),
    RATE_LIMITS.share_redeem,
  );
  if (!allowed) return tooManyRequests();

  const token = ctx.params.token ?? "";
  if (token.length < 40 || token.length > 50) return shareNotFoundPage();

  const tokenHash = await sha256Hex(token);
  const share = await ctx.env.DB.prepare(
    "SELECT * FROM shares WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first<ShareRecord>();

  const now = Date.now();
  if (
    share === null ||
    share.revoked_at !== null ||
    share.expires_at <= now
  ) {
    return shareNotFoundPage();
  }

  // Atomic count increment — cannot race past max_downloads.
  const claim = await ctx.env.DB.prepare(
    `UPDATE shares SET download_count = download_count + 1
     WHERE id = ? AND revoked_at IS NULL AND expires_at > ?
       AND (max_downloads IS NULL OR download_count < max_downloads)`,
  )
    .bind(share.id, now)
    .run();
  if (claim.meta.changes === 0) return shareNotFoundPage();

  const file = await ctx.env.DB.prepare(
    "SELECT * FROM files WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(share.file_id)
    .first<FileRecord>();
  if (file === null) return shareNotFoundPage();

  const object = await ctx.env.VAULT.get(file.r2_key);
  if (object === null) return shareNotFoundPage();

  await writeAudit(ctx.env, ctx.req, "share_redeem", {
    share: share.id,
    file: file.id,
  });
  return buildFileResponse(file, object, true);
}
