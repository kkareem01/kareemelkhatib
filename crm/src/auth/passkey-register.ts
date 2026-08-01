/** Add-a-device passkey registration + passkey management.
 * All handlers here are wrapped in requireSession by the route table. */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { RP_NAME, getAuthConfig } from "../config";
import { writeAudit } from "../lib/audit";
import { apiError, badRequest, json } from "../lib/http";
import { readJsonBody, validTitle } from "../lib/validate";
import type { Ctx } from "../types";
import { consumeChallenge, storeChallenge } from "./challenges";
import {
  countCredentials,
  deleteCredential,
  insertCredential,
  listCredentials,
  parseTransports,
} from "./credentials";

const USER_ID = ((): Uint8Array<ArrayBuffer> => {
  const encoded = new TextEncoder().encode("kareem-owner");
  const copy = new Uint8Array(encoded.length);
  copy.set(encoded);
  return copy;
})();

export async function listPasskeys(ctx: Ctx): Promise<Response> {
  const credentials = await listCredentials(ctx.env);
  return json({
    ok: true,
    data: credentials.map((c) => ({
      id: c.id,
      label: c.label,
      createdAt: c.created_at,
      lastUsedAt: c.last_used_at,
    })),
  });
}

export async function registerOptions(ctx: Ctx): Promise<Response> {
  const cfg = getAuthConfig(ctx.env, ctx.url);
  const existing = await listCredentials(ctx.env);
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
    excludeCredentials: existing.map((c) => {
      const transports = parseTransports(c);
      return transports === undefined
        ? { id: c.id }
        : { id: c.id, transports: transports as never };
    }),
  });
  const challengeId = await storeChallenge(ctx.env, "registration", options.challenge);
  return json({ ok: true, data: { options, challengeId } });
}

export async function registerVerify(ctx: Ctx): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  if (body === null) return badRequest("Invalid request body.");
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : null;
  const label = validTitle(body.label ?? "New device", 60);
  if (challengeId === null || label === null || body.response === undefined) {
    return badRequest("Missing registration fields.");
  }

  const expectedChallenge = await consumeChallenge(ctx.env, challengeId, "registration");
  if (expectedChallenge === null) {
    return apiError("challenge_expired", "Challenge expired — try again.", 400);
  }

  const cfg = getAuthConfig(ctx.env, ctx.url);
  try {
    const result = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      requireUserVerification: true,
    });
    if (!result.verified || result.registrationInfo === undefined) {
      return apiError("verification_failed", "Passkey could not be verified.", 400);
    }
    const { credential } = result.registrationInfo;
    await insertCredential(ctx.env, {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      label,
    });
  } catch (err) {
    console.error("passkey register failed", err);
    return apiError("verification_failed", "Passkey could not be verified.", 400);
  }

  await writeAudit(ctx.env, ctx.req, "passkey_added", { label });
  return json({ ok: true, data: { registered: true } });
}

export async function removePasskey(ctx: Ctx): Promise<Response> {
  const id = ctx.params.id;
  if (id === undefined || id.length === 0) return badRequest("Missing passkey id.");

  const total = await countCredentials(ctx.env);
  if (total <= 1) {
    return apiError(
      "last_passkey",
      "You can't remove your only passkey — add another device first.",
      409,
    );
  }
  const removed = await deleteCredential(ctx.env, id);
  if (!removed) return apiError("not_found", "Passkey not found.", 404);
  await writeAudit(ctx.env, ctx.req, "passkey_removed", { credential: id });
  return json({ ok: true, data: { removed: true } });
}
