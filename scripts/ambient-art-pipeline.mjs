// Local art workflow: request -> raw -> normalize/check -> owner review -> explicit publish.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { artManifest, familySlots, root } from "./lib/ambient-art-manifest.mjs";
import { buildEntities } from "./lib/ambient-art-entities.mjs";
import { ART_DIR, entityPath, folderName, inputPath, relocateArtPath } from "./lib/ambient-art-paths.mjs";
import { normalizeSource } from "./lib/ambient-art-normalize.mjs";
import { checkArt } from "./ambient-art-check.mjs";
const sharp = createRequire(import.meta.url)("sharp");
export const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const hashFile = (file) => sha256(fs.readFileSync(file));
const relative = (base, file) => path.relative(base, file).split(path.sep).join("/");
const safeFolder = (id) => typeof id === "string" && /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9][가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ()·-]*$/.test(id) && id === id.trim();

function entryStat(file) {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function within(base, target) {
  const absolute = path.resolve(target), rel = path.relative(path.resolve(base), absolute);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Path must stay inside ${base}`);
  // A linked directory must not redirect an otherwise safe path into public or another tree.
  let current = path.resolve(base);
  const parts = rel.split(path.sep);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = entryStat(current);
    if (stat?.isSymbolicLink()) throw new Error(`Linked paths are not supported: ${current}`);
    if (stat && index < parts.length - 1 && !stat.isDirectory()) throw new Error(`Non-directory parent: ${current}`);
  }
  return absolute;
}

function runPath(workspaceRoot, runDir) {
  const supplied = within(workspaceRoot, path.resolve(workspaceRoot, runDir));
  const result = within(workspaceRoot, path.resolve(workspaceRoot, relocateArtPath(relative(workspaceRoot, supplied))));
  const parts = relative(workspaceRoot, result).split("/");
  if (parts.length !== 5 || parts[0] !== "art-src" || parts[3] !== ART_DIR.runs || ![parts[1], parts[2], parts[4]].every(safeFolder)) throw new Error("Expected art-src/<범주>/<엔티티>/작업회차/<회차>");
  return result;
}

function validateSnapshot(runDir, checkSources = true) {
  const request = read(path.join(runDir, "request.json"));
  const { requestSha256, ...payload } = request;
  if (sha256(json(payload)) !== requestSha256) throw new Error("Request snapshot changed; start a new run");
  if (hashFile(path.join(runDir, "request.md")) !== request.promptSha256) throw new Error("Request prompt changed; start a new run");
  for (const input of request.inputs) {
    if (hashFile(within(runDir, path.join(runDir, inputPath(input.path)))) !== input.sha256) throw new Error(`Input snapshot changed: ${input.path}`);
  }
  for (const source of checkSources ? request.sources : []) {
    if (hashFile(within(root, path.join(root, source.file))) !== source.sha256) throw new Error(`Source contract changed: ${source.file}; create a new request`);
  }
  return request;
}

function validatePacks(family, files) {
  const { ART_FAMILIES, slotFiles } = artManifest();
  const slots = familySlots(family);
  const allowed = slots.flatMap(slotFiles);
  if (!files.length || new Set(files).size !== files.length || files.some((file) => !allowed.includes(file))) throw new Error("Request must contain unique exact slotFiles() names");
  if (ART_FAMILIES[family]?.pairedVariants) {
    const variants = new Set(slots.flatMap((slot) => slotFiles(slot).flatMap((file, i) => files.includes(file) ? [i] : [])));
    for (const n of variants) if (slots.some((slot) => !files.includes(slotFiles(slot)[n]))) throw new Error(`Incomplete seasonal pack: variant ${n + 1}`);
  }
}

function rejectionHistory(workspaceRoot, entityDir) {
  const records = [];
  for (const folder of [ART_DIR.runs, "반려본"]) {
    const directory = within(workspaceRoot, path.join(entityDir, folder));
    if (!fs.existsSync(directory)) continue;
    for (const id of fs.readdirSync(directory).filter(safeFolder)) {
      const file = within(workspaceRoot, path.join(directory, id, "review.json"));
      if (!fs.existsSync(file)) continue;
      const review = read(file);
      if (review.decision !== "rejected" || (folder === "반려본" && review.kind !== "legacy-rejection")) continue;
      if (!(review.issues ?? []).some((issue) => issue.status === "open")) continue;
      records.push({ file, review, date: review.reviewedAt ?? review.historicalDate ?? "", id });
    }
  }
  // Bound batches, not individual issues: snow/trunk/texture reasons from one review stay together.
  return records.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 3).flatMap(({ file, review }) =>
    (review.issues ?? []).filter((issue) => issue.status === "open").map((issue) => ({
      ...issue, reviewPath: relative(workspaceRoot, file), reviewSha256: hashFile(file),
      ...(review.kind === "legacy-rejection" ? { evidenceKind: "imported-historical-rejection" } : {})
    }))
  );
}

export function createRequest({ family = "tree-pine", runId, variants = [2, 3], files: requestedFiles, workspaceRoot = root, dry = false, refreshPrepared = false }) {
  folderName(runId);
  const { slotFiles, batchPrompt } = artManifest();
  const slots = familySlots(family);
  const files = requestedFiles ?? slots.flatMap((s) => slotFiles(s).filter((_, i) => variants.includes(i + 1)));
  validatePacks(family, files);
  const entity = buildEntities(artManifest()).find((item) => item.slotIds.includes(slots[0].id));
  const runDir = runPath(workspaceRoot, path.join(entityPath(entity), ART_DIR.runs, runId));
  const publicDir = within(workspaceRoot, path.join(workspaceRoot, "public/ambient/art"));
  for (const file of files) if (fs.existsSync(path.join(publicDir, file))) throw new Error(`Accepted asset protected: ${file}`);
  const exists = fs.existsSync(runDir);
  if (exists && !refreshPrepared) throw new Error("Run already exists; use a new run id");
  let previousRequest = null;
  if (exists) {
    previousRequest = validateSnapshot(runDir, false);
    if (read(path.join(runDir, "review.json")).decision !== "pending" || fs.existsSync(path.join(runDir, "artifacts.json")) || [ART_DIR.raw, ART_DIR.normalized].some((dir) => fs.readdirSync(path.join(runDir, dir)).some((file) => file !== ".gitkeep"))) throw new Error("Only an empty, unreviewed prepared request can be refreshed");
    if (previousRequest.inputs.some((input) => inputPath(input.path) !== input.path) || previousRequest.runId !== runId) throw new Error("Relocated legacy request stays frozen; use a new run");
    if (json(previousRequest.files) !== json(files)) throw new Error("Prepared refresh cannot change requested files; use a new run");
  }
  const snapshots = [];
  for (const file of slots.flatMap(slotFiles)) {
    const source = path.join(publicDir, file);
    if (fs.existsSync(source)) snapshots.push({ source, path: inputPath(`inputs/baseline/${file}`), kind: "accepted" });
  }
  const sheet = path.join(workspaceRoot, "docs/ambient/reference", `${family}.png`);
  if (fs.existsSync(sheet)) snapshots.push({ source: sheet, path: inputPath(`inputs/reference/${family}.png`), kind: "accepted-sheet" });
  const mode = snapshots.some((s) => s.kind === "accepted") ? "extend-approved-style" : "style-pilot";
  const priorRejections = rejectionHistory(workspaceRoot, path.dirname(path.dirname(runDir)));
  const relativeRun = relative(workspaceRoot, runDir);
  const prompt = batchPrompt(slots, `${family} · ${files.length}장 · ${runId}`, {
    files, outputDir: `${relativeRun}/${ART_DIR.raw}`,
    referenceInputs: snapshots.map((input) => ({ path: `${relativeRun}/${input.path}`, kind: input.kind, slotId: input.kind === "accepted" ? slots.find((s) => slotFiles(s).includes(path.basename(input.path)))?.id : undefined })),
    note: `**이번 요청: ${files.length}장만.** 입력 스냅샷은 \`${relativeRun}/${ART_DIR.inputs}/\`, 정확한 목록은 request.json. 기존 합격본은 참고 전용이며 납품 목록에 없다.\n검토 모드: ${mode}. ${mode === "style-pilot" ? "해당 분야 합격본 없음: 첫 화풍 승인용이다." : "동일 변형의 계절 묶음을 함께 검토한다."}\n원본을 ${ART_DIR.raw}/에 보존한다. 정규화·수치 검사 후 소유자가 대조 시트를 승인해야 public 반영 가능하다.${priorRejections.length ? `\n\n최근 미해결 반려(기록 전체는 연결된 review.json):\n${priorRejections.map((issue) => `- ${issue.ruleId}: ${issue.observed} — ${issue.reviewPath}`).join("\n")}` : ""}`
  }).replaceAll("inputs 사본", `${ART_DIR.inputs} 사본`);
  const payload = {
    schemaVersion: 1, family, runId, mode, files, slots, priorRejections,
    createdAt: new Date().toISOString(), promptSha256: sha256(prompt),
    sources: ["components/shared/ambient/art/manifest.ts", "components/shared/ambient/world/codex.ts"].map((file) => ({ file, sha256: hashFile(path.join(root, file)) })),
    inputs: snapshots.map((s) => ({ path: s.path, source: relative(workspaceRoot, s.source), kind: s.kind, sha256: hashFile(s.source) }))
  };
  const request = { ...payload, requestSha256: sha256(json(payload)) };
  if (previousRequest && json(previousRequest.inputs) !== json(request.inputs)) throw new Error("Prepared refresh cannot replace frozen images; use a new run");
  if (!dry) {
    if (!exists) {
      for (const dir of [ART_DIR.raw, ART_DIR.normalized, inputPath("inputs/baseline"), inputPath("inputs/reference")]) fs.mkdirSync(path.join(runDir, dir), { recursive: true });
      for (const dir of [ART_DIR.raw, ART_DIR.normalized]) fs.writeFileSync(path.join(runDir, dir, ".gitkeep"), "", { flag: "wx" });
      for (const snapshot of snapshots) fs.copyFileSync(snapshot.source, path.join(runDir, snapshot.path), fs.constants.COPYFILE_EXCL);
    }
    const flag = exists ? "w" : "wx";
    fs.writeFileSync(path.join(runDir, "request.md"), prompt, { flag });
    fs.writeFileSync(path.join(runDir, "request.json"), json(request), { flag });
    fs.writeFileSync(path.join(runDir, "review.json"), json({ schemaVersion: 1, decision: "pending", requestSha256: request.requestSha256, issues: [] }), { flag });
  }
  return { runDir, request, prompt };
}

async function contactSheet(runDir, request, buffers, detail = false) {
  const { slotFiles } = artManifest();
  const cellW = detail ? 650 : Math.max(200, ...request.slots.map((s) => s.px[0] + 40));
  const cellH = detail ? 600 : Math.max(220, ...request.slots.map((s) => s.px[1] + 70));
  const width = cellW * 4;
  const cells = [];
  // Include approved neighbours, then candidates. The table preserves seasonal rows.
  for (const slot of request.slots) {
    const accepted = request.inputs.filter((i) => i.kind === "accepted" && slotFiles(slot).includes(path.basename(i.path)));
    const row = [...accepted.map((i) => ({ file: path.basename(i.path), source: fs.readFileSync(within(runDir, path.join(runDir, inputPath(i.path)))), label: "APPROVED" })),
      ...request.files.filter((f) => slotFiles(slot).includes(f)).map((file) => ({ file, source: buffers.get(file), label: "CANDIDATE" }))];
    for (const item of row) cells.push({ ...item, slot });
    while (cells.length % 4) cells.push(null);
  }
  const height = Math.ceil(cells.length / 4) * cellH;
  const composites = [];
  for (let i = 0; i < cells.length; i++) {
    const item = cells[i];
    if (!item) continue;
    const x = (i % 4) * cellW, y = Math.floor(i / 4) * cellH;
    const cropped = await sharp(item.source).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
    const scale = detail ? Math.max(1, Math.floor(Math.min(550 / cropped.info.width, 520 / cropped.info.height)))
      : Math.min(item.slot.px[0] / cropped.info.width, item.slot.px[1] / cropped.info.height);
    const image = await sharp(cropped.data).resize(Math.max(1, Math.round(cropped.info.width * scale)), Math.max(1, Math.round(cropped.info.height * scale)), { kernel: "nearest" }).png().toBuffer({ resolveWithObject: true });
    composites.push({ input: image.data, left: x + Math.floor((cellW - image.info.width) / 2), top: y + 30 });
    const label = `<svg width="${cellW}" height="${cellH}"><text x="8" y="16" font-size="12" fill="#253e32">${item.label} / ${detail ? `INTEGER x${scale}` : "CSS px"}</text><text x="8" y="${cellH - 6}" font-size="10" fill="#253e32">${item.file}</text></svg>`;
    composites.push({ input: Buffer.from(label), left: x, top: y });
  }
  return sharp({ create: { width, height, channels: 4, background: "#dfe6de" } }).composite(composites).png().toBuffer();
}

export async function normalizeRun({ runDir, workspaceRoot = root }) {
  runDir = runPath(workspaceRoot, runDir);
  const request = validateSnapshot(runDir);
  validatePacks(request.family, request.files);
  if (fs.existsSync(path.join(runDir, "artifacts.json"))) throw new Error("Run already normalized; start a new run to change artwork");
  const rawDir = within(runDir, path.join(runDir, ART_DIR.raw));
  const actual = fs.readdirSync(rawDir).filter((f) => f.endsWith(".png")).sort();
  if (json(actual) !== json([...request.files].sort())) throw new Error("Raw files must exactly match the request, including complete seasonal packs");
  const byFile = new Map(request.slots.flatMap((s) => artManifest().slotFiles(s).map((f) => [f, s])));
  const buffers = new Map();
  for (const file of request.files) buffers.set(file, await normalizeSource(fs.readFileSync(within(runDir, path.join(rawDir, file))), byFile.get(file)));
  const report = await checkArt({ family: request.family, dir: rawDir, baselineDir: path.join(runDir, inputPath("inputs/baseline")), expectedFiles: request.files });
  const sheet = await contactSheet(runDir, request, buffers);
  const detailSheet = await contactSheet(runDir, request, buffers, true);
  const artifacts = { schemaVersion: 1, requestSha256: request.requestSha256, files: request.files.map((file) => ({ file, rawSha256: hashFile(path.join(rawDir, file)), normalizedSha256: sha256(buffers.get(file)) })), reportSha256: sha256(json(report)), sheetSha256: sha256(sheet), detailSheetSha256: sha256(detailSheet) };
  // Write only isolated derived artifacts. Failed candidates remain reviewable.
  for (const [file, buffer] of buffers) fs.writeFileSync(within(runDir, path.join(runDir, ART_DIR.normalized, file)), buffer, { flag: "wx" });
  fs.writeFileSync(path.join(runDir, "checks.json"), json(report), { flag: "wx" });
  fs.writeFileSync(path.join(runDir, "review.png"), sheet, { flag: "wx" });
  fs.writeFileSync(path.join(runDir, "review-detail.png"), detailSheet, { flag: "wx" });
  fs.writeFileSync(path.join(runDir, "artifacts.json"), json(artifacts), { flag: "wx" });
  return report;
}

function checkedArtifacts(runDir) {
  const request = validateSnapshot(runDir);
  validatePacks(request.family, request.files);
  const artifacts = read(path.join(runDir, "artifacts.json"));
  if (artifacts.requestSha256 !== request.requestSha256 || json(artifacts.files.map((f) => f.file).sort()) !== json([...request.files].sort())) throw new Error("Artifact list differs from request");
  for (const file of artifacts.files) for (const [dir, key] of [[ART_DIR.raw, "rawSha256"], [ART_DIR.normalized, "normalizedSha256"]]) {
    if (hashFile(within(runDir, path.join(runDir, dir, file.file))) !== file[key]) throw new Error(`Artwork changed after normalization: ${file.file}`);
  }
  if (hashFile(path.join(runDir, "checks.json")) !== artifacts.reportSha256 || hashFile(path.join(runDir, "review.png")) !== artifacts.sheetSha256 || hashFile(path.join(runDir, "review-detail.png")) !== artifacts.detailSheetSha256) throw new Error("Review evidence changed");
  return { request, artifacts, report: read(path.join(runDir, "checks.json")) };
}

export function reviewRun({ runDir, decision, note, reviewer, ruleId = "owner.visual-review", expected = "Follow the request and approved reference", evidence = null, workspaceRoot = root }) {
  runDir = runPath(workspaceRoot, runDir);
  const { request, artifacts, report } = checkedArtifacts(runDir);
  if (!["approved", "rejected"].includes(decision) || !note?.trim() || reviewer !== "owner") throw new Error("Owner decision and nonempty review note required");
  if (decision === "approved" && report.status === "fail") throw new Error("Failed measurements cannot be approved; record rejection and start a new run");
  const review = { schemaVersion: 1, decision, reviewer, reviewedAt: new Date().toISOString(), requestSha256: request.requestSha256,
    artifactsSha256: hashFile(path.join(runDir, "artifacts.json")), note,
    unmeasured: report.checks.filter((c) => c.status === "unmeasured").map((c) => ({ ruleId: c.ruleId, asset: c.asset })),
    issues: decision === "rejected" ? [{ ruleId, expected, observed: note, evidence, measurement: report.checks.find((c) => c.ruleId === ruleId)?.measured ?? null,
      baselines: request.inputs.filter((i) => i.kind === "accepted").map((i) => ({ path: inputPath(i.path), sha256: i.sha256 })), status: "open", files: artifacts.files.map((f) => ({ file: f.file, sha256: f.rawSha256 })) }] : [] };
  const prior = read(path.join(runDir, "review.json"));
  if (prior.decision !== "pending") throw new Error("Review already recorded; keep history and start a new run");
  fs.writeFileSync(path.join(runDir, "review.json"), json(review));
  return review;
}

export function promoteRun({ runDir, apply = false, workspaceRoot = root }) {
  workspaceRoot = path.resolve(workspaceRoot);
  runDir = runPath(workspaceRoot, runDir);
  const { request, artifacts, report } = checkedArtifacts(runDir);
  const review = read(path.join(runDir, "review.json"));
  const artifactsSha256 = hashFile(path.join(runDir, "artifacts.json")), reviewSha256 = hashFile(path.join(runDir, "review.json"));
  if (review.decision !== "approved" || review.reviewer !== "owner" || review.requestSha256 !== request.requestSha256 || review.artifactsSha256 !== artifactsSha256 || report.status === "fail") throw new Error("Unapproved or changed artwork cannot enter public");
  const slots = familySlots(request.family);
  const entity = buildEntities(artManifest()).find((item) => item.slotIds.includes(slots[0].id));
  const entityDir = within(workspaceRoot, path.join(workspaceRoot, entityPath(entity)));
  if (path.relative(entityDir, path.dirname(path.dirname(runDir))) !== "") throw new Error("Run directory differs from its canonical entity");
  const publicDir = within(workspaceRoot, path.join(workspaceRoot, "public/ambient/art"));
  const files = artifacts.files.map((file) => {
    const asset = entity.files.find((item) => item.filename === file.file);
    if (!asset) throw new Error(`File does not belong to the run entity: ${file.file}`);
    return { file: file.file,
      normalized: { source: relative(workspaceRoot, path.join(runDir, ART_DIR.normalized, file.file)), target: relative(workspaceRoot, path.join(publicDir, file.file)), sha256: file.normalizedSha256 },
      raw: { source: relative(workspaceRoot, path.join(runDir, ART_DIR.raw, file.file)), target: relative(workspaceRoot, path.join(entityDir, asset.relativePath)), sha256: file.rawSha256 }
    };
  });
  const copies = files.flatMap((file) => [file.normalized, file.raw]);
  const publication = path.join(runDir, "published.json"), recoveryFile = path.join(runDir, "publish-recovery.json");
  // Check the entire plan before mkdir/copy, including dangling links and non-directory parents.
  for (const copy of copies) {
    const source = within(workspaceRoot, path.join(workspaceRoot, copy.source));
    if (!entryStat(source)?.isFile() || hashFile(source) !== copy.sha256) throw new Error(`Publication source changed: ${copy.source}`);
    const target = within(workspaceRoot, path.join(workspaceRoot, copy.target));
    if (entryStat(target)) throw new Error(`${target.startsWith(publicDir + path.sep) ? "Accepted asset" : "Archived source"} protected: ${copy.target}`);
  }
  for (const file of [publication, recoveryFile]) if (entryStat(within(workspaceRoot, file))) throw new Error(`Publication record protected: ${relative(workspaceRoot, file)}`);
  if (apply) {
    const created = [];
    let attempted = null;
    try {
      for (const copy of copies) {
        const source = within(workspaceRoot, path.join(workspaceRoot, copy.source));
        const target = within(workspaceRoot, path.join(workspaceRoot, copy.target));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        within(workspaceRoot, target);
        if (!entryStat(source)?.isFile() || hashFile(source) !== copy.sha256) throw new Error(`Publication source changed: ${copy.source}`);
        attempted = copy;
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
        created.push(copy);
        attempted = null;
        if (!entryStat(target)?.isFile() || hashFile(source) !== copy.sha256 || hashFile(target) !== copy.sha256) throw new Error(`Copy verification failed: ${copy.target}`);
      }
      const current = checkedArtifacts(runDir);
      if (current.request.requestSha256 !== request.requestSha256 || hashFile(path.join(runDir, "artifacts.json")) !== artifactsSha256 || hashFile(path.join(runDir, "review.json")) !== reviewSha256) throw new Error("Approval evidence changed during publication");
      for (const copy of copies) {
        const target = within(workspaceRoot, path.join(workspaceRoot, copy.target));
        if (!entryStat(target)?.isFile() || hashFile(target) !== copy.sha256) throw new Error(`Published copy changed: ${copy.target}`);
      }
      const receipt = json({ schemaVersion: 2, status: "completed", requestSha256: request.requestSha256, artifactsSha256, reviewSha256, files, publishedAt: new Date().toISOString() });
      attempted = { target: relative(workspaceRoot, publication), sha256: sha256(receipt) };
      fs.writeFileSync(within(workspaceRoot, publication), receipt, { flag: "wx" });
      created.push(attempted);
      attempted = null;
      if (!entryStat(within(workspaceRoot, publication))?.isFile() || hashFile(publication) !== sha256(receipt)) throw new Error("Publication receipt changed while writing");
    } catch (error) {
      const recovery = [];
      if (attempted) {
        try {
          if (entryStat(within(workspaceRoot, path.join(workspaceRoot, attempted.target)))) recovery.push({ ...attempted, reason: "Failed write left a target; ownership uncertain, preserved" });
        } catch (failure) { recovery.push({ ...attempted, reason: failure.message }); }
      }
      // A successful exclusive write is owned only while its regular-file bytes still match.
      for (const copy of created.reverse()) {
        try {
          const target = within(workspaceRoot, path.join(workspaceRoot, copy.target)), stat = entryStat(target);
          if (!stat) continue;
          if (!stat.isFile() || hashFile(target) !== copy.sha256) throw new Error("Target changed; preserved for recovery");
          fs.unlinkSync(target);
        } catch (failure) { recovery.push({ ...copy, reason: failure.message }); }
      }
      if (recovery.length) {
        const record = { schemaVersion: 2, status: "recovery-required", requestSha256: request.requestSha256, artifactsSha256, reviewSha256, files, failedAt: new Date().toISOString(), failure: error.message, recovery };
        error.recovery = record;
        try { fs.writeFileSync(within(workspaceRoot, recoveryFile), json(record), { flag: "wx" }); }
        catch (failure) { error.message += `; recovery record could not be fully written: ${failure.message}`; }
        error.message += `; recovery-required: ${relative(workspaceRoot, recoveryFile)}`;
      }
      throw error;
    }
  }
  return { applied: apply, files: request.files, destination: publicDir, copies };
}

async function main() {
  const [command, target, ...args] = process.argv.slice(2);
  const flag = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  let result;
  if (command === "request") result = createRequest({ family: target, runId: flag("--run", null), variants: flag("--variants", "2,3").split(",").map(Number), dry: args.includes("--dry"), refreshPrepared: args.includes("--refresh-prepared") });
  else if (command === "normalize") { result = await normalizeRun({ runDir: target }); if (result.status === "fail") process.exitCode = 1; }
  else if (command === "review") result = reviewRun({ runDir: target, decision: flag("--decision", null), note: flag("--note", null), reviewer: flag("--reviewer", null), ruleId: flag("--rule", "owner.visual-review"), expected: flag("--expected", "Follow the request and approved reference"), evidence: flag("--evidence", null) });
  else if (command === "promote") result = promoteRun({ runDir: target, apply: args.includes("--apply") });
  else throw new Error("Usage: art:pipeline request <family> --run <id> [--variants 2,3] [--dry] | normalize <run> | review <run> --decision approved|rejected --reviewer owner --note <owner decision> | promote <run> [--apply]");
  console.log(json(command === "request" ? { runDir: result.runDir, files: result.request.files, mode: result.request.mode, requestSha256: result.request.requestSha256 } : result));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message);
  if (error.recovery) console.error(json(error.recovery));
  process.exitCode = 1;
});
