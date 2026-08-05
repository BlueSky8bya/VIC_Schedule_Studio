// 방송 판서 엔진(B안 M4b, PLAN-20260725-001) — 순수 벡터 stroke 모델. DOM/캔버스 접근 없음
// (렌더는 broadcast-panel이 담당) → vitest로 직접 검증한다.
//
// 설계(G0 D4·D5 합의):
// - ImageData 스냅샷 금지 — stroke '명령'(좌표 목록)만 저장하고, 리사이즈/undo 때마다 재생한다.
//   1920×1080·DPR2·다중 레이어에서 스냅샷 방식은 메모리가 급증한다.
// - 레이어 = 동적 그리기 캔버스 + 배경(날짜 카드 DOM — 캔버스 아님, 메모리 0).
//   지우개는 활성 레이어 한 장에 destination-out으로 적용된다(그림판 레이어 문법).
// - undo는 '이력'만 상한(200) — 상한을 넘긴 오래된 stroke는 화면(장면)에 남되 더 이상 undo
//   대상이 아니게 된다(G0-rr: 화면에서 삭제 금지).
// - stroke point 단순화: 마지막 점에서 MIN_POINT_DIST(px) 미만 이동은 버린다(장시간 판서 메모리).

export type BroadcastTool =
  | "select"
  | "pen"
  | "hl"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  /** 균일 굵기 폴리라인. 도구 막대에는 없다 — 지우개가 도형(사각형·원·화살표)을 부분적으로
   *  지웠을 때 **남은 윤곽 조각**이 이 모양으로 남는다(귀퉁이만 지웠다고 도형이 통째로
   *  사라지지 않게). 렌더는 형광펜과 같은 균일 굵기 경로, 불투명. */
  | "poly"
  /** 색 채우기(페인트 통). 점 하나만 남기고, 재생할 때 그 자리에서 픽셀을 다시 채운다
   *  — 엔진은 픽셀을 모르므로(DOM 비의존) 실제 채움은 패널이 한다(image와 같은 규약). */
  | "fill"
  /** 붙여넣기·드롭으로 들어온 그림. 도구 막대에는 없다(사용자가 고르는 도구가 아니다).
   *  같은 장면 배열에 살면 z순서·선택·이동/확대·되돌리기·내보내기가 전부 공짜로 따라온다. */
  | "image";

/** 도형 도구 — 시작점·끝점 2점만 의미 있고, 드래그 중엔 끝점만 갱신된다(라이브 프리뷰). */
export function isShapeTool(tool: BroadcastTool): tool is "line" | "arrow" | "rect" | "ellipse" {
  return tool === "line" || tool === "arrow" || tool === "rect" || tool === "ellipse";
}
/** 2점(좌상·우하)으로 사각형을 이루는 항목 — 도형 + 이미지. 선택·교차·확대가 같은 규칙이다. */
export function isBoxItem(tool: BroadcastTool): boolean {
  return isShapeTool(tool) || tool === "image";
}
/** 그리기 레이어 id — 사용자가 ➕로 자유 추가/삭제한다(배경은 DOM이라 여기 없음). */
export type StrokeLayer = string;

export type StrokePoint = {
  x: number;
  y: number;
  /** 굵기 배율 원료 0..1 — 펜 디바이스는 실제 필압, 마우스는 속도 역산(빠르면 가늘게).
   *  없으면 0.7(중립). 펜 도구 렌더에서만 쓰인다(형광펜·지우개·도형은 균일 굵기). */
  p?: number;
};

export type Stroke = {
  tool: Exclude<BroadcastTool, "select">;
  /** tool==="image"일 때만 — data URL. 실제 그리기는 패널이 한다(엔진은 DOM을 모른다). */
  src?: string;
  /** 이 획이 속한 레이어 id — 펜/형광펜/지우개 모두 '활성 레이어'에만 작용(그림판 문법). */
  layer: StrokeLayer;
  color: string;
  width: number;
  points: StrokePoint[];
};

export const UNDO_LIMIT = 200;
export const MIN_POINT_DIST = 2; // CSS px — 이보다 촘촘한 점은 버린다
/** DPR 상한(G0-rr) — 고해상도 화면에서 backing store 폭주 방지. */
export const DPR_CAP = 2;
/**
 * 캔버스 '1장당' backing store 픽셀 상한(≈4K). 기본 단일 캔버스 계산의 상한이며,
 * 동적 레이어 UI는 backingScale의 surfaceCount를 넘겨 아래 전체 예산을 나눠 쓴다.
 */
export const MAX_BACKING_PIXELS = 4096 * 2304;
/** 동적 레이어 전체 backing store 공유 예산 — 캔버스 수가 늘면 각 해상도를 더 낮춘다. */
export const MAX_TOTAL_BACKING_PIXELS = MAX_BACKING_PIXELS * 3;
/** 단일 캔버스의 가독성 하한. 다중 레이어는 총 픽셀 예산을 지키기 위해 이보다 낮아질 수 있다. */
export const MIN_BACKING_SCALE = 0.25;

/** css 크기와 devicePixelRatio로 실제 backing scale을 정한다(DPR cap + 총 픽셀 cap).
 *  CSS 면적 자체가 상한을 넘으면 scale이 1 미만으로도 내려간다(G3b: 5K/8K 보드에서
 *  1로 클램프하면 상한이 깨졌다). 동적 레이어는 임의 개수 제한 대신 해상도를 적응시켜
 *  전체 backing pixel 예산을 지킨다. */
export function backingScale(
  cssW: number,
  cssH: number,
  dpr: number,
  surfaceCount: number = 1
): number {
  const capped = Math.max(MIN_BACKING_SCALE, Math.min(dpr, DPR_CAP));
  const area = cssW * cssH;
  if (area <= 0) return capped;
  const surfaces = Math.max(1, Math.floor(surfaceCount));
  const pixelBudget =
    surfaces === 1 ? MAX_BACKING_PIXELS : MAX_TOTAL_BACKING_PIXELS / surfaces;
  const maxScale = Math.sqrt(pixelBudget / area);
  const budgeted = Math.min(capped, maxScale);
  return surfaces === 1 ? Math.max(MIN_BACKING_SCALE, budgeted) : budgeted;
}

/** 마지막 점과 너무 가까우면 버리는 append. 추가됐으면 true. */
export function appendPoint(points: StrokePoint[], p: StrokePoint): boolean {
  const last = points[points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_POINT_DIST) return false;
  points.push({ ...p });
  return true;
}

export type StrokeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function pointInRect(p: StrokePoint, rect: StrokeRect): boolean {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

/** 선분이 사각 선택 영역과 닿는지. 양 끝점이 모두 밖인 관통선도 잡는다. */
function segmentIntersectsRect(a: StrokePoint, b: StrokePoint, rect: StrokeRect): boolean {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, a.x - rect.left],
    [dx, rect.right - a.x],
    [-dy, a.y - rect.top],
    [dy, rect.bottom - a.y]
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * stroke의 실제 선이 선택 사각형과 닿는지. 도형은 렌더 기하와 같은 윤곽을 검사해,
 * 끝점·모서리가 모두 밖이어도 선택 영역을 관통하면 잡힌다.
 */
export function strokeIntersectsRect(stroke: Stroke, rect: StrokeRect): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (!isShapeTool(stroke.tool)) {
    if (pts.some((p) => pointInRect(p, rect))) return true;
    for (let i = 1; i < pts.length; i += 1) {
      if (segmentIntersectsRect(pts[i - 1], pts[i], rect)) return true;
    }
    return false;
  }

  const a = pts[0];
  const b = pts[pts.length - 1] ?? a;
  if (stroke.tool === "line" || stroke.tool === "arrow") {
    return segmentIntersectsRect(a, b, rect);
  }
  if (stroke.tool === "rect") {
    const corners: StrokePoint[] = [
      { x: a.x, y: a.y },
      { x: b.x, y: a.y },
      { x: b.x, y: b.y },
      { x: a.x, y: b.y },
      { x: a.x, y: a.y }
    ];
    return corners.slice(1).some((p, i) => segmentIntersectsRect(corners[i], p, rect));
  }

  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  let prev: StrokePoint = { x: cx + rx, y: cy };
  for (let i = 1; i <= 64; i += 1) {
    const t = (i / 64) * Math.PI * 2;
    const cur = { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
    if (segmentIntersectsRect(prev, cur, rect)) return true;
    prev = cur;
  }
  return false;
}

export type StrokeStore = {
  /** 장면의 모든 stroke(그려진 순서). 렌더는 이 배열을 레이어별로 재생한다. */
  strokes: () => readonly Stroke[];
  push: (stroke: Stroke) => void;
  undo: () => boolean; // undo 가능했으면 true
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** 카드 이동 등 다른 새 액션이 생겨 redo 미래가 무효가 될 때 획 redo도 함께 폐기. */
  discardRedo: () => void;
  /** 전체 지우기 — 명령이 아니라 상태 초기화(undo 불가). 방송 중 '새 판' 용도. */
  clearAll: () => void;
  /** 레이어 삭제 — 그 레이어의 획을 장면·redo에서 모두 제거(undo 불가, 그림판 문법). */
  removeLayer: (layerId: StrokeLayer) => void;
  /** 장면 통째 교체 — 부분 선택의 획 분할처럼 배열 구조가 바뀌는 편집용.
   *  호출자가 before/after 스냅샷으로 undo를 책임진다(통합 히스토리 scene 액션). */
  setStrokes: (next: readonly Stroke[]) => void;
  /** 닫을 때 메모리 해제(M4c dispose 테스트 대상). */
  dispose: () => void;
};

export function createStrokeStore(undoLimit: number = UNDO_LIMIT): StrokeStore {
  let strokes: Stroke[] = [];
  let redoStack: Stroke[] = [];
  // undoFloor 이전의 stroke는 장면에 남지만 undo 대상이 아니다(이력 상한 — G0-rr).
  let undoFloor = 0;

  return {
    strokes: () => strokes,
    push(stroke) {
      strokes.push(stroke);
      redoStack = []; // 새 입력이 들어오면 redo 미래는 폐기(표준 문법)
      if (strokes.length - undoFloor > undoLimit) {
        undoFloor = strokes.length - undoLimit;
      }
    },
    undo() {
      if (strokes.length <= undoFloor) return false;
      const popped = strokes.pop();
      if (popped) redoStack.push(popped);
      return true;
    },
    redo() {
      const back = redoStack.pop();
      if (!back) return false;
      strokes.push(back);
      return true;
    },
    canUndo: () => strokes.length > undoFloor,
    canRedo: () => redoStack.length > 0,
    discardRedo() {
      redoStack = [];
    },
    clearAll() {
      strokes = [];
      redoStack = [];
      undoFloor = 0;
    },
    removeLayer(layerId) {
      strokes = strokes.filter((s) => s.layer !== layerId);
      redoStack = redoStack.filter((s) => s.layer !== layerId);
      if (undoFloor > strokes.length) undoFloor = strokes.length;
    },
    setStrokes(next) {
      strokes = [...next];
      redoStack = []; // 구조가 바뀐 뒤의 redo 미래는 무효
      if (undoFloor > strokes.length) undoFloor = strokes.length;
    },
    dispose() {
      strokes = [];
      redoStack = [];
      undoFloor = 0;
    }
  };
}

/** 이 stroke가 해당 레이어 캔버스에 그려져야 하는가. */
export function strokeAppliesTo(stroke: Stroke, layer: StrokeLayer): boolean {
  return stroke.layer === layer;
}

// 렌더 도우미 — ctx 타입은 구조적으로만 요구(테스트에서 mock 가능, DOM 의존 없음).
type MinimalCtx = {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  stroke(): void;
  lineCap: string;
  lineJoin: string;
  lineWidth: number;
  // CanvasRenderingContext2D 호환(문자열보다 넓은 타입) — 우리는 항상 string만 쓴다.
  strokeStyle: string | { toString(): string };
  globalCompositeOperation: string;
  globalAlpha: number;
};

/** stroke 하나를 ctx에 그린다(좌표는 CSS px — 호출자가 setTransform으로 scale 적용). */
export function drawStroke(ctx: MinimalCtx, stroke: Stroke): void {
  if (stroke.points.length === 0) return;
  // 이미지는 HTMLImageElement가 필요해 엔진(DOM 비의존)이 그릴 수 없다 — 패널이 캐시로 그린다.
  // 색 채우기도 마찬가지(픽셀 읽기가 필요) — 패널의 재생 루프가 flood-fill로 처리한다.
  if (stroke.tool === "image" || stroke.tool === "fill") return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#000";
  } else {
    ctx.globalCompositeOperation = "source-over";
    // 형광펜: 반투명 + 넓은 획 — 카드 글자를 가리지 않고 강조.
    ctx.globalAlpha = stroke.tool === "hl" ? 0.45 : 1;
    ctx.strokeStyle = stroke.color;
  }
  if (stroke.tool === "pen") {
    // 아이패드 필기 앱 벤치마킹: 중점 이차베지어 곡선 + 조각별 가변 굵기(필압/속도).
    drawPenPath(ctx, stroke);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    return;
  }
  ctx.beginPath();
  if (isShapeTool(stroke.tool)) {
    // 도형: 시작점→끝점 2점으로 기하를 그린다. moveTo/lineTo만 사용(테스트 mock 호환) —
    // 원은 64분할 폴리라인(round join이라 매끈하게 보인다).
    const a = stroke.points[0];
    const b = stroke.points[stroke.points.length - 1] ?? a;
    if (stroke.tool === "line" || stroke.tool === "arrow") {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (stroke.tool === "arrow") {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const head = Math.max(10, stroke.width * 3);
        for (const off of [(Math.PI * 5) / 6, -(Math.PI * 5) / 6]) {
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + Math.cos(ang + off) * head, b.y + Math.sin(ang + off) * head);
        }
      }
    } else if (stroke.tool === "rect") {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(a.x, b.y);
      ctx.lineTo(a.x, a.y);
      // 시작 모서리 이음 마감 — 한 변 더 지나가 round join이 걸리게 한다.
      ctx.lineTo(b.x, a.y);
    } else {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;
      const SEG = 64;
      for (let i = 0; i <= SEG; i += 1) {
        const t = (i / SEG) * Math.PI * 2;
        const x = cx + Math.cos(t) * rx;
        const y = cy + Math.sin(t) * ry;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
  } else if (stroke.tool === "poly") {
    // 도형에서 잘라낸 윤곽 조각 — **곧은 폴리라인 그대로** 그린다.
    // 중점 이차베지어로 부드럽게 하면 직각 모서리가 크게 깎여, 사각형 한가운데를 지웠을 뿐인데
    // 네 귀퉁이가 30px씩 사라진 것처럼 보였다(실측). 손으로 그은 획이 아니라 기하다.
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) {
      ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
    } else {
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    }
  } else {
    // 형광펜·지우개 — 굵기는 균일, 경로는 중점 이차베지어로 부드럽게.
    drawSmoothPath(ctx, stroke.points);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function midOf(a: StrokePoint, b: StrokePoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** 중점 이차베지어 경로(아이패드 필기 앱들의 표준 보간) — 각진 폴리라인을 곡선으로.
 *  각 점을 컨트롤로 쓰고 이웃 중점끼리 잇는다. 호출자가 beginPath/stroke를 감싼다. */
function drawSmoothPath(ctx: MinimalCtx, pts: StrokePoint[]): void {
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 1) {
    ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1); // 점 하나(탭)
    return;
  }
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }
  const m0 = midOf(pts[0], pts[1]);
  ctx.lineTo(m0.x, m0.y);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const m = midOf(pts[i], pts[i + 1]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

/** 펜 증분 렌더(라이브 캔버스용): '확정된' 조각만 그린다 — 임시 직선 꼬리를 안 그려
 *  울퉁불퉁 잔재가 없고, 프레임당 새 조각 몇 개만 그려 긴 낙서에서도 지연이 없다.
 *  done = 지금까지 소화한 진행도(0 = 처음). 반환 = 새 진행도. 스타일은 매번 설정.
 *  잉크가 포인터보다 딱 한 구간 늦게 따라온다(실제 필기 앱들의 잉크 랙과 동일). */
export function drawPenIncremental(ctx: MinimalCtx, stroke: Stroke, done: number): number {
  const pts = stroke.points;
  if (pts.length === 0) return done;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.strokeStyle = stroke.color;
  const wOf = (p: StrokePoint) => stroke.width * (0.45 + (p.p ?? 0.7) * 0.85);
  let d = done;
  if (d === 0) {
    // 시작 도장(탭 점) — 누른 순간 잉크가 바로 보인다.
    ctx.lineWidth = wOf(pts[0]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
    ctx.stroke();
    d = 1;
  }
  for (let j = d; j <= pts.length - 2; j += 1) {
    if (j === 1) {
      // 머리 조각: 시작점 → 첫 중점(첫 내부 조각과 함께 한 번만).
      const m0 = midOf(pts[0], pts[1]);
      ctx.lineWidth = wOf(pts[0]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(m0.x, m0.y);
      ctx.stroke();
    }
    const a = midOf(pts[j - 1], pts[j]);
    const b = midOf(pts[j], pts[j + 1]);
    ctx.lineWidth = wOf(pts[j]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(pts[j].x, pts[j].y, b.x, b.y);
    ctx.stroke();
    d = j + 1;
  }
  ctx.globalAlpha = 1;
  return d;
}

/**
 * 확정 잉크와 분리된 예측 캔버스에만 꼬리를 그린다. 3점 이상이면 증분 렌더가 끝난
 * 마지막 중점부터 시작해 확정 픽셀을 다시 칠하지 않는다. 다음 실제 이벤트에서 전부 폐기된다.
 */
export function drawPenPrediction(
  ctx: MinimalCtx,
  stroke: Stroke,
  predictedPoints: StrokePoint[]
): void {
  const confirmed = stroke.points;
  if (stroke.tool !== "pen" || confirmed.length === 0 || predictedPoints.length === 0) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.strokeStyle = stroke.color;

  // 아직 확정 곡선이 없는 1~2점 구간은 시작점 도장만 존재한다. 전체 초기 꼬리를 그려
  // 펜촉까지 연결하고, 3점부터는 아래의 무중복 중점 경로로 전환한다.
  if (confirmed.length < 3) {
    drawPenPath(ctx, { ...stroke, points: [...confirmed, ...predictedPoints] });
    return;
  }

  const widthOf = (point: StrokePoint) =>
    stroke.width * (0.45 + (point.p ?? 0.7) * 0.85);

  const previous = confirmed[confirmed.length - 2];
  const lastConfirmed = confirmed[confirmed.length - 1];
  let cursor = midOf(previous, lastConfirmed);
  const tail = [lastConfirmed, ...predictedPoints];

  for (let i = 0; i < tail.length - 1; i += 1) {
    const next = midOf(tail[i], tail[i + 1]);
    ctx.lineWidth = widthOf(tail[i]);
    ctx.beginPath();
    ctx.moveTo(cursor.x, cursor.y);
    ctx.quadraticCurveTo(tail[i].x, tail[i].y, next.x, next.y);
    ctx.stroke();
    cursor = next;
  }

  const tip = tail[tail.length - 1];
  ctx.lineWidth = widthOf(tip);
  ctx.beginPath();
  ctx.moveTo(cursor.x, cursor.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** 펜 전용: 조각(중점→중점)마다 lineWidth를 필압/속도 배율로 바꿔 그린다 — 펜촉 감.
 *  조각이 이웃 3점으로만 정의돼(국소성) 증분 렌더 슬라이스와 전체 재생이 같은 기하를 만든다.
 *  round cap 겹침은 불투명 단색이라 보이지 않는다. */
function drawPenPath(ctx: MinimalCtx, stroke: Stroke): void {
  const pts = stroke.points;
  const wOf = (p: StrokePoint) => stroke.width * (0.45 + (p.p ?? 0.7) * 0.85);
  if (pts.length === 1) {
    ctx.lineWidth = wOf(pts[0]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
    ctx.stroke();
    return;
  }
  // 머리 조각: 시작점 → 첫 중점.
  const m0 = midOf(pts[0], pts[1]);
  ctx.lineWidth = wOf(pts[0]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(m0.x, m0.y);
  ctx.stroke();
  // 몸통 조각들: mid(j-1,j) → mid(j,j+1), 컨트롤 = p[j], 굵기 = p[j] 배율.
  for (let j = 1; j < pts.length - 1; j += 1) {
    const a = midOf(pts[j - 1], pts[j]);
    const b = midOf(pts[j], pts[j + 1]);
    ctx.lineWidth = wOf(pts[j]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(pts[j].x, pts[j].y, b.x, b.y);
    ctx.stroke();
  }
  // 꼬리 조각: 마지막 중점 → 끝점.
  const last = pts[pts.length - 1];
  const mL = midOf(pts[pts.length - 2], last);
  ctx.lineWidth = wOf(last);
  ctx.beginPath();
  ctx.moveTo(mL.x, mL.y);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}
