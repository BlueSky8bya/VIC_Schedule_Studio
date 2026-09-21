import { describe, expect, it } from "vitest";
import {
  accountHashForRole,
  deviceFromUserAgent,
  foldDigits,
  isClientKind,
  isInternalRole,
  isServerKind,
  sanitizeMeta,
  sanitizeVisitKey,
  sanitizeDevice,
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

describe("저장 갈래 — 내부자는 타임라인, 시청자는 카운트만(0063)", () => {
  // record.ts의 persist()가 isInternalRole로 갈래를 정한다. 이 판정이 뒤집히면
  // 시청자 개인 타임라인이 생기거나(프라이버시) 내부자 행동이 사라진다(지표).
  it("내부자 역할만 activity_event 쪽", () => {
    expect(["owner", "manager", "worker", "developer"].every(isInternalRole)).toBe(true);
  });
  it("시청자·비로그인은 카운트 쪽 — 개인 세션조차 남지 않는다", () => {
    expect(["viewer", "anon"].some(isInternalRole)).toBe(false);
  });
});

describe("버튼 전수 수집", () => {
  it("ui.click·section은 클라 kind(서버가 아니다)", () => {
    for (const k of ["ui.click", "section.enter", "section.leave"]) {
      expect(isClientKind(k)).toBe(true);
      expect(isServerKind(k)).toBe(false);
    }
  });
  it("registered controls survive the allowlist", () => {
    expect(sanitizeTarget("open-day-visit")).toBe("open-day-visit");
    expect(sanitizeTarget("auto:.month-nav-btn")).toBe("auto:.month-nav-btn");
  });
  it("숫자가 든 라벨은 접는다 — 안 접으면 날짜 칸마다 항목이 갈라져 통계가 무한 증식한다", () => {
    expect(foldDigits("2026-08-04화요일")).toBe("#-#-#화요일");
    expect(foldDigits("2026-08-05화요일 · 일정 3개")).toBe("#-#-#화요일 · 일정 #개");
    // 같은 요일이면 날짜가 달라도 한 항목으로 모인다(요일 글자는 숫자가 아니라 남는다 —
    // 최대 7개로 갇히므로 무한 증식은 막힌다. 완전한 해법은 버튼에 data-act를 붙이는 것).
    expect(foldDigits("2026-08-05 수요일")).toBe(foldDigits("2026-09-16 수요일"));
  });
  it("숫자 없는 라벨은 그대로", () => {
    expect(foldDigits("공지 쓰기")).toBe("공지 쓰기");
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

describe("activity storage allowlist", () => {
  it("drops secrets under innocent keys and invalid values under known keys", () => {
    expect(sanitizeMeta({ payload: "private", foo: "mail@example.test", scope: "private prose", tags: ["secret"], count: "123", how: "password", revealAt: "2026-09-21T00:00:00Z" })).toBeNull();
    expect(sanitizeMeta({ nested: { on: true }, title: "private", date: "2026-02-30", month: "2026-13", count: Infinity })).toBeNull();
    expect(sanitizeMeta(JSON.parse('{"__proto__":"secret","constructor":"secret","count":2}'))).toEqual({ count: 2 });
  });
  it("retains the typed production event and diagnostic metadata", () => {
    const data = { scope: "owner_private", date: "2026-09-21", month: "2026-09", tags: 2, teaser: true, mode: "edit", typed: true, saved: false, how: "esc", phase: "placeholder", pastSec: -10, asked: 1, got: 1, revealed: 0, visible: true, role: "viewer" };
    expect(sanitizeMeta(data)).toEqual(data);
    expect(sanitizeMeta({ count: -1, tags: 1.5, hops: 1e10 })).toBeNull();
  });
  it("drops invalid container inputs", () => {
    for (const value of [null, "secret", [1, 2], 123]) expect(sanitizeMeta(value)).toBeNull();
  });
  it("keeps registered controls and opaque UUIDs but drops arbitrary targets", () => {
    const id = "12345678-1234-4234-8234-123456789abc";
    expect(sanitizeTarget(id)).toBe(id);
    expect(sanitizeTarget("/studio/calendar")).toBe("/studio/calendar");
    expect(sanitizeTarget("/replay/2026-09-21")).toBe("/replay");
    expect(sanitizeTarget("open-day-visit#secret@example.test")).toBe("open-day-visit");
    for (const value of ["secret@example.test", "/studio/user@example.test", "/?token=secret", "auto:private prose", "x".repeat(500), "__proto__", "constructor", 42, " "]) expect(sanitizeTarget(value)).toBeNull();
  });
  it("sanitizes visit identifiers and devices without storing prose", () => {
    const id = "12345678-1234-4234-8234-123456789abc";
    expect(sanitizeVisitKey(id)).toBe(id);
    expect(sanitizeVisitKey("private@sample.test")).toBeNull();
    expect(sanitizeVisitKey("tab-plaintext")).toBeNull();
    expect(sanitizeDevice("ios")).toBe("ios");
    expect(sanitizeDevice("secret")).toBe("desktop");
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
