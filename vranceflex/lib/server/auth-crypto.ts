import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export class AuthConfigurationError extends Error {}

function authSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new AuthConfigurationError(
      "AUTH_SECRET must be configured with at least 32 characters.",
    );
  }
  return secret;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateOtp() {
  return String(randomInt(100_000, 1_000_000));
}

export function hashOtp(userId: string, kind: string, code: string) {
  return createHmac("sha256", authSecret())
    .update(`${userId}:${kind}:${code}`)
    .digest("hex");
}

export function verifyOtpHash(
  userId: string,
  kind: string,
  code: string,
  expectedHash: string,
) {
  const actual = Buffer.from(hashOtp(userId, kind, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
