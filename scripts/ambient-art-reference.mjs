// 합격본 레퍼런스 시트(2026-09-09) — **생성기에 첨부할 그림**을 만든다.
//
// 왜 필요한가: 브리프가 "합격본 `tree-pine-1.png`를 열어 보고 맞춰라"라고 쓰는데, 생성기는 그 파일을 **볼 수 없다.**
// 그래서 그 문장은 지시가 아니라 빈칸이었고, 생성기가 빈칸을 제 나름대로 메웠다(3차 납품: 재는 항목 여덟은
// 전부 통과하고, 말로만 적힌 것 둘 — 눈이 앉는 자리와 밑동 모양 — 이 틀렸다).
//
//   node scripts/ambient-art-reference.mjs tree-pine
//   → docs/ambient/reference/<자리>.png  (합격본 나란히 + 요점 확대)
//
// 시트에 넣는 것은 셋뿐이다 — 전체 실루엣 · 밑동 · (겨울이면) 눈이 앉은 자리. 설명이 아니라 **보기**다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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

// 이 자리의 합격본(-1) 전부 — 계절 자리가 있으면 함께 싣는다(같은 한 그루라는 것이 그림으로 보여야 한다).
const slots = [family, `${family}-autumn`, `${family}-winter`].filter((id) => fs.existsSync(path.join(artDir, `${id}-1.png`)));
if (!slots.length) {
  console.error(`${artDir} 에 ${family}-1.png 가 없다.`);
  process.exit(1);
}

const rows = [];
const full = await Promise.all(slots.map((id) => tile(path.join(artDir, `${id}-1.png`), 340)));
rows.push({ label: "합격본 — 이 화풍·이 굵기로", tiles: full });

const trunk = await Promise.all(slots.map((id) => crop(path.join(artDir, `${id}-1.png`), [0.72, 1.0], 300)));
rows.push({ label: "밑동 — 한 덩이로 내려온다(갈래로 벌어지지 않는다)", tiles: trunk });

const winter = slots.find((id) => id.endsWith("-winter"));
if (winter) {
  const snow = [await crop(path.join(artDir, `${winter}-1.png`), [0.1, 0.62], 420)];
  rows.push({ label: "눈 — 단 윗면을 두툼하게 덮는다(윤곽을 흰 선으로 두르지 않는다)", tiles: snow });
}

// 배치
const width = Math.max(...rows.map((r) => r.tiles.reduce((n, t) => n + t.w, 0) + GAP * (r.tiles.length + 1)));
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
