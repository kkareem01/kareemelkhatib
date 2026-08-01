import type { Env } from "./types";

/** WebAuthn relying-party identity (production). */
export const RP_NAME = "crm.kareemelkhatib.com";
export const PROD_RP_ID = "crm.kareemelkhatib.com";
export const PROD_ORIGIN = "https://crm.kareemelkhatib.com";

/** Time-to-live values (ms). */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Bump sessions.last_seen_at at most this often (D1 write budget). */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
export const SOFT_DELETE_PURGE_MS = 30 * 24 * 60 * 60 * 1000;
export const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Upload limits: Workers free plan caps request bodies at 100MB. */
export const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
export const MAX_NOTE_BYTES = 256 * 1024;
export const MAX_CLIPBOARD_BYTES = 256 * 1024;
export const MAX_FILENAME_LENGTH = 255;
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;
export const MAX_LINKS = 200;

/** Share expiry presets (label → ms). */
export const SHARE_EXPIRY_PRESETS: Readonly<Record<string, number>> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/** PBKDF2 defaults — tuned for Workers free-plan CPU budget; params are
 * stored per-hash in settings so they can be raised without migration. */
export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_SALT_BYTES = 16;

/** Rate limit windows: [maxAttempts, windowMs]. */
export const RATE_LIMITS = {
  setup: { max: 3, windowMs: 60 * 60 * 1000 },
  login: { max: 20, windowMs: 60 * 1000 },
  passphrase: { max: 5, windowMs: 15 * 60 * 1000 },
  passphrase_global: { max: 10, windowMs: 60 * 60 * 1000 },
  share_redeem: { max: 20, windowMs: 60 * 1000 },
} as const;

export interface AuthConfig {
  readonly rpID: string;
  readonly origin: string;
  readonly cookieName: string;
  readonly dev: boolean;
}

/** Resolve rpID/origin/cookie per environment. In dev (wrangler dev,
 * vitest) WebAuthn binds to localhost and the __Host- prefix (which
 * requires HTTPS) is dropped. */
export function getAuthConfig(env: Env, url: URL): AuthConfig {
  const dev = env.DEV === "1";
  if (dev) {
    return {
      rpID: url.hostname,
      origin: url.origin,
      cookieName: "session",
      dev: true,
    };
  }
  return {
    rpID: PROD_RP_ID,
    origin: PROD_ORIGIN,
    cookieName: "__Host-session",
    dev: false,
  };
}
