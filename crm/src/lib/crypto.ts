/** Token generation, hashing, and passphrase KDF — WebCrypto only. */

import { PBKDF2_ITERATIONS, PBKDF2_SALT_BYTES } from "../config";

const encoder = new TextEncoder();

/** 256-bit random token, base64url (no padding). Used for sessions,
 * shares, and setup tokens. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function randomId(): string {
  return crypto.randomUUID();
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toHex(new Uint8Array(digest));
}

/** Constant-time comparison of equal-purpose strings. Compares digests so
 * length differences don't short-circuit. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) {
    diff |= da.charCodeAt(i) ^ db.charCodeAt(i);
  }
  return diff === 0;
}

export interface KdfParams {
  readonly algorithm: "PBKDF2-SHA256";
  readonly iterations: number;
  readonly saltB64: string;
}

export interface PassphraseHash {
  readonly params: KdfParams;
  readonly hashB64: string;
}

export async function hashPassphrase(
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<PassphraseHash> {
  const salt = new Uint8Array(PBKDF2_SALT_BYTES);
  crypto.getRandomValues(salt);
  const params: KdfParams = {
    algorithm: "PBKDF2-SHA256",
    iterations,
    saltB64: toBase64Url(salt),
  };
  const hashB64 = await deriveBits(passphrase, salt, iterations);
  return { params, hashB64 };
}

export async function verifyPassphrase(
  passphrase: string,
  stored: PassphraseHash,
): Promise<boolean> {
  const salt = fromBase64Url(stored.params.saltB64);
  const candidate = await deriveBits(passphrase, salt, stored.params.iterations);
  return safeEqual(candidate, stored.hashB64);
}

async function deriveBits(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

/** Generate a 5-word passphrase suggestion (≥64 bits from the word list
 * size 7776^5 ≈ 2^64.6, matching diceware). Wordlist is a compact subset;
 * entropy comes from crypto.getRandomValues. */
export function generatePassphrase(words: readonly string[], count = 5): string {
  if (words.length < 1024) {
    throw new Error("wordlist too small for safe passphrase generation");
  }
  const indexes = new Uint32Array(count);
  crypto.getRandomValues(indexes);
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = indexes[i];
    if (idx === undefined) throw new Error("unreachable");
    const word = words[idx % words.length];
    if (word === undefined) throw new Error("unreachable");
    picked.push(word);
  }
  return picked.join("-");
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
