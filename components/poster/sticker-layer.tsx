"use client";

import { RotateCw, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StickerInstance } from "@/lib/domain/schedule-types";

type Mode = "move" | "resize" | "rotate";

// #7: 텍스트 스티커 글꼴 키 → CSS font-family 스택(레이아웃에서 구글 폰트 로드).
export const TEXT_FONT_STACK: Record<string, string> = {
  sans: '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  round: 'var(--font-gaegu), "Apple SD Gothic Neo", cursive',
  display: 'var(--font-blackhan), "Apple SD Gothic Neo", sans-serif',
  serif: 'var(--font-myeongjo), "Apple SD Gothic Neo", serif',
  jua: 'var(--font-jua), "Apple SD Gothic Neo", sans-serif',
  dohyeon: 'var(--font-dohyeon), "Apple SD Gothic Neo", sans-serif',
  pen: 'var(--font-nanumpen), "Apple SD Gothic Neo", cursive',
  gamja: 'var(--font-gamja), "Apple SD Gothic Neo", cursive',
  gugi: 'var(--font-gugi), "Apple SD Gothic Neo", cursive',
  melody: 'var(--font-himelody), "Apple SD Gothic Neo", cursive'
};

type GroupMember = {
  id: string;
  origX: number;
  origY: number;
  halfW: number;
  halfH: number;
};

type Drag = {
  id: string;
  mode: Mode;
  startX: number; // 포인터 시작 위치(레이어 기준 px)
  startY: number;
  origX: number; // 시작 시점의 스티커 중심 비율
  origY: number;
  halfW: number; // 이동 시: 스티커 박스 반치수(px, 실제 렌더 크기·회전 반영)
  halfH: number;
  lastX: number; // 이동 시: 마지막으로 겹치지 않았던 중심 비율
  lastY: number;
  startAngle: number; // 회전 시: 시작 시점 포인터 각도(rad)
  origRotation: number; // 회전 시: 시작 시점 회전각(deg)
  origWidthRatio: number; // 크기조절 시: 시작 시점 너비 비율
  startDist: number; // 크기조절 시: 시작 시점 중심~포인터 거리(px). 상대 배율 계산용
  // C3: 2개 이상 선택 후 그룹 이동 시 함께 옮길 멤버들과 마지막 유효 델타.
  group?: GroupMember[];
  lastDx: number;
  lastDy: number;
};

type Box = { left: number; top: number; right: number; bottom: number };

type StickerLayerProps = {
  stickers: StickerInstance[];
  editable: boolean;
  selectedIds?: string[];
  onSelect?: (id: string | null, additive?: boolean) => void;
  onChange?: (sticker: StickerInstance) => void; // 드래그 중 즉시 반영(미저장)
  onCommit?: (sticker: StickerInstance) => void; // 포인터 떼면 저장
  // C2: 드래그/리사이즈/회전 시작 직전 호출 → 부모가 실행취소 스냅샷을 찍는다.
  onGestureStart?: () => void;
  // 이 셀렉터에 해당하는 요소(예: "도우러 가기" 버튼)와는 스티커가 겹치지 않게 밀어낸다.
  avoidSelector?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// 금지 요소(avoidSelector, 예: "도우러 가기" 버튼)들의 사각형을 레이어 기준 px로 구한다.
function getAvoidRects(layer: HTMLElement, rect: DOMRect, selector?: string): Box[] {
  if (!selector) {
    return [];
  }
  return Array.from(layer.ownerDocument.querySelectorAll<HTMLElement>(selector)).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left - rect.left,
      top: r.top - rect.top,
      right: r.right - rect.left,
      bottom: r.bottom - rect.top
    };
  });
}

// 이동: 스티커(중심 nx,ny 비율, 실제 반치수 halfW/halfH)를 금지 박스 밖으로 막는다.
// 빠져나갈 변(레이어 안)으로 밀어보고, 어디로도 못 빠지면 마지막 유효 위치로 되돌린다(하드 스톱).
// → 어떤 경우에도 버튼과 겹치지 않는다.
function resolveMove(
  nx: number,
  ny: number,
  halfW: number,
  halfH: number,
  rect: DOMRect,
  rects: Box[],
  fallbackX: number,
  fallbackY: number
): { x: number; y: number } {
  if (rects.length === 0) {
    return { x: nx, y: ny };
  }
  const W = rect.width;
  const H = rect.height;
  // 중심 금지 영역 = 버튼을 스티커 반치수만큼 키운 박스
  const zones = rects.map((b) => ({
    L: b.left - halfW,
    T: b.top - halfH,
    R: b.right + halfW,
    B: b.bottom + halfH
  }));
  const hits = (cx: number, cy: number) =>
    zones.some((z) => cx > z.L && cx < z.R && cy > z.T && cy < z.B);

  let cx = nx * W;
  let cy = ny * H;
  if (!hits(cx, cy)) {
    return { x: nx, y: ny };
  }

  for (const z of zones) {
    if (!(cx > z.L && cx < z.R && cy > z.T && cy < z.B)) {
      continue;
    }
    const options: Array<{ x: number; y: number; dist: number }> = [];
    if (z.L >= 0) options.push({ x: z.L, y: cy, dist: cx - z.L });
    if (z.R <= W) options.push({ x: z.R, y: cy, dist: z.R - cx });
    if (z.T >= 0) options.push({ x: cx, y: z.T, dist: cy - z.T });
    if (z.B <= H) options.push({ x: cx, y: z.B, dist: z.B - cy });
    options.sort((a, b) => a.dist - b.dist);
    for (const o of options) {
      if (!hits(o.x, o.y)) {
        cx = o.x;
        cy = o.y;
        break;
      }
    }
  }

  if (!hits(cx, cy)) {
    return { x: clamp(cx / W, 0, 1), y: clamp(cy / H, 0, 1) };
  }
  // 어느 변으로도 못 빠지면 직전 유효 위치 유지 → 절대 겹치지 않음
  return { x: fallbackX, y: fallbackY };
}

// 중심(cx,cy)·반치수(halfW/halfH)인 박스가 금지 영역 중 하나라도 겹치는지.
function hitsAnyZone(cx: number, cy: number, halfW: number, halfH: number, rects: Box[]): boolean {
  return rects.some(
    (b) => cx > b.left - halfW && cx < b.right + halfW && cy > b.top - halfH && cy < b.bottom + halfH
  );
}

// 크기 조절: 주어진 중심에서 버튼과 겹치지 않는 최대 반치수(px).
function maxHalfBeforeOverlap(cx: number, cy: number, rects: Box[]): number {
  let maxHalf = Infinity;
  for (const b of rects) {
    // 중심이 버튼 밖으로 떨어진 가장 큰 간격(이 값 이하의 반치수면 안 겹친다).
    const gap = Math.max(b.left - cx, cx - b.right, b.top - cy, cy - b.bottom);
    maxHalf = Math.min(maxHalf, Math.max(0, gap));
  }
  return maxHalf;
}

export function StickerLayer({
  stickers,
  editable,
  selectedIds = [],
  onSelect,
  onChange,
  onCommit,
  onGestureStart,
  avoidSelector
}: StickerLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [layerWidth, setLayerWidth] = useState(0);
  // C1 스마트 정렬 가이드: 드래그 중 정렬선(px) 표시
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null
  });
  // #4: 회전 중 "수평" 가이드선(스티커 중심을 지나는 가로선). 수평에 스냅됐을 때만 표시.
  const [levelGuideY, setLevelGuideY] = useState<number | null>(null);

  // 최신 값을 ref로 들고 있어 전역 포인터 리스너를 한 번만 등록한다.
  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;
  const avoidSelectorRef = useRef(avoidSelector);
  avoidSelectorRef.current = avoidSelector;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setLayerWidth(entry.contentRect.width);
      }
    });
    observer.observe(layer);
    setLayerWidth(layer.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editable) {
      return;
    }
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      const layer = layerRef.current;
      if (!drag || !layer) {
        return;
      }
      const rect = layer.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const sticker = stickersRef.current.find((item) => item.id === drag.id);
      if (!sticker) {
        return;
      }

      // C3: 그룹 이동 — 선택된 여러 스티커를 같은 델타로 함께 옮긴다.
      // 한 멤버라도 화면 밖/금지영역에 닿으면 그룹 전체를 직전 유효 델타로 되돌린다(강체 유지).
      if (drag.mode === "move" && drag.group && drag.group.length > 1) {
        const members = drag.group;
        let dx = (px - drag.startX) / rect.width;
        let dy = (py - drag.startY) / rect.height;
        const minX = Math.min(...members.map((m) => m.origX));
        const maxX = Math.max(...members.map((m) => m.origX));
        const minY = Math.min(...members.map((m) => m.origY));
        const maxY = Math.max(...members.map((m) => m.origY));
        dx = clamp(dx, -minX, 1 - maxX);
        dy = clamp(dy, -minY, 1 - maxY);
        const rects = getAvoidRects(layer, rect, avoidSelectorRef.current);
        const collide =
          rects.length > 0 &&
          members.some((m) =>
            hitsAnyZone((m.origX + dx) * rect.width, (m.origY + dy) * rect.height, m.halfW, m.halfH, rects)
          );
        if (collide) {
          dx = drag.lastDx;
          dy = drag.lastDy;
        } else {
          drag.lastDx = dx;
          drag.lastDy = dy;
        }
        setGuides({ x: null, y: null });
        for (const m of members) {
          const target = stickersRef.current.find((s) => s.id === m.id);
          if (target) {
            onChangeRef.current?.({ ...target, xRatio: m.origX + dx, yRatio: m.origY + dy });
          }
        }
        return;
      }

      if (drag.mode === "move") {
        let cx = clamp(drag.origX + (px - drag.startX) / rect.width, 0, 1) * rect.width;
        let cy = clamp(drag.origY + (py - drag.startY) / rect.height, 0, 1) * rect.height;
        // C1 스냅: 캔버스 중앙·다른 스티커 중심선과 가까우면 달라붙고 가이드 표시.
        const SNAP = 6;
        const others = stickersRef.current.filter((s) => s.id !== drag.id);
        const xLines = [rect.width / 2, ...others.map((s) => s.xRatio * rect.width)];
        const yLines = [rect.height / 2, ...others.map((s) => s.yRatio * rect.height)];
        let gx: number | null = null;
        let gy: number | null = null;
        for (const lx of xLines) {
          if (Math.abs(cx - lx) <= SNAP) {
            cx = lx;
            gx = lx;
            break;
          }
        }
        for (const ly of yLines) {
          if (Math.abs(cy - ly) <= SNAP) {
            cy = ly;
            gy = ly;
            break;
          }
        }
        // "도우러 가기" 등 금지 요소와 부딪히면 벽처럼 막는다(못 빠지면 직전 위치 유지).
        const rects = getAvoidRects(layer, rect, avoidSelectorRef.current);
        const r = resolveMove(
          cx / rect.width,
          cy / rect.height,
          drag.halfW,
          drag.halfH,
          rect,
          rects,
          drag.lastX,
          drag.lastY
        );
        // 충돌로 위치가 밀렸으면 그 축 가이드는 끈다.
        if (Math.abs(r.x * rect.width - cx) > 0.5) gx = null;
        if (Math.abs(r.y * rect.height - cy) > 0.5) gy = null;
        drag.lastX = r.x;
        drag.lastY = r.y;
        setGuides({ x: gx, y: gy });
        onChangeRef.current?.({ ...sticker, xRatio: r.x, yRatio: r.y });
        return;
      }

      // resize/rotate는 중심에서 포인터까지의 거리/각도로 계산(회전 무관).
      const cx = sticker.xRatio * rect.width;
      const cy = sticker.yRatio * rect.height;
      if (drag.mode === "resize") {
        const dist = Math.hypot(px - cx, py - cy);
        // 상대 배율: 잡은 순간 대비 거리 비율로 크기를 키운다(잡자마자 튀는 현상 방지).
        const scaled =
          drag.startDist > 0
            ? drag.origWidthRatio * (dist / drag.startDist)
            : (dist * Math.SQRT2) / rect.width;
        let widthRatio = clamp(scaled, 0.008, 0.6);
        // 금지 요소(버튼)와 겹치지 않게 최대 크기를 제한한다.
        const rects = getAvoidRects(layer, rect, avoidSelectorRef.current);
        if (rects.length > 0) {
          const maxWidthRatio = (2 * maxHalfBeforeOverlap(cx, cy, rects)) / rect.width;
          widthRatio = Math.min(widthRatio, Math.max(0.008, maxWidthRatio));
        }
        onChangeRef.current?.({ ...sticker, widthRatio });
      } else {
        // 상대 회전: 시작 각도 대비 변화량을 현재 회전각에 더한다(시작 시 튀거나 깜빡임 방지).
        // 좌우/상하 중 하나만 대칭(=거울상)이면 포인터 방향이 반대로 보이므로 부호를 뒤집는다.
        const angle = Math.atan2(py - cy, px - cx);
        let delta = ((angle - drag.startAngle) * 180) / Math.PI;
        if (sticker.flipX !== sticker.flipY) {
          delta = -delta;
        }
        let rotationDeg = Math.round(drag.origRotation + delta);
        // #4: 수평(180° 배수)에 가까우면 딱 맞춰 스냅하고, 중심을 지나는 수평 가이드선을 보여준다.
        const SNAP_DEG = 5;
        const mod = ((rotationDeg % 180) + 180) % 180; // [0,180)
        const distToLevel = Math.min(mod, 180 - mod);
        if (distToLevel <= SNAP_DEG) {
          rotationDeg = Math.round(rotationDeg / 180) * 180;
          setLevelGuideY(cy);
        } else {
          setLevelGuideY(null);
        }
        onChangeRef.current?.({ ...sticker, rotationDeg });
      }
    }

    function onUp() {
      const drag = dragRef.current;
      if (drag) {
        // 그룹 이동이면 멤버 전부 저장, 아니면 대상 하나만 저장.
        const ids =
          drag.group && drag.group.length > 1 ? drag.group.map((m) => m.id) : [drag.id];
        for (const id of ids) {
          const sticker = stickersRef.current.find((item) => item.id === id);
          if (sticker) {
            onCommitRef.current?.(sticker);
          }
        }
      }
      dragRef.current = null;
      setGuides({ x: null, y: null });
      setLevelGuideY(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [editable]);

  function startDrag(event: React.PointerEvent, sticker: StickerInstance, mode: Mode) {
    if (!editable) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const layer = layerRef.current;
    if (!layer) {
      return;
    }
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const selection = selectedIdsRef.current;
    const alreadyInGroup = selection.includes(sticker.id) && selection.length > 1;

    // 선택 갱신: Shift/Ctrl=토글, 일반 클릭=단일 선택(이미 그룹의 일원이면 그룹 유지하고 이동).
    if (mode === "move") {
      if (additive) {
        onSelect?.(sticker.id, true);
      } else if (!alreadyInGroup) {
        onSelect?.(sticker.id, false);
      }
    }

    onGestureStartRef.current?.(); // C2: 변형 시작 전 스냅샷
    const rect = layer.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    // 이동: 실제 렌더 박스 크기(회전·플립 반영)를 재서 충돌 판정에 쓴다.
    const box = mode === "move" ? (event.currentTarget as HTMLElement).getBoundingClientRect() : null;
    const cx = sticker.xRatio * rect.width;
    const cy = sticker.yRatio * rect.height;

    // C3: 그룹 이동 멤버 — 일반 클릭이고 이미 그룹의 일원일 때만(추가선택 토글 중엔 이동 안 함).
    let group: GroupMember[] | undefined;
    if (mode === "move" && !additive && alreadyInGroup) {
      group = selection
        .map((id) => {
          const s = stickersRef.current.find((item) => item.id === id);
          if (!s) {
            return null;
          }
          const el = layer.querySelector<HTMLElement>(`[data-sticker-id="${id}"]`);
          const b = el?.getBoundingClientRect();
          return {
            id,
            origX: s.xRatio,
            origY: s.yRatio,
            halfW: b ? b.width / 2 : 0,
            halfH: b ? b.height / 2 : 0
          } satisfies GroupMember;
        })
        .filter((m): m is GroupMember => m !== null);
    }

    dragRef.current = {
      id: sticker.id,
      mode,
      startX,
      startY,
      origX: sticker.xRatio,
      origY: sticker.yRatio,
      halfW: box ? box.width / 2 : 0,
      halfH: box ? box.height / 2 : 0,
      lastX: sticker.xRatio,
      lastY: sticker.yRatio,
      startAngle: Math.atan2(startY - cy, startX - cx),
      origRotation: sticker.rotationDeg,
      origWidthRatio: sticker.widthRatio,
      startDist: Math.hypot(startX - cx, startY - cy),
      group,
      lastDx: 0,
      lastDy: 0
    };
  }

  return (
    <div
      className={`sticker-layer ${editable ? "editable" : ""}`}
      ref={layerRef}
      onPointerDown={editable ? () => onSelect?.(null) : undefined}
    >
      {guides.x != null ? (
        <span className="sticker-guide vertical" style={{ left: guides.x }} aria-hidden="true" />
      ) : null}
      {guides.y != null ? (
        <span className="sticker-guide horizontal" style={{ top: guides.y }} aria-hidden="true" />
      ) : null}
      {levelGuideY != null ? (
        <span className="sticker-guide level" style={{ top: levelGuideY }} aria-hidden="true">
          <em>수평</em>
        </span>
      ) : null}
      {stickers.map((sticker) => {
        const size = sticker.widthRatio * layerWidth;
        const isSelected = editable && selectedIds.includes(sticker.id);
        // 크기·회전 핸들은 정확히 하나만 선택했을 때만(그룹 선택 중엔 이동만).
        const showHandles = editable && selectedIds.length === 1 && selectedIds[0] === sticker.id;
        const fxClass = `${sticker.outline ? "fx-outline" : ""} ${sticker.shadow ? "fx-shadow" : ""}`;
        return (
          <div
            className={`sticker-item ${isSelected ? "selected" : ""} ${fxClass}`}
            data-sticker-id={sticker.id}
            key={sticker.id}
            onPointerDown={(event) => startDrag(event, sticker, "move")}
            style={{
              left: `${sticker.xRatio * 100}%`,
              top: `${sticker.yRatio * 100}%`,
              fontSize: size,
              opacity: sticker.opacity,
              zIndex: sticker.zIndex,
              transform:
                `translate(-50%, -50%) rotate(${sticker.rotationDeg}deg) ` +
                `scale(${sticker.flipX ? -1 : 1}, ${sticker.flipY ? -1 : 1})`
            }}
          >
            {sticker.kind === "image" && sticker.imageUrl ? (
              // 스티커는 임의 크기·변형 + html2canvas 캡쳐 대상이라 next/image 부적합
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={sticker.label}
                className="sticker-image"
                draggable={false}
                src={sticker.imageUrl}
                style={{ width: size }}
              />
            ) : sticker.kind === "text" ? (
              <span
                className="sticker-text"
                style={{
                  fontSize: size * 0.5,
                  color: sticker.textColor ?? "#1f2937",
                  fontWeight: sticker.fontWeight ?? 700,
                  fontFamily: TEXT_FONT_STACK[sticker.fontFamily ?? "sans"],
                  textAlign: sticker.textAlign ?? "left",
                  fontStyle: sticker.italic ? "italic" : undefined,
                  // 글자 배경(하이라이트): 색이 있으면 둥근 라벨처럼.
                  background: sticker.textBg || undefined,
                  padding: sticker.textBg ? "0.08em 0.32em" : undefined,
                  borderRadius: sticker.textBg ? "0.22em" : undefined,
                  // 시스템 한글 폰트는 700/900이 같게 보이므로, "두껍게(>=900)"는 외곽선으로 실제 두껍게.
                  WebkitTextStroke:
                    (sticker.fontWeight ?? 700) >= 900
                      ? `${(size * 0.5 * 0.045).toFixed(2)}px ${sticker.textColor ?? "#1f2937"}`
                      : undefined
                }}
              >
                {sticker.label}
              </span>
            ) : (
              <span className="sticker-emoji">{sticker.label}</span>
            )}
            {showHandles ? (
              <>
                <button
                  aria-label="회전"
                  className="sticker-handle rotate"
                  onPointerDown={(event) => startDrag(event, sticker, "rotate")}
                  type="button"
                >
                  <RotateCw aria-hidden="true" size={12} />
                </button>
                <button
                  aria-label="크기 조절"
                  className="sticker-handle resize"
                  onPointerDown={(event) => startDrag(event, sticker, "resize")}
                  type="button"
                >
                  <Maximize2 aria-hidden="true" size={12} />
                </button>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
