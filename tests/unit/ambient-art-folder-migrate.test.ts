import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const { planFolderMigration, applyFolderMigration, checkFolderMigration } = await import(path.resolve("scripts/ambient-art-folder-migrate.mjs").replaceAll("\\", "/"));
const { relocateArtPath, entityPath, inputPath } = await import(path.resolve("scripts/lib/ambient-art-paths.mjs").replaceAll("\\", "/"));
const { buildEntities } = await import(path.resolve("scripts/lib/ambient-art-entities.mjs").replaceAll("\\", "/"));
const { artManifest } = await import(path.resolve("scripts/lib/ambient-art-manifest.mjs").replaceAll("\\", "/"));
const temporary: string[] = [];
const frozen = "art-src/tree/tree-pine/runs/20260909-pilot-01/request.json";
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function write(workspaceRoot: string, relative: string, bytes: string | Buffer) {
  const file = path.join(workspaceRoot, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
}
function fixture() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vic-art-folder-test-"));
  temporary.push(workspaceRoot);
  write(workspaceRoot, frozen, '{"runId":"20260909-pilot-01","inputs":[{"path":"inputs/baseline/tree-pine-1.png"}]}');
  write(workspaceRoot, "art-src/tree/tree-pine/runs/20260909-pilot-01/inputs/baseline/tree-pine-1.png", Buffer.from([0, 1, 2, 255]));
  write(workspaceRoot, "art-src/tree/tree-pine/runs/20260909-pilot-01/raw/.gitkeep", "");
  write(workspaceRoot, "art-src/tree/tree-pine/반려본/incoming-pine/review.json", '{"decision":"rejected"}');
  write(workspaceRoot, "art-src/migrations/legacy.json", '{"source":"art-src/tree/tree-pine"}');
  write(workspaceRoot, "art-src/reference/tree/candidate.png.json", '{"category":"tree"}');
  write(workspaceRoot, "art-src/README.md", "old routing");
  return workspaceRoot;
}

function correctedRoutingFixture() {
  const workspaceRoot = fixture();
  const source = "art-src/tree/tree-pine/반려본/incoming-pine/README.md";
  const original = "# Historical batch\n\n[Migration](../../../../migrations/legacy.json)\n";
  write(workspaceRoot, source, original);
  const receipt = planFolderMigration({ workspaceRoot });
  applyFolderMigration({ workspaceRoot, receipt });
  const originalPlan = JSON.stringify(receipt.plan), originalPlanSha256 = receipt.planSha256;
  const file = relocateArtPath(source), preservedOriginal = path.posix.join(path.posix.dirname(file), "원문-README.md");
  fs.copyFileSync(path.join(workspaceRoot, file), path.join(workspaceRoot, preservedOriginal), fs.constants.COPYFILE_EXCL);
  const updated = "# Batch navigation\n\n[Migration](../../../../이관기록/legacy.json) · [Original](원문-README.md)\n";
  write(workspaceRoot, file, updated);
  const update = { file, preservedOriginal, originalSha256: digest(original), updatedSha256: digest(updated), reason: "Keep historical bytes while correcting the live migration link." };
  receipt.documentationUpdates = [update];
  return { workspaceRoot, receipt, update, original, originalPlan, originalPlanSha256 };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^vic-art-folder-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("Korean art folders", () => {
  it("keeps 193 identities distinct, merges starfish under animals and resolves historical inputs", () => {
    const paths = buildEntities(artManifest()).map(entityPath);
    expect(paths).toHaveLength(193);
    expect(new Set(paths).size).toBe(193);
    expect(paths).not.toContain("art-src/지형/불가사리");
    expect(paths).toContain("art-src/동물/불가사리");
    expect(inputPath("inputs/baseline/tree-pine-1.png")).toBe("고정입력/합격참고/tree-pine-1.png");
    expect(inputPath("고정입력/합격참고/tree-pine-1.png")).toBe("고정입력/합격참고/tree-pine-1.png");
    const target = relocateArtPath(frozen);
    expect(target).toBe("art-src/나무/소나무/작업회차/20260909-파일럿-01/request.json");
    expect(relocateArtPath(target)).toBe(target);
    expect(relocateArtPath("public/ambient/art/tree-pine-1.png")).toBe("public/ambient/art/tree-pine-1.png");
  });

  it("moves nested folders with all original bytes intact and permits only later routing-doc refresh", () => {
    const workspaceRoot = fixture();
    const receipt = planFolderMigration({ workspaceRoot });
    const bytes = fs.readFileSync(path.join(workspaceRoot, frozen));
    expect(applyFolderMigration({ workspaceRoot, receipt })).toMatchObject({ status: "verified", files: 7, englishFolders: 0 });
    expect(receipt.completedOperations).toHaveLength(receipt.plan.operations.length);
    expect(fs.readFileSync(path.join(workspaceRoot, relocateArtPath(frozen)))).toEqual(bytes);
    write(workspaceRoot, "art-src/README.md", "new routing");
    expect(checkFolderMigration({ workspaceRoot, receipt }).status).toBe("verified");
    expect(() => checkFolderMigration({ workspaceRoot, receipt, allowDocumentationChanges: false })).toThrow(/Migrated bytes changed/);
    write(workspaceRoot, relocateArtPath(frozen), "changed evidence");
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Migrated bytes changed/);
  });

  it("preflights destination collisions across the whole plan before any move", () => {
    const workspaceRoot = fixture();
    const receipt = planFolderMigration({ workspaceRoot });
    write(workspaceRoot, "art-src/나무/owner.txt", "owner work");
    expect(() => applyFolderMigration({ workspaceRoot, receipt })).toThrow(/Destination exists/);
    expect(receipt.status).toBe("planned");
    expect(fs.existsSync(path.join(workspaceRoot, frozen))).toBe(true);
    expect(fs.readFileSync(path.join(workspaceRoot, "art-src/나무/owner.txt"), "utf8")).toBe("owner work");
  });

  it("rejects changed source bytes before beginning the planned migration", () => {
    const workspaceRoot = fixture();
    const receipt = planFolderMigration({ workspaceRoot });
    write(workspaceRoot, frozen, "new owner changes");
    expect(() => applyFolderMigration({ workspaceRoot, receipt })).toThrow(/Source changed/);
    expect(receipt.completedOperations).toEqual([]);
  });

  it("rejects unmapped English folders while the tree is still untouched", () => {
    const workspaceRoot = fixture();
    write(workspaceRoot, "art-src/tree/tree-pine/레퍼런스/extra/owner.png", "owner image");
    expect(() => planFolderMigration({ workspaceRoot })).toThrow(/Unmapped English folders/);
    expect(fs.existsSync(path.join(workspaceRoot, frozen))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, "art-src/나무"))).toBe(false);
  });

  it("does not move unrecorded owner additions made after planning", () => {
    const workspaceRoot = fixture();
    const receipt = planFolderMigration({ workspaceRoot });
    write(workspaceRoot, "art-src/tree/tree-pine/새 메모.md", "new owner work");
    expect(() => applyFolderMigration({ workspaceRoot, receipt })).toThrow(/Archive inventory changed/);
    expect(receipt.completedOperations).toEqual([]);
    expect(fs.existsSync(path.join(workspaceRoot, frozen))).toBe(true);
  });

  it("records exact completed renames on interruption and blocks blind retries", () => {
    const workspaceRoot = fixture();
    const receipt = planFolderMigration({ workspaceRoot });
    const rename = fs.renameSync;
    let calls = 0;
    vi.spyOn(fs, "renameSync").mockImplementation((source, target) => {
      if (++calls === 2) throw new Error("simulated interrupted rename");
      return rename(source, target);
    });
    const saved: string[] = [];
    expect(() => applyFolderMigration({ workspaceRoot, receipt, save: (value: unknown) => saved.push(JSON.stringify(value)) })).toThrow(/simulated interrupted/);
    expect(receipt.status).toBe("recovery-required");
    expect(receipt.completedOperations).toHaveLength(1);
    expect(JSON.parse(saved.at(-1)!).status).toBe("recovery-required");
    expect(() => applyFolderMigration({ workspaceRoot, receipt })).toThrow(/explicit receipt-based recovery/);
    expect(fs.existsSync(path.join(workspaceRoot, receipt.completedOperations[0].target))).toBe(true);
  });

  it("accepts an additive README correction only with the exact preserved original and updated hash", () => {
    const { workspaceRoot, receipt, update, original, originalPlan, originalPlanSha256 } = correctedRoutingFixture();
    expect(checkFolderMigration({ workspaceRoot, receipt }).status).toBe("verified");
    expect(JSON.stringify(receipt.plan)).toBe(originalPlan);
    expect(receipt.planSha256).toBe(originalPlanSha256);
    expect(fs.readFileSync(path.join(workspaceRoot, update.preservedOriginal), "utf8")).toBe(original);
    expect(() => checkFolderMigration({ workspaceRoot, receipt, allowDocumentationChanges: false })).toThrow(/Migrated bytes changed/);
    delete receipt.documentationUpdates;
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Migrated bytes changed/);
  });

  it.each(["preserved", "current"])("rejects later edits to the %s README", (which) => {
    const { workspaceRoot, receipt, update } = correctedRoutingFixture();
    write(workspaceRoot, which === "preserved" ? update.preservedOriginal : update.file, "unrecorded edits");
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(which === "preserved" ? /Preserved README changed/ : /Updated README changed/);
  });

  it("rejects a missing original and refuses a different original hash even if the backup matches it", () => {
    const { workspaceRoot, receipt, update } = correctedRoutingFixture();
    fs.unlinkSync(path.join(workspaceRoot, update.preservedOriginal));
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Preserved README changed or missing/);
    write(workspaceRoot, update.preservedOriginal, "replacement history");
    update.originalSha256 = digest("replacement history");
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/original hash differs from plan/);
    receipt.plan.files.find((file: { target: string }) => file.target === update.file).sha256 = update.originalSha256;
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Folder migration plan changed/);
  });

  it("rejects duplicate entries, non-sibling backups and missing reasons", () => {
    const { workspaceRoot, receipt, update } = correctedRoutingFixture();
    receipt.documentationUpdates.push({ ...update });
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Duplicate documentation update/);
    receipt.documentationUpdates.pop();
    const preserved = update.preservedOriginal;
    update.preservedOriginal = "art-src/원문-README.md";
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Invalid preserved README path/);
    update.preservedOriginal = preserved;
    update.reason = " ";
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Invalid documentation update metadata/);
  });

  it("accepts a generated-only entity consolidation with an exact external record", () => {
    const workspaceRoot = fixture();
    const source = "art-src/ground/starfish";
    for (const name of ["프롬프트.md", "검토/README.md", "레퍼런스/README.md", "반려본/README.md", "생성본/README.md"]) {
      write(workspaceRoot, `${source}/${name}`, "<!-- ambient-art-catalog:generated v1 -->\nowned\n");
    }
    write(workspaceRoot, "art-src/animal/animal-starfish/프롬프트.md", "target");
    const receipt = planFolderMigration({ workspaceRoot });
    applyFolderMigration({ workspaceRoot, receipt });
    const currentSource = relocateArtPath(source), target = relocateArtPath("art-src/animal/animal-starfish");
    const planned = receipt.plan.files.filter((file: { target: string }) => file.target.startsWith(`${currentSource}/`));
    for (const file of planned) fs.unlinkSync(path.join(workspaceRoot, file.target));
    for (const directory of receipt.plan.directories.filter((item: { target: string }) => item.target === currentSource || item.target.startsWith(`${currentSource}/`)).sort((a: { target: string }, b: { target: string }) => b.target.length - a.target.length)) fs.rmdirSync(path.join(workspaceRoot, directory.target));
    const record = { schemaVersion: 1, status: "completed", source: currentSource, target, files: planned.map((file: { target: string; sha256: string }) => ({ path: file.target, sha256: file.sha256 })) };
    const recordPath = "art-src/이관기록/starfish.json", recordText = `${JSON.stringify(record, null, 2)}\n`;
    write(workspaceRoot, recordPath, recordText);
    receipt.entityConsolidations = [{ source: currentSource, target, record: recordPath, recordSha256: digest(recordText) }];
    expect(checkFolderMigration({ workspaceRoot, receipt }).status).toBe("verified");
    receipt.entityConsolidations[0].target = "art-src/지형/바위";
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Invalid consolidation record/);
  });

  it.each([
    frozen,
    "art-src/tree/tree-pine/runs/20260909-pilot-01/inputs/baseline/tree-pine-1.png",
    "art-src/tree/tree-pine/반려본/incoming-pine/review.json",
    "art-src/reference/tree/candidate.png.json",
    "art-src/나무/소나무/미등록/README.md"
  ])("cannot exempt frozen evidence or unregistered targets: %s", (source) => {
    const { workspaceRoot, receipt, update } = correctedRoutingFixture();
    update.file = relocateArtPath(source);
    expect(() => checkFolderMigration({ workspaceRoot, receipt })).toThrow(/Unregistered README update/);
  });
});
