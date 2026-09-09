import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const { artManifest, familySlots } = await import(path.resolve("scripts/lib/ambient-art-manifest.mjs").replaceAll("\\", "/"));
const { buildEntities } = await import(path.resolve("scripts/lib/ambient-art-entities.mjs").replaceAll("\\", "/"));
const { syncCatalog } = await import(path.resolve("scripts/ambient-art-catalog.mjs").replaceAll("\\", "/"));
const temporary: string[] = [];
function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vic-art-catalog-test-"));
  temporary.push(directory);
  return directory;
}
function write(directory: string, relative: string, contents: string) {
  const file = path.join(directory, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}
function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
afterEach(() => {
  for (const directory of temporary.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^vic-art-catalog-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("entity catalog boundaries", () => {
  it("assigns every exact slot file once without multiplying seasons or numeric singleton ids", () => {
    const manifest = artManifest();
    const entities = buildEntities(manifest);
    const get = (id: string) => entities.find((entity: { id: string }) => entity.id === id);
    expect(entities).toHaveLength(194);
    expect(entities.flatMap((entity: { slotIds: string[] }) => entity.slotIds).sort()).toEqual(manifest.ART_SLOTS.map((slot: { id: string }) => slot.id).sort());
    const filenames = entities.flatMap((entity: { files: { filename: string }[] }) => entity.files.map((asset) => asset.filename));
    expect(filenames).toHaveLength(419);
    expect(new Set(filenames).size).toBe(419);
    expect(filenames.sort()).toEqual(manifest.ART_SLOTS.flatMap(manifest.slotFiles).sort());
    expect(get("tree-oak").slotIds).toHaveLength(4);
    expect(get("tree-oak").files).toHaveLength(24);
    expect(get("tree-pine").slotIds).toHaveLength(3);
    expect(get("tree-pine").files).toHaveLength(24);
    expect(get("tree-pine").files[0]).toMatchObject({ filename: "tree-pine-1.png", season: null, seasonKo: "공통", relativePath: "생성본/1/공통/tree-pine-1.png" });
    expect(get("tree-oak").files[0]).toMatchObject({ season: "spring", relativePath: "생성본/1/봄/tree-oak-spring-1.png" });
    expect(get("sapling").slotIds).toEqual(["sapling-green", "sapling-autumn", "sapling-bare"]);
    expect(get("snowman-1").files).toEqual([{ filename: "snowman-1.png", slotId: "snowman-1", variant: 1, season: "winter", seasonKo: "겨울", relativePath: "생성본/1/겨울/snowman-1.png" }]);
    expect(familySlots("tree-oak")).toHaveLength(4);
    expect(familySlots("tree-oak-spring")).toHaveLength(1);
    expect(manifest.ART_FAMILIES["tree-oak"]).toBeUndefined();
  });

  it("keeps unmaterialized entries unlinked and creates selected routers without images", () => {
    const workspaceRoot = workspace();
    const first = syncCatalog({ workspaceRoot });
    expect(first.entities).toEqual([]);
    expect(files(workspaceRoot)).toHaveLength(1);
    const index = fs.readFileSync(path.join(workspaceRoot, "art-src/목록.md"), "utf8");
    expect(index).toContain("207 slots");
    expect(index).toContain("194엔티티");
    expect(index).not.toContain("[프롬프트]");
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
    expect(syncCatalog({ workspaceRoot, entityIds: ["acorn"], check: true }).status).toBe("fail");
    expect(files(workspaceRoot)).toHaveLength(1);
    expect(syncCatalog({ workspaceRoot, entityIds: ["acorn"] }).entities).toEqual(["acorn"]);
    expect(fs.readFileSync(path.join(workspaceRoot, "art-src/prop/acorn/프롬프트.md"), "utf8")).toContain("생성본/1/가을/acorn.png");
    expect(files(workspaceRoot).every((file) => file.endsWith(".md"))).toBe(true);
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
    expect(() => syncCatalog({ workspaceRoot, entityIds: ["../escape"] })).toThrow(/Unknown art entity/);
  });

  it("routes actual references, legacy rejection and pending run while preserving every existing byte", () => {
    const workspaceRoot = workspace();
    const entity = "art-src/tree/tree-pine";
    const run = `${entity}/runs/pilot`;
    const originals = [
      write(workspaceRoot, "public/ambient/art/tree-pine-1.png", "accepted-normalized"),
      write(workspaceRoot, `${entity}/생성본/2/공통/tree-pine-2.png`, "legacy-original"),
      write(workspaceRoot, `${entity}/레퍼런스/pine.png`, "inspiration"),
      write(workspaceRoot, `${entity}/레퍼런스/pine.png.json`, JSON.stringify({ source: "example", role: "inspiration" })),
      write(workspaceRoot, `${entity}/반려본/legacy-r2/review.json`, JSON.stringify({ decision: "rejected", note: "texture" })),
      write(workspaceRoot, `${entity}/반려본/legacy-r2/2/공통/tree-pine-2.png`, "rejected-original"),
      write(workspaceRoot, `${run}/request.json`, JSON.stringify({ files: ["tree-pine-2.png"] })),
      write(workspaceRoot, `${run}/request.md`, "frozen exact request"),
      write(workspaceRoot, `${run}/review.json`, JSON.stringify({ decision: "pending" })),
      write(workspaceRoot, `${run}/inputs/baseline/tree-pine-1.png`, "frozen-baseline"),
      write(workspaceRoot, "art-src/reference/tree/shared.png", "shared-candidate")
    ];
    const before = originals.map((file) => fs.readFileSync(file));
    const result = syncCatalog({ workspaceRoot });
    expect(result.entities).toEqual(["tree-pine"]);
    expect(originals.map((file) => fs.readFileSync(file))).toEqual(before);
    expect(files(workspaceRoot).filter((file) => file.endsWith(".png"))).toHaveLength(6);
    const prompt = fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8");
    expect(prompt).toContain("준비본, 현재 납품 없음");
    expect(prompt).toContain("<runs/pilot/request.md>");
    expect(prompt).toContain("24파일");
    expect(prompt).not.toContain("frozen exact request");
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "레퍼런스/README.md"), "utf8")).toContain("pine.png.json");
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "반려본/README.md"), "utf8")).toContain("legacy-r2/review.json");
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
    fs.writeFileSync(originals[1], "changed-original-same-name");
    const stale = syncCatalog({ workspaceRoot, check: true });
    expect(stale.status).toBe("fail");
    expect(stale.changes).toContain(`${entity}/프롬프트.md`);
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8")).toBe(prompt);
  });

  it("lists only direct PNG/GIF reference pairs and preserves unrelated or incomplete reference material", () => {
    const workspaceRoot = workspace(), entity = "art-src/prop/acorn";
    const local = `${entity}/레퍼런스`, shared = "art-src/reference/prop";
    const originals = [];
    for (const directory of [local, shared]) {
      for (const filename of ["nut.png", "nut.gif", "photo.jpg", "preview.webp", "nested/hidden.png"]) {
        originals.push(write(workspaceRoot, `${directory}/${filename}`, "reference bytes"));
        originals.push(write(workspaceRoot, `${directory}/${filename}.json`, JSON.stringify({ license: "CC0" })));
      }
      for (const filename of ["orphan.png.json", "missing-card.png", "review.json", "nut.source.json"]) {
        originals.push(write(workspaceRoot, `${directory}/${filename}`, "unrelated or incomplete material"));
      }
    }
    const before = originals.map((file) => fs.readFileSync(file));
    syncCatalog({ workspaceRoot });
    const readme = fs.readFileSync(path.join(workspaceRoot, local, "README.md"), "utf8");
    for (const filename of ["nut.png", "nut.png.json", "nut.gif", "nut.gif.json"]) expect(readme).toContain(filename);
    for (const filename of ["photo.jpg", "preview.webp", "hidden.png", "orphan.png.json", "missing-card.png", "review.json", "nut.source.json"]) expect(readme).not.toContain(filename);
    expect(readme).toContain("이미지 2장");
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8")).toContain("영감 후보 이미지 2장");
    expect(originals.map((file) => fs.readFileSync(file))).toEqual(before);
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
  });

  it("protects unowned and manually edited generated documents before writing any catalog change", () => {
    const workspaceRoot = workspace();
    const manual = write(workspaceRoot, "art-src/prop/acorn/레퍼런스/README.md", "Owner notes must survive.");
    expect(syncCatalog({ workspaceRoot, check: true }).conflicts).toEqual(["art-src/prop/acorn/레퍼런스/README.md"]);
    expect(() => syncCatalog({ workspaceRoot })).toThrow(/Unowned documents protected/);
    expect(files(workspaceRoot)).toEqual([manual]);
    expect(fs.readFileSync(manual, "utf8")).toBe("Owner notes must survive.");

    const second = workspace();
    syncCatalog({ workspaceRoot: second, entityIds: ["acorn"] });
    const generated = path.join(second, "art-src/prop/acorn/레퍼런스/README.md");
    fs.appendFileSync(generated, "\nOwner added a reference note.\n");
    const index = path.join(second, "art-src/목록.md"), before = fs.readFileSync(index, "utf8");
    expect(() => syncCatalog({ workspaceRoot: second, entityIds: ["tree-oak"] })).toThrow(/Unowned documents protected/);
    expect(fs.readFileSync(generated, "utf8")).toContain("Owner added a reference note.");
    expect(fs.readFileSync(index, "utf8")).toBe(before);
    expect(fs.existsSync(path.join(second, "art-src/tree/tree-oak"))).toBe(false);
  });
});
