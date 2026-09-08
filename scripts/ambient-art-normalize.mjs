// 계절 배경 아트 정리(2026-09-04) — `public/ambient/art/*.png`를 자리 규격에 맞게 **작게** 만든다.
//   node scripts/ambient-art-normalize.mjs            → 전부
//   node scripts/ambient-art-normalize.mjs tree-oak   → 이름에 'tree-oak'가 들어간 파일만
//   --dry                                              → 쓰지 않고 보고만
//   --force                                            → 이미 정리된 파일도 다시 처리
// 생성기(gpt-image 등)는 1024 정사각 아래를 못 주지만 화면엔 12~170px로 놓이므로 1024를 저장소에 두면 낭비다(파일당 400~600KB).
//
// **2026-09-07 개정(결정 ⓐ′)** — 도트를 죽이지 않는 축소로 바꿨다.
//  · 목표 변은 **1024의 정수 약수**(128·256·512)만 쓴다(`manifest.targetEdge`).
//  · 알파 트림 뒤 상자를 **도트 블록 배수**로 되붙이고(`manifest.dotBlock`), **2의 거듭제곱 배로만** 줄인다.
//  · 커널은 `nearest`, 팔레트 디더는 0. 옛 `lanczos3`·디더 0.6은 도트를 평균 내 없앴다(실측 색 76 → 3,723 · 도트 2.75px → 1.10px).
// 엔진(art/load.ts)은 어떤 크기든 다시 알파 경계로 맞추므로 정리 전후 화면 배치는 같다. 매니페스트(manifest.ts)를 esbuild로
// 번들해 읽으니 표가 정본이다(자리 목록·목표 변·블록 크기 중복 없음).
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
const force = args.includes("--force");
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
// 목표 변·격자는 **매니페스트가 정본**이다(보드·프롬프트·이 스크립트가 같은 수를 써야 한다).
const { ART_SLOTS, slotFiles, targetEdge, dotBlock, SOURCE_EDGE } = require(out);


/** **떠 있는 가로줄** 검사(2026-09-07) — 생성물에 이따금 바닥선·그림자 막대가 섞여 들어온다. 소유자가 참나무에서
 *  "줄기 중간에 가로로 이상한 선"으로 발견했고(봄·겨울 두 장), 규격서의 "바닥·그림자·풍경 없음"을 어긴 것이다.
 *  판정: 그 픽셀이 불투명인데 **위로 g px, 아래로 g px가 모두 투명**이면 '떠 있는' 픽셀 — 물체의 일부가 아니라 선이다.
 *  그런 픽셀이 한 행에서 폭의 25% 이상 이어지면 선으로 본다. 소나무의 맨 아래 단처럼 정상적으로 넓은 곳은 위에 몸이
 *  있으므로 걸리지 않는다(실측: 참나무 봄 26% · 겨울 30% 대 소나무·여름·가을 5~7%). */
async function floatingBar(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * C + 3]);
  const g = Math.max(4, Math.round(H * 0.03));
  let best = { y: -1, run: 0 };
  for (let y = 0; y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      run = a(x, y) > 8 && a(x, y - g) <= 8 && a(x, y + g) <= 8 ? run + 1 : 0;
      if (run > best.run) best = { y, run };
    }
  }
  return { ...best, ratio: best.run / W };
}

const byFile = new Map();
for (const s of ART_SLOTS) for (const f of slotFiles(s)) byFile.set(f, s);

const bars = [];
const thin = [];
// **들어온 원본을 보관한다**(2026-09-08). 이 스크립트는 배달본을 제자리에서 줄여 덮어쓰므로, 한 번 돌리고 나면
// 1024 원본이 세상에서 사라진다 — 그런데 코드 곳곳의 안내는 "도트를 되살리려면 1024 원본에서 다시 뽑아야 한다"고 말한다.
// 있지도 않은 것을 가리키던 셈이다. (2026-09-08에 실제로 배달본을 잃었다: 정규화 뒤 `git checkout`으로 폴더를
// 되돌리자 방금 받은 네 장이 커밋된 옛 판으로 덮여 사라졌다. 추적하지 않는 폴더에 사본이 있었으면 아무 일도 아니었다.)
const srcDir = path.join(root, ".scratch-pw", "art-src");
const keepSource = (file, buf) => {
  try {
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, file), buf);
  } catch {
    // 보관 실패는 정리를 막지 않는다(스크래치 폴더가 없는 환경도 있다).
  }
};
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
  const edge = targetEdge(slot.px);
  const block = dotBlock(slot.px, slot.grid);
  const meta = await sharp(src).metadata();
  // **자리를 못 채우나** 검사(2026-09-08) — 엔진은 그림을 자리 상자에 비율을 지켜 넣으므로, 납작한 자리에 정사각으로
  // 그려 오면 세로에 걸려 폭이 안 찬다. 기계로 안 재면 못 잡는다: 파일만 보면 멀쩡하고 화면에서만 점이 된다
  // (실측 2026-09-08: 새털구름 260×40 자리에 1.2:1로 그려 와 47×40 = 18%).
  {
    const t = await sharp(src).ensureAlpha().trim({ threshold: 8 }).toBuffer({ resolveWithObject: true });
    const [bw0, bh0] = slot.px;
    const k = Math.min(bw0 / t.info.width, bh0 / t.info.height);
    const fill = Math.round(((t.info.width * k * (t.info.height * k)) / (bw0 * bh0)) * 100);
    if (fill < 45) {
      thin.push(
        `${f} — 자리 ${bw0}×${bh0}(${(bw0 / bh0).toFixed(1)}:1)에 그림 ${(t.info.width / t.info.height).toFixed(2)}:1 → 화면 ${Math.round(t.info.width * k)}×${Math.round(t.info.height * k)} = ${fill}%`
      );
    }
  }
  const bar = await floatingBar(src);
  if (bar.ratio >= 0.25) {
    bars.push(`${f} — y=${bar.y}에서 ${bar.run}px(폭의 ${Math.round(bar.ratio * 100)}%)`);
  }
  // 이미 정리된 파일(팔레트 PNG = IHDR colorType 3 ∧ 목표 크기 이하)은 건너뛴다 — 다시 돌릴 때마다 재양자화되어 색이 조금씩 상한다.
  // `--force`로 무시할 수 있지만, **lanczos3 시절에 줄여 둔 파일은 다시 돌려도 도트가 돌아오지 않는다**(정보가 이미 없다) —
  // 그런 파일은 1024 원본에서 다시 뽑아야 한다.
  if (!force && src.slice(25, 26)[0] === 3 && Math.max(meta.width ?? 0, meta.height ?? 0) <= edge) {
    const old = Math.max(meta.width ?? 0, meta.height ?? 0) % block !== 0;
    console.log(
      `SKIP ${f}: ${meta.width}×${meta.height} ${Math.round(src.length / 1024)}KB — 이미 정리됨(팔레트 PNG · 목표 ${edge} 이하)${old ? ` ⚠ 변이 블록 ${block}px의 배수가 아니다 = 옛 규격(lanczos3). 도트를 되살리려면 1024 원본에서 다시 뽑아야 한다` : ""}`
    );
    after += src.length;
    continue;
  }
  // 알파 경계 트리밍(PNG 버퍼로) → **도트 블록 배수로 되붙임** → 정수배 축소 → 투명 여백 없이 저장.
  // 트림한 크기를 그대로 줄이면 축소비가 반드시 비정수가 되어(예: 941 → 512) 도트가 들쭉날쭉 잘린다. 블록 배수로 맞춰야
  // `원본 ÷ n` 꼴이 유지된다(2026-09-07 결정 ⓐ′).
  const trimmed = await sharp(src).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  const snapTo = (v, unit) => Math.min(SOURCE_EDGE, Math.max(unit, Math.ceil(v / unit) * unit));
  // 축소비 n은 **2의 거듭제곱** — 목표 변 이하로 줄이는 가장 작은 값. 3 같은 값을 쓰면 블록(16·32…)이 n으로 안 나눠떨어져
  // 축소본의 도트가 다시 들쭉날쭉해진다.
  // ⚠ 원본 상자를 `block` 배수로만 맞추면 **저장본은 블록 배수가 아니다**(예: 696/2 = 348, 블록 8의 배수가 아니다).
  //   그러면 "변이 블록 배수인가"라는 검사가 멀쩡한 파일을 옛 규격이라고 잘못 신고한다(2026-09-08에 참나무 봄이 그랬다).
  //   상자를 `block × n` 배수로 맞추면 저장본도 블록 배수로 떨어진다. n이 상자 크기에 달렸으니 한 번 더 재어 수렴시킨다.
  let bw = snapTo(trimmed.info.width, block);
  let bh = snapTo(trimmed.info.height, block);
  let n = 1;
  while (Math.max(bw, bh) / n > edge) n *= 2;
  for (let pass = 0; pass < 4; pass++) {
    const unit = Math.min(SOURCE_EDGE, block * n);
    const nw = snapTo(trimmed.info.width, unit);
    const nh = snapTo(trimmed.info.height, unit);
    let nn = 1;
    while (Math.max(nw, nh) / nn > edge) nn *= 2;
    if (nw === bw && nh === bh && nn === n) break;
    bw = nw;
    bh = nh;
    n = nn;
  }
  const w = Math.max(1, Math.round(bw / n));
  const h = Math.max(1, Math.round(bh / n));
  // 팔레트 PNG(색 수가 적어 손실이 안 보이고 크기는 1/3~1/4). **디더링 0** — 도트 그림에 디더를 넣으면 색이 흩뿌려져
  // 우리가 지키려는 블록이 깨진다. 커널도 nearest(lanczos3은 도트를 평균 내 없앤다 — 실측 색 76 → 3,723).
  // sharp는 파이프라인당 resize 한 번만 유효하다 — 여백 붙이기(extend)와 축소(resize)를 두 단계로 나눈다.
  const padL = Math.floor((bw - trimmed.info.width) / 2);
  const padT = Math.floor((bh - trimmed.info.height) / 2);
  const padded = await sharp(trimmed.data)
    .extend({
      left: padL,
      right: bw - trimmed.info.width - padL,
      top: padT,
      bottom: bh - trimmed.info.height - padT,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  const outBuf = await sharp(padded)
    .resize(w, h, { kernel: "nearest" })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100, effort: 9, dither: 0 })
    .toBuffer();
  after += outBuf.length;
  const pct = Math.round((outBuf.length / src.length) * 100);
  console.log(
    `${dry ? "DRY " : "OK  "}${f}: ${meta.width}×${meta.height} ${Math.round(src.length / 1024)}KB → ${w}×${h} ${Math.round(outBuf.length / 1024)}KB (${pct}%) [자리 ${slot.id} ${slot.px[0]}×${slot.px[1]} · 블록 ${block}px · ÷${n} · 목표 ${edge}]`
  );
  // 정수배 축소는 **커질 수도** 있다(팔레트가 아닌 원본이 이미 작았던 경우). 크기와 무관하게 규격을 맞춘 결과를 쓴다.
  if (!dry) {
    keepSource(f, src); // 덮어쓰기 전에 들어온 원본을 .scratch-pw/art-src/ 로
    fs.writeFileSync(p, outBuf);
  }
}
console.log(`\n합계 ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB${dry ? " (dry — 쓰지 않음)" : ""}`);
if (bars.length) {
  console.log(`\n⚠ **떠 있는 가로줄**이 있는 파일 ${bars.length}장 — 물체에 붙어 있지 않은 긴 가로선이다(바닥선·그림자 막대).`);
  for (const b of bars) console.log(`   · ${b}`);
  console.log("   규격서: 배경은 완전 투명, **바닥·그림자·풍경·테두리 없음**. 축소로는 안 없어진다 — 그 자리는 다시 받아야 한다.");
}
if (thin.length) {
  console.log(`
⚠ **자리를 못 채우는 파일** ${thin.length}장 — 그림의 가로세로 비가 자리와 달라 엔진이 비율을 지켜 넣으면 작아진다.`);
  for (const t of thin) console.log(`   · ${t}`);
  console.log("   납작한 자리에는 납작하게 그려야 한다(프롬프트 표의 '화면 크기' 칸에 비가 적혀 있다).");
}
