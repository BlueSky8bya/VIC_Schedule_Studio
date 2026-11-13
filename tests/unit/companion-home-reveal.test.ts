import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANION_HOME_REVEAL_LAYERS, COMPANION_HOME_REVEAL_LAYER_TIMEOUT_MS as TIMEOUT, COMPANION_HOME_REVEAL_STAGGER_MS as STAGGER, planCompanionHomeReveal } from "@/lib/ui/viewer-companion/home-reveal";

describe("staged companion home reveal (2026-11-13 owner)", () => {
  it("keeps the fixed floor → wall → furniture → props → pet order", () => {
    expect(COMPANION_HOME_REVEAL_LAYERS).toEqual(["floor", "wall", "furniture", "props", "pet"]);
  });

  it("never lets a later layer overtake an earlier one, whatever finishes first", () => {
    // Pet and props arrive first, floor last: the order still starts at the floor.
    const times = planCompanionHomeReveal(0, [900, 200, 100, 50, 10]);
    expect(times[0]).toBe(900);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBe(STAGGER);
  });

  it("waits for a slow layer but never longer than one timeout per layer", () => {
    const times = planCompanionHomeReveal(0, [100, undefined, 300, 5000, 400]);
    expect(times).toEqual([100, 100 + TIMEOUT, 100 + TIMEOUT + STAGGER, 100 + TIMEOUT * 2 + STAGGER, 100 + TIMEOUT * 2 + STAGGER * 2]);
  });

  it("a stalled floor still releases the rest", () => {
    const [floor, wall] = planCompanionHomeReveal(0, [undefined, 0, 0, 0, 0]);
    expect(floor).toBe(TIMEOUT);
    expect(wall).toBe(TIMEOUT + STAGGER);
  });

  it("hides paint with filter only, so geometry/opacity reads stay real, and honours the app reduce-motion switch", () => {
    const css = readFileSync("components/poster/viewer-companion/companion-home.css", "utf8");
    const staged = css.slice(css.indexOf("@property --vc-home-reveal"));
    expect(staged).toMatch(/filter: opacity\(var\(--vc-home-reveal\)\)/);
    expect(staged).not.toMatch(/(^|[;{\s])opacity\s*:/);
    expect(staged).not.toMatch(/visibility\s*:/);
    expect(staged).toMatch(/html:is\(\[data-reduce-motion\][^{]*\{ --vc-home-reveal-duration: 0s; \}/);
    expect(staged).not.toMatch(/prefers-reduced-motion/);
  });
});
