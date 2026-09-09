import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const refs = await import(path.resolve("scripts/lib/ambient-ref-library.mjs").replaceAll("\\", "/"));
const { noticeMain } = await import(path.resolve("scripts/ambient-ref-notice.mjs").replaceAll("\\", "/"));
const manifest = {
  ART_SLOTS: [
    { id: "tree-pine", category: "tree", seasons: ["spring", "summer"] },
    { id: "tree-pine-autumn", category: "tree", seasons: ["autumn"] },
    { id: "tree-pine-winter", category: "tree", seasons: ["winter"] },
    { id: "fish-koi", category: "fish", seasons: ["summer"] },
  ],
  ART_FAMILIES: { "tree-pine": { slotIds: ["tree-pine", "tree-pine-autumn", "tree-pine-winter"] } },
  slotFiles: (slot: { id: string }) => [`${slot.id}-1.png`],
};
const temporary: string[] = [];
function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vic-ref-test-"));
  temporary.push(directory);
  return directory;
}
function write(root: string, file: string, body = "fixture bytes") {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), body);
}
function pair(root: string, file: string) {
  write(root, file);
  write(root, `${file}.json`, JSON.stringify({ file: path.basename(file), license: "CC0", author: "Fixture artist", source: "https://example.invalid/art" }));
}
function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function visit(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else files[path.relative(root, file)] = `${fs.statSync(file).mtimeMs}:${fs.readFileSync(file).toString("base64")}`;
    }
  }
  visit(root);
  return files;
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^vic-ref-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("common and entity reference library", () => {
  it("writes a new image/sidecar pair once and protects existing images and manual sidecars", () => {
    const workspaceRoot = workspace();
    const options = { workspaceRoot, category: "tree", entity: "tree-pine", manifest, filename: "pine.png", image: Buffer.from("new reference"), card: { license: "CC0" } };
    expect(refs.writeReferencePair(options).saved).toBe(true);
    const imagePath = path.join(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/pine.png");
    expect(fs.readFileSync(imagePath, "utf8")).toBe("new reference");
    expect(JSON.parse(fs.readFileSync(`${imagePath}.json`, "utf8"))).toEqual({ license: "CC0" });
    expect(refs.writeReferencePair({ ...options, image: Buffer.from("replacement") }).saved).toBe(false);
    expect(fs.readFileSync(imagePath, "utf8")).toBe("new reference");
    write(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/manual.png.json", "manual source record");
    expect(refs.writeReferencePair({ ...options, filename: "manual.png" }).saved).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(imagePath), "manual.png"))).toBe(false);
    expect(fs.readFileSync(path.join(path.dirname(imagePath), "manual.png.json"), "utf8")).toBe("manual source record");
  });

  it("preserves a dangling entry occupying an image filename", () => {
    const workspaceRoot = workspace(), target = path.join(workspace(), "not-created");
    const dir = path.join(workspaceRoot, "art-src/reference/tree");
    fs.mkdirSync(dir, { recursive: true });
    fs.symlinkSync(target, path.join(dir, "pine.png"), "junction");
    expect(refs.writeReferencePair({ workspaceRoot, category: "tree", manifest, filename: "pine.png", image: Buffer.from("new"), card: {} }).saved).toBe(false);
    expect(fs.lstatSync(path.join(dir, "pine.png")).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(path.join(dir, "pine.png.json"))).toBe(false);
  });

  it("rolls back only its exact new image if another writer claims the sidecar", () => {
    const workspaceRoot = workspace(), originalWrite = fs.writeFileSync;
    const imagePath = path.join(workspaceRoot, "art-src/reference/tree/pine.png");
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, options) => {
      if (String(file) === `${imagePath}.json`) {
        originalWrite(file, "other writer's source record");
        throw new Error("Sidecar was claimed");
      }
      originalWrite(file, data, options);
    });
    expect(() => refs.writeReferencePair({ workspaceRoot, category: "tree", manifest, filename: "pine.png", image: Buffer.from("new"), card: {} })).toThrow(/claimed/);
    expect(fs.existsSync(imagePath)).toBe(false);
    expect(fs.readFileSync(`${imagePath}.json`, "utf8")).toBe("other writer's source record");
  });

  it("does not delete a changed image when sidecar creation fails", () => {
    const workspaceRoot = workspace(), originalWrite = fs.writeFileSync;
    const imagePath = path.join(workspaceRoot, "art-src/reference/tree/pine.png");
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, options) => {
      if (String(file) === `${imagePath}.json`) {
        originalWrite(imagePath, "other writer's image");
        throw new Error("Sidecar write failed");
      }
      originalWrite(file, data, options);
    });
    expect(() => refs.writeReferencePair({ workspaceRoot, category: "tree", manifest, filename: "pine.png", image: Buffer.from("new"), card: {} })).toThrow(/failed/);
    expect(fs.readFileSync(imagePath, "utf8")).toBe("other writer's image");
  });

  it("keeps category defaults and routes an explicit canonical entity without treating query values as categories", () => {
    const workspaceRoot = workspace();
    const options = { workspaceRoot, manifest };
    expect(refs.parseReferenceFetchArgs(["fish", "--query", "tree"], options)).toMatchObject({
      query: "tree", limit: 24, targets: [{ category: "fish", dir: path.join(workspaceRoot, "art-src/reference/fish") }],
    });
    expect(refs.parseReferenceFetchArgs(["tree", "--entity", "tree-pine", "--limit", "3"], options)).toMatchObject({
      limit: 3, targets: [{ category: "tree", dir: path.join(workspaceRoot, "art-src/tree/tree-pine/레퍼런스") }],
    });
    expect(refs.parseReferenceFetchArgs(["--all"], options).targets).toHaveLength(9);
    expect(fs.readdirSync(workspaceRoot)).toEqual([]);
  });

  it("rejects unknown, cross-category, traversal, missing, and ambiguous entity destinations before collection", () => {
    const options = { workspaceRoot: workspace(), manifest };
    for (const args of [
      ["tree", "--entity", "unknown"], ["fish", "--entity", "tree-pine"],
      ["tree", "--entity", "../../runs"], ["tree", "--entity"],
      ["--all", "--entity", "tree-pine"], ["tree", "fish", "--entity", "tree-pine"],
      ["tree", "--limit", "NaN"], ["tree", "--limit", "0"], ["tree", "--unknown"],
    ]) expect(() => refs.parseReferenceFetchArgs(args, options)).toThrow();
    expect(fs.readdirSync(options.workspaceRoot)).toEqual([]);
  });

  it("distinguishes duplicate basenames across common and entity references, including GIFs", () => {
    const workspaceRoot = workspace();
    const files = ["art-src/reference/tree/same.png", "art-src/tree/tree-pine/레퍼런스/same.png", "art-src/fish/fish-koi/레퍼런스/same.gif"];
    for (const file of files) pair(workspaceRoot, file);
    const before = snapshot(workspaceRoot);
    const result = refs.scanReferenceLibrary({ workspaceRoot, manifest });
    expect(result.total).toBe(3);
    expect(result.problems).toEqual([]);
    expect(result.rows.map((row: { sourcePath: string }) => row.sourcePath)).toEqual(files);
    const body = refs.renderReferenceNotice(result);
    for (const file of files) expect(body).toContain(`\`${file}\``);
    expect(snapshot(workspaceRoot)).toEqual(before);
  });

  it("does not inspect frozen runs, generated or rejected art, nested references, or unregistered entities", () => {
    const workspaceRoot = workspace();
    const ignored = [
      "art-src/tree/tree-pine/runs/pilot/inputs/reference/no-card.png",
      "art-src/tree/tree-pine/runs/pilot/review.json",
      "art-src/tree/tree-pine/runs/pilot/inputs/reference/orphan.png.json",
      "art-src/tree/tree-pine/생성본/2/공통/no-card.png",
      "art-src/tree/tree-pine/반려본/no-card.png",
      "art-src/tree/tree-pine/레퍼런스/nested/no-card.png",
      "art-src/reference/tree/nested/no-card.png",
      "art-src/tree/unknown/레퍼런스/no-card.png",
      "art-src/tree/tree-pine/레퍼런스/review.json",
    ];
    for (const file of ignored) write(workspaceRoot, file, "invalid JSON or unlicensed image");
    const before = snapshot(workspaceRoot);
    expect(refs.scanReferenceLibrary({ workspaceRoot, manifest })).toMatchObject({ total: 0, problems: [], orphanSidecars: [] });
    expect(snapshot(workspaceRoot)).toEqual(before);
  });

  it("--check reports missing sidecars and orphan cards without any write or deletion", () => {
    const workspaceRoot = workspace();
    write(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/no-card.png");
    write(workspaceRoot, "art-src/reference/tree/orphan.png.json", "{}");
    write(workspaceRoot, "art-src/reference/NOTICE.md", "existing notice");
    const before = snapshot(workspaceRoot), logger = { log: vi.fn(), error: vi.fn() };
    expect(noticeMain(["--check"], { workspaceRoot, manifest, logger })).toBe(1);
    expect(logger.error.mock.calls.flat().join("\n")).toContain("출처 없는 그림");
    expect(logger.error.mock.calls.flat().join("\n")).toContain("짝 잃은 사이드카");
    expect(snapshot(workspaceRoot)).toEqual(before);
  });

  it("writes current references and removes only orphan image sidecars inside eligible directories", () => {
    const workspaceRoot = workspace();
    pair(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/pine.png");
    write(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/orphan.gif.json", "{}");
    const preserved = ["art-src/tree/tree-pine/레퍼런스/metadata.json", "art-src/tree/tree-pine/runs/pilot/inputs/reference/orphan.png.json"];
    for (const file of preserved) write(workspaceRoot, file, "preserved JSON");
    const result = refs.updateReferenceNotice({ workspaceRoot, manifest });
    expect(result.ok).toBe(true);
    expect(result.total).toBe(1);
    expect(fs.existsSync(path.join(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/orphan.gif.json"))).toBe(false);
    for (const file of preserved) expect(fs.readFileSync(path.join(workspaceRoot, file), "utf8")).toBe("preserved JSON");
    const before = snapshot(workspaceRoot);
    expect(noticeMain(["--check"], { workspaceRoot, manifest, logger: { log: vi.fn(), error: vi.fn() } })).toBe(0);
    expect(snapshot(workspaceRoot)).toEqual(before);
  });

  it("keeps the old notice and orphan evidence when current metadata is invalid", () => {
    const workspaceRoot = workspace();
    write(workspaceRoot, "art-src/reference/NOTICE.md", "old notice");
    pair(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/pine.png");
    write(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/pine.png.json", "null");
    write(workspaceRoot, "art-src/reference/tree/orphan.png.json", "{}");
    const before = snapshot(workspaceRoot);
    expect(refs.updateReferenceNotice({ workspaceRoot, manifest }).ok).toBe(false);
    expect(snapshot(workspaceRoot)).toEqual(before);
  });

  it("refuses reference directory junctions before reading or mutating their targets", () => {
    const workspaceRoot = workspace(), target = workspace();
    write(target, "orphan.png.json", "external evidence");
    fs.mkdirSync(path.join(workspaceRoot, "art-src/reference"), { recursive: true });
    fs.symlinkSync(target, path.join(workspaceRoot, "art-src/reference/tree"), "junction");
    expect(() => refs.parseReferenceFetchArgs(["tree"], { workspaceRoot, manifest })).toThrow(/symlink/);
    expect(() => refs.updateReferenceNotice({ workspaceRoot, manifest })).toThrow(/symlink/);
    expect(fs.readFileSync(path.join(target, "orphan.png.json"), "utf8")).toBe("external evidence");
  });

  it("also rejects a dangling reference junction instead of creating its target", () => {
    const workspaceRoot = workspace(), target = path.join(workspace(), "not-created");
    fs.mkdirSync(path.join(workspaceRoot, "art-src/reference"), { recursive: true });
    fs.symlinkSync(target, path.join(workspaceRoot, "art-src/reference/tree"), "junction");
    expect(() => refs.parseReferenceFetchArgs(["tree"], { workspaceRoot, manifest })).toThrow(/symlink/);
    expect(() => refs.updateReferenceNotice({ workspaceRoot, manifest })).toThrow(/symlink/);
    expect(fs.existsSync(target)).toBe(false);
  });
});
