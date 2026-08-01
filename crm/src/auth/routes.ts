/** Auth route table. */

import { getAuthConfig } from "../config";
import { writeAudit } from "../lib/audit";
import { json } from "../lib/http";
import { destroySession } from "../lib/session";
import type { Router } from "../router";
import type { Ctx } from "../types";
import { setupOptions, setupVerify } from "./bootstrap";
import { requireSession } from "./middleware";
import { loginOptions, loginVerify } from "./passkey-login";
import {
  listPasskeys,
  registerOptions,
  registerVerify,
  removePasskey,
} from "./passkey-register";
import { configurePassphrase, passphraseLogin } from "./passphrase";

async function logout(ctx: Ctx): Promise<Response> {
  const cfg = getAuthConfig(ctx.env, ctx.url);
  const clearCookie = await destroySession(ctx.env, ctx.req, cfg);
  await writeAudit(ctx.env, ctx.req, "logout");
  return json({ ok: true, data: { loggedOut: true } }, 200, {
    "Set-Cookie": clearCookie,
  });
}

async function me(): Promise<Response> {
  return json({ ok: true, data: { authenticated: true } });
}

export function registerAuthRoutes(router: Router): void {
  router.add("POST", "/api/setup/options", setupOptions);
  router.add("POST", "/api/setup/verify", setupVerify);
  router.add("POST", "/api/auth/login/options", loginOptions);
  router.add("POST", "/api/auth/login/verify", loginVerify);
  router.add("POST", "/api/auth/passphrase", passphraseLogin);
  router.add("POST", "/api/auth/logout", requireSession(logout));
  router.add("GET", "/api/auth/me", requireSession(me));
  router.add("PUT", "/api/auth/passphrase-config", requireSession(configurePassphrase));
  router.add("GET", "/api/passkeys", requireSession(listPasskeys));
  router.add("POST", "/api/passkeys/options", requireSession(registerOptions));
  router.add("POST", "/api/passkeys/verify", requireSession(registerVerify));
  router.add("DELETE", "/api/passkeys/:id", requireSession(removePasskey));
}
