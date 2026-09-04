import { describe, expect, it } from "vitest";
import { bandOf, worldTime } from "@/components/shared/ambient/world/time";
import { weatherAt } from "@/components/shared/ambient/world/weather";
import { CHRONICLE_EPOCH, TREE_CAP, TREE_LIFESPAN, chronicle, chronicleDay, cycleOf, debutHeightCm } from "@/components/shared/ambient/world/chronicle";
import { SpawnDirector, type SpawnCtx } from "@/components/shared/ambient/world/rarity";
import { hashSeed } from "@/components/shared/ambient/world/seed";
import { visibleTraces, WORLD_FLAGS } from "@/components/shared/ambient/world/flags";

describe("world/flags — 나무 계열 스위치(2026-09-04 소유자: 일단 빼 두자)", () => {
  it("스위치가 꺼져 있으면 저장소·싹·묘목·나무·데뷔 나무는 화면 흔적에서 빠지고 두더지·눈사람·연잎은 남는다", () => {
    expect(WORLD_FLAGS.treeChain).toBe(false);
    const all = [...chronicle("vic", 2026, 5, 31), ...chronicle("vic", 2026, 8, 31), ...chronicle("vic", 2026, 1, 10)];
    const kinds = new Set(all.map((t) => t.kind));
    expect(kinds.has("debut")).toBe(true);
    const shown = visibleTraces(all);
    for (const t of shown) expect(["molehill", "snowman", "lilypad"]).toContain(t.kind);
    expect(shown.some((t) => t.kind === "molehill")).toBe(true);
    expect(shown.some((t) => t.kind === "lilypad")).toBe(true);
    expect(shown.some((t) => t.kind === "snowman")).toBe(true);
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
    const a = weatherAt("vic", "summer", 2026, 7, 14, 10);
    const b = weatherAt("vic", "summer", 2026, 7, 14, 11);
    expect(a.now).toBe(b.now);
    expect(a.segment).toBe(0);
    expect(weatherAt("vic", "summer", 2026, 7, 14, 15).segment).toBe(1);
  });
  it("계절 표를 따른다 — 겨울엔 비가 없고 여름엔 눈이 없다", () => {
    for (let d = 1; d <= 28; d++) {
      expect(weatherAt("vic", "winter", 2026, 1, d, 9).now).not.toBe("rain");
      expect(weatherAt("vic", "summer", 2026, 7, d, 15).now).not.toBe("snow");
    }
  });
  it("오후의 prev는 오전, 오전의 prev는 전날 오후", () => {
    const pm = weatherAt("vic", "spring", 2026, 4, 10, 15);
    const am = weatherAt("vic", "spring", 2026, 4, 10, 9);
    expect(pm.prev).toBe(am.now);
    const prevPm = weatherAt("vic", "spring", 2026, 4, 9, 15);
    expect(am.prev).toBe(prevPm.now);
  });
});

describe("world/chronicle — 도토리 하나의 연대기", () => {
  it("결정적: 같은 입력 = 같은 흔적", () => {
    const a = JSON.stringify(chronicle("vic", 2026, 4, 20));
    const b = JSON.stringify(chronicle("vic", 2026, 4, 20));
    expect(a).toBe(b);
    expect(a).not.toBe(JSON.stringify(chronicle("other", 2026, 4, 20)));
  });
  it("주기: 9~12월은 그 해, 1~8월은 전 해", () => {
    expect(cycleOf(2025, 10)).toBe(2025);
    expect(cycleOf(2026, 2)).toBe(2025);
    expect(cycleOf(2026, 8)).toBe(2025);
  });
  it("2025년 10월 저장소 자리에 2026년 봄 싹이 나고, 여름 묘목, 그 다음 가을 나무가 된다(같은 좌표)", () => {
    const caches = chronicle("vic", 2025, 11, 30).filter((t) => t.kind === "cache");
    expect(caches.length).toBeGreaterThanOrEqual(4);
    const sprouts = chronicle("vic", 2026, 5, 31).filter((t) => t.kind === "sprout");
    expect(sprouts.length).toBeGreaterThan(0);
    for (const s of sprouts) {
      const src = caches.find((c) => c.u === s.u && c.v === s.v);
      expect(src).toBeDefined();
    }
    const saplings = chronicle("vic", 2026, 7, 15).filter((t) => t.kind === "sapling");
    expect(saplings.map((t) => t.u).sort()).toEqual(sprouts.map((t) => t.u).sort());
    const trees = chronicle("vic", 2026, 10, 15).filter((t) => t.kind === "tree" && t.cycle === 2025);
    expect(trees.map((t) => t.u).sort()).toEqual(sprouts.map((t) => t.u).sort());
    expect(trees.every((t) => t.stage === 1)).toBe(true);
  });
  it("가을 저장소는 날이 갈수록 늘고, 겨울엔 숨었다가 2월 15일부터 다시 보인다", () => {
    const early = chronicle("vic", 2025, 9, 3).filter((t) => t.kind === "cache").length;
    const late = chronicle("vic", 2025, 11, 30).filter((t) => t.kind === "cache").length;
    expect(late).toBeGreaterThanOrEqual(early);
    expect(chronicle("vic", 2026, 1, 20).filter((t) => t.kind === "cache").length).toBe(0);
    expect(chronicle("vic", 2026, 2, 20).filter((t) => t.kind === "cache").length).toBe(late);
  });
  it("나무는 상한을 넘지 않고, 수명 안의 자리는 안정적이며, 여섯 주기 뒤엔 떠나 세대가 돈다", () => {
    for (const y of [2030, 2035, 2040]) expect(chronicle("vic", y, 10, 1).filter((t) => t.kind === "tree").length).toBeLessThanOrEqual(TREE_CAP);
    const young = chronicle("vic", 2036, 10, 1).filter((t) => t.kind === "tree" && t.stage <= 2);
    const later = chronicle("vic", 2039, 10, 1).filter((t) => t.kind === "tree");
    for (const t of young) expect(later.some((f) => f.id === t.id)).toBe(true);
    // 첫 도토리 나무(2025 주기)는 2026 가을에 서고 2033 가을엔 떠났다.
    const first = chronicle("vic", 2026, 10, 1).filter((t) => t.kind === "tree");
    expect(first.length).toBeGreaterThan(0);
    const gone = chronicle("vic", 2026 + TREE_LIFESPAN + 1, 10, 1).filter((t) => t.kind === "tree");
    for (const t of first) expect(gone.some((f) => f.id === t.id)).toBe(false);
    // 떠난 자리만큼 새 싹이 난다 — 2040년까지 누적 나무 id가 상한보다 많다.
    const ids = new Set<string>();
    for (let y = 2026; y <= 2040; y++) for (const t of chronicle("vic", y, 10, 1)) if (t.kind === "tree") ids.add(t.id);
    expect(ids.size).toBeGreaterThan(TREE_CAP);
    // 데뷔 전엔 도토리 나무가 없다(첫 가을 = 2025).
    expect(chronicle("vic", CHRONICLE_EPOCH, 10, 1).filter((t) => t.kind === "tree").length).toBe(0);
  });
  it("세계는 2023년 5월에 생긴다 — 그 전엔 흔적이 없고, 그 달부터 데뷔 나무의 씨앗(흙더미)이 있다", () => {
    expect(chronicle("vic", 2023, 4, 30)).toEqual([]);
    const seed = chronicle("vic", 2023, 5, 1).find((t) => t.kind === "debut");
    expect(seed?.stage).toBe(0);
    expect(chronicle("vic", 2025, 9, 30).find((t) => t.kind === "debut")?.stage).toBe(0);
  });
  it("데뷔 나무 — 2025-10-01 싹(4cm), 그 해 겨울 14cm, 2026-09-04 ≈ 45cm, 겨울엔 자라지 않고, 해마다 커져 20m에서 멈춘다", () => {
    expect(debutHeightCm(2025, 10, 1)).toBe(4);
    expect(debutHeightCm(2025, 12, 30)).toBe(14);
    const now = debutHeightCm(2026, 9, 4);
    expect(now).toBeGreaterThanOrEqual(38);
    expect(now).toBeLessThanOrEqual(50);
    expect(debutHeightCm(2026, 12, 1)).toBe(debutHeightCm(2027, 3, 1)); // 겨울 정지
    let prev = 0;
    for (let y = 2025; y <= 2060; y++) {
      for (const m of [1, 4, 7, 10]) {
        const h = debutHeightCm(y, m, 15);
        expect(h).toBeGreaterThanOrEqual(prev);
        prev = h;
      }
    }
    expect(debutHeightCm(2030, 10, 1)).toBeGreaterThan(280);
    expect(debutHeightCm(2090, 10, 1)).toBe(2000);
    expect(chronicle("vic", 2026, 9, 4).find((t) => t.kind === "debut")?.stage).toBe(now);
  });
  it("눈사람은 12월 20일 공 하나, 27일 완성, 2월 25일 사라진다; 연잎은 6→8월 늘어난다", () => {
    const st = (y: number, m: number, d: number) => chronicle("vic", y, m, d).find((t) => t.kind === "snowman")?.stage ?? 0;
    expect(st(2025, 12, 19)).toBe(0);
    expect(st(2025, 12, 20)).toBe(1);
    expect(st(2025, 12, 27)).toBe(3);
    expect(st(2026, 1, 10)).toBe(3);
    expect(st(2026, 2, 26)).toBe(0);
    const lily = (m: number, d: number) => chronicle("vic", 2026, m, d).filter((t) => t.kind === "lilypad").length;
    expect(lily(6, 2)).toBe(3);
    expect(lily(8, 28)).toBe(12);
  });
  it("모든 흔적은 달력 밖 띠(위·아래·좌우 여백)에 있고 나무는 위 띠에만", () => {
    for (const y of [2025, 2026, 2027]) {
      for (const m of [2, 4, 7, 10, 12]) {
        for (const t of chronicle("vic", y, m, 20)) {
          const inBand = t.v <= 0.1 || t.v >= 0.9 || t.u <= 0.1 || t.u >= 0.9;
          expect(inBand).toBe(true);
          if (t.kind === "tree" || t.kind === "cache" || t.kind === "sprout" || t.kind === "sapling" || t.kind === "debut") expect(t.v).toBeLessThanOrEqual(0.1);
        }
      }
    }
  });
  it("chronicleDay — 현재 달은 오늘, 과거 달은 말일, 미래 달은 1일", () => {
    const today = { y: 2026, m: 9, d: 4 };
    expect(chronicleDay(2026, 9, today)).toBe(4);
    expect(chronicleDay(2026, 8, today)).toBe(31);
    expect(chronicleDay(2026, 2, today)).toBe(28);
    expect(chronicleDay(2026, 12, today)).toBe(1);
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
