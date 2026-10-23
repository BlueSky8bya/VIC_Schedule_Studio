import { describe, expect, expectTypeOf, it } from "vitest";
import { BIOMES, isBiomeKey, type ActiveBiomeKey } from "@/components/shared/ambient/world/biomes";
import { BIOME_LOADERS } from "@/components/shared/ambient/scenes/biome-loaders";

describe("the single seasonal meadow", () => {
  it("has exactly one destination and one lazy loader", () => {
    expectTypeOf<ActiveBiomeKey>().toEqualTypeOf<"meadow">();
    expectTypeOf<keyof typeof BIOME_LOADERS>().toEqualTypeOf<"meadow">();
    expect(Object.keys(BIOMES)).toEqual(["meadow"]);
    expect(Object.keys(BIOME_LOADERS)).toEqual(["meadow"]);
    expect(BIOMES.meadow).toMatchObject({ key: "meadow", gx: 0, gy: 0, land: true });
  });
  it("rejects every retired destination and prototype property", () => {
    expect(isBiomeKey("meadow")).toBe(true);
    for (const value of ["forest", "hill", "pond", "valley", "mountain", "tidal", "sandy", "rocky", "shallow", "sea", "deep", "toString", "__proto__", null, undefined]) {
      expect(isBiomeKey(value), String(value)).toBe(false);
    }
  });
});
