import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const { artManifest, familySlots } = await import(path.resolve("scripts/lib/ambient-art-manifest.mjs").replaceAll("\\", "/"));
const { buildEntities } = await import(path.resolve("scripts/lib/ambient-art-entities.mjs").replaceAll("\\", "/"));
const { entityPath } = await import(path.resolve("scripts/lib/ambient-art-paths.mjs").replaceAll("\\", "/"));
const { parseCatalogArgs, syncCatalog } = await import(path.resolve("scripts/ambient-art-catalog.mjs").replaceAll("\\", "/"));
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
    expect(entities).toHaveLength(193);
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
    expect(get("starfish")).toBeUndefined();
    expect(get("animal-starfish")).toMatchObject({ category: "animal", slotIds: ["starfish", "animal-starfish"] });
    expect(get("animal-starfish").files.map((file: { filename: string }) => file.filename)).toEqual(["starfish.png", "animal-starfish-1.png", "animal-starfish-2.png"]);
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
    expect(index).toContain("193엔티티");
    expect(index).not.toContain("[프롬프트]");
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
    expect(syncCatalog({ workspaceRoot, entityIds: ["acorn"], check: true }).status).toBe("fail");
    expect(files(workspaceRoot)).toHaveLength(1);
    expect(syncCatalog({ workspaceRoot, entityIds: ["acorn"] }).entities).toEqual(["acorn"]);
    expect(fs.readFileSync(path.join(workspaceRoot, "art-src/소품/도토리/프롬프트.md"), "utf8")).toContain("생성본/1/가을/acorn.png");
    expect(files(workspaceRoot).every((file) => file.endsWith(".md"))).toBe(true);
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
    expect(() => syncCatalog({ workspaceRoot, entityIds: ["../escape"] })).toThrow(/Unknown art entity/);
  });

  it("prepares all entry points without images, runs or variant folders and checks without writing", () => {
    const workspaceRoot = workspace();
    const options = parseCatalogArgs(["--all", "--category", "bug", "--entity", "acorn"]);
    const entities = buildEntities(artManifest());
    const first = syncCatalog({ ...options, workspaceRoot, check: true });
    expect(first.status).toBe("fail");
    expect(first.changes).toHaveLength(966);
    expect(files(workspaceRoot)).toEqual([]);
    expect(fs.existsSync(path.join(workspaceRoot, "art-src"))).toBe(false);

    const result = syncCatalog({ ...options, workspaceRoot });
    expect(result.entities).toHaveLength(193);
    expect(files(workspaceRoot)).toHaveLength(entities.length * 5 + 1);
    expect(files(workspaceRoot).every((file) => file.endsWith(".md"))).toBe(true);
    const index = fs.readFileSync(path.join(workspaceRoot, "art-src/목록.md"), "utf8");
    expect(index.match(/\[프롬프트\]\(/g)).toHaveLength(193);
    expect(index).toContain("| 실제 폴더 (art-src/ 기준) | 내부 ID |");
    expect(index).toContain("| 소품 | 도토리 | 소품/도토리 | prop/acorn |");
    expect(index).not.toContain("| 지형 | 불가사리 |");
    expect(index).toContain("| 동물 | 불가사리 | 동물/불가사리 | animal/animal-starfish | 2 | 3 |");
    for (const entity of entities) {
      const directory = path.join(workspaceRoot, entityPath(entity));
      expect(fs.readdirSync(directory).sort()).toEqual(["프롬프트.md", "레퍼런스", "반려본", "생성본", "검토"].sort());
      for (const subdir of ["레퍼런스", "반려본", "생성본", "검토"]) {
        expect(fs.readdirSync(path.join(directory, subdir))).toEqual(["README.md"]);
      }
    }
    const snapshot = () => files(workspaceRoot).map((file) => ({
      file, modified: fs.statSync(file).mtimeMs,
      sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    }));
    const before = snapshot();
    expect(syncCatalog({ ...options, workspaceRoot, check: true }).status).toBe("pass");
    expect(snapshot()).toEqual(before);
    expect(syncCatalog({ ...options, workspaceRoot }).changes).toEqual([]);
  }, 15000);

  it("adds category and explicit selections as a union while keeping existing and public entities", () => {
    const workspaceRoot = workspace();
    const note = write(workspaceRoot, "art-src/소품/도토리/notes.md", "Owner reference plan");
    const accepted = write(workspaceRoot, "public/ambient/art/rock-1.png", "accepted original bytes");
    const options = parseCatalogArgs(["--category", "bug,bug", "--category", "bug", "--entity", "tree-pine,tree-pine"]);
    const entities = buildEntities(artManifest());
    const bugs = entities.filter((entity: { category: string }) => entity.category === "bug");
    expect(bugs).toHaveLength(39);
    const result = syncCatalog({ ...options, workspaceRoot });
    expect(result.entities.sort()).toEqual([...bugs.map((entity: { id: string }) => entity.id), "acorn", "rock", "tree-pine"].sort());
    expect(fs.existsSync(path.join(workspaceRoot, "art-src/나무/참나무"))).toBe(false);
    expect(fs.readFileSync(note, "utf8")).toBe("Owner reference plan");
    expect(fs.readFileSync(accepted, "utf8")).toBe("accepted original bytes");
    expect(syncCatalog({ ...options, workspaceRoot, check: true }).status).toBe("pass");
  });

  it.each([
    { args: ["--all", "--category", "unknown"], error: /Unknown art category/ },
    { args: ["--all", "--entity", "../escape"], error: /Unknown art entity/ },
    { args: ["--category"], error: /Missing catalog value/ },
    { args: ["--entity", "--all"], error: /Missing catalog value/ },
    { args: ["--category", "bug,"], error: /Missing catalog value/ },
    { args: ["--entity", ""], error: /Missing catalog value/ },
    { args: ["--unknown"], error: /Unknown catalog argument/ }
  ])("rejects invalid selection $args before any write", ({ args, error }) => {
    const workspaceRoot = workspace();
    expect(() => syncCatalog({ ...parseCatalogArgs(args), workspaceRoot })).toThrow(error);
    expect(files(workspaceRoot)).toEqual([]);
  });

  it("routes actual references, legacy rejection and pending run while preserving every existing byte", () => {
    const workspaceRoot = workspace();
    const entity = "art-src/나무/소나무";
    const run = `${entity}/작업회차/시험회차`;
    const originals = [
      write(workspaceRoot, "public/ambient/art/tree-pine-1.png", "accepted-normalized"),
      write(workspaceRoot, `${entity}/생성본/2/공통/tree-pine-2.png`, "legacy-original"),
      write(workspaceRoot, `${entity}/레퍼런스/pine.png`, "inspiration"),
      write(workspaceRoot, `${entity}/레퍼런스/pine.png.json`, JSON.stringify({ source: "example", role: "inspiration" })),
      write(workspaceRoot, `${entity}/반려본/과거2차/review.json`, JSON.stringify({ decision: "rejected", note: "texture" })),
      write(workspaceRoot, `${entity}/반려본/과거2차/2/공통/tree-pine-2.png`, "rejected-original"),
      write(workspaceRoot, `${run}/request.json`, JSON.stringify({ files: ["tree-pine-2.png"] })),
      write(workspaceRoot, `${run}/request.md`, "frozen exact request"),
      write(workspaceRoot, `${run}/review.json`, JSON.stringify({ decision: "pending" })),
      write(workspaceRoot, `${run}/고정입력/합격참고/tree-pine-1.png`, "frozen-baseline"),
      write(workspaceRoot, "art-src/공통화풍참고/모여봐요 동물의 숲/shared.png", "shared-style")
    ];
    const before = originals.map((file) => fs.readFileSync(file));
    const result = syncCatalog({ workspaceRoot });
    expect(result.entities).toEqual(["tree-pine"]);
    expect(originals.map((file) => fs.readFileSync(file))).toEqual(before);
    expect(files(workspaceRoot).filter((file) => file.endsWith(".png"))).toHaveLength(6);
    const prompt = fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8");
    expect(prompt).toContain("준비본, 현재 납품 없음");
    expect(prompt).toContain("<작업회차/시험회차/request.md>");
    expect(prompt).toContain("24파일");
    expect(prompt).not.toContain("frozen exact request");
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "레퍼런스/README.md"), "utf8")).toContain("pine.png.json");
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "반려본/README.md"), "utf8")).toContain("과거2차/review.json");
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
    fs.writeFileSync(originals[1], "changed-original-same-name");
    const stale = syncCatalog({ workspaceRoot, check: true });
    expect(stale.status).toBe("fail");
    expect(stale.changes).toContain(`${entity}/프롬프트.md`);
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8")).toBe(prompt);
    const beforeBulk = originals.map((file) => fs.readFileSync(file));
    syncCatalog({ workspaceRoot, all: true });
    expect(originals.map((file) => fs.readFileSync(file))).toEqual(beforeBulk);
  });

  it("lists only direct image/sidecar reference pairs (png, gif, jpg, webp) and preserves unrelated or incomplete reference material", () => {
    const workspaceRoot = workspace(), entity = "art-src/소품/도토리";
    const local = `${entity}/레퍼런스`, shared = "art-src/공통화풍참고/모여봐요 동물의 숲";
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
    // Photos arrive as jpg since the 2026-09-11 crawl, so jpg/webp pairs are references too; nested files and half-pairs still are not.
    for (const filename of ["nut.png", "nut.png.json", "nut.gif", "nut.gif.json", "photo.jpg", "photo.jpg.json", "preview.webp", "preview.webp.json"]) expect(readme).toContain(filename);
    for (const filename of ["hidden.png", "orphan.png.json", "missing-card.png", "review.json", "nut.source.json"]) expect(readme).not.toContain(filename);
    expect(readme).toContain("공통화풍참고");
    expect(readme).not.toContain("nut.source.json");
    expect(fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8")).toContain("영감 후보 이미지 4장");
    expect(originals.map((file) => fs.readFileSync(file))).toEqual(before);
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
  });

  it("protects unowned and manually edited generated documents before writing any catalog change", () => {
    const workspaceRoot = workspace();
    const manual = write(workspaceRoot, "art-src/소품/도토리/레퍼런스/README.md", "Owner notes must survive.");
    expect(syncCatalog({ workspaceRoot, all: true, check: true }).conflicts).toEqual(["art-src/소품/도토리/레퍼런스/README.md"]);
    expect(() => syncCatalog({ workspaceRoot, all: true })).toThrow(/Unowned documents protected/);
    expect(files(workspaceRoot)).toEqual([manual]);
    expect(fs.readFileSync(manual, "utf8")).toBe("Owner notes must survive.");

    const second = workspace();
    syncCatalog({ workspaceRoot: second, entityIds: ["acorn"] });
    const generated = path.join(second, "art-src/소품/도토리/레퍼런스/README.md");
    fs.appendFileSync(generated, "\nOwner added a reference note.\n");
    const index = path.join(second, "art-src/목록.md"), before = fs.readFileSync(index, "utf8");
    expect(() => syncCatalog({ workspaceRoot: second, all: true, entityIds: ["tree-oak"] })).toThrow(/Unowned documents protected/);
    expect(fs.readFileSync(generated, "utf8")).toContain("Owner added a reference note.");
    expect(fs.readFileSync(index, "utf8")).toBe(before);
    expect(fs.existsSync(path.join(second, "art-src/나무/참나무"))).toBe(false);
  });

  it("reports late parent-file and target-directory collisions before writing any entity", () => {
    const workspaceRoot = workspace();
    const entities = buildEntities(artManifest());
    const late = entities[entities.length - 1];
    const entity = entityPath(late);
    const parentFile = write(workspaceRoot, `${entity}/검토`, "Owner file, not a directory.");
    const targetDirectory = path.join(workspaceRoot, entity, "프롬프트.md");
    fs.mkdirSync(targetDirectory);
    const result = syncCatalog({ workspaceRoot, all: true, check: true });
    expect(result.status).toBe("fail");
    expect(result.conflicts.sort()).toEqual([`${entity}/검토`, `${entity}/프롬프트.md`].sort());
    expect(() => syncCatalog({ workspaceRoot, all: true })).toThrow(/Unowned documents protected/);
    expect(files(workspaceRoot)).toEqual([parentFile]);
    expect(fs.readFileSync(parentFile, "utf8")).toBe("Owner file, not a directory.");
    expect(fs.statSync(targetDirectory).isDirectory()).toBe(true);
    expect(fs.readdirSync(targetDirectory)).toEqual([]);
    expect(fs.existsSync(path.join(workspaceRoot, "art-src/목록.md"))).toBe(false);
    const first = entities[0];
    expect(fs.existsSync(path.join(workspaceRoot, entityPath(first)))).toBe(false);
  });

  it.each(["art-src/목록.md", "art-src/나무"])("rejects a dangling link at %s before any catalog write", (relative) => {
    const workspaceRoot = workspace();
    const original = write(workspaceRoot, "owner-note.md", "Keep my notes.");
    const link = path.join(workspaceRoot, relative);
    const target = path.join(workspaceRoot, "missing-link-target");
    fs.mkdirSync(path.dirname(link), { recursive: true });
    // Windows junctions exercise native dangling-link behavior without symlink privileges.
    fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    expect(fs.existsSync(link)).toBe(false);
    expect(fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()).toBe(true);
    const linkTarget = fs.readlinkSync(link);
    expect(() => syncCatalog({ workspaceRoot, all: true, check: true })).toThrow(/Linked paths are not supported/);
    expect(() => syncCatalog({ workspaceRoot, all: true })).toThrow(/Linked paths are not supported/);
    expect(files(workspaceRoot).sort()).toEqual([original, link].sort());
    expect(fs.readFileSync(original, "utf8")).toBe("Keep my notes.");
    expect(fs.readlinkSync(link)).toBe(linkTarget);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("routes translated run folders while preserving historical request fields and input bytes", () => {
    const workspaceRoot = workspace(), entity = "art-src/나무/소나무";
    const run = `${entity}/작업회차/20260909-파일럿-01`;
    const originals = [
      write(workspaceRoot, `${run}/request.json`, JSON.stringify({ runId: "20260909-pilot-01", files: ["tree-pine-2.png"], inputs: [{ path: "inputs/baseline/tree-pine-1.png", sha256: "frozen-baseline-hash" }, { path: "inputs/reference/pine.png", sha256: "frozen-reference-hash" }] })),
      write(workspaceRoot, `${run}/request.md`, "art-src/tree/tree-pine/runs/20260909-pilot-01/inputs/baseline/tree-pine-1.png"),
      write(workspaceRoot, `${run}/review.json`, JSON.stringify({ decision: "pending" })),
      write(workspaceRoot, `${run}/고정입력/합격참고/tree-pine-1.png`, "immutable baseline"),
      write(workspaceRoot, `${run}/고정입력/레퍼런스/pine.png`, "immutable reference"),
      write(workspaceRoot, `${run}/원본/tree-pine-2.png`, "delivered raw"),
      write(workspaceRoot, `${run}/정리본/tree-pine-2.png`, "normalized bytes")
    ];
    const before = originals.map((file) => fs.readFileSync(file));
    expect(syncCatalog({ workspaceRoot }).entities).toEqual(["tree-pine"]);
    const prompt = fs.readFileSync(path.join(workspaceRoot, entity, "프롬프트.md"), "utf8");
    expect(prompt).toContain("요청 1장 / 원본 1장 / 정리본 1장");
    expect(prompt).toContain("<작업회차/20260909-파일럿-01/request.md>");
    for (const current of ["원본", "고정입력", "고정입력/합격참고/tree-pine-1.png", "고정입력/레퍼런스/pine.png"]) {
      expect(prompt).toContain(`<작업회차/20260909-파일럿-01/${current}>`);
    }
    expect(prompt).toContain("요청서 안의 옛 경로는 위의 현재 경로로 읽으며 파일명·입력 해시는 유지한다.");
    expect(prompt).toContain("--run <한글-회차명>");
    expect(prompt).not.toContain("<새-run-id>");
    const review = fs.readFileSync(path.join(workspaceRoot, entity, "검토/README.md"), "utf8");
    expect(review).toContain("<../작업회차/20260909-파일럿-01/정리본>");
    expect(originals.map((file) => fs.readFileSync(file))).toEqual(before);
    expect(syncCatalog({ workspaceRoot, check: true }).status).toBe("pass");
  });
});
