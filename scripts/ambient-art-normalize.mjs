// 계절 배경 아트 정리(2026-09-04) — `public/ambient/art/*.png`를 자리 규격에 맞게 **작게** 만든다.
//   node scripts/ambient-art-normalize.mjs            → 전부
//   node scripts/ambient-art-normalize.mjs tree-oak   → 이름에 'tree-oak'가 들어간 파일만
//   --dry                                              → 쓰지 않고 보고만
// 생성기(gpt-image 등)는 1024 정사각 아래를 못 주지만 화면엔 12~170px로 놓이므로 1024를 저장소에 두면 낭비다(파일당 400~600KB).
// 자리마다 목표 변 = 화면 px의 4배(DPR 2 × 확대 여유), 128~512로 잘라 알파 경계로 트리밍 → 목표 크기(contain) → PNG(팔레트 없이,
// 압축 9). 엔진(art/load.ts)은 어떤 크기든 다시 알파 경계로 맞추므로 정리 전후 화면은 같다. 매니페스트(manifest.ts)를 esbuild로
// 번들해 읽으니 표가 정본이다(자리 목록 중복 없음).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const esbuild = require("esbuild");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "ambient", "art");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const filter = args.find((a) => !a.startsWith("--")) ?? "";

// 매니페스트 → CJS 한 파일(tsconfig paths 해석은 esbuild가 한다).
const out = path.join(root, ".next", "cache", "ambient-art-manifest.cjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(root, "components/shared/ambient/art/manifest.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  logLevel: "silent",
  tsconfig: path.join(root, "tsconfig.json")
});
const { ART_SLOTS, slotFiles } = require(out);

/** 자리의 저장 목표 변(px) — 화면 px 최대의 4배, 128~512. */
export const targetEdge = (slot) => Math.max(128, Math.min(512, Math.ceil((Math.max(slot.px[0], slot.px[1]) * 4) / 64) * 64));

const byFile = new Map();
for (const s of ART_SLOTS) for (const f of slotFiles(s)) byFile.set(f, s);

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png") && f.includes(filter));
if (!files.length) {
  console.log("정리할 PNG 없음:", dir);
  process.exit(0);
}
let before = 0;
let after = 0;
for (const f of files) {
  const slot = byFile.get(f);
  const p = path.join(dir, f);
  const src = fs.readFileSync(p);
  before += src.length;
  if (!slot) {
    console.log(`SKIP ${f} — 매니페스트에 없는 이름(자리 id로 바꿔야 장면이 쓴다)`);
    after += src.length;
    continue;
  }
  const edge = targetEdge(slot);
  const meta = await sharp(src).metadata();
  // 알파 경계 트리밍(PNG 버퍼로) → 목표 상자(contain) → 투명 여백 없이 저장.
  const trimmed = await sharp(src).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  const { width: tw, height: th } = trimmed.info;
  const k = Math.min(1, edge / Math.max(tw, th));
  const w = Math.max(1, Math.round(tw * k));
  const h = Math.max(1, Math.round(th * k));
  // 팔레트 PNG(256색, 디더링) — 셀 셰이딩 그림은 색이 적어 손실이 안 보이고 크기는 1/3~1/4. 회화풍 원본도 128~512px에선 충분하다.
  const outBuf = await sharp(trimmed.data)
    .resize(w, h, { fit: "inside", kernel: "lanczos3" })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 90, effort: 9, dither: 0.6 })
    .toBuffer();
  after += outBuf.length;
  const pct = Math.round((outBuf.length / src.length) * 100);
  console.log(`${dry ? "DRY " : "OK  "}${f}: ${meta.width}×${meta.height} ${Math.round(src.length / 1024)}KB → ${w}×${h} ${Math.round(outBuf.length / 1024)}KB (${pct}%) [자리 ${slot.id} ${slot.px[0]}×${slot.px[1]} → 목표 ${edge}]`);
  if (!dry && outBuf.length < src.length) fs.writeFileSync(p, outBuf);
}
console.log(`\n합계 ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB${dry ? " (dry — 쓰지 않음)" : ""}`);
