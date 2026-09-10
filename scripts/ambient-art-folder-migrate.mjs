// One-time Korean folder migration. Preserve frozen evidence and record every byte.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { root } from "./lib/ambient-art-manifest.mjs";
import { ART_DIR, relocateArtPath } from "./lib/ambient-art-paths.mjs";

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const stat = file => fs.lstatSync(file, { throwIfNoEntry: false });

function inside(workspaceRoot, relative) {
  const absolute = path.resolve(workspaceRoot, relative);
  const rel = path.relative(path.resolve(workspaceRoot, "art-src"), absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Outside art archive: ${relative}`);
  let current = path.resolve(workspaceRoot);
  for (const part of path.relative(current, absolute).split(path.sep)) {
    current = path.join(current, part);
    if (stat(current)?.isSymbolicLink()) throw new Error(`Linked art path: ${current}`);
  }
  return absolute;
}

function inventory(workspaceRoot) {
  const files = [], directories = [];
  function walk(relative) {
    const directory = inside(workspaceRoot, relative);
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${relative}/${item.name}`;
      inside(workspaceRoot, file);
      if (item.isDirectory()) { directories.push(file); walk(file); }
      else if (item.isFile()) files.push(file);
      else throw new Error(`Unsupported archive entry: ${file}`);
    }
  }
  walk("art-src");
  return { files, directories };
}

export function planFolderMigration({ workspaceRoot = root } = {}) {
  const { files, directories } = inventory(workspaceRoot);
  const unmapped = directories.filter(source => /[a-z]/i.test(path.posix.basename(relocateArtPath(source))));
  if (unmapped.length) throw new Error(`Unmapped English folders: ${unmapped.join(", ")}`);
  const targets = new Set();
  for (const source of [...directories, ...files]) {
    const target = relocateArtPath(source);
    const key = target.normalize("NFC").toLowerCase();
    if (targets.has(key)) throw new Error(`Duplicate destination: ${target}`);
    targets.add(key);
    inside(workspaceRoot, target);
  }
  const operations = directories.filter(source => path.posix.basename(source) !== path.posix.basename(relocateArtPath(source)))
    .sort((a, b) => b.split("/").length - a.split("/").length || a.localeCompare(b))
    .map(source => ({ source, target: `${path.posix.dirname(source)}/${path.posix.basename(relocateArtPath(source))}` }));
  for (const operation of operations) if (stat(inside(workspaceRoot, operation.target))) throw new Error(`Destination exists: ${operation.target}`);
  const editable = new Set(["art-src/README.md", "art-src/AGENTS.md", "art-src/reference/README.md", "art-src/reference/NOTICE.md"]);
  const plan = {
    schemaVersion: 1, createdAt: new Date().toISOString(),
    authorization: "Owner: art-src 내부 폴더명 다 한글로 변경. File names, runtime IDs and frozen evidence bytes retained.",
    operations,
    directories: directories.map(source => ({ source, target: relocateArtPath(source) })),
    files: files.map(source => {
      const bytes = fs.readFileSync(inside(workspaceRoot, source));
      const documentation = editable.has(source) || bytes.subarray(0, 48).toString("utf8").startsWith("<!-- ambient-art-catalog:generated v1 -->");
      return { source, target: relocateArtPath(source), bytes: bytes.length, sha256: hash(bytes), documentation };
    })
  };
  return { plan, planSha256: hash(json(plan)), status: "planned", completedOperations: [] };
}

function validate(workspaceRoot, receipt) {
  if (receipt.plan?.schemaVersion !== 1 || hash(json(receipt.plan)) !== receipt.planSha256) throw new Error("Folder migration plan changed");
  for (const item of [...receipt.plan.operations, ...receipt.plan.directories, ...receipt.plan.files]) {
    inside(workspaceRoot, item.source); inside(workspaceRoot, item.target);
  }
}

function documentationUpdates(workspaceRoot, receipt) {
  const entries = receipt.documentationUpdates ?? [];
  if (!Array.isArray(entries)) throw new Error("Invalid documentation updates");
  const originals = new Map(receipt.plan.files.map(file => [file.target, file]));
  const updates = new Map();
  for (const update of entries) {
    if (!update || typeof update !== "object" || typeof update.file !== "string"
      || typeof update.preservedOriginal !== "string" || typeof update.reason !== "string" || !update.reason.trim()
      || !/^[a-f0-9]{64}$/.test(update.originalSha256) || !/^[a-f0-9]{64}$/.test(update.updatedSha256)) {
      throw new Error("Invalid documentation update metadata");
    }
    const original = originals.get(update.file);
    if (path.posix.basename(update.file) !== "README.md" || !original) throw new Error(`Unregistered README update: ${update.file}`);
    if (updates.has(update.file)) throw new Error(`Duplicate documentation update: ${update.file}`);
    if (update.originalSha256 !== original.sha256) throw new Error(`Documentation original hash differs from plan: ${update.file}`);
    const preserved = path.posix.join(path.posix.dirname(update.file), "원문-README.md");
    if (update.preservedOriginal !== preserved || originals.has(preserved)) throw new Error(`Invalid preserved README path: ${update.file}`);
    const preservedFile = inside(workspaceRoot, preserved);
    if (!stat(preservedFile)?.isFile() || hash(fs.readFileSync(preservedFile)) !== original.sha256) throw new Error(`Preserved README changed or missing: ${preserved}`);
    const currentFile = inside(workspaceRoot, update.file);
    if (!stat(currentFile)?.isFile() || hash(fs.readFileSync(currentFile)) !== update.updatedSha256) throw new Error(`Updated README changed or missing: ${update.file}`);
    updates.set(update.file, update);
  }
  return updates;
}

function entityConsolidations(workspaceRoot, receipt) {
  const entries = receipt.entityConsolidations ?? [];
  if (!Array.isArray(entries)) throw new Error("Invalid entity consolidations");
  const planFiles = receipt.plan.files;
  const result = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || typeof entry.source !== "string" || typeof entry.target !== "string"
      || typeof entry.record !== "string" || !/^[a-f0-9]{64}$/.test(entry.recordSha256)) throw new Error("Invalid entity consolidation metadata");
    if (result.has(entry.source) || entry.source === entry.target || !entry.record.startsWith(`art-src/${ART_DIR.migrations}/`)) throw new Error(`Invalid entity consolidation: ${entry.source}`);
    const expected = planFiles.filter(file => file.target === entry.source || file.target.startsWith(`${entry.source}/`));
    if (!expected.length || expected.some(file => !file.documentation)) throw new Error(`Consolidation includes protected evidence: ${entry.source}`);
    const recordFile = inside(workspaceRoot, entry.record);
    if (!stat(recordFile)?.isFile() || hash(fs.readFileSync(recordFile)) !== entry.recordSha256) throw new Error(`Consolidation record changed or missing: ${entry.record}`);
    const record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
    if (record.schemaVersion !== 1 || record.status !== "completed" || record.source !== entry.source || record.target !== entry.target) throw new Error(`Invalid consolidation record: ${entry.record}`);
    const expectedFiles = expected.map(file => ({ file: file.target, sha256: file.sha256 })).sort((a, b) => a.file.localeCompare(b.file));
    const recordedFiles = record.files?.map(file => ({ file: file.path, sha256: file.sha256 })).sort((a, b) => a.file.localeCompare(b.file));
    if (json(recordedFiles) !== json(expectedFiles)) throw new Error(`Consolidation file inventory differs from plan: ${entry.record}`);
    if (stat(inside(workspaceRoot, entry.source))) throw new Error(`Consolidated source remains: ${entry.source}`);
    if (!stat(inside(workspaceRoot, entry.target))?.isDirectory()) throw new Error(`Consolidation target missing: ${entry.target}`);
    result.set(entry.source, entry);
  }
  return result;
}

function referenceCleanup(workspaceRoot, receipt) {
  const entry = receipt.referenceCleanup;
  if (!entry || typeof entry !== "object" || typeof entry.record !== "string" || !/^[a-f0-9]{64}$/.test(entry.recordSha256)) return new Set();
  if (!entry.record.startsWith(`art-src/${ART_DIR.migrations}/`)) throw new Error("Invalid reference cleanup record path");
  const recordFile = inside(workspaceRoot, entry.record);
  if (!stat(recordFile)?.isFile() || hash(fs.readFileSync(recordFile)) !== entry.recordSha256) throw new Error(`Reference cleanup record changed or missing: ${entry.record}`);
  const record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
  if (record.schemaVersion !== 1 || record.operation !== "reference-library-cleanup") throw new Error(`Invalid reference cleanup record: ${entry.record}`);
  const planFiles = new Map(receipt.plan.files.map(file => [file.target, file]));
  const skipped = new Set();
  for (const removed of record.removedFiles ?? []) {
    const original = planFiles.get(removed.path);
    if (!original || original.sha256 !== removed.sha256) throw new Error(`Reference cleanup differs from migration plan: ${removed.path}`);
    if (stat(inside(workspaceRoot, removed.path))) throw new Error(`Removed reference remains: ${removed.path}`);
    skipped.add(removed.path);
  }
  for (const moved of record.retainedAndMovedDocs ?? []) {
    const original = planFiles.get(moved.from);
    if (!original?.documentation || !moved.from.startsWith(`${record.oldRoot}/`) || !moved.to.startsWith(`${record.newRoot}/`)) throw new Error(`Invalid moved reference document: ${moved.from}`);
    if (!stat(inside(workspaceRoot, moved.to))?.isFile()) throw new Error(`Moved reference document missing: ${moved.to}`);
    skipped.add(moved.from);
  }
  const expectedOldRoot = receipt.plan.files.filter(file => file.target.startsWith(`${record.oldRoot}/`)).map(file => file.target);
  if (expectedOldRoot.some(file => !skipped.has(file))) throw new Error("Reference cleanup does not account for every old shared-library file");
  if (stat(inside(workspaceRoot, record.oldRoot)) || !stat(inside(workspaceRoot, record.newRoot))?.isDirectory()) throw new Error("Reference cleanup root state differs from record");
  return skipped;
}

export function checkFolderMigration({ workspaceRoot = root, receipt, allowDocumentationChanges = true } = {}) {
  validate(workspaceRoot, receipt);
  if (receipt.status !== "completed") throw new Error(`Folder migration is ${receipt.status}`);
  // Additive routing corrections never change the signed migration plan or exempt other evidence.
  const updates = documentationUpdates(workspaceRoot, receipt);
  const consolidations = entityConsolidations(workspaceRoot, receipt);
  const cleanedReferences = referenceCleanup(workspaceRoot, receipt);
  const consolidated = target => [...consolidations.keys()].some(source => target === source || target.startsWith(`${source}/`));
  for (const file of receipt.plan.files) {
    if (consolidated(file.target) || cleanedReferences.has(file.target)) continue;
    const target = inside(workspaceRoot, file.target);
    if (!stat(target)?.isFile()) throw new Error(`Missing migrated file: ${file.target}`);
    const preservedRoutingUpdate = allowDocumentationChanges && updates.has(file.target);
    if (!preservedRoutingUpdate && (!file.documentation || !allowDocumentationChanges) && hash(fs.readFileSync(target)) !== file.sha256) throw new Error(`Migrated bytes changed: ${file.target}`);
    if (file.source !== file.target && stat(inside(workspaceRoot, file.source))) throw new Error(`Old file remains: ${file.source}`);
  }
  for (const directory of receipt.plan.directories) if (!consolidated(directory.target) && !directory.target.startsWith("art-src/공용참고") && !stat(inside(workspaceRoot, directory.target))?.isDirectory()) throw new Error(`Missing directory: ${directory.target}`);
  const english = inventory(workspaceRoot).directories.filter(directory => /[a-z]/i.test(path.posix.basename(directory)));
  if (english.length) throw new Error(`English folder remains: ${english.join(", ")}`);
  return { status: "verified", renamedDirectories: receipt.plan.operations.length, files: receipt.plan.files.length, protectedFiles: receipt.plan.files.filter(file => !file.documentation).length, englishFolders: 0 };
}

export function applyFolderMigration({ workspaceRoot = root, receipt, save = () => {} }) {
  validate(workspaceRoot, receipt);
  if (receipt.status !== "planned") throw new Error("Existing migration requires explicit receipt-based recovery");
  // All destinations and original bytes are checked before the first rename.
  for (const file of receipt.plan.files) if (hash(fs.readFileSync(inside(workspaceRoot, file.source))) !== file.sha256) throw new Error(`Source changed: ${file.source}`);
  for (const operation of receipt.plan.operations) {
    if (!stat(inside(workspaceRoot, operation.source))?.isDirectory()) throw new Error(`Missing source directory: ${operation.source}`);
    if (stat(inside(workspaceRoot, operation.target))) throw new Error(`Destination exists: ${operation.target}`);
  }
  const current = inventory(workspaceRoot);
  for (const kind of ["files", "directories"]) {
    if (json(current[kind].sort()) !== json(receipt.plan[kind].map(item => item.source).sort())) throw new Error(`Archive inventory changed: ${kind}; create a new plan`);
  }
  receipt.status = "applying"; save(receipt);
  try {
    for (const operation of receipt.plan.operations) {
      const source = inside(workspaceRoot, operation.source), target = inside(workspaceRoot, operation.target);
      if (stat(target)) throw new Error(`Destination appeared: ${operation.target}`);
      fs.renameSync(source, target);
      receipt.completedOperations.push(operation);
      save(receipt);
    }
    receipt.status = "completed";
    const result = checkFolderMigration({ workspaceRoot, receipt, allowDocumentationChanges: false });
    receipt.completedAt = new Date().toISOString(); save(receipt);
    return result;
  } catch (error) {
    // Preserve both the actual tree and exact progress for recovery; never erase evidence.
    receipt.status = "recovery-required";
    receipt.failure = error.message;
    try { save(receipt); } catch { error.recovery = receipt; }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "check" || process.argv.length > 4) throw new Error("Usage: node scripts/ambient-art-folder-migrate.mjs check [receipt.json]");
    const receipt = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[3] ?? "art-src/이관기록/20260909-korean-folders.json"), "utf8"));
    console.log(JSON.stringify(checkFolderMigration({ receipt })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
