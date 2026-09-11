import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 이용 기록 창의 새로고침은 **세 카드 전부**를 다시 받아야 한다.
// 예전엔 방문 통계만 다시 받고 행동 타임라인·사용량은 그대로여서, 창을 열어둔 채 시간이 지나면
// 그 뒤에 생긴 방문(관리자 접속 등)이 영영 안 보였다(실측: 15:29에 연 창에 15:40 관리자 방문 없음).
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const MODAL = read("components/developer/day-visit-modal.tsx");
const TIMELINE = read("components/developer/activity-timeline.tsx");
const USAGE = read("components/developer/activity-usage.tsx");

describe("새로고침이 자식 카드까지 닿는다", () => {
  it("모달이 새로고침 때 reloadKey를 올린다", () => {
    expect(MODAL).toMatch(/setReloadKey\(\(k\) => k \+ 1\)/);
  });
  it("두 카드에 reloadKey를 내려준다", () => {
    expect(MODAL).toContain("<ActivityTimeline dateKey={dateKey} reloadKey={reloadKey} />");
    expect(MODAL).toContain("<ActivityUsage anchor={dateKey} reloadKey={reloadKey} />");
  });
  it("두 카드의 조회 effect가 reloadKey에 반응한다", () => {
    expect(TIMELINE).toMatch(/\}, \[dateKey, diag, hardKey, reloadKey\]\);/);
    expect(USAGE).toMatch(/\}, \[days, anchor, hardKey, reloadKey\]\);/);
  });
  // 자동 갱신은 **읽고 있는 동안 멈춘다**(2026-09-11). 갱신이 닿는 것과, 읽는 사람을 밀어내지
  // 않는 것은 둘 다 지켜야 한다 — 둘 중 하나만 남으면 예전 버그(굳음)나 이번 불편(튐)이 돌아온다.
  it("살펴보는 동안에는 자동 갱신을 멈춘다", () => {
    expect(MODAL).toContain("data-hold-refresh");
    expect(MODAL).toMatch(/holdAtRef\.current < HOLD_MS/);
    expect(TIMELINE).toContain("data-hold-refresh");
    expect(USAGE).toContain("data-hold-refresh");
  });
  it("자동 갱신이 목록을 스켈레톤으로 갈아치우지 않는다", () => {
    // 스켈레톤(setLoading(true))은 '하드 키'(날짜·진단 층 / 기간·기준일)가 바뀔 때만.
    expect(TIMELINE).toMatch(/lastHardRef\.current !== hardKey/);
    expect(USAGE).toMatch(/lastHardRef\.current !== hardKey/);
  });
  it("타임라인이 '언제 받은 값인지'를 표시한다 — 굳었는지 눈으로 알 수 있어야 한다", () => {
    expect(TIMELINE).toContain("기준");
    expect(TIMELINE).toMatch(/setLoadedAt/);
  });
});
