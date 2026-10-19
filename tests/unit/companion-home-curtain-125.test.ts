import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionHome } from "@/components/poster/viewer-companion/companion-home";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { companionHomeRest, INITIAL_COMPANION_HOME_CURTAIN, reduceCompanionHomeCurtain } from "@/lib/ui/viewer-companion/home-curtain";
import type { CompanionHomeEnvironment } from "@/lib/ui/viewer-companion/home-environment";
import { resolveCompanionWindowScene } from "@/lib/ui/viewer-companion/home-window-scene";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const environment: CompanionHomeEnvironment = { date: { y: 2026, m: 10, d: 19 }, season: "autumn", hour: 13, band: "noon", night: false, weather: "clear", sunlight: 3 };
const input = { environment, personality: "curious" as const, rest: "awake" as const, lookingOut: false, visible: true, blocked: false, reduced: false };
const restInput = { atHome: true, grounded: true, sleepAllowed: true, held: false, resting: false, dreaming: false, waking: false };
const awake = () => reduceCompanionHomeCurtain(INITIAL_COMPANION_HOME_CURTAIN, { ...input, environment: { ...environment, sunlight: 0 } });
// The Node unit harness uses classic JSX; production uses the automatic runtime.
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

describe("125 actual home rest projection", () => {
  it("closes for actual settling before sleep and distinguishes the real wake", () => {
    expect(companionHomeRest({ ...restInput, resting: true })).toBe("settling");
    expect(companionHomeRest({ ...restInput, resting: true, dreaming: true })).toBe("asleep");
    expect(companionHomeRest({ ...restInput, resting: true, dreaming: true, waking: true })).toBe("waking");
  });
  it.each([{ atHome: false }, { grounded: false }, { held: true }, { sleepAllowed: false }])("does not turn a non-home, airborne, held or disabled rest into a home nap: %j", boundary => {
    expect(companionHomeRest({ ...restInput, resting: true, dreaming: true, ...boundary })).toBe("awake");
  });
  it("never infers sleep from low energy or a sleepy personality", () => {
    const actual = { ...restInput, energy: 0, personality: "sleepy" };
    expect(companionHomeRest(actual)).toBe("awake");
  });
});

describe("125 bounded automatic home curtains", () => {
  it.each(COMPANION_PERSONALITIES)("%s closes for an actual home nap, opens on wake and keeps an awake night visible", personality => {
    const initial = awake();
    const settling = reduceCompanionHomeCurtain(initial, { ...input, personality, rest: "settling" });
    expect(settling).toMatchObject({ phase: "closed", reason: "rest", panelScale: 1, rest: "settling", animate: true });
    const asleep = reduceCompanionHomeCurtain(settling, { ...input, personality, rest: "asleep" });
    expect(asleep).toMatchObject({ phase: "closed", rest: "asleep" });
    const waking = reduceCompanionHomeCurtain(asleep, { ...input, personality, rest: "waking" });
    expect(waking).toMatchObject({ phase: "open", reason: "awake", rest: "waking" });
    for (const band of ["evening", "night"] as const) {
      const night = reduceCompanionHomeCurtain(asleep, { ...input, personality, environment: { ...environment, band, sunlight: 4 } });
      expect(night).toMatchObject({ phase: "open", reason: "awake" });
    }
  });
  it("shades strong direct sunshine with bounded personality differences, never a full awake closure", () => {
    const shades = COMPANION_PERSONALITIES.map(personality => reduceCompanionHomeCurtain(awake(), { ...input, personality }));
    expect(shades.every(state => state.phase === "shade" && state.panelScale > .08 && state.panelScale < .5)).toBe(true);
    expect(shades[COMPANION_PERSONALITIES.indexOf("curious")].panelScale).toBeLessThan(shades[COMPANION_PERSONALITIES.indexOf("sleepy")].panelScale);
    expect(shades[COMPANION_PERSONALITIES.indexOf("homebody")].panelScale).toBeGreaterThan(shades[COMPANION_PERSONALITIES.indexOf("performer")].panelScale);
  });
  it("holds a sun boundary without repeated draw changes and releases after weaker light or cloud", () => {
    const initial = awake(), edge = { ...input, environment: { ...environment, sunlight: 2 } };
    expect(reduceCompanionHomeCurtain(initial, edge)).toBe(initial);
    const shaded = reduceCompanionHomeCurtain(initial, input);
    expect(reduceCompanionHomeCurtain(shaded, edge)).toBe(shaded);
    expect(reduceCompanionHomeCurtain(shaded, { ...input, environment: { ...environment, sunlight: 1 } }).phase).toBe("open");
    expect(reduceCompanionHomeCurtain(shaded, { ...input, environment: { ...environment, weather: "cloud" } }).phase).toBe("open");
  });
  it("lets a real awake window gaze reopen sunlight shade, without overriding a real nap", () => {
    const shaded = reduceCompanionHomeCurtain(awake(), input);
    expect(reduceCompanionHomeCurtain(shaded, { ...input, lookingOut: true }).phase).toBe("open");
    expect(reduceCompanionHomeCurtain(shaded, { ...input, lookingOut: true, rest: "asleep" }).phase).toBe("closed");
  });
  it.each([{ visible: false }, { blocked: true }])("freezes blocked context and resumes at current state without replay: %j", boundary => {
    const closed = reduceCompanionHomeCurtain(awake(), { ...input, rest: "asleep" });
    const paused = reduceCompanionHomeCurtain(closed, { ...input, ...boundary });
    expect(paused).toMatchObject({ phase: "closed", rest: "asleep", active: false, animate: false });
    expect(reduceCompanionHomeCurtain(paused, { ...input, ...boundary, rest: "waking" })).toBe(paused);
    const resumed = reduceCompanionHomeCurtain(paused, { ...input, rest: "waking" });
    expect(resumed).toMatchObject({ phase: "open", rest: "waking", active: true, animate: false });
    expect(reduceCompanionHomeCurtain(resumed, { ...input, rest: "waking" })).toBe(resumed);
  });
  it("changes position statically in reduced mode and reuses stable state across ordinary paints", () => {
    const closed = reduceCompanionHomeCurtain(awake(), { ...input, rest: "settling", reduced: true });
    expect(closed).toMatchObject({ phase: "closed", animate: false });
    for (let frame = 0; frame < 1000; frame++) expect(reduceCompanionHomeCurtain(closed, { ...input, rest: "settling", reduced: true })).toBe(closed);
  });
  it("keeps the same decoded-scene nodes and human targets when cloth closes", () => {
    const render = (curtain = INITIAL_COMPANION_HOME_CURTAIN) => renderToStaticMarkup(React.createElement(CompanionHome, {
      care: DEFAULT_COMPANION_CARE, preferences: DEFAULT_COMPANION_PREFERENCES, environment, curtain,
      onAction: () => undefined, onClose: () => undefined, onToyBox: () => undefined,
    }));
    const open = render(), closed = render(reduceCompanionHomeCurtain(awake(), { ...input, rest: "asleep" }));
    expect(closed).toContain('data-curtain="closed"'); expect(closed).toContain('data-curtain-rest="asleep"');
    expect(closed).toContain(resolveCompanionWindowScene(environment).landscapeSrc);
    // 126 replaces scaled125 panels with five transparent registered stages.
    expect(closed.match(/src="[^"]*curtain-stage-\d.webp"/g)).toHaveLength(5);
    expect(closed.match(/data-home-action="[^"]+"/g)).toEqual(open.match(/data-home-action="[^"]+"/g));
    expect(closed.match(/<button\b/g)).toHaveLength(open.match(/<button\b/g)!.length);
    expect(closed).toContain('class="vc-window-curtain-overlay" aria-hidden="true"');
  });
});
