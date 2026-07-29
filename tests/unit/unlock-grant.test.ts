import { describe, expect, it } from "vitest";
import {
  UNLOCK_GRANT_COOKIE,
  grantCookieOptions,
  hashGrantToken,
  newGrantToken
} from "@/lib/private-layer/unlock-grant";

// P0-PRIV-2: grant 토큰/쿠키 계약 특성화.

describe("unlock grant token", () => {
  it("토큰은 256-bit(64 hex) 무작위 — 호출마다 다르다", () => {
    const a = newGrantToken();
    const b = newGrantToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
  it("해시는 결정적 sha256(64 hex)이고 원문과 다르다", () => {
    const t = newGrantToken();
    expect(hashGrantToken(t)).toBe(hashGrantToken(t));
    expect(hashGrantToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashGrantToken(t)).not.toBe(t);
  });
});

describe("grant cookie contract", () => {
  it("HttpOnly + SameSite lax + path / + 수명 지정", () => {
    const o = grantCookieOptions(1800);
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
    expect(o.maxAge).toBe(1800);
  });
  it("쿠키 이름 고정(회귀 방지 — 바꾸면 기존 grant 전부 무효)", () => {
    expect(UNLOCK_GRANT_COOKIE).toBe("vic_priv_grant");
  });
});
