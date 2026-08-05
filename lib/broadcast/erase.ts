import { isShapeTool, type Stroke, type StrokePoint } from "@/lib/broadcast/stroke-engine";

// 지우개 = **실제로 지운다**(2026-08-05 사용자 지적).
//
// 예전 지우개는 캔버스에 destination-out으로 칠하기만 했다. 화면에서는 사라지지만 장면 배열에는
// 그대로 남아서:
//   · 러버밴드 선택이 '보이지 않는 획'을 잡았고,
//   · 그 획을 옮기면 지운 부분이 되살아났다(지우개는 자리에 칠한 것이라 획이 자리를 뜨면 끝난다).
// 즉 "지운 게 아니라 가려둔 것"이었다. 이제 커밋 시점에 장면에서 기하 자체를 덜어낸다.
//
// 규칙:
//   · 펜·형광펜: 지워진 점을 빼고 **남은 구간들로 쪼갠다**(가운데를 지우면 두 조각이 된다).
//   · 도형(직선·화살표·사각형·원): 윤곽에 닿으면 **통째로** 지운다. 반쪽만 래스터로 지우면
//     또다시 '안 보이는데 남아 있는 것'이 생긴다 — 같은 함정을 되풀이하지 않는다.
//   · 그림(붙여넣기·채우기): 비트맵이라 여기서 못 자른다. 닿은 것만 알려주고, 실제로 지우는 일은
//     캔버스를 가진 패널이 한다(픽셀에 destination-out을 구워 넣고 다시 인코딩).

export type EraserPath = {
  points: StrokePoint[];
  /** 지우개 획의 굵기(지름, CSS px). 반지름 = width/2. */
  width: number;
};

/** 점과 선분 사이 거리. */
function distToSegment(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 이 점이 지우개 자국 안에 들어갔나. */
export function pointErased(p: StrokePoint, er: EraserPath, extra = 0): boolean {
  const r = er.width / 2 + extra;
  const pts = er.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= r;
  for (let i = 1; i < pts.length; i += 1) {
    if (distToSegment(p, pts[i - 1], pts[i]) <= r) return true;
  }
  return false;
}

/** 도형 윤곽을 점으로 촘촘히 찍는다(닿았는지 판정용). */
function outlineSamples(stroke: Stroke): StrokePoint[] {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1] ?? a;
  const out: StrokePoint[] = [];
  const lerp = (p: StrokePoint, q: StrokePoint, n: number) => {
    for (let i = 0; i <= n; i += 1) {
      out.push({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n });
    }
  };
  if (stroke.tool === "line" || stroke.tool === "arrow") {
    lerp(a, b, 32);
    return out;
  }
  if (stroke.tool === "rect") {
    const c = [
      { x: a.x, y: a.y },
      { x: b.x, y: a.y },
      { x: b.x, y: b.y },
      { x: a.x, y: b.y }
    ];
    for (let i = 0; i < 4; i += 1) lerp(c[i], c[(i + 1) % 4], 16);
    return out;
  }
  // 원: 중심 + 반지름으로 64분할.
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  for (let i = 0; i < 64; i += 1) {
    const t = (i / 64) * Math.PI * 2;
    out.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return out;
}

/** 지우개 획을 촘촘한 점열로 편다. 끝점만 보면 **가로지르는 획**을 놓친다(획을 쭉 그어 그림을
 *  통과시켜도 두 끝점은 그림 밖일 수 있다 — 테스트가 잡은 실제 구멍). */
function densify(er: EraserPath, step = 2): StrokePoint[] {
  const pts = er.points;
  if (pts.length <= 1) return [...pts];
  const out: StrokePoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k += 1) {
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  return out;
}

/** 그림(이미지) 사각형이 지우개 자국과 겹치나. */
export function imageHit(stroke: Stroke, er: EraserPath): boolean {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1] ?? a;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const r = er.width / 2;
  return densify(er).some(
    (p) => p.x >= left - r && p.x <= right + r && p.y >= top - r && p.y <= bottom + r
  );
}

/**
 * 획 하나에서 지워진 부분을 덜어낸다. 남는 게 없으면 빈 배열.
 * 펜·형광펜은 남은 점들이 **연속한 구간**끼리 묶여 여러 조각이 된다.
 */
export function eraseStroke(stroke: Stroke, er: EraserPath): Stroke[] {
  if (stroke.tool === "eraser") return [stroke]; // 지우개끼리는 안 지운다(어차피 저장 안 함)
  if (stroke.tool === "image") return [stroke]; // 비트맵 — 패널이 픽셀에 구워 넣는다
  if (isShapeTool(stroke.tool)) {
    // 윤곽에 닿으면 통째로 삭제(반쪽 유령을 남기지 않는다).
    const half = stroke.width / 2;
    return outlineSamples(stroke).some((p) => pointErased(p, er, half)) ? [] : [stroke];
  }
  const half = stroke.width / 2;
  const runs: StrokePoint[][] = [];
  let cur: StrokePoint[] = [];
  let hit = false;
  for (const p of stroke.points) {
    if (pointErased(p, er, half)) {
      hit = true;
      if (cur.length > 0) runs.push(cur);
      cur = [];
      continue;
    }
    cur.push(p);
  }
  if (cur.length > 0) runs.push(cur);
  // 하나도 안 지워졌으면 **같은 객체**를 돌려준다 — 새 객체를 만들면 호출부가 "바뀌었다"고 보고
  // 장면 교체·재생·히스토리 항목이 매번 생긴다(테스트가 잡은 실제 낭비).
  if (!hit) return [stroke];
  // 점 하나만 남은 조각은 버린다 — 화면에선 점 하나지만, 남겨두면 또 '안 보이는데 잡히는 것'이 된다.
  return runs.filter((r) => r.length >= 2).map((points) => ({ ...stroke, points }));
}

export type EraseResult = {
  next: Stroke[];
  /** 실제로 뭔가 사라졌나(아무것도 안 지웠으면 히스토리에 남기지 않는다). */
  changed: boolean;
  /** 픽셀을 구워야 하는 그림들(패널이 처리) — 참조 동등성으로 next 안의 항목을 가리킨다. */
  images: Stroke[];
};

/** 한 레이어에 지우개 획을 적용해 새 장면을 만든다. 다른 레이어는 손대지 않는다(그림판 문법). */
export function applyErase(scene: readonly Stroke[], er: EraserPath, layer: string): EraseResult {
  const next: Stroke[] = [];
  const images: Stroke[] = [];
  let changed = false;
  for (const s of scene) {
    if (s.layer !== layer) {
      next.push(s);
      continue;
    }
    if (s.tool === "image") {
      next.push(s);
      if (imageHit(s, er)) images.push(s);
      continue;
    }
    const pieces = eraseStroke(s, er);
    if (pieces.length !== 1 || pieces[0] !== s) changed = true;
    next.push(...pieces);
  }
  return { next, changed: changed || images.length > 0, images };
}
