import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const pipeline = await import(path.resolve("scripts/ambient-art-pipeline.mjs").replaceAll("\\", "/"));
const checker = await import(path.resolve("scripts/ambient-art-check.mjs").replaceAll("\\", "/"));
const paths = await import(path.resolve("scripts/lib/ambient-art-paths.mjs").replaceAll("\\", "/"));
const manifest = await import(path.resolve("scripts/lib/ambient-art-manifest.mjs").replaceAll("\\", "/"));
const entities = await import(path.resolve("scripts/lib/ambient-art-entities.mjs").replaceAll("\\", "/"));
const sharp = createRequire(import.meta.url)("sharp");
const temporary: string[] = [];
function entityDirectory(id: string) {
  const entity = entities.buildEntities(manifest.artManifest()).find((item: { id: string }) => item.id === id);
  if (!entity) throw new Error(`Unknown fixture entity: ${id}`);
  return paths.entityPath(entity);
}
function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vic-art-test-"));
  temporary.push(directory);
  fs.mkdirSync(path.join(directory, "public/ambient/art"), { recursive: true });
  return directory;
}
async function fixture(size = 1024, noise = false, wide = false) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = size * (wide ? 3 / 8 : 1 / 8); y < size * (wide ? 5 / 8 : 7 / 8); y++) for (let x = size * (wide ? 1 / 8 : 1 / 4); x < size * (wide ? 7 / 8 : 3 / 4); x++) {
    const i = (y * size + x) * 4;
    pixels[i] = noise && (x + y) % 2 ? 180 : 70;
    pixels[i + 1] = 110;
    pixels[i + 2] = 80;
    pixels[i + 3] = 255;
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

async function approvedTwig(workspaceRoot: string) {
  const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "twig", runId: "반영", variants: [2] });
  const raw = await fixture(1024, false, true);
  fs.writeFileSync(path.join(runDir, `${paths.ART_DIR.raw}/twig-2.png`), raw);
  expect((await pipeline.normalizeRun({ workspaceRoot, runDir })).status).not.toBe("fail");
  pipeline.reviewRun({ workspaceRoot, runDir, decision: "approved", reviewer: "owner", note: "Owner approved the isolated fixture." });
  const archive = path.join(workspaceRoot, path.posix.join(entityDirectory("twig"), "생성본/2/공통/twig-2.png"));
  return { runDir, request, raw, archive, publicFile: path.join(workspaceRoot, "public/ambient/art/twig-2.png") };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^vic-art-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("art pipeline boundaries", () => {
  it("requests exactly two complete pine packs and protects accepted filenames", () => {
    const workspaceRoot = workspace();
    for (const file of ["tree-pine-1.png", "tree-pine-autumn-1.png", "tree-pine-winter-1.png"]) fs.writeFileSync(path.join(workspaceRoot, "public/ambient/art", file), "accepted");
    const result = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "파일럿", dry: true });
    expect(result.request.files).toEqual(["tree-pine-2.png", "tree-pine-3.png", "tree-pine-autumn-2.png", "tree-pine-autumn-3.png", "tree-pine-winter-2.png", "tree-pine-winter-3.png"]);
    expect(result.prompt).toContain("파일 6장");
    expect(result.prompt).toContain(paths.inputPath("inputs/baseline/tree-pine-1.png"));
    expect(result.prompt).toContain("art-src/나무/소나무/작업회차/파일럿/원본");
    expect(result.prompt).not.toContain("inputs 사본");
    expect(result.prompt).not.toContain("docs/ambient/reference/");
    expect(result.prompt).not.toMatch(/public\/ambient\/art\/[a-z]/);
    expect(result.prompt).toContain("전체 변형 수·과거 반려 수량은 추가 납품 지시가 아니다");
    expect(fs.existsSync(result.runDir)).toBe(false);
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "덮어쓰기", variants: [1] })).toThrow(/Accepted asset protected/);
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "부분", files: ["tree-pine-2.png"] })).toThrow(/Incomplete seasonal pack/);
  });

  it("freezes curated entity references as attachments and refuses ones without CC0 provenance", async () => {
    const workspaceRoot = workspace();
    const referenceDir = path.join(workspaceRoot, path.posix.join(entityDirectory("tree-pine"), "레퍼런스"));
    fs.mkdirSync(referenceDir, { recursive: true });
    const image = await fixture(64);
    fs.writeFileSync(path.join(referenceDir, "oga-example-pine.png"), image);
    fs.writeFileSync(path.join(referenceDir, "웹후보.md"), "링크만 있는 후보는 첨부 대상이 아니다.");

    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "출처없음", dry: true })).toThrow(/no provenance sidecar/);
    const card = path.join(referenceDir, "oga-example-pine.png.json");
    fs.writeFileSync(card, JSON.stringify({ license: "CC BY 3.0", author: "someone" }));
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "라이선스검사", dry: true })).toThrow(/not CC0/);

    fs.writeFileSync(card, JSON.stringify({ license: "CC0", author: "someone", source: "https://example.test/pine" }));
    const result = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "레퍼런스첨부" });
    const collected = result.request.inputs.filter((input: { kind: string }) => input.kind === "inspiration");
    expect(collected).toHaveLength(1);
    expect(collected[0].path).toBe(paths.inputPath("inputs/collected/oga-example-pine.png"));
    expect(collected[0].source).toContain("레퍼런스/oga-example-pine.png");
    // The frozen copy is what actually reaches the generator, so its bytes must match the curated file.
    expect(fs.readFileSync(path.join(result.runDir, collected[0].path)).equals(image)).toBe(true);
    expect(result.prompt).toContain(`형태 발상만: \`${path.posix.join(entityDirectory("tree-pine"), "작업회차/레퍼런스첨부", collected[0].path)}\``);
    expect(result.prompt).toContain("그림으로 첨부");
    expect(result.prompt).not.toContain("그리기 전에 열어 볼 고정 입력");
    expect(result.prompt).not.toContain("웹후보");
  });

  it("allows Korean run names with spaces while refusing new English or traversal folders", () => {
    const workspaceRoot = workspace();
    const runId = "20260909 · 1차 (검토)";
    const request = pipeline.createRequest({ workspaceRoot, family: "twig", runId, variants: [2], dry: true });
    expect(path.basename(request.runDir)).toBe(runId);
    for (const invalid of ["pilot", "한글-pilot", "../탈출", "회차/탈출", "회차\\탈출", "후행 "]) {
      expect(() => pipeline.createRequest({ workspaceRoot, family: "twig", runId: invalid, dry: true })).toThrow(/Korean folder name/);
    }
    expect(fs.existsSync(path.join(workspaceRoot, "art-src"))).toBe(false);
  });

  it("routes seasonal slots to their entity and inherits all reasons from historical batches", () => {
    const workspaceRoot = workspace();
    const oak = pipeline.createRequest({ workspaceRoot, family: "tree-oak-spring", runId: "계절", variants: [1], dry: true });
    expect(oak.runDir.replaceAll("\\", "/")).toContain(path.posix.join(entityDirectory("tree-oak"), "작업회차/계절"));
    expect(oak.request.files).toEqual(["tree-oak-spring-1.png"]);
    const directory = path.join(workspaceRoot, path.posix.join(entityDirectory("tree-pine"), "반려본/접수-소나무-3차"));
    fs.mkdirSync(directory, { recursive: true });
    const issues = ["texture", "diversity", "snow", "trunk"].map((ruleId) => ({ ruleId, status: "open", observed: `Historical ${ruleId}` }));
    fs.writeFileSync(path.join(directory, "review.json"), JSON.stringify({ kind: "legacy-rejection", decision: "rejected", historicalDate: "2026-09-08", issues: [...issues, { ruleId: "closed", status: "resolved", observed: "Do not repeat" }] }));
    const next = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "다음", dry: true });
    expect(next.request.priorRejections).toHaveLength(4);
    expect(next.request.priorRejections.every((issue: { evidenceKind: string }) => issue.evidenceKind === "imported-historical-rejection")).toBe(true);
    expect(next.prompt).toContain("Historical trunk");
    expect(next.prompt).not.toContain("Do not repeat");
    expect(fs.existsSync(next.runDir)).toBe(false);
  });

  it("does not let recent resolved batches hide older unresolved rejection reasons", () => {
    const workspaceRoot = workspace();
    for (let index = 0; index < 4; index += 1) {
      const folder = index === 0 ? "반려본" : paths.ART_DIR.runs;
      const directory = path.join(workspaceRoot, entityDirectory("tree-pine"), folder, `이전-${index}차`);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "review.json"), JSON.stringify({
        kind: index === 0 ? "legacy-rejection" : undefined, decision: "rejected",
        reviewedAt: `2026-09-0${index + 1}T00:00:00Z`,
        issues: [{ ruleId: `reason-${index}`, status: index === 0 ? "open" : "resolved", observed: `Batch ${index} evidence` }],
      }));
    }
    const next = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "다음", dry: true });
    expect(next.request.priorRejections).toHaveLength(1);
    expect(next.request.priorRejections[0].ruleId).toBe("reason-0");
    expect(next.prompt).toContain("Batch 0 evidence");
    expect(next.prompt).not.toContain("Batch 3 evidence");
    expect(fs.existsSync(next.runDir)).toBe(false);
  });

  it("refreshes only empty prepared text while keeping frozen images byte-identical", () => {
    const workspaceRoot = workspace();
    const baseline = path.join(workspaceRoot, "public/ambient/art/tree-pine-1.png");
    fs.writeFileSync(baseline, "approved-image-bytes");
    const prepared = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "준비" });
    const frozen = path.join(prepared.runDir, paths.inputPath("inputs/baseline/tree-pine-1.png"));
    const before = fs.readFileSync(frozen);
    const updated = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "준비", refreshPrepared: true });
    expect(updated.request.priorRejections).toEqual([]);
    expect(fs.readFileSync(frozen)).toEqual(before);
    fs.writeFileSync(baseline, "changed-live-source");
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "준비", refreshPrepared: true })).toThrow(/cannot replace frozen images/);
    fs.writeFileSync(baseline, before);
    fs.writeFileSync(path.join(prepared.runDir, `${paths.ART_DIR.raw}/tree-pine-2.png`), "delivered-image");
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "준비", refreshPrepared: true })).toThrow(/empty, unreviewed/);
  });

  it("reads migrated legacy frozen paths without rewriting request, review or reference bytes", async () => {
    const workspaceRoot = workspace();
    for (const file of ["tree-pine-1.png", "tree-pine-autumn-1.png", "tree-pine-winter-1.png"]) {
      fs.writeFileSync(path.join(workspaceRoot, "public/ambient/art", file), await fixture(64));
    }
    const sheet = path.join(workspaceRoot, "docs/ambient/reference/tree-pine.png");
    fs.mkdirSync(path.dirname(sheet), { recursive: true });
    fs.writeFileSync(sheet, await fixture(64));
    const prepared = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "20260909-파일럿-01", dry: true });
    const oldRun = "art-src/tree/tree-pine/runs/20260909-pilot-01";
    const oldPrompt = `Frozen legacy instructions: ${oldRun}/raw; ${oldRun}/inputs/baseline/tree-pine-1.png\n`;
    const payload = { ...prepared.request };
    delete payload.requestSha256;
    payload.runId = "20260909-pilot-01";
    payload.promptSha256 = pipeline.sha256(oldPrompt);
    payload.inputs = payload.inputs.map((input: { path: string }) => ({ ...input, path: input.path.replace(/^고정입력\/합격참고\//, "inputs/baseline/").replace(/^고정입력\/레퍼런스\//, "inputs/reference/") }));
    const request = { ...payload, requestSha256: pipeline.sha256(`${JSON.stringify(payload, null, 2)}\n`) };
    const frozen = new Map<string, Buffer>([
      ["request.md", Buffer.from(oldPrompt)],
      ["request.json", Buffer.from(`${JSON.stringify(request, null, 2)}\n`)],
      ["review.json", Buffer.from(`${JSON.stringify({ schemaVersion: 1, decision: "pending", requestSha256: request.requestSha256, issues: [] }, null, 2)}\n`)],
      ["raw/.gitkeep", Buffer.alloc(0)], ["normalized/.gitkeep", Buffer.alloc(0)]
    ]);
    for (const input of request.inputs) frozen.set(input.path, fs.readFileSync(path.join(workspaceRoot, input.source)));
    // Reproduce the filesystem-only migration in an isolated fixture; never edit signed bytes.
    for (const [name, bytes] of frozen) {
      const source = path.resolve(workspaceRoot, oldRun, name);
      const target = path.resolve(workspaceRoot, paths.relocateArtPath(`${oldRun}/${name}`));
      for (const file of [source, target]) expect(path.relative(workspaceRoot, file)).not.toMatch(/^\.\./);
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.writeFileSync(source, bytes, { flag: "wx" });
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      fs.unlinkSync(source);
    }
    const runDir = path.join(workspaceRoot, paths.relocateArtPath(oldRun));
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "20260909-파일럿-01", refreshPrepared: true })).toThrow(/legacy request stays frozen/);
    for (const file of request.files) fs.writeFileSync(path.join(runDir, paths.ART_DIR.raw, file), await fixture());
    await pipeline.normalizeRun({ workspaceRoot, runDir: oldRun });
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir: oldRun })).toThrow(/Unapproved/);
    for (const [name, bytes] of frozen) {
      expect(fs.readFileSync(path.join(workspaceRoot, paths.relocateArtPath(`${oldRun}/${name}`)))).toEqual(bytes);
    }
    expect(fs.existsSync(path.join(runDir, paths.ART_DIR.normalized, "tree-pine-2.png"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "inputs"))).toBe(false);
    fs.appendFileSync(path.join(runDir, paths.inputPath("inputs/baseline/tree-pine-1.png")), "tampered");
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir })).toThrow(/Input snapshot changed: inputs\/baseline\/tree-pine-1.png/);
  });

  it("measures singleton candidate against same-name baseline without hiding failure", async () => {
    const workspaceRoot = workspace();
    const candidateDir = path.join(workspaceRoot, "candidate"), baselineDir = path.join(workspaceRoot, "baseline");
    fs.mkdirSync(candidateDir); fs.mkdirSync(baselineDir);
    fs.writeFileSync(path.join(candidateDir, "acorn.png"), await fixture(64, true));
    fs.writeFileSync(path.join(baselineDir, "acorn.png"), await fixture(64));
    const report = await checker.checkArt({ family: "acorn", dir: candidateDir, baselineDir });
    expect(report.status).toBe("fail");
    expect(report.checks).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "texture.baseline", asset: "acorn.png", status: "fail" }), expect.objectContaining({ ruleId: "pine.trunk", status: "not-applicable" })]));
    const cli = spawnSync(process.execPath, ["scripts/ambient-art-check.mjs", "acorn", "--dir", candidateDir, "--baseline", baselineDir, "--json"], { encoding: "utf8" });
    expect(cli.status).toBe(1);
    expect(JSON.parse(cli.stdout).status).toBe("fail");
  });

  it("detects missing seasonal companions without inferring seasons from availability", async () => {
    const dir = workspace();
    fs.writeFileSync(path.join(dir, "tree-pine-2.png"), await fixture(64));
    const report = await checker.checkArt({ family: "tree-pine", dir });
    expect(report.checks).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "seasons.complete", status: "fail" })]));
  });

  it("keeps raw immutable and requires owner approval of exact artifacts before publishing", async () => {
    const workspaceRoot = workspace();
    const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "acorn", runId: "파일럿", variants: [1] });
    expect(request.mode).toBe("style-pilot");
    const raw = await fixture();
    fs.writeFileSync(path.join(runDir, `${paths.ART_DIR.raw}/acorn.png`), raw);
    const report = await pipeline.normalizeRun({ workspaceRoot, runDir });
    expect(report.status).toBe("unmeasured");
    expect(fs.readFileSync(path.join(runDir, `${paths.ART_DIR.raw}/acorn.png`))).toEqual(raw);
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir })).toThrow(/Unapproved/);
    pipeline.reviewRun({ workspaceRoot, runDir, decision: "approved", reviewer: "owner", note: "Owner approved this test fixture after viewing review.png." });
    expect(pipeline.promoteRun({ workspaceRoot, runDir }).applied).toBe(false);
    expect(fs.existsSync(path.join(workspaceRoot, "public/ambient/art/acorn.png"))).toBe(false);
    const normalized = fs.readFileSync(path.join(runDir, `${paths.ART_DIR.normalized}/acorn.png`));
    fs.appendFileSync(path.join(runDir, `${paths.ART_DIR.normalized}/acorn.png`), "changed");
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/Artwork changed/);
    fs.writeFileSync(path.join(runDir, `${paths.ART_DIR.normalized}/acorn.png`), normalized);
    expect(pipeline.promoteRun({ workspaceRoot, runDir, apply: true }).applied).toBe(true);
    expect(fs.readFileSync(path.join(workspaceRoot, "public/ambient/art/acorn.png"))).toEqual(normalized);
    expect(fs.readFileSync(path.join(workspaceRoot, path.posix.join(entityDirectory("acorn"), "생성본/1/가을/acorn.png")))).toEqual(raw);
    expect(fs.readFileSync(path.join(runDir, `${paths.ART_DIR.raw}/acorn.png`))).toEqual(raw);
    const receipt = JSON.parse(fs.readFileSync(path.join(runDir, "published.json"), "utf8"));
    expect(receipt).toMatchObject({ schemaVersion: 2, status: "completed", requestSha256: request.requestSha256,
      artifactsSha256: pipeline.sha256(fs.readFileSync(path.join(runDir, "artifacts.json"))),
      reviewSha256: pipeline.sha256(fs.readFileSync(path.join(runDir, "review.json"))),
      files: [{ file: "acorn.png", raw: { target: path.posix.join(entityDirectory("acorn"), "생성본/1/가을/acorn.png"), sha256: pipeline.sha256(raw) },
        normalized: { target: "public/ambient/art/acorn.png", sha256: pipeline.sha256(normalized) } }]
    });
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/Accepted asset protected/);
  });

  it("archives a numbered multi-season raw file once under its common canonical path", async () => {
    const workspaceRoot = workspace();
    const { runDir, raw, archive, publicFile } = await approvedTwig(workspaceRoot);
    const plan = pipeline.promoteRun({ workspaceRoot, runDir });
    expect(plan.copies.map((copy: { target: string }) => copy.target)).toEqual(["public/ambient/art/twig-2.png", path.posix.join(entityDirectory("twig"), "생성본/2/공통/twig-2.png")]);
    if (process.platform === "win32") expect(pipeline.promoteRun({ workspaceRoot, runDir: runDir.replace(workspaceRoot, workspaceRoot.toUpperCase()) }).copies).toEqual(plan.copies);
    expect(fs.existsSync(path.join(workspaceRoot, path.posix.join(entityDirectory("twig"), "생성본")))).toBe(false);
    pipeline.promoteRun({ workspaceRoot, runDir, apply: true });
    expect(fs.readFileSync(archive)).toEqual(raw);
    expect(fs.readFileSync(path.join(runDir, `${paths.ART_DIR.raw}/twig-2.png`))).toEqual(raw);
    expect(fs.readFileSync(publicFile)).toEqual(fs.readFileSync(path.join(runDir, `${paths.ART_DIR.normalized}/twig-2.png`)));
  });

  it.each(["archive-file", "archive-parent-file", "archive-linked-parent", "receipt-file", "receipt-directory", "receipt-dangling-link"])("preflights every destination before any copy: %s", async (collision) => {
    const workspaceRoot = workspace();
    const { runDir, archive, publicFile } = await approvedTwig(workspaceRoot);
    const publication = path.join(runDir, "published.json");
    if (collision === "archive-file") {
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      fs.writeFileSync(archive, "legacy raw, protected");
    } else if (collision === "archive-parent-file") {
      fs.writeFileSync(path.join(workspaceRoot, path.posix.join(entityDirectory("twig"), "생성본")), "user file");
    } else if (collision === "archive-linked-parent") {
      fs.symlinkSync(path.join(workspaceRoot, "public/ambient/art"), path.join(workspaceRoot, path.posix.join(entityDirectory("twig"), "생성본")), "junction");
    } else if (collision === "receipt-file") fs.writeFileSync(publication, "existing receipt");
    else if (collision === "receipt-directory") fs.mkdirSync(publication);
    else fs.symlinkSync(path.join(workspaceRoot, "missing-receipt-directory"), publication, "junction");
    const copy = vi.spyOn(fs, "copyFileSync");
    const mkdir = vi.spyOn(fs, "mkdirSync");
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/protected|Non-directory parent|Linked paths/);
    expect(copy).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(fs.existsSync(publicFile)).toBe(false);
    if (collision === "archive-file") expect(fs.readFileSync(archive, "utf8")).toBe("legacy raw, protected");
    if (collision === "receipt-file") expect(fs.readFileSync(publication, "utf8")).toBe("existing receipt");
  });

  it("rejects changed prompt snapshots and failed candidate approvals", async () => {
    const workspaceRoot = workspace();
    const changed = pipeline.createRequest({ workspaceRoot, family: "acorn", runId: "변경", variants: [1] });
    fs.appendFileSync(path.join(changed.runDir, "request.md"), "Changed requested files");
    await expect(pipeline.normalizeRun({ workspaceRoot, runDir: changed.runDir })).rejects.toThrow(/prompt changed/);
    const failed = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "실패", variants: [2] });
    for (const file of failed.request.files) fs.writeFileSync(path.join(failed.runDir, paths.ART_DIR.raw, file), await fixture());
    expect((await pipeline.normalizeRun({ workspaceRoot, runDir: failed.runDir })).status).toBe("fail");
    expect(() => pipeline.reviewRun({ workspaceRoot, runDir: failed.runDir, decision: "approved", reviewer: "owner", note: "test" })).toThrow(/Failed measurements/);
    pipeline.reviewRun({ workspaceRoot, runDir: failed.runDir, decision: "rejected", reviewer: "owner", note: "Winter image has no snow", ruleId: "pine.snow.coverage" });
    expect(JSON.parse(fs.readFileSync(path.join(failed.runDir, "review.json"), "utf8")).issues[0].ruleId).toBe("pine.snow.coverage");
    const next = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "다음", variants: [2], dry: true });
    expect(next.prompt).toContain("Winter image has no snow");
    expect(next.request.priorRejections).toHaveLength(1);
  });

  it("rolls back only its new files after a failed multi-file copy", async () => {
    const workspaceRoot = workspace();
    const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "twig", runId: "복구", variants: [1, 2] });
    for (const file of request.files) fs.writeFileSync(path.join(runDir, paths.ART_DIR.raw, file), await fixture(1024, false, true));
    await pipeline.normalizeRun({ workspaceRoot, runDir });
    pipeline.reviewRun({ workspaceRoot, runDir, decision: "approved", reviewer: "owner", note: "Owner approved both test assets." });
    const publicDir = path.join(workspaceRoot, "public/ambient/art");
    fs.writeFileSync(path.join(publicDir, "keep.png"), "existing");
    const original = fs.copyFileSync.bind(fs);
    let copies = 0;
    vi.spyOn(fs, "copyFileSync").mockImplementation((source, destination, flags) => {
      copies++;
      if (copies === 2) throw new Error("simulated disk failure");
      return original(source, destination, flags);
    });
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/simulated disk failure/);
    expect(fs.readdirSync(publicDir)).toEqual(["keep.png"]);
    expect(fs.readFileSync(path.join(publicDir, "keep.png"), "utf8")).toBe("existing");
    expect(fs.existsSync(path.join(workspaceRoot, path.posix.join(entityDirectory("twig"), "생성본/1/공통/twig-1.png")))).toBe(false);
    expect(fs.existsSync(path.join(runDir, "published.json"))).toBe(false);
    expect(fs.existsSync(path.join(runDir, "publish-recovery.json"))).toBe(false);
  });

  it.each(["copy", "receipt"])("preserves uncertain partial %s bytes and records recovery after rolling back owned copies", async (stage) => {
    const workspaceRoot = workspace();
    const { runDir, raw, archive, publicFile } = await approvedTwig(workspaceRoot);
    const protectedFiles = ["request.md", "request.json", "artifacts.json", "review.json", `${paths.ART_DIR.raw}/twig-2.png`, `${paths.ART_DIR.normalized}/twig-2.png`];
    const before = new Map(protectedFiles.map((file) => [file, fs.readFileSync(path.join(runDir, file))]));
    const publication = path.join(runDir, "published.json"), partialTarget = stage === "copy" ? archive : publication;
    const write = fs.writeFileSync.bind(fs), copy = fs.copyFileSync.bind(fs);
    if (stage === "copy") vi.spyOn(fs, "copyFileSync").mockImplementation((source, destination, flags) => {
      if (String(destination) === archive) { write(destination, "partial output", { flag: "wx" }); throw new Error("partial copy failure"); }
      return copy(source, destination, flags);
    });
    else vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, options) => {
      if (String(file) === publication) { write(file, "partial output", { flag: "wx" }); throw new Error("partial receipt failure"); }
      return write(file, data, options);
    });
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/partial .* failure; recovery-required/);
    expect(fs.existsSync(publicFile)).toBe(false);
    expect(fs.readFileSync(partialTarget, "utf8")).toBe("partial output");
    if (stage === "receipt") expect(fs.existsSync(archive)).toBe(false);
    for (const [file, bytes] of before) expect(fs.readFileSync(path.join(runDir, file))).toEqual(bytes);
    expect(fs.readFileSync(path.join(runDir, `${paths.ART_DIR.raw}/twig-2.png`))).toEqual(raw);
    const recovery = JSON.parse(fs.readFileSync(path.join(runDir, "publish-recovery.json"), "utf8"));
    expect(recovery.status).toBe("recovery-required");
    expect(recovery.recovery).toEqual([expect.objectContaining({ target: path.relative(workspaceRoot, partialTarget).replaceAll("\\", "/") })]);
    vi.restoreAllMocks();
    const retryCopy = vi.spyOn(fs, "copyFileSync");
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/protected/);
    expect(retryCopy).not.toHaveBeenCalled();
    expect(fs.readFileSync(partialTarget, "utf8")).toBe("partial output");
  });

  it("rejects a run moved beneath a different entity before writing", async () => {
    const workspaceRoot = workspace();
    const { runDir } = await approvedTwig(workspaceRoot);
    const moved = path.join(workspaceRoot, path.posix.join(entityDirectory("acorn"), "작업회차/반영"));
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    fs.renameSync(runDir, moved);
    const copy = vi.spyOn(fs, "copyFileSync");
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir: moved, apply: true })).toThrow(/canonical entity/);
    expect(copy).not.toHaveBeenCalled();
  });

  it("retains the full recovery record on the exception when recovery metadata cannot be written", async () => {
    const workspaceRoot = workspace();
    const { runDir, archive, publicFile } = await approvedTwig(workspaceRoot);
    const publication = path.join(runDir, "published.json"), recoveryFile = path.join(runDir, "publish-recovery.json");
    const write = fs.writeFileSync.bind(fs);
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, options) => {
      if (String(file) === publication) { write(file, "partial receipt", { flag: "wx" }); throw new Error("receipt disk failure"); }
      if (String(file) === recoveryFile) throw new Error("recovery disk failure");
      return write(file, data, options);
    });
    const failure = (() => {
      try { pipeline.promoteRun({ workspaceRoot, runDir, apply: true }); }
      catch (error) { return error as Error & { recovery: { status: string; recovery: { target: string }[] } }; }
    })();
    expect(failure?.message).toContain("recovery record could not be fully written: recovery disk failure");
    expect(failure?.recovery).toMatchObject({ status: "recovery-required", recovery: [{ target: path.relative(workspaceRoot, publication).replaceAll("\\", "/") }] });
    expect(fs.existsSync(recoveryFile)).toBe(false);
    expect(fs.existsSync(archive)).toBe(false);
    expect(fs.existsSync(publicFile)).toBe(false);
    expect(fs.readFileSync(publication, "utf8")).toBe("partial receipt");
  });

  it("detects source mutation during copying and preserves changed bytes for recovery", async () => {
    const workspaceRoot = workspace();
    const { runDir, archive, publicFile } = await approvedTwig(workspaceRoot);
    const copy = fs.copyFileSync.bind(fs);
    vi.spyOn(fs, "copyFileSync").mockImplementation((source, destination, flags) => {
      if (String(destination) === archive) fs.appendFileSync(source, "external change");
      return copy(source, destination, flags);
    });
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/Copy verification failed.*recovery-required/);
    expect(fs.existsSync(publicFile)).toBe(false);
    expect(fs.readFileSync(archive)).toEqual(fs.readFileSync(path.join(runDir, `${paths.ART_DIR.raw}/twig-2.png`)));
    const recovery = JSON.parse(fs.readFileSync(path.join(runDir, "publish-recovery.json"), "utf8"));
    expect(recovery.recovery[0].reason).toContain("Target changed");
    expect(fs.existsSync(path.join(runDir, "published.json"))).toBe(false);
  });

  it("blocks an internally intact request whose source contract is stale", async () => {
    const workspaceRoot = workspace();
    const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "acorn", runId: "낡은계약", variants: [1] });
    const payload = { ...request };
    delete payload.requestSha256;
    payload.sources[0].sha256 = "0".repeat(64);
    const updated = { ...payload, requestSha256: pipeline.sha256(`${JSON.stringify(payload, null, 2)}\n`) };
    fs.writeFileSync(path.join(runDir, "request.json"), `${JSON.stringify(updated, null, 2)}\n`);
    await expect(pipeline.normalizeRun({ workspaceRoot, runDir })).rejects.toThrow(/Source contract changed/);
  });
});
