import { describe, expect, it } from "vitest";
import {
  accountHashForRole,
  deviceFromUserAgent,
  isClientKind,
  isInternalRole,
  isServerKind,
  sanitizeMeta,
  sanitizeTarget
} from "@/lib/activity/kinds";

// 행동 기록(0062)의 경계 규약. 여기가 무너지면 (1) 비공개 본문이 새거나 (2) 시청자 개인
// 타임라인이 만들어지거나 (3) 클라가 '실제 변경' 로그를 위조할 수 있다.

describe("식별 범위 — 내부자만", () => {
  it("내부자는 계정 해시를 남긴다", () => {
    for (const role of ["owner", "manager", "worker", "developer"]) {
      expect(isInternalRole(role)).toBe(true);
      expect(accountHashForRole(role, "hash-1")).toBe("hash-1");
    }
  });
  it("시청자·비로그인은 해시가 있어도 버린다(개인 타임라인 구조적 차단)", () => {
    for (const role of ["viewer", "anon"]) {
      expect(isInternalRole(role)).toBe(false);
      expect(accountHashForRole(role, "hash-1")).toBeNull();
    }
  });
});

describe("kind 구분 — 클라는 '실제 변경'을 사칭할 수 없다", () => {
  it("server kind는 클라 kind가 아니다", () => {
    expect(isServerKind("event.update")).toBe(true);
    expect(isClientKind("event.update")).toBe(false);
  });
  it("client kind는 server kind가 아니다", () => {
    expect(isClientKind("route.enter")).toBe(true);
    expect(isServerKind("route.enter")).toBe(false);
  });
  it("모르는 kind는 양쪽 다 거부", () => {
    expect(isClientKind("event.pwn")).toBe(false);
    expect(isServerKind("event.pwn")).toBe(false);
  });
});

describe("sanitizeMeta — 일정 제목·본문 차단(최우선 제약)", () => {
  it("제목·본문류 키는 통째로 버린다", () => {
    const meta = sanitizeMeta({
      title: "비공개 방송 계획",
      body: "본문",
      privateTitle: "엠바고 제목",
      editorNote: "메모",
      제목: "한글 제목",
      scope: "owner_private"
    });
    expect(meta).toEqual({ scope: "owner_private" });
  });
  it("중첩 객체는 버린다(본문이 숨어들 통로)", () => {
    expect(sanitizeMeta({ payload: { secret: "x" }, ok: true })).toEqual({ ok: true });
  });
  it("문자열은 64자로 자른다(자유 서술을 담을 수 없는 길이)", () => {
    const long = "가".repeat(200);
    const meta = sanitizeMeta({ scope: long });
    expect((meta?.scope as string).length).toBe(64);
  });
  it("원시값 배열은 남기되 개수를 제한한다", () => {
    expect(sanitizeMeta({ tags: [1, 2, 3] })).toEqual({ tags: [1, 2, 3] });
    const many = sanitizeMeta({ tags: Array.from({ length: 30 }, (_, i) => i) });
    expect((many?.tags as number[]).length).toBe(8);
  });
  it("남길 게 없으면 null", () => {
    expect(sanitizeMeta({ title: "x" })).toBeNull();
    expect(sanitizeMeta(null)).toBeNull();
    expect(sanitizeMeta("문자열")).toBeNull();
    expect(sanitizeMeta([1, 2])).toBeNull();
  });
  it("키 개수 상한", () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 40; i += 1) wide[`k${i}`] = i;
    expect(Object.keys(sanitizeMeta(wide) ?? {}).length).toBe(12);
  });
});

describe("sanitizeTarget", () => {
  it("uuid·경로는 그대로, 길이는 제한", () => {
    expect(sanitizeTarget("/studio/calendar")).toBe("/studio/calendar");
    expect(sanitizeTarget("x".repeat(500))?.length).toBe(120);
  });
  it("빈 값·비문자열은 null", () => {
    expect(sanitizeTarget("   ")).toBeNull();
    expect(sanitizeTarget(42)).toBeNull();
  });
});

describe("deviceFromUserAgent — 클라 detectDevice와 같은 규칙", () => {
  it("판정이 어긋나면 같은 방문이 두 기기로 보인다", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toBe("ios");
    expect(deviceFromUserAgent("Mozilla/5.0 (X11) Mobile Safari")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
    expect(deviceFromUserAgent(null)).toBe("desktop");
  });
});
