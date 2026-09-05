import { describe, expect, it } from "vitest";
import { SCENARIOS, SEASON_MONTH, SMOKE_IDS } from "../../scripts/ambient-qa/scenarios.mjs";
import { SEASON_KEYS, seasonOfMonth } from "@/components/shared/ambient/registry";
import { isBiomeKey } from "@/components/shared/ambient/world/biomes";
import { DAY_BANDS } from "@/components/shared/ambient/world/time";
import { weatherOptionsForMonth } from "@/components/shared/ambient/world/weather";
import { SEASON_MONTH as FIXTURE_SEASON_MONTH } from "@/components/shared/ambient/biome-fixture";

// 비주얼 QA 하네스의 시나리오 표(scripts/ambient-qa/scenarios.mjs)가 엔진의 키·규칙과 어긋나지 않는지 — 표가 틀리면
// 캡처가 조용히 기본값(초원·봄·점심·맑음)으로 떨어져 검사가 다른 장면을 본다.
describe("ambient-qa — 대표 시나리오 표", () => {
  it("프로토콜 §4.2의 16개, id는 1~16 유일", () => {
    expect(SCENARIOS.length).toBe(16);
    expect([...new Set(SCENARIOS.map((s) => s.id))].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
  it("바이옴·계절·시간대 키가 엔진 것과 같다", () => {
    for (const s of SCENARIOS) {
      expect(isBiomeKey(s.biome), `${s.id} biome ${s.biome}`).toBe(true);
      expect((SEASON_KEYS as readonly string[]).includes(s.season), `${s.id} season ${s.season}`).toBe(true);
      expect((DAY_BANDS as readonly string[]).includes(s.band), `${s.id} band ${s.band}`).toBe(true);
    }
  });
  it("날씨는 fixture가 보는 달의 허용 표 안(여름 눈 같은 금지 조합 없음)", () => {
    for (const s of SCENARIOS) {
      const allowed = weatherOptionsForMonth(SEASON_MONTH[s.season]);
      expect(allowed, `${s.id} ${s.season}/${s.weather}`).toContain(s.weather);
    }
  });
  it("계절 → 달 표가 fixture 컴포넌트와 같고, 그 달의 계절 판정이 맞는다", () => {
    expect(SEASON_MONTH).toEqual(FIXTURE_SEASON_MONTH);
    for (const season of SEASON_KEYS) expect(seasonOfMonth(SEASON_MONTH[season])).toBe(season);
  });
  it("스모크 셋은 표 안에 있고 바이옴 성격이 서로 다르다", () => {
    const smoke = SMOKE_IDS.map((id) => SCENARIOS.find((s) => s.id === id));
    expect(smoke.every(Boolean)).toBe(true);
    expect(new Set(smoke.map((s) => s!.biome)).size).toBe(SMOKE_IDS.length);
  });
});
