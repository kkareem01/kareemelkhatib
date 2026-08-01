/** One-time first-passkey registration, gated by the SETUP_TOKEN worker
 * secret. Refused forever once settings.bootstrap_done exists. */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { RATE_LIMITS, RP_NAME, getAuthConfig } from "../config";
import { safeEqual } from "../lib/crypto";
import { writeAudit } from "../lib/audit";
import { apiError, badRequest, clientIp, json, tooManyRequests } from "../lib/http";
import { checkRateLimit } from "../lib/rate-limit";
import { createSession } from "../lib/session";
import { getSetting, setSetting } from "../lib/settings";
import { readJsonBody, validTitle } from "../lib/validate";
import type { Ctx } from "../types";
import { consumeChallenge, storeChallenge } from "./challenges";
import { insertCredential } from "./credentials";

const USER_ID = ((): Uint8Array<ArrayBuffer> => {
  const encoded = new TextEncoder().encode("kareem-owner");
  const copy = new Uint8Array(encoded.length);
  copy.set(encoded);
  return copy;
})();

async function gateSetup(ctx: Ctx): Promise<Response | null> {
  const allowed = await checkRateLimit(
    ctx.env,
    "setup",
    clientIp(ctx.req),
    RATE_LIMITS.setup,
  );
  if (!allowed) return tooManyRequests();

  await writeAudit(ctx.env, ctx.req, "bootstrap_attempt");

  const done = await getSetting(ctx.env, "bootstrap_done");
  if (done !== null) {
    return apiError("setup_closed", "Setup has already been completed.", 403);
  }
  const expected = ctx.env.SETUP_TOKEN;
  const provided = ctx.req.headers.get("X-Setup-Token");
  if (expected === undefined || expected.length === 0) {
    return apiError("setup_unavailable", "Setup is not available.", 403);
  }
  if (provided === null || !(await safeEqual(provided, expected))) {
    return apiError("setup_denied", "Invalid setup token.", 403);
  }
  return null;
}

export async function setupOptions(ctx: Ctx): Promise<Response> {
  const denied = await gateSetup(ctx);
  if (denied !== null) return denied;

  const cfg = getAuthConfig(ctx.env, ctx.url);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: cfg.rpID,
    userName: "kareem",
    userID: USER_ID,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  const challengeId = await storeChallenge(ctx.env, "registration", options.challenge);
  return json({ ok: true, data: { options, challengeId } });
}

export async function setupVerify(ctx: Ctx): Promise<Response> {
  const denied = await gateSetup(ctx);
  if (denied !== null) return denied;

  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : null;
  const label = validTitle(body.label ?? "First device", 60);
  if (challengeId === null || label === null || body.response === undefined) {
    return badRequest("Missing registration fields.");
  }

  const expectedChallenge = await consumeChallenge(ctx.env, challengeId, "registration");
  if (expectedChallenge === null) {
    return apiError("challenge_expired", "Challenge expired — try again.", 400);
  }

  const cfg = getAuthConfig(ctx.env, ctx.url);
  let verified = false;
  let registrationInfo;
  try {
    const result = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      requireUserVerification: true,
    });
    verified = result.verified;
    registrationInfo = result.registrationInfo;
  } catch (err) {
    console.error("setup verify failed", err);
    return apiError("verification_failed", "Passkey could not be verified.", 400);
  }
  if (!verified || registrationInfo === undefined) {
    return apiError("verification_failed", "Passkey could not be verified.", 400);
  }

  const { credential } = registrationInfo;
  await insertCredential(ctx.env, {
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports,
    label,
  });
  await setSetting(ctx.env, "bootstrap_done", String(Date.now()));
  await writeAudit(ctx.env, ctx.req, "bootstrap_ok", { label });

  const session = await createSession(ctx.env, ctx.req, cfg);
  return json({ ok: true, data: { registered: true } }, 200, {
    "Set-Cookie": session.cookie,
  });
}
