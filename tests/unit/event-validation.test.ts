import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_TAGS,
  validateDateKey,
  validateSupportUrl,
  validateTagAssignment
} from "@/lib/schedules/event-validation";
import type { SupabaseClient } from "@supabase/supabase-js";

// P0-AUTH-1 서버 검증 특성화 — 조용한 slice 대신 거부(fail-closed)를 못박는다.

describe("validateDateKey", () => {
  it("빈 값은 허용(optional)", () => {
    expect(validateDateKey(undefined, "시작").ok).toBe(true);
    expect(validateDateKey("", "시작").ok).toBe(true);
  });
  it("YYYY-MM-DD만 허용", () => {
    expect(validateDateKey("2026-07-29", "시작").ok).toBe(true);
    expect(validateDateKey("2026/07/29", "시작").ok).toBe(false);
    expect(validateDateKey("2026-7-29", "시작").ok).toBe(false);
    expect(validateDateKey("29-07-2026", "시작").ok).toBe(false);
  });
});

describe("validateSupportUrl", () => {
  it("빈 링크는 허용", () => {
    expect(validateSupportUrl(undefined).ok).toBe(true);
    expect(validateSupportUrl("  ").ok).toBe(true);
  });
  it("https만 허용", () => {
    expect(validateSupportUrl("https://www.sooplive.co.kr/support/abc").ok).toBe(true);
    expect(validateSupportUrl("http://example.com").ok).toBe(false);
    expect(validateSupportUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateSupportUrl("data:text/html,hi").ok).toBe(false);
    expect(validateSupportUrl("not a url").ok).toBe(false);
  });
  it("과도한 길이 거부", () => {
    expect(validateSupportUrl(`https://a.com/${"x".repeat(3000)}`).ok).toBe(false);
  });
});

// in(...) 결과를 주입할 수 있는 최소 Supabase 흉내 — 체이닝 select→eq→eq→in 만 지원.
function fakeDb(returnedIds: string[], fail = false) {
  const result = fail
    ? { data: null, error: { message: "boom" } }
    : { data: returnedIds.map((id) => ({ id })), error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve(result)
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("validateTagAssignment", () => {
  const cal = "cal-1";
  it("정상 payload 통과(모든 태그가 이 캘린더의 활성 태그)", async () => {
    const r = await validateTagAssignment(fakeDb(["t1", "t2"]), cal, ["t1", "t2"], ["t1"]);
    expect(r.ok).toBe(true);
  });
  it("빈 태그 허용(흰 카드)", async () => {
    const r = await validateTagAssignment(fakeDb([]), cal, [], []);
    expect(r.ok).toBe(true);
  });
  it(`태그 ${MAX_EVENT_TAGS}개 초과는 slice가 아니라 거부`, async () => {
    const many = Array.from({ length: MAX_EVENT_TAGS + 1 }, (_, i) => `t${i}`);
    const r = await validateTagAssignment(fakeDb(many), cal, many, []);
    expect(r.ok).toBe(false);
  });
  it("중복 태그 거부", async () => {
    const r = await validateTagAssignment(fakeDb(["t1"]), cal, ["t1", "t1"], []);
    expect(r.ok).toBe(false);
  });
  it("대표 태그가 선택 목록 밖이면 거부", async () => {
    const r = await validateTagAssignment(fakeDb(["t1"]), cal, ["t1"], ["t9"]);
    expect(r.ok).toBe(false);
  });
  it("대표 태그 3개 거부", async () => {
    const r = await validateTagAssignment(
      fakeDb(["t1", "t2", "t3"]),
      cal,
      ["t1", "t2", "t3"],
      ["t1", "t2", "t3"]
    );
    expect(r.ok).toBe(false);
  });
  it("남의 캘린더/비활성 태그(조회 결과 누락) 거부", async () => {
    const r = await validateTagAssignment(fakeDb(["t1"]), cal, ["t1", "foreign"], []);
    expect(r.ok).toBe(false);
  });
  it("태그 조회 실패는 통과가 아니라 거부(fail-closed)", async () => {
    const r = await validateTagAssignment(fakeDb([], true), cal, ["t1"], []);
    expect(r.ok).toBe(false);
  });
});
