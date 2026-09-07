import { describe, expect, it } from "vitest";
import { sunDay, sunPos } from "@/components/shared/ambient/world/sun";
import { bandPhase, DAY_BANDS, worldTime, worldTimeOfBand, type DayBand } from "@/components/shared/ambient/world/time";
import { lightAt, lightOf } from "@/components/shared/ambient/world/light";

// PLAN-20260907-006 — 시간대가 실제 태양 궤도를 따라 연속으로 흐르는지. 값은 서울(37.5665N) 기준 한국천문연구원 공표치와 맞춘다.
const hm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const lum = (m: readonly [number, number, number]) => m[0] * 0.2126 + m[1] * 0.7152 + m[2] * 0.0722;

describe("world/sun — 실제 태양 궤도", () => {
  it("서울의 일출·일몰이 실측과 12분 안에서 맞는다", () => {
    const cases: [number, number, number, number, number][] = [
      [2026, 6, 21, 5 + 11 / 60, 19 + 57 / 60], // 하지
      [2026, 12, 21, 7 + 43 / 60, 17 + 17 / 60], // 동지
      [2026, 3, 20, 6 + 36 / 60, 18 + 43 / 60] // 춘분
    ];
    for (const [y, m, d, rise, set] of cases) {
      const s = sunDay(y, m, d);
      expect(Math.abs(s.rise - rise), `${y}-${m}-${d} 일출 ${hm(s.rise)}`).toBeLessThan(0.2);
      expect(Math.abs(s.set - set), `${y}-${m}-${d} 일몰 ${hm(s.set)}`).toBeLessThan(0.2);
    }
  });

  it("황도가 기울어 겨울 해는 낮고 겨울밤은 길다", () => {
    const winter = sunDay(2026, 12, 21);
    const summer = sunDay(2026, 6, 21);
    expect(winter.maxAlt).toBeGreaterThan(26);
    expect(winter.maxAlt).toBeLessThan(32); // 서울 동지 남중고도 ≈ 29°
    expect(summer.maxAlt).toBeGreaterThan(73);
    expect(summer.maxAlt).toBeLessThan(79); // 하지 ≈ 76°
    expect(winter.dayLen).toBeLessThan(10);
    expect(summer.dayLen).toBeGreaterThan(14.5);
    // 같은 시각이라도 겨울 해가 훨씬 낮다.
    expect(sunPos(2026, 12, 21, 12).alt).toBeLessThan(sunPos(2026, 6, 21, 12).alt - 40);
  });

  it("낮은 해는 그림자를 길게 만든다 — 겨울 정오 > 여름 정오", () => {
    const w = worldTime("winter", 12, { y: 2026, m: 12, d: 21 });
    const s = worldTime("summer", 12, { y: 2026, m: 6, d: 21 });
    const lw = lightAt(w, "clear", "winter");
    const ls = lightAt(s, "clear", "summer");
    expect(lw.shadow.len).toBeGreaterThan(ls.shadow.len * 1.3);
  });
});

describe("world/time — 연속 위상", () => {
  it("하루를 훑으면 여섯 띠가 모두 나오고 순서대로 지나간다", () => {
    const seen: DayBand[] = [];
    for (let h = 0; h < 24; h += 1 / 12) {
      const b = bandPhase(h, 2026, 5, 15).band;
      if (seen[seen.length - 1] !== b) seen.push(b);
    }
    for (const b of DAY_BANDS) expect(seen, `${b}가 하루에 없다`).toContain(b);
    // 밤 → 새벽 → 아침 → 점심 → 노을 → 저녁 → 밤(자정을 사이에 두고 밤이 둘로 나뉜다)
    expect(seen).toEqual(["night", "dawn", "morning", "noon", "dusk", "evening", "night"]);
  });

  it("조명이 계단이 아니라 곡선이다 — 5분마다 밝기 점프가 작다", () => {
    for (const [season, y, m, d] of [
      ["winter", 2026, 12, 21],
      ["summer", 2026, 6, 21]
    ] as const) {
      let prev = lum(lightAt(worldTime(season, 0, { y, m, d }), "clear", season).mul);
      let worst = 0;
      for (let h = 1 / 12; h < 24; h += 1 / 12) {
        const now = lum(lightAt(worldTime(season, h, { y, m, d }), "clear", season).mul);
        worst = Math.max(worst, Math.abs(now - prev));
        prev = now;
      }
      // 같은 하루를 **옛 방식(띠 하나를 그대로)**으로도 재서 비교한다 — 계단이 실제로 사라졌는지 말로 하지 않고 잰다.
      let stepPrev = lum(lightOf(worldTime(season, 0, { y, m, d }).band, "clear", season).mul);
      let stepWorst = 0;
      for (let h = 1 / 12; h < 24; h += 1 / 12) {
        const now = lum(lightOf(worldTime(season, h, { y, m, d }).band, "clear", season).mul);
        stepWorst = Math.max(stepWorst, Math.abs(now - stepPrev));
        stepPrev = now;
      }
      expect(stepWorst, "옛 방식은 경계에서 크게 튀었다").toBeGreaterThan(15);
      expect(worst, `${season} 최대 점프 ${worst.toFixed(1)}(옛 ${stepWorst.toFixed(1)})`).toBeLessThan(stepWorst / 4);
    }
  });

  it("남중에서는 점심 거점 그대로 — 섞임이 값을 바꾸지 않는다", () => {
    const day = sunDay(2026, 6, 21);
    const t = worldTime("summer", day.noon, { y: 2026, m: 6, d: 21 });
    expect(t.band).toBe("noon");
    // 점심·맑음은 중립이어야 한다(옛 파이프라인과 픽셀이 같아야 회귀 해시가 유효하다 — light.ts 머리말).
    expect(lightAt(t, "clear", "summer").mul).toEqual([255, 255, 255]);
    const forced = worldTimeOfBand("winter", "dusk", { y: 2026, m: 12, d: 21 });
    expect(lightAt(forced, "clear", "winter").sky).toBe(lightOf("dusk", "clear", "winter").sky);
  });

  it("계절이 같아도 날짜가 다르면 위상이 다르다(황도가 날마다 움직인다)", () => {
    const early = worldTime("autumn", 18, { y: 2026, m: 9, d: 1 });
    const late = worldTime("autumn", 18, { y: 2026, m: 11, d: 20 });
    expect(early.sun.alt).toBeGreaterThan(late.sun.alt + 5);
    expect(early.set).toBeGreaterThan(late.set + 1);
  });
});
