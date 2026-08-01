/** Stream file bytes from R2. Inline rendering only for an allowlist of
 * safe types; everything else (SVG, HTML, unknown) is forced to download
 * inside a sandboxed response — blocks stored-XSS via uploads. */

import { json, notFound, withSecurityHeaders } from "../lib/http";
import type { Ctx, Env, FileRecord } from "../types";
import { fileToDto } from "./dto";

const INLINE_SAFE_MIMES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
  "text/plain",
]);

export async function getFileMeta(ctx: Ctx): Promise<Response> {
  const record = await findLiveFile(ctx.env, ctx.params.id);
  if (record === null) return notFound();
  return json({ ok: true, data: fileToDto(record) });
}

export async function getFileContent(ctx: Ctx): Promise<Response> {
  const record = await findLiveFile(ctx.env, ctx.params.id);
  if (record === null) return notFound();

  const object = await ctx.env.VAULT.get(record.r2_key);
  if (object === null) return notFound();

  const wantsInline = ctx.url.searchParams.get("disposition") !== "attachment";
  return buildFileResponse(record, object, wantsInline);
}

/** Shared with share redemption. */
export function buildFileResponse(
  record: Pick<FileRecord, "name" | "mime" | "size">,
  object: R2ObjectBody,
  wantsInline: boolean,
): Response {
  const inlineAllowed = INLINE_SAFE_MIMES.has(record.mime);
  const inline = wantsInline && inlineAllowed;

  const headers = withSecurityHeaders();
  headers.set("Content-Type", inlineAllowed ? record.mime : "application/octet-stream");
  headers.set("Content-Length", String(record.size));
  headers.set(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${asciiFilename(record.name)}"; filename*=UTF-8''${encodeURIComponent(record.name)}`,
  );
  // Downloaded/previewed bytes are user content: no scripts, no frames.
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
  return new Response(object.body, { status: 200, headers });
}

export async function findLiveFile(
  env: Env,
  id: string | undefined,
): Promise<FileRecord | null> {
  if (id === undefined || id.length === 0 || id.length > 64) return null;
  return env.DB.prepare(
    "SELECT * FROM files WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(id)
    .first<FileRecord>();
}

function asciiFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return ascii.length > 0 ? ascii : "download";
}
