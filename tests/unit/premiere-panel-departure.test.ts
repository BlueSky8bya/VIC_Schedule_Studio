import { describe, expect, it } from "vitest";
import { REGION_WINDOWS } from "@/lib/ui/premiere/choreography";
import { premiereViewportBounds, regionDeparture, REGION_DEPARTURE_SECONDS, REGION_DEPARTURE_STAGGER } from "@/lib/ui/premiere/panel-departure";

describe("finite premiere panel departures", () => {
  it("keeps the existing region start order but finishes one tangible flight in1.8seconds", () => {
    for (const window of Object.values(REGION_WINDOWS)) {
      expect(regionDeparture(window[0], window)).toEqual({ progress: 0, travel: 0, anticipation: 0, fold: 0, opacity: 1 });
      expect(regionDeparture(window[0] - REGION_DEPARTURE_SECONDS, window)).toEqual({ progress: 1, travel: 1, anticipation: 0, fold: 1, opacity: 0 });
      expect(regionDeparture(window[1], window).progress).toBe(1);
    }
  });
  it("prepares with a small pullback before travel and fades only in the latter flight", () => {
    const window = [180, 168] as const;
    const preparation = regionDeparture(180 - 1.8 * .1, window);
    expect(preparation.anticipation).toBeGreaterThan(.8); expect(preparation.travel).toBe(0); expect(preparation.fold).toBe(0); expect(preparation.opacity).toBe(1);
    const tangible = regionDeparture(180 - 1.8 * .5, window);
    expect(tangible.travel).toBeGreaterThan(0); expect(tangible.fold).toBeGreaterThan(0); expect(tangible.anticipation).toBe(0); expect(tangible.opacity).toBe(1);
    expect(regionDeparture(180 - 1.8 * .8, window).opacity).toBeLessThan(.5);
  });
  it("staggers same-code regions by140ms without moving an existing departure slot", () => {
    const window = [166, 154] as const;
    const current = regionDeparture(165, window, 0);
    expect(regionDeparture(166 - REGION_DEPARTURE_STAGGER, window, 1).progress).toBeCloseTo(0);
    expect(regionDeparture(165 - REGION_DEPARTURE_STAGGER, window, 1)).toEqual(current);
    expect(regionDeparture(165, window, 0)).toEqual(current);
    expect(regionDeparture(154, window, 10000).progress).toBe(1);
  });
  it("fits a short recipient window and bounds arbitrary late index inputs", () => {
    const window = [10, 9] as const;
    expect(regionDeparture(9, window, 50).progress).toBe(1);
    expect(regionDeparture(9.5, window, 50).progress).toBe(.5);
    expect(regionDeparture(9.5, window, -2)).toEqual(regionDeparture(9.5, window));
    expect(regionDeparture(9.5, window, Infinity)).toEqual(regionDeparture(9.5, window));
  });
  it("is continuous, bounded, deterministic and reverses to the same score after clock correction", () => {
    const window = [154, 138] as const;
    let last = regionDeparture(154, window);
    for (let index = 1; index <= 1800; index++) {
      const current = regionDeparture(154 - index / 1000, window);
      for (const value of Object.values(current)) { expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
      expect(current.travel).toBeGreaterThanOrEqual(last.travel); expect(current.fold).toBeGreaterThanOrEqual(last.fold); expect(current.opacity).toBeLessThanOrEqual(last.opacity);
      for (const key of ["travel", "anticipation", "fold", "opacity"] as const) expect(Math.abs(current[key] - last[key])).toBeLessThan(.015);
      last = current;
    }
    expect(regionDeparture(153.2, window)).toEqual(regionDeparture(153.2, window));
    expect(regionDeparture(155, window)).toEqual(regionDeparture(154, window));
  });
  it("does no work and preserves the visible original for invalid or returning clocks", () => {
    for (const seconds of [NaN, Infinity, -Infinity]) expect(regionDeparture(seconds, [180, 168])).toEqual(regionDeparture(180, [180, 168]));
    for (const window of [[0, 0], [1, 2], [Infinity, 0], [10, NaN]] as const) expect(regionDeparture(0, window).opacity).toBe(1);
  });
  it("hands the bottom toggle slot to the badge without the previous16second gap", () => {
    expect(REGION_WINDOWS["7"]).toEqual([158, 156]);
    expect(regionDeparture(158, REGION_WINDOWS["7"]).progress).toBe(0);
    expect(regionDeparture(156.2, REGION_WINDOWS["7"]).progress).toBe(1);
    expect(regionDeparture(156, REGION_WINDOWS["7"]).opacity).toBe(0);
  });
});

describe("physical premiere viewport", () => {
  it("uses the390x844 viewport even when departed panels inflate mobile inner dimensions", () => {
    expect(premiereViewportBounds({ clientWidth: 390, clientHeight: 844, visualViewport: { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 } })).toEqual({ left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 });
  });
  it("intersects zoom/keyboard visual bounds with the layout viewport", () => {
    expect(premiereViewportBounds({ clientWidth: 390, clientHeight: 844, visualViewport: { width: 195, height: 300, offsetLeft: 100, offsetTop: 200 } })).toEqual({ left: 100, top: 200, right: 295, bottom: 500, width: 195, height: 300 });
    expect(premiereViewportBounds({ clientWidth: 390, clientHeight: 844, visualViewport: { width: 795, height: 1721 } }).width).toBe(390);
  });
  it("keeps finite positive bounds without visualViewport or usable initial geometry", () => {
    expect(premiereViewportBounds({ clientWidth: 1440, clientHeight: 900 })).toEqual({ left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 });
    const fallback = premiereViewportBounds({ clientWidth: NaN, clientHeight: 0, visualViewport: { width: Infinity, height: -1, offsetLeft: NaN, offsetTop: -5 } });
    expect(fallback).toEqual({ left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 });
  });
});
