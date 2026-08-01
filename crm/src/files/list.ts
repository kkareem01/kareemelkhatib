/** Vault listing with name search + tag filter + cursor pagination. */

import { badRequest, json } from "../lib/http";
import type { Ctx, FileRecord } from "../types";
import { fileToDto } from "./dto";

const PAGE_SIZE = 50;

export async function listFiles(ctx: Ctx): Promise<Response> {
  const q = ctx.url.searchParams.get("q");
  const tag = ctx.url.searchParams.get("tag");
  const cursorRaw = ctx.url.searchParams.get("cursor");

  const cursor = cursorRaw === null ? null : Number(cursorRaw);
  if (cursor !== null && (!Number.isFinite(cursor) || cursor < 0)) {
    return badRequest("Invalid cursor.");
  }
  if (q !== null && q.length > 200) return badRequest("Search too long.");
  if (tag !== null && tag.length > 64) return badRequest("Invalid tag.");

  const conditions: string[] = ["deleted_at IS NULL"];
  const bindings: (string | number)[] = [];
  if (q !== null && q.length > 0) {
    conditions.push("name LIKE ? ESCAPE '\\'");
    bindings.push(`%${escapeLike(q)}%`);
  }
  if (tag !== null && tag.length > 0) {
    // tags is a JSON array of lowercase strings.
    conditions.push("EXISTS (SELECT 1 FROM json_each(files.tags) WHERE json_each.value = ?)");
    bindings.push(tag.toLowerCase());
  }
  if (cursor !== null) {
    conditions.push("created_at < ?");
    bindings.push(cursor);
  }

  const rows = await ctx.env.DB.prepare(
    `SELECT * FROM files WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC LIMIT ${PAGE_SIZE + 1}`,
  )
    .bind(...bindings)
    .all<FileRecord>();

  const page = rows.results.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor =
    rows.results.length > PAGE_SIZE && last !== undefined ? last.created_at : null;

  return json({
    ok: true,
    data: { files: page.map(fileToDto), nextCursor },
  });
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
