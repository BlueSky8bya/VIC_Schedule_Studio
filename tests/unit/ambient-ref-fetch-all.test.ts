import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const batch = await import(path.resolve("scripts/ambient-ref-fetch-all.mjs").replaceAll("\\", "/"));
const { licenseAccepted } = await import(path.resolve("scripts/lib/ambient-ref-library.mjs").replaceAll("\\", "/"));
const { artManifest } = await import(path.resolve("scripts/lib/ambient-art-manifest.mjs").replaceAll("\\", "/"));
const { buildEntities } = await import(path.resolve("scripts/lib/ambient-art-entities.mjs").replaceAll("\\", "/"));
const manifest = artManifest();
const vocabulary = JSON.parse(fs.readFileSync(path.resolve("art-src/공통화풍참고/분류어휘.json"), "utf8"));
const entity = (id: string) => buildEntities(manifest).find((item: { id: string }) => item.id === id);

describe("reference batch queries", () => {
  it("strips seasons and states from slot names", () => {
    expect(batch.cleanName("Oak, spring")).toBe("oak");
    expect(batch.cleanName("Snowman, one ball")).toBe("snowman");
    expect(batch.cleanName("Tall grass / foxtail")).toBe("tall grass");
    expect(batch.cleanName("Moon phases")).toBe("moon");
    expect(batch.cleanName("Crucian carp")).toBe("crucian carp");
  });

  it("derives pixel queries and vocabulary groups for every active sky slot, with specific photo names", () => {
    const active = buildEntities(manifest);
    expect(active).toHaveLength(9);
    expect(active.every((item: { category: string }) => item.category === "sky")).toBe(true);
    const expected = [
      ["sun-disc", "sun", "sun", "sun in sky"],
      ["moon-phase", "moon", "moon", "moon phases"],
      ["comet", "comet", "moon", "comet"],
      ["shooting-star", "shooting star", "moon", "meteor night sky"],
      ["cloud-low", "cloud", "cloud", "cumulus cloud"],
      ["cloud-mid", "cloud", "cloud", "altocumulus cloud"],
      ["cloud-high", "cloud", "cloud", "cirrus cloud"],
      ["cloud-wisp", "cloud", "cloud", "cirrus cloud"],
      ["cloud-storm", "storm cloud", "cloud", "cumulonimbus cloud"]
    ];
    for (const [id, specific, group, photo] of expected) {
      expect(batch.entityQueries(entity(id), manifest, vocabulary)).toMatchObject({ specific, groups: [group], photo });
    }
    expect(entity("tree-pine")).toBeUndefined();
    // A narrow cloud group still precedes a broad group; the production vocabulary currently has one group per sky slot.
    const orderedVocabulary = { ...vocabulary, groups: { ...vocabulary.groups,
      "cloud-strand": { ko: "짧은 구름", members: ["cloud-wisp"] },
      "sky-cloud": { ko: "구름 무리", members: ["cloud-low", "cloud-mid", "cloud-wisp"] }
    } };
    const cloud = batch.entityQueries(entity("cloud-wisp"), manifest, orderedVocabulary);
    expect(cloud.groups).toEqual(["cloud strand", "sky cloud", "cloud"]);
  });

  it("matches packs by head-noun token so 'ant' never matches 'plant'", () => {
    const ant = batch.relevanceFor("ant");
    expect(ant("ant-sprite-pack")).toBe(true);
    expect(ant("pixel-plant-pack")).toBe(false);
    expect(ant("giant-tree")).toBe(false);
    const carp = batch.relevanceFor("crucian carp");
    expect(carp("koi-carp-sprites")).toBe(true);
    expect(carp("crucian-carp-set")).toBe(true);
    expect(carp("fish-pack")).toBe(false);
  });

  it("accepts attribution licenses but refuses NC/ND/GPL and unknown ones", () => {
    for (const ok of ["CC0", "CC0 1.0 Universal", "Public domain", "CC BY 4.0", "CC-BY 3.0", "CC BY-SA 3.0 at", "OGA-BY 3.0"]) expect(licenseAccepted(ok)).toBe(true);
    for (const no of ["CC BY-NC 3.0", "CC BY-ND 4.0", "GPL 2.0", "", undefined, "All rights reserved"]) expect(licenseAccepted(no)).toBe(false);
    expect(licenseAccepted("CC BY 4.0", "cc0")).toBe(false);
    expect(licenseAccepted(["CC0", "CC BY-NC 3.0"], "free")).toBe(false);
  });
});
