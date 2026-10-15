import { describe, expect, it, vi } from "vitest";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { COMPANION_MOBILE_QUERY, createCompanionCapabilityStore } from "@/lib/ui/viewer-companion/capability";

function fixture(initial: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initial,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
  };
  const read = vi.fn(() => media as unknown as MediaQueryList);
  const store = createCompanionCapabilityStore(read);
  const change = (value: boolean) => { media.matches = value; for (const listener of [...listeners]) listener(); };
  return { store, media, read, change };
}

describe("shared desktop companion capability", () => {
  it("uses the same canonical narrow/coarse policy for every surface", () => {
    expect(COMPANION_MOBILE_QUERY).toBe(POSTER_AGENDA_QUERY);
    expect(COMPANION_MOBILE_QUERY).toContain("1040px");
    expect(COMPANION_MOBILE_QUERY).toContain("640px");
    expect(COMPANION_MOBILE_QUERY).toContain("pointer: coarse");
  });
  it("fails closed on the server without reading browser media", () => {
    const f = fixture(false);
    expect(f.store.getServerSnapshot()).toBe(false);
    expect(f.read).not.toHaveBeenCalled();
    expect(f.store.getSnapshot()).toBe(true);
  });
  it("does not enable a stored master on a mobile viewport", () => {
    const f = fixture(true);
    expect(f.store.getSnapshot()).toBe(false);
    f.change(false); expect(f.store.getSnapshot()).toBe(true);
    f.change(true); expect(f.store.getSnapshot()).toBe(false);
    expect(f.read).toHaveBeenCalledTimes(1);
  });
  it("shares one live media listener and detaches after the last consumer", () => {
    const f = fixture(true), a = vi.fn(), b = vi.fn();
    const offA = f.store.subscribe(a), offB = f.store.subscribe(b);
    expect(f.media.addEventListener).toHaveBeenCalledTimes(1);
    f.change(false); expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
    offA(); expect(f.media.removeEventListener).not.toHaveBeenCalled();
    f.change(true); expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(2);
    offB(); expect(f.media.removeEventListener).toHaveBeenCalledTimes(1);
    const offAgain = f.store.subscribe(a); expect(f.media.addEventListener).toHaveBeenCalledTimes(2);
    expect(f.read).toHaveBeenCalledTimes(1); offAgain();
  });
  it("keeps missing or failed browser capabilities off", () => {
    const missing = createCompanionCapabilityStore(() => undefined), callback = vi.fn();
    expect(missing.getSnapshot()).toBe(false); missing.subscribe(callback)(); expect(callback).not.toHaveBeenCalled();
    const failed = createCompanionCapabilityStore(() => { throw new Error("unavailable"); });
    expect(failed.getSnapshot()).toBe(false); expect(() => failed.subscribe(callback)()).not.toThrow();
  });
});
