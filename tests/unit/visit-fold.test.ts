import { describe, expect, it } from "vitest";
import { durMs, foldVisits, sStart, unionSpans, type SessionRow } from "@/lib/insights/visit-fold";

// 구간 → 방문 접기(0061). 기준 케이스는 2026-08-04 실측(owner 단독, 04:11~04:20):
// 공백 0의 연속 9분 1회 방문이 4행(4초/5분/7초/4분)으로 찍혔던 것.

const DAY = "2026-08-04";
const ACCT = "acct-tory";

function at(hhmmss: string): string {
  return `${DAY}T${hhmmss}.000Z`;
}
function seg(
  startUtc: string,
  endUtc: string,
  over: Partial<SessionRow> = {}
): SessionRow {
  return {
    day: DAY,
    role: "owner",
    device: "desktop",
    account_hash: ACCT,
    started_at: at(startUtc),
    last_seen_at: at(endUtc),
    ended_at: at(endUtc),
    visit_key: "tab-1",
    ...over
  };
}

describe("unionSpans", () => {
  it("겹치는 구간을 합치고 떨어진 구간은 남긴다", () => {
    expect(unionSpans([{ s: 0, e: 10 }, { s: 5, e: 20 }])).toEqual([{ s: 0, e: 20 }]);
    expect(unionSpans([{ s: 0, e: 10 }, { s: 30, e: 40 }])).toEqual([
      { s: 0, e: 10 },
      { s: 30, e: 40 }
    ]);
  });
  it("입력 순서와 무관하고 원본을 변형하지 않는다", () => {
    const input = [{ s: 30, e: 40 }, { s: 0, e: 10 }, { s: 8, e: 12 }];
    expect(unionSpans(input)).toEqual([{ s: 0, e: 12 }, { s: 30, e: 40 }]);
    expect(input[0]).toEqual({ s: 30, e: 40 }); // 원본 유지
  });
});

describe("foldVisits — 탭 수명", () => {
  it("같은 탭의 조각들을 한 방문으로 접고 체류를 합산한다", () => {
    // 실측 재현: 4초 → 5분 → 7초 → 4분, 전부 같은 탭(문서 이동으로 끊긴 것).
    const rows = [
      seg("04:11:00", "04:11:04"),
      seg("04:11:04", "04:16:00"),
      seg("04:16:00", "04:16:07"),
      seg("04:16:07", "04:20:00")
    ];
    const out = foldVisits(rows);
    expect(out).toHaveLength(1);
    expect(durMs(out[0])).toBe(9 * 60 * 1000); // 실측 9분 — 조각 합이 아니라 합집합
    expect(out[0].segments).toBe(4); // 이동 3회
    expect(new Date(out[0].started_at).toISOString()).toBe(at("04:11:00"));
    expect(new Date(out[0].ended_at!).toISOString()).toBe(at("04:20:00"));
  });

  it("탭이 다르고 시간이 안 겹치면 별개 방문", () => {
    const rows = [
      seg("04:11:00", "04:20:00", { visit_key: "tab-1" }),
      seg("06:00:00", "06:05:00", { visit_key: "tab-2" })
    ];
    expect(foldVisits(rows)).toHaveLength(2);
  });

  it("같은 계정의 탭 둘이 겹치면 한 방문 — 체류는 union이라 이중계상 없음", () => {
    // 창 2개를 나란히 띄운 경우. 각 10분이지만 완전히 겹치므로 체류는 10분이어야 한다.
    const rows = [
      seg("04:00:00", "04:10:00", { visit_key: "tab-1" }),
      seg("04:00:00", "04:10:00", { visit_key: "tab-2" })
    ];
    const out = foldVisits(rows);
    expect(out).toHaveLength(1);
    expect(durMs(out[0])).toBe(10 * 60 * 1000);
    expect(out[0].segments).toBe(2);
  });

  it("계정이 다르면 시간이 겹쳐도 절대 합치지 않는다", () => {
    const rows = [
      seg("04:00:00", "04:10:00", { visit_key: "tab-1", account_hash: "a" }),
      seg("04:00:00", "04:10:00", { visit_key: "tab-2", account_hash: "b" })
    ];
    expect(foldVisits(rows)).toHaveLength(2);
  });

  it("계정 미상(비로그인·옛 행)은 겹쳐도 합치지 않는다 — 다른 사람일 수 있다", () => {
    const rows = [
      seg("04:00:00", "04:10:00", { visit_key: "tab-1", account_hash: null }),
      seg("04:00:00", "04:10:00", { visit_key: "tab-2", account_hash: null })
    ];
    expect(foldVisits(rows)).toHaveLength(2);
  });

  it("visit_key가 없는 옛 행은 한 행이 곧 한 방문(도입 전과 동일)", () => {
    const rows = [
      seg("04:11:00", "04:11:04", { visit_key: null, account_hash: null }),
      seg("04:11:04", "04:16:00", { visit_key: null, account_hash: null })
    ];
    expect(foldVisits(rows)).toHaveLength(2);
  });

  it("자리비움(탭 숨김)은 체류에 안 들어가지만 방문 span에는 포함된다", () => {
    // 5분 보고 → 20분 숨김 → 5분 봄. 같은 탭이므로 한 방문, 실측 체류는 10분.
    const rows = [
      seg("04:00:00", "04:05:00"),
      seg("04:25:00", "04:30:00")
    ];
    const out = foldVisits(rows);
    expect(out).toHaveLength(1);
    expect(durMs(out[0])).toBe(10 * 60 * 1000); // span 30분이 아니라 실측 10분
    expect(out[0].spans).toHaveLength(2); // 시간대 분포·동접은 이 두 구간만 본다
  });

  it("미종료는 마지막 조각에서 승계한다(비콘 end 유실 점검이 죽지 않게)", () => {
    const rows = [
      seg("04:00:00", "04:05:00"),
      { ...seg("04:05:00", "04:09:00"), ended_at: null }
    ];
    const out = foldVisits(rows);
    expect(out[0].ended_at).toBeNull();

    const closed = foldVisits([seg("04:00:00", "04:05:00")]);
    expect(closed[0].ended_at).not.toBeNull();
  });

  it("결과는 시작 시각 오름차순", () => {
    const rows = [
      seg("06:00:00", "06:05:00", { visit_key: "tab-2" }),
      seg("04:00:00", "04:05:00", { visit_key: "tab-1" })
    ];
    const out = foldVisits(rows);
    expect(sStart(out[0])).toBeLessThan(sStart(out[1]));
  });
});

// ── 자정(KST) 경계 ──
// 켜둔 탭이 자정을 넘기면 비콘이 새 방문 키를 발급한다(키에 KST 날짜가 박혀 있다). 접기가 그걸
// 무시하고 합치면 하루 집계가 이웃 날로 샌다 — 조용히 어긋나는 종류라 여기서 못박는다.
describe("자정을 넘긴 탭", () => {
  const beforeMidnight: SessionRow = {
    day: "2026-08-04",
    role: "owner",
    device: "desktop",
    account_hash: ACCT,
    started_at: "2026-08-04T14:30:00.000Z", // KST 23:30
    last_seen_at: "2026-08-04T14:59:00.000Z", // KST 23:59
    ended_at: "2026-08-04T14:59:00.000Z",
    visit_key: "tab-day1"
  };
  const afterMidnight: SessionRow = {
    ...beforeMidnight,
    day: "2026-08-05",
    started_at: "2026-08-04T15:01:00.000Z", // KST 00:01 (다음날)
    last_seen_at: "2026-08-04T15:20:00.000Z",
    ended_at: "2026-08-04T15:20:00.000Z",
    visit_key: "tab-day2"
  };

  it("서로 다른 날의 방문은 합치지 않는다", () => {
    const out = foldVisits([beforeMidnight, afterMidnight]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.day)).toEqual(["2026-08-04", "2026-08-05"]);
  });

  it("겹치는 시간이라도 날이 다르면 따로 센다(같은 계정이어도)", () => {
    const overlapping = { ...afterMidnight, started_at: beforeMidnight.last_seen_at };
    const out = foldVisits([beforeMidnight, overlapping]);
    expect(out).toHaveLength(2);
  });

  it("같은 날 같은 탭의 구간은 여전히 하나로 접힌다(회귀 방지)", () => {
    const later = { ...beforeMidnight, started_at: "2026-08-04T14:59:30.000Z" };
    const out = foldVisits([beforeMidnight, later]);
    expect(out).toHaveLength(1);
  });
});
