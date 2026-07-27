import type { BroadcastTool } from "@/lib/broadcast/stroke-engine";

export type BroadcastDrawingLayer = {
  id: string;
  vis: boolean;
  lock: boolean;
};

/** 색을 고른 의도: 선택·지우개에서는 펜, 이미 색을 쓰는 도구에서는 현재 문맥 유지. */
export function toolAfterInkColorPick(tool: BroadcastTool): BroadcastTool {
  return tool === "select" || tool === "eraser" ? "pen" : tool;
}

/** 굵기를 고른 의도: 선택에서는 펜, 굵기를 쓰는 펜·형광펜·지우개·도형은 그대로. */
export function toolAfterInkWidthPick(tool: BroadcastTool): BroadcastTool {
  return tool === "select" ? "pen" : tool;
}

/** 새 빈 레이어는 선택·지우개로 할 일이 없으므로 바로 펜 입력 가능한 상태로 연다. */
export function toolAfterEmptyLayerAdded(tool: BroadcastTool): BroadcastTool {
  return toolAfterInkColorPick(tool);
}

/** 현재 → 마지막 사용 → 화면상 첫 레이어 순으로 실제 판서 가능한 레이어를 찾는다. */
export function resolveWritableDrawingLayerId(
  layers: readonly BroadcastDrawingLayer[],
  currentId: string,
  rememberedId: string | null
): string | null {
  const writable = (id: string | null) =>
    id === null ? null : layers.find((layer) => layer.id === id && layer.vis && !layer.lock) ?? null;

  return (
    writable(currentId)?.id ??
    writable(rememberedId)?.id ??
    layers.find((layer) => layer.vis && !layer.lock)?.id ??
    null
  );
}

/** 활성 그림 레이어가 사라졌을 때: 사용 가능 레이어 우선, 없으면 상태 확인용 첫 레이어. */
export function resolveDrawingLayerAfterRemoval(
  layers: readonly BroadcastDrawingLayer[],
  rememberedId: string | null
): string | null {
  return (
    resolveWritableDrawingLayerId(layers, "", rememberedId) ??
    layers[0]?.id ??
    null
  );
}

/** 목록 위 = 합성 위. 경계/미존재 이동은 히스토리를 만들지 않도록 null을 반환한다. */
export function reorderDrawingLayer<T extends { id: string }>(
  layers: readonly T[],
  id: string,
  direction: "up" | "down"
): T[] | null {
  const from = layers.findIndex((layer) => layer.id === id);
  const to = from + (direction === "up" ? -1 : 1);
  if (from < 0 || to < 0 || to >= layers.length) return null;
  const next = [...layers];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * Drag/drop용 순서 변경. dragged를 뺀 목록에서 beforeId 앞에 넣고,
 * beforeId가 null이면 그림 레이어 stack 맨 아래에 둔다.
 */
export function reorderDrawingLayerBefore<T extends { id: string }>(
  layers: readonly T[],
  draggedId: string,
  beforeId: string | null
): T[] | null {
  const dragged = layers.find((layer) => layer.id === draggedId);
  if (!dragged || beforeId === draggedId) return null;
  const remaining = layers.filter((layer) => layer.id !== draggedId);
  const insertAt = beforeId === null ? remaining.length : remaining.findIndex((layer) => layer.id === beforeId);
  if (insertAt < 0) return null;
  const next = [...remaining];
  next.splice(insertAt, 0, dragged);
  return next.every((layer, index) => layer === layers[index]) ? null : next;
}

export type LayerDropBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/**
 * 드래그 좌표를 삽입 대상 id로 바꾼다.
 * undefined는 목록 밖(취소), null은 목록 끝, string은 해당 레이어 앞을 뜻한다.
 */
export function resolveLayerDropBeforeId(
  clientX: number,
  clientY: number,
  bounds: LayerDropBounds,
  scrollTop: number,
  slots: readonly { id: string; midpoint: number }[],
  xMargin = 32,
  yMargin = 52
): string | null | undefined {
  if (
    clientX < bounds.left - xMargin ||
    clientX > bounds.right + xMargin ||
    clientY < bounds.top - yMargin ||
    clientY > bounds.bottom + yMargin
  ) {
    return undefined;
  }
  const logicalY = clientY - bounds.top + scrollTop;
  return slots.find((slot) => logicalY < slot.midpoint)?.id ?? null;
}

/** 패널 세션의 첫 성공 직접 보내기만 일정 배치 문맥으로 전환한다. */
export function shouldEnterScheduleArrangeMode(
  hasSentOnce: boolean,
  newSentCount: number
): boolean {
  return !hasSentOnce && newSentCount > 0;
}
