// 도감 세 권(2026-09-07, PLAN-20260907-008) — 이 표는 **놀이의 규칙**이라 어긋나면 조용히 재미가 죽는다.
// "어느 바이옴에도 안 사는 종", "여름에 나오는데 겨울 자리에만 그려진 종", "아무 때도 아닌 종" 같은 것은
// 화면에서 그냥 **안 나올** 뿐이라 눈으로는 절대 못 찾는다. 그래서 여기서 잡는다.
import { describe, expect, it } from "vitest";
import { ART_SLOTS } from "@/components/shared/ambient/art/manifest";
import { BIOMES } from "@/components/shared/ambient/world/biomes";
import { CODEX, CODEX_KINDS, codexAvailable, codexById, codexOf, MONTHS_ALL } from "@/components/shared/ambient/world/codex";
import { DAY_BANDS } from "@/components/shared/ambient/world/time";
import { weatherOptionsForMonth } from "@/components/shared/ambient/world/weather";

describe("world/codex — 도감 세 권", () => {
  it("id는 유일하고 종류 접두사를 지킨다", () => {
    const ids = CODEX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of CODEX) {
      expect(e.id, e.nameKo).toMatch(/^[a-z0-9-]+$/);
      expect(e.id.startsWith(`${e.kind}-`), `${e.id}는 ${e.kind}- 로 시작해야 한다`).toBe(true);
    }
  });

  it("세 권 모두 채워져 있고, 물고기·곤충·동물이 각각 서른 종을 넘는다", () => {
    for (const k of CODEX_KINDS) expect(codexOf(k).length, k).toBeGreaterThanOrEqual(30);
  });

  it("모든 종이 실재하는 바이옴에 살고, 달·시간대가 비어 있지 않다", () => {
    for (const e of CODEX) {
      expect(e.biomes.length, e.id).toBeGreaterThan(0);
      for (const b of e.biomes) expect(BIOMES[b], `${e.id} → ${b}`).toBeTruthy();
      expect(e.months.length, e.id).toBeGreaterThan(0);
      for (const mo of e.months) expect(MONTHS_ALL.includes(mo), `${e.id} 달 ${mo}`).toBe(true);
      expect(e.bands.length, e.id).toBeGreaterThan(0);
      for (const b of e.bands) expect(DAY_BANDS.includes(b), `${e.id} 띠 ${b}`).toBe(true);
      expect(e.sizeCm[0], e.id).toBeGreaterThan(0);
      expect(e.sizeCm[1], e.id).toBeGreaterThanOrEqual(e.sizeCm[0]);
    }
  });

  it("날씨 조건은 그 달에 실제로 생길 수 있는 날씨여야 한다 — 아니면 영원히 안 나온다", () => {
    for (const e of CODEX) {
      if (!e.weather) continue;
      const possible = new Set(e.months.flatMap((mo) => weatherOptionsForMonth(mo)));
      const reachable = e.weather.filter((w) => possible.has(w));
      expect(reachable.length, `${e.id}: ${e.weather.join("·")} 중 그 달에 가능한 것이 없다`).toBeGreaterThan(0);
    }
  });

  it("깊은 바다의 종만 옆모습이다 — 그 장면만 카메라가 다르다(CLAUDE.md 예외)", () => {
    for (const e of CODEX) {
      if (e.view === "side") expect(e.biomes, e.id).toEqual(["deep"]);
      if (e.biomes.includes("deep")) expect(e.view, e.id).toBe("side");
    }
  });

  it("물속 물고기는 실루엣이다 — 3/4 카메라에서 물고기는 위에서 본 그림자(CLAUDE.md)", () => {
    for (const e of CODEX) {
      if (e.kind !== "fish" || e.biomes.includes("deep")) continue;
      // 짱뚱어만 예외 — 물 밖 뻘 위를 뛰어다니는 물고기라 세워 그린다.
      if (e.id === "fish-mudskipper") continue;
      expect(e.view, e.id).toBe("shadow");
    }
  });

  it("모든 종에 아트 자리가 있다 — 도감과 자리 목록이 갈라지지 않는다", () => {
    for (const e of CODEX) {
      const slot = ART_SLOTS.find((s) => s.id === e.id);
      expect(slot, e.id).toBeTruthy();
      expect(slot?.phase, e.id).toBe(2);
      expect(slot?.category, e.id).toBe(e.kind);
      expect(slot?.brief, e.id).toBe(e.brief);
    }
  });

  it("살아 있는 종은 지금 화면에 무언가로 그려지고 있다", () => {
    for (const e of CODEX.filter((x) => x.live)) {
      const slot = ART_SLOTS.find((s) => s.id === e.id)!;
      expect(slot.now, `${e.id}: live인데 아무것도 안 그려진다`).not.toBe("none");
    }
  });

  it("바이옴마다 만날 것이 있다 — 열한 화면 어디에도 빈 화면은 없다", () => {
    for (const key of Object.keys(BIOMES)) {
      const here = CODEX.filter((e) => e.biomes.includes(key as keyof typeof BIOMES));
      expect(here.length, `${key}에 사는 종이 없다`).toBeGreaterThanOrEqual(4);
    }
  });

  it("사철·종일 종은 언제 가도 만날 수 있다(도감의 첫 걸음)", () => {
    const chub = codexById("fish-palechub")!;
    expect(codexAvailable(chub, { biome: "valley", month: 1, band: "night", weather: "snow" })).toBe(true);
    expect(codexAvailable(chub, { biome: "valley", month: 7, band: "noon", weather: "clear" })).toBe(true);
    // 사는 곳이 아니면 안 나온다.
    expect(codexAvailable(chub, { biome: "deep", month: 7, band: "noon", weather: "clear" })).toBe(false);
  });

  it("조건이 붙은 종은 조건 밖에서 안 나온다", () => {
    const beetle = codexById("bug-rhinobeetle")!; // 7~8월 밤, 숲
    expect(codexAvailable(beetle, { biome: "forest", month: 7, band: "night", weather: "clear" })).toBe(true);
    expect(codexAvailable(beetle, { biome: "forest", month: 7, band: "noon", weather: "clear" })).toBe(false);
    expect(codexAvailable(beetle, { biome: "forest", month: 3, band: "night", weather: "clear" })).toBe(false);
    expect(codexAvailable(beetle, { biome: "meadow", month: 7, band: "night", weather: "clear" })).toBe(false);
  });

  it("비 온 뒤에만 나오는 종은 직전 마디가 비였을 때만 나온다", () => {
    const snail = codexById("bug-snail")!;
    const base = { biome: "forest", month: 6, band: "noon" } as const;
    expect(codexAvailable(snail, { ...base, weather: "clear", prevWeather: "rain" })).toBe(true);
    expect(codexAvailable(snail, { ...base, weather: "clear", prevWeather: "clear" })).toBe(false);
    // 아직 비가 오는 중이면 아니다 — 그친 뒤에 나온다.
    expect(codexAvailable(snail, { ...base, weather: "rain", prevWeather: "rain" })).toBe(false);
  });

  it("생성 차수는 1~3이고, 1차에는 바이옴마다 적어도 하나가 있다", () => {
    for (const e of CODEX) expect([1, 2, 3]).toContain(e.wave);
    for (const key of Object.keys(BIOMES)) {
      const first = CODEX.filter((e) => e.wave === 1 && e.biomes.includes(key as keyof typeof BIOMES));
      expect(first.length, `${key}에 1차 종이 없다 — 그 화면은 마지막까지 비어 보인다`).toBeGreaterThan(0);
    }
  });
});
