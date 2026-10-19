import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canCompanionSetHomeTv, companionHomeTvControl, COMPANION_HOME_TV_CHANNELS,
  createCompanionHomeTvStore, getCompanionHomeTv, getServerCompanionHomeTv,
  setCompanionHomeTv, subscribeCompanionHomeTv,
  type CompanionHomeTvState,
} from "@/lib/ui/viewer-companion/home-room-media";

afterEach(() => { vi.unstubAllGlobals(); });

describe("137 shared room TV state", () => {
  it("keeps all five channel controls and their native semantic cycle", () => {
    const store = createCompanionHomeTvStore(() => 0), states: CompanionHomeTvState[] = [store.read()];
    const options: string[] = [];
    for (let i = 0; i <= COMPANION_HOME_TV_CHANNELS.length; i++) {
      const control = companionHomeTvControl(store.read()); options.push(control.option);
      expect(store.set(control.next)).toBe(true); states.push(store.read());
    }
    expect(states).toEqual(["off", ...COMPANION_HOME_TV_CHANNELS, "off"]);
    expect(options).toEqual(["on", "next", "next", "next", "next", "off"]);
  });

  it("protects a manual OFF for fifteen seconds, then accepts a companion channel", () => {
    let now = 250;
    const store = createCompanionHomeTvStore(() => now), listener = vi.fn();
    store.subscribe(listener);
    expect(store.set("off", { source: "human" })).toBe(true);
    expect(store.canChange("companion")).toBe(false);
    now = 15_249;
    expect(store.set("moon", { source: "companion" })).toBe(false);
    expect(store.read()).toBe("off"); expect(listener).not.toHaveBeenCalled();
    now = 15_250;
    expect(store.canChange("companion")).toBe(true);
    expect(store.set("moon", { source: "companion" })).toBe(true);
    expect(store.read()).toBe("moon"); expect(listener).toHaveBeenCalledOnce();
  });

  it("lets a human override immediately and renews priority even for the same picture", () => {
    let now = 0;
    const store = createCompanionHomeTvStore(() => now);
    expect(store.set("nature", { source: "companion" })).toBe(true);
    expect(store.set("music", { source: "human" })).toBe(true);
    now = 14_000; expect(store.set("music", { source: "human" })).toBe(true);
    now = 15_001; expect(store.set("cooking", { source: "companion" })).toBe(false);
    expect(store.read()).toBe("music");
    expect(store.set("off", { source: "human" })).toBe(true);
    now = 30_001; expect(store.set("cooking", { source: "companion" })).toBe(true);
  });

  it("shares one value across presentations and keeps it after unsubscribe/remount", () => {
    const store = createCompanionHomeTvStore(() => 0), rail = vi.fn(), floating = vi.fn();
    const offRail = store.subscribe(rail), offFloating = store.subscribe(floating);
    store.set("toys", { source: "companion" });
    expect(rail).toHaveBeenCalledOnce(); expect(floating).toHaveBeenCalledOnce();
    offRail(); offFloating();
    const remounted = vi.fn(), off = store.subscribe(remounted);
    expect(store.read()).toBe("toys");
    store.set("moon", { source: "companion" });
    expect(rail).toHaveBeenCalledOnce(); expect(floating).toHaveBeenCalledOnce(); expect(remounted).toHaveBeenCalledOnce();
    off(); store.set("off"); expect(remounted).toHaveBeenCalledOnce();
  });

  it("fails closed on foreign state/source and cannot expire a lease with an invalid clock", () => {
    let now = 500;
    const store = createCompanionHomeTvStore(() => now), listener = vi.fn(); store.subscribe(listener);
    expect(store.set("music")).toBe(true);
    expect(store.set("secret-channel" as CompanionHomeTvState)).toBe(false);
    expect(store.set("nature", { source: "foreign" as "human" })).toBe(false);
    now = Number.NaN; expect(store.set("nature", { source: "companion" })).toBe(false);
    now = -1000; expect(store.set("nature", { source: "companion" })).toBe(false);
    expect(store.read()).toBe("music"); expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps server snapshots isolated without storage, timers or client state mutation", () => {
    expect(getServerCompanionHomeTv()).toBe("off");
    expect(getCompanionHomeTv()).toBe("off");
    expect(setCompanionHomeTv("music", { source: "companion" })).toBe(false);
    expect(canCompanionSetHomeTv()).toBe(false);
    const listener = vi.fn(), off = subscribeCompanionHomeTv(listener); off();
    expect(listener).not.toHaveBeenCalled();
  });

  it("emits only room invalidation, never human activity, for autonomous state changes", () => {
    const dispatchEvent = vi.fn(); vi.stubGlobal("window", { dispatchEvent });
    const listener = vi.fn(), off = subscribeCompanionHomeTv(listener);
    expect(setCompanionHomeTv("nature", { source: "companion" })).toBe(true);
    expect(getCompanionHomeTv()).toBe("nature"); expect(listener).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls.map(call => (call[0] as Event).type)).toEqual(["vic:companion-home"]);
    expect(setCompanionHomeTv("nature", { source: "companion" })).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    off(); setCompanionHomeTv("moon", { source: "companion" });
    expect(listener).toHaveBeenCalledOnce();
  });
});
