import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// PRIVATE_LAYER_UNLOCK_SECRET을 페퍼로 사용. 평문 저장 금지 — scrypt 해시만 저장한다.
const PEPPER = process.env.PRIVATE_LAYER_UNLOCK_SECRET ?? "";

export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(passcode + PEPPER, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derived = scryptSync(passcode + PEPPER, salt, 64);
  const expected = Buffer.from(hash, "hex");

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
