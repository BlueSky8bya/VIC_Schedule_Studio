import path from "node:path";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildEntities } from "./ambient-art-entities.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const cached = new Map();

function compileModule(entry) {
  if (!cached.has(entry)) {
    const source = require("esbuild").buildSync({
      entryPoints: [path.join(root, entry)],
      bundle: true, platform: "node", format: "cjs", write: false,
      tsconfig: path.join(root, "tsconfig.json"), logLevel: "silent"
    }).outputFiles[0].text;
    const compiled = new Module(path.join(root, "ambient-art-memory.cjs"));
    compiled._compile(source, path.join(root, "ambient-art-memory.cjs"));
    cached.set(entry, compiled.exports);
  }
  return cached.get(entry);
}

/** Read the same manifest as the board, without writing a compiler cache. */
export function artManifest() {
  return compileModule("components/shared/ambient/art/manifest.ts");
}

/** Codex species with their biomes/habitat; style-reference selection reads these, the manifest does not re-export them. */
export function codexEntries() {
  return compileModule("components/shared/ambient/world/codex.ts").CODEX;
}

export function familySlots(id) {
  const manifest = artManifest();
  const { ART_FAMILIES, artSlot } = manifest;
  const ids = ART_FAMILIES[id]?.slotIds ?? buildEntities(manifest).find((entity) => entity.id === id)?.slotIds ?? [id];
  const slots = ids.map(artSlot);
  if (slots.some((slot) => !slot)) throw new Error(`Unknown art family or slot: ${id}`);
  return slots;
}
