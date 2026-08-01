/** D1 accessors for registered passkeys. */

import type { CredentialRecord, Env } from "../types";

/** D1 may surface BLOBs as ArrayBuffer or number[]; normalize to a
 * Uint8Array backed by a plain ArrayBuffer (simplewebauthn requires it). */
export function blobToUint8(value: unknown): Uint8Array<ArrayBuffer> {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Uint8Array || Array.isArray(value)) {
    const copy = new Uint8Array(value.length);
    copy.set(value);
    return copy;
  }
  throw new Error("unexpected blob representation");
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function listCredentials(env: Env): Promise<CredentialRecord[]> {
  const rows = await env.DB.prepare(
    "SELECT * FROM credentials ORDER BY created_at ASC",
  ).all<CredentialRecord>();
  return rows.results;
}

export async function getCredential(
  env: Env,
  id: string,
): Promise<CredentialRecord | null> {
  return env.DB.prepare("SELECT * FROM credentials WHERE id = ?")
    .bind(id)
    .first<CredentialRecord>();
}

export async function insertCredential(
  env: Env,
  input: {
    readonly id: string;
    readonly publicKey: Uint8Array;
    readonly counter: number;
    readonly transports: readonly string[] | undefined;
    readonly label: string;
  },
  now = Date.now(),
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO credentials (id, public_key, counter, transports, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      toArrayBuffer(input.publicKey),
      input.counter,
      input.transports === undefined ? null : JSON.stringify(input.transports),
      input.label,
      now,
    )
    .run();
}

export async function updateCounter(
  env: Env,
  id: string,
  counter: number,
  now = Date.now(),
): Promise<void> {
  await env.DB.prepare(
    "UPDATE credentials SET counter = ?, last_used_at = ? WHERE id = ?",
  )
    .bind(counter, now, id)
    .run();
}

export async function countCredentials(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM credentials",
  ).first<{ n: number }>();
  return row === null ? 0 : row.n;
}

export async function deleteCredential(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM credentials WHERE id = ?")
    .bind(id)
    .run();
  return result.meta.changes > 0;
}

export function parseTransports(
  record: CredentialRecord,
): string[] | undefined {
  if (record.transports === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(record.transports);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
