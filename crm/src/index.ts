/** Worker entrypoint: assembles the router, falls through to static
 * assets, runs the nightly cleanup cron. */

import { registerAuthRoutes } from "./auth/routes";
import { registerFileRoutes } from "./files/routes";
import { cleanup } from "./jobs/cleanup";
import { json, notFound, serverError } from "./lib/http";
import { registerLinkRoutes } from "./links/links";
import { registerNoteRoutes } from "./notes/routes";
import { Router } from "./router";
import { registerShareRoutes } from "./shares/routes";
import type { Env } from "./types";

const router = new Router();

router.add("GET", "/api/health", async () => json({ ok: true }));
registerAuthRoutes(router);
registerFileRoutes(router);
registerLinkRoutes(router);
registerNoteRoutes(router);
registerShareRoutes(router);

const worker: ExportedHandler<Env> = {
  async fetch(req, env, exec): Promise<Response> {
    try {
      const matched = await router.handle(req, env, exec);
      if (matched !== null) return matched;

      const url = new URL(req.url);
      const isWorkerPath =
        url.pathname.startsWith("/api/") || url.pathname.startsWith("/s/");
      if (isWorkerPath) return notFound();

      // Only reachable when run_worker_first routes miss (e.g. tests);
      // in production static paths never invoke the Worker.
      return env.ASSETS.fetch(req);
    } catch (err) {
      console.error("unhandled error", err);
      return serverError();
    }
  },

  async scheduled(_event, env, exec): Promise<void> {
    exec.waitUntil(cleanup(env));
  },
};

export default worker;
