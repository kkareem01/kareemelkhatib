/** Share route table. Redemption is the only public data endpoint. */

import { requireSession } from "../auth/middleware";
import type { Router } from "../router";
import { createShare } from "./create";
import { listShares, revokeShare } from "./manage";
import { redeemShare } from "./redeem";

export function registerShareRoutes(router: Router): void {
  router.add("POST", "/api/shares", requireSession(createShare));
  router.add("GET", "/api/shares", requireSession(listShares));
  router.add("DELETE", "/api/shares/:id", requireSession(revokeShare));
  router.add("GET", "/s/:token", redeemShare);
}
