import { describe, expect, it } from "vitest";
import { isStaleStudioSnapshot } from "@/lib/studio/editor-model";

// 2026-11-20 owner report: a pasted/created card vanished from the studio screen
// (still in the DB, back after reload). A server snapshot read before the last
// committed write must never replace the screen list.
describe("studio snapshot staleness", () => {
  it("rejects a snapshot whose reads began before the last committed write", () => {
    expect(isStaleStudioSnapshot(1_000, 1_500)).toBe(true);
    expect(isStaleStudioSnapshot(1_500, 1_500)).toBe(true);
  });
  it("accepts a snapshot read after the last write", () => {
    expect(isStaleStudioSnapshot(1_501, 1_500)).toBe(false);
  });
  it("accepts any snapshot before the first write, and unstamped snapshots", () => {
    expect(isStaleStudioSnapshot(1_000, 0)).toBe(false);
    expect(isStaleStudioSnapshot(undefined, 1_500)).toBe(false);
  });
});
