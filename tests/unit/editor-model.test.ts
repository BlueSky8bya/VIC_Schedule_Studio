import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDaysIso,
  createEmptyForm,
  daysBetweenIso,
  draftFingerprint,
  eventToForm,
  formatShortDate,
  formatSupportEnd,
  isoToKstLocalInput,
  kstLocalInputToIso,
  spanDays,
  teaserStillHidden
} from "@/lib/studio/editor-model";
import type { StudioScheduleEvent } from "@/lib/domain/schedule-types";

// P2-ARCH-1 1단계 특성화 — studio-shell에서 추출한 순수 헬퍼의 현재 동작을 고정한다.
describe("editor-model 날짜 헬퍼", () => {
  it("daysBetweenIso — 월/연 경계 포함", () => {
    expect(daysBetweenIso("2026-07-01", "2026-07-01")).toBe(0);
    expect(daysBetweenIso("2026-07-31", "2026-08-01")).toBe(1);
    expect(daysBetweenIso("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetweenIso("2026-07-10", "2026-07-01")).toBe(-9);
  });

  it("addDaysIso — 경계 넘김·음수", () => {
    expect(addDaysIso("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01"); // 평년
  });

  it("spanDays — 같은 날=1(포함 일수)", () => {
    expect(spanDays("2026-07-01", "2026-07-01")).toBe(1);
    expect(spanDays("2026-07-01", "2026-07-07")).toBe(7);
  });

  it("표시 포맷", () => {
    // 조절 대상이 '기간'이라 시작~종료를 함께 보여준다(예전엔 종료일 + 일수만 보여
    // 지금 무엇을 늘리고 줄이는지 읽히지 않았다).
    expect(formatSupportEnd("2026-07-01", "2026-07-07")).toBe("7월 1일 ~ 7월 7일");
    expect(formatSupportEnd("2026-07-05", "2026-07-05")).toBe("7월 5일 ~ 7월 5일");
    expect(formatSupportEnd("2026-07-28", "2026-08-02")).toBe("7월 28일 ~ 8월 2일");
    expect(formatShortDate("2026-07-05")).toBe("7.5");
  });
});

describe("editor-model 떡밥 KST 변환", () => {
  it("ISO(UTC) ↔ datetime-local(KST) 왕복", () => {
    // 2026-07-01 00:30 KST = 2026-06-30 15:30 UTC
    expect(isoToKstLocalInput("2026-06-30T15:30:00.000Z")).toBe("2026-07-01T00:30");
    expect(kstLocalInputToIso("2026-07-01T00:30")).toBe("2026-06-30T15:30:00.000Z");
    expect(isoToKstLocalInput(undefined)).toBe("");
    expect(kstLocalInputToIso("")).toBeNull();
  });

  it("teaserStillHidden — 공개 시각 전/후", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    expect(teaserStillHidden({ teaser: true, teaserRevealAt: "2026-07-02T00:00:00Z" })).toBe(true);
    expect(teaserStillHidden({ teaser: true, teaserRevealAt: "2026-06-30T00:00:00Z" })).toBe(false);
    expect(teaserStillHidden({ teaser: false, teaserRevealAt: "2026-07-02T00:00:00Z" })).toBe(false);
    expect(teaserStillHidden({ teaser: true })).toBe(false);
  });
  afterEach(() => vi.useRealTimers());
});

describe("editor-model 폼/드래프트", () => {
  const baseEvent = {
    id: "evt-x",
    startsAt: "2026-07-01T20:00:00+09:00",
    isAllDay: false,
    publicTitle: "풀트뱅\n세부",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: ["t1"],
    primaryTagIds: ["t1"],
    sortOrder: 1
  } as unknown as StudioScheduleEvent;

  it("eventToForm — 필드 매핑과 떡밥 정규화(지난 떡밥은 토글 내림)", () => {
    const f = eventToForm({
      ...baseEvent,
      teaser: true,
      teaserRevealAt: "2000-01-01T00:00:00Z"
    } as StudioScheduleEvent);
    expect(f.id).toBe("evt-x");
    expect(f.publicTitle).toBe("풀트뱅\n세부");
    expect(f.teaser).toBe(false);
    expect(f.teaserRevealAt).toBe("");
  });

  it("draftFingerprint — 내용이 같으면 동일, 다르면 상이. id는 지문에 안 들어간다", () => {
    const a = createEmptyForm();
    const b = { ...createEmptyForm(), id: "다른-id" };
    expect(draftFingerprint(a)).toBe(draftFingerprint(b));
    expect(draftFingerprint({ ...a, publicTitle: "x" })).not.toBe(draftFingerprint(a));
  });
});
