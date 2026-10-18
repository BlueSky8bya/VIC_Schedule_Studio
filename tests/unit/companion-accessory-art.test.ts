import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCompanionAccessoryArtFrame } from "@/lib/ui/viewer-companion/accessory-art";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";

describe("shared code-native accessory art", () => {
  it("provides every active item view to both the live painter and collection without another character atlas", () => {
    const atlas = new Set<string>();
    for (const id of COMPANION_WEARABLE_IDS) for (const view of ["front", "quarter", "side", "back"] as const) {
      const frame = getCompanionAccessoryArtFrame(id, view)!;
      expect(frame, `${id}:${view}`).toBeDefined(); expect(frame.id).toBe(`${id}:${view}`);
      expect(frame.content.width).toBeGreaterThan(0); expect(frame.content.height).toBeGreaterThan(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(frame.atlasWidth); expect(frame.y + frame.height).toBeLessThanOrEqual(frame.atlasHeight);
      expect(frame.content.x).toBeGreaterThanOrEqual(0); expect(frame.content.y + frame.content.height).toBeLessThanOrEqual(frame.height);
      if (frame.atlas.startsWith("accessory-11")) atlas.add(frame.src);
    }
    expect(atlas.size).toBe(3); expect(getCompanionAccessoryArtFrame("not-owned-code")).toBeUndefined();
    expect(getCompanionAccessoryArtFrame("scarf")?.id).toBe("bow:front");
    expect(getCompanionAccessoryArtFrame("bell-pendant")?.id).toBe("bell-badge:front");
  });
  it("preserves the original vector source with no network references, executable content or embedded body raster", () => {
    const svg = readFileSync("public/companion/collection/accessories-111-v1.svg", "utf8");
    expect(svg).not.toMatch(/<(?:script|foreignObject|image)\b|(?:href|url)\s*[:=(]/i);
    expect(Buffer.byteLength(svg)).toBeLessThan(32000);
    expect(execFileSync(process.execPath, ["scripts/prepare-companion-accessory-vector.mjs", "--check"], { encoding: "utf8" })).toContain("Verified 48 original vector cells");
    const modern = readFileSync("public/companion/collection/accessories-114-v1.svg", "utf8");
    expect(modern).not.toMatch(/<(?:script|foreignObject|image)\b|(?:href|url)\s*[:=(]/i);
    expect(Buffer.byteLength(modern)).toBeLessThan(50000);
    expect(execFileSync(process.execPath, ["scripts/prepare-companion-accessory-vector.mjs", "--check"], { encoding: "utf8" })).toContain("Verified 60 task114 vector cells");
  });
});
