// Recorded, byte-preserving migration of the pre-entity source archive.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { artManifest, root } from "./lib/ambient-art-manifest.mjs";
import { buildEntities } from "./lib/ambient-art-entities.mjs";
import { ART_DIR, categoryFolder, entityPath, relocateArtPath } from "./lib/ambient-art-paths.mjs";

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fileHash = (file) => hash(fs.readFileSync(file));
const relative = (base, file) => path.relative(base, file).split(path.sep).join("/");
const defaultReceipt = `art-src/${ART_DIR.migrations}/20260909-entity-layout.json`;

function inside(workspaceRoot, name, archiveOnly = false) {
  const base = path.resolve(workspaceRoot), target = path.resolve(base, name);
  const rel = relative(base, target);
  if (!rel || rel.startsWith("../") || path.isAbsolute(rel) || (archiveOnly && !rel.startsWith("art-src/"))) throw new Error(`Path outside intended archive: ${name}`);
  let current = base;
  for (const part of rel.split("/")) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) break;
    if (stat.isSymbolicLink()) throw new Error(`Linked path forbidden: ${name}`);
    if (!stat.isDirectory()) break;
  }
  return target;
}

function walk(workspaceRoot, directory) {
  const absolute = inside(workspaceRoot, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const name = `${directory}/${entry.name}`;
    inside(workspaceRoot, name);
    return entry.isDirectory() ? walk(workspaceRoot, name) : [name];
  });
}

export async function planMigration({ workspaceRoot = root, references = { moves: [] } } = {}) {
  const manifest = artManifest(), entities = buildEntities(manifest);
  const byFile = new Map(entities.flatMap((entity) => entity.files.map((file) => [file.filename, { entity, file }])));
  const moves = [];
  async function add(source, target, metadata = {}) {
    const absolute = inside(workspaceRoot, source, true);
    inside(workspaceRoot, target, true);
    const bytes = fs.readFileSync(absolute);
    const dimensions = /\.(png|gif)$/i.test(source) ? await sharp(bytes).metadata() : null;
    moves.push({ source, target, sha256: hash(bytes), bytes: bytes.length, ...(dimensions ? { size: [dimensions.width, dimensions.height] } : {}), ...metadata });
  }
  const archive = inside(workspaceRoot, "art-src");
  for (const name of fs.readdirSync(archive).filter((file) => file.endsWith(".png")).sort()) {
    const match = byFile.get(name);
    if (!match) throw new Error(`Unmapped root source: ${name}`);
    const { entity, file } = match;
    await add(`art-src/${name}`, `${entityPath(entity, manifest)}/${file.relativePath}`, {
      kind: "legacy-preserved-source", lineage: "Original approval lineage unverified; a public counterpart does not establish identical approved source bytes."
    });
  }
  for (const batch of ["incoming-pine", "incoming-pine-r3"]) {
    const directory = `art-src/${batch}`;
    if (!fs.existsSync(inside(workspaceRoot, directory))) continue;
    for (const name of fs.readdirSync(inside(workspaceRoot, directory)).filter((file) => file.endsWith(".png")).sort()) {
      if (byFile.get(name)?.entity.id !== "tree-pine") throw new Error(`Unexpected rejected pine file: ${name}`);
      await add(`${directory}/${name}`, relocateArtPath(`art-src/tree/tree-pine/반려본/${batch}/${name}`), {
        kind: "legacy-rejected", batch,
        evidence: "docs/ambient/history/20260909-pine-handoff-before-routing.md",
        ...(batch === "incoming-pine" && /-1\.png$/.test(name) ? { lineage: "Rejected overwritten variant-1 copy; not the missing original accepted pine source." } : {})
      });
    }
  }
  for (const candidate of references.moves.filter((item) => item.selected === "candidate")) {
    const entity = entities.find((item) => item.id === candidate.entity && item.category === candidate.category);
    const referenceRoot = entity && `art-src/${ART_DIR.reference}/${categoryFolder(entity.category)}`;
    const oldReferenceRoot = entity && `art-src/reference/${entity.category}`;
    if (!entity || ![referenceRoot, oldReferenceRoot].includes(path.posix.dirname(candidate.sourceImage)) || !/\.(png|gif)$/i.test(candidate.sourceImage) || candidate.sourceSidecar !== `${candidate.sourceImage}.json`) throw new Error("Invalid reference candidate");
    for (const [source, expected] of [[candidate.sourceImage, candidate.imageSha256], [candidate.sourceSidecar, candidate.sidecarSha256]]) {
      if (fileHash(inside(workspaceRoot, source, true)) !== expected) throw new Error(`Reference changed since visual review: ${source}`);
      await add(source, `${entityPath(entity, manifest)}/레퍼런스/${path.basename(source)}`, {
        kind: "inspiration-candidate", ownerApproved: false, reason: candidate.reason,
        confidence: candidate.confidence, visualMethod: references.visualMethod
      });
    }
  }
  const moving = new Set(moves.map((entry) => entry.source));
  const preserved = new Set([
    ...walk(workspaceRoot, "art-src").filter((name) => /\.(png|gif|png\.json|gif\.json)$/.test(name) || name.includes("/runs/") || name.includes(`/${ART_DIR.runs}/`)),
    ...walk(workspaceRoot, "public/ambient/art"),
    ...walk(workspaceRoot, "docs/ambient/reference").filter((name) => /\.(png|gif)$/.test(name)),
    ...["components/shared/ambient/art/manifest.ts", "components/shared/ambient/world/codex.ts"].filter((name) => fs.existsSync(inside(workspaceRoot, name)))
  ]);
  const protectedFiles = [...preserved].filter((name) => !moving.has(name)).sort().map((file) => ({ file, sha256: fileHash(inside(workspaceRoot, file)) }));
  const plan = { schemaVersion: 1, createdAt: new Date().toISOString(), moves, protectedFiles };
  return { plan, planSha256: hash(json(plan)), status: "planned" };
}

function validateReceipt(workspaceRoot, receipt) {
  if (receipt.plan?.schemaVersion !== 1 || hash(json(receipt.plan)) !== receipt.planSha256) throw new Error("Migration plan changed");
  const currentPath = (name) => receipt.status === "completed" ? relocateArtPath(name) : name;
  const cleaned = new Map();
  let cleanupLink = receipt.referenceCleanup;
  if (!cleanupLink) {
    const folderReceiptPath = inside(workspaceRoot, `art-src/${ART_DIR.migrations}/20260909-korean-folders.json`, true);
    if (fs.existsSync(folderReceiptPath)) cleanupLink = JSON.parse(fs.readFileSync(folderReceiptPath, "utf8")).referenceCleanup;
  }
  if (cleanupLink) {
    const cleanupPath = inside(workspaceRoot, cleanupLink.record, true);
    if (!/^[a-f0-9]{64}$/.test(cleanupLink.recordSha256) || fileHash(cleanupPath) !== cleanupLink.recordSha256) throw new Error("Reference cleanup record changed");
    const cleanup = JSON.parse(fs.readFileSync(cleanupPath, "utf8"));
    if (cleanup.schemaVersion !== 1 || cleanup.operation !== "reference-library-cleanup") throw new Error("Invalid reference cleanup record");
    for (const item of cleanup.removedFiles ?? []) {
      const current = relocateArtPath(item.path);
      if (cleaned.has(current) || !/^[a-f0-9]{64}$/.test(item.sha256) || fs.existsSync(inside(workspaceRoot, current, true))) throw new Error(`Invalid cleaned reference: ${item.path}`);
      cleaned.set(current, item.sha256);
    }
  }
  const sources = new Set(), targets = new Set();
  for (const entry of receipt.plan.moves) {
    for (const name of [entry.source, entry.target]) {
      inside(workspaceRoot, name, true);
      if (name.includes("/runs/") || name.includes(`/${ART_DIR.runs}/`) || name.startsWith("art-src/migrations/") || name.startsWith(`art-src/${ART_DIR.migrations}/`)) throw new Error(`Protected migration path: ${name}`);
    }
    inside(workspaceRoot, currentPath(entry.target), true);
    if (sources.has(entry.source) || targets.has(entry.target) || entry.source === entry.target) throw new Error("Duplicate migration path");
    sources.add(entry.source); targets.add(entry.target);
  }
  if ([...targets].some((target) => sources.has(target))) throw new Error("Overlapping migration paths");
  for (const item of receipt.plan.protectedFiles) {
    if (sources.has(item.file) || targets.has(item.file)) throw new Error("Protected file included in movement");
    const current = currentPath(item.file);
    if (cleaned.get(current) === item.sha256) continue;
    if (fileHash(inside(workspaceRoot, current)) !== item.sha256) throw new Error(`Protected file changed: ${item.file}`);
  }
  return cleaned;
}

export function checkMigration({ workspaceRoot = root, receipt }) {
  const cleaned = validateReceipt(workspaceRoot, receipt);
  if (receipt.status !== "completed") throw new Error(`Migration is ${receipt.status}`);
  for (const item of receipt.plan.moves) {
    if (fs.existsSync(inside(workspaceRoot, item.source, true))) throw new Error(`Old source still exists: ${item.source}`);
    const current = relocateArtPath(item.target);
    if (cleaned.get(current) === item.sha256) continue;
    if (fileHash(inside(workspaceRoot, current, true)) !== item.sha256) throw new Error(`Moved file changed: ${item.target}`);
  }
  return { moved: receipt.plan.moves.length, protected: receipt.plan.protectedFiles.length, status: "verified" };
}

export function applyMigration({ workspaceRoot = root, receipt, save = () => {} }) {
  validateReceipt(workspaceRoot, receipt);
  if (receipt.status === "completed") return checkMigration({ workspaceRoot, receipt });
  if (!["planned", "rolled-back"].includes(receipt.status)) throw new Error("Interrupted migration requires receipt-based recovery before retry");
  for (const item of receipt.plan.moves) {
    if (fs.existsSync(inside(workspaceRoot, item.target, true))) throw new Error(`Target exists; no overwrite: ${item.target}`);
    if (fileHash(inside(workspaceRoot, item.source, true)) !== item.sha256) throw new Error(`Source changed: ${item.source}`);
  }
  receipt.status = "applying"; save(receipt);
  const copied = [];
  let attempted = null;
  try {
    for (const item of receipt.plan.moves) {
      const source = inside(workspaceRoot, item.source, true), target = inside(workspaceRoot, item.target, true);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      attempted = item;
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      copied.push(item);
      attempted = null;
      if (fileHash(source) !== item.sha256 || fileHash(target) !== item.sha256) throw new Error(`Copy verification failed: ${item.source}`);
      fs.unlinkSync(source);
    }
    receipt.status = "completed";
    const result = checkMigration({ workspaceRoot, receipt });
    receipt.completedAt = new Date().toISOString(); save(receipt);
    return result;
  } catch (error) {
    const recovery = [];
    // A failed copy may leave bytes, or lose an exclusive-create race. Their
    // ownership is uncertain: preserve them and never claim a full rollback.
    if (attempted && fs.existsSync(inside(workspaceRoot, attempted.target, true))) {
      recovery.push({ source: attempted.source, target: attempted.target, error: "Failed copy left a target; ownership uncertain, preserved for manual recovery" });
    }
    for (const item of [...copied].reverse()) {
      try {
        const source = inside(workspaceRoot, item.source, true), target = inside(workspaceRoot, item.target, true);
        if (fileHash(target) !== item.sha256) throw new Error("Target changed; preserved for manual recovery");
        if (!fs.existsSync(source)) fs.copyFileSync(target, source, fs.constants.COPYFILE_EXCL);
        if (fileHash(source) !== item.sha256) throw new Error("Original path occupied by changed bytes");
        fs.unlinkSync(target);
      } catch (failure) { recovery.push({ source: item.source, target: item.target, error: failure.message }); }
    }
    receipt.status = recovery.length ? "recovery-required" : "rolled-back";
    receipt.failure = error.message; receipt.recovery = recovery; save(receipt);
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), command = args.shift();
    const options = {};
    while (args.length) {
      const flag = args.shift();
      if (!["--receipt", "--references"].includes(flag) || !args.length || args[0].startsWith("--")) throw new Error(`Invalid option: ${flag}`);
      options[flag.slice(2)] = args.shift();
    }
    const receiptPath = inside(root, options.receipt ?? defaultReceipt, true);
    if (command === "plan") {
      const references = options.references ? JSON.parse(fs.readFileSync(inside(root, options.references), "utf8")) : { moves: [] };
      const receipt = await planMigration({ references });
      fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
      fs.writeFileSync(receiptPath, json(receipt), { flag: "wx" });
      console.log(`Planned ${receipt.plan.moves.length} file moves; receipt: ${relative(root, receiptPath)}`);
    } else if (["apply", "check"].includes(command)) {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
      console.log(json(command === "check" ? checkMigration({ receipt }) : applyMigration({ receipt, save: (value) => fs.writeFileSync(receiptPath, json(value)) })));
    } else throw new Error("Usage: art:migrate plan|apply|check [--receipt path] [--references proposal.json]");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
