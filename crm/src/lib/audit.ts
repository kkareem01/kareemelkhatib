/** Append-only audit log. Failures to write audit rows are logged but
 * never break the request path. */

import type { Env } from "../types";
import { clientIp } from "./http";

export type AuditEvent =
  | "bootstrap_attempt"
  | "bootstrap_ok"
  | "login_ok"
  | "login_fail"
  | "passphrase_ok"
  | "passphrase_fail"
  | "passkey_added"
  | "passkey_removed"
  | "counter_regression"
  | "logout"
  | "upload"
  | "file_delete"
  | "share_create"
  | "share_redeem"
  | "share_revoke";

export async function writeAudit(
  env: Env,
  req: Request,
  event: AuditEvent,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (ts, event, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        Date.now(),
        event,
        detail === undefined ? null : JSON.stringify(detail),
        clientIp(req),
        req.headers.get("User-Agent") ?? null,
      )
      .run();
  } catch (err) {
    console.error("audit write failed", event, err);
  }
}
