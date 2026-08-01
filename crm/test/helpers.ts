import { env } from "cloudflare:test";
import { randomToken, sha256Hex } from "../src/lib/crypto";

export const BASE = "http://localhost";

/** Insert a valid session row directly and return the Cookie header value.
 * (DEV=1 in tests, so the cookie name is plain "session".) */
export async function createTestSession(now = Date.now()): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, created_at, last_seen_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, 'test', 'vitest')`,
  )
    .bind(tokenHash, now, now, now + 7 * 24 * 60 * 60 * 1000)
    .run();
  return `session=${token}`;
}

export function jsonInit(
  method: string,
  body: unknown,
  cookie?: string,
): RequestInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie !== undefined) headers.Cookie = cookie;
  return { method, headers, body: JSON.stringify(body) };
}

export async function uploadTestFile(
  cookie: string,
  name = "hello.txt",
  content = "hello world",
  mime = "text/plain",
): Promise<{ id: string; name: string }> {
  const { SELF } = await import("cloudflare:test");
  const res = await SELF.fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "X-File-Name": name,
      "Content-Type": mime,
    },
    body: content,
  });
  if (res.status !== 201) {
    throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data: { id: string; name: string } };
  return body.data;
}
