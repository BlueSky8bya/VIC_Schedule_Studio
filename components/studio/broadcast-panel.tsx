"use client";

// 방송 판서 창(B안, PLAN-20260725-001 M4a) — 방송 중 일정을 크게 띄워 설명하는 일회성 도구.
//
// 보안 계약(G2 합의):
// - 이 컴포넌트는 공개 DTO(BroadcastPanelDay[])와 달력 칸 골격(MonthCell)만 props로 받는다.
//   StudioSchedule/StudioScheduleEvent/studio-loader 타입 import 금지(정적 테스트로 고정).
// - 서버 저장 없음. 클립보드·로컬/세션 스토리지·인덱스드DB·URL 어디에도 안 남긴다
//   (broadcast-callsite.test.ts가 소스에서 해당 API 미사용을 정적으로 단언).
//   닫힘 = unmount = 전체 소멸(dispose).
//
// UX 계약(M4a):
// - 같은 창 전체화면 '불투명' 모달 — 뒤에 비공개 화면이 비치지 않는다(방송 화면 공유 안전).
// - role="dialog" + aria-modal + 포커스 trap + 최초 포커스 + body scroll lock.
//   닫힌 뒤 포커스 복귀는 호출자(진입 버튼) 책임.
// - Esc 우선순위: 날짜 선택이 있으면 선택 해제만(useCellRangeSelect가 처리), 없으면 닫기.
// - 미니 달력에서 떨어진 날짜를 다중선택(드래그·Ctrl·Shift) → "판서판으로 보내기" →
//   아래 판서판에 날짜순으로 나란히. 기존 일정 Ctrl+C/V와 무관한 명시 버튼 액션.

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlignCenterHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronLeft,
  ChevronRight,
  Circle,
  Crop,
  Eraser,
  Pipette,
  Eye,
  EyeOff,
  GripVertical,
  Highlighter,
  Keyboard,
  MousePointer2,
  MoveUpRight,
  PaintBucket,
  Pen,
  Redo2,
  Slash,
  Square,
  Trash2,
  Undo2,
  X
} from "lucide-react";

import { ColorPickerPopover } from "@/components/tags/color-picker-popover";
import type { BroadcastPanelDay, BroadcastPanelEvent } from "@/lib/schedules/broadcast-dto";
import { getDayMark } from "@/lib/calendar/holidays";
import type { MonthCell } from "@/lib/calendar/month";
import { getTodayKst, splitEventTitle } from "@/lib/calendar/month";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { hapticTick } from "@/lib/ui/haptics";
import { createBroadcastHistory } from "@/lib/broadcast/history";
import {
  isPenContact,
  mapPenPressure,
  resolveStylusCursorAction,
  shouldIgnoreTouchAfterPen,
  smoothPressure,
  stylusCursorDiameter
} from "@/lib/broadcast/inking";
import {
  reorderDrawingLayer,
  reorderDrawingLayerBefore,
  resolveLayerDropBeforeId,
  resolveDrawingLayerAfterRemoval,
  resolveWritableDrawingLayerId,
  shouldEnterScheduleArrangeMode,
  toolAfterEmptyLayerAdded,
  toolAfterInkColorPick,
  toolAfterInkWidthPick
} from "@/lib/broadcast/workflow";
import {
  appendPoint,
  backingScale,
  createStrokeStore,
  drawPenIncremental,
  drawPenPrediction,
  drawStroke,
  isBoxItem,
  isShapeTool,
  strokeIntersectsRect,
  trimSeamEnds,
  strokeAppliesTo,
  type BroadcastTool,
  type Stroke,
  type StrokeLayer,
  type StrokePoint,
  type StrokeStore
} from "@/lib/broadcast/stroke-engine";
import { applyErase, imageHit } from "@/lib/broadcast/erase";
import {
  boxOf,
  MASK_MAX,
  maskFromRgba,
  maskHitsEraser,
  maskHitsRect,
  maskPaintedOutsideRect,
  type AlphaMask
} from "@/lib/broadcast/image-mask";
import { floodFill, parseHexColor } from "@/lib/broadcast/flood-fill";
import { inkContrast } from "@/lib/tags/color-tone";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 판서 팔레트 17색(그림판식 2줄 트레이) + 마지막 칸 '직접 고르기'(네이티브 색상판).
const PEN_COLORS = [
  "#000000",
  "#94a3b8",
  "#c26a2d",
  "#f43f5e",
  "#fb923c",
  "#fbbf24",
  "#facc15",
  "#a3e635",
  "#4ade80",
  "#2dd4bf",
  "#22d3ee",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#e879f9",
  "#f472b6"
];
// 굵기 6단(펜 기준 px) — 형광펜·지우개는 배수로 키운다.
const PEN_WIDTHS = [2, 3, 5, 8, 12, 18];
const TOOL_LABELS: Record<BroadcastTool, string> = {
  select: "선택",
  pen: "펜",
  hl: "형광펜",
  eraser: "지우개",
  fill: "색 채우기",
  // 도구 막대에는 없다(붙여넣기·드롭으로만 생긴다) — 라벨은 안내·접근성용.
  image: "그림",
  // 도구 막대에는 없다 — 도형을 부분적으로 지웠을 때 남는 윤곽 조각.
  poly: "선 조각",
  line: "직선",
  arrow: "화살표",
  rect: "사각형",
  ellipse: "원"
};
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type Props = {
  monthLabel: string; // 예: "2026년 7월"
  cells: MonthCell[]; // 42칸 골격(날짜·요일·이번달 여부) — 일정 데이터는 days에서만
  days: BroadcastPanelDay[]; // 이번 달 전체 공개 DTO(dateKey → 카드)
  sentDateKeys: string[]; // 판서판에 올라간 날짜들(호출자 state)
  onSend: (dateKeys: string[]) => void; // "판서판으로 보내기"(추가·dedup은 호출자)
  onRemoveDay: (dateKey: string) => void; // 판서판에서 날짜 컬럼 빼기
  onRestoreSent: (dateKeys: string[]) => void; // 통합 undo/redo가 날짜 목록을 되돌릴 때
  onMonthNav: (delta: number) => void; // 날짜 고르기 달력 월 이동(±1) — 데이터는 호출자가 갱신
  onClose: () => void;
};

// 선택된 획의 기하 스냅샷(이동/확대 undo용) — 좌표·굵기만.
type StrokeGeom = { points: StrokePoint[]; width: number };

// 통합 히스토리(Ctrl+Z/Y 하나로 전부): 획 · 카드 위치/크기 · 날짜 추가/삭제 · 레이어 생성/삭제 ·
// 선택 획 이동/확대(xform — 카드와 한 제스처면 cols도 같이 담아 Ctrl+Z 1번에 복원).
// 카드 안 칩 자유 배치(translateY) 스냅샷 — 칩 드래그 자체와, 세로 축소가 칩을 밀어 올린
// 변화(cols/xform 제스처에 동반)를 모두 Ctrl+Z 대상으로 만든다.
type ChipDyChange = { before: Map<string, number>; after: Map<string, number> };
type HistAction =
  | { t: "stroke"; stroke: Stroke }
  | { t: "cols"; before: Map<string, ColBox>; after: Map<string, ColBox>; chips?: ChipDyChange | null }
  | { t: "sent"; before: string[]; after: string[]; colsBefore: Map<string, ColBox> }
  | { t: "layers"; before: PanelLayer[]; after: PanelLayer[] }
  | { t: "chips"; before: Map<string, number>; after: Map<string, number> }
  | {
      t: "xform";
      cols: { before: Map<string, ColBox>; after: Map<string, ColBox> } | null;
      strokes: { targets: Stroke[]; before: StrokeGeom[]; after: StrokeGeom[] } | null;
      chips?: ChipDyChange | null;
    }
  // 부분 선택이 획을 분할해 장면 배열 구조가 바뀔 때 — 전/후 장면 스냅샷(얕은 배열 복사).
  | { t: "scene"; before: Stroke[]; after: Stroke[] };

// 판서판 위 날짜 컬럼의 자유 배치 상태(그림판답게 끌어서 이동·크기 조절 — 선택 도구에서만).
// h: 세로 손잡이로 정한 명시 높이(minHeight). 없으면 내용 높이(자동).
type ColBox = { x: number; y: number; w: number; h?: number };
const COL_DEFAULT_W = 220;
const COL_MIN_W = 140;
const COL_MAX_W = 520;
// 그리기 레이어(동적) — '일정'(날짜 카드 DOM)은 고정 기본, 나머지는 ➕로 자유 추가/삭제.
type PanelLayer = { id: string; name: string; vis: boolean };
// '일정' 고정 레이어의 활성 id — 카드 선택/이동은 이 레이어가 활성일 때만.
const BG_LAYER_ID = "__schedule__";

function EventCard({ event }: { event: BroadcastPanelEvent }) {
  if (event.teaser) {
    // 서버가 가린 떡밥 — 공개 화면과 같은 문법: 내용 없이 '가림' 룩만.
    return (
      <div className="bp-card bp-teaser" aria-label="공개 전 일정">
        <strong aria-hidden="true">🔮 ???</strong>
      </div>
    );
  }
  const { main, subs } = splitEventTitle(event.publicTitle);
  // 배경 = 포스터와 같은 fills(콘텐츠 대분류 ≤2) — 2색이면 실제 달력처럼 그라데이션.
  const bg =
    event.fills.length >= 2
      ? `linear-gradient(135deg, ${event.fills[0]} 0 50%, ${event.fills[1]} 50% 100%)`
      : event.fills[0];
  return (
    <div className="bp-card" style={bg ? { background: bg } : undefined}>
      <div className="bp-card-head">
        {event.isTentative ? <span className="bp-tentative">미정</span> : null}
        <strong>{main}</strong>
        {event.dayIndex && event.dayTotal ? (
          <em className="bp-day-badge">
            {event.dayIndex}일차/{event.dayTotal}일
          </em>
        ) : null}
      </div>
      {subs.length > 0 ? (
        <ul className="bp-subs">
          {subs.map((sub, i) => (
            <li key={i}>{sub}</li>
          ))}
        </ul>
      ) : null}
      {event.extraDots.length > 0 ? (
        <span className="bp-dots" aria-hidden="true">
          {event.extraDots.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

export function BroadcastPanel({
  monthLabel,
  cells,
  days,
  sentDateKeys,
  onSend,
  onRemoveDay,
  onRestoreSent,
  onMonthNav,
  onClose
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const sendBtnRef = useRef<HTMLButtonElement | null>(null);
  // (구 접기 토글 → 지금은 월 라벨 span. 보내기 후 포커스 착지점으로만 쓴다.)
  const pickerToggleRef = useRef<HTMLSpanElement | null>(null);
  const scheduleLayerButtonRef = useRef<HTMLButtonElement | null>(null);
  const layerListRef = useRef<HTMLDivElement | null>(null);

  // ── 판서 엔진(M4b): stroke 벡터 스토어 + 레이어별 committed 캔버스 + 라이브 1장 ──
  // 배경(날짜 카드 DOM)과 캔버스는 같은 좌표면(.bp-board-inner)에 있다 — 보드가 가로
  // 스크롤돼도 카드와 판서가 '함께' 움직인다(G3b: 캔버스 고정 시 스크롤에서 좌표 분리).
  // 렌더 전략(G3b 성능): 평상시엔 committed bitmap을 유지하고 —
  //  - 펜·지우개: rAF마다 '새 구간만' committed 캔버스에 증분 렌더(전체 재생 없음)
  //  - 형광펜: 반투명이라 구간 겹침 시 이음매가 진해진다 → 라이브 캔버스에 현재 stroke만
  //    통째로 다시 그리고(싸다), 뗄 때 한 번 committed로 옮긴다
  //  - 전체 재생(replayAll)은 undo/redo/전체 지우기/리사이즈 때만.
  const storeRef = useRef<StrokeStore | null>(null);
  // undo 상한은 아래 통합 히스토리 한 곳에서 관리한다. stroke store는 장면 저장소로만
  // 쓰고 획 undo/redo도 HistAction이 실제 stroke를 들고 직접 장면을 교체한다.
  // scene 편집이 store 내부 redo를 비워도 통합 redo 순서가 끊기지 않는다.
  const store = (storeRef.current ??= createStrokeStore(Number.POSITIVE_INFINITY));
  const boardInnerRef = useRef<HTMLDivElement | null>(null);
  // 동적 레이어 캔버스/썸네일 — 레이어 id → 요소(마운트/언마운트를 ref 콜백이 관리).
  const layerCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const thumbCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawSurfaceRef = useRef<HTMLDivElement | null>(null);
  const stylusCursorRef = useRef<HTMLSpanElement | null>(null);
  const stylusCursorPointerIdRef = useRef<number | null>(null);
  const predictedPointsRef = useRef<StrokePoint[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const drawnIdxRef = useRef(1); // committed 증분 렌더가 소화한 point 수(펜·지우개)
  const activePtrRef = useRef<number | null>(null); // 이 포인터만 stroke를 움직인다(다중 터치 가드)
  const activePointerTypeRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const scaleRef = useRef(1);
  const lastFitRef = useRef({ w: 0, h: 0, scale: 0 });
  const [tool, setTool] = useState<BroadcastTool>("pen");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[2]);
  // '색 직접 고르기' 팝오버 — 네이티브 OS 색상판 대신 태그 편집과 같은 인라인 피커를 재사용
  // (주변과 같은 디자인 언어: 같은 트레이·SV 영역·톤 필터). openedWith = 취소 시 복귀 색.
  const [colorPop, setColorPop] = useState<{
    anchor: DOMRect;
    openedWith: string;
    openedWithTool: BroadcastTool;
    openedWithLayerId: string;
  } | null>(null);
  const colorPopRef = useRef(colorPop);
  colorPopRef.current = colorPop;
  // 레이어 목록(위 = 맨 위 레이어). 배경(날짜 카드 DOM)은 목록 밖 고정 기본 — 표시 토글만.
  const [layers, setLayers] = useState<PanelLayer[]>(() => [
    { id: "layer-1", name: "레이어 1", vis: true }
  ]);
  const [activeLayerId, setActiveLayerId] = useState("layer-1");
  const [layerOrderStatus, setLayerOrderStatus] = useState("");
  const [layerDragUi, setLayerDragUi] = useState<{
    id: string;
    beforeId: string | null | undefined;
    step: number; // 카드 한 칸 높이+간격 — 슬라이드 프리뷰 이동량
  } | null>(null);
  const layerDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetY: number;
    card: HTMLElement;
    trigger: HTMLButtonElement;
    started: boolean;
    beforeId: string | null | undefined;
    step: number;
    slots: Array<{ id: string; midpoint: number }>;
  } | null>(null);
  const layerDragGhostRef = useRef<HTMLElement | null>(null);
  const layerDragClickBlockedRef = useRef(false);
  const layerDragBodySelectRef = useRef<string | null>(null);
  const layerDragScrollRafRef = useRef<number | null>(null);
  const layerDragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const layerDragReleaseGuardRef = useRef<(() => void) | null>(null);
  const pendingLayerRevealRef = useRef<{
    id: string;
    position: "top" | "nearest";
  } | null>(null);
  const activeLayerIdRef = useRef(activeLayerId);
  activeLayerIdRef.current = activeLayerId;
  const lastDrawingLayerIdRef = useRef<string | null>("layer-1");
  const layerSeq = useRef(1);
  const [bgVis, setBgVis] = useState(true);
  const bgVisRef = useRef(bgVis);
  bgVisRef.current = bgVis;
  // '일정' 레이어(맨 아래 고정 — 날짜 카드 DOM)도 활성 대상: 카드 선택/이동/크기는
  // 이 레이어가 활성일 때만 된다(그리기 레이어 활성 중 카드가 딸려 움직이는 혼선 제거).
  // 일정 레이어(날짜 카드)가 스택의 몇 번째인가 — 0이 맨 위. 기본은 맨 아래(판서가 카드 위).
  // 그림 레이어들과 **같은 목록에서 끌어** 아무 자리에나 둘 수 있다(사용자 요청).
  // layers 배열에 섞어 넣지 않고 위치만 따로 든다: 캔버스 생성·재생·삭제 경로가 전부
  // '그림 레이어만' 도는 전제로 쓰여 있어, 거기에 카드용 가짜 항목을 넣으면 사방이 흔들린다.
  const [bgIndex, setBgIndex] = useState(() => 1);
  // 목록·겹침 순서용 합친 스택. 0번이 화면에서 가장 위.
  const stack = useMemo(() => {
    const ids: string[] = layers.map((l) => l.id);
    const at = Math.max(0, Math.min(bgIndex, ids.length));
    ids.splice(at, 0, BG_LAYER_ID);
    return ids;
  }, [layers, bgIndex]);
  // 위에 있을수록 큰 z. DOM 순서(카드가 먼저, 캔버스가 나중)를 무시하고 이 값으로만 정한다.
  const zOf = useCallback(
    (id: string) => {
      const i = stack.indexOf(id);
      return i < 0 ? 0 : stack.length - i;
    },
    [stack]
  );
  const stackRef = useRef<string[]>([]);
  stackRef.current = stack;
  const bgActive = activeLayerId === BG_LAYER_ID;
  const bgActiveRef = useRef(bgActive);
  bgActiveRef.current = bgActive;
  // 활성 레이어가 바뀌면 선택을 전부 해제. 그리기 레이어 A→B에서도 A의 선택 획이 남으면
  // B가 활성인 상태로 A를 이동·삭제할 수 있어 레이어 경계가 깨진다.
  useEffect(() => {
    setStrokeSel([]);
    setColSel(new Set());
  }, [activeLayerId]);
  // 일정 카드 편집 뒤 다시 그리기 도구를 고르면 직전에 쓰던 정상 그림 레이어로 돌아간다.
  // 숨김·잠금 레이어는 기억 후보에서 제외해 자동 전환이 곧바로 막힌 상태가 되지 않게 한다.
  useEffect(() => {
    const active = layers.find(
      (layer) => layer.id === activeLayerId && layer.vis
    );
    if (active) lastDrawingLayerIdRef.current = active.id;
  }, [activeLayerId, layers]);
  // undo/redo 버튼 활성 + 오른쪽 레이어 썸네일 갱신용(스토어는 ref라 리렌더를 직접 못 일으킨다).
  const [strokeVersion, setStrokeVersion] = useState(0);
  // (Ctrl+휠 그림판 줌은 실사용 판정으로 롤백 — 2026-07-31 사용자 결정. 재도입 금지.)
  // 레이어 패널 썸네일(실제 그림판 문법) — 캔버스에서 축소 복사. 배경(날짜 카드 DOM)은
  // DOM 캡처 금지 계약(ADR-0010)이라 아이콘으로만 표시.
  useEffect(() => {
    for (const layer of layers) {
      const src = layerCanvases.current.get(layer.id);
      const thumb = thumbCanvases.current.get(layer.id);
      if (!src || !thumb) continue;
      const ctx = thumb.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, thumb.width, thumb.height);
      if (src.width === 0 || src.height === 0) continue;
      // 전체 그림판을 100%로 축소 렌더(사용자 결정) — 어느 '위치'에 그렸는지가 레이어 구분에
      // 더 중요하다. (획 영역 크롭 방식은 위치 맥락이 사라져 롤백.)
      const s = Math.min(thumb.width / src.width, thumb.height / src.height);
      const dw = src.width * s;
      const dh = src.height * s;
      ctx.drawImage(src, (thumb.width - dw) / 2, (thumb.height - dh) / 2, dw, dh);
    }
  }, [strokeVersion, layers, store]);
  // 전체 지우기 2단계 확인(undo 불가 + 잠긴 레이어 포함이라 오조작 방어, G3b).
  const [clearArmed, setClearArmed] = useState(false);
  const clearArmTimer = useRef<number | null>(null);
  // 날짜 컬럼 자유 배치(위치·폭). 폭 비율만큼 글자도 커진다(컬럼 fontSize %) — '크게 보여주기'.
  const [cols, setCols] = useState<Map<string, ColBox>>(() => new Map());
  // 카드 '안' 일정 칩 세로 자유 배치(사용자 요청) — 늘린 카드의 빈 아래 공간으로 칩을
  // 끌어 내리거나 서로 순서를 바꿔 보이게. key = `${dateKey}:${eventId}`, 값 = translateY(px).
  // 세션 전용(창 닫으면 소멸 — 판서와 같은 수명), 카드 밖으로는 못 나가게 클램프.
  const [chipDy, setChipDy] = useState<Map<string, number>>(() => new Map());
  const chipDyRef = useRef(chipDy);
  chipDyRef.current = chipDy;
  // 두 칩 배치 스냅샷이 같은가 — 제스처가 실제로 칩을 움직였을 때만 히스토리에 남긴다.
  function sameChipDy(a: Map<string, number>, b: Map<string, number>) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (b.get(k) !== v) return false;
    return true;
  }
  const chipDragRef = useRef<{
    key: string;
    pointerId: number;
    startY: number;
    orig: number;
    minDy: number;
    maxDy: number;
    beforeAll: Map<string, number>; // 제스처 시작 시 전체 칩 배치 — Ctrl+Z 스냅샷
  } | null>(null);
  function onChipPointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    dateKey: string,
    eventId: string
  ) {
    if (tool !== "select" || e.button !== 0) return;
    if (!bgActive) setActiveLayerId(BG_LAYER_ID); // 카드 조작 의도 — 일정 레이어로 자동 전환
    e.preventDefault();
    e.stopPropagation(); // 카드(컬럼) 이동 제스처로 새지 않게
    const chip = e.currentTarget;
    const card = chip.closest<HTMLElement>(".bp-day-col");
    if (!card) return;
    const key = `${dateKey}:${eventId}`;
    const orig = chipDy.get(key) ?? 0;
    const chipRect = chip.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const head = card.querySelector(".bp-day-head")?.getBoundingClientRect();
    chip.setPointerCapture(e.pointerId);
    chipDragRef.current = {
      key,
      pointerId: e.pointerId,
      startY: e.clientY,
      orig,
      minDy: orig + ((head?.bottom ?? cardRect.top + 12) + 4 - chipRect.top),
      maxDy: orig + (cardRect.bottom - 10 - chipRect.bottom),
      beforeAll: new Map(chipDyRef.current)
    };
    hapticTick();
  }
  function onChipPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = chipDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dy = Math.min(d.maxDy, Math.max(d.minDy, d.orig + (e.clientY - d.startY)));
    setChipDy((prev) => {
      const snapped = Math.abs(dy) < 3 ? 0 : dy; // 원위치 근처는 자석처럼 딱
      if ((prev.get(d.key) ?? 0) === snapped) return prev;
      const next = new Map(prev);
      if (snapped === 0) next.delete(d.key);
      else next.set(d.key, snapped);
      return next;
    });
  }
  function onChipPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = chipDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    chipDragRef.current = null;
    // 제스처 단위로 히스토리 1건 — 실제로 칩 배치가 바뀌었을 때만(Ctrl+Z로 되돌리기).
    const after = new Map(chipDyRef.current);
    if (!sameChipDy(d.beforeAll, after)) {
      pushHist({ t: "chips", before: d.beforeAll, after });
    }
  }
  // 절대배치 카드의 실제 높이는 부모 크기에 반영되지 않는다. 실측값으로 판서판/캔버스
  // 하단을 늘려 큰 카드의 아래까지 그릴 수 있게 한다.
  const [colHeights, setColHeights] = useState<Map<string, number>>(() => new Map());
  // ── 선택 도구 캔버스 조작(피그마 문법): 다중 선택·그룹 이동·스냅 가이드·정렬 ──
  const [colSel, setColSel] = useState<Set<string>>(() => new Set());
  const colSelRef = useRef(colSel);
  colSelRef.current = colSel;
  const colElsRef = useRef(new Map<string, HTMLElement>()); // 높이 실측용(스냅·정렬·러버밴드)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null
  );
  // 러버밴드로 잡힌 '획'(필기) — store 획 객체 참조. 카드처럼 이동·확대 대상(그림판 선택 문법).
  // 그림판 안 클립보드(Ctrl+C/X/V). 시스템 클립보드에 획 좌표를 담을 형식이 없고, 담아도 다른
  // 앱이 못 읽는다 — 이 패널이 열려 있는 동안의 메모리로 둔다.
  const strokeClipRef = useRef<Stroke[]>([]);
  // 선택 안내(잠깐 떴다 사라짐) — "감쌌는데 아무것도 안 잡힌다"를 수수께끼로 두지 않는다.
  const [selHint, setSelHint] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false); // 파일을 보드 위로 끌고 온 상태(테두리 강조)
  const selHintTimer = useRef<number | null>(null);
  const flashSelHint = (msg: string) => {
    setSelHint(msg);
    if (selHintTimer.current) window.clearTimeout(selHintTimer.current);
    selHintTimer.current = window.setTimeout(() => setSelHint(null), 2200);
  };
  const [strokeSel, setStrokeSel] = useState<Stroke[]>([]);
  const strokeSelRef = useRef(strokeSel);
  strokeSelRef.current = strokeSel;
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const dragColRef = useRef<{
    key: string;
    mode: "move" | "resize" | "resize-x" | "resize-y";
    origH: number; // 세로 손잡이 기준 높이(제스처 시작 시 실측)
    startX: number;
    startY: number;
    orig: ColBox; // resize용(단일)
    origs: Map<string, ColBox>; // move용(선택 그룹 전체의 시작 위치)
    beforeAll: Map<string, ColBox>; // 히스토리용 — 제스처 시작 시점 전체 스냅샷
    moved: boolean;
    startSL: number; // 드래그 시작 시 보드 scrollLeft/Top — 자동 스크롤 보정용
    startST: number;
    maxX: number; // 시작 시점 캔버스 크기 — 드래그로 캔버스가 무한 확장되는 루프 차단
    maxY: number;
    // 직전 프레임에 어느 방향으로 클램프에 걸렸는지 — 그 방향 자동 스크롤을 멈춘다.
    // (카드는 상한에 핀 고정인데 스크롤만 계속 흐르면 포인터가 잡은 지점에서 이탈한다.)
    clamp: { xPos: boolean; xNeg: boolean; yPos: boolean; yNeg: boolean };
    // 선택된 획의 제스처 시작 기하 — 카드와 '한 제스처'로 같이 이동한다(null = 획 없음).
    strokeOrigs: Map<Stroke, StrokeGeom> | null;
    // resize-y 전용: 제스처 시작 시 칩(자유 배치 translateY) 스냅샷 — 카드 아래 변이
    // 칩 경계를 만나면 dy를 같이 밀어 올려 삐져나감/새 겹침 없이 최소(자연 배치)까지
    // 줄어들게 한다. dy0 기준으로 매 프레임 다시 계산 → 같은 제스처에서 도로 늘리면 복원.
    chipSnap?: { key: string; dy0: number; top: number; bottom: number }[] | null;
    // 제스처 시작 시 전체 칩 배치 — 세로 축소가 칩을 밀어 올린 변화도 같은 Ctrl+Z 1번에 복원.
    chipsBefore: Map<string, number>;
  } | null>(null);
  // ── 가장자리 자동 스크롤: 드래그/러버밴드가 보드 끝에 닿으면 스크롤이 따라간다 ──
  const boardScrollRef = useRef<HTMLElement | null>(null);
  const autoRef = useRef<{
    raf: number | null;
    vx: number;
    vy: number;
    kind: "col" | "marquee" | null;
    last: { x: number; y: number };
  }>({ raf: null, vx: 0, vy: 0, kind: null, last: { x: 0, y: 0 } });
  const SNAP = 6; // px — 이 거리 안이면 가장자리/중앙선에 달라붙는다

  // ── 통합 히스토리 — 획/카드 배치/날짜 목록/레이어 전부 한 스택(Ctrl+Z/Y 하나로) ──
  const histRef = useRef(createBroadcastHistory<HistAction>());
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const sentRef = useRef(sentDateKeys);
  sentRef.current = sentDateKeys;
  const hasSentOnceRef = useRef(sentDateKeys.length > 0);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  useLayoutEffect(() => {
    const pending = pendingLayerRevealRef.current;
    const list = layerListRef.current;
    if (!pending || !list) return;
    const card = Array.from(
      list.querySelectorAll<HTMLElement>("[data-layer-id]")
    ).find((candidate) => candidate.dataset.layerId === pending.id);
    pendingLayerRevealRef.current = null;
    if (!card) return;
    if (pending.position === "top") {
      list.scrollTop = 0;
    } else {
      card.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    card
      .querySelector<HTMLButtonElement>(".bp-layer-select")
      ?.focus({ preventScroll: true });
  }, [layers]);
  const pushHist = useCallback((a: HistAction) => {
    histRef.current.push(a);
    setStrokeVersion((v) => v + 1); // undo/redo 버튼 활성 갱신
  }, []);
  // sentDateKeys 변화에 배치 동기화 — 새 날짜는 기본 자리(왼쪽 위부터 한 줄), 빠진 날짜는 제거,
  // 이미 옮겨 둔 컬럼 위치는 유지.
  useEffect(() => {
    setCols((prev) => {
      const next = new Map<string, ColBox>();
      let i = 0;
      for (const key of sentDateKeys) {
        next.set(key, prev.get(key) ?? { x: 16 + i * (COL_DEFAULT_W + 14), y: 16, w: COL_DEFAULT_W });
        i += 1;
      }
      return next;
    });
    // 빠진 날짜는 선택에서도 제거.
    setColSel((prev) => {
      const next = new Set([...prev].filter((k) => sentDateKeys.includes(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [sentDateKeys]);
  function onColPointerDown(
    e: React.PointerEvent<HTMLElement>,
    key: string,
    mode: "move" | "resize" | "resize-x" | "resize-y"
  ) {
    if (tool !== "select") return; // 그리기 도구 중엔 입력면이 위에 있어 어차피 안 옴 — 이중 가드
    // 선택 도구로 카드를 잡으면 '일정' 레이어로 자동 전환하고 그대로 이동/크기 조절을
    // 시작한다 — 다른 레이어에 있다고 카드 조작이 막히는 dead state 제거(레이어를
    // 먼저 고르라는 규율보다, 잡은 의도가 명백한 쪽을 따른다).
    if (!bgActive) setActiveLayerId(BG_LAYER_ID);
    const orig = cols.get(key);
    if (!orig) return;
    e.preventDefault();
    e.stopPropagation();
    // 선택 문법(피그마): Ctrl/Shift+클릭 = 토글, 평클릭 = (선택 밖이면) 단일 선택으로 교체,
    // 이미 선택된 카드를 잡으면 선택 유지한 채 '그룹째' 드래그.
    let effSel = new Set(colSelRef.current);
    if (mode === "move") {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (effSel.has(key)) effSel.delete(key);
        else effSel.add(key);
        setColSel(new Set(effSel));
        if (!effSel.has(key)) return; // 토글로 해제됐으면 드래그 시작 안 함
      } else if (!effSel.has(key)) {
        effSel = new Set([key]);
        setColSel(effSel);
      }
    } else {
      effSel = new Set([key]);
      setColSel(effSel);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const origs = new Map<string, ColBox>();
    for (const k of effSel) {
      const b = cols.get(k);
      if (b) origs.set(k, b);
    }
    dragColRef.current = {
      key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig,
      origH: orig.h ?? colElsRef.current.get(key)?.offsetHeight ?? 300,
      origs,
      beforeAll: new Map(cols),
      moved: false,
      startSL: boardScrollRef.current?.scrollLeft ?? 0,
      startST: boardScrollRef.current?.scrollTop ?? 0,
      // +480: 제스처마다 이만큼은 캔버스를 '의도적으로' 넓힐 수 있다(아래·오른쪽 배치 여유).
      // 자동 스크롤 무한 확장 루프는 이 상한에서 멈춘다 — 더 넓히려면 손을 뗐다 다시 끌면 된다.
      maxX: (boardInnerRef.current?.offsetWidth ?? 4000) + 480,
      maxY: (boardInnerRef.current?.offsetHeight ?? 3000) + 480,
      clamp: { xPos: false, xNeg: false, yPos: false, yNeg: false },
      // 선택된 획도 카드와 함께 움직인다 — 이동 제스처에서만(스냅샷 = undo 기준).
      strokeOrigs:
        mode === "move" && strokeSelRef.current.length > 0
          ? snapshotStrokes(strokeSelRef.current)
          : null,
      // 세로 축소가 칩을 밀어 올릴 수 있게 시작 시점 칩 기하를 실측(offsetTop/Height =
      // transform 무시한 자연 배치 좌표 — 기준으로 삼기 정확하다).
      chipSnap:
        mode === "resize-y"
          ? Array.from(
              colElsRef.current
                .get(key)
                ?.querySelectorAll<HTMLElement>(".bp-chip-wrap") ?? []
            )
              .map((w) => ({
                key: w.dataset.chipKey ?? "",
                dy0: chipDy.get(w.dataset.chipKey ?? "") ?? 0,
                top: w.offsetTop,
                bottom: w.offsetTop + w.offsetHeight
              }))
              // '시각적' 위→아래 순으로 정렬 — dy로 순서를 바꿔 둔 카드(DOM 순서 ≠ 화면
              // 순서)에서도 축소 캐스케이드가 화면상 맨 아래 칩부터 카드 바닥에 걸리게.
              // DOM 순서로 돌면 화면 맨 아래 칩이 바닥 한계를 안 받아 삐져나간다.
              .sort((a, b) => a.top + a.dy0 - (b.top + b.dy0))
          : null,
      chipsBefore: new Map(chipDyRef.current)
    };
  }
  // 선택 획 기하 스냅샷(deep copy) — 이동/확대의 원점이자 undo before.
  function snapshotStrokes(list: Stroke[]): Map<Stroke, StrokeGeom> {
    return new Map(
      list.map((s) => [s, { points: s.points.map((pt) => ({ ...pt })), width: s.width }])
    );
  }
  // 획 이동/확대 적용 후 해당 레이어만 재생 — 제스처 중 매 프레임 호출된다.
  const replayLayerFnRef = useRef<(layer: StrokeLayer) => void>(() => {});
  function repaintStrokeLayers(origs: Map<Stroke, StrokeGeom>) {
    const ids = new Set<string>();
    for (const s of origs.keys()) ids.add(s.layer);
    for (const id of ids) replayLayerFnRef.current(id);
    setStrokeVersion((v) => v + 1); // 선택 박스가 획을 따라오게
  }
  // 자동 스크롤 공용: 가장자리 근접 → 속도 계산 → rAF 루프에서 스크롤 + 드래그 로직 재적용.
  function updateAutoScroll(clientX: number, clientY: number, kind: "col" | "marquee") {
    const a = autoRef.current;
    a.last = { x: clientX, y: clientY };
    a.kind = kind;
    const board = boardScrollRef.current;
    if (!board) return;
    const r = board.getBoundingClientRect();
    const EDGE = 36;
    const MAX = 18;
    a.vx =
      clientX > r.right - EDGE
        ? Math.min(MAX, (clientX - (r.right - EDGE)) / 2 + 2)
        : clientX < r.left + EDGE
          ? -Math.min(MAX, (r.left + EDGE - clientX) / 2 + 2)
          : 0;
    a.vy =
      clientY > r.bottom - EDGE
        ? Math.min(MAX, (clientY - (r.bottom - EDGE)) / 2 + 2)
        : clientY < r.top + EDGE
          ? -Math.min(MAX, (r.top + EDGE - clientY) / 2 + 2)
          : 0;
    // 카드 그룹이 클램프에 걸린 방향으로는 스크롤도 멈춘다 — 카드는 핀 고정인데 스크롤만
    // 계속 흐르면 포인터가 잡은 지점에서 떨어져 나간다(대규모 드래그 괴리감의 원인).
    if (kind === "col") {
      const c = dragColRef.current?.clamp;
      if (c) {
        if ((a.vx > 0 && c.xPos) || (a.vx < 0 && c.xNeg)) a.vx = 0;
        if ((a.vy > 0 && c.yPos) || (a.vy < 0 && c.yNeg)) a.vy = 0;
      }
    }
    if ((a.vx !== 0 || a.vy !== 0) && a.raf === null) {
      const step = () => {
        const aa = autoRef.current;
        const b = boardScrollRef.current;
        if (!b || (aa.vx === 0 && aa.vy === 0) || aa.kind === null) {
          aa.raf = null;
          return;
        }
        b.scrollLeft += aa.vx;
        b.scrollTop += aa.vy;
        // 포인터가 안 움직여도 스크롤만큼 드래그가 이어지게 마지막 좌표로 재적용.
        if (aa.kind === "col") {
          colDragTo(aa.last.x, aa.last.y);
          // 이번 프레임에 클램프에 걸렸으면 그 방향 스크롤 즉시 중단.
          const c = dragColRef.current?.clamp;
          if (c) {
            if ((aa.vx > 0 && c.xPos) || (aa.vx < 0 && c.xNeg)) aa.vx = 0;
            if ((aa.vy > 0 && c.yPos) || (aa.vy < 0 && c.yNeg)) aa.vy = 0;
          }
        } else marqueeTo(aa.last.x, aa.last.y);
        aa.raf = requestAnimationFrame(step);
      };
      a.raf = requestAnimationFrame(step);
    }
  }
  function stopAutoScroll() {
    const a = autoRef.current;
    a.vx = 0;
    a.vy = 0;
    a.kind = null;
    if (a.raf !== null) {
      cancelAnimationFrame(a.raf);
      a.raf = null;
    }
  }
  function colDragTo(clientX: number, clientY: number) {
    const d = dragColRef.current;
    if (!d) return;
    const board = boardScrollRef.current;
    // 스크롤 이동분도 드래그 거리에 포함 — 자동 스크롤 중 카드가 포인터를 계속 따라온다.
    const sdx = (board?.scrollLeft ?? 0) - d.startSL;
    const sdy = (board?.scrollTop ?? 0) - d.startST;
    let dx = clientX - d.startX + sdx;
    let dy = clientY - d.startY + sdy;
    if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
    if (d.mode === "resize" || d.mode === "resize-x") {
      // 모서리(기존 대각)와 오른쪽 변 = 폭(글자도 비례). 명시 높이(h)는 유지.
      setCols((map) => {
        const next = new Map(map);
        next.set(d.key, {
          ...d.orig,
          w: Math.min(COL_MAX_W, Math.max(COL_MIN_W, d.orig.w + dx))
        });
        return next;
      });
      return;
    }
    if (d.mode === "resize-y") {
      // 아래 변 = 높이만(내용은 그대로, 여백이 늘어난다). 내용보다 작게는 안 줄어든다(minHeight).
      const newH = Math.min(1600, Math.max(64, d.origH + dy));
      setCols((map) => {
        const next = new Map(map);
        next.set(d.key, { ...d.orig, h: newH });
        return next;
      });
      // 아래 변이 자유 배치 칩을 만나면 칩 dy를 같이 밀어 올린다 — 칩이 카드 밖으로
      // 삐져나오지 않고, 원래 안 겹치던 칩끼리 새로 겹치지도 않는다(원래 겹침은 사용자
      // 의도이므로 그 겹침 폭만큼은 허용). dy0 기준 재계산 → 도로 늘리면 원위치 복원.
      if (d.chipSnap && d.chipSnap.length > 0) {
        const snap = d.chipSnap; // 시각적 위→아래 순(스냅샷 때 정렬)
        // 최소 상태 = '화면에 보이는 순서' 그대로 위에서부터 빽빽하게 쌓은 배치.
        // 칩별 자연 자리(dy=0)를 바닥으로 삼으면 dy로 순서를 바꿔 둔 카드에서 두 칩이
        // 같은 자연 슬롯으로 수렴해 겹친다 — 바닥은 반드시 시각 순서 기준으로 잡는다.
        const byNat = [...snap].sort((a, b) => a.top - b.top);
        const gap = byNat.length > 1 ? Math.max(0, byNat[1].top - byNat[0].bottom) : 0;
        const packedDy = new Map<string, number>();
        let packedTop = byNat[0].top; // 첫 슬롯의 자연 top(헤더 아래)
        for (const c of snap) {
          packedDy.set(c.key, packedTop - c.top);
          packedTop += c.bottom - c.top + gap;
        }
        const updates = new Map<string, number>();
        let limit = newH - 10; // 칩 시각적 하한(카드 아래 패딩 10px과 동일)
        for (let i = snap.length - 1; i >= 0; i--) {
          const c = snap[i];
          // 바닥 = min(packed 자리, 사용자 dy0) — packed 자리를 무조건 바닥으로 삼으면
          // 자기 packed 슬롯보다 '위'에 놓인 칩(순서 바꿈의 전형)을 아래로 끌어내려
          // 중간에 안 줄어드는 죽은 공백이 생긴다. 사용자가 둔 위치보다 아래로는 안 민다.
          const chipDyNew = Math.max(
            Math.min(c.dy0, limit - c.bottom),
            Math.min(packedDy.get(c.key) ?? 0, c.dy0)
          );
          updates.set(c.key, chipDyNew);
          if (i > 0) {
            // 위 칩의 허용 하한: 이 칩의 새 시각적 top에서 원래 간격(최대 자연 간격 gap)을
            // 뺀 지점 — 0px로 붙여 버리면 packed 바닥(간격 유지)과 어긋나 끝까지 줄여도
            // 배치가 들쭉날쭉해진다. 원래 겹쳐 있던 칩(origGap<0)은 그 겹침만큼 허용.
            const origGap = c.top + c.dy0 - (snap[i - 1].bottom + snap[i - 1].dy0);
            limit = c.top + chipDyNew - Math.min(origGap, gap);
          }
        }
        setChipDy((prev) => {
          let changed = false;
          const next = new Map(prev);
          for (const [k, v] of updates) {
            const snapped = Math.abs(v) < 0.5 ? 0 : Math.round(v);
            if ((next.get(k) ?? 0) === snapped) continue;
            changed = true;
            if (snapped === 0) next.delete(k);
            else next.set(k, snapped);
          }
          return changed ? next : prev;
        });
      }
      return;
    }
    // ── 그룹 이동 + 스냅: 이동 그룹의 bbox 가장자리/중앙선을 나머지 카드들의 선에 붙인다 ──
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [k, b] of d.origs) {
      const h = colElsRef.current.get(k)?.offsetHeight ?? 300;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + h);
    }
    if (d.strokeOrigs) {
      for (const g of d.strokeOrigs.values()) {
        const half = g.width / 2 + 2;
        for (const pt of g.points) {
          minX = Math.min(minX, pt.x - half);
          minY = Math.min(minY, pt.y - half);
          maxX = Math.max(maxX, pt.x + half);
          maxY = Math.max(maxY, pt.y + half);
        }
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;
    const vLines: number[] = [];
    const hLines: number[] = [];
    for (const [k, b] of cols) {
      if (d.origs.has(k)) continue;
      const h = colElsRef.current.get(k)?.offsetHeight ?? 300;
      vLines.push(b.x, b.x + b.w / 2, b.x + b.w);
      hLines.push(b.y, b.y + h / 2, b.y + h);
    }
    const activeV: number[] = [];
    const activeH: number[] = [];
    let bestV: { delta: number; line: number } | null = null;
    for (const line of vLines) {
      for (const edge of [minX + dx, (minX + maxX) / 2 + dx, maxX + dx]) {
        const delta = line - edge;
        if (Math.abs(delta) <= SNAP && (!bestV || Math.abs(delta) < Math.abs(bestV.delta)))
          bestV = { delta, line };
      }
    }
    let bestH: { delta: number; line: number } | null = null;
    for (const line of hLines) {
      for (const edge of [minY + dy, (minY + maxY) / 2 + dy, maxY + dy]) {
        const delta = line - edge;
        if (Math.abs(delta) <= SNAP && (!bestH || Math.abs(delta) < Math.abs(bestH.delta)))
          bestH = { delta, line };
      }
    }
    if (bestV) {
      dx += bestV.delta;
      activeV.push(bestV.line);
    }
    if (bestH) {
      dy += bestH.delta;
      activeH.push(bestH.line);
    }
    setGuides({ v: activeV, h: activeH });
    // 캔버스 확장 상한: 이동 그룹이 (시작 크기 + 480px) 안에 머물게 dx/dy를 그룹 단위로
    // 클램프 — 자동 스크롤 무한 확장 루프 방지. 클램프로 깎인 만큼 기준점(startX/Y)을
    // 옮겨(re-anchor) 포인터가 앞서가도 잡은 지점이 어긋나지 않는다(다시 움직일 때
    // 카드가 확 따라잡는 이질감 제거).
    const rawDx = dx;
    const rawDy = dy;
    dx = Math.min(dx, d.maxX - 8 - maxX);
    dy = Math.min(dy, d.maxY - 8 - maxY);
    dx = Math.max(dx, -minX);
    dy = Math.max(dy, -minY);
    d.clamp = {
      xPos: dx < rawDx,
      xNeg: dx > rawDx,
      yPos: dy < rawDy,
      yNeg: dy > rawDy
    };
    if (dx !== rawDx) d.startX += rawDx - dx;
    if (dy !== rawDy) d.startY += rawDy - dy;
    setCols((map) => {
      const next = new Map(map);
      for (const [k, b] of d.origs) {
        // ...b: 명시 높이(h)까지 그대로 — 이동이 세로 손잡이로 늘린 높이를 지우면 안 된다
        // (높이가 무너지면 칩 자유 배치(translateY)가 카드 밖으로 붕 뜬다).
        next.set(k, { ...b, x: Math.max(0, b.x + dx), y: Math.max(0, b.y + dy) });
      }
      return next;
    });
    // 선택된 획도 같은 (dx,dy)로 — 카드와 필기가 한 덩어리로 움직인다.
    if (d.strokeOrigs) {
      for (const [s, g] of d.strokeOrigs) {
        s.points = g.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy, p: pt.p }));
      }
      repaintStrokeLayers(d.strokeOrigs);
    }
  }
  function onColPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!dragColRef.current) return;
    colDragTo(e.clientX, e.clientY);
    updateAutoScroll(e.clientX, e.clientY, "col");
  }
  function onColPointerUp() {
    const d = dragColRef.current;
    dragColRef.current = null;
    stopAutoScroll();
    setGuides({ v: [], h: [] });
    // 제스처 단위로 히스토리 1건(이동/크기 조절 — 실제로 움직였을 때만).
    // 획이 같이 움직였으면 xform 하나로 묶는다 — Ctrl+Z 1번에 카드+획이 함께 돌아온다.
    if (d?.moved) {
      const colsChange = { before: d.beforeAll, after: new Map(colsRef.current) };
      // 세로 축소가 칩을 밀어 올렸다면(chipSnap 캐스케이드) 그 변화도 같은 액션에 —
      // Ctrl+Z 1번에 카드 높이와 칩 배치가 함께 돌아온다.
      const chipsAfter = new Map(chipDyRef.current);
      const chipsChange = sameChipDy(d.chipsBefore, chipsAfter)
        ? null
        : { before: d.chipsBefore, after: chipsAfter };
      if (d.strokeOrigs && d.strokeOrigs.size > 0) {
        const targets = [...d.strokeOrigs.keys()];
        pushHist({
          t: "xform",
          cols: colsChange,
          strokes: {
            targets,
            before: targets.map((s) => d.strokeOrigs!.get(s)!),
            after: targets.map((s) => ({
              points: s.points.map((pt) => ({ ...pt })),
              width: s.width
            }))
          },
          chips: chipsChange
        });
      } else {
        pushHist({
          t: "cols",
          before: colsChange.before,
          after: colsChange.after,
          chips: chipsChange
        });
      }
    }
  }

  // ── 러버밴드(빈 바닥 드래그로 다중 선택) — 선택 도구에서만 ──
  const marqueeRef = useRef<{
    x1: number;
    y1: number;
    x2: number; // 마지막(클램프된) 끝점 — 놓을 때 부분 선택 사각형 계산용
    y2: number;
    pointerId: number;
    maxX: number; // 시작 시점 캔버스 크기 — 밴드가 이 밖으로 못 나가게(무한 확장 루프 차단)
    maxY: number;
  } | null>(null);
  function innerPointC(clientX: number, clientY: number): { x: number; y: number } | null {
    const inner = boardInnerRef.current;
    if (!inner) return null;
    const r = inner.getBoundingClientRect();
    // inner rect는 보드 스크롤을 반영하므로 자동 스크롤 중에도 inner 좌표가 정확하다.
    return { x: clientX - r.left, y: clientY - r.top };
  }
  function marqueeTo(clientX: number, clientY: number) {
    const m = marqueeRef.current;
    if (!m) return;
    const raw = innerPointC(clientX, clientY);
    if (!raw) return;
    // 클램프 필수: 밴드 사각형(absolute)도 스크롤 영역에 포함돼, 안 막으면
    // 자동 스크롤 → 밴드 확장 → 스크롤 영역 증가 → … 무한 확장 루프가 된다.
    const p = {
      x: Math.min(Math.max(0, raw.x), m.maxX),
      y: Math.min(Math.max(0, raw.y), m.maxY)
    };
    m.x2 = p.x;
    m.y2 = p.y;
    setMarquee({ x1: m.x1, y1: m.y1, x2: p.x, y2: p.y });
    // 라이브 선택: 밴드와 겹치는 카드 전부 — 단 '일정' 레이어가 활성일 때만(레이어 규율).
    const lo = { x: Math.min(m.x1, p.x), y: Math.min(m.y1, p.y) };
    const hi = { x: Math.max(m.x1, p.x), y: Math.max(m.y1, p.y) };
    if (bgActiveRef.current) {
      const next = new Set<string>();
      for (const [k, b] of colsRef.current) {
        const h = colElsRef.current.get(k)?.offsetHeight ?? 300;
        if (b.x < hi.x && b.x + b.w > lo.x && b.y < hi.y && b.y + h > lo.y) next.add(k);
      }
      setColSel(next);
    }
    // 획은 라이브로 선택하지 않는다 — 놓는 순간 '밴드에 걸친 구간만' 잘라 선택(부분 선택).
  }
  // 파일 드롭 — 떨어뜨린 자리에 놓는다(가운데로 보내면 "어디 갔지?"가 된다).
  function onBoardDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dropOver) setDropOver(true);
  }
  function onBoardDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropOver(false);
  }
  function onBoardDrop(e: React.DragEvent<HTMLDivElement>) {
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    setDropOver(false);
    if (!file) return;
    e.preventDefault();
    const p = innerPointC(e.clientX, e.clientY);
    readImageFile(file, p ? { x: Math.round(p.x), y: Math.round(p.y) } : undefined);
  }

  function onBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool !== "select" || e.button !== 0) return;
    // 카드/버튼 위에서 시작하면 러버밴드 아님(카드 자체 핸들러가 처리).
    // 선택 박스(와 그 손잡이) 위에서 시작한 드래그는 '이동/크기 조절'이다 — 여기서 밴드까지
    // 시작하면 선택 상자와 러버밴드가 겹쳐 두 겹으로 보인다(실측).
    // 부분 선택 판 위에서 시작한 드래그는 '영역 오리기'다 — 여기서 러버밴드까지 시작하면
    // 판 전체 선택이 함께 돌아 방금 고른 그림이 풀린다(실측).
    if (
      (e.target as HTMLElement).closest(
        ".bp-day-col, button, .bp-stroke-sel, .bp-region-layer, .bp-region-bar"
      )
    ) {
      return;
    }
    const p = innerPointC(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault(); // 러버밴드 중 브라우저 텍스트 선택(파란 긁힘) 방지
    e.currentTarget.setPointerCapture(e.pointerId);
    const inner = boardInnerRef.current;
    marqueeRef.current = {
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      pointerId: e.pointerId,
      maxX: inner?.offsetWidth ?? 0,
      maxY: inner?.offsetHeight ?? 0
    };
    setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }
  function onBoardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const m = marqueeRef.current;
    if (!m || e.pointerId !== m.pointerId) return;
    marqueeTo(e.clientX, e.clientY);
    updateAutoScroll(e.clientX, e.clientY, "marquee");
  }
  function onBoardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const m = marqueeRef.current;
    if (!m || e.pointerId !== m.pointerId) return;
    const p = innerPointC(e.clientX, e.clientY);
    marqueeRef.current = null;
    setMarquee(null);
    stopAutoScroll();
    // 사실상 클릭(움직임 3px 미만) = 빈 바닥 클릭 → 선택 해제(카드+획).
    if (p && Math.hypot(p.x - m.x1, p.y - m.y1) < 3) {
      setColSel(new Set());
      setStrokeSel([]);
      return;
    }
    // 놓는 순간 부분 선택: 밴드에 '걸친 구간만' 잘라 선택한다(획 통째 X — 그림판 영역 선택).
    splitSelectStrokes(
      { x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2) },
      { x: Math.max(m.x1, m.x2), y: Math.max(m.y1, m.y2) }
    );
  }

  // ── 부분 선택(그림판 영역 선택 의미론): 밴드에 걸친 획을 경계에서 '분할'하고 안쪽
  // 조각만 선택한다. 완전히 안이면 통째, 도형은 부분 개념이 없어 걸치면 통째.
  //
  // 대상은 **활성 레이어**의 획만이다(사용자 결정) — 레이어를 나눈 이유가 '따로 손대기'라,
  // 선택이 레이어를 넘나들면 그 분리가 무의미해진다.
  // 대신 "감쌌는데 아무것도 안 잡힌다"가 수수께끼로 남지 않게, 밴드 안에 **다른 레이어의**
  // 잉크가 있으면 그 사실을 말해 준다(아래 setSelHint).
  function splitSelectStrokes(lo: { x: number; y: number }, hi: { x: number; y: number }) {
    const layerOk = new Map(
      layersRef.current.map((l) => [l.id, l.id === activeLayerIdRef.current && l.vis])
    );
    const inside = (pt: StrokePoint) =>
      pt.x >= lo.x && pt.x <= hi.x && pt.y >= lo.y && pt.y <= hi.y;
    const selectionRect = { left: lo.x, top: lo.y, right: hi.x, bottom: hi.y };
    // 안(a)→밖(b) 세그먼트가 사각형 경계를 지나는 지점(선형 보간) — 잘린 단면이 매끈하게.
    const exitPoint = (a: StrokePoint, b: StrokePoint): StrokePoint => {
      let t = 1;
      if (b.x > hi.x && b.x !== a.x) t = Math.min(t, (hi.x - a.x) / (b.x - a.x));
      if (b.x < lo.x && b.x !== a.x) t = Math.min(t, (lo.x - a.x) / (b.x - a.x));
      if (b.y > hi.y && b.y !== a.y) t = Math.min(t, (hi.y - a.y) / (b.y - a.y));
      if (b.y < lo.y && b.y !== a.y) t = Math.min(t, (lo.y - a.y) / (b.y - a.y));
      t = Math.max(0, Math.min(1, t));
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: a.p !== undefined || b.p !== undefined ? ((a.p ?? 0.7) + (b.p ?? 0.7)) / 2 : undefined
      };
    };
    // 유령 선택 방지: 지우개로 지워져 화면에 없는 획이 잡히면 빈 곳에 선택 박스가 뜬다.
    // 활성 레이어 캔버스의 밴드 영역 픽셀을 한 번 읽어, '실제로 보이는' 점이 있는 획만
    // 선택 대상으로 삼는다(알파 검증).
    // 알파 검증도 **레이어마다** 읽는다(획이 속한 레이어의 캔버스로 확인해야 맞다).
    const scale = scaleRef.current;
    let bandW = 0;
    let bandH = 0;
    const bandByLayer = new Map<string, ImageData | null>();
    for (const l of layersRef.current) {
      if (!l.vis) continue;
      const cv = layerCanvases.current.get(l.id);
      if (!cv) continue;
      const sx = Math.max(0, Math.floor(lo.x * scale));
      const sy = Math.max(0, Math.floor(lo.y * scale));
      const w = Math.min(cv.width - sx, Math.ceil((hi.x - lo.x) * scale) + 2);
      const h = Math.min(cv.height - sy, Math.ceil((hi.y - lo.y) * scale) + 2);
      if (w <= 0 || h <= 0) continue;
      bandW = w;
      bandH = h;
      try {
        bandByLayer.set(l.id, cv.getContext("2d")?.getImageData(sx, sy, w, h) ?? null);
      } catch {
        bandByLayer.set(l.id, null); // 픽셀 접근 실패 시 그 레이어는 검증 생략(선택은 동작)
      }
    }
    const visibleAt = (pt: StrokePoint, layerId: string): boolean => {
      const band = bandByLayer.get(layerId);
      if (!band) return true;
      const px = Math.min(bandW - 1, Math.max(0, Math.round((pt.x - lo.x) * scale)));
      const py = Math.min(bandH - 1, Math.max(0, Math.round((pt.y - lo.y) * scale)));
      return band.data[(py * bandW + px) * 4 + 3] > 24;
    };
    // 안내용 엄격 판정 — 픽셀을 못 읽었으면 '있다'고 말하지 않는다(거짓 안내 방지).
    const layerHasInkStrict = (layerId: string): boolean => {
      const band = bandByLayer.get(layerId);
      if (!band) return false;
      for (let i = 3; i < band.data.length; i += 4) {
        if (band.data[i] > 24) return true;
      }
      return false;
    };
    const layerHasInk = (layerId: string): boolean => {
      const band = bandByLayer.get(layerId);
      if (!band) return true;
      for (let i = 3; i < band.data.length; i += 4) {
        if (band.data[i] > 24) return true;
      }
      return false;
    };
    const before = [...store.strokes()];
    const nextScene: Stroke[] = [];
    const picked: Stroke[] = [];
    let changed = false;
    for (const s of before) {
      if (s.tool === "eraser" || !layerOk.get(s.layer)) {
        nextScene.push(s);
        continue;
      }
      if (s.tool === "image") {
        // 그림은 **칠해진 픽셀**로 판정한다. 상자로 판정하면 채우기 조각(상자가 화면 절반만 하다)의
        // 투명한 여백만 긁어도 통째로 잡혔다(2026-08-05 사용자 지적).
        const box = boxOf(s);
        const mask = s.src ? maskFor(s.src) : null;
        const hit = mask
          ? maskHitsRect(mask, box, selectionRect)
          : strokeIntersectsRect(s, selectionRect); // 마스크를 못 만들면 옛 상자 기준
        if (!hit) {
          nextScene.push(s);
          continue;
        }
        // 그림도 **밴드에 걸친 부분만** 잘라 선택한다(획과 같은 문법 — 사용자 지적:
        // "채우기로 색칠된 건 선택으로 분할이 안 된다"). 밖에 남는 게 없으면 통째로 잡는다.
        const inter = {
          x: Math.max(lo.x, box.left),
          y: Math.max(lo.y, box.top),
          w: Math.min(hi.x, box.right) - Math.max(lo.x, box.left),
          h: Math.min(hi.y, box.bottom) - Math.max(lo.y, box.top)
        };
        const restRemains = mask ? maskPaintedOutsideRect(mask, box, selectionRect) : false;
        const cropped =
          restRemains && inter.w >= 4 && inter.h >= 4 ? cropRegion(s, inter, true) : null;
        if (!cropped?.holeSrc) {
          nextScene.push(s);
          picked.push(s);
          continue;
        }
        changed = true;
        // 남는 쪽은 **새 객체**로 만든다 — 원본을 고치면 되돌리기용 before 스냅샷까지 같이 바뀐다.
        const rest: Stroke = { ...s, src: cropped.holeSrc };
        const piece: Stroke = {
          ...s,
          src: cropped.src,
          points: [
            { x: inter.x, y: inter.y },
            { x: inter.x + inter.w, y: inter.y + inter.h }
          ]
        };
        nextScene.push(rest, piece);
        picked.push(piece);
        continue;
      }
      const flags = s.points.map(inside);
      const shapeCrosses = isBoxItem(s.tool) && strokeIntersectsRect(s, selectionRect);
      const hasVisiblePoint = s.points.some((pt, i) => flags[i] && visibleAt(pt, s.layer));
      if (
        (!flags.some(Boolean) && !shapeCrosses) ||
        (!hasVisiblePoint && !(shapeCrosses && layerHasInk(s.layer)))
      ) {
        nextScene.push(s); // 밴드 밖이거나, 밴드 안 구간이 전부 지워져 안 보이는 획
        continue;
      }
      if (flags.every(Boolean) || isBoxItem(s.tool)) {
        nextScene.push(s);
        picked.push(s);
        continue;
      }
      // 부분 겹침 → 연속 구간(run) 단위로 쪼갠다. 경계 보간점은 양쪽 조각이 공유해
      // 이어 보이던 곳이 뚝 끊겨 보이지 않는다(z순서는 원래 자리 그대로).
      changed = true;
      let run: StrokePoint[] = [{ ...s.points[0] }];
      let runIn = flags[0];
      let headCut = false; // 이 조각의 시작이 '잘린 자리'인가(원래 획의 끝이 아니라)
      // 형광펜은 반투명이라 조각 두 개가 경계점을 공유하면 그 자리만 진하게 뭉친다
      // (둥근 캡이 완전히 겹친다). 잘린 끝만 반굵기 물려 캡이 경계까지만 닿게 한다.
      const seam = s.tool === "hl" ? s.width / 2 : 0;
      const flush = (tailCut: boolean) => {
        if (run.length === 0) return;
        const points = seam > 0 ? trimSeamEnds(run, headCut, tailCut, seam) : run;
        if (points.length < 2) return; // 캡만 남는 조각 — 이웃 캡이 이미 덮는다
        const frag: Stroke = {
          tool: s.tool,
          layer: s.layer,
          color: s.color,
          width: s.width,
          points
        };
        nextScene.push(frag);
        if (runIn) picked.push(frag);
      };
      for (let i = 1; i < s.points.length; i += 1) {
        const pt = s.points[i];
        if (flags[i] === runIn) {
          run.push({ ...pt });
          continue;
        }
        // 경계 통과 — 나가는 쪽 기준으로 보간(들어올 땐 방향만 뒤집으면 동일).
        const b = runIn ? exitPoint(s.points[i - 1], pt) : exitPoint(pt, s.points[i - 1]);
        run.push(b);
        flush(true);
        run = [b, { ...pt }];
        headCut = true;
        runIn = flags[i];
      }
      flush(false);
    }
    // ⚠ 선택한 획은 **맨 위로 올린다**(지우개 위로).
    // 지우개는 픽셀을 지우는 게 아니라 destination-out 획으로 장면에 남아, 재생 순서대로 다시
    // 적용된다. 그래서 선택한 그림을 '예전에 지운 자리'로 옮기면 그 지우개가 다시 덮어
    // **지운 적 없는 부분이 지워진 것처럼** 보였다(실측, 중대). 선택 시점에 뒤로 보내면
    // 이후 어디로 옮기든 옛 지우개가 닿지 않는다. 그림 도구의 "옮기면 맨 앞으로"와도 맞다.
    const pickedSet = new Set(picked);
    const lifted =
      picked.length > 0 ? [...nextScene.filter((x) => !pickedSet.has(x)), ...picked] : nextScene;
    const orderChanged = lifted.some((x, i) => x !== nextScene[i]);
    if (changed || orderChanged) {
      store.setStrokes(lifted);
      pushHist({ t: "scene", before, after: [...lifted] });
      // 분할된 레이어들 재생(선언 순서 제약으로 ref 경유 — replayAll과 동일 효과).
      for (const l of layersRef.current) replayLayerFnRef.current(l.id);
      setStrokeVersion((v) => v + 1);
    }
    setStrokeSel(picked);
    // 아무것도 안 잡혔는데 밴드 안에 '다른 레이어'의 잉크가 있으면 그 사실을 알린다.
    if (picked.length === 0) {
      const other = layersRef.current.find(
        (l) => l.vis && l.id !== activeLayerIdRef.current && layerHasInkStrict(l.id)
      );
      if (other) flashSelHint(`'${other.name}' 레이어에 있어요 — 그 레이어를 골라야 선택돼요`);
    }
  }

  // ── 그림 부분 선택(영역 오려내기) ────────────────────────────────────────
  // 붙여넣은 스크린샷에서 필요한 조각만 쓰고 싶을 때. 지금까지 선택의 최소 단위가 '항목 하나'라,
  // 스크린샷 일부만 옮기려면 밖에서 잘라 다시 붙여넣어야 했다.
  //
  // 오려낸 조각은 **새 image 항목**으로 만든다. 그러면 이동·확대·z순서·복사/붙여넣기·되돌리기가
  // 전부 이미 있는 경로를 그대로 탄다(부분 선택 전용 상태를 만들면 그중 하나가 반드시 빠진다).
  const [imgRegion, setImgRegion] = useState<{
    st: Stroke;
    rect: { x: number; y: number; w: number; h: number } | null;
  } | null>(null);
  const imgRegionRef = useRef<typeof imgRegion>(null);
  imgRegionRef.current = imgRegion;
  const regionDragRef = useRef<{ pointerId: number; x0: number; y0: number } | null>(null);

  /** 선택이 그림 한 장일 때만 부분 선택을 걸 수 있다(여러 개를 한 번에 오리는 건 뜻이 모호하다). */
  const soleImageSel =
    strokeSel.length === 1 && strokeSel[0].tool === "image" && strokeSel[0].src
      ? strokeSel[0]
      : null;

  const imgBox = (st: Stroke) => {
    const [a, b] = [st.points[0], st.points[st.points.length - 1]];
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y)
    };
  };

  // 비트맵 도우미는 아래(디코드 캐시 부근)에서 정의된다 — 선언 순서 제약을 ref로 넘긴다
  // (replayLayerFnRef와 같은 방식).
  const readyBitmapRef = useRef<
    (src: string) => { src: CanvasImageSource; w: number; h: number } | null
  >(() => null);
  const rememberBitmapRef = useRef<(src: string, canvas: HTMLCanvasElement) => void>(() => {});

  /** 판 좌표 영역 → 그 그림의 픽셀 좌표. 확대해 놓은 그림도 원본 해상도로 오려야 안 뭉갠다. */
  const cropRegion = useCallback(
    (
      st: Stroke,
      rect: { x: number; y: number; w: number; h: number },
      hole: boolean
    ): { src: string; holeSrc?: string } | null => {
      // 방금 만든 조각은 아직 디코드 전일 수 있다 — 그때는 손에 든 캔버스로 오린다(readyBitmap).
      const bmp = st.src ? readyBitmapRef.current(st.src) : null;
      if (!bmp) return null;
      const img = bmp.src;
      const box = imgBox(st);
      if (box.w < 1 || box.h < 1) return null;
      const kx = bmp.w / box.w;
      const ky = bmp.h / box.h;
      const sx = Math.max(0, Math.round((rect.x - box.x) * kx));
      const sy = Math.max(0, Math.round((rect.y - box.y) * ky));
      const sw = Math.max(1, Math.min(bmp.w - sx, Math.round(rect.w * kx)));
      const sh = Math.max(1, Math.min(bmp.h - sy, Math.round(rect.h * ky)));
      const cut = document.createElement("canvas");
      cut.width = sw;
      cut.height = sh;
      const cctx = cut.getContext("2d");
      if (!cctx) return null;
      cctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      let holeSrc: string | undefined;
      if (hole) {
        // '옮기기'는 원본에서 그 자리가 비어야 한다 — 안 비우면 복사와 구분이 안 된다.
        const rest = document.createElement("canvas");
        rest.width = bmp.w;
        rest.height = bmp.h;
        const rctx = rest.getContext("2d");
        if (!rctx) return null;
        rctx.drawImage(img, 0, 0);
        rctx.clearRect(sx, sy, sw, sh);
        holeSrc = rest.toDataURL("image/png");
        rememberBitmapRef.current(holeSrc, rest); // 디코드 전에도 바로 그린다(빈 프레임 방지)
      }
      try {
        const src = cut.toDataURL("image/png");
        rememberBitmapRef.current(src, cut);
        return { src, holeSrc };
      } catch {
        // 외부 출처 그림이면 캔버스가 오염돼 내보내기가 막힌다 — 조용히 포기한다(앱은 그대로).
        return null;
      }
    },
    []
  );

  /** 영역 확정. move=true면 원본에서 그 부분을 지운다(=옮기기), false면 원본을 그대로 둔다(=복사). */
  const commitRegionRef = useRef<(move: boolean) => void>(() => {});
  const commitRegion = useCallback(
    (move: boolean) => {
      const cur = imgRegionRef.current;
      if (!cur?.rect || cur.rect.w < 4 || cur.rect.h < 4) return;
      const cropped = cropRegion(cur.st, cur.rect, move);
      if (!cropped) {
        flashSelHint("이 그림은 오려낼 수 없어요(외부 출처)");
        setImgRegion(null);
        return;
      }
      const before = store.strokes().map((x) => ({ ...x, points: x.points.map((pt) => ({ ...pt })) }));
      // 복사는 원본이 그대로 남으므로 살짝 어긋나게 놓는다 — 겹쳐 놓으면 옮긴 건지 만 건지 모른다.
      const off = move ? 0 : 12;
      const piece: Stroke = {
        tool: "image",
        layer: cur.st.layer,
        color: "#000",
        width: 1,
        src: cropped.src,
        points: [
          { x: cur.rect.x + off, y: cur.rect.y + off },
          { x: cur.rect.x + cur.rect.w + off, y: cur.rect.y + cur.rect.h + off }
        ]
      };
      const live = store.strokes();
      if (move && cropped.holeSrc) {
        const target = live.find((x) => x === cur.st);
        if (target) target.src = cropped.holeSrc;
      }
      const after = [...live, piece];
      store.setStrokes(after);
      pushHist({ t: "scene", before, after: after.map((x) => ({ ...x, points: x.points.map((pt) => ({ ...pt })) })) });
      replayLayerFnRef.current(cur.st.layer);
      setStrokeVersion((v) => v + 1);
      setImgRegion(null);
      setStrokeSel([piece]); // 떼자마자 선택 — 바로 끌어 옮길 수 있게
      hapticTick();
    },
    [cropRegion, store, pushHist]
  );
  commitRegionRef.current = commitRegion;
  // 대상이 사라지거나(삭제·되돌리기) 선택·도구·레이어가 바뀌면 부분 선택은 뜻을 잃는다 — 즉시 접는다.
  useEffect(() => {
    if (!imgRegion) return;
    const alive = store.strokes().includes(imgRegion.st);
    if (!alive || tool !== "select" || imgRegion.st.layer !== activeLayerId) setImgRegion(null);
  }, [imgRegion, tool, activeLayerId, store, strokeVersion]);

  // ── 그림 붙여넣기·드롭 ──
  // 이미지는 장면 배열의 한 항목(tool:"image")으로 들어간다 — 그래야 z순서·선택·이동/확대·
  // 되돌리기·내보내기가 이미 있는 경로를 그대로 탄다(따로 만들면 그중 하나가 반드시 빠진다).
  // 크기는 보드 폭의 1/3을 넘지 않게 줄여 넣는다(원본이 4000px여도 화면을 덮지 않게).
  const insertImage = useCallback(
    (src: string, at?: { x: number; y: number }) => {
      const act = layersRef.current.find((l) => l.id === activeLayerIdRef.current && l.vis);
      if (!act) return; // 숨긴 레이어에 넣으면 안 보이는 곳에 놓는 셈이다
      const img = new Image();
      img.onload = () => {
        const inner = boardInnerRef.current;
        const maxW = Math.max(120, (inner?.offsetWidth ?? 900) / 3);
        const k = Math.min(1, maxW / Math.max(1, img.naturalWidth));
        const w = Math.max(24, Math.round(img.naturalWidth * k));
        const h = Math.max(24, Math.round(img.naturalHeight * k));
        const cx = at?.x ?? Math.round(((inner?.offsetWidth ?? 900) - w) / 2);
        const cy = at?.y ?? Math.round(((inner?.offsetHeight ?? 400) - h) / 2);
        const item: Stroke = {
          tool: "image",
          layer: act.id,
          color: "#000",
          width: 1,
          src,
          points: [
            { x: cx, y: cy },
            { x: cx + w, y: cy + h }
          ]
        };
        imgCache.current.set(src, img); // 방금 디코드한 것을 그대로 캐시에 넣는다
        const before = [...store.strokes()];
        const after = [...before, item];
        store.setStrokes(after);
        pushHist({ t: "scene", before, after: [...after] });
        replayLayerFnRef.current(act.id);
        setStrokeVersion((v) => v + 1);
        setStrokeSel([item]); // 붙자마자 선택 — 바로 옮기거나 크기를 바꿀 수 있게
        setTool("select");
        hapticTick();
      };
      img.src = src;
    },
    [store, pushHist]
  );
  const readImageFile = useCallback(
    (file: File, at?: { x: number; y: number }) => {
      if (!file.type.startsWith("image/")) return;
      const fr = new FileReader();
      fr.onload = () => {
        if (typeof fr.result === "string") insertImage(fr.result, at);
      };
      fr.readAsDataURL(file);
    },
    [insertImage]
  );
  // 붙여넣기 — 패널이 열려 있을 때만. 입력칸에 포커스가 있으면 그쪽이 임자다(텍스트 붙여넣기).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // 화면 캡처(PrtSc·캡처 도구)는 files가 비고 items에만 들어오는 브라우저가 있다 —
      // 둘 다 본다. 안 그러면 "복사한 스크린샷이 안 붙는다"가 된다.
      const cd = e.clipboardData;
      let img = [...(cd?.files ?? [])].find((f) => f.type.startsWith("image/")) ?? null;
      if (!img && cd) {
        for (const it of cd.items) {
          if (it.kind === "file" && it.type.startsWith("image/")) {
            img = it.getAsFile();
            if (img) break;
          }
        }
      }
      if (!img) return;
      e.preventDefault();
      readImageFile(img);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [readImageFile]);

  // ── 선택 획 박스(그림판 선택 문법): 점선 bbox — 끌면 이동, 모서리 손잡이로 확대/축소 ──
  const strokeSelBox = useMemo(() => {
    if (tool !== "select" || strokeSel.length === 0) return null;
    // 선택은 활성 레이어 기준(splitSelectStrokes와 같은 규칙). 레이어를 바꾸면 선택이 풀리는데,
    // 그게 '레이어별로 따로 손댄다'는 규율의 자연스러운 결과다.
    const selectedLayer = layers.find((l) => l.id === activeLayerId);
    if (!selectedLayer?.vis) return null;
    const live = new Set(store.strokes());
    const sel = strokeSel.filter((s) => live.has(s) && s.layer === activeLayerId);
    if (sel.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of sel) {
      const half = s.width / 2 + 2;
      for (const pt of s.points) {
        minX = Math.min(minX, pt.x - half);
        minY = Math.min(minY, pt.y - half);
        maxX = Math.max(maxX, pt.x + half);
        maxY = Math.max(maxY, pt.y + half);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, sel };
    // strokeVersion: 이동/확대/undo가 획 기하를 바꿀 때 박스를 따라오게 하는 신호.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, strokeSel, store, strokeVersion, layers, activeLayerId]);
  // 박스 빈 면을 잡으면 = 선택된 카드 grab과 동일한 그룹 이동 제스처(획 + 선택 카드).
  function onStrokeBoxPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool !== "select" || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const origs = new Map<string, ColBox>();
    for (const k of colSelRef.current) {
      const b = colsRef.current.get(k);
      if (b) origs.set(k, b);
    }
    dragColRef.current = {
      key: "",
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: 0, y: 0, w: COL_DEFAULT_W },
      origH: 300,
      origs,
      beforeAll: new Map(colsRef.current),
      moved: false,
      startSL: boardScrollRef.current?.scrollLeft ?? 0,
      startST: boardScrollRef.current?.scrollTop ?? 0,
      maxX: (boardInnerRef.current?.offsetWidth ?? 4000) + 480,
      maxY: (boardInnerRef.current?.offsetHeight ?? 3000) + 480,
      clamp: { xPos: false, xNeg: false, yPos: false, yNeg: false },
      strokeOrigs: snapshotStrokes(strokeSelRef.current),
      chipsBefore: new Map(chipDyRef.current)
    };
  }
  // 모서리 손잡이: bbox 왼쪽 위를 앵커로 균일 확대/축소 — 굵기도 비례(그림판 감각).
  const strokeScaleRef = useRef<{
    axis: "xy" | "x" | "y";
    pointerId: number;
    anchor: { x: number; y: number };
    startW: number;
    startH: number;
    maxX: number;
    maxY: number;
    origs: Map<Stroke, StrokeGeom>;
  } | null>(null);
  // axis: "xy" 대각(비율 유지) · "x" 너비만 · "y" 높이만.
  // 그림(스크린샷)은 원본 비율을 꼭 지켜야 하는 게 아니라, 칸에 맞춰 눌러 넣고 싶을 때가 있다.
  function onStrokeScaleDown(e: React.PointerEvent<HTMLElement>, axis: "xy" | "x" | "y" = "xy") {
    if (tool !== "select" || e.button !== 0 || !strokeSelBox) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeScaleRef.current = {
      axis,
      pointerId: e.pointerId,
      anchor: { x: strokeSelBox.x, y: strokeSelBox.y },
      startW: Math.max(8, strokeSelBox.w),
      startH: Math.max(8, strokeSelBox.h),
      maxX: (boardInnerRef.current?.offsetWidth ?? 4000) + 480,
      maxY: (boardInnerRef.current?.offsetHeight ?? 3000) + 480,
      origs: snapshotStrokes(strokeSelBox.sel)
    };
  }
  function onStrokeScaleMove(e: React.PointerEvent<HTMLElement>) {
    const sc = strokeScaleRef.current;
    if (!sc || e.pointerId !== sc.pointerId) return;
    const p = innerPointC(e.clientX, e.clientY);
    if (!p) return;
    const clamp = (v: number) => Math.max(0.2, Math.min(8, v));
    const rx = clamp(Math.min((sc.maxX - 8 - sc.anchor.x) / sc.startW, (p.x - sc.anchor.x) / sc.startW));
    const ry = clamp(Math.min((sc.maxY - 8 - sc.anchor.y) / sc.startH, (p.y - sc.anchor.y) / sc.startH));
    // 대각은 두 축을 같은 값으로 묶어 비율을 지킨다(예전 동작). 가장자리 손잡이는 한 축만.
    const sx = sc.axis === "y" ? 1 : sc.axis === "xy" ? Math.max(rx, ry) : rx;
    const sy = sc.axis === "x" ? 1 : sc.axis === "xy" ? Math.max(rx, ry) : ry;
    for (const [st, g] of sc.origs) {
      st.points = g.points.map((pt) => ({
        x: sc.anchor.x + (pt.x - sc.anchor.x) * sx,
        y: sc.anchor.y + (pt.y - sc.anchor.y) * sy,
        p: pt.p
      }));
      // 획 굵기는 두 축 평균으로 — 한 축만 늘렸다고 선이 그만큼 굵어지면 어색하다.
      // 이미지는 굵기 개념이 없으므로 건드리지 않는다.
      if (st.tool !== "image") {
        st.width = Math.max(0.5, Math.min(240, g.width * ((sx + sy) / 2)));
      }
    }
    repaintStrokeLayers(sc.origs);
  }
  function onStrokeScaleUp(e: React.PointerEvent<HTMLElement>) {
    const sc = strokeScaleRef.current;
    if (!sc || e.pointerId !== sc.pointerId) return;
    strokeScaleRef.current = null;
    const targets = [...sc.origs.keys()];
    pushHist({
      t: "xform",
      cols: null,
      strokes: {
        targets,
        before: targets.map((st) => sc.origs.get(st)!),
        after: targets.map((st) => ({
          points: st.points.map((pt) => ({ ...pt })),
          width: st.width
        }))
      }
    });
  }

  // ── 정렬(2개 이상 선택 시) — 위 맞춤 · 세로 중앙 · 왼쪽/오른쪽 맞춤 · 가로 균등 간격 ──
  // 정렬은 '격자 인식': 세로 구간이 겹치는 카드끼리 = 같은 행, 가로 구간이 겹치면 = 같은 열.
  // 전역 정렬(모두 y=min)은 2행 이상 선택에서 행을 붕괴시켜 겹침을 만들었다 — 행/열 안에서만
  // 정렬하면 1행이든 2×4든 어떤 행렬 구조든 유지되고 겹침이 없다.
  type AlignRect = { k: string; x: number; y: number; w: number; h: number };
  function clusterRects(rects: AlignRect[], axis: "row" | "col"): AlignRect[][] {
    const sorted = [...rects].sort((a, b) => (axis === "row" ? a.y - b.y : a.x - b.x));
    const groups: AlignRect[][] = [];
    let cur: AlignRect[] = [];
    let end = -Infinity;
    for (const r of sorted) {
      const start = axis === "row" ? r.y : r.x;
      const stop = axis === "row" ? r.y + r.h : r.x + r.w;
      if (cur.length > 0 && start > end) {
        groups.push(cur);
        cur = [];
        end = -Infinity;
      }
      cur.push(r);
      end = Math.max(end, stop);
    }
    if (cur.length > 0) groups.push(cur);
    return groups;
  }
  // 같은 행 안 가로 겹침 해소 — 왼쪽부터 훑으며 겹치면 오른쪽으로 민다(최소 간격 14).
  function resolveRowOverlap(row: AlignRect[]): void {
    const sorted = [...row].sort((a, b) => a.x - b.x || a.y - b.y);
    let right = -Infinity;
    for (const r of sorted) {
      if (r.x < right + 14 && right !== -Infinity) r.x = right + 14;
      right = r.x + r.w;
    }
  }
  function alignSelected(kind: "top" | "middle" | "left" | "right" | "distribute-x") {
    const keys = [...colSelRef.current];
    if (keys.length < 2) return;
    hapticTick();
    const before = new Map(colsRef.current);
    const next = new Map(colsRef.current);
    const rects: AlignRect[] = keys
      .map((k) => {
        const b = next.get(k);
        if (!b) return null;
        const h = colElsRef.current.get(k)?.offsetHeight ?? 300;
        return { k, x: b.x, y: b.y, w: b.w, h };
      })
      .filter((r): r is AlignRect => r !== null);
    if (rects.length < 2) return;
    if (kind === "top" || kind === "middle") {
      for (const row of clusterRects(rects, "row")) {
        if (kind === "top") {
          const top = Math.min(...row.map((r) => r.y));
          for (const r of row) r.y = top;
        } else {
          const minY = Math.min(...row.map((r) => r.y));
          const maxY = Math.max(...row.map((r) => r.y + r.h));
          const cy = (minY + maxY) / 2;
          for (const r of row) r.y = Math.max(0, Math.round(cy - r.h / 2));
        }
        // 세로를 맞추면 원래 어긋나 있던 카드끼리 가로로 겹칠 수 있다 → 밀어서 해소.
        resolveRowOverlap(row);
      }
    } else if (kind === "left") {
      for (const col of clusterRects(rects, "col")) {
        const left = Math.min(...col.map((r) => r.x));
        for (const r of col) r.x = left;
      }
    } else if (kind === "right") {
      // 오른쪽 맞춤: 열 안에서 오른쪽 변을 가장 오른쪽 카드에 붙인다(폭이 다르면 x가 달라진다).
      for (const col of clusterRects(rects, "col")) {
        const right = Math.max(...col.map((r) => r.x + r.w));
        for (const r of col) r.x = Math.max(0, right - r.w);
      }
    } else {
      // 가로 균등 간격: 행별로 왼쪽 끝 고정, 최소 14px 간격(공간이 남으면 그만큼 넓게).
      for (const row of clusterRects(rects, "row")) {
        if (row.length < 2) continue;
        const sorted = [...row].sort((a, b) => a.x - b.x || a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalW = sorted.reduce((s, r) => s + r.w, 0);
        const span = last.x + last.w - first.x;
        const gap = Math.max(14, (span - totalW) / (sorted.length - 1));
        let cursor = first.x;
        for (const r of sorted) {
          r.x = Math.max(0, Math.round(cursor));
          cursor += r.w + gap;
        }
      }
    }
    // 원래 박스를 스프레드해 명시 높이(h)를 보존 — 정렬이 세로 늘림을 지우면 안 된다.
    for (const r of rects) next.set(r.k, { ...next.get(r.k)!, x: r.x, y: r.y, w: r.w });
    setCols(next);
    pushHist({ t: "cols", before, after: next });
  }

  const canvasOf = useCallback((layer: StrokeLayer) => {
    return layerCanvases.current.get(layer) ?? null;
  }, []);
  // desynchronized 힌트는 쓰지 않는다: 형광펜·도형 라이브 프리뷰(+예측 꼬리)는 매 프레임
  // '전체 clear→재그리기'인데, desync 캔버스는 vsync 합성을 우회해 clear 직후 빈 화면이
  // 그대로 노출될 수 있다 — 그리는 중 깜빡임의 원인(연구 아카이브 §1의 tearing 트레이드오프).
  // 잉킹 지각 한계(~50ms) 안에서 rAF 1프레임 지연이 깜빡임보다 낫다.
  const scaledCtx = useCallback((canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
    return ctx;
  }, []);
  const clearCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);
  // 붙여넣은 그림의 디코드 캐시. 같은 data URL을 매 재생마다 다시 디코드하면 되돌리기·리사이즈가
  // 눈에 띄게 느려진다. 처음 만나면 로드하고, 로드가 끝나면 그 레이어만 다시 재생한다.
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  // 방금 우리가 만든 그림(채우기 조각·지우개를 구운 결과·오려낸 조각)은 **캔버스로 이미 손에**
  // 있다. data URL을 디코드해 오기까지 몇 프레임이 비는데, 그 사이 재생이 돌면 그림이 잠깐
  // 사라진다 = 지우개를 쓸 때마다 깜빡임(2026-08-05 사용자 지적). 캔버스를 그대로 들고 있다가
  // 즉시 그린다. 디코드가 끝나면 이미지 쪽을 쓰고 캔버스는 버린다(메모리).
  const bmpCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const BMP_KEEP = 12;
  const rememberBitmap = useCallback((src: string, canvas: HTMLCanvasElement) => {
    bmpCache.current.set(src, canvas);
    while (bmpCache.current.size > BMP_KEEP) {
      const oldest = bmpCache.current.keys().next().value;
      if (oldest === undefined) break;
      bmpCache.current.delete(oldest);
    }
  }, []);
  /** 지금 당장 그릴 수 있는 비트맵(디코드 끝난 이미지 우선, 없으면 방금 만든 캔버스). */
  const readyBitmap = useCallback(
    (src: string): { src: CanvasImageSource; w: number; h: number } | null => {
      const img = imgCache.current.get(src);
      if (img && img.complete && img.naturalWidth > 0) {
        bmpCache.current.delete(src); // 디코드가 끝났으니 캔버스는 더 들고 있을 이유가 없다
        return { src: img, w: img.naturalWidth, h: img.naturalHeight };
      }
      const cv = bmpCache.current.get(src);
      if (cv) return { src: cv, w: cv.width, h: cv.height };
      return null;
    },
    []
  );
  const imageFor = useCallback(
    (src: string, layer: StrokeLayer): { src: CanvasImageSource; w: number; h: number } | null => {
      const ready = readyBitmap(src);
      if (ready) return ready;
      if (!imgCache.current.has(src)) {
        const img = new Image();
        imgCache.current.set(src, img);
        img.onload = () => replayLayerFnRef.current(layer); // 로드 끝난 뒤 한 번만 다시 그린다
        img.src = src;
      }
      return null;
    },
    [readyBitmap]
  );
  readyBitmapRef.current = readyBitmap;
  rememberBitmapRef.current = rememberBitmap;
  /** 디코드를 시작만 시켜 둔다(캔버스로 이미 그릴 수 있는 그림의 뒷정리용). */
  const warmDecode = useCallback((src: string, layer: StrokeLayer) => {
    if (imgCache.current.has(src)) return;
    const img = new Image();
    imgCache.current.set(src, img);
    img.onload = () => replayLayerFnRef.current(layer);
    img.src = src;
  }, []);

  // 그림의 알파 마스크 — 선택·지우개가 '상자'가 아니라 '칠해진 픽셀'을 보게 한다.
  // (채우기 조각의 상자는 화면 절반만 해서, 상자로 판정하면 여백만 긁어도 통째로 잡혔다.)
  const maskCache = useRef<Map<string, AlphaMask | null>>(new Map());
  const maskFor = useCallback(
    (src: string): AlphaMask | null => {
      const hit = maskCache.current.get(src);
      if (hit !== undefined) return hit;
      const bmp = readyBitmap(src);
      if (!bmp) return null; // 아직 못 그린다 — 이번엔 상자 기준으로 넘어간다(다음에 다시 시도)
      const cv = document.createElement("canvas");
      const k = Math.min(1, MASK_MAX / Math.max(1, Math.max(bmp.w, bmp.h)));
      cv.width = Math.max(1, Math.round(bmp.w * k));
      cv.height = Math.max(1, Math.round(bmp.h * k));
      const cx = cv.getContext("2d", { willReadFrequently: true });
      if (!cx) return null;
      try {
        cx.drawImage(bmp.src, 0, 0, cv.width, cv.height);
        const d = cx.getImageData(0, 0, cv.width, cv.height);
        const mask = maskFromRgba(d.data, cv.width, cv.height, MASK_MAX);
        maskCache.current.set(src, mask);
        return mask;
      } catch {
        maskCache.current.set(src, null); // 외부 출처로 오염된 캔버스 — 상자 기준으로 되돌아간다
        return null;
      }
    },
    [readyBitmap]
  );

  // 색 채우기 — 그 레이어 캔버스의 픽셀을 직접 읽어 같은 색 영역을 채운다(엔진은 픽셀을 모른다).
  // 좌표는 판 기준 CSS 좌표라 backing scale을 곱해 실제 픽셀 자리로 바꾼다.
  // **지금 레이어 안에서만** 경계가 잡힌다 — 다른 레이어에 그린 선은 벽이 되지 않는다(그림판 문법).
  // 색 채우기 = **그 순간의 픽셀을 한 번 계산해 비트맵 조각으로 굳힌다**.
  //
  // 예전엔 '찍은 점'만 남기고 재생할 때마다 다시 부었다. 그러면 나중에 지우개로 경계를 뚫거나
  // 획을 옮긴 뒤 화면이 다시 그려질 때 **그때의 픽셀 기준으로 다시 번져** 엉뚱한 곳이 칠해졌다
  // (2026-08-05 사용자 지적: "선택할 때 채우기가 겹쳐 적용된다"). 결과를 조각으로 굳히면
  // 재생은 그림 한 장을 그리는 일이 되어 몇 번을 다시 그려도 같다. 붙여넣은 그림과 같은 규약이라
  // 선택·이동·크기변경·지우개도 공짜로 따라온다.
  const makeFillPatch = useCallback(
    (canvas: HTMLCanvasElement | null, at: StrokePoint, hex: string): Stroke | null => {
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!ctx || !canvas) return null;
      const rgba = parseHexColor(hex);
      if (!rgba) return null;
      const scale = scaleRef.current;
      const px = at.x * scale;
      const py = at.y * scale;
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const original = new Uint8ClampedArray(before.data); // 비교용 원본
      const painted = floodFill(before, px, py, rgba);
      if (painted > 0) ctx.putImageData(before, 0, 0); // 화면에는 지금 바로 반영(조각 디코딩을 기다리지 않는다)
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (painted === 0) return null;

      // 바뀐 픽셀만 골라 조각으로 — 화면 전체 크기 PNG를 남기면 되돌리기·재생이 무거워진다.
      const { width, height, data } = before;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if (
            data[i] === original[i] &&
            data[i + 1] === original[i + 1] &&
            data[i + 2] === original[i + 2] &&
            data[i + 3] === original[i + 3]
          ) {
            continue;
          }
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < minX || maxY < minY) return null;
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const patch = document.createElement("canvas");
      patch.width = w;
      patch.height = h;
      const pctx = patch.getContext("2d");
      if (!pctx) return null;
      const out = pctx.createImageData(w, h);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const src = ((y + minY) * width + (x + minX)) * 4;
          const dst = (y * w + x) * 4;
          const same =
            data[src] === original[src] &&
            data[src + 1] === original[src + 1] &&
            data[src + 2] === original[src + 2] &&
            data[src + 3] === original[src + 3];
          if (same) continue; // 안 바뀐 픽셀은 투명하게 둔다(원래 그림을 덮지 않게)
          out.data[dst] = data[src];
          out.data[dst + 1] = data[src + 1];
          out.data[dst + 2] = data[src + 2];
          out.data[dst + 3] = data[src + 3];
        }
      }
      pctx.putImageData(out, 0, 0);
      const src = patch.toDataURL("image/png");
      rememberBitmap(src, patch); // 디코드 전에도 바로 그릴 수 있게(첫 재생에서 안 비게)
      return {
        tool: "image",
        src,
        layer: "", // 호출부가 채운다
        color: hex,
        width: 0,
        // 이미지와 같은 2점(좌상·우하) 규약 — CSS 좌표로 되돌린다.
        points: [
          { x: minX / scale, y: minY / scale },
          { x: (maxX + 1) / scale, y: (maxY + 1) / scale }
        ]
      };
    },
    [rememberBitmap]
  );

  // 그림(붙여넣기·채우기 조각)은 기하가 없어 잘라낼 수 없다 — 픽셀에 지우개를 **구워 넣고**
  // 다시 인코딩한다. 그래야 "화면엔 없는데 데이터엔 남아 선택되는" 유령이 안 생긴다.
  // 화면에 그려진 그림은 이미 디코드 캐시(imgCache)에 있으므로 **동기로** 굽는다 — 그래야
  // 되돌리기/다시실행 기록에 '구워진 결과'가 그대로 담긴다(비동기로 나중에 갈아끼우면
  // 다시실행이 지우기 전 그림으로 되돌아간다).
  const bakeEraseIntoImage = useCallback(
    (stroke: Stroke, er: { points: StrokePoint[]; width: number }): Stroke => {
      if (!stroke.src) return stroke;
      const bmp = readyBitmap(stroke.src);
      if (!bmp) return stroke; // 아직 못 그린다 — 원본 유지
      const a = stroke.points[0];
      const b = stroke.points[stroke.points.length - 1] ?? a;
      const left = Math.min(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      if (w < 1 || h < 1) return stroke;
      // 원본 해상도를 지킨다(반복 편집으로 흐려지지 않게).
      const sx = bmp.w / w;
      const sy = bmp.h / h;
      const cv = document.createElement("canvas");
      cv.width = bmp.w;
      cv.height = bmp.h;
      const cx = cv.getContext("2d");
      if (!cx) return stroke;
      cx.drawImage(bmp.src, 0, 0);
      cx.globalCompositeOperation = "destination-out";
      cx.lineCap = "round";
      cx.lineJoin = "round";
      cx.lineWidth = er.width * ((sx + sy) / 2);
      cx.strokeStyle = "#000";
      if (er.points.length === 1) {
        const p = er.points[0];
        cx.beginPath();
        cx.arc((p.x - left) * sx, (p.y - top) * sy, (er.width / 2) * sx, 0, Math.PI * 2);
        cx.fill();
      } else {
        cx.beginPath();
        er.points.forEach((p, i) => {
          const x = (p.x - left) * sx;
          const y = (p.y - top) * sy;
          if (i === 0) cx.moveTo(x, y);
          else cx.lineTo(x, y);
        });
        cx.stroke();
      }
      const src = cv.toDataURL("image/png");
      // 구운 결과를 **캔버스 그대로** 들고 있는다 — 디코드를 기다리는 동안 그림이 사라져
      // 지우개를 쓸 때마다 한 번씩 깜빡이던 원인이다.
      rememberBitmap(src, cv);
      warmDecode(src, stroke.layer);
      return { ...stroke, src };
    },
    [readyBitmap, rememberBitmap, warmDecode]
  );

  const replayLayer = useCallback(
    (layer: StrokeLayer) => {
      const canvas = canvasOf(layer);
      clearCanvas(canvas);
      const ctx = scaledCtx(canvas);
      if (!ctx) return;
      for (const s of store.strokes()) {
        if (!strokeAppliesTo(s, layer)) continue;
        if (s.tool === "image") {
          // 이미지는 엔진이 못 그린다(DOM 필요) — 여기서 2점 사각형에 맞춰 그린다.
          const bmp = s.src ? imageFor(s.src, layer) : null;
          if (!bmp) continue; // 아직 로딩 중 — onload가 다시 부른다
          const [a, b] = [s.points[0], s.points[s.points.length - 1]];
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const w = Math.abs(b.x - a.x);
          const h = Math.abs(b.y - a.y);
          if (w < 1 || h < 1) continue;
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
          (ctx as unknown as CanvasRenderingContext2D).drawImage(bmp.src, x, y, w, h);
          continue;
        }
        drawStroke(ctx, s);
      }
    },
    [canvasOf, clearCanvas, scaledCtx, store, imageFor]
  );
  const replayAll = useCallback(() => {
    for (const id of layerCanvases.current.keys()) replayLayer(id);
    clearCanvas(liveCanvasRef.current);
    clearCanvas(predictionCanvasRef.current);
    predictedPointsRef.current = [];
  }, [replayLayer, clearCanvas]);
  // 위쪽 제스처 코드(획 이동/확대)가 최신 replayLayer를 부르게 ref로 노출(선언 순서 제약 회피).
  replayLayerFnRef.current = replayLayer;

  // 펜이 진행 중인 터치 획을 선점할 때 사용한다. 터치 지우개는 committed 캔버스를 이미
  // 바꿨을 수 있으므로 해당 레이어만 재생해 취소 전 상태를 복원한다.
  const discardLiveStroke = useCallback(() => {
    const live = drawingRef.current;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    drawingRef.current = null;
    activePtrRef.current = null;
    activePointerTypeRef.current = null;
    predictedPointsRef.current = [];
    clearCanvas(liveCanvasRef.current);
    clearCanvas(predictionCanvasRef.current);
    if (live?.tool === "eraser") replayLayer(live.layer);
  }, [clearCanvas, replayLayer]);

  // 진행 중인 stroke를 지금 즉시 '완성'으로 커밋한다. 포인터 업뿐 아니라 undo/redo/전체
  // 지우기/리사이즈 직전에도 호출 — replayAll이 live 획을 날린 채 drawnIdxRef만 앞서 있는
  // 불일치(그리던 선이 증발)를 원천 차단한다(G3b-r BLOCKER).
  const finishLiveStroke = useCallback(() => {
    const live = drawingRef.current;
    if (!live) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    drawingRef.current = null;
    activePtrRef.current = null;
    activePointerTypeRef.current = null;
    predictedPointsRef.current = [];
    clearCanvas(predictionCanvasRef.current);
    if (live.tool !== "eraser") {
      // 펜·형광펜·도형: 라이브 → 자기 레이어 committed로 한 번에 옮긴다.
      // (펜도 라이브 전체 리드로 — 증분 커밋은 '임시 직선 꼬리'가 committed에 남아
      //  그리는 동안 울퉁불퉁했다가 재생 때만 매끈해지는 불일치를 만들었다.)
      clearCanvas(liveCanvasRef.current);
      const ctx = scaledCtx(canvasOf(live.layer));
      if (ctx) drawStroke(ctx, live);
    } else {
      // 지우개: 남은 꼬리 구간 마저 커밋(-2: 중점 베지어 조각이 이웃 2점 참조 — 이음 보존).
      const from = Math.max(0, drawnIdxRef.current - 2);
      if (live.points.length > drawnIdxRef.current || drawnIdxRef.current === 0) {
        const segment: Stroke = { ...live, points: live.points.slice(from) };
        const ctx = scaledCtx(canvasOf(live.layer));
        if (ctx) drawStroke(ctx, segment);
      }
    }
    if (live.tool === "eraser") {
      // 지우개는 장면에 남기지 않는다 — **지운 것을 실제로 덜어낸다**(2026-08-05 사용자 지적:
      // "지운 게 왜 선택되냐"). 예전엔 destination-out 획을 그대로 쌓아 화면에서만 가렸고,
      // 그 획을 옮기면 지운 부분이 되살아났다.
      const before = [...store.strokes()];
      const er = { points: live.points, width: live.width };
      // 그림은 '상자에 닿았나'가 아니라 '칠해진 픽셀을 덮었나'로 본다 — 투명한 여백만 스쳐도
      // 다시 인코딩하고 되돌리기 기록이 쌓이던 것을 막는다(화면은 그대로인데 기록만 늘었다).
      const { next, changed, images } = applyErase(before, er, live.layer, (st, path) => {
        const mask = st.src ? maskFor(st.src) : null;
        if (!mask) return imageHit(st, path); // 마스크를 못 만들면 상자 기준(안전한 쪽)
        return maskHitsEraser(mask, boxOf(st), path);
      });
      if (!changed) return;
      // 그림은 픽셀에 구워 넣는다(기하가 없어 잘라낼 수 없다). 히스토리에 담기 전에 끝낸다.
      const bakedByRef = new Map<Stroke, Stroke>();
      for (const im of images) bakedByRef.set(im, bakeEraseIntoImage(im, er));
      const after = next.map((x) => bakedByRef.get(x) ?? x);
      store.setStrokes(after);
      pushHist({ t: "scene", before, after: [...after] });
      replayLayerFnRef.current(live.layer);
      return;
    }
    store.push(live);
    pushHist({ t: "stroke", stroke: live }); // 중앙 기록이 획 자체도 소유(Ctrl+Z 하나로 전부)
  }, [canvasOf, clearCanvas, scaledCtx, store, pushHist, bakeEraseIntoImage, maskFor]);

  // 리사이즈 → 크기가 실제로 변했을 때만 backing 재할당 + 명령 재생(연속 리사이즈 churn 방지).
  useEffect(() => {
    const inner = boardInnerRef.current;
    if (!inner) return;
    let fitRaf: number | null = null;
    const fit = () => {
      fitRaf = null;
      // (줌 롤백으로 원래 측정으로 복귀 — clientWidth는 content box라 스크롤바 루프가 없다.)
      const cssW = inner.clientWidth;
      const cssH = inner.clientHeight;
      // 동적 레이어 수 + 라이브/예측 캔버스가 backing-store 총예산을 나눠 쓴다.
      const scale = backingScale(
        cssW,
        cssH,
        window.devicePixelRatio || 1,
        Math.max(1, layers.length + 2)
      );
      const W = Math.round(cssW * scale);
      const H = Math.round(cssH * scale);
      // 크기가 다른 캔버스만 재할당(새로 추가된 레이어 캔버스 포함 — width 0으로 마운트됨).
      let dirty = false;
      for (const canvas of [
        ...layerCanvases.current.values(),
        liveCanvasRef.current,
        predictionCanvasRef.current
      ]) {
        if (!canvas) continue;
        if (canvas.width === W && canvas.height === H) continue;
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        dirty = true;
      }
      const last = lastFitRef.current;
      if (!dirty && last.w === cssW && last.h === cssH && last.scale === scale) return;
      // 리사이즈 도중 그리던 획은 먼저 완성 커밋 — 안 하면 replay가 live를 날려 선이 증발.
      finishLiveStroke();
      lastFitRef.current = { w: cssW, h: cssH, scale };
      scaleRef.current = scale;
      replayAll();
    };
    const schedule = () => {
      if (fitRaf === null) fitRaf = requestAnimationFrame(fit);
    };
    fit();
    const ro = new ResizeObserver(schedule);
    ro.observe(inner);
    return () => {
      ro.disconnect();
      if (fitRaf !== null) cancelAnimationFrame(fitRaf);
    };
    // activeLayerId: 라이브 캔버스가 '활성 레이어 바로 위' 조건부 마운트라, 레이어를
    // 바꾸면 새 canvas(기본 300×150)로 재마운트된다 — 여기서 다시 사이징해야
    // 다른 레이어에서 그릴 때 잉크가 즉시(올바른 스케일로) 보인다.
  }, [replayAll, finishLiveStroke, layers, activeLayerId]);

  // 닫힘 = unmount = 소멸(계약 3): stroke 메모리·타이머·rAF를 명시적으로 해제한다.
  useEffect(() => {
    const auto = autoRef.current; // cleanup에서 ref 재읽기 경고 회피(ref 객체 자체는 불변)
    return () => {
      store.dispose();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (clearArmTimer.current !== null) window.clearTimeout(clearArmTimer.current);
      if (auto.raf !== null) cancelAnimationFrame(auto.raf);
      if (layerDragScrollRafRef.current !== null) {
        cancelAnimationFrame(layerDragScrollRafRef.current);
      }
      layerDragReleaseGuardRef.current?.();
      layerDragGhostRef.current?.remove();
      if (layerDragBodySelectRef.current !== null) {
        document.body.style.userSelect = layerDragBodySelectRef.current;
      }
    };
  }, [store]);

  // 그림판 문법: 펜/형광펜/지우개 전부 '활성 레이어'에만 작용. 활성 레이어가 없거나
  // 잠김/숨김이면 그리기 차단.
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;
  const toolBlocked =
    tool !== "select" && (!activeLayer || !activeLayer.vis);
  const activeLayerName = bgActive ? "일정" : (activeLayer?.name ?? "레이어 없음");

  // 도구 버튼이 켜졌는데 일정/잠금/숨김 레이어라 실제 입력은 막히는 dead state를 없앤다.
  // 사용자 레이어 의도를 존중해 자동 생성·잠금 해제·표시 전환은 하지 않는다.
  // ── 스포이드 ──────────────────────────────────────────────────────────────
  // 도구(BroadcastTool)로 만들지 않는다. 스포이드는 획을 남기지 않고 색만 집어 오는 '한 번의 동작'이라,
  // 도구 타입에 넣으면 그리기·재생·내보내기의 모든 분기가 "이건 그릴 게 없다"를 따로 처리해야 한다.
  // 대신 모드 하나로 두고, 집으면 원래 도구로 돌아온다(Procreate·포토샵의 Alt 집기와 같은 감촉).
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  pickingRef.current = picking;
  const [pickPreview, setPickPreview] = useState<{ x: number; y: number; hex: string } | null>(null);

  const toHex = (r: number, g: number, b: number): string =>
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  /** 화면 좌표 아래의 색. 그림 레이어를 위에서부터 훑고, 투명하면 그 아래 DOM 색을 읽는다. */
  const sampleColorAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      // 1) 그림 레이어 — 스택 위(z 큰 것)부터. 불투명한 픽셀을 처음 만나면 그게 보이는 색이다.
      const order = [...stackRef.current].filter((id) => id !== BG_LAYER_ID);
      for (const id of order) {
        const layer = layersRef.current.find((l) => l.id === id);
        if (!layer?.vis) continue;
        const canvas = layerCanvases.current.get(id);
        if (!canvas) continue;
        const rect = canvas.getBoundingClientRect();
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          continue;
        }
        // 캔버스 픽셀은 CSS 픽셀이 아니다 — 실제 버퍼 크기 비율로 환산한다(확대·DPR 모두 흡수).
        const px = Math.round(((clientX - rect.left) / rect.width) * canvas.width);
        const py = Math.round(((clientY - rect.top) / rect.height) * canvas.height);
        try {
          const d = canvas.getContext("2d")?.getImageData(px, py, 1, 1).data;
          // 형광펜처럼 반투명한 획도 '집을 수 있는 색'이다. 다만 거의 투명하면 아래를 본다.
          if (d && d[3] > 24) return toHex(d[0], d[1], d[2]);
        } catch {
          // 외부 출처 그림이 섞이면 캔버스가 오염돼 읽기가 막힌다 — 아래 DOM 경로로 넘어간다.
        }
      }
      // 2) DOM — 날짜 카드·태그 색처럼 캔버스가 아닌 표면. 투명하지 않은 첫 배경색을 쓴다.
      // elementsFromPoint(복수)를 쓴다: 판 위에는 투명한 입력면이 늘 덮여 있어 단수 버전은
      // 항상 그 면만 준다. 입력면·캔버스·커서 오버레이는 건너뛰고 진짜 그려진 표면부터 본다.
      const hits = document.elementsFromPoint(clientX, clientY) as HTMLElement[];
      for (const hit of hits) {
        if (hit.closest(".bp-draw-surface") || hit.tagName === "CANVAS") continue;
        let el: HTMLElement | null = hit;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/rgba?\(([^)]+)\)/);
          if (m) {
            const parts = m[1].split(",").map((v) => parseFloat(v.trim()));
            const alpha = parts[3] ?? 1;
            if (alpha > 0.05) return toHex(parts[0] | 0, parts[1] | 0, parts[2] | 0);
          }
          el = el.parentElement;
        }
      }
      return null;
    },
    []
  );

  /** 집어서 펜 색으로. 집고 나면 스포이드는 스스로 꺼진다(계속 집는 모드가 아니다). */
  const pickColorAt = useCallback(
    (clientX: number, clientY: number): boolean => {
      const hex = sampleColorAt(clientX, clientY);
      setPicking(false);
      setPickPreview(null);
      if (!hex) return false;
      hapticTick();
      setPenColor(hex);
      return true;
    },
    [sampleColorAt]
  );

  function activateDrawingTool(nextTool: BroadcastTool) {
    const layerId = resolveWritableDrawingLayerId(
      layersRef.current,
      activeLayerIdRef.current,
      lastDrawingLayerIdRef.current
    );
    if (layerId && layerId !== activeLayerIdRef.current) setActiveLayerId(layerId);
    setTool(nextTool);
  }

  function applyInkColor(hex: string) {
    setPenColor(hex);
    activateDrawingTool(toolAfterInkColorPick(tool));
  }

  function restoreColorPickerContext(context: NonNullable<typeof colorPop>) {
    setPenColor(context.openedWith);
    setTool(context.openedWithTool);
    const layerStillExists =
      context.openedWithLayerId === BG_LAYER_ID ||
      layersRef.current.some((layer) => layer.id === context.openedWithLayerId);
    if (layerStillExists) setActiveLayerId(context.openedWithLayerId);
    setColorPop(null);
  }

  // rAF 병합 플러시 — move마다가 아니라 프레임당 한 번만 그린다(G3b).
  const flushDraw = useCallback(() => {
    rafRef.current = null;
    clearCanvas(predictionCanvasRef.current);
    const live = drawingRef.current;
    if (!live) return;
    if (live.tool === "pen") {
      // 펜: 라이브 캔버스에 '확정 조각만' 증분 — 통째 리드로는 긴 낙서에서 프레임을
      // 밀려 잉크가 늦게 보였다. 임시 꼬리를 안 그리므로 울퉁불퉁 잔재도 없다.
      const ctx = scaledCtx(liveCanvasRef.current);
      if (ctx) drawnIdxRef.current = drawPenIncremental(ctx, live, drawnIdxRef.current);
      // 예측점은 확정 획과 분리된 임시 캔버스에만 그린다. 다음 실제 이벤트마다 통째로
      // 교체하므로 잘못된 예측이 히스토리·내보내기·레이어 비트맵에 남지 않는다.
      const predicted = predictedPointsRef.current;
      if (predicted.length > 0) {
        const previewCtx = scaledCtx(predictionCanvasRef.current);
        if (previewCtx) drawPenPrediction(previewCtx, live, predicted);
      }
      return;
    }
    if (live.tool === "hl" || isShapeTool(live.tool)) {
      // 형광펜(이음매 진해짐 방지)·도형(끝점이 계속 바뀜): 라이브 캔버스에 통째로 다시.
      clearCanvas(liveCanvasRef.current);
      const ctx = scaledCtx(liveCanvasRef.current);
      if (ctx) drawStroke(ctx, live);
      return;
    }
    // 지우개: 새 구간만 자기 레이어 committed 캔버스에 증분 렌더(라이브 캔버스로는
    // destination-out이 committed 픽셀을 못 지운다).
    // -2 겹침: 중점 베지어 조각이 이웃 2점을 참조 — 겹친 조각은 같은 기하의 재도장.
    if (drawnIdxRef.current !== 0 && drawnIdxRef.current >= live.points.length) return; // 새 점 없음
    const from = Math.max(0, drawnIdxRef.current - 2);
    const segment: Stroke = { ...live, points: live.points.slice(from) };
    const ctx = scaledCtx(canvasOf(live.layer));
    if (ctx) drawStroke(ctx, segment);
    drawnIdxRef.current = live.points.length;
  }, [canvasOf, clearCanvas, scaledCtx]);
  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushDraw);
  }, [flushDraw]);

  // 아이패드 펜촉 벤치마킹 — 점마다 굵기 배율(0..1)을 기록한다:
  // 펜 디바이스(스타일러스)는 실제 필압, 마우스/터치는 속도 역산(빨리 그으면 가늘고
  // 천천히 누르면 굵게 — 만년필 감각). 저역 필터로 배율이 튀지 않게 한다.
  const strokeDynRef = useRef({ t: 0, x: 0, y: 0, f: 0.75 });
  function widthFactor(
    e: { pointerType: string; pressure: number; timeStamp: number },
    x: number,
    y: number
  ): number {
    if (e.pointerType === "pen") {
      // 제품 기본 감마 곡선(^0.65) + 시간 기반 EMA. 고정 샘플 비율 대신 경과 시간을 써
      // 60Hz와 240Hz 입력에서 같은 시간 동안 같은 필압 응답을 낸다.
      const d = strokeDynRef.current;
      const raw = mapPenPressure(e.pressure);
      const f = smoothPressure(d.f, raw, e.timeStamp - d.t);
      strokeDynRef.current = { t: e.timeStamp, x, y, f };
      return f;
    }
    const d = strokeDynRef.current;
    const dt = Math.max(1, e.timeStamp - d.t);
    const v = Math.hypot(x - d.x, y - d.y) / dt; // px/ms
    const target = Math.min(1, Math.max(0.3, 1 - v / 1.7));
    const f = d.f * 0.65 + target * 0.35;
    strokeDynRef.current = { t: e.timeStamp, x, y, f };
    return f;
  }
  // 미니 달력 '오늘' 링용 — 패널을 KST 자정 너머 계속 열어도 다음 날짜로 이동한다.
  const [todayIso, setTodayIso] = useState(() => getTodayKst());
  useEffect(() => {
    let timer: number | null = null;
    const armKstMidnight = () => {
      const now = Date.now();
      const nextMidnight =
        (Math.floor((now + KST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - KST_OFFSET_MS;
      timer = window.setTimeout(() => {
        setTodayIso(getTodayKst());
        armKstMidnight();
      }, nextMidnight - now + 100);
    };
    armKstMidnight();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  // 현재 펜 색이 도구 칩에 스밀 때의 아이콘 색 — WCAG 선형 sRGB 상대휘도로 흑/백 중
  // 대비가 높은 쪽을 고른다. 중립 외곽선은 흰색 잉크도 흰 툴바에서 사라지지 않게 한다.
  const activeInkStyle = useMemo(() => {
    return {
      background: penColor,
      color: inkContrast(penColor).ink,
      boxShadow: `0 0 0 2px var(--surface), 0 0 0 3px var(--ink-soft), 0 2px 8px ${penColor}66`
    } as const;
  }, [penColor]);

  // 파밍 리젝션(연구 아카이브 §3): 펜(스타일러스) 입력이 최근에 있었으면 터치로 시작하는
  // 획을 무시한다 — 와콤/아이패드에서 캔버스에 손바닥을 얹고 쓰는 자세 지원(OS 1차 거름 +
  // 앱층 한 겹). 마우스는 영향 없음.
  const lastPenContactTsRef = useRef<number | null>(null);

  // 지우개 커서 — 실제 지워지는 지름(펜 굵기×5)의 원. 브라우저 커서 상한(128px) 안에서 clamp.
  const eraserCursor = useMemo(() => {
    const dia = Math.max(8, Math.min(96, Math.round(penWidth * 5)));
    const r = dia / 2;
    const svg =
      `%3Csvg xmlns='http://www.w3.org/2000/svg' width='${dia + 4}' height='${dia + 4}'%3E` +
      `%3Ccircle cx='${r + 2}' cy='${r + 2}' r='${r}' fill='rgba(255,255,255,0.35)' ` +
      `stroke='%234b4468' stroke-width='1.5'/%3E%3C/svg%3E`;
    return `url("data:image/svg+xml;charset=utf-8,${svg}") ${r + 2} ${r + 2}, crosshair`;
  }, [penWidth]);

  const StylusCursorIcon =
    tool === "pen"
      ? Pen
      : tool === "hl"
        ? Highlighter
        : tool === "eraser"
          ? Eraser
          : tool === "line"
            ? Slash
            : tool === "arrow"
              ? MoveUpRight
              : tool === "rect"
                ? Square
                : tool === "ellipse"
                  ? Circle
                  : MousePointer2;

  // 마우스의 CSS cursor는 스타일러스 접촉에서 보장되지 않는다. React state를 240Hz로 갱신하지
  // 않고 DOM transform만 바꿔, pen hover/접촉 위치에 도구 footprint와 아이콘을 띄운다.
  function updateStylusCursor(e: React.PointerEvent<HTMLDivElement>, boardRect?: DOMRect | null) {
    const activePenPointerId =
      activePointerTypeRef.current === "pen" ? activePtrRef.current : null;
    const action = resolveStylusCursorAction(
      e.pointerType,
      e.pointerId,
      activePenPointerId,
      tool,
      toolBlocked
    );
    if (action !== "show") {
      if (action === "hide") hideStylusCursor();
      return;
    }
    const cursor = stylusCursorRef.current;
    if (!cursor) return;
    const rect = boardRect ?? boardInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cursorSize = `${stylusCursorDiameter(tool, penWidth)}px`;
    if (cursor.style.getPropertyValue("--bp-stylus-size") !== cursorSize) {
      cursor.style.setProperty("--bp-stylus-size", cursorSize);
    }
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    const contact = isPenContact(e.pointerType, e.pressure, e.buttons)
      ? "true"
      : "false";
    if (cursor.dataset.contact !== contact) cursor.dataset.contact = contact;
    stylusCursorPointerIdRef.current = e.pointerId;
    if (!drawSurfaceRef.current?.classList.contains("stylus-active")) {
      drawSurfaceRef.current?.classList.add("stylus-active");
    }
    if (!cursor.classList.contains("visible")) cursor.classList.add("visible");
  }

  function hideStylusCursor(e?: React.PointerEvent<HTMLDivElement>) {
    if (e && e.pointerType !== "pen") return;
    if (
      e &&
      stylusCursorPointerIdRef.current !== null &&
      e.pointerId !== stylusCursorPointerIdRef.current
    ) {
      return;
    }
    stylusCursorPointerIdRef.current = null;
    drawSurfaceRef.current?.classList.remove("stylus-active");
    stylusCursorRef.current?.classList.remove("visible");
  }

  function onDrawPointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    // capture 중에는 표면 밖에서도 획과 커서가 펜촉을 따라간다. up/cancel에서 숨긴다.
    if (e.pointerType === "pen" && e.pointerId !== activePtrRef.current) {
      hideStylusCursor(e);
    }
  }

  useEffect(() => {
    // 도구·레이어·굵기 전환 직전 위치에 이전 footprint가 얼어붙지 않게 한다.
    stylusCursorPointerIdRef.current = null;
    drawSurfaceRef.current?.classList.remove("stylus-active");
    stylusCursorRef.current?.classList.remove("visible");
  }, [tool, toolBlocked, activeLayerId, penWidth]);

  function onDrawDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = boardInnerRef.current?.getBoundingClientRect() ?? null;
    updateStylusCursor(e, rect);
    // 스포이드 모드거나 Alt를 누른 채면 색만 집고 획은 시작하지 않는다(Alt 집기 = 그림판 관례).
    if (e.button === 0 && (picking || e.altKey)) {
      e.preventDefault();
      e.stopPropagation();
      pickColorAt(e.clientX, e.clientY);
      return;
    }
    if (tool === "select" || !activeLayer || toolBlocked || e.button !== 0) return;
    const penContact = isPenContact(e.pointerType, e.pressure, e.buttons);
    if (penContact) lastPenContactTsRef.current = e.timeStamp;
    if (drawingRef.current !== null) {
      // 손바닥이 먼저 닿았어도 실제 펜촉이 우선한다. 진행 중 터치 획은 기록 없이 버리고,
      // 터치 지우개가 건드린 레이어는 discardLiveStroke가 재생해 원상 복구한다.
      if (penContact && activePointerTypeRef.current === "touch") {
        const stalePointerId = activePtrRef.current;
        discardLiveStroke();
        if (
          stalePointerId !== null &&
          e.currentTarget.hasPointerCapture(stalePointerId)
        ) {
          e.currentTarget.releasePointerCapture(stalePointerId);
        }
      } else {
        return;
      }
    }
    if (
      shouldIgnoreTouchAfterPen(
        e.pointerType,
        e.timeStamp,
        lastPenContactTsRef.current
      )
    ) {
      e.preventDefault();
      return;
    }
    if (!rect) return;
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // 색 채우기: 끄는 동작이 없다 — 누른 그 자리에서 한 번에 끝나고 stroke 한 줄로 기록된다
    // (되돌리기·리사이즈 재생이 다른 도구와 똑같이 동작한다).
    if (tool === "fill") {
      e.preventDefault();
      const patch = makeFillPatch(canvasOf(activeLayer.id), { x: p.x, y: p.y }, penColor);
      if (patch) {
        const stroke: Stroke = { ...patch, layer: activeLayer.id };
        store.push(stroke);
        pushHist({ t: "stroke", stroke }); // 다른 획과 같은 Ctrl+Z 하나로 되돌린다
        // 조각을 디코드 캐시에 미리 넣는다 — 다음 재생(선택·되돌리기·리사이즈)에서 한 프레임
        // 비어 보이지 않게. 화면은 위 putImageData로 이미 채워져 있다.
        if (stroke.src && !imgCache.current.has(stroke.src)) {
          const el = new Image();
          el.onload = () => replayLayerFnRef.current(activeLayer.id);
          imgCache.current.set(stroke.src, el);
          el.src = stroke.src;
        }
      }
      return;
    }
    activePtrRef.current = e.pointerId;
    activePointerTypeRef.current = e.pointerType;
    e.currentTarget.setPointerCapture(e.pointerId);
    predictedPointsRef.current = [];
    const f0 = e.pointerType === "pen" ? mapPenPressure(e.pressure) : 0.8;
    strokeDynRef.current = { t: e.timeStamp, x: p.x, y: p.y, f: f0 };
    drawingRef.current = {
      tool: tool as Stroke["tool"],
      layer: activeLayer.id, // 활성 레이어에만(지우개 포함 — 그림판 문법)
      color: penColor,
      width: tool === "hl" ? penWidth * 3.5 : tool === "eraser" ? penWidth * 5 : penWidth,
      points: [{ x: p.x, y: p.y, p: f0 }]
    };
    drawnIdxRef.current = 0; // 첫 점(탭 점)부터 증분 렌더 대상
    scheduleFlush();
  }
  function onDrawMove(e: React.PointerEvent<HTMLDivElement>) {
    // 집기 전에 무슨 색인지 보여준다 — 안 보여주면 "집었는데 저 색이 아니네"를 되돌리기로 고쳐야 한다.
    if (picking) {
      const hex = sampleColorAt(e.clientX, e.clientY);
      // 좌표는 **판 기준 상대값**으로 둔다. 판은 확대/축소 변환 안에 있어서 뷰포트 좌표(fixed)를
      // 쓰면 그 변환만큼 어긋난 자리에 뜬다(실측: 커서에서 300px 옆).
      const r = boardInnerRef.current?.getBoundingClientRect();
      setPickPreview(
        hex && r ? { x: e.clientX - r.left, y: e.clientY - r.top, hex } : null
      );
      return;
    }
    const pendingLive = drawingRef.current;
    const rect =
      e.pointerType === "pen" || pendingLive
        ? boardInnerRef.current?.getBoundingClientRect() ?? null
        : null;
    updateStylusCursor(e, rect);
    if (isPenContact(e.pointerType, e.pressure, e.buttons)) {
      lastPenContactTsRef.current = e.timeStamp;
    }
    const live = pendingLive;
    if (!live || e.pointerId !== activePtrRef.current) return;
    if (isShapeTool(live.tool)) {
      if (!rect) return;
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // 도형: 시작점 고정, 끝점만 갱신. Shift = 정비율(45° 선 / 정사각형 / 정원).
      const a = live.points[0];
      let end = p;
      if (e.shiftKey) {
        if (live.tool === "line" || live.tool === "arrow") {
          const dx = p.x - a.x;
          const dy = p.y - a.y;
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          end = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
        } else {
          const s = Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y));
          end = {
            x: a.x + Math.sign(p.x - a.x || 1) * s,
            y: a.y + Math.sign(p.y - a.y || 1) * s
          };
        }
      }
      live.points = [a, end];
      scheduleFlush();
      return;
    }
    // 브라우저가 한 pointermove에 합친 위치 변화는 feature detection 뒤 한 번만 꺼낸다.
    // 반환 샘플의 순서를 그대로 소비하고, 미지원/빈 배열이면 부모 이벤트 하나로 폴백한다.
    const native = e.nativeEvent;
    const coalesced =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    const samples = coalesced.length > 0 ? coalesced : [native];
    if (!rect) return;
    let added = false;
    for (const s of samples) {
      const sp = { x: s.clientX - rect.left, y: s.clientY - rect.top };
      const f = widthFactor(s, sp.x, sp.y);
      if (appendPoint(live.points, { x: sp.x, y: sp.y, p: f })) added = true;
    }
    const previousPredictionCount = predictedPointsRef.current.length;
    const predicted =
      live.tool === "pen" &&
      e.pointerType === "pen" &&
      typeof native.getPredictedEvents === "function"
        ? native.getPredictedEvents()
        : [];
    const lastPressure = live.points[live.points.length - 1]?.p ?? 0.7;
    predictedPointsRef.current = predicted
      .filter((sample) => Number.isFinite(sample.clientX) && Number.isFinite(sample.clientY))
      .map((sample) => ({
        x: sample.clientX - rect.left,
        y: sample.clientY - rect.top,
        p: lastPressure
      }));
    if (added || previousPredictionCount > 0 || predictedPointsRef.current.length > 0) {
      scheduleFlush();
    }
  }
  function endDraw(e?: React.PointerEvent<HTMLDivElement>) {
    hideStylusCursor(e);
    if (!drawingRef.current) return;
    if (e && e.pointerId !== activePtrRef.current) return; // 다른 포인터의 up 무시
    if (e && activePointerTypeRef.current === "pen") {
      lastPenContactTsRef.current = e.timeStamp;
    }
    finishLiveStroke();
  }
  function cancelDraw(e: React.PointerEvent<HTMLDivElement>) {
    hideStylusCursor(e);
    if (!drawingRef.current || e.pointerId !== activePtrRef.current) return;
    if (activePointerTypeRef.current === "pen") {
      lastPenContactTsRef.current = e.timeStamp;
    }
    discardLiveStroke();
  }
  const doUndo = useCallback(() => {
    finishLiveStroke(); // 그리던 획 먼저 완성 — replay가 live를 날리는 불일치 방지(G3b-r)
    const a = histRef.current.undo();
    if (!a) return;
    if (a.t === "stroke") {
      const before = store.strokes();
      const index = before.lastIndexOf(a.stroke);
      // 통합 히스토리와 장면이 예상 밖으로 어긋나면 액션 이동도 되돌려 fail-closed.
      if (index < 0) {
        histRef.current.redo();
        return;
      }
      store.setStrokes([...before.slice(0, index), ...before.slice(index + 1)]);
      replayAll();
    } else if (a.t === "cols") {
      setCols(new Map(a.before));
      if (a.chips) setChipDy(new Map(a.chips.before));
    } else if (a.t === "chips") {
      setChipDy(new Map(a.before));
    } else if (a.t === "sent") {
      // cols 먼저 복원 — sentDateKeys prop 변화로 도는 동기화 effect가 '이전 cols'를 읽어
      // 복원된 위치를 유지한다(빠졌다 돌아온 날짜의 자리 보존).
      setCols(new Map(a.colsBefore));
      onRestoreSent(a.before);
    } else if (a.t === "xform") {
      if (a.cols) setCols(new Map(a.cols.before));
      if (a.chips) setChipDy(new Map(a.chips.before));
      if (a.strokes) {
        a.strokes.targets.forEach((s, i) => {
          const g = a.strokes!.before[i];
          s.points = g.points.map((pt) => ({ ...pt }));
          s.width = g.width;
        });
        replayAll();
      }
    } else if (a.t === "scene") {
      store.setStrokes(a.before);
      setStrokeSel([]); // 분할 전으로 돌아가면 분할 조각 선택은 무효
      replayAll();
    } else {
      setLayers(a.before);
      // 일정은 목록 밖 고정 레이어라 그대로 유지. 사라진 그림 레이어만 사용 가능 레이어로 복귀.
      if (activeLayerId !== BG_LAYER_ID && !a.before.some((l) => l.id === activeLayerId)) {
        const fallback = resolveDrawingLayerAfterRemoval(
          a.before,
          lastDrawingLayerIdRef.current
        );
        setActiveLayerId(fallback ?? BG_LAYER_ID);
        if (!fallback) setTool("select");
      }
      // 복원된 레이어 캔버스는 다음 렌더에 마운트 → fit effect(deps: layers)가 사이징+재생.
    }
    hapticTick();
    setStrokeVersion((v) => v + 1);
  }, [store, replayAll, finishLiveStroke, onRestoreSent, activeLayerId]);
  const doRedo = useCallback(() => {
    finishLiveStroke();
    const a = histRef.current.redo();
    if (!a) return;
    if (a.t === "stroke") {
      if (store.strokes().includes(a.stroke)) {
        histRef.current.undo();
        return;
      }
      store.setStrokes([...store.strokes(), a.stroke]);
      replayAll();
    } else if (a.t === "cols") {
      setCols(new Map(a.after));
      if (a.chips) setChipDy(new Map(a.chips.after));
    } else if (a.t === "chips") {
      setChipDy(new Map(a.after));
    } else if (a.t === "sent") {
      onRestoreSent(a.after);
    } else if (a.t === "xform") {
      if (a.cols) setCols(new Map(a.cols.after));
      if (a.chips) setChipDy(new Map(a.chips.after));
      if (a.strokes) {
        a.strokes.targets.forEach((s, i) => {
          const g = a.strokes!.after[i];
          s.points = g.points.map((pt) => ({ ...pt }));
          s.width = g.width;
        });
        replayAll();
      }
    } else if (a.t === "scene") {
      store.setStrokes(a.after);
      setStrokeSel([]);
      replayAll();
    } else {
      setLayers(a.after);
      if (activeLayerId !== BG_LAYER_ID && !a.after.some((l) => l.id === activeLayerId)) {
        const fallback = resolveDrawingLayerAfterRemoval(
          a.after,
          lastDrawingLayerIdRef.current
        );
        setActiveLayerId(fallback ?? BG_LAYER_ID);
        if (!fallback) setTool("select");
      }
    }
    hapticTick();
    setStrokeVersion((v) => v + 1);
  }, [store, replayAll, finishLiveStroke, onRestoreSent, activeLayerId]);
  // 전체 지우기 = 2단계: 첫 클릭은 무장(3초 내 재클릭만 실행) — undo 불가·잠긴 레이어까지
  // 지우는 파괴적 동작이라 원클릭 금지(G3b).
  const doClearAll = useCallback(() => {
    finishLiveStroke();
    if (!clearArmed) {
      setClearArmed(true);
      hapticTick();
      if (clearArmTimer.current !== null) window.clearTimeout(clearArmTimer.current);
      clearArmTimer.current = window.setTimeout(() => setClearArmed(false), 3000);
      return;
    }
    if (clearArmTimer.current !== null) window.clearTimeout(clearArmTimer.current);
    setClearArmed(false);
    store.clearAll();
    // 전체 지우기는 획을 전부 소거 — 획을 참조하는 히스토리도 함께 무효라 통째로 비운다.
    histRef.current.clear();
    hapticTick();
    setStrokeVersion((v) => v + 1);
    replayAll();
  }, [clearArmed, store, replayAll, finishLiveStroke]);

  // ── 레이어 추가/삭제/순서(그림판 문법: 자유롭게) ──
  function addLayer() {
    hapticTick();
    layerSeq.current += 1;
    const id = `layer-${layerSeq.current}`;
    const before = layersRef.current;
    const after = [{ id, name: `레이어 ${layerSeq.current}`, vis: true }, ...before];
    pendingLayerRevealRef.current = { id, position: "top" };
    // 새 레이어가 목록 맨 위로 들어오니 그 아래 있던 일정 레이어도 한 칸 밀린다. 안 밀면
    // 일정이 제자리(고정 인덱스)에 남아 사용자가 정한 위아래 관계가 추가할 때마다 뒤집힌다.
    // 단, 일정이 이미 맨 위면 그대로 둔다 — 그 자리는 사용자가 명시적으로 올려둔 것이다.
    setBgIndex((i) => (i > 0 ? i + 1 : i));
    setLayers(after);
    setActiveLayerId(id); // 새 레이어가 맨 위 + 바로 활성
    setTool(toolAfterEmptyLayerAdded(tool)); // 빈 레이어에서 선택/지우개로 한 번 더 막히지 않게
    pushHist({ t: "layers", before, after });
  }
  function deleteLayer(id: string) {
    // 즉시 삭제 — 단, 획은 store에 남겨둔다(캔버스가 언마운트돼 안 보일 뿐). 그래야
    // Ctrl+Z로 레이어를 복원하면 그 위의 획도 그대로 되살아난다(통합 히스토리).
    finishLiveStroke(); // 그 레이어에 그리던 중이면 완성부터
    const before = layersRef.current;
    const after = before.filter((l) => l.id !== id);
    // 일정 위쪽 레이어가 사라지면 일정도 한 칸 올라와야 위아래 관계가 유지된다.
    const removedAt = stackRef.current.indexOf(id);
    if (removedAt >= 0) setBgIndex((i) => (removedAt < i ? i - 1 : i));
    setLayers(after);
    if (activeLayerId === id) {
      const fallback = resolveDrawingLayerAfterRemoval(
        after,
        lastDrawingLayerIdRef.current
      );
      setActiveLayerId(fallback ?? BG_LAYER_ID);
      if (!fallback) setTool("select");
    }
    pushHist({ t: "layers", before, after });
    hapticTick();
  }

  function moveLayer(id: string, direction: "up" | "down") {
    // 일정 레이어도 목록의 한 칸이라 합친 스택에서 옮기고 다시 갈라 담는다(드롭 경로와 동일).
    const before = layersRef.current;
    const nextStack = reorderDrawingLayer(
      stackRef.current.map((x) => ({ id: x })),
      id,
      direction
    );
    if (!nextStack) return;
    finishLiveStroke();
    const nextIds = nextStack.map((x) => x.id);
    const nextBgIndex = nextIds.indexOf(BG_LAYER_ID);
    const after = nextIds
      .filter((x) => x !== BG_LAYER_ID)
      .map((x) => before.find((l) => l.id === x))
      .filter((l): l is PanelLayer => Boolean(l));
    pendingLayerRevealRef.current = { id, position: "nearest" };
    setBgIndex(nextBgIndex < 0 ? before.length : nextBgIndex);
    if (after.length === before.length && after.some((l, i) => l !== before[i])) {
      setLayers(after);
      pushHist({ t: "layers", before, after });
    }
    const movedName =
      id === BG_LAYER_ID ? "일정" : before.find((layer) => layer.id === id)?.name;
    const movedIndex = nextIds.indexOf(id);
    if (movedName && movedIndex >= 0) {
      setLayerOrderStatus(`${movedName}, 위에서 ${movedIndex + 1}번째로 이동`);
    }
    hapticTick();
  }

  function layerDropBeforeId(
    clientX: number,
    clientY: number
  ): string | null | undefined {
    const list = layerListRef.current;
    const drag = layerDragRef.current;
    if (!list || !drag) return undefined;
    const rect = list.getBoundingClientRect();
    return resolveLayerDropBeforeId(
      clientX,
      clientY,
      rect,
      list.scrollTop,
      drag.slots
    );
  }

  function createLayerDragGhost(drag: NonNullable<typeof layerDragRef.current>) {
    const rect = drag.card.getBoundingClientRect();
    const ghost = drag.card.cloneNode(true) as HTMLElement;
    ghost.className = "bp-layer-drag-ghost";
    ghost.removeAttribute("data-layer-id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.querySelectorAll<HTMLElement>("button").forEach((button) => {
      button.tabIndex = -1;
    });
    // cloneNode는 canvas bitmap을 복사하지 않는다. 유령 썸네일도 원본과 같게 직접 복사.
    const sourceThumb = drag.card.querySelector("canvas");
    const ghostThumb = ghost.querySelector("canvas");
    if (sourceThumb && ghostThumb) {
      ghostThumb.width = sourceThumb.width;
      ghostThumb.height = sourceThumb.height;
      ghostThumb.getContext("2d")?.drawImage(sourceThumb, 0, 0);
    }
    document.body.appendChild(ghost);
    layerDragGhostRef.current = ghost;
    layerDragBodySelectRef.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
  }

  function updateLayerDropSlot(clientX: number, clientY: number) {
    const drag = layerDragRef.current;
    if (!drag?.started) return;
    const beforeId = layerDropBeforeId(clientX, clientY);
    drag.beforeId = beforeId;
    setLayerDragUi((prev) =>
      prev?.id === drag.id && prev.beforeId === beforeId
        ? prev
        : { id: drag.id, beforeId, step: drag.step }
    );
  }

  function layerAutoScrollSpeed(clientX: number, clientY: number): number {
    const list = layerListRef.current;
    if (!list) return 0;
    const rect = list.getBoundingClientRect();
    if (clientX < rect.left - 32 || clientX > rect.right + 32) return 0;
    const edge = 52;
    if (clientY < rect.top - edge || clientY > rect.bottom + edge) return 0;
    if (clientY < rect.top + edge) {
      return -Math.min(14, Math.ceil((rect.top + edge - clientY) / 5));
    }
    if (clientY > rect.bottom - edge) {
      return Math.min(14, Math.ceil((clientY - (rect.bottom - edge)) / 5));
    }
    return 0;
  }

  function runLayerAutoScroll() {
    const drag = layerDragRef.current;
    const list = layerListRef.current;
    const pointer = layerDragPointerRef.current;
    if (!drag?.started || !list || pointer === null) {
      layerDragScrollRafRef.current = null;
      return;
    }
    const speed = layerAutoScrollSpeed(pointer.x, pointer.y);
    if (speed === 0) {
      layerDragScrollRafRef.current = null;
      return;
    }
    const before = list.scrollTop;
    list.scrollTop += speed;
    if (list.scrollTop === before) {
      layerDragScrollRafRef.current = null;
      return;
    }
    updateLayerDropSlot(pointer.x, pointer.y);
    layerDragScrollRafRef.current = requestAnimationFrame(runLayerAutoScroll);
  }

  const cleanupLayerDrag = useCallback(() => {
    if (layerDragScrollRafRef.current !== null) {
      cancelAnimationFrame(layerDragScrollRafRef.current);
      layerDragScrollRafRef.current = null;
    }
    layerDragPointerRef.current = null;
    layerDragGhostRef.current?.remove();
    layerDragGhostRef.current = null;
    if (layerDragBodySelectRef.current !== null) {
      document.body.style.userSelect = layerDragBodySelectRef.current;
      layerDragBodySelectRef.current = null;
    }
    layerDragRef.current = null;
    setLayerDragUi(null);
  }, []);

  const guardLayerClickUntilPointerRelease = useCallback((pointerId: number) => {
    layerDragReleaseGuardRef.current?.();
    layerDragClickBlockedRef.current = true;
    const remove = () => {
      window.removeEventListener("pointerup", onRelease, true);
      window.removeEventListener("pointercancel", onRelease, true);
      if (layerDragReleaseGuardRef.current === remove) {
        layerDragReleaseGuardRef.current = null;
      }
    };
    const onRelease = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      remove();
      window.setTimeout(() => {
        if (!layerDragRef.current) layerDragClickBlockedRef.current = false;
      }, 0);
    };
    window.addEventListener("pointerup", onRelease, true);
    window.addEventListener("pointercancel", onRelease, true);
    layerDragReleaseGuardRef.current = remove;
  }, []);

  function onLayerPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (layerDragRef.current) return;
    const card = e.currentTarget.closest<HTMLElement>(".bp-layer-item");
    const list = layerListRef.current;
    if (!card || !list) return;
    // 포인터 클릭이 focus-visible 링(썸네일 둘레 보라 박스)을 남기지 않게 — 클릭 선택은
    // onClick이 처리하고, 키보드 포커스(Tab) 경로는 그대로 살아 있다.
    e.preventDefault();
    layerDragClickBlockedRef.current = false;
    const rect = card.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const slots = Array.from(
      list.querySelectorAll<HTMLElement>("[data-layer-id]")
    ).flatMap((candidate) => {
      const candidateId = candidate.dataset.layerId;
      if (!candidateId || candidateId === id) return [];
      const candidateRect = candidate.getBoundingClientRect();
      return [{
        id: candidateId,
        midpoint:
          candidateRect.top -
          listRect.top +
          list.scrollTop +
          candidateRect.height / 2
      }];
    });
    layerDragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetY: e.clientY - rect.top,
      card,
      trigger: e.currentTarget,
      started: false,
      beforeId: undefined,
      // 한 칸 = 카드 높이 + 목록 간격(8). ⚠ 슬롯 midpoint 차이로 재면 드래그 카드가
      // 사이에 낀 구간은 간격이 2배로 잡혀 형제가 두 칸씩 날아갔다(실사용 버그).
      step: rect.height + 8,
      slots
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onLayerPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
      drag.started = true;
      layerDragClickBlockedRef.current = true;
      createLayerDragGhost(drag);
      hapticTick();
    }
    e.preventDefault();
    layerDragPointerRef.current = { x: e.clientX, y: e.clientY };
    updateLayerDropSlot(e.clientX, e.clientY);
    const scrollSpeed = layerAutoScrollSpeed(e.clientX, e.clientY);
    if (scrollSpeed !== 0 && layerDragScrollRafRef.current === null) {
      layerDragScrollRafRef.current = requestAnimationFrame(runLayerAutoScroll);
    } else if (scrollSpeed === 0 && layerDragScrollRafRef.current !== null) {
      cancelAnimationFrame(layerDragScrollRafRef.current);
      layerDragScrollRafRef.current = null;
    }
    const ghost = layerDragGhostRef.current;
    if (ghost) ghost.style.top = `${e.clientY - drag.offsetY}px`;
  }

  function onLayerPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const started = drag.started;
    const beforeId = drag.beforeId;
    cleanupLayerDrag();
    if (started) {
      window.setTimeout(() => {
        if (!layerDragRef.current) layerDragClickBlockedRef.current = false;
      }, 0);
    }
    if (!started || beforeId === undefined) return;
    e.preventDefault();
    // 일정 레이어(카드)도 같은 목록에서 끈다 — 그림 레이어 배열에는 없으므로, 합친 스택으로
    // 순서를 계산한 뒤 '그림 레이어 순서'와 '일정 레이어 위치'로 다시 갈라 담는다.
    // (카드용 가짜 항목을 layers에 넣으면 캔버스 생성·재생·삭제 경로가 전부 흔들린다.)
    const before = layersRef.current;
    const combined = stackRef.current.map((id) => ({ id }));
    const nextStack = reorderDrawingLayerBefore(combined, drag.id, beforeId);
    if (!nextStack) return;
    finishLiveStroke();
    const nextIds = nextStack.map((x) => x.id);
    const nextBgIndex = nextIds.indexOf(BG_LAYER_ID);
    const after = nextIds
      .filter((id) => id !== BG_LAYER_ID)
      .map((id) => before.find((l) => l.id === id))
      .filter((l): l is PanelLayer => Boolean(l));
    setBgIndex(nextBgIndex < 0 ? before.length : nextBgIndex);
    if (after.length === before.length && after.some((l, i) => l !== before[i])) {
      setLayers(after);
      pushHist({ t: "layers", before, after });
    }
    const movedIndex = nextIds.indexOf(drag.id);
    const movedName =
      drag.id === BG_LAYER_ID ? "일정" : (before.find((l) => l.id === drag.id)?.name ?? "레이어");
    if (movedIndex >= 0) {
      setLayerOrderStatus(`${movedName}, 위에서 ${movedIndex + 1}번째로 이동`);
    }
    hapticTick();
  }

  function onLayerPointerCancel(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    layerDragClickBlockedRef.current = false;
    cleanupLayerDrag();
  }

  function onLayerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    moveLayer(id, e.key === "ArrowUp" ? "up" : "down");
  }

  function toggleLayerVisibility(id: string) {
    const current = layersRef.current.find((l) => l.id === id);
    if (!current) return;
    const willHide = current.vis;
    if (id === activeLayerIdRef.current && willHide) setStrokeSel([]);
    hapticTick();
    setLayers((ls) => ls.map((x) => (x.id === id ? { ...x, vis: !x.vis } : x)));
  }

  const eventsByDate = useMemo(
    () => new Map(days.map((d) => [d.dateKey, d.events] as const)),
    [days]
  );
  const sentDateSet = useMemo(() => new Set(sentDateKeys), [sentDateKeys]);

  // 미니 달력 다중선택 — 편집 그리드와 완전히 분리된 자체 인스턴스(D2).
  // 보내기 버튼은 exempt: 누르는 순간 onDocDown이 선택을 지우는 것 방지(D2-b).
  // escapeClears:false — Esc 의미(선택 해제 vs 닫기)는 아래 단일 핸들러가 결정한다(G3a:
  // 훅·패널 핸들러가 경쟁하면 리스너 순서와 오래된 ref 읽기에 의존하게 된다).
  const rangeSelect = useCellRangeSelect<HTMLDivElement>({
    exemptRefs: [sendBtnRef],
    escapeClears: false,
    // 날짜 피커는 다중 선택이 기본 의도 — 수식키 없는 클릭도 개별 토글(체크박스 문법).
    clickToggles: true
  });

  const selectedDateKeys = useCallback(() => {
    const out: string[] = [];
    for (const i of rangeSelect.getSelected()) {
      const cell = cells[i];
      // 전월/익월 회색 날짜도 선택 허용 — 주역은 아니어도 월 경계에 걸친 방송 설명에 필요.
      if (cell) out.push(cell.isoDate);
    }
    return out;
  }, [cells, rangeSelect]);
  const selectedDateKeysNow = selectedDateKeys();
  const sendableDateCount = selectedDateKeysNow.filter((key) => !sentDateSet.has(key)).length;

  function handleSend() {
    const selectedKeys = selectedDateKeys();
    const before = [...sentRef.current];
    const beforeSet = new Set(before);
    const newKeys = selectedKeys.filter((key) => !beforeSet.has(key));
    if (newKeys.length === 0) return;
    hapticTick();
    const after = [...before, ...newKeys].sort();
    pushHist({ t: "sent", before, after, colsBefore: new Map(colsRef.current) });
    const enterArrangeMode = shouldEnterScheduleArrangeMode(
      hasSentOnceRef.current,
      newKeys.length
    );
    hasSentOnceRef.current = true;
    setBgVis(true); // 직접 보낸 새 카드가 숨은 일정 레이어에 들어가 안 보이는 결과 방지
    if (enterArrangeMode) {
      setActiveLayerId(BG_LAYER_ID);
      setTool("select");
    }
    onSend(newKeys);
    rangeSelect.clearSelection();
    // 선택 해제로 보내기 버튼이 disabled가 되므로 포커스를 살아 있는 다음 작업점으로 옮긴다.
    window.requestAnimationFrame(() => {
      const target = enterArrangeMode
        ? scheduleLayerButtonRef.current
        : pickerToggleRef.current;
      target?.focus({ preventScroll: true });
    });
  }
  function removeDay(dateKey: string) {
    const before = [...sentRef.current];
    pushHist({
      t: "sent",
      before,
      after: before.filter((k) => k !== dateKey),
      colsBefore: new Map(colsRef.current)
    });
    hapticTick();
    onRemoveDay(dateKey);
  }

  // Esc 우선순위(G0-rr·G3a): 이 핸들러 '하나'가 결정한다 — 선택 있으면 해제만, 없으면 닫기.
  // (훅의 Esc 처리는 escapeClears:false로 꺼서 리스너 순서 경쟁이 아예 없다.)
  // 전역 단축키 차단은 호출자(studio-shell)가 broadcastOpen 가드로 수행 — 여기선 Esc/Tab만.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const layerDrag = layerDragRef.current;
      if (e.key === "Escape" && layerDrag) {
        e.preventDefault();
        e.stopPropagation();
        if (layerDrag.started) {
          guardLayerClickUntilPointerRelease(layerDrag.pointerId);
        } else {
          layerDragClickBlockedRef.current = false;
        }
        cleanupLayerDrag();
        if (layerDrag.trigger.hasPointerCapture(layerDrag.pointerId)) {
          layerDrag.trigger.releasePointerCapture(layerDrag.pointerId);
        }
        return;
      }
      // 색 팝오버가 열려 있는 동안엔 팝오버가 키보드(Esc/입력)를 갖는다 — 패널 단축키 정지.
      if (colorPopRef.current) return;
      if (e.key === "Escape") {
        // 우선순위: 부분 선택 취소 → 스포이드 취소 → 카드/획 다중선택 해제 → 날짜 선택 해제 → 창 닫기.
        if (imgRegionRef.current) {
          setImgRegion(null);
          return;
        }
        if (pickingRef.current) {
          setPicking(false);
          setPickPreview(null);
          return;
        }
        if (colSelRef.current.size > 0 || strokeSelRef.current.length > 0) {
          setColSel(new Set());
          setStrokeSel([]);
          return;
        }
        if (rangeSelect.getSelected().size > 0) {
          rangeSelect.clearSelection();
          return;
        }
        onClose();
        return;
      }
      // ── 선택한 그림 복사/잘라내기/붙여넣기 ──
      // 편집실 스티커·일정과 같은 손버릇(Ctrl+C/X/V)을 그림판에도 준다. 붙여넣기는 **활성
      // 레이어**로 들어간다(어디에 놓일지 예측 가능해야 한다) — 원본이 어느 레이어였든.
      // 클립보드는 이 패널 안 메모리다: 시스템 클립보드에 획 좌표를 넣을 형식이 없고,
      // 넣더라도 다른 앱이 읽을 수 없다.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase();
        // 영역이 잡혀 있으면 복사/잘라내기는 '그 영역'을 뜻한다 — 항목 전체가 아니라.
        const region = imgRegionRef.current;
        if ((k === "c" || k === "x") && region?.rect) {
          e.preventDefault();
          commitRegionRef.current(k === "x");
          return;
        }
        if ((k === "c" || k === "x") && strokeSelRef.current.length > 0) {
          e.preventDefault();
          const actL = layersRef.current.find((l) => l.id === activeLayerIdRef.current && l.vis);
          const picked = actL ? strokeSelRef.current.filter((s) => s.layer === actL.id) : [];
          // 깊은 복사 — 원본을 나중에 옮기거나 지워도 붙여넣을 내용이 흔들리지 않게.
          strokeClipRef.current = picked.map((s) => ({
            ...s,
            points: s.points.map((pt) => ({ ...pt }))
          }));
          if (k === "x" && picked.length > 0) {
            const dead = new Set(picked);
            const beforeScene = [...store.strokes()];
            const afterScene = beforeScene.filter((x) => !dead.has(x));
            store.setStrokes(afterScene);
            pushHist({ t: "scene", before: beforeScene, after: afterScene });
            for (const l of layersRef.current) replayLayerFnRef.current(l.id);
            setStrokeVersion((v) => v + 1);
            setStrokeSel([]);
          }
          hapticTick();
          return;
        }
        if (k === "v" && strokeClipRef.current.length > 0) {
          e.preventDefault();
          const act = layersRef.current.find((l) => l.id === activeLayerIdRef.current && l.vis);
          if (!act) return; // 붙여넣을 레이어가 숨겨져 있으면 조용히 무시(안 보이는 곳에 놓지 않는다)
          // 겹쳐 놓으면 붙었는지 알 수 없다 — 살짝 어긋나게 놓고 그걸 선택 상태로 만든다.
          const off = 16;
          const pasted = strokeClipRef.current.map((s) => ({
            ...s,
            layer: act.id,
            points: s.points.map((pt) => ({ ...pt, x: pt.x + off, y: pt.y + off }))
          }));
          const beforeScene = [...store.strokes()];
          const afterScene = [...beforeScene, ...pasted];
          store.setStrokes(afterScene);
          pushHist({ t: "scene", before: beforeScene, after: afterScene });
          for (const l of layersRef.current) replayLayerFnRef.current(l.id);
          setStrokeVersion((v) => v + 1);
          setStrokeSel(pasted);
          // 연달아 붙여넣으면 계단처럼 쌓이게 클립보드도 함께 민다(문서 편집기 관례).
          strokeClipRef.current = pasted.map((s) => ({
            ...s,
            points: s.points.map((pt) => ({ ...pt }))
          }));
          hapticTick();
          return;
        }
      }
      // Delete/Backspace = 선택된 것 일괄 삭제(카드·획 각각 히스토리 1건 — Ctrl+Z로 복원).
      if (
        (colSelRef.current.size > 0 || strokeSelRef.current.length > 0) &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        e.preventDefault();
        // 선택된 획 삭제 — 장면에서 제거(scene 스냅샷으로 undo 가능).
        // 선택이 활성 레이어 기준이므로 삭제도 같은 기준(어긋나면 "선택은 됐는데 일부만 지워짐").
        const act = layersRef.current.find((l) => l.id === activeLayerIdRef.current && l.vis);
        const editableStrokes = act
          ? strokeSelRef.current.filter((s) => s.layer === act.id)
          : [];
        if (editableStrokes.length > 0) {
          const dead = new Set(editableStrokes);
          const beforeScene = [...store.strokes()];
          const afterScene = beforeScene.filter((s) => !dead.has(s));
          if (afterScene.length !== beforeScene.length) {
            store.setStrokes(afterScene);
            pushHist({ t: "scene", before: beforeScene, after: afterScene });
            for (const l of layersRef.current) replayLayerFnRef.current(l.id);
            setStrokeVersion((v) => v + 1);
          }
          setStrokeSel([]);
        }
        if (colSelRef.current.size > 0 && bgActiveRef.current && bgVisRef.current) {
          const before = [...sentRef.current];
          const after = before.filter((k) => !colSelRef.current.has(k));
          pushHist({ t: "sent", before, after, colsBefore: new Map(colsRef.current) });
          onRestoreSent(after);
          setColSel(new Set());
        }
        hapticTick();
        return;
      }
      // 화살표 = 선택 카드 미세 이동(1px, Shift=10px) — 피그마 문법.
      if (
        colSelRef.current.size > 0 &&
        bgActiveRef.current &&
        bgVisRef.current &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const before = new Map(colsRef.current);
        const next = new Map(colsRef.current);
        for (const k of colSelRef.current) {
          const b = next.get(k);
          if (b) next.set(k, { ...b, x: Math.max(0, b.x + dx), y: Math.max(0, b.y + dy) });
        }
        setCols(next);
        pushHist({ t: "cols", before, after: next });
        return;
      }
      // Ctrl+A = 카드 전체 선택 — '일정' 레이어가 활성일 때만(레이어 규율).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (bgActiveRef.current && bgVisRef.current) setColSel(new Set(sentRef.current));
        return;
      }
      // 판서 자체 undo/redo — 편집실 Ctrl+Z(삭제복구)는 broadcastOpen 가드로 이미 차단됨.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        doRedo();
        return;
      }
      if (e.key !== "Tab") return;
      // 단순 포커스 trap: 패널 안 포커스 가능한 요소들 사이에서 순환.
      const root = rootRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onClose,
    rangeSelect,
    doUndo,
    doRedo,
    pushHist,
    onRestoreSent,
    store,
    cleanupLayerDrag,
    guardLayerClickUntilPointerRelease
  ]);

  // 도구 단축키(그림판/드로잉 앱 레퍼런스): V 선택 · P 펜 · H 형광펜 · E 지우개 · G 채우기 ·
  // L 직선 · A 화살표 · R 사각형 · O 원 · [ ] 굵기 감소/증가 · ? 단축키 안내.
  // 수식키 조합·입력 칸 타이핑·색 팝오버 열림 중엔 무시. capture 단계로 등록해
  // ? 안내가 열려 있을 때의 Esc를 메인 핸들러(선택 해제/창 닫기)보다 먼저 소비한다.
  const [kbdHelp, setKbdHelp] = useState(false);
  useEffect(() => {
    const TOOL_KEYS: Record<string, BroadcastTool> = {
      v: "select",
      p: "pen",
      h: "hl",
      e: "eraser",
      g: "fill",
      l: "line",
      a: "arrow",
      r: "rect",
      o: "ellipse"
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (kbdHelp && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setKbdHelp(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (colorPopRef.current) return;
      if (e.key === "?") {
        setKbdHelp((v) => !v);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "i" && !e.shiftKey) {
        hapticTick();
        setPicking((v) => !v);
        setPickPreview(null);
        return;
      }
      const mapped = TOOL_KEYS[k];
      if (mapped && !e.shiftKey) {
        setPicking(false);
        hapticTick();
        if (mapped === "select") setTool("select");
        else activateDrawingTool(mapped);
        return;
      }
      if (e.key === "[" || e.key === "]") {
        const idx = PEN_WIDTHS.indexOf(penWidth);
        const next = PEN_WIDTHS[idx + (e.key === "]" ? 1 : -1)];
        if (next !== undefined) {
          hapticTick();
          setPenWidth(next);
          activateDrawingTool(toolAfterInkWidthPick(tool));
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tool, penWidth, kbdHelp]);

  // 최초 포커스 + body scroll lock(열림 동안 뒤 화면 스크롤 금지).
  useEffect(() => {
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const sentDays: BroadcastPanelDay[] = useMemo(
    () =>
      sentDateKeys.map((dateKey) => ({
        dateKey,
        events: eventsByDate.get(dateKey) ?? []
      })),
    [sentDateKeys, eventsByDate]
  );

  useLayoutEffect(() => {
    const measure = () => {
      const next = new Map<string, number>();
      for (const key of sentDateKeys) {
        const h = colElsRef.current.get(key)?.offsetHeight;
        if (h && h > 0) next.set(key, h);
      }
      setColHeights((prev) => {
        if (
          prev.size === next.size &&
          [...next].every(([key, height]) => prev.get(key) === height)
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of colElsRef.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [sentDateKeys, eventsByDate]);

  const boardExtent = useMemo(() => {
    void strokeVersion; // ref 기반 stroke 기하 변경을 이 계산에 연결하는 명시적 버전 신호
    let maxX = 0;
    let maxY = 280;
    for (const [key, box] of cols) {
      maxX = Math.max(maxX, box.x + box.w + 24);
      maxY = Math.max(maxY, box.y + (colHeights.get(key) ?? 320) + 24);
    }
    const layerIds = new Set(layers.map((l) => l.id));
    for (const stroke of store.strokes()) {
      // 지우개는 보이는 콘텐츠가 아니므로 빈 스크롤 영역을 만들지 않는다.
      if (stroke.tool === "eraser" || !layerIds.has(stroke.layer)) continue;
      const half = stroke.width / 2 + 4;
      for (const point of stroke.points) {
        maxX = Math.max(maxX, point.x + half + 24);
        maxY = Math.max(maxY, point.y + half + 24);
      }
    }
    return { minWidth: maxX, minHeight: maxY };
  }, [cols, colHeights, layers, store, strokeVersion]);

  // 드래그 슬라이드 프리뷰(그림판 문법) — 놓일 자리를 향해 형제 카드가 미끄러지고,
  // 흐려진 원본 카드가 그 빈 칸으로 이동해 '여기 놓인다'를 몸으로 보여준다.
  // transform만 쓴다(레이아웃·드롭 판정 슬롯 불변 — 슬롯은 드래그 시작 때 실측).
  const layerSlidePreview = (() => {
    if (!layerDragUi || layerDragUi.beforeId === undefined) return null;
    const from = layers.findIndex((x) => x.id === layerDragUi.id);
    if (from < 0) return null;
    const rawTo =
      layerDragUi.beforeId === null
        ? layers.length
        : layers.findIndex((x) => x.id === layerDragUi.beforeId);
    if (rawTo < 0) return null;
    return { from, to: rawTo > from ? rawTo - 1 : rawTo, step: layerDragUi.step };
  })();
  const layerSlideOf = (i: number): number => {
    if (!layerSlidePreview) return 0;
    const { from, to, step } = layerSlidePreview;
    if (i === from) return (to - from) * step;
    if (from < to && i > from && i <= to) return -step;
    if (to < from && i >= to && i < from) return step;
    return 0;
  };

  // 일정 레이어 행 — 스택 안 '제자리'에서 그린다(예전엔 목록 아래 고정이라 순서를 못 바꿨다).
  // 컴포넌트로 빼지 않고 렌더 함수로 두는 이유: 이 행이 쓰는 상태(bgVis·bgActive·드래그 핸들러)가
  // 전부 이 스코프에 있어, 밖으로 빼면 인자만 열 개 넘게 늘어난다.
  const scheduleLayerRow = (slide: number) => (
    <div key={BG_LAYER_ID} style={slide !== 0 ? { transform: `translateY(${slide}px)` } : undefined}>
          {/* 일정 = 고정 기본 레이어(날짜 카드 DOM) — 삭제/잠금 없음. 활성이면 카드
              선택/이동/크기 조절이 가능(그리기 레이어 활성 중엔 카드가 안 잡힌다). */}
          <div
            className={`bp-layer-item${bgVis ? "" : " off"}${bgActive ? " active" : ""}${layerDragUi?.id === BG_LAYER_ID ? " dragging" : ""}${layerDragUi?.beforeId === BG_LAYER_ID ? " drop-before" : ""}`}
            data-layer-id={BG_LAYER_ID}
            role="listitem"
          >
            <button
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              aria-label="일정, 끌어서 순서 변경"
              aria-pressed={bgActive}
              className="bp-layer-select"
              ref={scheduleLayerButtonRef}
              title="클릭해 선택 · 끌어서 순서 변경 · Alt+↑/↓"
              type="button"
              onClick={(e) => {
                if (layerDragRef.current) return;
                if (layerDragClickBlockedRef.current && e.detail > 0) {
                  layerDragClickBlockedRef.current = false;
                  return;
                }
                hapticTick();
                setActiveLayerId(BG_LAYER_ID);
                setTool("select"); // 일정 레이어를 고르면 카드가 바로 잡히게
              }}
              onKeyDown={(e) => onLayerKeyDown(e, BG_LAYER_ID)}
              onLostPointerCapture={onLayerPointerCancel}
              onPointerCancel={onLayerPointerCancel}
              onPointerDown={(e) => onLayerPointerDown(e, BG_LAYER_ID)}
              onPointerMove={onLayerPointerMove}
              onPointerUp={onLayerPointerUp}
             data-act="bp-layer-select">
              <span className="bp-layer-grip" aria-hidden="true">
                <GripVertical size={14} strokeWidth={2.2} />
              </span>
              <span className="bp-layer-thumb" aria-hidden="true">
                <span className="bp-layer-thumb-bg">📅</span>
              </span>
              <span className="bp-layer-meta">
                <em>일정</em>
              </span>
            </button>
            <div className="bp-layer-actions">
              {/* (위/아래 토글 제거 — 이제 다른 레이어처럼 목록에서 끌어 아무 자리에나 둔다.) */}
              <button
                aria-label="일정 카드 표시"
                aria-pressed={bgVis}
                className="bp-layer-btn"
                title={bgVis ? "숨기기" : "보이기"}
                type="button"
                onClick={() => {
                  hapticTick();
                  if (bgVis) setColSel(new Set());
                  setBgVis((v) => !v);
                }}
               data-act="일정 카드 표시">
                {bgVis ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
              </button>
            </div>
          </div>
    </div>
  );

  return (
    <div className="broadcast-panel" role="dialog" aria-modal="true" aria-label="일정 그림판" ref={rootRef}>
      <header className="bp-header">
        <h2>🖊️ 일정 그림판</h2>
        <p className="bp-hint">
          달력에서 날짜를 골라 <strong>그림판으로 보내기</strong> · 선택 도구로 카드를 끌어
          이동/크기 조절 — 창을 닫으면 모두 사라져요
        </p>
        <button
          aria-label="일정 그림판 닫기"
          className="bp-close"
          onClick={onClose}
          ref={closeBtnRef}
          type="button"
         data-act="일정 그림판 닫기">
          <X aria-hidden="true" size={20} strokeWidth={3} />
        </button>
      </header>

      {/* Clip Studio 문법(연구 아카이브 §7): 빠른 명령과 현재 상태, 도구, 속성·색을
          서로 다른 역할로 읽히게 한다. role은 group — 일반 Tab 이동 계약을 유지한다. */}
      <div className="bp-toolbar" role="group" aria-label="판서 작업대">
        <div className="bp-command-bar">
          <div className="bp-command-status" aria-live="polite">
            <span>현재 작업</span>
            <strong>
              <i aria-hidden="true" style={{ background: penColor }} />
              {TOOL_LABELS[tool]}
            </strong>
            <em>
              펜 설정 {penWidth}px · {activeLayerName}
            </em>
          </div>
          {/* 굵기 — 스크롤 덱 끝에 있어 매번 가로 스크롤이 필요했다(사용자 지적). 상태 텍스트
              바로 오른쪽 고정 자리로 이동: 항상 보이고, '펜 설정 Npx' 표기와도 붙어 읽힌다. */}
          <div
            aria-label="굵기"
            className="bp-command-widths"
            role="group"
            title="굵기 줄이기/키우기 ([ / ])"
          >
            {PEN_WIDTHS.map((w) => (
              <button
                aria-label={`굵기 ${w}px`}
                aria-pressed={penWidth === w}
                className={`bp-width${penWidth === w ? " on" : ""}`}
                key={w}
                type="button"
                onClick={() => {
                  hapticTick();
                  setPenWidth(w);
                  // 굵기를 골랐다 = 판서 의도. 일정/선택 상태면 최근 그림 레이어의 펜으로,
                  // 이미 굵기를 쓰는 형광펜·지우개·도형이면 그 도구를 그대로 유지한다.
                  activateDrawingTool(toolAfterInkWidthPick(tool));
                }}
               data-act="bp-width">
                {/* 점도 현재 펜 색 — 굵기 고르는 자리에서 색·굵기를 한 번에 확인. */}
                <i
                  style={{
                    width: Math.min(w + 2, 16),
                    height: Math.min(w + 2, 16),
                    background: penColor,
                    boxShadow: "0 0 0 1px var(--ink-soft)"
                  }}
                />
                <span>{w}</span>
              </button>
            ))}
          </div>
          {/* 선택 정렬(2개 이상 선택 시) — 굵기 오른쪽 같은 줄(사용자 요청). 스크롤 덱이 아니라
              항상 보이는 명령줄이라 정렬하러 내려갈 필요가 없다. */}
          {tool === "select" && colSel.size >= 2 ? (
            <div aria-label={`선택 정렬 (${colSel.size}개)`} className="bp-command-align" role="group">
              <button
                aria-label="위 맞춤"
                className="bp-command-button"
                title="위 맞춤(수평 맞추기)"
                type="button"
                onClick={() => alignSelected("top")}
               data-act="위 맞춤">
                <AlignStartHorizontal aria-hidden="true" size={16} />
                <span>위 맞춤</span>
              </button>
              <button
                aria-label="세로 중앙 맞춤"
                className="bp-command-button"
                title="세로 중앙 맞춤"
                type="button"
                onClick={() => alignSelected("middle")}
               data-act="세로 중앙 맞춤">
                <AlignCenterHorizontal aria-hidden="true" size={16} />
                <span>세로 중앙</span>
              </button>
              <button
                aria-label="왼쪽 맞춤"
                className="bp-command-button"
                title="왼쪽 맞춤"
                type="button"
                onClick={() => alignSelected("left")}
               data-act="왼쪽 맞춤">
                <AlignStartVertical aria-hidden="true" size={16} />
                <span>왼쪽</span>
              </button>
              <button
                aria-label="오른쪽 맞춤"
                className="bp-command-button"
                title="오른쪽 맞춤"
                type="button"
                onClick={() => alignSelected("right")}
               data-act="오른쪽 맞춤">
                <AlignEndVertical aria-hidden="true" size={16} />
                <span>오른쪽</span>
              </button>
              <button
                aria-label="가로 균등 간격"
                className="bp-command-button"
                title="가로 균등 간격"
                type="button"
                onClick={() => alignSelected("distribute-x")}
               data-act="가로 균등 간격">
                <AlignHorizontalDistributeCenter aria-hidden="true" size={16} />
                <span>가로 균등</span>
              </button>
            </div>
          ) : null}
          <div className="bp-command-actions" role="group" aria-label="작업 기록">
            <button
              className="bp-command-button"
              disabled={!histRef.current.canUndo()}
              title="획·카드 배치·날짜·레이어 실행 취소 (Ctrl+Z)"
              type="button"
              onClick={doUndo}
             data-act="실행 취소">
              <Undo2 aria-hidden="true" size={16} />
              <span>실행 취소</span>
            </button>
            <button
              className="bp-command-button"
              disabled={!histRef.current.canRedo()}
              title="다시 실행 (Ctrl+Shift+Z)"
              type="button"
              onClick={doRedo}
             data-act="다시 실행">
              <Redo2 aria-hidden="true" size={16} />
              <span>다시 실행</span>
            </button>
            <button
              aria-label={clearArmed ? "한 번 더 누르면 전체 지우기" : "전체 지우기"}
              className={`bp-command-button danger${clearArmed ? " armed" : ""}`}
              disabled={store.strokes().length === 0 && !store.canRedo() && !clearArmed}
              title="전체 지우기 — 두 번 눌러 실행, 되돌릴 수 없음"
              type="button"
              onClick={doClearAll}
             data-act="판서 전체 지우기">
              <Trash2 aria-hidden="true" size={16} />
              <span>{clearArmed ? "확실해요?" : "전체 지우기"}</span>
            </button>
            {/* 단축키 안내 — 그림판 도움말 레퍼런스: 키 → 동작 두 열 목록. ?로도 토글. */}
            <button
              aria-expanded={kbdHelp}
              className={`bp-command-button${kbdHelp ? " on" : ""}`}
              title="단축키 안내 (?)"
              type="button"
              onClick={() => {
                hapticTick();
                setKbdHelp((v) => !v);
              }}
             data-act="단축키 안내 (?)">
              <Keyboard aria-hidden="true" size={16} />
              <span>단축키</span>
            </button>
          </div>
          {kbdHelp ? (
            <div className="bp-kbd-help" role="dialog" aria-label="단축키 안내">
              <div className="bp-kbd-head">
                <strong>단축키</strong>
                <button
                  aria-label="단축키 안내 닫기"
                  className="bp-kbd-close"
                  type="button"
                  onClick={() => setKbdHelp(false)}
                 data-act="단축키 안내 닫기">
                  <X aria-hidden="true" size={14} strokeWidth={2.75} />
                </button>
              </div>
              <dl>
                {(
                  [
                    ["V", "선택 도구"],
                    ["P", "펜"],
                    ["H", "형광펜"],
                    ["E", "지우개"],
                    ["G", "색 채우기(선 안쪽)"],
                    ["L", "직선"],
                    ["A", "화살표"],
                    ["R", "사각형"],
                    ["O", "원"],
                    ["I", "스포이드(색 집기)"],
                    ["Alt+클릭", "그리는 중에도 바로 색 집기"],
                    ["그림 선택 → 영역 선택", "그림 일부만 오려 옮기기·복사"],
                    ["Ctrl+C / Ctrl+X", "영역이 잡혀 있으면 그 영역만 복사 / 옮기기"],
                    ["[ / ]", "굵기 줄이기 / 키우기"],
                    ["Shift+드래그", "정비율(45°·정사각형·정원)"],
                    ["Ctrl+Z", "실행 취소"],
                    ["Ctrl+Shift+Z / Ctrl+Y", "다시 실행"],
                    ["Ctrl+A", "카드 전체 선택(일정 레이어)"],
                    ["Delete", "선택한 카드·획 삭제"],
                    ["방향키", "선택 카드 이동(Shift=10px)"],
                    ["Esc", "스포이드 취소 → 선택 해제 → 창 닫기"],
                    ["?", "이 안내 열기/닫기"]
                  ] as const
                ).map(([k, desc]) => (
                  <div className="bp-kbd-row" key={k}>
                    <dt>
                      <kbd>{k}</kbd>
                    </dt>
                    <dd>{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
        <div className="bp-tool-deck">
          <div className="bp-tool-group" role="group" aria-label="도구">
            {/* 채우기·스포이드도 '무엇으로 칠할지'를 고르는 일이라 도구와 한 상자에 둔다
                (사용자 결정) — 색 팔레트 옆에 따로 서 있으면 도구를 두 군데서 찾게 된다.
                배치는 한 줄 6칸(사용자 결정) — 옆 '도형'도 한 줄이라 두 그룹 높이가 같다. */}
            <div className="bp-group-row bp-grid6">
              {(
                [
                  ["select", "선택", "V", MousePointer2],
                  ["pen", "펜", "P", Pen],
                  ["hl", "형광펜", "H", Highlighter],
                  ["eraser", "지우개", "E", Eraser],
                  ["fill", "채우기", "G", PaintBucket],
                  ["pick", "스포이드", "I", Pipette]
                ] as const
              ).map(([key, label, hotkey, Icon]) => {
                // 스포이드는 도구가 아니라 '집는 모드'다 — 눌린 상태(picking)로 표시하고,
                // 색을 집으면 스스로 꺼져 직전 도구로 돌아온다(기존 동작 그대로).
                const active = key === "pick" ? picking : tool === key && !picking;
                return (
                  <button
                    aria-label={key === "pick" ? "스포이드로 색 집기" : label}
                    aria-pressed={active}
                    className={`bp-tool${active ? " on" : ""}`}
                    key={key}
                    // Procreate 문법(연구 아카이브 §4): 색을 쓰는 도구(펜·형광펜·채우기)가 활성이면
                    // 칩이 '현재 펜 색'으로 칠해진다 — 지금 무슨 색으로 그릴지 도구줄에서 즉시
                    // 보인다. 아이콘은 명도 대비로 흑/백 자동 선택.
                    style={
                      active && (key === "pen" || key === "hl" || key === "fill")
                        ? activeInkStyle
                        : undefined
                    }
                    title={
                      key === "pick"
                        ? "스포이드 (I) · Alt+클릭으로도 집기"
                        : key === "fill"
                          ? "색 채우기 (G) — 지금 레이어의 선 안쪽을 현재 색으로"
                          : `${label} (${hotkey})`
                    }
                    type="button"
                    onClick={() => {
                      hapticTick();
                      if (key === "pick") {
                        setPicking((v) => !v);
                        setPickPreview(null);
                        return;
                      }
                      // 도구를 고르면 집는 모드는 끝난다(모드 두 개가 겹쳐 켜져 있지 않게).
                      if (picking) {
                        setPicking(false);
                        setPickPreview(null);
                      }
                      if (key === "select") setTool(key);
                      else activateDrawingTool(key);
                    }}
                    data-act={key === "pick" ? "bp-eyedrop" : key === "fill" ? "bp-fill" : "bp-tool"}
                  >
                    <kbd aria-hidden="true" className="bp-tool-key">
                      {hotkey}
                    </kbd>
                    <Icon aria-hidden="true" size={19} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <em className="bp-group-label">도구</em>
          </div>
          <div className="bp-tool-group" role="group" aria-label="도형">
            <div className="bp-group-row bp-grid4">
              {(
                [
                  ["line", "직선", "L", Slash],
                  ["arrow", "화살표", "A", MoveUpRight],
                  ["rect", "사각형", "R", Square],
                  ["ellipse", "원", "O", Circle]
                ] as const
              ).map(([key, label, hotkey, Icon]) => (
                <button
                  aria-label={label}
                  aria-pressed={tool === key}
                  className={`bp-tool${tool === key ? " on" : ""}`}
                  key={key}
                  // 도형도 현재 펜 색으로 그려지므로 활성 칩에 색을 스민다(같은 규칙).
                  style={tool === key ? activeInkStyle : undefined}
                  title={`${label} (${hotkey}) — Shift로 정비율`}
                  type="button"
                  onClick={() => {
                    hapticTick();
                    activateDrawingTool(key);
                  }}
                 data-act="bp-tool">
                  <kbd aria-hidden="true" className="bp-tool-key">
                    {hotkey}
                  </kbd>
                  <Icon aria-hidden="true" size={19} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <em className="bp-group-label">도형</em>
          </div>
          <div className="bp-tool-group bp-color-group" role="group" aria-label="색상 팔레트">
            <div className="bp-colors">
              {PEN_COLORS.map((c) => (
                <button
                  aria-label={`펜 색 ${c}`}
                  aria-pressed={penColor === c}
                  className={`bp-color${penColor === c ? " on" : ""}`}
                  key={c}
                  style={{ background: c }}
                  type="button"
                  onClick={() => {
                    hapticTick();
                    // 선택·지우개면 펜으로, 형광펜·도형이면 도구 유지. 일정 레이어에서는
                    // 최근 사용 가능한 그림 레이어까지 함께 복귀해 바로 그릴 수 있게 한다.
                    applyInkColor(c);
                  }}
                 data-act="bp-color" />
              ))}
              {/* 직접 고르기 — 태그 편집과 같은 인라인 색 피커 팝오버(디자인 통일).
                팔레트에 없는 색이 선택돼 있으면 이 칸이 그 색으로 켜진다. */}
              <button
                aria-expanded={colorPop !== null}
                aria-label={`현재 색 ${penColor}, 색 직접 고르기`}
                className={`bp-current-color${colorPop ? " on" : ""}`}
                title="색 직접 고르기"
                type="button"
                // 팝오버의 light-dismiss(문서 mousedown)가 이 버튼을 '바깥'으로 오인해
                // 닫았다 → click이 다시 여는 왕복을 막는다.
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  hapticTick();
                  if (colorPop) {
                    restoreColorPickerContext(colorPop);
                    return;
                  }
                  setColorPop({
                    anchor: e.currentTarget.getBoundingClientRect(),
                    openedWith: penColor,
                    openedWithTool: tool,
                    openedWithLayerId: activeLayerId
                  });
                }}
               data-act="색 직접 고르기">
                {/* 무지개 링 = "여기서 아무 색이나 고를 수 있다" 어포던스(그림판 커스텀 색 관례).
                    가운데는 현재 색 — 상태 표시와 진입점을 한 버튼이 겸한다. */}
                <i aria-hidden="true" className="bp-custom-ring" style={{ background: penColor }} />
                <span>직접 고르기</span>
              </button>
            </div>
            <em className="bp-group-label">색상 팔레트</em>
            {colorPop ? (
              <ColorPickerPopover
                anchor={colorPop.anchor}
                canClear={false}
                kind="modifier"
                value={penColor}
                onCancel={() => restoreColorPickerContext(colorPop)}
                onChange={applyInkColor}
                onClear={() => {}}
                onClose={() => setColorPop(null)}
              />
            ) : null}
          </div>
        </div>
        {toolBlocked ? (
          <span className="bp-lock-hint">
            {bgActive
              ? "'일정' 레이어에선 카드만 움직여요 — 펜·색·굵기를 고르면 그림 레이어로 돌아갑니다"
              : layers.length === 0
                ? "그림 레이어가 없어요 — 오른쪽에서 새 레이어를 추가해주세요"
                : "활성 레이어가 숨겨져 있어요"}
          </span>
        ) : null}
      </div>

      {/* 왼쪽 기둥 — 날짜 달력 카드(콘텐츠 높이). 접기·아바타 자리는 사용자 결정으로 제거. */}
      <div className="bp-source-col">
      <section className="bp-picker" aria-label={`${monthLabel} 날짜 선택`}>
        <div className="bp-picker-head">
          {/* 월 이동 — 다른 달 일정도 뽑아온다. 인덱스 기반 선택은 월이 바뀌면 다른 날짜를
              가리키므로 이동 시 비운다(보낸 카드는 유지 — 날짜 키로 들고 있음). */}
          <button
            aria-label="이전 달"
            className="bp-month-nav"
            type="button"
            onClick={() => {
              hapticTick();
              rangeSelect.clearSelection();
              onMonthNav(-1);
            }}
           data-act="이전 달">
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.5} />
          </button>
          <button
            aria-label="다음 달"
            className="bp-month-nav"
            type="button"
            onClick={() => {
              hapticTick();
              rangeSelect.clearSelection();
              onMonthNav(1);
            }}
           data-act="다음 달">
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2.5} />
          </button>
          {/* 접기 기능은 사용자 결정으로 제거 — 달력은 항상 펼쳐져 있고 이 자리는 월 라벨만. */}
          <span className="bp-picker-toggle" ref={pickerToggleRef} tabIndex={-1}>
            {monthLabel}
          </span>
          <button
            className="bp-send"
            disabled={sendableDateCount === 0}
            onClick={handleSend}
            ref={sendBtnRef}
            type="button"
           data-act="bp-send">
            {selectedDateKeysNow.length > 0 && sendableDateCount === 0
              ? "이미 그림판에 있어요"
              : `그림판으로 보내기${sendableDateCount > 0 ? ` (${sendableDateCount})` : ""}`}
          </button>
        </div>
        <>
            <div className="bp-weekdays" aria-hidden="true">
              {WEEKDAYS.map((w, i) => (
                <span className={i === 0 ? "sun" : i === 6 ? "sat" : ""} key={w}>
                  {w}
                </span>
              ))}
            </div>
            <div className="bp-mini-grid" ref={rangeSelect.setRef}>
              {cells.map((cell, i) => {
                const evs = eventsByDate.get(cell.isoDate) ?? [];
                const inMonth = cell.inCurrentMonth;
                const picked = rangeSelect.selected.has(i);
                const isToday = cell.isoDate === todayIso;
                const sent = sentDateSet.has(cell.isoDate);
                const cls = [
                  "bp-mini-cell",
                  inMonth ? "" : "outside",
                  picked ? "picked" : "",
                  isToday ? "today" : "",
                  sent ? "sent" : "",
                  // 국가지정 공휴일(대체공휴일 포함)도 빨간날 — 메인 달력과 동일 기준.
                  cell.weekday === 0 || getDayMark(cell.isoDate)?.isHoliday
                    ? "sun"
                    : cell.weekday === 6
                      ? "sat"
                      : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                // 회색(전월/익월) 날짜도 선택 가능 — 월 경계에 걸친 설명에 필요(주역 아님은
                // 스타일로만 구분). 키보드: Enter/Space = Ctrl+클릭과 같은 개별 토글.
                return (
                  <div
                    aria-checked={picked}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${Number(cell.isoDate.slice(5, 7))}월 ${cell.dayOfMonth}일${isToday ? ", 오늘" : ""}${sent ? ", 그림판에 보냄" : ""}${evs.length > 0 ? ` (일정 ${evs.length}개)` : ""}`}
                    className={cls}
                    data-cell-index={i}
                    key={cell.isoDate}
                    role="checkbox"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        hapticTick();
                        rangeSelect.toggleIndex(i);
                      }
                    }}
                  >
                    <span className="bp-mini-num">{cell.dayOfMonth}</span>
                    {/* 어떤 일정인지 보고 고르게 — 제목 미리보기(회색 날짜도 동일, 톤만 죽임). */}
                    {evs.slice(0, 2).map((ev) => (
                      <em className="bp-mini-title" key={ev.id}>
                        {ev.teaser ? "🔮 ???" : splitEventTitle(ev.publicTitle).main}
                      </em>
                    ))}
                    {evs.length > 2 ? <i className="bp-mini-more">+{evs.length - 2}</i> : null}
                    {sent ? <i className="bp-mini-sent">보냄</i> : null}
                  </div>
                );
              })}
            </div>
          </>
      </section>
      </div>

      <div className="bp-main">
      <section className="bp-board" aria-label="그림판" ref={boardScrollRef}>
        {/* 스크롤 좌표면(G3b): 배경 카드·캔버스·입력면이 전부 이 inner 안 — 보드를 스크롤하면
            카드와 판서가 같이 움직여 좌표가 절대 안 어긋난다. 컬럼 자유 배치 범위만큼 inner가
            커진다(minWidth/minHeight). */}
        <div
          className={`bp-board-inner${dropOver ? " is-drop" : ""}`}
          ref={boardInnerRef}
          onDragOver={onBoardDragOver}
          onDragLeave={onBoardDragLeave}
          onDrop={onBoardDrop}
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerUp}
          onLostPointerCapture={onBoardPointerUp}
          // inline min은 CSS의 min-width/height:100%를 '덮어쓴다' — max(100%, …)로 합성해야
          // 컬럼이 적을 때도 종이가 보드 전체를 채운다(안 그러면 왼쪽 위 조각만 흰색).
          style={{
            minWidth: `max(100%, ${boardExtent.minWidth}px)`,
            minHeight: `max(100%, ${boardExtent.minHeight}px)`
          }}
        >
          {/* 배경 레이어 = 날짜 카드 DOM(캔버스 아님 — 메모리 0). 표시 토글은 숨김만. */}
          <div
            className={`bp-board-bg${bgVis ? "" : " hidden"}`}
            style={{ position: "relative", zIndex: zOf(BG_LAYER_ID) }}
          >
            {sentDays.length === 0 ? (
              <p className="bp-empty">
                바로 그릴 수 있어요 · 일정은 위 달력에서 골라 그림판으로 보내세요
              </p>
            ) : (
              sentDays.map((day) => {
                const box = cols.get(day.dateKey) ?? { x: 16, y: 16, w: COL_DEFAULT_W };
                return (
                  <article
                    className={`bp-day-col${colSel.has(day.dateKey) ? " sel" : ""}`}
                    key={day.dateKey}
                    ref={(el) => {
                      const m = colElsRef.current;
                      if (el) m.set(day.dateKey, el);
                      else m.delete(day.dateKey);
                    }}
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      // 세로 손잡이로 정한 명시 높이 — 내용보다 작게는 안 줄어든다.
                      minHeight: box.h,
                      // 폭에 비례해 글자도 커진다(내부는 em) — '크게 보여주기'가 실제로 크다.
                      fontSize: `${Math.round((box.w / COL_DEFAULT_W) * 100)}%`
                    }}
                  >
                    <header
                      className="bp-day-head"
                      title={
                        tool !== "select"
                          ? "이동은 선택 도구에서"
                          : bgActive
                            ? "끌어서 이동"
                            : "카드 이동은 '일정' 레이어를 활성화하고"
                      }
                      onLostPointerCapture={onColPointerUp}
                      onPointerDown={(e) => onColPointerDown(e, day.dateKey, "move")}
                      onPointerMove={onColPointerMove}
                      onPointerUp={onColPointerUp}
                    >
                      {/* 월.일 표기 — 여러 달을 섞어 올릴 수 있어 "8.1"처럼 달을 항상 밝힌다. */}
                      <strong>
                        {Number(day.dateKey.slice(5, 7))}.{Number(day.dateKey.slice(8, 10))}
                      </strong>
                      {/* date-key는 이미 KST 달력 날짜 — 요일은 그 날짜 자체의 요일(UTC 자정으로
                          해석해 getUTCDay). +09:00으로 파싱하면 UTC 기준 전날로 밀려 요일이 틀린다. */}
                      <span>{WEEKDAYS[new Date(`${day.dateKey}T00:00:00Z`).getUTCDay()]}</span>
                      <button
                        aria-label={`${Number(day.dateKey.slice(5, 7))}월 ${Number(day.dateKey.slice(8, 10))}일 그림판에서 빼기`}
                        className="bp-col-x"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDay(day.dateKey);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                       data-act="bp-col-x">
                        <X aria-hidden="true" size={13} strokeWidth={3} />
                      </button>
                    </header>
                    {day.events.length === 0 ? (
                      <p className="bp-day-empty">일정 없음</p>
                    ) : (
                      day.events.map((ev) => {
                        const dy = chipDy.get(`${day.dateKey}:${ev.id}`) ?? 0;
                        return (
                          // 칩 세로 자유 배치 래퍼 — 선택 도구에서 끌어 내려 늘린 카드의
                          // 빈 공간에 두거나 순서를 바꿔 보이게 한다(세션 전용).
                          <div
                            className={`bp-chip-wrap${dy !== 0 ? " moved" : ""}`}
                            data-chip-key={`${day.dateKey}:${ev.id}`}
                            key={`${day.dateKey}-${ev.id}`}
                            style={dy !== 0 ? { transform: `translateY(${dy}px)` } : undefined}
                            onLostPointerCapture={onChipPointerUp}
                            onPointerDown={(e) => onChipPointerDown(e, day.dateKey, ev.id)}
                            onPointerMove={onChipPointerMove}
                            onPointerUp={onChipPointerUp}
                          >
                            <EventCard event={ev} />
                          </div>
                        );
                      })
                    )}
                    {/* 크기 손잡이 — 모서리=대각(폭·글자), 오른쪽 변=너비만, 아래 변=높이만
                        (그림판 선택 핸들 문법, 사용자 요청). 선택 도구에서만. */}
                    <span
                      aria-hidden="true"
                      className="bp-col-resize"
                      onLostPointerCapture={onColPointerUp}
                      onPointerDown={(e) => onColPointerDown(e, day.dateKey, "resize")}
                      onPointerMove={onColPointerMove}
                      onPointerUp={onColPointerUp}
                    />
                    <span
                      aria-hidden="true"
                      className="bp-col-resize-e"
                      onLostPointerCapture={onColPointerUp}
                      onPointerDown={(e) => onColPointerDown(e, day.dateKey, "resize-x")}
                      onPointerMove={onColPointerMove}
                      onPointerUp={onColPointerUp}
                    />
                    <span
                      aria-hidden="true"
                      className="bp-col-resize-s"
                      onLostPointerCapture={onColPointerUp}
                      onPointerDown={(e) => onColPointerDown(e, day.dateKey, "resize-y")}
                      onPointerMove={onColPointerMove}
                      onPointerUp={onColPointerUp}
                    />
                  </article>
                );
              })
            )}
          </div>
          {/* 동적 레이어 캔버스 — 패널 목록은 위=맨 위이므로 DOM엔 뒤집어 깐다(아래부터).
              라이브 캔버스는 '활성 레이어 바로 위'에 끼워 그리는 동안과 뗀 순간의 겹침 순서가
              같다(G3b-r 원칙의 동적판). */}
          {[...layers].reverse().map((l) => (
            <Fragment key={l.id}>
              <canvas
                aria-hidden="true"
                className={`bp-canvas${l.vis ? "" : " hidden"}`}
                style={{ zIndex: zOf(l.id) }}
                ref={(el) => {
                  const m = layerCanvases.current;
                  if (el) m.set(l.id, el);
                  else m.delete(l.id);
                }}
              />
              {l.id === activeLayerId ? (
                <>
                  <canvas
                    aria-hidden="true"
                    className={`bp-canvas${l.vis ? "" : " hidden"}`}
                    style={{ zIndex: zOf(l.id) }}
                    ref={liveCanvasRef}
                  />
                  <canvas
                    aria-hidden="true"
                    className={`bp-canvas${l.vis ? "" : " hidden"}`}
                    style={{ zIndex: zOf(l.id) }}
                    ref={predictionCanvasRef}
                  />
                </>
              ) : null}
            </Fragment>
          ))}
          {/* 드로잉 입력면 — 그리기 도구가 켜졌을 때만 포인터를 받는다(선택 도구면 통과). */}
          <div
            aria-hidden="true"
            className="bp-draw-surface"
            data-cursor={picking ? "pick" : tool === "pen" || tool === "hl" ? tool : undefined}
            ref={drawSurfaceRef}
            style={{
              pointerEvents: tool === "select" && !picking ? "none" : "auto",
              // 지우개: 실제 지워지는 크기 그대로의 원 커서 — 어디까지 닦일지 보고 지운다.
              cursor: tool === "eraser" ? eraserCursor : undefined
            }}
            onLostPointerCapture={cancelDraw}
            onPointerCancel={cancelDraw}
            onPointerDown={onDrawDown}
            onPointerEnter={updateStylusCursor}
            onPointerLeave={onDrawPointerLeave}
            onPointerMove={onDrawMove}
            onPointerUp={endDraw}
          >
            {/* 집기 전 색 미리보기 — 마우스를 따라다니는 작은 알약. 집고 나서 "이 색이 아니네"를
                되돌리기로 고치는 왕복을 없앤다. */}
            {picking && pickPreview ? (
              <span
                aria-hidden="true"
                className="bp-pick-loupe"
                style={{ left: pickPreview.x, top: pickPreview.y }}
              >
                <i style={{ background: pickPreview.hex }} />
                {pickPreview.hex.toUpperCase()}
              </span>
            ) : null}
            {/* 스타일러스는 OS가 CSS 커서를 숨길 수 있어 별도 오버레이로 도구·영향 범위를 표시.
                마우스는 기존 네이티브 cursor를 그대로 써 이 DOM이 보이지 않는다. */}
            <span
              aria-hidden="true"
              className="bp-stylus-cursor"
              data-tool={tool}
              ref={stylusCursorRef}
              style={
                {
                  "--bp-stylus-color": penColor,
                  "--bp-stylus-ink": activeInkStyle.color
                } as React.CSSProperties
              }
            >
              <span className="bp-stylus-footprint" />
              <span className="bp-stylus-glyph">
                <StylusCursorIcon aria-hidden="true" size={13} strokeWidth={2.4} />
              </span>
            </span>
          </div>
          {/* 러버밴드(빈 바닥 드래그 다중 선택) 시각화 */}
          {marquee ? (
            <div
              aria-hidden="true"
              className="bp-marquee"
              style={{
                left: Math.min(marquee.x1, marquee.x2),
                top: Math.min(marquee.y1, marquee.y2),
                width: Math.abs(marquee.x2 - marquee.x1),
                height: Math.abs(marquee.y2 - marquee.y1)
              }}
            />
          ) : null}
          {/* 선택 획 박스(그림판 선택 문법) — 끌면 이동, 오른쪽 아래 손잡이로 확대/축소. */}
          {strokeSelBox ? (
            <div
              aria-label={`선택된 필기 ${strokeSelBox.sel.length}개 — 끌어서 이동`}
              className="bp-stroke-sel"
              role="group"
              style={{
                left: strokeSelBox.x,
                top: strokeSelBox.y,
                width: strokeSelBox.w,
                height: strokeSelBox.h
              }}
              onLostPointerCapture={onColPointerUp}
              onPointerDown={onStrokeBoxPointerDown}
              onPointerMove={onColPointerMove}
              onPointerUp={onColPointerUp}
            >
              {/* 대각(비율 유지) + 오른쪽(너비) + 아래(높이) — 스크린샷을 칸에 맞춰 눌러 넣을 때
                  비율 고정만으로는 안 되는 경우가 있다. */}
              <span
                aria-hidden="true"
                className="bp-stroke-sel-handle"
                onLostPointerCapture={onStrokeScaleUp}
                onPointerDown={(e) => onStrokeScaleDown(e, "xy")}
                onPointerMove={onStrokeScaleMove}
                onPointerUp={onStrokeScaleUp}
              />
              <span
                aria-hidden="true"
                className="bp-stroke-sel-handle edge-x"
                onLostPointerCapture={onStrokeScaleUp}
                onPointerDown={(e) => onStrokeScaleDown(e, "x")}
                onPointerMove={onStrokeScaleMove}
                onPointerUp={onStrokeScaleUp}
              />
              <span
                aria-hidden="true"
                className="bp-stroke-sel-handle edge-y"
                onLostPointerCapture={onStrokeScaleUp}
                onPointerDown={(e) => onStrokeScaleDown(e, "y")}
                onPointerMove={onStrokeScaleMove}
                onPointerUp={onStrokeScaleUp}
              />
              {/* 그림 한 장만 골랐을 때 — 그 안에서 필요한 조각만 오려낼 수 있다. */}
              {soleImageSel && !imgRegion ? (
                <button
                  className="bp-region-enter"
                  data-act="bp-region-enter"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticTick();
                    setImgRegion({ st: soleImageSel, rect: null });
                  }}
                  title="그림 안에서 영역만 골라 옮기거나 복사"
                  type="button"
                >
                  <Crop aria-hidden="true" size={13} />
                  영역 선택
                </button>
              ) : null}
            </div>
          ) : null}
          {/* 부분 선택 — 그림 위에만 깔리는 얇은 판. 여기서만 드래그를 받아 다른 조작과 안 섞인다. */}
          {imgRegion ? (
            <div
              className="bp-region-layer"
              style={{
                left: imgBox(imgRegion.st).x,
                top: imgBox(imgRegion.st).y,
                width: imgBox(imgRegion.st).w,
                height: imgBox(imgRegion.st).h
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                const host = e.currentTarget.getBoundingClientRect();
                const box = imgBox(imgRegion.st);
                regionDragRef.current = {
                  pointerId: e.pointerId,
                  x0: box.x + (e.clientX - host.left),
                  y0: box.y + (e.clientY - host.top)
                };
                e.currentTarget.setPointerCapture(e.pointerId);
                setImgRegion((cur) => (cur ? { ...cur, rect: null } : cur));
              }}
              onPointerMove={(e) => {
                const d = regionDragRef.current;
                if (!d || d.pointerId !== e.pointerId) return;
                const host = e.currentTarget.getBoundingClientRect();
                const box = imgBox(imgRegion.st);
                const x1 = box.x + (e.clientX - host.left);
                const y1 = box.y + (e.clientY - host.top);
                // 그림 밖으로는 못 나간다 — 없는 곳을 오릴 수는 없다.
                const cx = Math.min(Math.max(x1, box.x), box.x + box.w);
                const cy = Math.min(Math.max(y1, box.y), box.y + box.h);
                setImgRegion((cur) =>
                  cur
                    ? {
                        ...cur,
                        rect: {
                          x: Math.min(d.x0, cx),
                          y: Math.min(d.y0, cy),
                          w: Math.abs(cx - d.x0),
                          h: Math.abs(cy - d.y0)
                        }
                      }
                    : cur
                );
              }}
              onPointerUp={(e) => {
                if (regionDragRef.current?.pointerId === e.pointerId) {
                  regionDragRef.current = null;
                  hapticTick();
                }
              }}
              onLostPointerCapture={() => {
                regionDragRef.current = null;
              }}
            >
              {imgRegion.rect ? (
                <span
                  aria-hidden="true"
                  className="bp-region-rect"
                  style={{
                    left: imgRegion.rect.x - imgBox(imgRegion.st).x,
                    top: imgRegion.rect.y - imgBox(imgRegion.st).y,
                    width: imgRegion.rect.w,
                    height: imgRegion.rect.h
                  }}
                />
              ) : null}
            </div>
          ) : null}
          {/* 확정 막대 — 영역 바로 아래. 여기서 옮길지 복사할지 고른다(Ctrl+X / Ctrl+C도 같다). */}
          {imgRegion?.rect && imgRegion.rect.w >= 4 && imgRegion.rect.h >= 4 ? (
            <div
              className="bp-region-bar"
              style={{ left: imgRegion.rect.x, top: imgRegion.rect.y + imgRegion.rect.h + 8 }}
            >
              <button data-act="bp-region-move" onClick={() => commitRegion(true)} type="button">
                옮기기
              </button>
              <button data-act="bp-region-copy" onClick={() => commitRegion(false)} type="button">
                복사
              </button>
              <button
                className="ghost"
                data-act="bp-region-cancel"
                onClick={() => {
                  hapticTick();
                  setImgRegion(null);
                }}
                type="button"
              >
                취소
              </button>
            </div>
          ) : null}
          {/* 선택 안내 — 다른 레이어에 있어 안 잡힌 경우처럼, 결과가 '아무 일도 안 일어남'일 때만. */}
          {selHint ? (
            <p className="bp-sel-hint" role="status">
              {selHint}
            </p>
          ) : null}
          {/* 스냅 정렬 가이드(드래그 중 가장자리/중앙선이 맞으면 표시) */}
          {guides.v.map((x) => (
            <span aria-hidden="true" className="bp-guide-v" key={`v${x}`} style={{ left: x }} />
          ))}
          {guides.h.map((y) => (
            <span aria-hidden="true" className="bp-guide-h" key={`h${y}`} style={{ top: y }} />
          ))}
        </div>
      </section>

      {/* Clip Studio desktop 문법: 그림 레이어의 썸네일·이름 영역을 직접 끌어 순서 변경.
          액션은 형제 버튼이라 drag와 겹치지 않고, 일정 구조 레이어는 맨 아래 고정이다. */}
      <aside className="bp-layers-panel" aria-label="레이어">
        <p aria-live="polite" className="bp-layer-status" role="status">
          {layerOrderStatus}
        </p>
        <div className="bp-layers-head">
          <strong>레이어</strong>
          <span>끌어서 순서 변경</span>
        </div>
        <button
          aria-label="새 그림 레이어"
          className="bp-layer-add"
          title="새 레이어"
          type="button"
          onClick={addLayer}
         data-act="새 그림 레이어">
          ＋ 새 레이어
        </button>
        <div
          className="bp-layer-list"
          ref={layerListRef}
          role="list"
          aria-label="그림 레이어"
        >
        {/* 스택 순서(0=맨 위)대로 그린다 — 일정 레이어는 이 목록 안에서 자기 자리를 갖는다.
            그림 레이어가 아닌 자리는 아래 '일정' 블록이 렌더되도록 null을 낸다. */}
        {stack.map((sid, li) => {
          if (sid === BG_LAYER_ID) return scheduleLayerRow(layerSlideOf(li));
          const l = layers.find((x) => x.id === sid);
          if (!l) return null;
          return (
          <div
            className={`bp-layer-item${l.vis ? "" : " off"}${l.id === activeLayerId ? " active" : ""}${layerDragUi?.id === l.id ? " dragging" : ""}${layerDragUi?.beforeId === l.id ? " drop-before" : ""}`}
            data-layer-id={l.id}
            key={l.id}
            role="listitem"
            style={
              layerSlideOf(li) !== 0
                ? { transform: `translateY(${layerSlideOf(li)}px)` }
                : undefined
            }
          >
            <button
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              aria-label={`${l.name}, 끌어서 순서 변경`}
              aria-pressed={l.id === activeLayerId}
              className="bp-layer-select"
              title="클릭해 선택 · 끌어서 순서 변경 · Alt+↑/↓"
              type="button"
              onClick={(e) => {
                if (layerDragRef.current) return;
                if (layerDragClickBlockedRef.current && e.detail > 0) {
                  layerDragClickBlockedRef.current = false;
                  return;
                }
                setActiveLayerId(l.id);
              }}
              onKeyDown={(e) => onLayerKeyDown(e, l.id)}
              onLostPointerCapture={onLayerPointerCancel}
              onPointerCancel={onLayerPointerCancel}
              onPointerDown={(e) => onLayerPointerDown(e, l.id)}
              onPointerMove={onLayerPointerMove}
              onPointerUp={onLayerPointerUp}
             data-act="레이어 선택">
              {/* 손잡이는 왼쪽 가장자리(리스트 드래그 관례) — 이름과 버튼 사이(중간)에
                  떠 있으면 무엇을 잡는 표시인지 읽히지 않는다. */}
              <span className="bp-layer-grip" aria-hidden="true">
                <GripVertical size={14} strokeWidth={2.2} />
              </span>
              <span className="bp-layer-thumb" aria-hidden="true">
                <canvas
                  height={72}
                  width={128}
                  ref={(el) => {
                    const m = thumbCanvases.current;
                    if (el) m.set(l.id, el);
                    else m.delete(l.id);
                  }}
                />
              </span>
              <span className="bp-layer-meta">
                {/* 좁은 행에서 '레이어 12'가 '레.'로 잘렸다 — 기본 이름은 번호만 표시
                    (전체 이름은 aria-label·title이 담당). 사용자 지정 이름은 그대로. */}
                <em>{l.name.replace(/^레이어 (?=\d+$)/, "")}</em>
              </span>
            </button>
            <div className="bp-layer-actions">
              <button
                aria-label={`${l.name} 표시`}
                aria-pressed={l.vis}
                className="bp-layer-btn"
                title={l.vis ? "숨기기" : "보이기"}
                type="button"
                onClick={() => toggleLayerVisibility(l.id)}
               data-act="bp-layer-btn">
                {l.vis ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
              </button>
              <button
                aria-label={`${l.name} 삭제`}
                className="bp-layer-btn danger"
                title="레이어 삭제 — Ctrl+Z로 복원할 수 있어요"
                type="button"
                onClick={() => deleteLayer(l.id)}
               data-act="레이어 삭제">
                <X aria-hidden="true" size={14} />
              </button>
            </div>
          </div>
          );
        })}
        </div>
      </aside>
      </div>
    </div>
  );
}
