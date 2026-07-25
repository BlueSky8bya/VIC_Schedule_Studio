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
import { Eraser, Eye, EyeOff, Highlighter, Lock, LockOpen, MousePointer2, Pen, Redo2, Trash2, Undo2, X } from "lucide-react";

import type { BroadcastPanelDay, BroadcastPanelEvent } from "@/lib/schedules/broadcast-dto";
import type { MonthCell } from "@/lib/calendar/month";
import { splitEventTitle } from "@/lib/calendar/month";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { hapticTick } from "@/lib/ui/haptics";
import {
  appendPoint,
  backingScale,
  createStrokeStore,
  drawStroke,
  strokeAppliesTo,
  type BroadcastTool,
  type Stroke,
  type StrokeLayer,
  type StrokeStore
} from "@/lib/broadcast/stroke-engine";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 판서 팔레트 6색(목업) — 빨/주/노/초/파/검.
const PEN_COLORS = ["#e11d48", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#1f2937"];
// 굵기 3단(펜 기준 px) — 형광펜·지우개는 배수로 키운다.
const PEN_WIDTHS = [3, 5, 8];

type Props = {
  monthLabel: string; // 예: "2026년 7월"
  cells: MonthCell[]; // 42칸 골격(날짜·요일·이번달 여부) — 일정 데이터는 days에서만
  days: BroadcastPanelDay[]; // 이번 달 전체 공개 DTO(dateKey → 카드)
  sentDateKeys: string[]; // 판서판에 올라간 날짜들(호출자 state)
  onSend: (dateKeys: string[]) => void; // "판서판으로 보내기"(추가·dedup은 호출자)
  onRemoveDay: (dateKey: string) => void; // 판서판에서 날짜 컬럼 빼기
  onClose: () => void;
};

// 판서판 위 날짜 컬럼의 자유 배치 상태(그림판답게 끌어서 이동·크기 조절 — 선택 도구에서만).
type ColBox = { x: number; y: number; w: number };
const COL_DEFAULT_W = 220;
const COL_MIN_W = 140;
const COL_MAX_W = 520;

// 그리기 레이어(동적) — 배경(날짜 카드 DOM)은 고정 기본, 나머지는 ➕로 자유 추가/삭제.
type PanelLayer = { id: string; name: string; vis: boolean; lock: boolean };

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
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  // 레이어 목록(위 = 맨 위 레이어). 배경(날짜 카드 DOM)은 목록 밖 고정 기본 — 표시 토글만.
  const [layers, setLayers] = useState<PanelLayer[]>(() => [
    { id: "layer-1", name: "레이어 1", vis: true, lock: false }
  ]);
  const [activeLayerId, setActiveLayerId] = useState("layer-1");
  const layerSeq = useRef(1);
  const [bgVis, setBgVis] = useState(true);
  // 레이어 삭제 2단계(획까지 지워지고 undo 불가 — 오조작 방어).
  const [layerDeleteArm, setLayerDeleteArm] = useState<string | null>(null);
  const layerDeleteTimer = useRef<number | null>(null);
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
  const dragColRef = useRef<{
    key: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: ColBox;
  } | null>(null);
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
  }, [sentDateKeys]);
  function onColPointerDown(
    e: React.PointerEvent<HTMLElement>,
    key: string,
    mode: "move" | "resize"
  ) {
    if (tool !== "select") return; // 그리기 도구 중엔 입력면이 위에 있어 어차피 안 옴 — 이중 가드
    const orig = cols.get(key);
    if (!orig) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragColRef.current = { key, mode, startX: e.clientX, startY: e.clientY, orig };
  }
  function onColPointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = dragColRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setCols((map) => {
      const next = new Map(map);
      next.set(
        d.key,
        d.mode === "move"
          ? { x: Math.max(0, d.orig.x + dx), y: Math.max(0, d.orig.y + dy), w: d.orig.w }
          : {
              x: d.orig.x,
              y: d.orig.y,
              w: Math.min(COL_MAX_W, Math.max(COL_MIN_W, d.orig.w + dx))
            }
      );
      return next;
    });
  }
  function onColPointerUp() {
    dragColRef.current = null;
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
    if (live.tool === "hl") {
      // 라이브 → 자기 레이어 committed로 한 번에 옮긴다.
      clearCanvas(liveCanvasRef.current);
      const ctx = scaledCtx(canvasOf(live.layer));
      if (ctx) drawStroke(ctx, live);
    } else {
      // 남은 꼬리 구간 마저 커밋.
      const from = Math.max(0, drawnIdxRef.current - 1);
      if (live.points.length > drawnIdxRef.current || drawnIdxRef.current === 0) {
        const segment: Stroke = { ...live, points: live.points.slice(from) };
        const ctx = scaledCtx(canvasOf(live.layer));
        if (ctx) drawStroke(ctx, segment);
      }
    }
    store.push(live);
    setStrokeVersion((v) => v + 1);
  }, [canvasOf, clearCanvas, scaledCtx, store]);

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
  }, [replayAll, finishLiveStroke, layers]);

  // 닫힘 = unmount = 소멸(계약 3): stroke 메모리·타이머·rAF를 명시적으로 해제한다.
  useEffect(() => {
    return () => {
      store.dispose();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (clearArmTimer.current !== null) window.clearTimeout(clearArmTimer.current);
      if (layerDeleteTimer.current !== null) window.clearTimeout(layerDeleteTimer.current);
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
    if (live.tool === "hl") {
      // 형광펜: 라이브 캔버스에 현재 stroke만 통째로(이음매 진해짐 방지).
      clearCanvas(liveCanvasRef.current);
      const ctx = scaledCtx(liveCanvasRef.current);
      if (ctx) drawStroke(ctx, live);
      return;
    }
    // 펜·지우개: 새 구간만 자기 레이어 committed 캔버스에 증분 렌더.
    if (drawnIdxRef.current !== 0 && drawnIdxRef.current >= live.points.length) return; // 새 점 없음
    const from = Math.max(0, drawnIdxRef.current - 1);
    const segment: Stroke = { ...live, points: live.points.slice(from) };
    const ctx = scaledCtx(canvasOf(live.layer));
    if (ctx) drawStroke(ctx, segment);
    drawnIdxRef.current = live.points.length;
  }, [canvasOf, clearCanvas, scaledCtx]);
  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushDraw);
  }, [flushDraw]);

  function onDrawDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tool === "select" || !activeLayer || toolBlocked || e.button !== 0) return;
    if (drawingRef.current !== null) return; // 이미 다른 포인터가 그리는 중(다중 터치 가드)
    const p = boardPoint(e);
    if (!p) return;
    activePtrRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = {
      tool: tool as Stroke["tool"],
      layer: activeLayer.id, // 활성 레이어에만(지우개 포함 — 그림판 문법)
      color: penColor,
      width: tool === "hl" ? penWidth * 3.5 : tool === "eraser" ? penWidth * 5 : penWidth,
      points: [p]
    };
    drawnIdxRef.current = 0; // 첫 점(탭 점)부터 증분 렌더 대상
    scheduleFlush();
  }
  function onDrawMove(e: React.PointerEvent<HTMLDivElement>) {
    const live = drawingRef.current;
    if (!live || e.pointerId !== activePtrRef.current) return;
    const p = boardPoint(e);
    if (!p) return;
    if (appendPoint(live.points, p)) scheduleFlush();
  }
  function endDraw(e?: React.PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current) return;
    if (e && e.pointerId !== activePtrRef.current) return; // 다른 포인터의 up/cancel 무시
    finishLiveStroke();
  }
  const doUndo = useCallback(() => {
    finishLiveStroke(); // 그리던 획 먼저 완성 — replay가 live를 날리는 불일치 방지(G3b-r)
    if (!store.undo()) return;
    hapticTick();
    setStrokeVersion((v) => v + 1);
    replayAll();
  }, [store, replayAll, finishLiveStroke]);
  const doRedo = useCallback(() => {
    finishLiveStroke();
    if (!store.redo()) return;
    hapticTick();
    setStrokeVersion((v) => v + 1);
    replayAll();
  }, [store, replayAll, finishLiveStroke]);
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
    hapticTick();
    setStrokeVersion((v) => v + 1);
    replayAll();
  }, [clearArmed, store, replayAll, finishLiveStroke]);

  // ── 레이어 추가/삭제(그림판 문법: 자유롭게) ──
  function addLayer() {
    hapticTick();
    layerSeq.current += 1;
    const id = `layer-${layerSeq.current}`;
    setLayers((ls) => [{ id, name: `레이어 ${layerSeq.current}`, vis: true, lock: false }, ...ls]);
    setActiveLayerId(id); // 새 레이어가 맨 위 + 바로 활성
  }
  function deleteLayer(id: string) {
    // 2단계: 획까지 지워지고 되돌릴 수 없어 오조작 방어(전체 지우기와 동일 문법).
    if (layerDeleteArm !== id) {
      hapticTick();
      setLayerDeleteArm(id);
      if (layerDeleteTimer.current !== null) window.clearTimeout(layerDeleteTimer.current);
      layerDeleteTimer.current = window.setTimeout(() => setLayerDeleteArm(null), 3000);
      return;
    }
    if (layerDeleteTimer.current !== null) window.clearTimeout(layerDeleteTimer.current);
    setLayerDeleteArm(null);
    finishLiveStroke(); // 그 레이어에 그리던 중이면 완성부터(직후 함께 삭제됨)
    store.removeLayer(id);
    setLayers((ls) => {
      const next = ls.filter((l) => l.id !== id);
      if (activeLayerId === id) setActiveLayerId(next[0]?.id ?? "");
      return next;
    });
    hapticTick();
    setStrokeVersion((v) => v + 1);
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
      if (cell?.inCurrentMonth) out.push(cell.isoDate); // 전월/익월 회색 날짜 제외(Q3)
    }
    return out;
  }, [cells, rangeSelect]);

  function handleSend() {
    const keys = selectedDateKeys();
    if (keys.length === 0) return;
    hapticTick();
    onSend(keys);
    rangeSelect.clearSelection();
    setPickerOpen(false); // 보냈으면 달력은 접어 그림판 공간 확보(헤더로 다시 펼침)
  }

  // Esc 우선순위(G0-rr·G3a): 이 핸들러 '하나'가 결정한다 — 선택 있으면 해제만, 없으면 닫기.
  // (훅의 Esc 처리는 escapeClears:false로 꺼서 리스너 순서 경쟁이 아예 없다.)
  // 전역 단축키 차단은 호출자(studio-shell)가 broadcastOpen 가드로 수행 — 여기선 Esc/Tab만.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (rangeSelect.getSelected().size > 0) {
          rangeSelect.clearSelection();
          return;
        }
        onClose();
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
  }, [onClose, rangeSelect, doUndo, doRedo]);

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
          <div className="bp-group-row">
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
        <div className="bp-tool-group" role="group" aria-label="색">
          <div className="bp-group-row">
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
                }}
              />
            ))}
          </div>
          <em className="bp-group-label">색</em>
        </div>
        <div className="bp-tool-group" role="group" aria-label="굵기">
          <div className="bp-group-row">
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
                <i style={{ width: w + 2, height: w + 2 }} />
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
              disabled={!store.canUndo()}
              title="실행 취소 (Ctrl+Z)"
              type="button"
              onClick={doUndo}
            >
              <Undo2 aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="다시 실행 (Ctrl+Shift+Z)"
              className="bp-tool"
              disabled={!store.canRedo()}
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
        {toolBlocked ? (
          <span className="bp-lock-hint">
            {layers.length === 0
              ? "레이어가 없어요 — 오른쪽 ➕로 추가해주세요"
              : "활성 레이어가 잠겨 있거나 숨겨져 있어요"}
          </span>
        ) : null}
      </div>

      <section className="bp-picker" aria-label={`${monthLabel} 날짜 선택`}>
        <div className="bp-picker-head">
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
                const picked = inMonth && rangeSelect.selected.has(i);
                const cls = [
                  "bp-mini-cell",
                  inMonth ? "" : "outside",
                  picked ? "picked" : "",
                  cell.weekday === 0 ? "sun" : cell.weekday === 6 ? "sat" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                // 회색(전월/익월) 날짜: data-cell-index를 아예 안 달아 선택 시작·드래그 anchor·
                // picked 대상에서 제외(Q3). 키보드: Enter/Space = Ctrl+클릭과 같은 개별 토글.
                return (
                  <div
                    aria-checked={picked}
                    aria-label={`${Number(cell.isoDate.slice(5, 7))}월 ${cell.dayOfMonth}일${evs.length > 0 ? ` (일정 ${evs.length}개)` : ""}`}
                    className={cls}
                    data-cell-index={inMonth ? i : undefined}
                    key={cell.isoDate}
                    role={inMonth ? "checkbox" : undefined}
                    aria-hidden={inMonth ? undefined : true}
                    tabIndex={inMonth ? 0 : undefined}
                    onKeyDown={
                      inMonth
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              hapticTick();
                              rangeSelect.toggleIndex(i);
                            }
                          }
                        : undefined
                    }
                  >
                    <span className="bp-mini-num">{cell.dayOfMonth}</span>
                    {/* 어떤 일정인지 보고 고르게 — 제목 미리보기(이전 화면 안 봐도 됨). */}
                    {inMonth
                      ? evs.slice(0, 2).map((ev) => (
                          <em className="bp-mini-title" key={ev.id}>
                            {ev.teaser ? "🔮 ???" : splitEventTitle(ev.publicTitle).main}
                          </em>
                        ))
                      : null}
                    {inMonth && evs.length > 2 ? (
                      <i className="bp-mini-more">+{evs.length - 2}</i>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <div className="bp-main">
      <section className="bp-board" aria-label="그림판">
        {/* 스크롤 좌표면(G3b): 배경 카드·캔버스·입력면이 전부 이 inner 안 — 보드를 스크롤하면
            카드와 판서가 같이 움직여 좌표가 절대 안 어긋난다. 컬럼 자유 배치 범위만큼 inner가
            커진다(minWidth/minHeight). */}
        <div
          className="bp-board-inner"
          ref={boardInnerRef}
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
                    className="bp-day-col"
                    key={day.dateKey}
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
                      title={tool === "select" ? "끌어서 이동" : "이동은 선택 도구에서"}
                      onLostPointerCapture={onColPointerUp}
                      onPointerDown={(e) => onColPointerDown(e, day.dateKey, "move")}
                      onPointerMove={onColPointerMove}
                      onPointerUp={onColPointerUp}
                    >
                      <strong>{Number(day.dateKey.slice(8, 10))}</strong>
                      {/* date-key는 이미 KST 달력 날짜 — 요일은 그 날짜 자체의 요일(UTC 자정으로
                          해석해 getUTCDay). +09:00으로 파싱하면 UTC 기준 전날로 밀려 요일이 틀린다. */}
                      <span>{WEEKDAYS[new Date(`${day.dateKey}T00:00:00Z`).getUTCDay()]}</span>
                      <button
                        aria-label={`${Number(day.dateKey.slice(8, 10))}일 그림판에서 빼기`}
                        className="bp-col-x"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          hapticTick();
                          onRemoveDay(day.dateKey);
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
                  aria-label={
                    layerDeleteArm === l.id ? `${l.name} 삭제 확정` : `${l.name} 삭제`
                  }
                  className={`bp-layer-btn danger${layerDeleteArm === l.id ? " armed" : ""}`}
                  title="레이어 삭제 — 이 레이어의 획도 함께 지워져요(두 번 눌러 실행)"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(l.id);
                  }}
                >
                  {layerDeleteArm === l.id ? <span className="bp-clear-confirm">삭제?</span> : <X size={14} />}
                </button>
              </div>
            </div>
          </div>
        ))}
        {/* 배경 = 고정 기본 레이어(날짜 카드 DOM) — 표시 토글만, 삭제/잠금 없음. */}
        <div className={`bp-layer-item bp-layer-fixed${bgVis ? "" : " off"}`}>
          <div className="bp-layer-thumb" aria-hidden="true">
            <span className="bp-layer-thumb-bg">📅</span>
          </div>
          <div className="bp-layer-meta">
            <em>배경</em>
            <div className="bp-layer-actions">
              <button
                aria-label="배경 표시"
                aria-pressed={bgVis}
                className="bp-layer-btn"
                title={bgVis ? "숨기기" : "보이기"}
                type="button"
                onClick={() => {
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
