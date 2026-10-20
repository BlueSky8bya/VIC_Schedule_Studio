import { describe, expect, it, vi } from "vitest";
import { COMPANION_HOME_TV_CHANNELS, companionHomeTvControl, createCompanionHomeTvStore, normalizeCompanionHomeTv, randomCompanionHomeTvChannel } from "@/lib/ui/viewer-companion/home-room-media";

describe("143 five local TV channels", () => {
  it("cycles exactly five canonical channels and OFF through the existing semantic control", () => {
    expect(COMPANION_HOME_TV_CHANNELS).toEqual(["tori", "nature", "cooking", "toys", "moon"]);
    const store = createCompanionHomeTvStore(() => 0), seen = [store.read()], options = [];
    for (let i = 0; i < 6; i++) { const control = companionHomeTvControl(store.read()); options.push(control.option); store.set(control.next); seen.push(store.read()); }
    expect(seen).toEqual(["off", "tori", "nature", "cooking", "toys", "moon", "off"]);
    expect(options).toEqual(["on", "next", "next", "next", "next", "off"]);
    expect(companionHomeTvControl("off").label).toBe("TV 꺼짐 · 누르면 토리 방송 채널 켜기");
  });
  it("accepts the historical music input as tori without a sixth channel or a duplicate notification", () => {
    const store = createCompanionHomeTvStore(() => 0), listener = vi.fn(); store.subscribe(listener);
    expect(normalizeCompanionHomeTv("music")).toBe("tori");
    expect(store.set("music", { source: "companion" })).toBe(true); expect(store.read()).toBe("tori");
    expect(store.set("tori", { source: "companion" })).toBe(true); expect(listener).toHaveBeenCalledOnce();
    expect(companionHomeTvControl("music")).toEqual(companionHomeTvControl("tori"));
  });
  it("keeps direct same-channel and OFF selections above autonomous choices for exactly fifteen seconds", () => {
    let now = 0; const store = createCompanionHomeTvStore(() => now), listener = vi.fn(); store.subscribe(listener);
    store.set("music"); now = 14000; store.set("tori");
    now = 28999; expect(store.set("moon", { source: "companion" })).toBe(false); expect(listener).toHaveBeenCalledOnce();
    now = 29000; expect(store.set("moon", { source: "companion" })).toBe(true);
    store.set("off"); now = 43999; expect(store.set("tori", { source: "companion" })).toBe(false);
    now = 44000; expect(store.set("tori", { source: "companion" })).toBe(true);
  });
  it("allocates exact55/15/12/10/8 autonomous intervals while manual Next remains round-robin", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 100; i++) { const rng = vi.fn(() => (i + .5) / 100), channel = randomCompanionHomeTvChannel(rng); counts.set(channel, (counts.get(channel) ?? 0) + 1); expect(rng).toHaveBeenCalledOnce(); }
    expect(Object.fromEntries(counts)).toEqual({ tori: 55, nature: 15, cooking: 12, toys: 10, moon: 8 });
    expect(randomCompanionHomeTvChannel(() => .54)).toBe("tori");
    expect(companionHomeTvControl("tori").next).toBe("nature");
    for (const value of [-1, Number.NaN, Infinity]) expect(randomCompanionHomeTvChannel(() => value)).toBe("tori");
    expect(randomCompanionHomeTvChannel(() => 1)).toBe("moon");
  });
});
