import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasAmbientPauseOutside, holdAmbient, releaseAmbient } from "@/lib/ui/ambient-pause";

const own = "poster-window";
const keys = [own, "test-vod", "test-showcase", "test-unknown"];
let attributes: Map<string, string>;
let root: { setAttribute: ReturnType<typeof vi.fn>; removeAttribute: ReturnType<typeof vi.fn> };

beforeEach(() => {
  attributes = new Map();
  root = {
    setAttribute: vi.fn((key: string, value: string) => attributes.set(key, value)),
    removeAttribute: vi.fn((key: string) => attributes.delete(key)),
  };
  vi.stubGlobal("document", { documentElement: root });
});
afterEach(() => {
  // Restore the minimal document first so even an SSR assertion cannot leave
  // this module's real holder set behind for the next case.
  vi.stubGlobal("document", { documentElement: root });
  for (const key of keys) releaseAmbient(key);
  vi.unstubAllGlobals();
});

describe("ambient pause ownership", () => {
  it("allows exactly the local window and prelude presentation while retaining every unrelated pause", () => {
    holdAmbient(own); holdAmbient("test-vod");
    expect(hasAmbientPauseOutside(own, ["test-vod"])).toBe(false);
    expect(attributes.get("data-ambient-pause")).toBe("1");
    holdAmbient("test-showcase");
    expect(hasAmbientPauseOutside(own, ["test-vod"])).toBe(true);
    releaseAmbient("test-showcase");
    const writes = root.setAttribute.mock.calls.length;
    expect(hasAmbientPauseOutside(own, ["test-vod"])).toBe(false);
    expect(root.setAttribute).toHaveBeenCalledTimes(writes);
    expect(hasAmbientPauseOutside(own)).toBe(true);
  });
  it("excludes the viewer window's own holder without unpausing the ambient background", () => {
    expect(hasAmbientPauseOutside(own)).toBe(false);
    holdAmbient(own);
    expect(attributes.get("data-ambient-pause")).toBe("1");
    expect(hasAmbientPauseOutside(own)).toBe(false);
    expect(hasAmbientPauseOutside("another-window")).toBe(true);
    const writes = root.setAttribute.mock.calls.length;
    const removals = root.removeAttribute.mock.calls.length;
    hasAmbientPauseOutside(own);
    expect(root.setAttribute).toHaveBeenCalledTimes(writes);
    expect(root.removeAttribute).toHaveBeenCalledTimes(removals);
  });

  it("detects another simultaneous holder and clears only that reason when it releases", () => {
    holdAmbient(own);
    holdAmbient("test-vod");
    expect(hasAmbientPauseOutside(own)).toBe(true);
    releaseAmbient("test-vod");
    expect(hasAmbientPauseOutside(own)).toBe(false);
    expect(attributes.get("data-ambient-pause")).toBe("1");
    releaseAmbient(own);
    expect(attributes.has("data-ambient-pause")).toBe(false);
  });

  it("preserves remaining external owners across individual, own and unrelated releases", () => {
    for (const key of [own, "test-vod", "test-showcase"]) holdAmbient(key);
    releaseAmbient("test-vod");
    expect(hasAmbientPauseOutside(own)).toBe(true);
    releaseAmbient(own);
    releaseAmbient("test-unknown");
    expect(hasAmbientPauseOutside(own)).toBe(true);
    expect(attributes.get("data-ambient-pause")).toBe("1");
    releaseAmbient("test-showcase");
    expect(hasAmbientPauseOutside(own)).toBe(false);
    expect(attributes.has("data-ambient-pause")).toBe(false);
  });

  it("keeps the existing idempotent per-key holder contract", () => {
    holdAmbient("test-vod");
    holdAmbient("test-vod");
    expect(hasAmbientPauseOutside(own)).toBe(true);
    releaseAmbient("test-vod");
    expect(hasAmbientPauseOutside(own)).toBe(false);
    releaseAmbient("test-vod");
    expect(attributes.has("data-ambient-pause")).toBe(false);
  });

  it("does not acquire holders or touch a document during SSR", () => {
    vi.stubGlobal("document", undefined);
    expect(() => { holdAmbient(own); holdAmbient("test-vod"); releaseAmbient("test-vod"); }).not.toThrow();
    expect(hasAmbientPauseOutside(own)).toBe(false);
    expect(root.setAttribute).not.toHaveBeenCalled();
    expect(root.removeAttribute).not.toHaveBeenCalled();
  });
});
