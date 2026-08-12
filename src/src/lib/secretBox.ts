// Application-level encryption for the user data we persist (portfolios,
// watchlist, alerts).
//
// What this defends against, precisely: someone who obtains the database
// credentials — a leaked KV token, a misconfigured console, a backup that ends
// up somewhere it shouldn't — and reads the stored values directly. Without
// this they get a holdings list in plain JSON; with it they get ciphertext and
// no key, because the key never lives in the database.
//
// What it does NOT defend against, and should not be described as if it did:
//
//   - It is not end-to-end encryption. The server holds the key and can read
//     the data, which it must, because AUTH_SECRET lives in the environment.
//   - It does nothing for a compromised server or a stolen session cookie.
//   - It cannot protect the signed-out case. Holdings entered before signing in
//     sit in localStorage, and any key the browser could use to decrypt them
//     would have to sit beside them in the same browser. Encrypting there would
//     look like security while providing none, so it is left alone.
//
// AES-256-GCM, key derived from AUTH_SECRET with scrypt. GCM authenticates as
// well as encrypts, so a tampered value fails to open rather than decoding into
// something unexpected.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const VERSION = "v1";
// Fixed salt: the derivation has to be reproducible across instances and
// deploys, and the secret it stretches is already high-entropy.
const SALT = "quantifi:store:v1";

let cached: Buffer | null = null;

function key(): Buffer | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!secret) return null;
  if (!cached) cached = scryptSync(secret, SALT, 32);
  return cached;
}

/** True when there is a secret to encrypt with. */
export function encryptionAvailable(): boolean {
  return key() !== null;
}

// v1.<iv>.<tag>.<ciphertext>, all base64url. The version prefix is what lets a
// later scheme be introduced without a migration: read the prefix, decrypt
// accordingly.
export function seal(plaintext: string): string {
  const k = key();
  if (!k) return plaintext; // nothing to encrypt with — store as-is
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

// Opens a sealed value. Anything that isn't in the sealed format is returned
// unchanged: records written before this existed are plain JSON, and they must
// keep working rather than being lost the day this shipped. They are re-sealed
// on the next write.
export function open(stored: string | null): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(`${VERSION}.`)) return stored; // legacy plaintext
  const k = key();
  if (!k) return null; // sealed data and no secret — refuse rather than guess
  const [, ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(ivB64, "base64url"));
    d.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([d.update(Buffer.from(dataB64, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Wrong key (AUTH_SECRET rotated) or a tampered value. Returning null makes
    // it read as "no data" rather than crashing the request.
    return null;
  }
}
