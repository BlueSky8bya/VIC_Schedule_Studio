import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const pipeline = await import(path.resolve("scripts/ambient-art-pipeline.mjs").replaceAll("\\", "/"));
const checker = await import(path.resolve("scripts/ambient-art-check.mjs").replaceAll("\\", "/"));
const sharp = createRequire(import.meta.url)("sharp");
const temporary: string[] = [];
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
    const result = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "pilot", dry: true });
    expect(result.request.files).toEqual(["tree-pine-2.png", "tree-pine-3.png", "tree-pine-autumn-2.png", "tree-pine-autumn-3.png", "tree-pine-winter-2.png", "tree-pine-winter-3.png"]);
    expect(result.prompt).toContain("파일 6장");
    expect(result.prompt).toContain("inputs/baseline/tree-pine-1.png");
    expect(result.prompt).not.toContain("docs/ambient/reference/");
    expect(result.prompt).not.toMatch(/public\/ambient\/art\/[a-z]/);
    expect(result.prompt).toContain("전체 변형 수·과거 반려 수량은 추가 납품 지시가 아니다");
    expect(fs.existsSync(result.runDir)).toBe(false);
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "overwrite", variants: [1] })).toThrow(/Accepted asset protected/);
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "partial", files: ["tree-pine-2.png"] })).toThrow(/Incomplete seasonal pack/);
  });

  it("routes seasonal slots to their entity and inherits all reasons from historical batches", () => {
    const workspaceRoot = workspace();
    const oak = pipeline.createRequest({ workspaceRoot, family: "tree-oak-spring", runId: "season", variants: [1], dry: true });
    expect(oak.runDir.replaceAll("\\", "/")).toContain("art-src/tree/tree-oak/runs/season");
    expect(oak.request.files).toEqual(["tree-oak-spring-1.png"]);
    const directory = path.join(workspaceRoot, "art-src/tree/tree-pine/반려본/old-batch");
    fs.mkdirSync(directory, { recursive: true });
    const issues = ["texture", "diversity", "snow", "trunk"].map((ruleId) => ({ ruleId, status: "open", observed: `Historical ${ruleId}` }));
    fs.writeFileSync(path.join(directory, "review.json"), JSON.stringify({ kind: "legacy-rejection", decision: "rejected", historicalDate: "2026-09-08", issues: [...issues, { ruleId: "closed", status: "resolved", observed: "Do not repeat" }] }));
    const next = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "next", dry: true });
    expect(next.request.priorRejections).toHaveLength(4);
    expect(next.request.priorRejections.every((issue: { evidenceKind: string }) => issue.evidenceKind === "imported-historical-rejection")).toBe(true);
    expect(next.prompt).toContain("Historical trunk");
    expect(next.prompt).not.toContain("Do not repeat");
    expect(fs.existsSync(next.runDir)).toBe(false);
  });

  it("does not let recent resolved batches hide older unresolved rejection reasons", () => {
    const workspaceRoot = workspace();
    for (let index = 0; index < 4; index += 1) {
      const folder = index === 0 ? "반려본" : "runs";
      const directory = path.join(workspaceRoot, "art-src/tree/tree-pine", folder, `batch-${index}`);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "review.json"), JSON.stringify({
        kind: index === 0 ? "legacy-rejection" : undefined, decision: "rejected",
        reviewedAt: `2026-09-0${index + 1}T00:00:00Z`,
        issues: [{ ruleId: `reason-${index}`, status: index === 0 ? "open" : "resolved", observed: `Batch ${index} evidence` }],
      }));
    }
    const next = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "next", dry: true });
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
    const prepared = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "prepared" });
    const frozen = path.join(prepared.runDir, "inputs/baseline/tree-pine-1.png");
    const before = fs.readFileSync(frozen);
    const updated = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "prepared", refreshPrepared: true });
    expect(updated.request.priorRejections).toEqual([]);
    expect(fs.readFileSync(frozen)).toEqual(before);
    fs.writeFileSync(baseline, "changed-live-source");
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "prepared", refreshPrepared: true })).toThrow(/cannot replace frozen images/);
    fs.writeFileSync(baseline, before);
    fs.writeFileSync(path.join(prepared.runDir, "raw/tree-pine-2.png"), "delivered-image");
    expect(() => pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "prepared", refreshPrepared: true })).toThrow(/empty, unreviewed/);
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
    const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "acorn", runId: "pilot", variants: [1] });
    expect(request.mode).toBe("style-pilot");
    const raw = await fixture();
    fs.writeFileSync(path.join(runDir, "raw/acorn.png"), raw);
    const report = await pipeline.normalizeRun({ workspaceRoot, runDir });
    expect(report.status).toBe("unmeasured");
    expect(fs.readFileSync(path.join(runDir, "raw/acorn.png"))).toEqual(raw);
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir })).toThrow(/Unapproved/);
    pipeline.reviewRun({ workspaceRoot, runDir, decision: "approved", reviewer: "owner", note: "Owner approved this test fixture after viewing review.png." });
    expect(pipeline.promoteRun({ workspaceRoot, runDir }).applied).toBe(false);
    expect(fs.existsSync(path.join(workspaceRoot, "public/ambient/art/acorn.png"))).toBe(false);
    const normalized = fs.readFileSync(path.join(runDir, "normalized/acorn.png"));
    fs.appendFileSync(path.join(runDir, "normalized/acorn.png"), "changed");
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/Artwork changed/);
    fs.writeFileSync(path.join(runDir, "normalized/acorn.png"), normalized);
    expect(pipeline.promoteRun({ workspaceRoot, runDir, apply: true }).applied).toBe(true);
    expect(fs.readFileSync(path.join(workspaceRoot, "public/ambient/art/acorn.png"))).toEqual(normalized);
    expect(() => pipeline.promoteRun({ workspaceRoot, runDir, apply: true })).toThrow(/Accepted asset protected/);
  });

  it("rejects changed prompt snapshots and failed candidate approvals", async () => {
    const workspaceRoot = workspace();
    const changed = pipeline.createRequest({ workspaceRoot, family: "acorn", runId: "changed", variants: [1] });
    fs.appendFileSync(path.join(changed.runDir, "request.md"), "Changed requested files");
    await expect(pipeline.normalizeRun({ workspaceRoot, runDir: changed.runDir })).rejects.toThrow(/prompt changed/);
    const failed = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "failed", variants: [2] });
    for (const file of failed.request.files) fs.writeFileSync(path.join(failed.runDir, "raw", file), await fixture());
    expect((await pipeline.normalizeRun({ workspaceRoot, runDir: failed.runDir })).status).toBe("fail");
    expect(() => pipeline.reviewRun({ workspaceRoot, runDir: failed.runDir, decision: "approved", reviewer: "owner", note: "test" })).toThrow(/Failed measurements/);
    pipeline.reviewRun({ workspaceRoot, runDir: failed.runDir, decision: "rejected", reviewer: "owner", note: "Winter image has no snow", ruleId: "pine.snow.coverage" });
    expect(JSON.parse(fs.readFileSync(path.join(failed.runDir, "review.json"), "utf8")).issues[0].ruleId).toBe("pine.snow.coverage");
    const next = pipeline.createRequest({ workspaceRoot, family: "tree-pine", runId: "next", variants: [2], dry: true });
    expect(next.prompt).toContain("Winter image has no snow");
    expect(next.request.priorRejections).toHaveLength(1);
  });

  it("rolls back only its new files after a failed multi-file copy", async () => {
    const workspaceRoot = workspace();
    const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "twig", runId: "rollback", variants: [1, 2] });
    for (const file of request.files) fs.writeFileSync(path.join(runDir, "raw", file), await fixture(1024, false, true));
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
  });

  it("blocks an internally intact request whose source contract is stale", async () => {
    const workspaceRoot = workspace();
    const { runDir, request } = pipeline.createRequest({ workspaceRoot, family: "acorn", runId: "stale", variants: [1] });
    const payload = { ...request };
    delete payload.requestSha256;
    payload.sources[0].sha256 = "0".repeat(64);
    const updated = { ...payload, requestSha256: pipeline.sha256(`${JSON.stringify(payload, null, 2)}\n`) };
    fs.writeFileSync(path.join(runDir, "request.json"), `${JSON.stringify(updated, null, 2)}\n`);
    await expect(pipeline.normalizeRun({ workspaceRoot, runDir })).rejects.toThrow(/Source contract changed/);
  });
});
