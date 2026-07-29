import { createHash, randomBytes } from "node:crypto";

// P0-PRIV-2(ADR-0011 L8): 비공개 잠금해제 grant의 공통 상수/헬퍼.
// opaque 토큰은 HttpOnly 쿠키에만 있고, DB에는 sha256 해시 + auth session_id 결속만 남는다.

export const UNLOCK_GRANT_COOKIE = "vic_priv_grant";

export function newGrantToken(): string {
  return randomBytes(32).toString("hex"); // 256-bit
}

export function hashGrantToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const grantCookieOptions = (maxAgeSeconds: number) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds
  });
