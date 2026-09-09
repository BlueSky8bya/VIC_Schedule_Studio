// 합격본 레퍼런스 시트(2026-09-09) — **생성기에 첨부할 그림**을 만든다.
//
// 합격본을 정수배로 확대한다. 파일을 읽는 에이전트와 이미지 생성기에 참고를 전달하는 단계는 별개다.
//
//   node scripts/ambient-art-reference.mjs tree-pine
//   → docs/ambient/reference/<자리>.png  (합격본 나란히 + 요점 확대)
//
// 시트에 넣는 것은 셋뿐이다 — 전체 실루엣 · 밑동 · (겨울이면) 눈이 앉은 자리. 설명이 아니라 **보기**다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { artManifest, familySlots } from "./lib/ambient-art-manifest.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const family = process.argv[2];
if (!family) {
  console.error("자리 이름을 달라 — 예: node scripts/ambient-art-reference.mjs tree-pine");
  process.exit(1);
}

const artDir = path.join(root, "public/ambient/art");
const outDir = path.join(root, "docs/ambient/reference");
fs.mkdirSync(outDir, { recursive: true });

const BG = { r: 223, g: 230, b: 222, alpha: 1 }; // 화면의 땅색에 가깝게 — 흰 바탕은 눈과 외곽선을 못 읽게 만든다
const GAP = 24;

/** 알파 상자로 자르고 **정수배로** 키운다. 비정수배는 nearest여도 도트가 들쭉날쭉해지고, 그러면
 *  참고 시트가 "이렇게 흐릿하게 그려라"를 가르치게 된다 — 우리가 고치려는 바로 그 결함이다. */
async function tile(file, targetH) {
  const t = await sharp(file).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  const k = Math.max(1, Math.round(targetH / t.info.height));
  const w = t.info.width * k, h = t.info.height * k;
  return { buf: await sharp(t.data).resize(w, h, { kernel: "nearest" }).png().toBuffer(), w, h };
}

/** 세로 구간을 잘라 확대 — "여기를 보라"는 말 대신 그 부분만 크게. */
async function crop(file, [a, b], targetW) {
  const t = await sharp(file).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  const top = Math.round(t.info.height * a);
  const hh = Math.max(1, Math.round(t.info.height * (b - a)));
  const c = await sharp(t.data).extract({ left: 0, top, width: t.info.width, height: hh }).png().toBuffer();
  const k = Math.max(1, Math.round(targetW / t.info.width));
  const w = t.info.width * k, h = hh * k;
  return { buf: await sharp(c).resize(w, h, { kernel: "nearest" }).png().toBuffer(), w, h };
}

// Exact manifest names support singletons; paired families are explicit metadata.
const { slotFiles } = artManifest();
const files = familySlots(family).map((slot) => slotFiles(slot).find((file) => fs.existsSync(path.join(artDir, file)))).filter(Boolean);
const slots = files.map((file) => file.replace(/\.png$/, ""));
if (!slots.length) {
  console.error(`${family}: 합격본 없음. 시트를 위조하지 말고 art:pipeline request로 스타일 파일럿을 시작한다.`);
  process.exit(1);
}

const rows = [];
const full = await Promise.all(files.map((file) => tile(path.join(artDir, file), 340)));
rows.push({ label: "합격본 — 이 화풍·이 굵기로", tiles: full });

if (family === "tree-pine") {
  const trunk = await Promise.all(files.map((file) => crop(path.join(artDir, file), [0.72, 1.0], 300)));
  rows.push({ label: "밑동 — 한 덩이로 내려온다(갈래로 벌어지지 않는다)", tiles: trunk });
}

const winter = family === "tree-pine" ? files.find((file) => /^tree-pine-winter-\d+\.png$/.test(file)) : null;
if (winter) {
  const snow = [await crop(path.join(artDir, winter), [0.1, 0.62], 420)];
  rows.push({ label: "눈 — 단 윗면을 두툼하게 덮는다(윤곽을 흰 선으로 두르지 않는다)", tiles: snow });
}

// 배치 — 폭은 그림뿐 아니라 **라벨도** 재서 정한다. 라벨이 잘리면 참고 시트가 지시를 반쯤만 전한다
// (2026-09-09: 겨울 시트의 "…윤곽을 흰 선으로 두르지 않는다"가 오른쪽에서 잘려 있었다).
// 한글은 폭이 글자 크기에 가깝고 공백·괄호는 좁다 — 17px에 글자당 ≈ 15px로 잡으면 넉넉하다.
const labelWidth = (s) => GAP * 2 + Math.round(s.length * 15);
const width = Math.max(
  ...rows.map((r) => r.tiles.reduce((n, t) => n + t.w, 0) + GAP * (r.tiles.length + 1)),
  ...rows.map((r) => labelWidth(r.label)),
);
let y = GAP;
const comp = [];
const svgText = [];
for (const r of rows) {
  const h = Math.max(...r.tiles.map((t) => t.h));
  svgText.push(`<text x="${GAP}" y="${y + 14}" font-family="sans-serif" font-size="17" fill="#2c3a2f">${r.label}</text>`);
  y += 26;
  let x = GAP;
  for (const t of r.tiles) { comp.push({ input: t.buf, left: x, top: y + (h - t.h) }); x += t.w + GAP; }
  y += h + GAP + 8;
}
const height = y;
const labels = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgText.join("")}</svg>`);
const out = path.join(outDir, `${family}.png`);
await sharp({ create: { width, height, channels: 4, background: BG } })
  .composite([...comp, { input: labels, left: 0, top: 0 }])
  .png()
  .toFile(out);
console.log(`${path.relative(root, out)} — ${width}×${height}`);
