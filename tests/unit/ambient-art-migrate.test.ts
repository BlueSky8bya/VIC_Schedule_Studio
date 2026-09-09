import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

const migration = await import(path.resolve("scripts/ambient-art-migrate.mjs").replaceAll("\\", "/"));
const temporary: string[] = [];
const hash = (bytes: Buffer | string) => crypto.createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
function put(directory: string, relative: string, value: Buffer | string) {
  const file = path.join(directory, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
  return file;
}
async function fixture() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vic-art-migrate-test-"));
  temporary.push(workspaceRoot);
  const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#71826d" } }).png().toBuffer();
  put(workspaceRoot, "art-src/acorn.png", png);
  put(workspaceRoot, "art-src/pebble-1.png", png);
  put(workspaceRoot, "art-src/incoming-pine/tree-pine-winter-1.png", png);
  const protectedPaths = [
    "public/ambient/art/tree-pine-1.png",
    "art-src/tree/tree-pine/runs/pilot/inputs/baseline/tree-pine-1.png",
    "art-src/tree/tree-pine/runs/pilot/request.md",
    "docs/ambient/reference/tree-pine.png"
  ];
  for (const file of protectedPaths) put(workspaceRoot, file, file.endsWith(".png") ? png : "frozen request");
  return { workspaceRoot, png, protectedPaths };
}
function sourceBytes(workspaceRoot: string, receipt: { plan: { moves: { source: string }[] } }) {
  return receipt.plan.moves.map((item) => fs.readFileSync(path.join(workspaceRoot, item.source)));
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^vic-art-migrate-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

describe("recorded art migration", () => {
  it("preserves canonical names and bytes, protects public/run snapshots and repeats completed calls without writes", async () => {
    const { workspaceRoot, png, protectedPaths } = await fixture();
    const image = "art-src/reference/prop/nut.png", sidecar = `${image}.json`;
    const provenance = json({ source: "example", category: "prop", image: "nut.png" });
    put(workspaceRoot, image, png);
    put(workspaceRoot, sidecar, provenance);
    const receipt = await migration.planMigration({ workspaceRoot, references: { visualMethod: "inspected", moves: [{ selected: "candidate", entity: "acorn", category: "prop", sourceImage: image, sourceSidecar: sidecar, imageSha256: hash(png), sidecarSha256: hash(provenance), reason: "shape", confidence: "high" }] } });
    const before = sourceBytes(workspaceRoot, receipt);
    const protectedBefore = protectedPaths.map((file) => fs.readFileSync(path.join(workspaceRoot, file)));
    const save = vi.fn();
    expect(migration.applyMigration({ workspaceRoot, receipt, save })).toMatchObject({ status: "verified", moved: 5 });
    expect(receipt.status).toBe("completed");
    for (const [index, item] of receipt.plan.moves.entries()) {
      expect(path.basename(item.target)).toBe(path.basename(item.source));
      expect(fs.existsSync(path.join(workspaceRoot, item.source))).toBe(false);
      expect(fs.readFileSync(path.join(workspaceRoot, item.target))).toEqual(before[index]);
    }
    expect(protectedPaths.map((file) => fs.readFileSync(path.join(workspaceRoot, file)))).toEqual(protectedBefore);
    const copy = vi.spyOn(fs, "copyFileSync"), unlink = vi.spyOn(fs, "unlinkSync");
    save.mockClear();
    expect(migration.applyMigration({ workspaceRoot, receipt, save }).status).toBe("verified");
    expect(copy).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    for (const file of protectedPaths.slice(0, 3)) {
      const target = path.join(workspaceRoot, file), original = fs.readFileSync(target);
      fs.writeFileSync(target, "changed protected bytes");
      expect(() => migration.checkMigration({ workspaceRoot, receipt })).toThrow(/Protected file changed/);
      fs.writeFileSync(target, original);
    }
  });

  it("preflights every target and source hash before moving the first file", async () => {
    const { workspaceRoot } = await fixture();
    const receipt = await migration.planMigration({ workspaceRoot });
    const before = sourceBytes(workspaceRoot, receipt), last = receipt.plan.moves.at(-1);
    const collision = put(workspaceRoot, last.target, "pre-existing target");
    const copy = vi.spyOn(fs, "copyFileSync"), unlink = vi.spyOn(fs, "unlinkSync"), save = vi.fn();
    expect(() => migration.applyMigration({ workspaceRoot, receipt, save })).toThrow(/Target exists/);
    expect(sourceBytes(workspaceRoot, receipt)).toEqual(before);
    expect(copy).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    fs.unlinkSync(collision);
    unlink.mockClear();
    fs.writeFileSync(path.join(workspaceRoot, last.source), "changed after planning");
    expect(() => migration.applyMigration({ workspaceRoot, receipt, save })).toThrow(/Source changed/);
    expect(copy).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
    expect(receipt.status).toBe("planned");
  });

  it("rejects traversing, run-protected and linked destinations even in a rehashed receipt", async () => {
    const { workspaceRoot } = await fixture();
    const receipt = await migration.planMigration({ workspaceRoot });
    const original = sourceBytes(workspaceRoot, receipt);
    for (const destination of ["art-src/../../outside.png", "public/ambient/art/acorn.png", "art-src/tree/tree-pine/runs/pilot/acorn.png"]) {
      const changed = structuredClone(receipt);
      changed.plan.moves[0].target = destination;
      changed.planSha256 = hash(json(changed.plan));
      expect(() => migration.applyMigration({ workspaceRoot, receipt: changed })).toThrow(/outside intended archive|Protected migration path/);
    }
    const redirected = path.join(workspaceRoot, "redirected");
    fs.mkdirSync(redirected);
    const entityParent = path.join(workspaceRoot, "art-src/prop");
    fs.mkdirSync(entityParent, { recursive: true });
    fs.symlinkSync(redirected, path.join(entityParent, "acorn"), "junction");
    expect(() => migration.applyMigration({ workspaceRoot, receipt })).toThrow(/Linked path forbidden/);
    expect(sourceBytes(workspaceRoot, receipt)).toEqual(original);
    expect(fs.readdirSync(redirected)).toEqual([]);
  });

  it("rolls back earlier successful copies when a later copy fails and can retry safely", async () => {
    const { workspaceRoot, protectedPaths } = await fixture();
    const receipt = await migration.planMigration({ workspaceRoot });
    const before = sourceBytes(workspaceRoot, receipt), protectedBefore = protectedPaths.map((file) => fs.readFileSync(path.join(workspaceRoot, file)));
    const realCopy = fs.copyFileSync;
    let copies = 0;
    const copy = vi.spyOn(fs, "copyFileSync").mockImplementation((...args) => {
      if (++copies === 2) throw new Error("injected copy failure");
      return realCopy(...args);
    });
    expect(() => migration.applyMigration({ workspaceRoot, receipt })).toThrow(/injected copy failure/);
    expect(receipt.status).toBe("rolled-back");
    expect(sourceBytes(workspaceRoot, receipt)).toEqual(before);
    expect(receipt.plan.moves.every((item: { target: string }) => !fs.existsSync(path.join(workspaceRoot, item.target)))).toBe(true);
    expect(protectedPaths.map((file) => fs.readFileSync(path.join(workspaceRoot, file)))).toEqual(protectedBefore);
    copy.mockRestore();
    expect(migration.applyMigration({ workspaceRoot, receipt }).status).toBe("verified");
  });

  it("preserves a partial failed-copy target and records recovery-required instead of claiming rollback", async () => {
    const { workspaceRoot } = await fixture();
    const receipt = await migration.planMigration({ workspaceRoot });
    const before = sourceBytes(workspaceRoot, receipt), realCopy = fs.copyFileSync;
    let copies = 0;
    vi.spyOn(fs, "copyFileSync").mockImplementation((...args) => {
      if (++copies === 2) {
        fs.writeFileSync(args[1], "partial or concurrent bytes", { flag: "wx" });
        throw new Error("injected partial copy failure");
      }
      return realCopy(...args);
    });
    expect(() => migration.applyMigration({ workspaceRoot, receipt })).toThrow(/injected partial copy failure/);
    expect(receipt.status).toBe("recovery-required");
    expect(sourceBytes(workspaceRoot, receipt)).toEqual(before);
    expect(receipt.recovery).toEqual([expect.objectContaining({ target: receipt.plan.moves[1].target, error: expect.stringContaining("ownership uncertain") })]);
    expect(fs.readFileSync(path.join(workspaceRoot, receipt.plan.moves[1].target), "utf8")).toBe("partial or concurrent bytes");
    expect(fs.existsSync(path.join(workspaceRoot, receipt.plan.moves[0].target))).toBe(false);
    expect(() => migration.applyMigration({ workspaceRoot, receipt })).toThrow(/requires receipt-based recovery/);
  });
});
