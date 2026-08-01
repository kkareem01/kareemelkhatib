import { describe, expect, it } from "vitest";
import {
  fromBase64Url,
  generatePassphrase,
  hashPassphrase,
  randomToken,
  safeEqual,
  sha256Hex,
  toBase64Url,
  verifyPassphrase,
} from "../src/lib/crypto";

describe("randomToken", () => {
  it("produces base64url tokens of 32 bytes", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fromBase64Url(token).length).toBe(32);
  });

  it("never repeats across many draws", () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(seen.size).toBe(200);
  });
});

describe("sha256Hex", () => {
  it("matches a known vector", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("safeEqual", () => {
  it("accepts equal and rejects unequal strings of any length", async () => {
    expect(await safeEqual("secret-token", "secret-token")).toBe(true);
    expect(await safeEqual("secret-token", "secret-tokeN")).toBe(false);
    expect(await safeEqual("short", "much-longer-value")).toBe(false);
  });
});

describe("passphrase hashing", () => {
  it("round-trips a correct passphrase", async () => {
    const hashed = await hashPassphrase("correct-horse-battery-staple-9", 1000);
    expect(await verifyPassphrase("correct-horse-battery-staple-9", hashed)).toBe(true);
  });

  it("rejects a wrong passphrase and tampered hash", async () => {
    const hashed = await hashPassphrase("correct-horse-battery-staple-9", 1000);
    expect(await verifyPassphrase("wrong-guess", hashed)).toBe(false);
    const tampered = { ...hashed, hashB64: hashed.hashB64.slice(0, -2) + "AA" };
    expect(await verifyPassphrase("correct-horse-battery-staple-9", tampered)).toBe(false);
  });

  it("uses a fresh salt per hash", async () => {
    const a = await hashPassphrase("same-input-passphrase", 1000);
    const b = await hashPassphrase("same-input-passphrase", 1000);
    expect(a.params.saltB64).not.toBe(b.params.saltB64);
    expect(a.hashB64).not.toBe(b.hashB64);
  });
});

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("generatePassphrase", () => {
  it("refuses a small wordlist", () => {
    expect(() => generatePassphrase(["a", "b"], 5)).toThrow();
  });

  it("joins the requested number of words", () => {
    const words = Array.from({ length: 2048 }, (_, i) => `w${i}`);
    const phrase = generatePassphrase(words, 5);
    expect(phrase.split("-").length).toBe(5);
  });
});
