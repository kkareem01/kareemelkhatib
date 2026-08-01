import type { Ctx, Env, Handler } from "./types";

interface Route {
  readonly method: string;
  readonly segments: readonly string[];
  readonly handler: Handler;
}

/** Minimal exact-match router with :param segments. No wildcards — every
 * reachable path is an explicit route; anything else is a 404. */
export class Router {
  private readonly routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    this.routes.push({
      method,
      segments: path.split("/").filter((s) => s.length > 0),
      handler,
    });
    return this;
  }

  async handle(
    req: Request,
    env: Env,
    exec: ExecutionContext,
  ): Promise<Response | null> {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter((s) => s.length > 0);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const params = matchSegments(route.segments, parts);
      if (params === null) continue;
      const ctx: Ctx = { req, env, exec, url, params };
      return route.handler(ctx);
    }
    return null;
  }
}

function matchSegments(
  pattern: readonly string[],
  parts: readonly string[],
): Record<string, string> | null {
  if (pattern.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const pat = pattern[i];
    const part = parts[i];
    if (pat === undefined || part === undefined) return null;
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(part);
    } else if (pat !== part) {
      return null;
    }
  }
  return params;
}
