import type { Stroke, StrokePoint } from "@/lib/broadcast/stroke-engine";

// 그림(붙여넣기·채우기 조각)은 **상자가 아니라 픽셀**로 판정한다.
//
// 2026-08-05 사용자 지적: "채우기로 채운 색이, 선택 범위에 안 들어갔는데도 같이 선택된다."
// 채우기 결과는 image 항목이고 그 상자는 '바뀐 픽셀 전체'를 감싼다 — 화면 절반을 채우면 상자도
// 화면 절반이다. 상자로 판정하면 그 안 어디를 긁든(투명한 여백이어도) 조각이 통째로 잡힌다.
// 같은 함정이 지우개에도 있다(여백만 스쳐도 그림을 다시 인코딩하고 되돌리기 기록이 생긴다).
//
// 그래서 그림마다 **알파 마스크**(불투명한 자리만 1)를 한 번 만들어 두고, 선택·지우개가 그
// 마스크를 본다. 마스크는 원본 해상도가 아니라 최대 MASK_MAX(장변)로 줄여 만든다 —
// 판정 정확도는 화면 한두 픽셀 수준이면 충분하고, 큰 스크린샷마다 수 MB를 들고 있을 이유가 없다.

/** 마스크 장변 상한(px). 이보다 큰 그림은 줄여서 만든다. */
export const MASK_MAX = 256;
/** 이 알파 이상이면 '칠해진 자리'로 본다(안티에일리어스 가장자리 무시). */
export const ALPHA_MIN = 16;

export type AlphaMask = {
  w: number;
  h: number;
  /** w*h 크기. 각 칸이 그 자리의 최대 알파(0..255). */
  a: Uint8Array;
};

export type Box = { left: number; top: number; right: number; bottom: number };

/** 2점(좌상·우하) 규약의 항목 상자. 뒤집혀 저장돼도 정규화한다. */
export function boxOf(stroke: Stroke): Box {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1] ?? a;
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y)
  };
}

/** 판 좌표 → 마스크 칸 좌표(경계 밖은 잘라낸다). 상자가 0이면 null. */
function toCells(
  box: Box,
  mask: AlphaMask,
  rect: Box
): { x0: number; y0: number; x1: number; y1: number } | null {
  const bw = box.right - box.left;
  const bh = box.bottom - box.top;
  if (bw <= 0 || bh <= 0) return null;
  const x0 = Math.floor(((rect.left - box.left) / bw) * mask.w);
  const x1 = Math.ceil(((rect.right - box.left) / bw) * mask.w) - 1;
  const y0 = Math.floor(((rect.top - box.top) / bh) * mask.h);
  const y1 = Math.ceil(((rect.bottom - box.top) / bh) * mask.h) - 1;
  const cx0 = Math.max(0, x0);
  const cy0 = Math.max(0, y0);
  const cx1 = Math.min(mask.w - 1, x1);
  const cy1 = Math.min(mask.h - 1, y1);
  if (cx1 < cx0 || cy1 < cy0) return null;
  return { x0: cx0, y0: cy0, x1: cx1, y1: cy1 };
}

/** 이 사각형 안에 **칠해진 픽셀**이 하나라도 있나. */
export function maskHitsRect(mask: AlphaMask, box: Box, rect: Box): boolean {
  const c = toCells(box, mask, rect);
  if (!c) return false;
  for (let y = c.y0; y <= c.y1; y += 1) {
    const row = y * mask.w;
    for (let x = c.x0; x <= c.x1; x += 1) {
      if (mask.a[row + x] >= ALPHA_MIN) return true;
    }
  }
  return false;
}

/** 이 사각형 **바깥에** 칠해진 픽셀이 남아 있나(= 잘라낼 의미가 있나). */
export function maskPaintedOutsideRect(mask: AlphaMask, box: Box, rect: Box): boolean {
  const c = toCells(box, mask, rect);
  for (let y = 0; y < mask.h; y += 1) {
    const row = y * mask.w;
    const inRow = c !== null && y >= c.y0 && y <= c.y1;
    for (let x = 0; x < mask.w; x += 1) {
      if (inRow && c !== null && x >= c.x0 && x <= c.x1) {
        x = c.x1; // 안쪽 칸은 건너뛴다
        continue;
      }
      if (mask.a[row + x] >= ALPHA_MIN) return true;
    }
  }
  return false;
}

/** 지우개 자국(굵은 선)이 **칠해진 픽셀**을 실제로 덮나. */
export function maskHitsEraser(
  mask: AlphaMask,
  box: Box,
  er: { points: readonly StrokePoint[]; width: number }
): boolean {
  if (er.points.length === 0) return false;
  const r = er.width / 2;
  // 지우개 획을 촘촘히 편 뒤, 각 점의 반지름 사각형만 훑는다(원 판정까지 갈 필요 없다 —
  // 한 칸 차이는 그림 한두 픽셀이고, 여기서 원하는 건 '여백만 스쳤나'를 가리는 일이다).
  const pts: StrokePoint[] = [er.points[0]];
  for (let i = 1; i < er.points.length; i += 1) {
    const a = er.points[i - 1];
    const b = er.points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, r)));
    for (let k = 1; k <= n; k += 1) {
      pts.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  for (const p of pts) {
    if (
      maskHitsRect(mask, box, { left: p.x - r, top: p.y - r, right: p.x + r, bottom: p.y + r })
    ) {
      return true;
    }
  }
  return false;
}

/** 이미지 픽셀(RGBA) → 알파 마스크. 줄일 때는 **칸 안의 최댓값**을 쓴다(가는 선이 사라지지 않게). */
export function maskFromRgba(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  max = MASK_MAX
): AlphaMask {
  const k = Math.min(1, max / Math.max(1, Math.max(w, h)));
  const mw = Math.max(1, Math.round(w * k));
  const mh = Math.max(1, Math.round(h * k));
  const a = new Uint8Array(mw * mh);
  for (let y = 0; y < h; y += 1) {
    const my = Math.min(mh - 1, Math.floor((y * mh) / h));
    for (let x = 0; x < w; x += 1) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha === 0) continue;
      const mx = Math.min(mw - 1, Math.floor((x * mw) / w));
      const i = my * mw + mx;
      if (alpha > a[i]) a[i] = alpha;
    }
  }
  return { w: mw, h: mh, a };
}
