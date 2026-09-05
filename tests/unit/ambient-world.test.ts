import { describe, expect, it } from "vitest";
import { bandOf, worldTime } from "@/components/shared/ambient/world/time";
import { monthTable, weatherAt, weatherOptionsForMonth } from "@/components/shared/ambient/world/weather";
import { monthTraces } from "@/components/shared/ambient/world/traces";
import { SpawnDirector, type SpawnCtx } from "@/components/shared/ambient/world/rarity";
import { hashSeed } from "@/components/shared/ambient/world/seed";

describe("world/traces — 달의 흔적(2026-09-05 연대기 철거)", () => {
  it("결정적: 같은 (달력, 연, 달)이면 같은 흔적", () => {
    expect(JSON.stringify(monthTraces("vic", 2026, 4))).toBe(JSON.stringify(monthTraces("vic", 2026, 4)));
    expect(JSON.stringify(monthTraces("vic", 2026, 4))).not.toBe(JSON.stringify(monthTraces("other", 2026, 4)));
  });
  it("나무 계열(저장소·싹·묘목·나무·데뷔)은 더 이상 존재하지 않는다", () => {
    const kinds = new Set<string>();
    for (let m = 1; m <= 12; m++) for (const t of monthTraces("vic", 2026, m)) kinds.add(t.kind);
    expect([...kinds].sort()).toEqual(["lilypad", "molehill", "snowman"]);
  });
  it("두더지 흙더미 — 봄에 늘고(3→4→5월), 여름엔 풀 얼룩", () => {
    const n = (m: number) => monthTraces("vic", 2026, m).filter((t) => t.kind === "molehill");
    expect(n(2).length).toBe(0);
    expect(n(3).length).toBe(3);
    expect(n(4).length).toBe(6);
    expect(n(5).length).toBe(8);
    expect(n(5).every((t) => t.stage === 0)).toBe(true);
    expect(n(7).every((t) => t.stage === 1)).toBe(true);
    expect(n(9).length).toBe(0);
  });
  it("눈사람 — 12월 2단, 1월 완성, 2월 녹는 중, 그 밖엔 없음. 같은 겨울이면 자리가 같다", () => {
    const s12 = monthTraces("vic", 2026, 12).filter((t) => t.kind === "snowman");
    const s1 = monthTraces("vic", 2027, 1).filter((t) => t.kind === "snowman");
    const s2 = monthTraces("vic", 2027, 2).filter((t) => t.kind === "snowman");
    expect(s12[0].stage).toBe(2);
    expect(s1[0].stage).toBe(3);
    expect(s2[0].stage).toBe(1);
    expect([s1[0].u, s1[0].v]).toEqual([s12[0].u, s12[0].v]);
    expect(monthTraces("vic", 2026, 6).filter((t) => t.kind === "snowman").length).toBe(0);
  });
  it("연잎 — 6월 5 → 7월 9 → 8월 12장, 그 밖엔 없음", () => {
    const n = (m: number) => monthTraces("vic", 2026, m).filter((t) => t.kind === "lilypad").length;
    expect(n(5)).toBe(0);
    expect(n(6)).toBe(5);
    expect(n(7)).toBe(9);
    expect(n(8)).toBe(12);
    expect(n(9)).toBe(0);
  });
});

describe("world/time — 여섯 띠", () => {
  it("여름 5시 반은 새벽, 13시는 점심, 19시는 노을, 21시는 저녁, 1시는 밤", () => {
    expect(bandOf(5.5, "summer")).toBe("dawn");
    expect(bandOf(13, "summer")).toBe("noon");
    expect(bandOf(19, "summer")).toBe("dusk");
    expect(bandOf(21, "summer")).toBe("evening");
    expect(bandOf(1, "summer")).toBe("night");
  });
  it("겨울은 일출이 늦어 6시 반이 아직 밤이고 7시가 새벽", () => {
    expect(bandOf(5.5, "winter")).toBe("night");
    expect(bandOf(7, "winter")).toBe("dawn");
    expect(bandOf(9, "winter")).toBe("morning");
  });
  it("낮 띠는 빛 톤이 없고 밤은 청회색이며 노을은 주황이 아니다", () => {
    expect(worldTime("spring", 12).tint.alpha).toBe(0);
    const night = worldTime("spring", 23);
    expect(night.night).toBe(true);
    expect(night.tint.alpha).toBeGreaterThan(0.2);
    const [r, g, b] = worldTime("autumn", 17.5).tint.rgb.split(" ").map(Number);
    expect(r - b).toBeLessThan(20); // 회자색: 붉음이 파랑을 크게 앞서지 않는다
    expect(g).toBeGreaterThan(100);
  });
});

describe("world/weather — 날짜 시드 난수", () => {
  it("같은 달력·날·마디면 같은 날씨", () => {
    const a = weatherAt("vic", 2026, 7, 14, 10);
    const b = weatherAt("vic", 2026, 7, 14, 11);
    expect(a.now).toBe(b.now);
    expect(a.segment).toBe(0);
    expect(weatherAt("vic", 2026, 7, 14, 15).segment).toBe(1);
  });
  it("월별 평년값 표를 따른다 — 4~10월엔 눈이 0, 겨울 강수는 대부분 눈", () => {
    for (let d = 1; d <= 28; d++) {
      for (const m of [4, 5, 6, 7, 8, 9, 10]) expect(weatherAt("vic", 2026, m, d, 15).now).not.toBe("snow");
    }
    const p = (m: number) => Object.fromEntries(monthTable(m)) as Record<string, number>;
    // 표 자체가 계절 규칙이다(기상청 평년값 1991~2020 서울).
    expect(p(7).snow).toBe(0);
    expect(p(8).snow).toBe(0);
    expect(p(1).snow).toBeGreaterThan(p(1).rain * 4); // 1월 강수는 대부분 눈
    expect(p(7).rain).toBeGreaterThan(p(1).rain * 10); // 장마철(7월)이 가장 비가 잦다
    expect(p(10).clear).toBeGreaterThan(p(7).clear * 5); // 10월이 가장 맑고 7월이 가장 흐리다
    for (let m = 1; m <= 12; m++) {
      const sum = monthTable(m).reduce((a, [, v]) => a + v, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
  it("그 달에 고를 수 있는 날씨 목록 — 여름엔 눈이 빠진다", () => {
    expect(weatherOptionsForMonth(8)).not.toContain("snow");
    expect(weatherOptionsForMonth(1)).toContain("snow");
    expect(weatherOptionsForMonth(3)).toContain("snow"); // 3월엔 눈일수 1.6일이 남아 있다
  });
  it("오후의 prev는 오전, 오전의 prev는 전날 오후", () => {
    const pm = weatherAt("vic", 2026, 4, 10, 15);
    const am = weatherAt("vic", 2026, 4, 10, 9);
    expect(pm.prev).toBe(am.now);
    const prevPm = weatherAt("vic", 2026, 4, 9, 15);
    expect(am.prev).toBe(prevPm.now);
  });
});

describe("world/rarity — 스폰 감독", () => {
  const ctx = (now: number, active: Record<string, number> = {}, load = 1): SpawnCtx => ({
    band: "noon",
    weather: "clear",
    month: 6,
    load,
    active: new Map(Object.entries(active)),
    now
  });
  const entries = [
    { id: "sparrow", tier: "common" as const, max: 3 },
    { id: "cat", tier: "uncommon" as const, max: 1 },
    { id: "fox", tier: "epic" as const, max: 1, ok: (c: SpawnCtx) => c.weather === "snow" },
    { id: "shark", tier: "legend" as const, max: 1 }
  ];
  it("상한을 채운 종은 뜨지 않고, 조건에 안 맞는 종도 뜨지 않는다", () => {
    const d = new SpawnDirector(() => 0.999, {}, 0);
    // 0.999 → 가중치 끝쪽 = 가장 낮은 가중치 후보. sparrow 3마리 꽉 차고 cat 1마리면 남는 건 shark(legend) 뿐.
    expect(d.roll(entries, ctx(10, { sparrow: 3, cat: 1 }))).toBe("shark");
    // 전설은 세션당 한 번.
    expect(d.roll(entries, ctx(400, { sparrow: 3, cat: 1 }))).toBe(null);
  });
  it("가중치 — 0에 가까운 난수는 첫 후보(흔함)를 고른다", () => {
    const d = new SpawnDirector(() => 0.0001, {}, 0);
    expect(d.roll(entries, ctx(1))).toBe("sparrow");
  });
  it("자비 타이머 — 15분 넘게 드묾 이상이 없으면 드묾 이상만 후보", () => {
    const d = new SpawnDirector(() => 0.0001, { pity: 900 }, 0);
    expect(d.roll(entries, ctx(1000))).toBe("shark");
  });
  it("사건 간격 — 드묾 이상이 살아 있으면 다른 드묾 이상은 뜨지 않는다", () => {
    const d = new SpawnDirector(() => 0.999, { eventGap: 0 }, 0);
    expect(d.roll(entries, ctx(10, { sparrow: 3, cat: 1, fox: 1 }))).toBe(null);
  });
  it("seed — 같은 조각이면 같은 수열", () => {
    const a = hashSeed("vic", "x", 1);
    const b = hashSeed("vic", "x", 1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashSeed("vic", "x", 2)()).not.toBe(hashSeed("vic", "x", 1)());
  });
});
