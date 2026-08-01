/** Quick-access links dashboard: CRUD + reorder. */

import { requireSession } from "../auth/middleware";
import { MAX_LINKS } from "../config";
import { randomId } from "../lib/crypto";
import { apiError, badRequest, json, notFound } from "../lib/http";
import { readJsonBody, validHttpUrl, validIcon, validTitle } from "../lib/validate";
import type { Router } from "../router";
import type { Ctx, LinkRecord } from "../types";

function linkToDto(record: LinkRecord) {
  return {
    id: record.id,
    title: record.title,
    url: record.url,
    icon: record.icon,
    position: record.position,
  };
}

async function listLinks(ctx: Ctx): Promise<Response> {
  const rows = await ctx.env.DB.prepare(
    "SELECT * FROM links ORDER BY position ASC, created_at ASC",
  ).all<LinkRecord>();
  return json({ ok: true, data: rows.results.map(linkToDto) });
}

async function createLink(ctx: Ctx): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const title = validTitle(body.title);
  const url = validHttpUrl(body.url);
  const icon = validIcon(body.icon);
  if (title === null) return badRequest("Invalid title.");
  if (url === null) return badRequest("Invalid URL — must be http(s).");

  const count = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM links").first<{
    n: number;
  }>();
  if (count !== null && count.n >= MAX_LINKS) {
    return apiError("limit_reached", "Link limit reached.", 409);
  }

  const maxPos = await ctx.env.DB.prepare(
    "SELECT COALESCE(MAX(position), -1) AS p FROM links",
  ).first<{ p: number }>();
  const position = (maxPos?.p ?? -1) + 1;

  const record: LinkRecord = {
    id: randomId(),
    title,
    url,
    icon,
    position,
    created_at: Date.now(),
  };
  await ctx.env.DB.prepare(
    "INSERT INTO links (id, title, url, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(record.id, record.title, record.url, record.icon, record.position, record.created_at)
    .run();
  return json({ ok: true, data: linkToDto(record) }, 201);
}

async function updateLink(ctx: Ctx): Promise<Response> {
  const id = ctx.params.id ?? "";
  const existing = await ctx.env.DB.prepare("SELECT * FROM links WHERE id = ?")
    .bind(id)
    .first<LinkRecord>();
  if (existing === null) return notFound();

  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");

  let { title, url, icon, position } = existing;
  if (body.title !== undefined) {
    const v = validTitle(body.title);
    if (v === null) return badRequest("Invalid title.");
    title = v;
  }
  if (body.url !== undefined) {
    const v = validHttpUrl(body.url);
    if (v === null) return badRequest("Invalid URL — must be http(s).");
    url = v;
  }
  if (body.icon !== undefined) {
    icon = validIcon(body.icon);
  }
  if (body.position !== undefined) {
    if (
      typeof body.position !== "number" ||
      !Number.isInteger(body.position) ||
      body.position < 0 ||
      body.position > MAX_LINKS
    ) {
      return badRequest("Invalid position.");
    }
    position = body.position;
  }

  await ctx.env.DB.prepare(
    "UPDATE links SET title = ?, url = ?, icon = ?, position = ? WHERE id = ?",
  )
    .bind(title, url, icon, position, id)
    .run();
  return json({ ok: true, data: linkToDto({ ...existing, title, url, icon, position }) });
}

async function deleteLink(ctx: Ctx): Promise<Response> {
  const id = ctx.params.id ?? "";
  const result = await ctx.env.DB.prepare("DELETE FROM links WHERE id = ?")
    .bind(id)
    .run();
  if (result.meta.changes === 0) return notFound();
  return json({ ok: true, data: { deleted: true } });
}

export function registerLinkRoutes(router: Router): void {
  router.add("GET", "/api/links", requireSession(listLinks));
  router.add("POST", "/api/links", requireSession(createLink));
  router.add("PATCH", "/api/links/:id", requireSession(updateLink));
  router.add("DELETE", "/api/links/:id", requireSession(deleteLink));
}
