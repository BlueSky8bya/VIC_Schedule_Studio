import { describe, expect, it } from "vitest";
import { buildGist, buildStory, describeMeta, type NarrativeItem } from "@/lib/activity/narrative";

// 2026-09-27 관리자 세션(리포트 실물)을 축약한 시나리오 — 원시 표기(gate.pass·typed=false)가
// 사람 말로 풀리고, 반복 편집이 한 줄로 접히며, 자리 비움과 비밀번호 실패가 드러나야 한다.
const T0 = Date.UTC(2026, 8, 26, 22, 11); // 07:11 KST
const min = (m: number) => T0 + m * 60_000;
const c = (t: number, target: string): NarrativeItem => ({ t, kind: "ui.click", target, targetLabel: null, meta: null, durMs: null, source: "client" });
const enter = (t: number, date: string, mode: string): NarrativeItem => ({ t, kind: "section.enter", target: "editor", targetLabel: null, meta: { date, mode }, durMs: null, source: "client" });
const leave = (t: number, date: string, how: string, saved: boolean, dur: number): NarrativeItem => ({ t, kind: "section.leave", target: "editor", targetLabel: null, meta: { how, date, saved, typed: false }, durMs: dur, source: "client" });
const srv = (t: number, kind: string, label: string, date: string): NarrativeItem => ({ t, kind, target: "eece4cbc-4603-4138-a620-ac1256c86f37", targetLabel: label, meta: { date, tags: 1, scope: "public", teaser: label.includes("최초공개"), support: false, multiday: false }, durMs: null, source: "server" });
const pass = (t: number): NarrativeItem => ({ t, kind: "gate.pass", target: null, targetLabel: null, meta: null, durMs: null, source: "server" });

const editCycle = (t: number, fail = 0): NarrativeItem[] => [
  c(t, "auto:.studio-event-pill"),
  enter(t, "2026-10-01", "edit"),
  ...Array.from({ length: 1 + fail }, () => c(t + 1000, "teaser-gate-submit")),
  pass(t + 2000),
  c(t + 3000, "title-input"),
  srv(t + 20_000, "event.update", "(공개 전 최초공개 일정)", "2026-10-01"),
  c(t + 21_000, "save-event"),
  leave(t + 22_000, "2026-10-01", "saved", true, 22_000)
];

const items: NarrativeItem[] = [
  c(min(0), "calendar-cell"),
  c(min(0), "calendar-cell"),
  enter(min(0), "2026-09-26", "new"),
  c(min(0), "title-input"),
  srv(min(48), "event.create", "여행 후기 풀기!", "2026-09-26"),
  c(min(48), "tp-chip"),
  leave(min(48), "2026-09-26", "saved", true, 48 * 60_000),
  c(min(48), "auto:.studio-event-pill"),
  c(min(48), "calendar-cell"),
  enter(min(49), "2026-10-01", "new"),
  c(min(49), "title-input"),
  c(min(49), "미정 표시"),
  c(min(49), "opt-chip"),
  c(min(49), "dtp-cell"),
  srv(min(49) + 40_000, "event.create", "(공개 전 최초공개 일정)", "2026-10-01"),
  c(min(49) + 40_500, "teaser-gate-submit"),
  pass(min(49) + 41_000),
  leave(min(49) + 47_000, "2026-10-01", "saved", true, 47_000),
  ...editCycle(min(50)),
  ...editCycle(min(51)),
  ...editCycle(min(52)),
  // 비밀번호 두 번 틀리고 닫음
  c(min(55), "auto:.studio-event-pill"),
  enter(min(55), "2026-10-01", "edit"),
  c(min(55) + 1000, "teaser-gate-submit"),
  c(min(55) + 2000, "teaser-gate-submit"),
  c(min(55) + 3000, "close-teaser-gate"),
  leave(min(55) + 9000, "2026-10-01", "other", false, 9000),
  c(min(58), "month-next"),
  { t: min(58), kind: "month.change", target: "2026-10", targetLabel: null, meta: { offset: 1 }, durMs: null, source: "client" }
];

describe("이용 기록 서술(narrative)", () => {
  it("meta를 사람 말로 푼다 — 원시 키·false 값이 새지 않는다", () => {
    expect(describeMeta({ how: "saved", date: "2026-09-26", saved: true, typed: false })).toBe("저장하고 닫음 · 9월 26일");
    expect(describeMeta({ date: "2026-10-01", tags: 1, scope: "public", teaser: true, support: false, multiday: false }, new Set(["date"]))).toBe("태그 1개 · 최초공개");
    expect(describeMeta({ how: "esc", typed: true })).toBe("ESC로 닫음 · 입력함");
    expect(describeMeta({ offset: -1 })).toBe("이전 1달");
  });
  it("흐름: 카드 단위로 묶고 반복은 ×N, 자리 비움·비밀번호 실패를 말한다", () => {
    const story = buildStory(items).join("\n");
    expect(story).toContain('9월 26일 새 일정 카드 — 제목 입력, 태그 고름, "여행 후기 풀기!" 만듦 → 저장하고 닫음 (48분), 카드 열어둔 채 48분 자리 비움');
    expect(story).toContain("10월 1일 새 일정 카드 — 비밀번호 확인, 제목 입력, 미정 토글, 옵션 바꿈, 공개 시각 고름");
    expect(story).toContain('"최초공개 일정" 만듦');
    expect(story).toMatch(/10월 1일 일정 수정 카드 — 비밀번호 확인, 제목 입력, 고침 → 저장하고 닫음 \(22초\) ×3/);
    expect(story).toContain("비밀번호 2번 틀림, 잠금 화면 닫음 → 닫음");
    expect(story).toContain("10월 달력 봄");
    expect(story).not.toMatch(/gate\.pass|typed=|ui\.click|section\./);
  });
  it("한 줄 요약", () => {
    const gist = buildGist(items);
    expect(gist).toContain('일정 2개 만듦("여행 후기 풀기!", "최초공개 일정")');
    expect(gist).toContain("일정 1개를 3번 고침");
    expect(gist).toContain("최초공개 비밀번호 확인 4번(2번 틀림)");
    expect(gist).toContain("자리 비움 48분");
  });
});

describe("편집 카드가 아닌 창도 한 줄로 접힌다", () => {
  it("설정 창: 연 클릭은 지우고, 안에서 누른 것만 말하고, 닫힘까지", () => {
    const t = Date.UTC(2026, 8, 27, 1, 4);
    const rows: NarrativeItem[] = [
      { t, kind: "ui.click", target: "open-settings", targetLabel: null, meta: null, durMs: null, source: "client" },
      { t: t + 500, kind: "section.enter", target: "modal:settings", targetLabel: null, meta: null, durMs: null, source: "client" },
      { t: t + 2000, kind: "ui.click", target: "다크 모드 켜기/끄기", targetLabel: null, meta: null, durMs: null, source: "client" },
      { t: t + 4000, kind: "ui.click", target: "close-settings", targetLabel: null, meta: null, durMs: null, source: "client" },
      { t: t + 5000, kind: "section.leave", target: "modal:settings", targetLabel: null, meta: null, durMs: 4500, source: "client" }
    ];
    const story = buildStory(rows);
    expect(story).toHaveLength(1);
    expect(story[0]).toMatch(/창 — .*누름 → 닫음 \(5초\)$/);
    expect(story[0]).not.toContain("열기 누름");
  });
});
