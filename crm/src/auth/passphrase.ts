/** Fallback passphrase login (PBKDF2) + owner-set passphrase config. */

import { RATE_LIMITS, getAuthConfig } from "../config";
import { writeAudit } from "../lib/audit";
import {
  hashPassphrase,
  verifyPassphrase,
  type PassphraseHash,
} from "../lib/crypto";
import { apiError, badRequest, clientIp, json, tooManyRequests } from "../lib/http";
import { checkRateLimit } from "../lib/rate-limit";
import { createSession } from "../lib/session";
import { getSetting, setSetting } from "../lib/settings";
import { readJsonBody } from "../lib/validate";
import type { Ctx } from "../types";

const MIN_PASSPHRASE_LENGTH = 12;

export async function passphraseLogin(ctx: Ctx): Promise<Response> {
  const ip = clientIp(ctx.req);
  const [ipAllowed, globalAllowed] = await Promise.all([
    checkRateLimit(ctx.env, "passphrase", ip, RATE_LIMITS.passphrase),
    checkRateLimit(ctx.env, "passphrase", "global", RATE_LIMITS.passphrase_global),
  ]);
  if (!ipAllowed || !globalAllowed) return tooManyRequests();

  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const passphrase = typeof body.passphrase === "string" ? body.passphrase : null;
  if (passphrase === null || passphrase.length === 0) {
    return badRequest("Missing passphrase.");
  }

  const stored = await loadPassphraseHash(ctx.env);
  if (stored === null) {
    await writeAudit(ctx.env, ctx.req, "passphrase_fail", { reason: "not_configured" });
    return apiError("login_failed", "Sign-in failed.", 401);
  }

  const valid = await verifyPassphrase(passphrase, stored);
  if (!valid) {
    await writeAudit(ctx.env, ctx.req, "passphrase_fail", { reason: "mismatch" });
    return apiError("login_failed", "Sign-in failed.", 401);
  }

  await writeAudit(ctx.env, ctx.req, "passphrase_ok");
  const cfg = getAuthConfig(ctx.env, ctx.url);
  const session = await createSession(ctx.env, ctx.req, cfg);
  return json({ ok: true, data: { authenticated: true } }, 200, {
    "Set-Cookie": session.cookie,
  });
}

/** Session-gated: set or rotate the fallback passphrase. */
export async function configurePassphrase(ctx: Ctx): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const passphrase = typeof body.passphrase === "string" ? body.passphrase : null;
  if (passphrase === null || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return badRequest(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    );
  }
  const hashed = await hashPassphrase(passphrase);
  await setSetting(ctx.env, "passphrase", JSON.stringify(hashed));
  return json({ ok: true, data: { configured: true } });
}

async function loadPassphraseHash(
  env: Ctx["env"],
): Promise<PassphraseHash | null> {
  const raw = await getSetting(env, "passphrase");
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "params" in parsed &&
      "hashB64" in parsed
    ) {
      return parsed as PassphraseHash;
    }
    return null;
  } catch {
    return null;
  }
}
