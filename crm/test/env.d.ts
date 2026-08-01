import type { Env } from "../src/types";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly DB: D1Database;
      readonly VAULT: R2Bucket;
      readonly ASSETS: Fetcher;
      readonly SETUP_TOKEN?: string;
      readonly DEV?: string;
      readonly TEST_MIGRATIONS: D1Migration[];
    }
  }
}

/** Compile-time check: the test env stays assignable to the Worker Env. */
declare const _check: Cloudflare.Env extends Env ? true : never;
export type { Env };
