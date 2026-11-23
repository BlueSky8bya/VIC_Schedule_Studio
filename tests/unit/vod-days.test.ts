import { describe, expect, it } from "vitest";
import { groupVodsByDay, vodDayFor, vodDays } from "@/lib/schedules/vod-days";

// 다시보기 날짜 규칙(2026-11-23 소유자): 하루 = 오전 6시 ~ 다음날 오전 6시(KST), 걸친 모든 날에 보인다.
const kst = (s: string) => new Date(`${s}+09:00`).toISOString();
const vod = (titleNo: number, dateKey: string, start: string, hours: number) => ({
  titleNo, dateKey, startedAt: kst(start), durationMs: Math.round(hours * 3_600_000)
});

describe("vodDays", () => {
  it("평소 방송은 시작일 한 칸 — 새벽에 끝나도 다음 날로 넘어가지 않는다", () => {
    expect(vodDays(vod(1, "2026-11-19", "2026-11-19T13:42:00", 11.68))).toEqual([{ dateKey: "2026-11-19", sec: 0 }]);
  });

  it("새벽에 시작한 평소 방송도 저장된 시작일 그대로다(6시 경계로 하루 당기지 않는다)", () => {
    expect(vodDays(vod(1, "2026-11-10", "2026-11-10T02:00:00", 3))).toEqual([{ dateKey: "2026-11-10", sec: 0 }]);
  });

  it("오전 6시를 조금 넘겨 끝난 방송은 다음 날 칸에 안 뜬다(한 시간 미만)", () => {
    expect(vodDays(vod(1, "2026-11-10", "2026-11-10T20:00:00", 10.4))).toEqual([{ dateKey: "2026-11-10", sec: 0 }]);
  });

  it("2026-11-20 노뱅종 첫 편(20일 16:30 ~ 21일 17:03) — 20일은 처음부터, 21일은 오전 6시 지점부터", () => {
    expect(vodDays(vod(213217565, "2026-11-20", "2026-11-20T16:30:00", 24.55))).toEqual([
      { dateKey: "2026-11-20", sec: 0 },
      { dateKey: "2026-11-21", sec: 13.5 * 3600 }
    ]);
  });

  it("둘째 편(22일 01:50 ~ 23일 05:38, 저장된 시작일은 20일) — 21·22일에 보이고 20·23일에는 안 보인다", () => {
    const days = vodDays(vod(213369219, "2026-11-20", "2026-11-22T01:50:00", 27.8));
    expect(days).toEqual([
      { dateKey: "2026-11-21", sec: 0 },
      { dateKey: "2026-11-22", sec: 4 * 3600 + 10 * 60 }
    ]);
  });

  it("시작 시각을 모르면(업로드 영상 등) 저장된 날짜 그대로", () => {
    expect(vodDays({ dateKey: "2026-11-20", durationMs: 90 * 3_600_000 })).toEqual([{ dateKey: "2026-11-20", sec: 0 }]);
  });
});

describe("groupVodsByDay", () => {
  const first = vod(213217565, "2026-11-20", "2026-11-20T16:30:00", 24.55);
  const second = vod(213369219, "2026-11-20", "2026-11-22T01:50:00", 27.8);
  const map = groupVodsByDay([second, first]);

  it("걸친 날마다 넣고, 그날 시작 지점을 단다", () => {
    expect(map.get("2026-11-20")?.map((v) => [v.titleNo, v.daySec])).toEqual([[213217565, undefined]]);
    expect(map.get("2026-11-21")?.map((v) => [v.titleNo, v.daySec])).toEqual([[213217565, 48600], [213369219, undefined]]);
    expect(map.get("2026-11-22")?.map((v) => [v.titleNo, v.daySec])).toEqual([[213369219, 15000]]);
    expect(map.has("2026-11-23")).toBe(false);
  });

  it("검색이 옛 시작일을 들고 와도 보이는 날로 바꿔 준다", () => {
    expect(vodDayFor(second, "2026-11-20")).toBe("2026-11-21");
    expect(vodDayFor(second, "2026-11-22")).toBe("2026-11-22");
    expect(vodDayFor(first, "2026-11-20")).toBe("2026-11-20");
  });
});
