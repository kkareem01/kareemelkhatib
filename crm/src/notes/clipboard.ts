/** Single synced scratchpad row with optimistic concurrency via rev. */

import { MAX_CLIPBOARD_BYTES } from "../config";
import { apiError, badRequest, json } from "../lib/http";
import { readJsonBody, validText } from "../lib/validate";
import type { Ctx } from "../types";

interface ClipboardRow {
  readonly content: string;
  readonly rev: number;
  readonly updated_at: number;
}

export async function getClipboard(ctx: Ctx): Promise<Response> {
  const row = await ctx.env.DB.prepare(
    "SELECT content, rev, updated_at FROM clipboard WHERE id = 1",
  ).first<ClipboardRow>();
  if (row === null) return apiError("server_error", "Clipboard missing.", 500);

  const sinceRaw = ctx.url.searchParams.get("since");
  if (sinceRaw !== null && Number(sinceRaw) === row.rev) {
    return json({ ok: true, data: { unchanged: true, rev: row.rev } });
  }
  return json({
    ok: true,
    data: { content: row.content, rev: row.rev, updatedAt: row.updated_at },
  });
}

export async function putClipboard(ctx: Ctx): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const content = validText(body.content, MAX_CLIPBOARD_BYTES);
  if (content === null) return badRequest("Clipboard content too large.");
  const baseRev =
    typeof body.rev === "number" && Number.isInteger(body.rev) ? body.rev : null;
  if (baseRev === null) return badRequest("Missing base rev.");

  const now = Date.now();
  const result = await ctx.env.DB.prepare(
    "UPDATE clipboard SET content = ?, rev = rev + 1, updated_at = ? WHERE id = 1 AND rev = ?",
  )
    .bind(content, now, baseRev)
    .run();

  if (result.meta.changes === 0) {
    const current = await ctx.env.DB.prepare(
      "SELECT content, rev, updated_at FROM clipboard WHERE id = 1",
    ).first<ClipboardRow>();
    return json(
      {
        ok: false,
        error: { code: "conflict", message: "Clipboard changed on another device." },
        data:
          current === null
            ? null
            : { content: current.content, rev: current.rev, updatedAt: current.updated_at },
      },
      409,
    );
  }
  return json({ ok: true, data: { rev: baseRev + 1, updatedAt: now } });
}
