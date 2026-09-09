import { createRequire } from "node:module";
import { artManifest } from "./ambient-art-manifest.mjs";
const sharp = createRequire(import.meta.url)("sharp");

/** Pure normalization: raw buffers are never overwritten. */
export async function normalizeSource(src, slot) {
  const { targetEdge, dotBlock, SOURCE_EDGE } = artManifest();
  const meta = await sharp(src).metadata();
  if (meta.format !== "png" || meta.width !== SOURCE_EDGE || meta.height !== SOURCE_EDGE || !meta.hasAlpha) throw new Error("Raw delivery must be a 1024 x 1024 transparent PNG");
  const alpha = await sharp(src).ensureAlpha().extractChannel(3).raw().toBuffer();
  if (!alpha.includes(0) || !alpha.includes(255)) throw new Error("Raw delivery needs transparent background and opaque artwork");
  if (alpha.filter((v) => v > 0 && v < 255).length / alpha.length > .01) throw new Error("Raw pixel art has more than 1% semitransparent pixels");
  const edge = targetEdge(slot.px), block = dotBlock(slot.px, slot.grid);
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
  return outBuf;
}
