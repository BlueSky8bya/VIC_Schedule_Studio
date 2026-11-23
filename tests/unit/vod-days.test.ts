import { describe, expect, it } from "vitest";
import { groupVodsByDay, vodDayFor, vodDayStartLabel, vodDays, vodShownDays } from "@/lib/schedules/vod-days";

// 다시보기 날짜 규칙(2026-11-23 소유자): 하루 = 그날 일출 ~ 다음 날 일출(서울), 걸친 모든 날에 보인다.
// 아래 날짜들의 일출: 11-11 07:06 · 11-14 07:10 · 11-21 07:17 · 11-22 07:18 · 11-23 07:19.
const kst = (s: string) => new Date(`${s}+09:00`).toISOString();
const vod = (titleNo: number, dateKey: string, start: string, hours: number) => ({
  titleNo, dateKey, startedAt: kst(start), durationMs: Math.round(hours * 3_600_000)
});
const H = 3600;

describe("하루의 시작 = 그날 일출", () => {
  it("계절 따라 움직인다 — 하지 무렵 5시대, 한겨울 7시 후반", () => {
    expect(vodDayStartLabel("2026-06-21")).toBe("오전 5시 10분");
    expect(vodDayStartLabel("2026-01-05")).toBe("오전 7시 47분");
    expect(vodDayStartLabel("2026-11-21")).toBe("오전 7시 17분");
  });
});

describe("vodDays", () => {
  it("평소 방송은 시작일 한 칸 — 새벽에 끝나도 다음 날로 넘어가지 않는다", () => {
    expect(vodDays(vod(1, "2026-11-19", "2026-11-19T13:42:00", 11.68))).toEqual([{ dateKey: "2026-11-19", sec: 0 }]);
  });

  it("새벽에 시작한 평소 방송도 저장된 시작일 그대로다(일출 경계로 하루 당기지 않는다)", () => {
    expect(vodDays(vod(1, "2026-11-10", "2026-11-10T02:00:00", 3))).toEqual([{ dateKey: "2026-11-10", sec: 0 }]);
  });

  it("일출을 조금 넘겨 끝난 방송은 다음 날 칸에 안 뜬다(한 시간 미만)", () => {
    // 10일 20:00 ~ 11일 08:00 — 11일 일출 07:06 뒤로 54분. 6시 고정이던 때는 이틀에 걸쳐 보였다.
    expect(vodDays(vod(1, "2026-11-10", "2026-11-10T20:00:00", 12))).toEqual([{ dateKey: "2026-11-10", sec: 0 }]);
  });

  it("2026-11-20 노뱅종 첫 편(20일 16:30 ~ 21일 17:03) — 20일은 처음부터, 21일은 일출(07:17) 지점부터", () => {
    expect(vodDays(vod(213217565, "2026-11-20", "2026-11-20T16:30:00", 24.55))).toEqual([
      { dateKey: "2026-11-20", sec: 0 },
      { dateKey: "2026-11-21", sec: 14 * H + 47 * 60 }
    ]);
  });

  it("둘째 편(22일 01:50 ~ 23일 05:38, 저장된 시작일은 20일) — 21·22일에 보이고 20·23일에는 안 보인다", () => {
    const days = vodDays(vod(213369219, "2026-11-20", "2026-11-22T01:50:00", 27.8));
    expect(days).toEqual([
      { dateKey: "2026-11-21", sec: 0 },
      { dateKey: "2026-11-22", sec: 5 * H + 28 * 60 }
    ]);
  });

  it("시작 시각을 모르면(업로드 영상 등) 저장된 날짜 그대로", () => {
    expect(vodDays({ dateKey: "2026-11-20", durationMs: 90 * 3_600_000 })).toEqual([{ dateKey: "2026-11-20", sec: 0 }]);
  });

  it("이어진 방송의 뒤쪽 편이 하루에만 걸치면 실제 방송한 날에 보인다 (2026-11-13 방송의 2부)", () => {
    expect(vodDays(vod(212575071, "2026-11-13", "2026-11-13T14:30:00", 20.17))).toEqual([
      { dateKey: "2026-11-13", sec: 0 },
      { dateKey: "2026-11-14", sec: 16 * H + 40 * 60 }
    ]);
    expect(vodDays(vod(212613955, "2026-11-13", "2026-11-14T10:40:00", 9.94))).toEqual([{ dateKey: "2026-11-14", sec: 0 }]);
  });

  it("며칠 뒤에 올린 영상은 저장된 날 그대로다 (2025-10-25 방송을 10-29에 올린 편)", () => {
    expect(vodDays(vod(176252663, "2025-10-25", "2025-10-29T17:48:00", 2.7))).toEqual([{ dateKey: "2025-10-25", sec: 0 }]);
  });
});

describe("groupVodsByDay", () => {
  const first = vod(213217565, "2026-11-20", "2026-11-20T16:30:00", 24.55);
  const second = vod(213369219, "2026-11-20", "2026-11-22T01:50:00", 27.8);
  const map = groupVodsByDay([second, first]);

  it("걸친 날마다 넣고, 그날 시작 지점을 단다", () => {
    expect(map.get("2026-11-20")?.map((v) => [v.titleNo, v.daySec])).toEqual([[213217565, undefined]]);
    expect(map.get("2026-11-21")?.map((v) => [v.titleNo, v.daySec])).toEqual([[213217565, 53220], [213369219, undefined]]);
    expect(map.get("2026-11-22")?.map((v) => [v.titleNo, v.daySec])).toEqual([[213369219, 19680]]);
    expect(map.has("2026-11-23")).toBe(false);
  });

  // 한 방송이 여러 편(같은 방송 번호)이면 걸친 날마다 모든 편이 보인다. 먼저 열리는 편: 그날 새로 켠 방송, 없으면 그날 가장 오래 나온 편.
  describe("한 방송의 여러 편", () => {
    const row = (list: ReturnType<typeof groupVodsByDay<typeof first & { broadcastNo?: number }>> extends Map<string, infer L> ? L : never) =>
      list.map((v) => [v.titleNo, v.daySec ?? 0, v.dayFocus ? "먼저" : "", v.dayExtra ? "덤" : ""].filter((x) => x !== "").join(" "));
    const p1 = { ...first, broadcastNo: 298730939 };
    const p2 = { ...second, broadcastNo: 298730939 };
    const days = groupVodsByDay([p2, p1]);

    it("20·21·22일 모두 1·2부가 있고, 먼저 열 편과 지점이 그날 일출에 맞는다", () => {
      // 20일 = 그날 켠 방송(1부) 처음부터. 21일 = 새로 켠 방송 없음 → 그날 가장 오래 나온 1부를 일출 지점부터.
      // 22일 = 2부를 일출 지점부터.
      expect(row(days.get("2026-11-20")!)).toEqual(["213217565 0 먼저", "213369219 0 덤"]);
      expect(row(days.get("2026-11-21")!)).toEqual(["213217565 53220 먼저", "213369219 0"]);
      expect(row(days.get("2026-11-22")!)).toEqual(["213217565 0 덤", "213369219 19680 먼저"]);
      expect(days.has("2026-11-23")).toBe(false);
    });

    it("13일 방송의 2부는 13·14일 모두에 1부와 함께 선다", () => {
      const a = { ...vod(212575071, "2026-11-13", "2026-11-13T14:30:00", 20.17), broadcastNo: 298561019 };
      const b = { ...vod(212613955, "2026-11-13", "2026-11-14T10:40:00", 9.94), broadcastNo: 298561019 };
      const m = groupVodsByDay([a, b]);
      expect(row(m.get("2026-11-13")!)).toEqual(["212575071 0 먼저", "212613955 0 덤"]);
      // 14일은 2부가 먼저 — 14일에 1부는 3시간 30분(07:10~10:40), 2부는 10시간(10:40~20:37) 나왔다. 썸네일 날짜와도 맞는다.
      expect(row(m.get("2026-11-14")!)).toEqual(["212575071 60000", "212613955 0 먼저"]);
    });

    it("따로 켠 방송은 묶이지 않는다 — 아침 9시에 끝난 방송과 그날 저녁 방송", () => {
      const night = { ...vod(1, "2026-11-10", "2026-11-10T20:00:00", 13), broadcastNo: 100 }; // 10일 20시 ~ 11일 09시
      const evening = { ...vod(2, "2026-11-11", "2026-11-11T19:00:00", 4), broadcastNo: 200 };
      const m = groupVodsByDay([night, evening]);
      expect(row(m.get("2026-11-10")!)).toEqual(["1 0"]);
      // 11일에는 그날 새로 켠 저녁 방송이 먼저 열린다(처음부터) — 넘어온 밤 방송은 1부로 남아 있고 고르면 일출(07:06) 지점부터.
      expect(row(m.get("2026-11-11")!)).toEqual(["1 39960", "2 0 먼저"]);
    });

    it("아침 8시에 끝난 밤 방송은 그날 일출 뒤로 한 시간이 안 돼 전날에만 선다", () => {
      const night = { ...vod(1, "2026-11-10", "2026-11-10T20:00:00", 12), broadcastNo: 100 };
      const evening = { ...vod(2, "2026-11-11", "2026-11-11T19:00:00", 4), broadcastNo: 200 };
      const m = groupVodsByDay([night, evening]);
      expect(row(m.get("2026-11-10")!)).toEqual(["1 0"]);
      expect(row(m.get("2026-11-11")!)).toEqual(["2 0"]);
    });

    it("넘어온 방송이 그날 더 길게 나왔어도, 그날 새로 켠 방송이 먼저다", () => {
      const night = { ...vod(1, "2026-11-10", "2026-11-10T22:00:00", 14), broadcastNo: 100 }; // ~ 11일 12시(그날 5시간 가까이)
      const evening = { ...vod(2, "2026-11-11", "2026-11-11T20:00:00", 3), broadcastNo: 200 };
      expect(row(groupVodsByDay([night, evening]).get("2026-11-11")!)).toEqual(["1 32760", "2 0 먼저"]);
    });

    it("하루에 따로 켠 방송이 둘이면 먼저 켠 쪽", () => {
      const morning = { ...vod(1, "2026-11-15", "2026-11-15T09:30:00", 4.5), broadcastNo: 7 };
      const evening = { ...vod(2, "2026-11-15", "2026-11-15T18:34:00", 4.5), broadcastNo: 8 };
      expect(row(groupVodsByDay([evening, morning]).get("2026-11-15")!)).toEqual(["1 0 먼저", "2 0"]);
    });

    it("하루 안에 끝난 여러 편은 그날에만, 첫 편이 먼저", () => {
      const a = { ...vod(1, "2026-11-15", "2026-11-15T09:30:00", 4.5), broadcastNo: 7 };
      const b = { ...vod(2, "2026-11-15", "2026-11-15T14:10:00", 4.5), broadcastNo: 7 };
      expect(row(groupVodsByDay([a, b]).get("2026-11-15")!)).toEqual(["1 0 먼저", "2 0"]);
    });

    it("창 필터용 — 다른 편 때문에 보이는 날도 센다", () => {
      expect(vodShownDays([p1, p2]).get(213369219)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
    });
  });

  it("검색이 옛 시작일을 들고 와도 보이는 날로 바꿔 준다", () => {
    expect(vodDayFor(second, "2026-11-20")).toBe("2026-11-21");
    expect(vodDayFor(second, "2026-11-22")).toBe("2026-11-22");
    expect(vodDayFor(first, "2026-11-20")).toBe("2026-11-20");
  });
});
