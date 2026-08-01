/** Single-use, short-lived WebAuthn challenges stored in D1. */

import { CHALLENGE_TTL_MS } from "../config";
import { randomId } from "../lib/crypto";
import type { Env } from "../types";

export type ChallengeType = "registration" | "authentication";

export async function storeChallenge(
  env: Env,
  type: ChallengeType,
  challenge: string,
  now = Date.now(),
): Promise<string> {
  const id = randomId();
  await env.DB.prepare(
    "INSERT INTO challenges (id, type, challenge, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, type, challenge, now + CHALLENGE_TTL_MS)
    .run();
  return id;
}

/** Fetch-and-delete: a challenge can never be redeemed twice. Returns
 * null when missing, wrong type, or expired. */
export async function consumeChallenge(
  env: Env,
  id: string,
  type: ChallengeType,
  now = Date.now(),
): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT challenge, type, expires_at FROM challenges WHERE id = ?",
  )
    .bind(id)
    .first<{ challenge: string; type: string; expires_at: number }>();
  if (row === null) return null;
  await env.DB.prepare("DELETE FROM challenges WHERE id = ?").bind(id).run();
  if (row.type !== type || row.expires_at <= now) return null;
  return row.challenge;
}
