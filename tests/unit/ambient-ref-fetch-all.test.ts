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

  it("derives pixel queries from the slot name and vocabulary groups, photos from the species name", () => {
    const crucian = batch.entityQueries(entity("fish-crucian"), manifest, vocabulary);
    expect(crucian.specific).toBe("crucian carp");
    expect(crucian.groups).toContain("pond fish");
    expect(crucian.photo).toBe("Crucian carp");
    const pine = batch.entityQueries(entity("tree-pine"), manifest, vocabulary);
    expect(pine.groups).toEqual(["conifer"]);
    expect(pine.photo).toBe("pine tree");
    // Groups with fewer members come first so a stag beetle asks for stag beetles before generic beetles.
    const stag = batch.entityQueries(entity("bug-stagbeetle"), manifest, vocabulary);
    expect(stag.groups.indexOf("stag beetle")).toBeLessThan(stag.groups.indexOf("beetle"));
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
