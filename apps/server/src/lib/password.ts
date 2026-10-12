import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const PASSWORD_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 64;

// Keep Better Auth's default scrypt parameters and hash format, but run scrypt through
// node:crypto instead of the default pure JavaScript implementation.
//
// Why this exists:
// - Better Auth's default email/password handler can use @noble/hashes/scrypt.
// - On Cloudflare Workers Free, pure JavaScript scrypt can exceed the per-request CPU limit
//   during POST /api/auth/sign-in/email.
// - Cloudflare Workers supports node:crypto when nodejs_compat is enabled, so native scrypt
//   avoids the Worker CPU timeout while preserving the existing `${salt}:${hex(key)}` format.
//
// Reference:
// https://zenn.dev/ezocraft/articles/dc9beb3b7a7460
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 16,
  p: 1,
  maxmem: 128 * 16_384 * 16 * 2,
} as const;

export async function hashPassword(password: string) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_LENGTH)));
  const derivedKey = await deriveScryptKey(password, salt);

  return `${salt}:${toHex(derivedKey)}`;
}

export async function verifyPassword(input: { hash: string; password: string }) {
  const [salt, hash] = input.hash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derivedKey = await deriveScryptKey(input.password, salt);
  const expectedKey = Buffer.from(hash, "hex");

  return (
    derivedKey.byteLength === expectedKey.byteLength &&
    timingSafeEqual(Buffer.from(derivedKey), expectedKey)
  );
}

function deriveScryptKey(password: string, salt: string) {
  return new Promise<Uint8Array>((resolve, reject) => {
    scryptCallback(
      password.normalize("NFKC"),
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(new Uint8Array(derivedKey));
      },
    );
  });
}

function toHex(value: Uint8Array) {
  return Buffer.from(value).toString("hex");
}
