import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ART_SLOTS, slotFiles, type PresentArt } from "@/components/shared/ambient/art/manifest";
import metadata from "@/lib/ambient/art-files.generated.json";
import { readPresentArt } from "@/lib/ambient/art-files";

const { collectAmbientArtMetadata, generateAmbientArtMetadata } = await import(
  path.resolve("scripts/generate-ambient-art-metadata.mjs").replaceAll("\\", "/")
);
const temporary: string[] = [];
const junctions: string[] = [];
const outputPath = "lib/ambient/art-files.generated.json";
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vic-art-metadata-"));
  temporary.push(root);
  fs.mkdirSync(path.join(root, "public/ambient/art"), { recursive: true });
  return root;
}
function png(root: string, name: string, bytes = tinyPng) {
  fs.writeFileSync(path.join(root, "public/ambient/art", name), bytes);
}
afterEach(() => {
  for (const junction of junctions.splice(0)) fs.unlinkSync(junction);
  for (const root of temporary.splice(0)) {
    expect(path.dirname(fs.realpathSync(root))).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^vic-art-metadata-/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("build-time ambient art metadata", () => {
  it("preserves the independent filesystem listing, dimensions and exact slot order", () => {
    const directory = path.resolve("public/ambient/art");
    const files = fs.readdirSync(directory).filter(file => file.endsWith(".png")).sort().map(file => {
      const filename = path.join(directory, file);
      const fd = fs.openSync(filename, "r");
      const header = Buffer.alloc(24);
      try { fs.readSync(fd, header, 0, header.length, 0); }
      finally { fs.closeSync(fd); }
      return { file, bytes: fs.statSync(filename).size, w: header.readUInt32BE(16), h: header.readUInt32BE(20) };
    });
    expect(metadata.files).toEqual(files);
    const expected: PresentArt = {};
    for (const slot of ART_SLOTS) expected[slot.id] = slotFiles(slot).flatMap(name => files.filter(file => file.file === name));
    expect(readPresentArt()).toEqual({ present: expected, stamp: metadata.stamp });
    expect(Number.isSafeInteger(metadata.stamp)).toBe(true);
    expect(metadata.stamp).toBeGreaterThan(0);
    expect(generateAmbientArtMetadata({ check: true })).toMatchObject({ changed: false, files: files.length });
  });

  it("returns independent records without allowing one response to mutate the next", () => {
    const first = readPresentArt();
    const file = Object.values(first.present).flat()[0];
    expect(file).toBeDefined();
    file.bytes = -1;
    expect(Object.values(readPresentArt().present).flat().every(item => item.bytes > 0)).toBe(true);
  });

  it("serves the same inventory when runtime asset filesystem access is unavailable", () => {
    const expected = readPresentArt();
    const scan = vi.spyOn(fs, "readdirSync").mockImplementation(() => { throw new Error("Runtime files unavailable"); });
    try {
      expect(readPresentArt()).toEqual(expected);
      expect(scan).not.toHaveBeenCalled();
    } finally { scan.mockRestore(); }
  });

  it("is deterministic across checkout mtimes and catches same-size byte replacement without writing in check mode", () => {
    const root = workspace();
    png(root, "z.png"); png(root, "a.png");
    fs.writeFileSync(path.join(root, "public/ambient/art", "ignored.jpg"), "not a PNG");
    const first = collectAmbientArtMetadata(root);
    expect(first.files.map((file: { file: string }) => file.file)).toEqual(["a.png", "z.png"]);
    expect(generateAmbientArtMetadata({ workspaceRoot: root }).changed).toBe(true);
    const output = path.join(root, outputPath), original = fs.readFileSync(output);
    fs.utimesSync(path.join(root, "public/ambient/art/a.png"), new Date(0), new Date(0));
    expect(collectAmbientArtMetadata(root)).toEqual(first);
    expect(generateAmbientArtMetadata({ workspaceRoot: root, check: true }).changed).toBe(false);
    const changedBytes = Buffer.from(tinyPng);
    changedBytes[changedBytes.length - 1] ^= 1;
    png(root, "a.png", changedBytes);
    expect(collectAmbientArtMetadata(root).stamp).not.toBe(first.stamp);
    expect(() => generateAmbientArtMetadata({ workspaceRoot: root, check: true })).toThrow(/metadata drift/);
    expect(fs.readFileSync(output)).toEqual(original);
    expect(generateAmbientArtMetadata({ workspaceRoot: root }).changed).toBe(true);
    expect(generateAmbientArtMetadata({ workspaceRoot: root, check: true }).changed).toBe(false);
  });

  it("removes missing assets from the snapshot and represents an empty directory exactly", () => {
    const root = workspace();
    png(root, "a.png");
    generateAmbientArtMetadata({ workspaceRoot: root });
    fs.unlinkSync(path.join(root, "public/ambient/art/a.png"));
    expect(() => generateAmbientArtMetadata({ workspaceRoot: root, check: true })).toThrow(/metadata drift/);
    generateAmbientArtMetadata({ workspaceRoot: root });
    expect(JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8"))).toEqual({ schemaVersion: 1, stamp: 0, files: [] });
  });

  it("fails before replacing valid metadata when a PNG is invalid or its source directory is missing", () => {
    const root = workspace();
    png(root, "a.png");
    generateAmbientArtMetadata({ workspaceRoot: root });
    const output = path.join(root, outputPath), original = fs.readFileSync(output);
    png(root, "broken.png", Buffer.from("truncated"));
    expect(() => generateAmbientArtMetadata({ workspaceRoot: root })).toThrow(/Invalid ambient PNG header/);
    expect(fs.readFileSync(output)).toEqual(original);
    fs.unlinkSync(path.join(root, "public/ambient/art/broken.png"));
    const zeroWidth = Buffer.from(tinyPng); zeroWidth.writeUInt32BE(0, 16);
    png(root, "broken.png", zeroWidth);
    expect(() => generateAmbientArtMetadata({ workspaceRoot: root })).toThrow(/dimensions/);
    expect(fs.readFileSync(output)).toEqual(original);
    const absent = workspace();
    fs.rmdirSync(path.join(absent, "public/ambient/art"));
    expect(() => generateAmbientArtMetadata({ workspaceRoot: absent })).toThrow();
    expect(fs.existsSync(path.join(absent, outputPath))).toBe(false);
  });

  it("does not create output through a linked directory", () => {
    const root = workspace(), outside = workspace();
    const junction = path.join(root, "lib");
    fs.symlinkSync(outside, junction, process.platform === "win32" ? "junction" : "dir");
    junctions.push(junction);
    expect(() => generateAmbientArtMetadata({ workspaceRoot: root })).toThrow(/Linked ambient art path/);
    expect(fs.existsSync(path.join(outside, "art-files.generated.json"))).toBe(false);
  });
});
