/** Session guard for protected routes. Wrap any handler with
 * requireSession(); mutations also get a cross-site check. */

import { getAuthConfig } from "../config";
import { apiError, isCrossSite, unauthorized } from "../lib/http";
import { getSession } from "../lib/session";
import type { Ctx, Handler } from "../types";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireSession(handler: Handler): Handler {
  return async (ctx: Ctx): Promise<Response> => {
    if (MUTATING_METHODS.has(ctx.req.method) && isCrossSite(ctx.req)) {
      return apiError("cross_site", "Cross-site request rejected.", 403);
    }
    const cfg = getAuthConfig(ctx.env, ctx.url);
    const session = await getSession(ctx.env, ctx.req, cfg);
    if (session === null) return unauthorized();
    return handler(ctx);
  };
}
