// Stable folder names are separate from mutable display names and runtime IDs.
import fs from "node:fs";
import path from "node:path";
import { artManifest, root } from "./ambient-art-manifest.mjs";
import { buildEntities } from "./ambient-art-entities.mjs";

export const ART_DIR = Object.freeze({
  runs: "작업회차", raw: "원본", normalized: "정리본", inputs: "고정입력",
  baseline: "합격참고", reference: "공통화풍참고", collected: "수집참고", migrations: "이관기록"
});
const names = JSON.parse(fs.readFileSync(path.join(root, "art-src/폴더명.json"), "utf8"));
if (names.schemaVersion !== 1) throw new Error("Unknown art folder mapping version");

export function folderName(name) {
  if (typeof name !== "string" || !/^[가-힣0-9][가-힣0-9 ()·-]*$/.test(name) || name.trim() !== name) throw new Error(`Expected a Korean folder name: ${name}`);
  return name;
}

export function categoryFolder(category) {
  return folderName(names.categories[category]);
}

export function entityPath(entity, manifest = artManifest()) {
  const folder = names.entities[entity.id] ?? manifest.ART_SLOTS.find(slot => slot.id === entity.slotIds[0])?.nameKo;
  return `art-src/${categoryFolder(entity.category)}/${folderName(folder)}`;
}

/** Resolve historical frozen input paths without editing the signed request. */
export function inputPath(relative) {
  const parts = relative.replaceAll("\\", "/").split("/");
  if (parts[0] === "inputs") parts[0] = ART_DIR.inputs;
  if (parts[0] === ART_DIR.inputs) {
    if (parts[1] === "baseline") parts[1] = ART_DIR.baseline;
    if (parts[1] === "reference") parts[1] = "레퍼런스";
    if (parts[1] === "collected") parts[1] = ART_DIR.collected;
  }
  return parts.join("/");
}

/** Old repo-relative paths remain evidence; only filesystem lookups are translated. */
export function relocateArtPath(relative) {
  const parts = relative.replaceAll("\\", "/").split("/");
  if (parts[0] !== "art-src") return relative;
  if (parts.some(part => part === ".." || part === ".")) throw new Error(`Invalid art path: ${relative}`);
  if (parts[1] === "migrations") parts[1] = ART_DIR.migrations;
  if (parts[1] === "reference" || parts[1] === "공용참고" || parts[1] === ART_DIR.reference) {
    const legacyCategoryLayout = parts[1] !== ART_DIR.reference;
    parts[1] = ART_DIR.reference;
    if (legacyCategoryLayout && names.categories[parts[2]]) parts[2] = categoryFolder(parts[2]);
    return parts.join("/");
  }
  if (names.categories[parts[1]]) parts[1] = categoryFolder(parts[1]);
  if (names.entities[parts[2]]) parts[2] = folderName(names.entities[parts[2]]);
  if (parts[3] === "runs" || parts[3] === ART_DIR.runs) {
    parts[3] = ART_DIR.runs;
    if (names.runFolders[parts[4]]) parts[4] = folderName(names.runFolders[parts[4]]);
    if (parts[5] === "raw") parts[5] = ART_DIR.raw;
    if (parts[5] === "normalized") parts[5] = ART_DIR.normalized;
    return [...parts.slice(0, 5), ...inputPath(parts.slice(5).join("/")).split("/").filter(Boolean)].join("/");
  }
  if (parts[3] === "반려본" && names.rejectionFolders[parts[4]]) parts[4] = folderName(names.rejectionFolders[parts[4]]);
  return parts.join("/");
}

// Fail before consumers write when different IDs would share one physical folder.
const destinations = new Set();
for (const entity of buildEntities(artManifest())) {
  const destination = entityPath(entity).normalize("NFC").toLowerCase();
  if (destinations.has(destination)) throw new Error(`Duplicate art folder: ${destination}`);
  destinations.add(destination);
}
