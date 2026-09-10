// 공통화풍참고 색인 도구.
//
//   node scripts/ambient-style-refs.mjs scan [--source <폴더>] [--sheets <출력폴더>] [--force]
//       미분류·바뀐 그림을 찾아 <출처>/분류대기.json 작업지를 쓴다. --sheets는 분류 에이전트가 볼 대조 시트를 만든다.
//   node scripts/ambient-style-refs.mjs apply <출처 폴더> [--prune]
//       채운 작업지를 색인.json에 합친다. --prune은 지운 그림의 항목을 뺀다.
//   node scripts/ambient-style-refs.mjs check
//       모든 그림이 색인되고 해시가 맞고 목록.md가 최신인지 검사한다(읽기 전용).
//   node scripts/ambient-style-refs.mjs pick <entity-id> [--limit 6] [--json]
//       요청에 붙을 장면을 미리 본다. 실제 첨부는 art:pipeline request가 같은 함수로 한다.
//   node scripts/ambient-style-refs.mjs catalog [--check]
//       목록.md를 다시 굽는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { artManifest, codexEntries, root } from "./lib/ambient-art-manifest.mjs";
import { buildEntities } from "./lib/ambient-art-entities.mjs";
import { applyWorksheet, selectStyleReferences, updateStyleCatalog, writeWorksheets } from "./lib/ambient-style-library.mjs";

const require = createRequire(import.meta.url);
const posix = (value) => value.split(path.sep).join("/");

async function measure(file) {
  const meta = await require("sharp")(file).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
}

/** 12 thumbnails per sheet with a short code; the code→file map lets the classifier name files without long hashes. */
async function buildSheets({ sources, outDir }) {
  const sharp = require("sharp");
  fs.mkdirSync(outDir, { recursive: true });
  const escape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const map = {};
  const CW = 420, CH = 360, COLS = 4, PER = 12, LETTERS = "abcdefghijkl";
  let sheetIndex = 0;
  for (const source of sources) {
    const files = [...source.unindexed, ...source.changed];
    for (let start = 0; start < files.length; start += PER) {
      sheetIndex += 1;
      const chunk = files.slice(start, start + PER);
      const composites = [], labels = [];
      for (const [i, file] of chunk.entries()) {
        const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
        const thumb = await sharp(path.join(source.dir, file)).resize(CW - 16, CH - 40, { fit: "inside" }).png().toBuffer({ resolveWithObject: true });
        composites.push({ input: thumb.data, left: x + 8 + Math.floor((CW - 16 - thumb.info.width) / 2), top: y + 8 });
        const code = `s${String(sheetIndex).padStart(2, "0")}${LETTERS[i]}`;
        map[code] = `${source.name}/${file}`;
        const name = path.basename(file), short = name.length > 34 ? `${name.slice(0, 16)}…${name.slice(-14)}` : name;
        labels.push(`<rect x="${x + 4}" y="${y + CH - 30}" width="${CW - 8}" height="26" fill="#fff" opacity="0.85"/><text x="${x + 8}" y="${y + CH - 12}" font-size="13" font-family="sans-serif" fill="#222">${escape(code)}  ${escape(short)}</text>`);
      }
      const width = COLS * CW, height = Math.ceil(chunk.length / COLS) * CH;
      const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels.join("")}</svg>`);
      await sharp({ create: { width, height, channels: 3, background: "#888" } }).composite([...composites, { input: overlay, left: 0, top: 0 }]).jpeg({ quality: 82 }).toFile(path.join(outDir, `sheet-${String(sheetIndex).padStart(2, "0")}.jpg`));
    }
  }
  fs.writeFileSync(path.join(outDir, "sheet-map.json"), `${JSON.stringify(map, null, 1)}\n`);
  return { sheets: sheetIndex, map: path.join(outDir, "sheet-map.json") };
}

export async function styleMain(args = process.argv.slice(2), { workspaceRoot = root, logger = console } = {}) {
  const [command, ...rest] = args;
  const flag = (name, fallback) => { const i = rest.indexOf(name); return i < 0 ? fallback : rest[i + 1]; };
  const manifest = artManifest();
  if (command === "scan") {
    const result = await writeWorksheets({ workspaceRoot, manifest, measure, sourceName: flag("--source", null), force: rest.includes("--force") });
    for (const item of result.written) logger.log(`작업지 ${item.count}장: ${item.worksheet}`);
    if (!result.written.length) logger.log("미분류 그림 없음.");
    if (rest.includes("--sheets")) {
      const outDir = flag("--sheets", null) ?? path.join(os.tmpdir(), "vic-style-sheets");
      const sheets = await buildSheets({ sources: result.scan.sources.filter((source) => !flag("--source", null) || source.name === flag("--source", null)), outDir });
      logger.log(`대조 시트 ${sheets.sheets}장 → ${outDir} (코드→파일: ${sheets.map})`);
    }
    return 0;
  }
  if (command === "apply") {
    const sourceName = rest.find((arg) => !arg.startsWith("--"));
    if (!sourceName) throw new Error("apply <출처 폴더> [--prune]");
    const result = applyWorksheet({ workspaceRoot, manifest, sourceName, prune: rest.includes("--prune") });
    if (!result.ok) { logger.error("문제:"); for (const problem of result.problems) logger.error(`  · ${problem}`); return 1; }
    logger.log(`색인 갱신 — 합침 ${result.applied}장, 제거 ${result.pruned}장, 현재 ${result.total}장.`);
    const catalog = updateStyleCatalog({ workspaceRoot, manifest });
    if (!catalog.written) { logger.error("목록을 굽지 못했다:"); for (const problem of catalog.scan.validation) logger.error(`  · ${problem}`); return 1; }
    logger.log(`목록.md 다시 구웠다.${catalog.scan.pending.length ? ` 다른 출처에 아직 미분류 ${catalog.scan.pending.length}건 — style:check로 확인.` : ""}`);
    return 0;
  }
  if (command === "check") {
    const result = updateStyleCatalog({ workspaceRoot, manifest, check: true });
    if (!result.ok) { logger.error("문제:"); for (const problem of result.problems) logger.error(`  · ${problem}`); return 1; }
    logger.log(`공통화풍참고 최신 — 출처 ${result.scan.sources.length}개, 그림 ${result.scan.images}장 전부 색인됨.`);
    return 0;
  }
  if (command === "catalog") {
    const check = rest.includes("--check");
    const result = updateStyleCatalog({ workspaceRoot, manifest, check });
    if (check ? !result.ok : !result.written) { logger.error("문제:"); for (const problem of check ? result.problems : result.scan.validation) logger.error(`  · ${problem}`); return 1; }
    logger.log(check ? "목록.md 최신." : `목록.md 다시 구웠다 — ${posix(path.relative(workspaceRoot, result.file))}${result.scan.pending.length ? ` (미분류 ${result.scan.pending.length}건 남음)` : ""}`);
    return 0;
  }
  if (command === "pick") {
    const entityId = rest.find((arg) => !arg.startsWith("--"));
    const entity = buildEntities(manifest).find((item) => item.id === entityId || item.slotIds.includes(entityId));
    if (!entity) throw new Error(`Unknown art entity: ${entityId ?? "(없음)"}`);
    const picks = selectStyleReferences({ workspaceRoot, manifest, entity, codex: codexEntries(), limit: Number(flag("--limit", 6)) });
    if (rest.includes("--json")) { logger.log(JSON.stringify(picks.map((pick) => { const copy = { ...pick }; delete copy.absolute; return copy; }), null, 2)); return 0; }
    logger.log(`${entity.id} · 화풍 참고 ${picks.length}장`);
    for (const pick of picks) logger.log(`  ${pick.frozenName}  ${String(pick.score).padStart(4)}  ${pick.reason}  ← ${pick.source}/${pick.file}`);
    if (!picks.length) logger.log("  (해당 부류의 색인 항목 없음 — 합격본·엔티티 레퍼런스만 첨부된다)");
    return 0;
  }
  throw new Error("Usage: ambient-style-refs.mjs scan [--source <폴더>] [--sheets [dir]] [--force] | apply <폴더> [--prune] | check | pick <entity-id> [--limit n] [--json] | catalog [--check]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  styleMain().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
