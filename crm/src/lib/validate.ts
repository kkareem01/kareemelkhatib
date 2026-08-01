/** Boundary input validation. Every value arriving from a request passes
 * through one of these before touching storage. Each returns a validated
 * value or null — callers turn null into a 400. */

import {
  MAX_FILENAME_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  SHARE_EXPIRY_PRESETS,
} from "../config";

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Display filename: trimmed, no control chars, no path separators used
 * as the whole name, sensible length. (Stored name is display-only — the
 * R2 key is always a server-generated uuid.) */
export function validFileName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_FILENAME_LENGTH) return null;
  if (CONTROL_CHARS.test(name)) return null;
  if (name === "." || name === "..") return null;
  return name;
}

export function validTags(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_TAGS) return null;
  const out: string[] = [];
  for (const tag of raw) {
    if (typeof tag !== "string") return null;
    const t = tag.trim().toLowerCase();
    if (t.length === 0 || t.length > MAX_TAG_LENGTH) return null;
    if (!/^[a-z0-9][a-z0-9 _-]*$/.test(t)) return null;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Link URLs: http(s) only — blocks javascript:, data:, file: etc. */
export function validHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

export function validTitle(raw: unknown, maxLength = 200): string | null {
  if (typeof raw !== "string") return null;
  const title = raw.trim();
  if (title.length === 0 || title.length > maxLength) return null;
  if (CONTROL_CHARS.test(title)) return null;
  return title;
}

/** Single emoji-ish icon (grapheme length is hard; cap code units). */
export function validIcon(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 8) return null;
  if (CONTROL_CHARS.test(raw)) return null;
  return raw;
}

export function validExpiryPreset(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const ms = SHARE_EXPIRY_PRESETS[raw];
  return ms ?? null;
}

export function validMaxDownloads(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === undefined) return null; // unlimited
  if (typeof raw !== "number" || !Number.isInteger(raw)) return "invalid";
  if (raw < 1 || raw > 1000) return "invalid";
  return raw;
}

export function validText(raw: unknown, maxBytes: number): string | null {
  if (typeof raw !== "string") return null;
  if (new TextEncoder().encode(raw).length > maxBytes) return null;
  return raw;
}

export function validUuid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return null;
  }
  return raw.toLowerCase();
}

/** Parse a JSON body with a size cap; returns null on any failure. */
export async function readJsonBody(
  req: Request,
  maxBytes = 1024 * 1024,
): Promise<Record<string, unknown> | null> {
  const lengthHeader = req.headers.get("Content-Length");
  if (lengthHeader !== null && Number(lengthHeader) > maxBytes) return null;
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
