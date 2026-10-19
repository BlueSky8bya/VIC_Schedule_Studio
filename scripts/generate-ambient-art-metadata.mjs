import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = "public/ambient/art";
const metadataPath = "lib/ambient/art-files.generated.json";
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Follow neither source nor output symlinks. The inventory is public asset
// metadata only; private source art and environment files are never scanned.
function assertUnlinked(workspaceRoot, relative) {
  let current = workspaceRoot;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Linked ambient art path: ${relative}`);
    }
  }
}

export function collectAmbientArtMetadata(workspaceRoot = root) {
  assertUnlinked(workspaceRoot, inventoryPath);
  const directory = path.join(workspaceRoot, inventoryPath);
  const hash = createHash("sha256");
  const files = [];
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".png")).sort()) {
    const relative = `${inventoryPath}/${file}`;
    assertUnlinked(workspaceRoot, relative);
    if (!fs.statSync(path.join(directory, file)).isFile()) throw new Error(`Not an ambient PNG file: ${file}`);
    const bytes = fs.readFileSync(path.join(directory, file));
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(pngSignature) ||
        bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") {
      throw new Error(`Invalid ambient PNG header: ${file}`);
    }
    const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
    if (!w || !h) throw new Error(`Invalid ambient PNG dimensions: ${file}`);
    files.push({ file, bytes: bytes.length, w, h });
    hash.update(`${file}\0${bytes.length}\0`).update(bytes);
  }
  // A deterministic 48-bit cache-bust token, not a date or authorization clock.
  // Unlike mtime, it survives fresh checkouts and detects same-size replacements.
  const stamp = files.length ? Number.parseInt(hash.digest("hex").slice(0, 12), 16) : 0;
  return { schemaVersion: 1, stamp, files };
}

export function generateAmbientArtMetadata({ workspaceRoot = root, check = false } = {}) {
  const metadata = collectAmbientArtMetadata(workspaceRoot);
  const expected = `${JSON.stringify(metadata, null, 2)}\n`;
  assertUnlinked(workspaceRoot, metadataPath);
  const output = path.join(workspaceRoot, metadataPath);
  const current = fs.existsSync(output) ? fs.readFileSync(output, "utf8") : undefined;
  if (current !== expected) {
    if (check) throw new Error("Ambient art metadata drift; run npm run art:metadata");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, expected);
  }
  return { files: metadata.files.length, bytes: Buffer.byteLength(expected), changed: current !== expected };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--check") || args.length > 1) throw new Error("Usage: generate-ambient-art-metadata.mjs [--check]");
  console.log(JSON.stringify(generateAmbientArtMetadata({ check: args.includes("--check") })));
}
