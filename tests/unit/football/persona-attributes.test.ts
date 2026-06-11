import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/football/core/rng";
import { makeMatchup, makePlayer } from "@/lib/football/tactics/profiles";

describe("이질적 선수 속성", () => {
  it("makePlayer 결정적(같은 seed/순서 → 동일)", () => {
    const slot = { bx: 0.8, by: 0.5, role: "FW" as const };
    const a = makePlayer(makeRng(42), 0, slot);
    const b = makePlayer(makeRng(42), 0, slot);
    expect(a).toEqual(b);
  });

  it("모든 속성이 유효 범위 + 필드 채움", () => {
    const m = makeMatchup(makeRng(7));
    expect(m.personas.length).toBe(20);
    m.personas.forEach((p) => {
      expect(["left", "right", "both"]).toContain(p.preferredFoot);
      [p.weakFoot, p.agility, p.balance, p.vision, p.composure, p.aggression, p.cutInside, p.poaching, p.altruism].forEach(
        (v) => {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      );
      expect(p.heightCm).toBeGreaterThan(165);
      expect(p.heightCm).toBeLessThan(205);
      expect(p.weightKg).toBeGreaterThan(60);
      expect(["low", "medium", "high"]).toContain(p.workRateAtk);
      expect(["low", "medium", "high"]).toContain(p.workRateDef);
      expect(Array.isArray(p.traits)).toBe(true);
    });
  });

  it("FW는 poacher 또는 targetMan 특성을 갖는다", () => {
    const m = makeMatchup(makeRng(123));
    const fws = m.personas.filter((p) => p.slot.role === "FW");
    expect(fws.length).toBeGreaterThan(0);
    fws.forEach((p) => {
      expect(p.traits.includes("poacher") || p.traits.includes("targetMan")).toBe(true);
    });
  });

  it("seed 다르면 라인업 성향이 달라진다(이질성)", () => {
    const a = makeMatchup(makeRng(1)).personas.map((p) => p.heightCm).join();
    const b = makeMatchup(makeRng(2)).personas.map((p) => p.heightCm).join();
    expect(a).not.toBe(b);
  });
});
