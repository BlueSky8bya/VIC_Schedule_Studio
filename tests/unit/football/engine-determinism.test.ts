import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/football/core/rng";
import { FORMATIONS } from "@/lib/football/tactics/formations";
import { STYLES, makeMatchup } from "@/lib/football/tactics/profiles";

// Phase 0 완료 기준: 같은 seed → 같은 팀 이름·포메이션·선수 성향. 엔진은 Math.random을 쓰지 않는다.

describe("rng", () => {
  it("같은 seed면 같은 수열", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("다른 seed면 다른 수열(거의 항상)", () => {
    const a = Array.from({ length: 8 }, ((r) => () => r.next())(makeRng(1)));
    const b = Array.from({ length: 8 }, ((r) => () => r.next())(makeRng(2)));
    expect(a).not.toEqual(b);
  });

  it("next는 [0,1) 범위", () => {
    const r = makeRng(999);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("makeMatchup 결정성", () => {
  it("같은 seed → 똑같은 매치업(팀·포메이션·선수 성향)", () => {
    const a = makeMatchup(makeRng(42));
    const b = makeMatchup(makeRng(42));
    expect(a).toEqual(b);
  });

  it("두 팀은 서로 다른 전술 스타일", () => {
    for (const seed of [1, 7, 13, 100, 2024, 55555]) {
      const m = makeMatchup(makeRng(seed));
      expect(m.teams[0].name).not.toBe(m.teams[1].name);
    }
  });

  it("선수는 팀0 10명 + 팀1 10명 = 20명, 성향은 0..1", () => {
    const m = makeMatchup(makeRng(7));
    expect(m.personas).toHaveLength(20);
    expect(m.personas.filter((p) => p.team === 0)).toHaveLength(10);
    expect(m.personas.filter((p) => p.team === 1)).toHaveLength(10);
    for (const p of m.personas) {
      for (const v of [p.pace, p.press, p.pass, p.shoot, p.discipline]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("팀 수치는 정의된 범위 안", () => {
    const m = makeMatchup(makeRng(314));
    for (const t of m.teams) {
      expect(t.press).toBeGreaterThanOrEqual(0.4);
      expect(t.press).toBeLessThanOrEqual(1);
      expect(t.lineHeight).toBeGreaterThanOrEqual(0);
      expect(t.lineHeight).toBeLessThanOrEqual(0.22);
      expect(t.width).toBeGreaterThanOrEqual(0.82);
      expect(t.width).toBeLessThanOrEqual(1.18);
      expect(t.slots).toHaveLength(10);
    }
  });
});

describe("전술/포메이션 정합", () => {
  it("모든 STYLES.forms는 유효한 포메이션", () => {
    for (const s of STYLES) {
      for (const f of s.forms) {
        expect(FORMATIONS[f]).toBeDefined();
      }
    }
  });

  it("모든 포메이션은 필드 10명", () => {
    for (const key of Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[]) {
      expect(FORMATIONS[key]).toHaveLength(10);
    }
  });
});
