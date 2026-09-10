import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildEntities } from "./ambient-art-entities.mjs";
import { ART_DIR, entityPath } from "./ambient-art-paths.mjs";

export const REFERENCE_CATEGORIES = {
  tree: "나무", plant: "풀·꽃", ground: "지형", water: "물", prop: "소품",
  sky: "하늘·천체", fish: "물고기", bug: "곤충", animal: "동물",
};
const imageName = /\.(png|gif)$/i;
const sidecarName = /\.(png|gif)\.json$/i;
const safeId = /^[a-z0-9][a-z0-9-]*$/;
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");

/** Reference operations never traverse symlinks or leave the requested workspace. */
function referencePath(workspaceRoot, segments) {
  const root = path.resolve(workspaceRoot), target = path.resolve(root, ...segments);
  const rel = path.relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error("Reference path leaves workspace");
  let cursor = root;
  for (const part of rel.split(path.sep)) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Reference symlink is not allowed: ${relative(root, cursor)}`);
  }
  return target;
}

function knownEntities(manifest) {
  return buildEntities(manifest).map((entity) => {
    if (!Object.hasOwn(REFERENCE_CATEGORIES, entity.category) || !safeId.test(entity.id)) throw new Error(`Invalid reference entity: ${entity.id}`);
    return entity;
  });
}

export function referenceDirectory({ workspaceRoot, category, entity, manifest }) {
  if (!Object.hasOwn(REFERENCE_CATEGORIES, category)) throw new Error(`Unknown reference category: ${category}`);
  if (!entity) throw new Error("--entity is required; 공통화풍참고 is curated manually");
  const entry = knownEntities(manifest).find((item) => item.id === entity);
  if (!entry || entry.category !== category) throw new Error(`Unknown reference entity for ${category}: ${entity}`);
  return referencePath(workspaceRoot, [entityPath(entry, manifest), "레퍼런스"]);
}

/** Preserve both existing halves of a pair, including dangling links and manual sidecars. */
export function writeReferencePair({ workspaceRoot, category, entity, manifest, filename, image, card }) {
  if (!/^[a-zA-Z0-9._-]+\.(png|gif)$/i.test(filename)) throw new Error(`Invalid reference filename: ${filename}`);
  const dir = referenceDirectory({ workspaceRoot, category, entity, manifest });
  const imagePath = path.join(dir, filename), cardPath = `${imagePath}.json`;
  if ([imagePath, cardPath].some((file) => fs.lstatSync(file, { throwIfNoEntry: false }))) return { saved: false };
  const metadata = `${JSON.stringify(card, null, 2)}\n`;
  const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const imageHash = digest(image);
  fs.mkdirSync(dir, { recursive: true });
  let imageWritten = false;
  try {
    fs.writeFileSync(imagePath, image, { flag: "wx" });
    imageWritten = true;
    fs.writeFileSync(cardPath, metadata, { flag: "wx" });
  } catch (error) {
    // Remove only this invocation's exact image. Never follow or delete a replacement link/file.
    referencePath(workspaceRoot, [relative(workspaceRoot, dir)]);
    if (imageWritten && fs.lstatSync(imagePath, { throwIfNoEntry: false })?.isFile() && digest(fs.readFileSync(imagePath)) === imageHash) fs.unlinkSync(imagePath);
    throw error;
  }
  return { saved: true };
}

/** Only canonical entity reference directories are eligible. */
export function referenceDirectories({ workspaceRoot, manifest }) {
  const entities = knownEntities(manifest);
  return Object.keys(REFERENCE_CATEGORIES).flatMap((category) =>
    entities.filter((entity) => entity.category === category).map((entity) => ({
      category, entity: entity.id, dir: referencePath(workspaceRoot, [entityPath(entity, manifest), "레퍼런스"]),
    })));
}

export function parseReferenceFetchArgs(args, { workspaceRoot, manifest }) {
  const options = { limit: 24, query: "", entity: null }, categories = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--all") throw new Error("--all is retired; choose one entity with --entity");
    if (["--limit", "--query", "--entity"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--limit") options.limit = Number(value);
      else options[arg.slice(2)] = value;
    } else if (Object.hasOwn(REFERENCE_CATEGORIES, arg)) categories.push(arg);
    else throw new Error(`Unknown reference argument: ${arg}`);
  }
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) throw new Error("--limit must be a positive integer");
  const targets = [...new Set(categories)];
  if (targets.length !== 1 || !options.entity) throw new Error("범주 하나와 --entity <내부 ID>를 함께 달라");
  return { ...options, targets: targets.map((category) => ({
    category, dir: referenceDirectory({ workspaceRoot, category, entity: options.entity, manifest }),
  })) };
}

/** Read only direct image/sidecar pairs; never scan runs, inputs, generated art, or nested folders. */
export function scanReferenceLibrary({ workspaceRoot, manifest }) {
  const rows = [], problems = [], orphanSidecars = [];
  for (const { category, dir } of referenceDirectories({ workspaceRoot, manifest })) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isSymbolicLink() && (imageName.test(item.name) || sidecarName.test(item.name)))) {
      problems.push(`참고 파일 심볼릭 링크 금지: ${relative(workspaceRoot, path.join(dir, entry.name))}`);
    }
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const images = files.filter((file) => imageName.test(file)).sort();
    for (const card of files.filter((file) => sidecarName.test(file)).sort()) {
      if (!images.includes(card.slice(0, -5))) orphanSidecars.push(relative(workspaceRoot, path.join(dir, card)));
    }
    for (const img of images) {
      const sourcePath = relative(workspaceRoot, path.join(dir, img)), cardName = `${img}.json`;
      if (!files.includes(cardName)) {
        problems.push(`출처 없는 그림: ${sourcePath} — 사이드카 ${cardName}을 손으로 적어야 한다`);
        continue;
      }
      let card;
      try { card = JSON.parse(fs.readFileSync(path.join(dir, cardName), "utf8")); }
      catch { problems.push(`읽을 수 없는 사이드카: ${sourcePath}.json`); continue; }
      if (!card || typeof card !== "object" || !/^CC0/.test(card.license ?? "")) {
        problems.push(`CC0가 아닌 항목: ${sourcePath} — ${card?.license ?? "라이선스 없음"}`);
        continue;
      }
      rows.push({ category, sourcePath, card });
    }
  }
  return { rows, total: rows.length, problems, orphanSidecars };
}

const cell = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
export function renderReferenceNotice({ rows, total }) {
  return `# 엔티티 레퍼런스 출처

> **이 파일은 손으로 고치지 않는다.** \`node scripts/ambient-ref-notice.mjs\`가
> 각 그림 옆의 사이드카(\`<파일>.json\`)에서 다시 굽는다. 그림을 지우면 줄도 사라진다.

엔티티 \`art-src/<한글 범주>/<한글 엔티티>/레퍼런스/\`의 직접 자식 그림만 집계한다.
\`공통화풍참고\`, run의 고정 입력·생성본·반려본은 검색하지 않는다.
참고 그림에서는 형태의 발상만 얻고, 그리는 어법은 우리 합격본을 따른다.
요청에 자동 첨부되지 않으며, **베끼거나 트레이스한 결과물은 쓸 수 없다**(ADR-0019).
자동 수집은 엔티티와 연결한 **CC0** 자료만 받는다. 다른 라이선스는 \`ambient-ref-fetch.mjs\`가 거른다.

현재 ${total}장. 파일 경로는 저장소 루트 기준이다.

| 범주 | 파일 경로 | 라이선스 | 작성자 | 출처 |
|---|---|---|---|---|
${rows.map(({ category, sourcePath, card }) => `| ${REFERENCE_CATEGORIES[category]} | \`${cell(sourcePath)}\` | ${cell(card.license)} | ${cell(card.author)} | ${cell(card.source)} |`).join("\n")}
`;
}

/** Explicit mutation entry point. Check mode never creates, removes, or rewrites files. */
export function updateReferenceNotice({ workspaceRoot, manifest, check = false }) {
  const scan = scanReferenceLibrary({ workspaceRoot, manifest });
  const body = renderReferenceNotice(scan);
  const noticePath = referencePath(workspaceRoot, ["art-src", ART_DIR.reference, "NOTICE.md"]);
  const problems = [...scan.problems];
  if (check) {
    problems.push(...scan.orphanSidecars.map((file) => `짝 잃은 사이드카: ${file}`));
    const current = fs.existsSync(noticePath) ? fs.readFileSync(noticePath, "utf8") : "";
    if (current !== body) problems.push("NOTICE.md가 폴더 내용과 어긋난다 — `node scripts/ambient-ref-notice.mjs`를 돌려라.");
  } else if (!problems.length) {
    for (const file of scan.orphanSidecars) fs.rmSync(referencePath(workspaceRoot, file.split("/")));
    fs.mkdirSync(path.dirname(noticePath), { recursive: true });
    fs.writeFileSync(noticePath, body, "utf8");
  }
  return { ...scan, problems, body, noticePath, ok: !problems.length };
}
