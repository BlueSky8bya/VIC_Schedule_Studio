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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Lock,
  LockOpen,
  MousePointer2,
  MoveUpRight,
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
import type { MonthCell } from "@/lib/calendar/month";
import { splitEventTitle } from "@/lib/calendar/month";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { hapticTick } from "@/lib/ui/haptics";
import {
  appendPoint,
  backingScale,
  createStrokeStore,
  drawPenIncremental,
  drawStroke,
  isShapeTool,
  strokeAppliesTo,
  type BroadcastTool,
  type Stroke,
  type StrokeLayer,
  type StrokePoint,
  type StrokeStore
} from "@/lib/broadcast/stroke-engine";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 판서 팔레트 17색(그림판식 2줄 트레이) + 마지막 칸 '직접 고르기'(네이티브 색상판).
const PEN_COLORS = [
  "#374151",
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
type HistAction =
  | { t: "stroke" } // 실제 획은 stroke store가 보관 — 여기선 순서만
  | { t: "cols"; before: Map<string, ColBox>; after: Map<string, ColBox> }
  | { t: "sent"; before: string[]; after: string[]; colsBefore: Map<string, ColBox> }
  | { t: "layers"; before: PanelLayer[]; after: PanelLayer[] }
  | {
      t: "xform";
      cols: { before: Map<string, ColBox>; after: Map<string, ColBox> } | null;
      strokes: { targets: Stroke[]; before: StrokeGeom[]; after: StrokeGeom[] } | null;
    }
  // 부분 선택이 획을 분할해 장면 배열 구조가 바뀔 때 — 전/후 장면 스냅샷(얕은 배열 복사).
  | { t: "scene"; before: Stroke[]; after: Stroke[] };

// 판서판 위 날짜 컬럼의 자유 배치 상태(그림판답게 끌어서 이동·크기 조절 — 선택 도구에서만).
type ColBox = { x: number; y: number; w: number };
const COL_DEFAULT_W = 220;
const COL_MIN_W = 140;
const COL_MAX_W = 520;

// 그리기 레이어(동적) — '일정'(날짜 카드 DOM)은 고정 기본, 나머지는 ➕로 자유 추가/삭제.
type PanelLayer = { id: string; name: string; vis: boolean; lock: boolean };
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

  // ── 판서 엔진(M4b): stroke 벡터 스토어 + committed 캔버스 2장(형광펜·펜) + 라이브 1장 ──
  // 배경(날짜 카드 DOM)과 캔버스는 같은 좌표면(.bp-board-inner)에 있다 — 보드가 가로
  // 스크롤돼도 카드와 판서가 '함께' 움직인다(G3b: 캔버스 고정 시 스크롤에서 좌표 분리).
  // 렌더 전략(G3b 성능): 평상시엔 committed bitmap을 유지하고 —
  //  - 펜·지우개: rAF마다 '새 구간만' committed 캔버스에 증분 렌더(전체 재생 없음)
  //  - 형광펜: 반투명이라 구간 겹침 시 이음매가 진해진다 → 라이브 캔버스에 현재 stroke만
  //    통째로 다시 그리고(싸다), 뗄 때 한 번 committed로 옮긴다
  //  - 전체 재생(replayAll)은 undo/redo/전체 지우기/리사이즈 때만.
  const storeRef = useRef<StrokeStore | null>(null);
  const store = (storeRef.current ??= createStrokeStore()); // 지연 초기화(렌더마다 생성 방지)
  const boardInnerRef = useRef<HTMLDivElement | null>(null);
  // 동적 레이어 캔버스/썸네일 — 레이어 id → 요소(마운트/언마운트를 ref 콜백이 관리).
  const layerCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const thumbCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const drawnIdxRef = useRef(1); // committed 증분 렌더가 소화한 point 수(펜·지우개)
  const activePtrRef = useRef<number | null>(null); // 이 포인터만 stroke를 움직인다(다중 터치 가드)
  const rafRef = useRef<number | null>(null);
  const scaleRef = useRef(1);
  const lastFitRef = useRef({ w: 0, h: 0, scale: 0 });
  const [tool, setTool] = useState<BroadcastTool>("select");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[2]);
  // '색 직접 고르기' 팝오버 — 네이티브 OS 색상판 대신 태그 편집과 같은 인라인 피커를 재사용
  // (주변과 같은 디자인 언어: 같은 트레이·SV 영역·톤 필터). openedWith = 취소 시 복귀 색.
  const [colorPop, setColorPop] = useState<{ anchor: DOMRect; openedWith: string } | null>(null);
  const colorPopRef = useRef(colorPop);
  colorPopRef.current = colorPop;
  // 레이어 목록(위 = 맨 위 레이어). 배경(날짜 카드 DOM)은 목록 밖 고정 기본 — 표시 토글만.
  const [layers, setLayers] = useState<PanelLayer[]>(() => [
    { id: "layer-1", name: "레이어 1", vis: true, lock: false }
  ]);
  const [activeLayerId, setActiveLayerId] = useState("layer-1");
  const layerSeq = useRef(1);
  const [bgVis, setBgVis] = useState(true);
  // '일정' 레이어(맨 아래 고정 — 날짜 카드 DOM)도 활성 대상: 카드 선택/이동/크기는
  // 이 레이어가 활성일 때만 된다(그리기 레이어 활성 중 카드가 딸려 움직이는 혼선 제거).
  const bgActive = activeLayerId === BG_LAYER_ID;
  const bgActiveRef = useRef(bgActive);
  bgActiveRef.current = bgActive;
  // 활성 레이어가 바뀌면 반대편 선택은 해제 — 조작 불가능한 선택 링이 남는 혼선 방지.
  useEffect(() => {
    if (activeLayerId === BG_LAYER_ID) setStrokeSel([]);
    else setColSel(new Set());
  }, [activeLayerId]);
  // undo/redo 버튼 활성 + 오른쪽 레이어 썸네일 갱신용(스토어는 ref라 리렌더를 직접 못 일으킨다).
  const [strokeVersion, setStrokeVersion] = useState(0);
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
      if (src.width > 0 && src.height > 0) {
        const s = Math.min(thumb.width / src.width, thumb.height / src.height);
        ctx.drawImage(src, 0, 0, src.width * s, src.height * s);
      }
    }
  }, [strokeVersion, layers]);
  // 전체 지우기 2단계 확인(undo 불가 + 잠긴 레이어 포함이라 오조작 방어, G3b).
  const [clearArmed, setClearArmed] = useState(false);
  const clearArmTimer = useRef<number | null>(null);
  // 날짜 선택 달력 접기 — 그림판 공간 확보(보내기 후 자동 접힘, 헤더 토글로 다시 펼침).
  const [pickerOpen, setPickerOpen] = useState(true);
  // 날짜 컬럼 자유 배치(위치·폭). 폭 비율만큼 글자도 커진다(컬럼 fontSize %) — '크게 보여주기'.
  const [cols, setCols] = useState<Map<string, ColBox>>(() => new Map());
  // ── 선택 도구 캔버스 조작(피그마 문법): 다중 선택·그룹 이동·스냅 가이드·정렬 ──
  const [colSel, setColSel] = useState<Set<string>>(() => new Set());
  const colSelRef = useRef(colSel);
  colSelRef.current = colSel;
  const colElsRef = useRef(new Map<string, HTMLElement>()); // 높이 실측용(스냅·정렬·러버밴드)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null
  );
  // 러버밴드로 잡힌 '획'(필기) — store 획 객체 참조. 카드처럼 이동·확대 대상(그림판 선택 문법).
  const [strokeSel, setStrokeSel] = useState<Stroke[]>([]);
  const strokeSelRef = useRef(strokeSel);
  strokeSelRef.current = strokeSel;
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const dragColRef = useRef<{
    key: string;
    mode: "move" | "resize";
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
  const histRef = useRef<{ undo: HistAction[]; redo: HistAction[] }>({ undo: [], redo: [] });
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const sentRef = useRef(sentDateKeys);
  sentRef.current = sentDateKeys;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const pushHist = useCallback((a: HistAction) => {
    histRef.current.undo.push(a);
    histRef.current.redo = [];
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
    mode: "move" | "resize"
  ) {
    if (tool !== "select") return; // 그리기 도구 중엔 입력면이 위에 있어 어차피 안 옴 — 이중 가드
    if (!bgActive) return; // 카드 이동/크기는 '일정' 레이어가 활성일 때만(레이어 규율)
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
          : null
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
    if (d.mode === "resize") {
      setCols((map) => {
        const next = new Map(map);
        next.set(d.key, {
          x: d.orig.x,
          y: d.orig.y,
          w: Math.min(COL_MAX_W, Math.max(COL_MIN_W, d.orig.w + dx))
        });
        return next;
      });
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
    for (const [k, b] of d.origs) {
      const h = colElsRef.current.get(k)?.offsetHeight ?? 300;
      dx = Math.min(dx, d.maxX - 8 - (b.x + b.w));
      dy = Math.min(dy, d.maxY - 8 - (b.y + h));
      dx = Math.max(dx, -b.x);
      dy = Math.max(dy, -b.y);
    }
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
        next.set(k, { x: Math.max(0, b.x + dx), y: Math.max(0, b.y + dy), w: b.w });
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
          }
        });
      } else {
        pushHist({ t: "cols", before: colsChange.before, after: colsChange.after });
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
  function onBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool !== "select" || e.button !== 0) return;
    // 카드/버튼 위에서 시작하면 러버밴드 아님(카드 자체 핸들러가 처리).
    if ((e.target as HTMLElement).closest(".bp-day-col, button")) return;
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
  // 대상은 '활성 레이어'의 획만 — 그림판 문법(선택/이동/확대가 다른 레이어를 건드리면
  // 레이어 분리 의미가 없어진다). 활성 레이어가 잠김/숨김이면 아무것도 안 잡힌다. ──
  function splitSelectStrokes(lo: { x: number; y: number }, hi: { x: number; y: number }) {
    const act = layersRef.current.find((l) => l.id === activeLayerId);
    const layerOk = new Map(
      layersRef.current.map((l) => [l.id, l.id === act?.id && l.vis && !l.lock])
    );
    const inside = (pt: StrokePoint) =>
      pt.x >= lo.x && pt.x <= hi.x && pt.y >= lo.y && pt.y <= hi.y;
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
    const actCanvas = act ? layerCanvases.current.get(act.id) : null;
    const scale = scaleRef.current;
    let bandPixels: ImageData | null = null;
    let bandW = 0;
    let bandH = 0;
    if (actCanvas) {
      const sx = Math.max(0, Math.floor(lo.x * scale));
      const sy = Math.max(0, Math.floor(lo.y * scale));
      bandW = Math.min(actCanvas.width - sx, Math.ceil((hi.x - lo.x) * scale) + 2);
      bandH = Math.min(actCanvas.height - sy, Math.ceil((hi.y - lo.y) * scale) + 2);
      if (bandW > 0 && bandH > 0) {
        try {
          bandPixels = actCanvas.getContext("2d")?.getImageData(sx, sy, bandW, bandH) ?? null;
        } catch {
          bandPixels = null; // 픽셀 접근 실패 시 검증 생략(선택은 동작)
        }
      }
    }
    const visibleAt = (pt: StrokePoint): boolean => {
      if (!bandPixels) return true;
      const px = Math.min(bandW - 1, Math.max(0, Math.round((pt.x - lo.x) * scale)));
      const py = Math.min(bandH - 1, Math.max(0, Math.round((pt.y - lo.y) * scale)));
      return bandPixels.data[(py * bandW + px) * 4 + 3] > 24;
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
      const flags = s.points.map(inside);
      if (!flags.some(Boolean) || !s.points.some((pt, i) => flags[i] && visibleAt(pt))) {
        nextScene.push(s); // 밴드 밖이거나, 밴드 안 구간이 전부 지워져 안 보이는 획
        continue;
      }
      if (flags.every(Boolean) || isShapeTool(s.tool)) {
        nextScene.push(s);
        picked.push(s);
        continue;
      }
      // 부분 겹침 → 연속 구간(run) 단위로 쪼갠다. 경계 보간점은 양쪽 조각이 공유해
      // 이어 보이던 곳이 뚝 끊겨 보이지 않는다(z순서는 원래 자리 그대로).
      changed = true;
      let run: StrokePoint[] = [{ ...s.points[0] }];
      let runIn = flags[0];
      const flush = () => {
        if (run.length > 0) {
          const frag: Stroke = {
            tool: s.tool,
            layer: s.layer,
            color: s.color,
            width: s.width,
            points: run
          };
          nextScene.push(frag);
          if (runIn) picked.push(frag);
        }
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
        flush();
        run = [b, { ...pt }];
        runIn = flags[i];
      }
      flush();
    }
    if (changed) {
      store.setStrokes(nextScene);
      pushHist({ t: "scene", before, after: [...nextScene] });
      // 분할된 레이어들 재생(선언 순서 제약으로 ref 경유 — replayAll과 동일 효과).
      for (const l of layersRef.current) replayLayerFnRef.current(l.id);
      setStrokeVersion((v) => v + 1);
    }
    setStrokeSel(picked);
  }

  // ── 선택 획 박스(그림판 선택 문법): 점선 bbox — 끌면 이동, 모서리 손잡이로 확대/축소 ──
  const strokeSelBox = useMemo(() => {
    if (tool !== "select" || strokeSel.length === 0) return null;
    const live = new Set(store.strokes());
    const sel = strokeSel.filter((s) => live.has(s)); // 레이어 삭제 등으로 사라진 획 제외
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
  }, [tool, strokeSel, store, strokeVersion]);
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
      origs,
      beforeAll: new Map(colsRef.current),
      moved: false,
      startSL: boardScrollRef.current?.scrollLeft ?? 0,
      startST: boardScrollRef.current?.scrollTop ?? 0,
      maxX: (boardInnerRef.current?.offsetWidth ?? 4000) + 480,
      maxY: (boardInnerRef.current?.offsetHeight ?? 3000) + 480,
      clamp: { xPos: false, xNeg: false, yPos: false, yNeg: false },
      strokeOrigs: snapshotStrokes(strokeSelRef.current)
    };
  }
  // 모서리 손잡이: bbox 왼쪽 위를 앵커로 균일 확대/축소 — 굵기도 비례(그림판 감각).
  const strokeScaleRef = useRef<{
    pointerId: number;
    anchor: { x: number; y: number };
    startW: number;
    startH: number;
    origs: Map<Stroke, StrokeGeom>;
  } | null>(null);
  function onStrokeScaleDown(e: React.PointerEvent<HTMLElement>) {
    if (tool !== "select" || e.button !== 0 || !strokeSelBox) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeScaleRef.current = {
      pointerId: e.pointerId,
      anchor: { x: strokeSelBox.x, y: strokeSelBox.y },
      startW: Math.max(8, strokeSelBox.w),
      startH: Math.max(8, strokeSelBox.h),
      origs: snapshotStrokes(strokeSelBox.sel)
    };
  }
  function onStrokeScaleMove(e: React.PointerEvent<HTMLElement>) {
    const sc = strokeScaleRef.current;
    if (!sc || e.pointerId !== sc.pointerId) return;
    const p = innerPointC(e.clientX, e.clientY);
    if (!p) return;
    const s = Math.max(
      0.2,
      Math.min(8, Math.max((p.x - sc.anchor.x) / sc.startW, (p.y - sc.anchor.y) / sc.startH))
    );
    for (const [st, g] of sc.origs) {
      st.points = g.points.map((pt) => ({
        x: sc.anchor.x + (pt.x - sc.anchor.x) * s,
        y: sc.anchor.y + (pt.y - sc.anchor.y) * s,
        p: pt.p
      }));
      st.width = Math.max(0.5, Math.min(240, g.width * s));
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

  // ── 정렬(2개 이상 선택 시) — 위 맞춤 · 세로 중앙 · 왼쪽 맞춤 · 가로 균등 간격 ──
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
  function alignSelected(kind: "top" | "middle" | "left" | "distribute-x") {
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
    for (const r of rects) next.set(r.k, { x: r.x, y: r.y, w: r.w });
    setCols(next);
    pushHist({ t: "cols", before, after: next });
  }

  const canvasOf = useCallback((layer: StrokeLayer) => {
    return layerCanvases.current.get(layer) ?? null;
  }, []);
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
  const replayLayer = useCallback(
    (layer: StrokeLayer) => {
      const canvas = canvasOf(layer);
      clearCanvas(canvas);
      const ctx = scaledCtx(canvas);
      if (!ctx) return;
      for (const s of store.strokes()) {
        if (strokeAppliesTo(s, layer)) drawStroke(ctx, s);
      }
    },
    [canvasOf, clearCanvas, scaledCtx, store]
  );
  const replayAll = useCallback(() => {
    for (const id of layerCanvases.current.keys()) replayLayer(id);
    clearCanvas(liveCanvasRef.current);
  }, [replayLayer, clearCanvas]);
  // 위쪽 제스처 코드(획 이동/확대)가 최신 replayLayer를 부르게 ref로 노출(선언 순서 제약 회피).
  replayLayerFnRef.current = replayLayer;

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
    store.push(live);
    pushHist({ t: "stroke" }); // 통합 히스토리에도 순서 기록(Ctrl+Z 하나로 전부)
  }, [canvasOf, clearCanvas, scaledCtx, store, pushHist]);

  // 리사이즈 → 크기가 실제로 변했을 때만 backing 재할당 + 명령 재생(연속 리사이즈 churn 방지).
  useEffect(() => {
    const inner = boardInnerRef.current;
    if (!inner) return;
    let fitRaf: number | null = null;
    const fit = () => {
      fitRaf = null;
      const cssW = inner.clientWidth;
      const cssH = inner.clientHeight;
      const scale = backingScale(cssW, cssH, window.devicePixelRatio || 1);
      const W = Math.round(cssW * scale);
      const H = Math.round(cssH * scale);
      // 크기가 다른 캔버스만 재할당(새로 추가된 레이어 캔버스 포함 — width 0으로 마운트됨).
      let dirty = false;
      for (const canvas of [...layerCanvases.current.values(), liveCanvasRef.current]) {
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
    };
  }, [store]);

  function boardPoint(e: React.PointerEvent): { x: number; y: number } | null {
    const inner = boardInnerRef.current;
    if (!inner) return null;
    const r = inner.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  // 그림판 문법: 펜/형광펜/지우개 전부 '활성 레이어'에만 작용. 활성 레이어가 없거나
  // 잠김/숨김이면 그리기 차단.
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;
  const toolBlocked =
    tool !== "select" && (!activeLayer || activeLayer.lock || !activeLayer.vis);

  // rAF 병합 플러시 — move마다가 아니라 프레임당 한 번만 그린다(G3b).
  const flushDraw = useCallback(() => {
    rafRef.current = null;
    const live = drawingRef.current;
    if (!live) return;
    if (live.tool === "pen") {
      // 펜: 라이브 캔버스에 '확정 조각만' 증분 — 통째 리드로는 긴 낙서에서 프레임을
      // 밀려 잉크가 늦게 보였다. 임시 꼬리를 안 그리므로 울퉁불퉁 잔재도 없다.
      const ctx = scaledCtx(liveCanvasRef.current);
      if (ctx) drawnIdxRef.current = drawPenIncremental(ctx, live, drawnIdxRef.current);
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
  function widthFactor(e: React.PointerEvent, x: number, y: number): number {
    if (e.pointerType === "pen" && e.pressure > 0) {
      return Math.min(1, Math.max(0.12, e.pressure));
    }
    const d = strokeDynRef.current;
    const dt = Math.max(1, e.timeStamp - d.t);
    const v = Math.hypot(x - d.x, y - d.y) / dt; // px/ms
    const target = Math.min(1, Math.max(0.3, 1 - v / 1.7));
    const f = d.f * 0.65 + target * 0.35;
    strokeDynRef.current = { t: e.timeStamp, x, y, f };
    return f;
  }
  function onDrawDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === "select" || !activeLayer || toolBlocked || e.button !== 0) return;
    if (drawingRef.current !== null) return; // 이미 다른 포인터가 그리는 중(다중 터치 가드)
    const p = boardPoint(e);
    if (!p) return;
    activePtrRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeDynRef.current = { t: e.timeStamp, x: p.x, y: p.y, f: 0.8 };
    const f0 = e.pointerType === "pen" && e.pressure > 0 ? Math.max(0.12, e.pressure) : 0.8;
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
    const live = drawingRef.current;
    if (!live || e.pointerId !== activePtrRef.current) return;
    const p = boardPoint(e);
    if (!p) return;
    if (isShapeTool(live.tool)) {
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
    const f = widthFactor(e, p.x, p.y);
    if (appendPoint(live.points, { x: p.x, y: p.y, p: f })) scheduleFlush();
  }
  function endDraw(e?: React.PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current) return;
    if (e && e.pointerId !== activePtrRef.current) return; // 다른 포인터의 up/cancel 무시
    finishLiveStroke();
  }
  const doUndo = useCallback(() => {
    finishLiveStroke(); // 그리던 획 먼저 완성 — replay가 live를 날리는 불일치 방지(G3b-r)
    const a = histRef.current.undo.pop();
    if (!a) return;
    histRef.current.redo.push(a);
    if (a.t === "stroke") {
      store.undo();
      replayAll();
    } else if (a.t === "cols") {
      setCols(new Map(a.before));
    } else if (a.t === "sent") {
      // cols 먼저 복원 — sentDateKeys prop 변화로 도는 동기화 effect가 '이전 cols'를 읽어
      // 복원된 위치를 유지한다(빠졌다 돌아온 날짜의 자리 보존).
      setCols(new Map(a.colsBefore));
      onRestoreSent(a.before);
    } else if (a.t === "xform") {
      if (a.cols) setCols(new Map(a.cols.before));
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
      if (!a.before.some((l) => l.id === activeLayerId)) {
        setActiveLayerId(a.before[0]?.id ?? "");
      }
      // 복원된 레이어 캔버스는 다음 렌더에 마운트 → fit effect(deps: layers)가 사이징+재생.
    }
    hapticTick();
    setStrokeVersion((v) => v + 1);
  }, [store, replayAll, finishLiveStroke, onRestoreSent, activeLayerId]);
  const doRedo = useCallback(() => {
    finishLiveStroke();
    const a = histRef.current.redo.pop();
    if (!a) return;
    histRef.current.undo.push(a);
    if (a.t === "stroke") {
      store.redo();
      replayAll();
    } else if (a.t === "cols") {
      setCols(new Map(a.after));
    } else if (a.t === "sent") {
      onRestoreSent(a.after);
    } else if (a.t === "xform") {
      if (a.cols) setCols(new Map(a.cols.after));
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
      if (!a.after.some((l) => l.id === activeLayerId)) {
        setActiveLayerId(a.after[0]?.id ?? "");
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
    histRef.current = { undo: [], redo: [] };
    hapticTick();
    setStrokeVersion((v) => v + 1);
    replayAll();
  }, [clearArmed, store, replayAll, finishLiveStroke]);

  // ── 레이어 추가/삭제(그림판 문법: 자유롭게) ──
  function addLayer() {
    hapticTick();
    layerSeq.current += 1;
    const id = `layer-${layerSeq.current}`;
    const before = layersRef.current;
    const after = [{ id, name: `레이어 ${layerSeq.current}`, vis: true, lock: false }, ...before];
    setLayers(after);
    setActiveLayerId(id); // 새 레이어가 맨 위 + 바로 활성
    pushHist({ t: "layers", before, after });
  }
  function deleteLayer(id: string) {
    // 즉시 삭제 — 단, 획은 store에 남겨둔다(캔버스가 언마운트돼 안 보일 뿐). 그래야
    // Ctrl+Z로 레이어를 복원하면 그 위의 획도 그대로 되살아난다(통합 히스토리).
    finishLiveStroke(); // 그 레이어에 그리던 중이면 완성부터
    const before = layersRef.current;
    const after = before.filter((l) => l.id !== id);
    setLayers(after);
    if (activeLayerId === id) setActiveLayerId(after[0]?.id ?? "");
    pushHist({ t: "layers", before, after });
    hapticTick();
  }

  const eventsByDate = useMemo(
    () => new Map(days.map((d) => [d.dateKey, d.events] as const)),
    [days]
  );

  // 미니 달력 다중선택 — 편집 그리드와 완전히 분리된 자체 인스턴스(D2).
  // 보내기 버튼은 exempt: 누르는 순간 onDocDown이 선택을 지우는 것 방지(D2-b).
  // escapeClears:false — Esc 의미(선택 해제 vs 닫기)는 아래 단일 핸들러가 결정한다(G3a:
  // 훅·패널 핸들러가 경쟁하면 리스너 순서와 오래된 ref 읽기에 의존하게 된다).
  const rangeSelect = useCellRangeSelect<HTMLDivElement>({
    exemptRefs: [sendBtnRef],
    escapeClears: false
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

  function handleSend() {
    const keys = selectedDateKeys();
    if (keys.length === 0) return;
    hapticTick();
    const before = [...sentRef.current];
    const after = [...new Set([...before, ...keys])].sort();
    pushHist({ t: "sent", before, after, colsBefore: new Map(colsRef.current) });
    onSend(keys);
    rangeSelect.clearSelection();
    setPickerOpen(false); // 보냈으면 달력은 접어 그림판 공간 확보(헤더로 다시 펼침)
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
      // 색 팝오버가 열려 있는 동안엔 팝오버가 키보드(Esc/입력)를 갖는다 — 패널 단축키 정지.
      if (colorPopRef.current) return;
      if (e.key === "Escape") {
        // 우선순위: 카드/획 다중선택 해제 → 날짜 선택 해제 → 창 닫기(한 번에 하나).
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
      // Delete/Backspace = 선택된 것 일괄 삭제(카드·획 각각 히스토리 1건 — Ctrl+Z로 복원).
      if (
        (colSelRef.current.size > 0 || strokeSelRef.current.length > 0) &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        e.preventDefault();
        // 선택된 획 삭제 — 장면에서 제거(scene 스냅샷으로 undo 가능).
        if (strokeSelRef.current.length > 0) {
          const dead = new Set(strokeSelRef.current);
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
        if (colSelRef.current.size > 0) {
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
          if (b) next.set(k, { x: Math.max(0, b.x + dx), y: Math.max(0, b.y + dy), w: b.w });
        }
        setCols(next);
        pushHist({ t: "cols", before, after: next });
        return;
      }
      // Ctrl+A = 카드 전체 선택 — '일정' 레이어가 활성일 때만(레이어 규율).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (bgActiveRef.current) setColSel(new Set(sentRef.current));
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
  }, [onClose, rangeSelect, doUndo, doRedo, pushHist, onRestoreSent, store]);

  // 최초 포커스 + body scroll lock(열림 동안 뒤 화면 스크롤 금지).
  useEffect(() => {
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const sentDays: BroadcastPanelDay[] = sentDateKeys.map((dateKey) => ({
    dateKey,
    events: eventsByDate.get(dateKey) ?? []
  }));

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
        >
          <X aria-hidden="true" size={20} strokeWidth={3} />
        </button>
      </header>

      {/* 판서 도구줄(M4b) — 실제 그림판(리본) 문법: 묶음마다 아래에 작은 라벨, 세로 구분선.
          role은 group — toolbar 역할은 방향키 roving tabindex가 필수라(G3b) 일반 Tab 이동으로 둔다. */}
      <div className="bp-toolbar" role="group" aria-label="판서 도구">
        <div className="bp-tool-group" role="group" aria-label="도구">
          <div className="bp-group-row bp-grid2">
            {(
              [
                ["select", "선택", MousePointer2],
                ["pen", "펜", Pen],
                ["hl", "형광펜", Highlighter],
                ["eraser", "지우개", Eraser]
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                aria-label={label}
                aria-pressed={tool === key}
                className={`bp-tool${tool === key ? " on" : ""}`}
                key={key}
                title={label}
                type="button"
                onClick={() => {
                  hapticTick();
                  setTool(key);
                }}
              >
                <Icon aria-hidden="true" size={16} />
              </button>
            ))}
          </div>
          <em className="bp-group-label">도구</em>
        </div>
        <div className="bp-tool-group" role="group" aria-label="도형">
          <div className="bp-group-row bp-grid2">
            {(
              [
                ["line", "직선", Slash],
                ["arrow", "화살표", MoveUpRight],
                ["rect", "사각형", Square],
                ["ellipse", "원", Circle]
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                aria-label={label}
                aria-pressed={tool === key}
                className={`bp-tool${tool === key ? " on" : ""}`}
                key={key}
                title={`${label} — Shift로 정비율`}
                type="button"
                onClick={() => {
                  hapticTick();
                  setTool(key);
                }}
              >
                <Icon aria-hidden="true" size={16} />
              </button>
            ))}
          </div>
          <em className="bp-group-label">도형</em>
        </div>
        <div className="bp-tool-group" role="group" aria-label="색">
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
                  setPenColor(c);
                  // 색을 골랐다 = 그릴 준비 — 색을 안 쓰는 도구(선택·지우개)였다면 펜으로.
                  // (형광펜·도형은 색을 쓰므로 유지 — 색만 바꿔서 계속 그린다.)
                  if (tool === "select" || tool === "eraser") setTool("pen");
                }}
              />
            ))}
            {/* 직접 고르기 — 태그 편집과 같은 인라인 색 피커 팝오버(디자인 통일).
                팔레트에 없는 색이 선택돼 있으면 이 칸이 그 색으로 켜진다. */}
            <button
              aria-expanded={colorPop !== null}
              aria-label="색 직접 고르기"
              className={`bp-color bp-color-custom${PEN_COLORS.includes(penColor) && !colorPop ? "" : " on"}`}
              style={PEN_COLORS.includes(penColor) ? undefined : { background: penColor }}
              title="색 직접 고르기"
              type="button"
              // 팝오버의 light-dismiss(문서 mousedown)가 이 버튼을 '바깥'으로 오인해
              // 닫았다 → click이 다시 여는 왕복을 막는다.
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                hapticTick();
                if (colorPop) {
                  setColorPop(null);
                  return;
                }
                setColorPop({
                  anchor: e.currentTarget.getBoundingClientRect(),
                  openedWith: penColor
                });
                if (tool === "select" || tool === "eraser") setTool("pen");
              }}
            />
          </div>
          <em className="bp-group-label">색</em>
          {colorPop ? (
            <ColorPickerPopover
              anchor={colorPop.anchor}
              canClear={false}
              kind="modifier"
              value={penColor}
              onCancel={() => {
                setPenColor(colorPop.openedWith);
                setColorPop(null);
              }}
              onChange={(hex) => {
                setPenColor(hex);
                if (tool === "select" || tool === "eraser") setTool("pen");
              }}
              onClear={() => {}}
              onClose={() => setColorPop(null)}
            />
          ) : null}
        </div>
        <div className="bp-tool-group" role="group" aria-label="굵기">
          <div className="bp-group-row bp-grid3">
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
                }}
              >
                <i style={{ width: Math.min(w + 2, 18), height: Math.min(w + 2, 18) }} />
              </button>
            ))}
          </div>
          <em className="bp-group-label">굵기</em>
        </div>
        <div className="bp-tool-group" role="group" aria-label="기록">
          <div className="bp-group-row">
            <button
              aria-label="실행 취소 (Ctrl+Z)"
              className="bp-tool"
              disabled={histRef.current.undo.length === 0}
              title="실행 취소 — 획·카드 배치·날짜·레이어 전부 (Ctrl+Z)"
              type="button"
              onClick={doUndo}
            >
              <Undo2 aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="다시 실행 (Ctrl+Shift+Z)"
              className="bp-tool"
              disabled={histRef.current.redo.length === 0}
              title="다시 실행 (Ctrl+Shift+Z)"
              type="button"
              onClick={doRedo}
            >
              <Redo2 aria-hidden="true" size={16} />
            </button>
            <button
              aria-label={clearArmed ? "한 번 더 누르면 전체 지우기" : "전체 지우기"}
              className={`bp-tool danger${clearArmed ? " armed" : ""}`}
              // redo 기록만 남은 상태(전량 undo)에서도 활성 — 그래야 잠금을 풀 유일한 경로
              // (전체 지우기 = redoStack까지 소거)가 막히지 않는다(G3b 5차).
              disabled={store.strokes().length === 0 && !store.canRedo() && !clearArmed}
              title="전체 지우기 — 잠긴 레이어 포함, 되돌릴 수 없음 (두 번 눌러 실행)"
              type="button"
              onClick={doClearAll}
            >
              {clearArmed ? (
                <span className="bp-clear-confirm">확실해요?</span>
              ) : (
                <Trash2 aria-hidden="true" size={16} />
              )}
            </button>
          </div>
          <em className="bp-group-label">기록</em>
        </div>
        {tool === "select" && colSel.size >= 2 ? (
          <div className="bp-tool-group" role="group" aria-label="정렬">
            <div className="bp-group-row bp-grid2">
              <button
                aria-label="위 맞춤"
                className="bp-tool"
                title="위 맞춤(수평 맞추기)"
                type="button"
                onClick={() => alignSelected("top")}
              >
                <AlignStartHorizontal aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="세로 중앙 맞춤"
                className="bp-tool"
                title="세로 중앙 맞춤"
                type="button"
                onClick={() => alignSelected("middle")}
              >
                <AlignCenterHorizontal aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="왼쪽 맞춤"
                className="bp-tool"
                title="왼쪽 맞춤"
                type="button"
                onClick={() => alignSelected("left")}
              >
                <AlignStartVertical aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="가로 균등 간격"
                className="bp-tool"
                title="가로 균등 간격"
                type="button"
                onClick={() => alignSelected("distribute-x")}
              >
                <AlignHorizontalDistributeCenter aria-hidden="true" size={16} />
              </button>
            </div>
            <em className="bp-group-label">정렬({colSel.size})</em>
          </div>
        ) : null}
        {toolBlocked ? (
          <span className="bp-lock-hint">
            {bgActive
              ? "'일정' 레이어에선 카드 선택·이동만 — 그리려면 위 레이어를 골라주세요"
              : layers.length === 0
                ? "레이어가 없어요 — 오른쪽 ➕로 추가해주세요"
                : "활성 레이어가 잠겨 있거나 숨겨져 있어요"}
          </span>
        ) : null}
      </div>

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
          >
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
          >
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2.5} />
          </button>
          {/* 달력 접기 — 그림판 공간이 주인공. 보내면 자동으로 접히고 여기로 다시 펼친다. */}
          <button
            aria-expanded={pickerOpen}
            className="bp-picker-toggle"
            type="button"
            onClick={() => {
              hapticTick();
              setPickerOpen((v) => !v);
            }}
          >
            📅 {monthLabel} {pickerOpen ? "접기" : "날짜 고르기"}
          </button>
          <button
            className="bp-send"
            disabled={selectedDateKeys().length === 0}
            onClick={handleSend}
            ref={sendBtnRef}
            type="button"
          >
            그림판으로 보내기{selectedDateKeys().length > 0 ? ` (${selectedDateKeys().length})` : ""}
          </button>
        </div>
        {pickerOpen ? (
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
                const cls = [
                  "bp-mini-cell",
                  inMonth ? "" : "outside",
                  picked ? "picked" : "",
                  cell.weekday === 0 ? "sun" : cell.weekday === 6 ? "sat" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                // 회색(전월/익월) 날짜도 선택 가능 — 월 경계에 걸친 설명에 필요(주역 아님은
                // 스타일로만 구분). 키보드: Enter/Space = Ctrl+클릭과 같은 개별 토글.
                return (
                  <div
                    aria-checked={picked}
                    aria-label={`${Number(cell.isoDate.slice(5, 7))}월 ${cell.dayOfMonth}일${evs.length > 0 ? ` (일정 ${evs.length}개)` : ""}`}
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
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <div className="bp-main">
      <section className="bp-board" aria-label="그림판" ref={boardScrollRef}>
        {/* 스크롤 좌표면(G3b): 배경 카드·캔버스·입력면이 전부 이 inner 안 — 보드를 스크롤하면
            카드와 판서가 같이 움직여 좌표가 절대 안 어긋난다. 컬럼 자유 배치 범위만큼 inner가
            커진다(minWidth/minHeight). */}
        <div
          className="bp-board-inner"
          ref={boardInnerRef}
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerUp}
          onLostPointerCapture={onBoardPointerUp}
          // inline min은 CSS의 min-width/height:100%를 '덮어쓴다' — max(100%, …)로 합성해야
          // 컬럼이 적을 때도 종이가 보드 전체를 채운다(안 그러면 왼쪽 위 조각만 흰색).
          style={{
            minWidth: `max(100%, ${Math.max(0, ...[...cols.values()].map((c) => c.x + c.w + 24))}px)`,
            minHeight: `max(100%, ${Math.max(280, ...[...cols.values()].map((c) => c.y + 320))}px)`
          }}
        >
          {/* 배경 레이어 = 날짜 카드 DOM(캔버스 아님 — 메모리 0). 표시 토글은 숨김만. */}
          <div className={`bp-board-bg${bgVis ? "" : " hidden"}`}>
            {sentDays.length === 0 ? (
              <p className="bp-empty">
                보낸 날짜가 여기에 붙어요 — 선택 도구로 끌어 옮기고, 오른쪽 아래 손잡이로 키워요
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
                      >
                        <X aria-hidden="true" size={13} strokeWidth={3} />
                      </button>
                    </header>
                    {day.events.length === 0 ? (
                      <p className="bp-day-empty">일정 없음</p>
                    ) : (
                      day.events.map((ev) => (
                        <EventCard event={ev} key={`${day.dateKey}-${ev.id}`} />
                      ))
                    )}
                    {/* 크기 손잡이(폭·글자 함께) — 선택 도구에서만. */}
                    <span
                      aria-hidden="true"
                      className="bp-col-resize"
                      onLostPointerCapture={onColPointerUp}
                      onPointerDown={(e) => onColPointerDown(e, day.dateKey, "resize")}
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
                ref={(el) => {
                  const m = layerCanvases.current;
                  if (el) m.set(l.id, el);
                  else m.delete(l.id);
                }}
              />
              {l.id === activeLayerId ? (
                <canvas
                  aria-hidden="true"
                  className={`bp-canvas${l.vis ? "" : " hidden"}`}
                  ref={liveCanvasRef}
                />
              ) : null}
            </Fragment>
          ))}
          {/* 드로잉 입력면 — 그리기 도구가 켜졌을 때만 포인터를 받는다(선택 도구면 통과). */}
          <div
            aria-hidden="true"
            className="bp-draw-surface"
            style={{ pointerEvents: tool === "select" ? "none" : "auto" }}
            onLostPointerCapture={endDraw}
            onPointerCancel={endDraw}
            onPointerDown={onDrawDown}
            onPointerMove={onDrawMove}
            onPointerUp={endDraw}
          />
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
              <span
                aria-hidden="true"
                className="bp-stroke-sel-handle"
                onLostPointerCapture={onStrokeScaleUp}
                onPointerDown={onStrokeScaleDown}
                onPointerMove={onStrokeScaleMove}
                onPointerUp={onStrokeScaleUp}
              />
            </div>
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

      {/* 오른쪽 레이어 패널(실제 그림판 문법) — 위가 맨 위 레이어. ➕로 자유 추가, ✕로 삭제
          (2단계 확인 — 획까지 지워지고 되돌릴 수 없음). 배경(날짜 카드)은 맨 아래 고정 기본.
          카드를 클릭하면 그 레이어가 '활성'(펜/형광펜/지우개가 작용하는 곳)이 된다. */}
      <aside className="bp-layers-panel" aria-label="레이어">
        <button aria-label="레이어 추가" className="bp-layer-add" type="button" onClick={addLayer}>
          ＋ 레이어 추가
        </button>
        {layers.map((l) => (
          <div
            className={`bp-layer-item${l.vis ? "" : " off"}${l.id === activeLayerId ? " active" : ""}`}
            key={l.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveLayerId(l.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveLayerId(l.id);
              }
            }}
          >
            <div className="bp-layer-thumb" aria-hidden="true">
              <canvas
                height={72}
                width={128}
                ref={(el) => {
                  const m = thumbCanvases.current;
                  if (el) m.set(l.id, el);
                  else m.delete(l.id);
                }}
              />
            </div>
            <div className="bp-layer-meta">
              <em>{l.name}</em>
              <div className="bp-layer-actions">
                <button
                  aria-label={`${l.name} 표시`}
                  aria-pressed={l.vis}
                  className="bp-layer-btn"
                  title={l.vis ? "숨기기" : "보이기"}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticTick();
                    setLayers((ls) => ls.map((x) => (x.id === l.id ? { ...x, vis: !x.vis } : x)));
                  }}
                >
                  {l.vis ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  aria-label={`${l.name} 잠금`}
                  aria-pressed={l.lock}
                  className="bp-layer-btn"
                  title={l.lock ? "잠금 풀기" : "잠그기"}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticTick();
                    setLayers((ls) => ls.map((x) => (x.id === l.id ? { ...x, lock: !x.lock } : x)));
                  }}
                >
                  {l.lock ? <Lock size={14} /> : <LockOpen size={14} />}
                </button>
                <button
                  aria-label={`${l.name} 삭제`}
                  className="bp-layer-btn danger"
                  title="레이어 삭제 — 이 레이어의 획도 함께 지워져요"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(l.id);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {/* 일정 = 고정 기본 레이어(날짜 카드 DOM) — 삭제/잠금 없음. 활성이면 카드
            선택/이동/크기 조절이 가능(그리기 레이어 활성 중엔 카드가 안 잡힌다). */}
        <div
          className={`bp-layer-item bp-layer-fixed${bgVis ? "" : " off"}${bgActive ? " active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => setActiveLayerId(BG_LAYER_ID)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveLayerId(BG_LAYER_ID);
            }
          }}
        >
          <div className="bp-layer-thumb" aria-hidden="true">
            <span className="bp-layer-thumb-bg">📅</span>
          </div>
          <div className="bp-layer-meta">
            <em>일정</em>
            <div className="bp-layer-actions">
              <button
                aria-label="일정 카드 표시"
                aria-pressed={bgVis}
                className="bp-layer-btn"
                title={bgVis ? "숨기기" : "보이기"}
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // 표시 토글이 활성 전환까지 시키지 않게
                  hapticTick();
                  setBgVis((v) => !v);
                }}
              >
                {bgVis ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}
