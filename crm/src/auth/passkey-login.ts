/** Passkey authentication ceremony. */

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { RATE_LIMITS, getAuthConfig } from "../config";
import { writeAudit } from "../lib/audit";
import { apiError, badRequest, clientIp, json, tooManyRequests } from "../lib/http";
import { checkRateLimit } from "../lib/rate-limit";
import { createSession } from "../lib/session";
import { readJsonBody } from "../lib/validate";
import type { Ctx } from "../types";
import { consumeChallenge, storeChallenge } from "./challenges";
import {
  blobToUint8,
  getCredential,
  listCredentials,
  parseTransports,
  updateCounter,
} from "./credentials";

async function gateLogin(ctx: Ctx): Promise<Response | null> {
  const allowed = await checkRateLimit(
    ctx.env,
    "login",
    clientIp(ctx.req),
    RATE_LIMITS.login,
  );
  return allowed ? null : tooManyRequests();
}

export async function loginOptions(ctx: Ctx): Promise<Response> {
  const denied = await gateLogin(ctx);
  if (denied !== null) return denied;

  const cfg = getAuthConfig(ctx.env, ctx.url);
  const credentials = await listCredentials(ctx.env);
  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => {
      const transports = parseTransports(c);
      return transports === undefined
        ? { id: c.id }
        : { id: c.id, transports: transports as never };
    }),
  });
  const challengeId = await storeChallenge(
    ctx.env,
    "authentication",
    options.challenge,
  );
  return json({ ok: true, data: { options, challengeId } });
}

export async function loginVerify(ctx: Ctx): Promise<Response> {
  const denied = await gateLogin(ctx);
  if (denied !== null) return denied;

  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : null;
  if (challengeId === null || body.response === undefined) {
    return badRequest("Missing login fields.");
  }

  const expectedChallenge = await consumeChallenge(
    ctx.env,
    challengeId,
    "authentication",
  );
  if (expectedChallenge === null) {
    return apiError("challenge_expired", "Challenge expired — try again.", 400);
  }

  const response = body.response as AuthenticationResponseJSON;
  const credentialId = typeof response.id === "string" ? response.id : null;
  if (credentialId === null) return badRequest("Missing credential id.");

  const stored = await getCredential(ctx.env, credentialId);
  if (stored === null) {
    await writeAudit(ctx.env, ctx.req, "login_fail", { reason: "unknown_credential" });
    return apiError("login_failed", "Sign-in failed.", 401);
  }

  const cfg = getAuthConfig(ctx.env, ctx.url);
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: blobToUint8(stored.public_key),
        counter: stored.counter,
        transports: parseTransports(stored) as never,
      },
    });
    if (!result.verified) throw new Error("not verified");

    const newCounter = result.authenticationInfo.newCounter;
    if (newCounter !== 0 && newCounter <= stored.counter) {
      // Possible cloned authenticator — refuse and flag loudly.
      await writeAudit(ctx.env, ctx.req, "counter_regression", {
        credential: stored.id,
        stored: stored.counter,
        received: newCounter,
      });
      return apiError("login_failed", "Sign-in failed.", 401);
    }
    await updateCounter(ctx.env, stored.id, newCounter);
  } catch (err) {
    console.error("login verify failed", err);
    await writeAudit(ctx.env, ctx.req, "login_fail", { reason: "verify_error" });
    return apiError("login_failed", "Sign-in failed.", 401);
  }

  await writeAudit(ctx.env, ctx.req, "login_ok", { credential: stored.id });
  const session = await createSession(ctx.env, ctx.req, cfg);
  return json({ ok: true, data: { authenticated: true } }, 200, {
    "Set-Cookie": session.cookie,
  });
}
