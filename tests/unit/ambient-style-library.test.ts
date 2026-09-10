import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const lib = await import(path.resolve("scripts/lib/ambient-style-library.mjs").replaceAll("\\", "/"));
const pipeline = await import(path.resolve("scripts/ambient-art-pipeline.mjs").replaceAll("\\", "/"));
const paths = await import(path.resolve("scripts/lib/ambient-art-paths.mjs").replaceAll("\\", "/"));
const { artManifest, codexEntries } = await import(path.resolve("scripts/lib/ambient-art-manifest.mjs").replaceAll("\\", "/"));
const { buildEntities } = await import(path.resolve("scripts/lib/ambient-art-entities.mjs").replaceAll("\\", "/"));

const manifest = artManifest();
const codex = codexEntries();
const vocabulary = JSON.parse(fs.readFileSync(path.resolve("art-src/공통화풍참고/분류어휘.json"), "utf8"));
const temporary: string[] = [];
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const STYLE = "art-src/공통화풍참고";

function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vic-style-test-"));
  temporary.push(directory);
  fs.mkdirSync(path.join(directory, STYLE), { recursive: true });
  fs.writeFileSync(path.join(directory, STYLE, "분류어휘.json"), JSON.stringify(vocabulary));
  fs.mkdirSync(path.join(directory, "public/ambient/art"), { recursive: true });
  return directory;
}
function image(root: string, relative: string, body = relative) {
  const file = path.join(root, STYLE, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bytes = Buffer.from(`image:${body}`);
  fs.writeFileSync(file, bytes);
  return { file: relative.split("/").slice(1).join("/"), sha256: sha(bytes), bytes: bytes.length };
}
type Entry = Record<string, unknown>;
function entry(record: { file: string; sha256: string; bytes: number }, fields: Entry): Entry {
  return { ...record, width: 64, height: 64, format: "png", kind: "icon", style: "toon", view: "side", subjects: [], env: [], time: null, season: null, role: "depiction", flags: [], note: "", classifiedAt: "2026-09-10", classifiedBy: "test", ...fields };
}
function index(root: string, source: string, slug: string, entries: Entry[]) {
  const sorted = [...entries].sort((a, b) => String(a.file).localeCompare(String(b.file), "ko"));
  fs.writeFileSync(path.join(root, STYLE, source, "색인.json"), JSON.stringify({ schemaVersion: 1, source, slug, origin: "test captures", usage: "style only", entries: sorted }));
}
const entityOf = (id: string) => buildEntities(manifest).find((item: { id: string }) => item.id === id);
afterEach(() => {
  for (const directory of temporary.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^vic-style-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("style reference library", () => {
  it("reports unindexed, stale and changed images and refuses vocabulary drift", () => {
    const workspaceRoot = workspace();
    const indexed = image(workspaceRoot, "게임A/a.png");
    image(workspaceRoot, "게임A/sub/b.webp");
    const changed = image(workspaceRoot, "게임A/c.jpg");
    index(workspaceRoot, "게임A", "ga", [
      entry(indexed, { subjects: ["shark", "fish"], env: ["underwater"] }),
      entry({ ...changed, sha256: sha("old bytes") }, { subjects: ["fish"], env: ["underwater"] }),
      entry({ file: "gone.png", sha256: sha("gone"), bytes: 4 }, { subjects: ["fish"], env: ["underwater"] }),
      entry(image(workspaceRoot, "게임A/d.png"), { subjects: ["not-a-tag"], env: ["underwater"], role: "depiction" })
    ]);
    const scan = lib.scanStyleLibrary({ workspaceRoot, manifest });
    expect(scan.ok).toBe(false);
    expect(scan.sources[0].unindexed).toEqual(["sub/b.webp"]);
    expect(scan.sources[0].stale).toEqual(["gone.png"]);
    expect(scan.sources[0].changed).toEqual(["c.jpg"]);
    expect(scan.problems.some((problem: string) => problem.includes("not-a-tag"))).toBe(true);
    expect(lib.updateStyleCatalog({ workspaceRoot, manifest, check: true }).ok).toBe(false);
    expect(fs.existsSync(path.join(workspaceRoot, STYLE, "목록.md"))).toBe(false);
  });

  it("applies a worksheet only when every entry is classified and still matches its file, then bakes the catalog", async () => {
    const workspaceRoot = workspace();
    const a = image(workspaceRoot, "게임A/a.png");
    const b = image(workspaceRoot, "게임A/b.png");
    const written = await lib.writeWorksheets({ workspaceRoot, manifest, measure: async () => ({ width: 10, height: 12, format: "png" }) });
    expect(written.written).toHaveLength(1);
    const worksheetFile = path.join(workspaceRoot, STYLE, "게임A/분류대기.json");
    const worksheet = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
    expect(worksheet.entries.map((item: { file: string }) => item.file)).toEqual(["a.png", "b.png"]);
    expect(worksheet.entries[0].width).toBe(10);
    // Half-filled worksheets stay worksheets: nothing is written to the index.
    worksheet.slug = "ga"; worksheet.origin = "owner captures"; worksheet.usage = "style only";
    worksheet.entries[0] = entry(a, { width: 10, height: 12, subjects: ["fish-crucian", "pond-fish", "fish"], env: ["pond"] });
    fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));
    const rejected = lib.applyWorksheet({ workspaceRoot, manifest, sourceName: "게임A" });
    expect(rejected.ok).toBe(false);
    expect(rejected.problems.some((problem: string) => problem.includes("b.png") && problem.includes("role"))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, STYLE, "게임A/색인.json"))).toBe(false);
    worksheet.entries[1] = entry(b, { width: 10, height: 12, kind: "scene", style: "render", view: "wide", role: "mood", env: ["pond", "meadow"], time: "day", season: "spring", flags: ["has-character"] });
    fs.writeFileSync(worksheetFile, JSON.stringify(worksheet));
    const applied = lib.applyWorksheet({ workspaceRoot, manifest, sourceName: "게임A" });
    expect(applied).toMatchObject({ ok: true, applied: 2, total: 2 });
    expect(fs.existsSync(worksheetFile)).toBe(false);
    const stored = JSON.parse(fs.readFileSync(path.join(workspaceRoot, STYLE, "게임A/색인.json"), "utf8"));
    expect(stored.slug).toBe("ga");
    expect(stored.entries.map((item: { file: string; role: string }) => [item.file, item.role])).toEqual([["a.png", "depiction"], ["b.png", "mood"]]);
    // A byte change after indexing is caught, and the worksheet's stale hash is refused rather than silently re-hashed.
    fs.writeFileSync(path.join(workspaceRoot, STYLE, "게임A/a.png"), "tampered");
    expect(lib.scanStyleLibrary({ workspaceRoot, manifest }).sources[0].changed).toEqual(["a.png"]);
    await lib.writeWorksheets({ workspaceRoot, manifest, measure: async () => ({ width: 1, height: 1, format: "png" }) });
    const retry = JSON.parse(fs.readFileSync(worksheetFile, "utf8"));
    retry.entries[0] = entry({ ...retry.entries[0], sha256: a.sha256 }, { subjects: ["fish"], env: ["pond"] });
    fs.writeFileSync(worksheetFile, JSON.stringify(retry));
    expect(lib.applyWorksheet({ workspaceRoot, manifest, sourceName: "게임A" }).problems[0]).toMatch(/sha256/);
    expect(lib.updateStyleCatalog({ workspaceRoot, manifest }).ok).toBe(false);
  });

  it("picks exact subjects over groups over categories, respects quotas and never attaches none/unindexed", () => {
    const workspaceRoot = workspace();
    const records = {
      exact: image(workspaceRoot, "게임A/exact.png"), group: image(workspaceRoot, "게임A/group.png"), category: image(workspaceRoot, "게임A/category.png"),
      lowres: image(workspaceRoot, "게임A/lowres.png"), none: image(workspaceRoot, "게임A/none.png"), form: image(workspaceRoot, "게임A/form.png"),
      moodPond: image(workspaceRoot, "게임A/mood-pond.jpg"), moodSea: image(workspaceRoot, "게임A/mood-sea.jpg"), moodSky: image(workspaceRoot, "게임A/mood-sky.jpg"),
      bug: image(workspaceRoot, "게임A/bug.png"), extra: image(workspaceRoot, "게임A/extra.png")
    };
    index(workspaceRoot, "게임A", "ga", [
      entry(records.exact, { subjects: ["fish-crucian", "pond-fish", "fish"], env: ["underwater"] }),
      entry(records.group, { subjects: ["pond-fish", "fish"], env: ["underwater"] }),
      entry(records.category, { subjects: ["fish"], env: ["underwater"], style: "pixel" }),
      entry(records.lowres, { subjects: ["fish-crucian", "fish"], env: ["underwater"], flags: ["low-res"] }),
      entry(records.none, { subjects: ["fish-crucian", "fish"], env: ["underwater"], role: "none", flags: ["watermark"] }),
      entry(records.form, { subjects: ["fish-crucian", "fish"], env: [], kind: "render", style: "render", role: "form" }),
      entry(records.moodPond, { kind: "scene", style: "render", view: "wide", subjects: [], env: ["pond", "meadow"], time: "day", season: "summer", role: "mood" }),
      entry(records.moodSea, { kind: "scene", style: "render", view: "wide", subjects: [], env: ["sea-surface"], time: "night", season: "summer", role: "mood" }),
      entry(records.moodSky, { kind: "scene", style: "pixel", view: "wide", subjects: ["cloud"], env: ["sky"], time: "day", season: null, role: "mood" }),
      entry(records.bug, { subjects: ["bug-ladybug", "beetle", "bug"], env: ["meadow"], view: "top" }),
      entry(records.extra, { subjects: ["fish-carp", "pond-fish", "fish"], env: ["underwater"] })
    ]);
    image(workspaceRoot, "게임A/unindexed-crucian.png");
    const picks = lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("fish-crucian"), limit: 6 });
    const files = picks.map((pick: { file: string }) => pick.file);
    expect(files).toContain("exact.png");
    expect(files).toContain("mood-pond.jpg");
    expect(files).not.toContain("none.png");
    expect(files).not.toContain("unindexed-crucian.png");
    expect(files).not.toContain("mood-sky.jpg");
    expect(files).not.toContain("bug.png");
    // A same-group depiction exists, so the 3D render is not attached.
    expect(files).not.toContain("form.png");
    const depictions = picks.filter((pick: { role: string }) => pick.role === "depiction");
    expect(depictions).toHaveLength(3);
    expect(depictions[0].file).toBe("exact.png");
    expect(picks.filter((pick: { role: string }) => pick.role === "mood").length).toBeLessThanOrEqual(2);
    expect(picks[0].frozenName).toMatch(/^ga-[a-f0-9]{8}\.(png|jpg)$/);
    expect(picks[0].reason).toContain("화풍");
    expect(lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("fish-crucian"), limit: 2 })).toHaveLength(2);
    expect(lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("fish-crucian"), limit: 0 })).toEqual([]);
    // A bug shares the meadow scene but never receives fish depictions; the sea scene has no environment in common.
    const ladybug = lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("bug-ladybug"), limit: 6 });
    expect(ladybug.map((pick: { file: string }) => pick.file)).toEqual(["mood-pond.jpg", "bug.png"]);
    // A category-only match without a shared environment is dropped: the sea creature 'category.png' never reaches a land animal.
    const chipmunk = lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("animal-chipmunk"), limit: 6 });
    expect(chipmunk.map((pick: { file: string }) => pick.file)).toEqual(["mood-pond.jpg"]);
    // Without any depiction of the group, one 3D form reference is allowed.
    fs.writeFileSync(path.join(workspaceRoot, STYLE, "게임A/색인.json"), JSON.stringify({ schemaVersion: 1, source: "게임A", slug: "ga", origin: "test", usage: "style", entries: [
      entry(records.form, { subjects: ["fish-crucian", "fish"], env: [], kind: "render", style: "render", role: "form" }),
      entry(records.category, { subjects: ["fish"], env: ["underwater"], style: "pixel" })
    ].sort((x, y) => String(x.file).localeCompare(String(y.file), "ko")) }));
    const formOnly = lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("fish-crucian"), limit: 6 });
    expect(formOnly.map((pick: { file: string; role: string }) => [pick.file, pick.role])).toEqual([["category.png", "depiction"], ["form.png", "form"]]);
    index(workspaceRoot, "게임A", "ga", [
      entry(records.exact, { subjects: ["fish-crucian", "pond-fish", "fish"], env: ["underwater"] }),
      entry(records.moodPond, { kind: "scene", style: "render", view: "wide", subjects: [], env: ["pond", "meadow"], time: "day", season: "summer", role: "mood" })
    ]);
    const twig = lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("twig"), limit: 6 });
    expect(twig.map((pick: { file: string }) => pick.file)).toEqual(["mood-pond.jpg"]);
    // Selection re-hashes before returning: a capture edited after indexing cannot be frozen silently.
    fs.writeFileSync(path.join(workspaceRoot, STYLE, "게임A/exact.png"), "tampered");
    expect(() => lib.selectStyleReferences({ workspaceRoot, manifest, codex, entity: entityOf("fish-crucian"), limit: 6 })).toThrow(/changed since indexing/);
  });

  it("freezes chosen captures into the run under short names and records their reasons", () => {
    const workspaceRoot = workspace();
    const exact = image(workspaceRoot, "게임A/very-long-cache-hash-name-that-would-not-fit-a-windows-path-when-combined-with-the-run-folder-name.webp", "twig-icon");
    const mood = image(workspaceRoot, "게임A/scene.jpg");
    index(workspaceRoot, "게임A", "ga", [
      entry(exact, { subjects: ["twig", "log", "ground"], env: ["forest"], style: "pixel" }),
      entry(mood, { kind: "scene", style: "render", view: "wide", subjects: [], env: ["forest", "meadow"], time: "day", season: "autumn", role: "mood" })
    ]);
    const result = pipeline.createRequest({ workspaceRoot, family: "twig", runId: "화풍첨부", variants: [2] });
    const style = result.request.inputs.filter((input: { kind: string }) => input.kind.startsWith("style-"));
    expect(style.map((input: { kind: string }) => input.kind)).toEqual(["style-mood", "style-depiction"]);
    expect(style[1].path).toBe(paths.inputPath(`inputs/style/ga-${exact.sha256.slice(0, 8)}.webp`));
    expect(style[1].source).toContain("게임A/very-long-cache-hash-name");
    expect(style[1].style).toMatchObject({ source: "게임A", role: "depiction", subjects: ["twig", "log", "ground"] });
    expect(fs.readFileSync(path.join(result.runDir, style[1].path)).equals(Buffer.from("image:twig-icon"))).toBe(true);
    expect(result.prompt).toContain("화풍·그림체(같은 부류)");
    expect(result.prompt).toContain("화풍·분위기(공통화풍참고)");
    expect(result.prompt).toContain("복제하거나 트레이스하지 않고");
    expect(result.prompt).toContain(style[1].reason);
    // Style captures never count as approved art: the run is still a style pilot.
    expect(result.request.mode).toBe("style-pilot");
    expect(result.prompt).toContain("해당 범주의 합격본 없음");
    const disabled = pipeline.createRequest({ workspaceRoot, family: "twig", runId: "화풍끔", variants: [2], styleLimit: 0, dry: true });
    expect(disabled.request.inputs.some((input: { kind: string }) => input.kind.startsWith("style-"))).toBe(false);
    expect(disabled.prompt).not.toContain("공통화풍참고 사본은");
  });

  it("names a run automatically by KST date when the owner gives only the entity", () => {
    const workspaceRoot = workspace();
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replaceAll("-", "");
    const first = pipeline.createRequest({ workspaceRoot, family: "twig", variants: [2] });
    expect(path.basename(first.runDir)).toBe(`${today}-자동-01`);
    expect(first.request.runId).toBe(`${today}-자동-01`);
    const second = pipeline.createRequest({ workspaceRoot, family: "twig", variants: [2] });
    expect(path.basename(second.runDir)).toBe(`${today}-자동-02`);
    expect(() => pipeline.createRequest({ workspaceRoot, family: "twig", variants: [2], refreshPrepared: true })).toThrow(/needs the existing --run/);
  });
});
