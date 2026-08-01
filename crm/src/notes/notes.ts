/** Markdown notes CRUD. */

import { MAX_NOTE_BYTES } from "../config";
import { randomId } from "../lib/crypto";
import { badRequest, json, notFound } from "../lib/http";
import { readJsonBody, validText, validTitle } from "../lib/validate";
import type { Ctx, NoteRecord } from "../types";

function noteToDto(record: NoteRecord) {
  return {
    id: record.id,
    title: record.title,
    body: record.body_md,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function listNotes(ctx: Ctx): Promise<Response> {
  const rows = await ctx.env.DB.prepare(
    "SELECT * FROM notes ORDER BY updated_at DESC",
  ).all<NoteRecord>();
  return json({ ok: true, data: rows.results.map(noteToDto) });
}

export async function createNote(ctx: Ctx): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const title = body.title === undefined ? "" : (validTitle(body.title) ?? "");
  const text = validText(body.body ?? "", MAX_NOTE_BYTES);
  if (text === null) return badRequest("Note too large.");

  const now = Date.now();
  const record: NoteRecord = {
    id: randomId(),
    title,
    body_md: text,
    created_at: now,
    updated_at: now,
  };
  await ctx.env.DB.prepare(
    "INSERT INTO notes (id, title, body_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(record.id, record.title, record.body_md, now, now)
    .run();
  return json({ ok: true, data: noteToDto(record) }, 201);
}

export async function getNote(ctx: Ctx): Promise<Response> {
  const note = await findNote(ctx);
  if (note === null) return notFound();
  return json({ ok: true, data: noteToDto(note) });
}

export async function updateNote(ctx: Ctx): Promise<Response> {
  const note = await findNote(ctx);
  if (note === null) return notFound();

  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");

  let { title, body_md } = note;
  if (body.title !== undefined) {
    title = validTitle(body.title) ?? "";
  }
  if (body.body !== undefined) {
    const text = validText(body.body, MAX_NOTE_BYTES);
    if (text === null) return badRequest("Note too large.");
    body_md = text;
  }

  const now = Date.now();
  await ctx.env.DB.prepare(
    "UPDATE notes SET title = ?, body_md = ?, updated_at = ? WHERE id = ?",
  )
    .bind(title, body_md, now, note.id)
    .run();
  return json({ ok: true, data: noteToDto({ ...note, title, body_md, updated_at: now }) });
}

export async function deleteNote(ctx: Ctx): Promise<Response> {
  const id = ctx.params.id ?? "";
  const result = await ctx.env.DB.prepare("DELETE FROM notes WHERE id = ?")
    .bind(id)
    .run();
  if (result.meta.changes === 0) return notFound();
  return json({ ok: true, data: { deleted: true } });
}

async function findNote(ctx: Ctx): Promise<NoteRecord | null> {
  const id = ctx.params.id ?? "";
  if (id.length === 0 || id.length > 64) return null;
  return ctx.env.DB.prepare("SELECT * FROM notes WHERE id = ?")
    .bind(id)
    .first<NoteRecord>();
}
