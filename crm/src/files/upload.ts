/** Upload: raw request body streamed straight to R2 (no buffering), then
 * a metadata row in D1. The R2 key is always a server uuid — the user
 * filename is display-only. */

import { MAX_UPLOAD_BYTES } from "../config";
import { writeAudit } from "../lib/audit";
import { apiError, badRequest, json, serverError } from "../lib/http";
import { randomId } from "../lib/crypto";
import { validFileName } from "../lib/validate";
import type { Ctx } from "../types";
import { fileToDto } from "./dto";

export async function uploadFile(ctx: Ctx): Promise<Response> {
  const name = validFileName(ctx.req.headers.get("X-File-Name"));
  if (name === null) return badRequest("Missing or invalid X-File-Name header.");

  // Early reject on declared size; the authoritative check is object.size
  // after the R2 put (some clients stream without Content-Length).
  const lengthHeader = ctx.req.headers.get("Content-Length");
  if (lengthHeader !== null && Number(lengthHeader) > MAX_UPLOAD_BYTES) {
    return apiError("too_large", "File exceeds the 95MB limit.", 413);
  }
  if (ctx.req.body === null) return badRequest("Empty body.");

  const mime = sanitizeMime(ctx.req.headers.get("Content-Type"));
  const id = randomId();
  const r2Key = `files/${id}`;

  let object: R2Object | null = null;
  try {
    object = await ctx.env.VAULT.put(r2Key, ctx.req.body, {
      httpMetadata: { contentType: mime },
    });
  } catch (err) {
    console.error("R2 put failed", err);
    return serverError();
  }
  if (object === null) return serverError();

  if (object.size > MAX_UPLOAD_BYTES) {
    await ctx.env.VAULT.delete(r2Key);
    return apiError("too_large", "File exceeds the 95MB limit.", 413);
  }

  const now = Date.now();
  const sha256 = object.checksums.sha256 !== undefined
    ? hex(object.checksums.sha256)
    : null;
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO files (id, r2_key, name, mime, size, sha256, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
    )
      .bind(id, r2Key, name, mime, object.size, sha256, now, now)
      .run();
  } catch (err) {
    console.error("file insert failed", err);
    await ctx.env.VAULT.delete(r2Key);
    return serverError();
  }

  await writeAudit(ctx.env, ctx.req, "upload", { id, name, size: object.size });
  return json(
    {
      ok: true,
      data: fileToDto({
        id,
        r2_key: r2Key,
        name,
        mime,
        size: object.size,
        sha256,
        tags: "[]",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }),
    },
    201,
  );
}

function sanitizeMime(raw: string | null): string {
  if (raw === null) return "application/octet-stream";
  const mime = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime)) {
    return "application/octet-stream";
  }
  return mime;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
