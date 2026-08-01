import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { checkRateLimit } from "../src/lib/rate-limit";

const RULE = { max: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  it("allows up to max then blocks within the window", async () => {
    const now = Date.now();
    expect(await checkRateLimit(env, "t1", "ip-a", RULE, now)).toBe(true);
    expect(await checkRateLimit(env, "t1", "ip-a", RULE, now + 1)).toBe(true);
    expect(await checkRateLimit(env, "t1", "ip-a", RULE, now + 2)).toBe(true);
    expect(await checkRateLimit(env, "t1", "ip-a", RULE, now + 3)).toBe(false);
  });

  it("resets after the window rolls over", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(env, "t2", "ip-a", RULE, now + i);
    }
    expect(await checkRateLimit(env, "t2", "ip-a", RULE, now + 10)).toBe(false);
    expect(await checkRateLimit(env, "t2", "ip-a", RULE, now + RULE.windowMs + 1)).toBe(true);
  });

  it("isolates subjects and scopes", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(env, "t3", "ip-a", RULE, now + i);
    }
    expect(await checkRateLimit(env, "t3", "ip-a", RULE, now + 5)).toBe(false);
    expect(await checkRateLimit(env, "t3", "ip-b", RULE, now + 5)).toBe(true);
    expect(await checkRateLimit(env, "other", "ip-a", RULE, now + 5)).toBe(true);
  });
});
