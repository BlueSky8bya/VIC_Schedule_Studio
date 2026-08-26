// 태그 순서 변경의 순수 모델 — "행 + edge(위/아래 절반)" 기반 목적지.
//
// 배경(태그 편집 순서 변경 감사, docs/tags/tag-editor-reorder-ux-audit.md P0):
// 기존 moveBefore는 '앞에 넣기'만 있어서 항목을 마지막으로 내릴 수 없었고
// ([A,B,C]에서 B를 C 위로 끌면 제자리), 같은 목적지에서도 매번 새 배열을 만들어
// pointermove마다 렌더가 돌았다. 여기서는
//   - before/after 두 edge로 모든 위치(맨 앞·맨 끝 포함)를 표현하고
//   - 결과가 같으면 **같은 배열 참조**를 돌려줘 React 상태 갱신이 자연히 무시되게 한다.

export type ReorderEdge = "before" | "after";

/**
 * ids에서 activeId를 빼내어 overId의 edge 쪽에 삽입한 새 배열을 돌려준다.
 * 결과 순서가 현재와 같으면(또는 입력이 무효하면) **ids를 그대로(같은 참조)** 돌려준다.
 *
 * leadingLocked: 목록 머리에 고정된 항목 수(휴뱅). 목적지가 그 앞이면 고정 구간
 * 바로 뒤로 밀어 넣는다(거부 대신 클램프 — "맨 위로"의 실질 의미를 보존).
 * 고정 항목 '자신'을 옮기는 것은 호출자가 드래그 시작 단계에서 막는다.
 */
export function reorderAtEdge(
  ids: string[],
  activeId: string,
  overId: string,
  edge: ReorderEdge,
  leadingLocked = 0
): string[] {
  if (activeId === overId) return ids;
  const from = ids.indexOf(activeId);
  if (from < 0 || !ids.includes(overId)) return ids;

  const without = ids.filter((id) => id !== activeId);
  const overIdx = without.indexOf(overId);
  let dest = edge === "after" ? overIdx + 1 : overIdx;
  if (dest < leadingLocked) dest = leadingLocked;

  // 빼낸 자리(from)에 도로 넣는 꼴이면 순서 불변 — 같은 참조로 no-op.
  if (dest === from) return ids;

  const next = without.slice();
  next.splice(dest, 0, activeId);
  return next;
}

/**
 * 포인터 y로 행의 위/아래 edge를 판정한다. 중앙선 주위 데드존(행 높이의 20%,
 * 최대 8px)에서는 직전 edge를 유지해(히스테리시스) 같은 자리 왕복 떨림을 막는다.
 */
export function edgeForPointer(
  pointerY: number,
  rowTop: number,
  rowHeight: number,
  prevEdge: ReorderEdge | null
): ReorderEdge {
  const mid = rowTop + rowHeight / 2;
  const dead = Math.min(8, rowHeight * 0.2);
  if (pointerY < mid - dead) return "before";
  if (pointerY > mid + dead) return "after";
  return prevEdge ?? (pointerY < mid ? "before" : "after");
}
