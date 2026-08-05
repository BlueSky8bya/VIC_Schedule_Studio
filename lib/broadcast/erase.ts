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
//   · 펜·형광펜: 지워진 구간만 빼고 **남은 구간들로 쪼갠다**(가운데를 지우면 두 조각이 된다).
//   · 도형(직선·화살표·사각형·원): 윤곽을 따라 **닿은 만큼만** 덜어낸다. 남은 조각은 같은 굵기의
//     폴리라인(tool:"poly")이 된다 — 사각형 한 귀퉁이를 지웠다고 사각형이 통째로 사라지지 않는다.
//   · 그림(붙여넣기·채우기): 비트맵이라 여기서 못 자른다. 닿은 것만 알려주고, 실제로 지우는 일은
//     캔버스를 가진 패널이 한다(픽셀에 destination-out을 구워 넣고 다시 인코딩).
//
// ⚠ 과잉 삭제 함정(2026-08-05 사용자 지적: "지운 부분 말고 주위까지 지워진다"):
// 획은 포인터가 움직인 만큼만 점을 남긴다 — 빠르게 그으면 점 간격이 20~60px다. 점 하나를
// 통째로 버리면 **양옆 구간이 다 사라진다**(작은 지우개로 톡 쳤는데 100px가 없어진다).
// 그래서 지우개 근처 구간만 REFINE_STEP 간격으로 잘게 나눈 뒤 판정한다 — 지워지는 길이가
// 지우개 지름에 비례하게 된다. 먼 구간은 원래 점을 그대로 둔다(데이터가 붇지 않게).

export type EraserPath = {
  points: StrokePoint[];
  /** 지우개 획의 굵기(지름, CSS px). 반지름 = width/2. */
  width: number;
};

/** 지우개 근처를 다시 샘플링하는 간격(CSS px). 작을수록 잘림이 정확하고 점이 늘어난다. */
export const REFINE_STEP = 1.5;
/** 도형에서 잘라낸 조각이 갖는 필압값 — 펜 폭 공식(0.45+p*0.85)이 정확히 1이 되는 값(균일 굵기). */
export const UNIFORM_P = (1 - 0.45) / 0.85;

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

type Rect = { left: number; top: number; right: number; bottom: number };

/** 지우개가 닿을 수 있는 최대 범위(반지름 포함). 먼 구간을 값싸게 걸러내는 데 쓴다. */
function eraserBounds(er: EraserPath, extra: number): Rect | null {
  if (er.points.length === 0) return null;
  const r = er.width / 2 + extra;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const p of er.points) {
    if (p.x < left) left = p.x;
    if (p.x > right) right = p.x;
    if (p.y < top) top = p.y;
    if (p.y > bottom) bottom = p.y;
  }
  return { left: left - r, top: top - r, right: right + r, bottom: bottom + r };
}

function segmentNear(a: StrokePoint, b: StrokePoint, box: Rect): boolean {
  return !(
    Math.max(a.x, b.x) < box.left ||
    Math.min(a.x, b.x) > box.right ||
    Math.max(a.y, b.y) < box.top ||
    Math.min(a.y, b.y) > box.bottom
  );
}

function lerpPoint(a: StrokePoint, b: StrokePoint, t: number): StrokePoint {
  const out: StrokePoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  if (a.p !== undefined || b.p !== undefined) {
    out.p = (a.p ?? 0.7) + ((b.p ?? 0.7) - (a.p ?? 0.7)) * t;
  }
  return out;
}

/**
 * 지우개 근처 구간만 잘게 나눈 점열. 먼 구간은 원래 점 그대로 — 긴 낙서 하나를 지웠다고
 * 점 개수가 수천 개로 부는 일이 없다.
 */
export function refineNearEraser(
  points: readonly StrokePoint[],
  er: EraserPath,
  extra: number,
  step: number = REFINE_STEP
): StrokePoint[] {
  const box = eraserBounds(er, extra);
  if (!box || points.length === 0) return [...points];
  const out: StrokePoint[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= step || !segmentNear(a, b, box)) {
      out.push(b);
      continue;
    }
    const n = Math.ceil(len / step);
    for (let k = 1; k < n; k += 1) out.push(lerpPoint(a, b, k / n));
    out.push(b);
  }
  return out;
}

/** 점열을 일정 간격으로 촘촘히 편다(가로지르는 획 판정용 — 끝점만 보면 통과선을 놓친다). */
export function densify(points: readonly StrokePoint[], step = 2): StrokePoint[] {
  if (points.length <= 1) return [...points];
  const out: StrokePoint[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k += 1) out.push(lerpPoint(a, b, k / n));
  }
  return out;
}

/** 남은 구간(run)들로 쪼갠다. closed=true면 시작·끝이 이어져 있어 첫/마지막 run을 하나로 잇는다. */
function splitRuns(
  points: readonly StrokePoint[],
  er: EraserPath,
  extra: number,
  closed: boolean
): { runs: StrokePoint[][]; hit: boolean } {
  const runs: StrokePoint[][] = [];
  let cur: StrokePoint[] = [];
  let hit = false;
  for (const p of points) {
    if (pointErased(p, er, extra)) {
      hit = true;
      if (cur.length > 0) runs.push(cur);
      cur = [];
      continue;
    }
    cur.push(p);
  }
  if (cur.length > 0) runs.push(cur);
  // 닫힌 윤곽(사각형·원)에서 한 곳만 지우면 조각은 하나여야 한다 — 시작점에서 끊긴 것처럼
  // 두 조각으로 두면 이어져 있던 모서리가 괜히 갈라져 보인다.
  if (closed && hit && runs.length >= 2) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    const startAlive = first[0] === points[0];
    const endAlive = last[last.length - 1] === points[points.length - 1];
    if (startAlive && endAlive) {
      runs.pop();
      runs[0] = [...last, ...first.slice(1)];
    }
  }
  return { runs, hit };
}

/** 거의 일직선인 점을 걷어낸다(도형 윤곽 샘플이 수백 점씩 쌓이지 않게). */
function simplify(points: StrokePoint[], tol = 0.15): StrokePoint[] {
  if (points.length <= 2) return points;
  const out: StrokePoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = out[out.length - 1];
    const next = points[i + 1];
    if (distToSegment(points[i], prev, next) > tol) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** 도형의 렌더 기하를 폴리라인으로 편다(닫힌 윤곽 여부도 함께). 지우개 판정·분할이 이 위에서 돈다. */
export function shapeOutlines(
  stroke: Stroke,
  step = 2
): { points: StrokePoint[]; closed: boolean }[] {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1] ?? a;
  const line = (p: StrokePoint, q: StrokePoint): StrokePoint[] => {
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / step));
    const out: StrokePoint[] = [];
    for (let i = 0; i <= n; i += 1) out.push(lerpPoint(p, q, i / n));
    return out;
  };
  if (stroke.tool === "line") return [{ points: line(a, b), closed: false }];
  if (stroke.tool === "arrow") {
    // 화살촉도 기하다 — 몸통만 보면 촉을 지워도 안 지워진 것처럼 남는다(drawStroke와 같은 값).
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.max(10, stroke.width * 3);
    const wing = (off: number) =>
      line(b, { x: b.x + Math.cos(ang + off) * head, y: b.y + Math.sin(ang + off) * head });
    return [
      { points: line(a, b), closed: false },
      { points: wing((Math.PI * 5) / 6), closed: false },
      { points: wing(-(Math.PI * 5) / 6), closed: false }
    ];
  }
  if (stroke.tool === "rect") {
    const c = [
      { x: a.x, y: a.y },
      { x: b.x, y: a.y },
      { x: b.x, y: b.y },
      { x: a.x, y: b.y }
    ];
    const pts: StrokePoint[] = [];
    for (let i = 0; i < 4; i += 1) {
      const seg = line(c[i], c[(i + 1) % 4]);
      pts.push(...(i === 0 ? seg : seg.slice(1)));
    }
    return [{ points: pts, closed: true }];
  }
  // 원: 렌더와 같은 64분할.
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const SEG = 64;
  const pts: StrokePoint[] = [];
  for (let i = 0; i <= SEG; i += 1) {
    const t = (i / SEG) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return [{ points: pts, closed: true }];
}

/**
 * 획 하나에서 지워진 부분을 덜어낸다. 남는 게 없으면 빈 배열.
 * 펜·형광펜·폴리라인은 남은 점들이 **연속한 구간**끼리 묶여 여러 조각이 된다.
 * 도형은 윤곽을 폴리라인으로 펴서 같은 규칙으로 자른다(닿은 만큼만 사라진다).
 */
export function eraseStroke(stroke: Stroke, er: EraserPath): Stroke[] {
  if (stroke.tool === "eraser") return [stroke]; // 지우개끼리는 안 지운다(어차피 저장 안 함)
  if (stroke.tool === "image") return [stroke]; // 비트맵 — 패널이 픽셀에 구워 넣는다
  if (stroke.tool === "fill") return [stroke]; // 옛 기록(점 하나) — 기하가 없어 자를 수 없다
  const half = stroke.width / 2;

  if (isShapeTool(stroke.tool)) {
    const parts = shapeOutlines(stroke);
    let hitAny = false;
    const pieces: Stroke[] = [];
    for (const part of parts) {
      const refined = refineNearEraser(part.points, er, half);
      const { runs, hit } = splitRuns(refined, er, half, part.closed);
      if (hit) hitAny = true;
      for (const run of runs) {
        if (run.length < 2) continue;
        pieces.push({
          tool: "poly",
          layer: stroke.layer,
          color: stroke.color,
          width: stroke.width,
          points: simplify(run).map((p) => ({ x: p.x, y: p.y, p: UNIFORM_P }))
        });
      }
    }
    if (!hitAny) return [stroke];
    return pieces;
  }

  const refined = refineNearEraser(stroke.points, er, half);
  const { runs, hit } = splitRuns(refined, er, half, false);
  // 하나도 안 지워졌으면 **같은 객체**를 돌려준다 — 새 객체를 만들면 호출부가 "바뀌었다"고 보고
  // 장면 교체·재생·히스토리 항목이 매번 생긴다(테스트가 잡은 실제 낭비).
  if (!hit) return [stroke];
  // 점 하나만 남은 조각은 버린다 — 화면에선 점 하나지만, 남겨두면 또 '안 보이는데 잡히는 것'이 된다.
  return runs.filter((r) => r.length >= 2).map((points) => ({ ...stroke, points }));
}

/**
 * 이 획을 **어떻게** 지울지.
 *
 * 벡터로 자르면 획이 '굵기 단위'로 끊긴다 — 가장자리를 살짝 스쳤을 뿐인데 그 구간의 폭 전체가
 * 사라진다. 지우개가 획보다 가늘면(굵은 형광펜에 작은 지우개) 구멍을 뚫고 싶어도 띠 전체가
 * 날아간다. 2026-08-06 사용자 지적: "내가 의도한 대로 못 지운다 — 후처리로 정리되는 것 같다".
 *
 * 그래서 지우개 원이 획의 **폭을 완전히 덮은 적이 있을 때만** 벡터로 자른다(그때는 잘린 결과가
 * 픽셀과 정확히 일치한다 — 남은 조각의 둥근 캡이 여분을 그대로 되메운다).
 * 스치기만 했으면 픽셀 그대로 깎는다("raster") — 그은 대로 남는다.
 *
 *   "none"   — 안 닿았다
 *   "cut"    — 벡터로 자른다(선명함 유지)
 *   "raster" — 픽셀로 깎는다(그은 모양 그대로)
 */
export type EraseVerdict = "none" | "cut" | "raster";

/** 이 획의 판정 표본(펜·형광펜은 점열, 도형은 윤곽). */
function verdictSamples(stroke: Stroke, er: EraserPath, half: number): StrokePoint[] {
  if (isShapeTool(stroke.tool)) return shapeOutlines(stroke).flatMap((p) => p.points);
  return refineNearEraser(stroke.points, er, half);
}

export function eraseVerdict(stroke: Stroke, er: EraserPath): EraseVerdict {
  if (stroke.tool === "eraser" || stroke.tool === "image" || stroke.tool === "fill") return "none";
  const half = stroke.width / 2;
  const r = er.width / 2;
  const full = r - half; // 이 거리 안이면 지우개 원이 획 폭을 통째로 덮는다
  const samples = verdictSamples(stroke, er, half);
  let touchedRun = false;
  let coveredInRun = false;
  let touchedAny = false;
  let grazeOnlyRun = false;
  for (const p of samples) {
    const touched = pointErased(p, er, half);
    if (touched) {
      touchedAny = true;
      touchedRun = true;
      // 반지름 r-half 안 = 지우개 원이 획 폭을 통째로 덮은 자리(pointErased의 반지름은 r+extra).
      if (full >= 0 && pointErased(p, er, -half)) coveredInRun = true;
      continue;
    }
    if (touchedRun && !coveredInRun) grazeOnlyRun = true;
    touchedRun = false;
    coveredInRun = false;
  }
  if (touchedRun && !coveredInRun) grazeOnlyRun = true;
  if (!touchedAny) return "none";
  // 한 구간이라도 '스치기만' 했으면 그 획은 픽셀로 깎는다(부분만 벡터로 자르면 그 자리에서
  // 굵기 단위로 뭉텅 사라진다 — 사용자가 불편해한 바로 그 동작).
  return grazeOnlyRun ? "raster" : "cut";
}

export type EraseResult = {
  next: Stroke[];
  /** 실제로 뭔가 사라졌나(아무것도 안 지웠으면 히스토리에 남기지 않는다). */
  changed: boolean;
  /** 픽셀을 구워야 하는 그림들(패널이 처리) — 참조 동등성으로 next 안의 항목을 가리킨다. */
  images: Stroke[];
  /** 벡터로 자르지 않고 **픽셀 그대로 깎을** 획들(스치듯 지운 경우). 패널이 비트맵으로 굽는다. */
  raster: Stroke[];
};

/** 그림(비트맵) 하나가 지우개에 실제로 닿았는지 판정하는 함수. 패널이 알파 마스크로 답한다. */
export type ImageEraseTest = (stroke: Stroke, er: EraserPath) => boolean;

/** 그림 사각형이 지우개 자국과 겹치나(마스크가 없을 때의 대략 판정 — 상자 기준). */
export function imageHit(stroke: Stroke, er: EraserPath): boolean {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1] ?? a;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const r = er.width / 2;
  // 상자를 가로지르는 획도 잡아야 한다 — 끝점만 보면 통과선을 놓친다(테스트가 잡은 실제 구멍).
  return densify(er.points, 2).some(
    (p) => p.x >= left - r && p.x <= right + r && p.y >= top - r && p.y <= bottom + r
  );
}

/** 한 레이어에 지우개 획을 적용해 새 장면을 만든다. 다른 레이어는 손대지 않는다(그림판 문법). */
export function applyErase(
  scene: readonly Stroke[],
  er: EraserPath,
  layer: string,
  imageTest: ImageEraseTest = imageHit
): EraseResult {
  const next: Stroke[] = [];
  const images: Stroke[] = [];
  const raster: Stroke[] = [];
  let changed = false;
  for (const s of scene) {
    if (s.layer !== layer) {
      next.push(s);
      continue;
    }
    if (s.tool === "image") {
      next.push(s);
      // 상자만 보면 **투명한 여백**을 스쳐도 '지웠다'가 된다 — 그림을 다시 인코딩하고
      // 되돌리기 기록까지 생긴다(화면은 그대로인데). 픽셀로 확인한다.
      if (imageTest(s, er)) images.push(s);
      continue;
    }
    // 스치듯 지운 획은 벡터로 자르지 않는다 — 자르면 그 구간의 폭이 통째로 사라진다.
    // 배열에는 그대로 두고 패널이 픽셀을 깎아 비트맵으로 바꾼다(그은 대로 남는다).
    if (eraseVerdict(s, er) === "raster") {
      next.push(s);
      raster.push(s);
      continue;
    }
    const pieces = eraseStroke(s, er);
    if (pieces.length !== 1 || pieces[0] !== s) changed = true;
    next.push(...pieces);
  }
  return { next, changed: changed || images.length > 0 || raster.length > 0, images, raster };
}
