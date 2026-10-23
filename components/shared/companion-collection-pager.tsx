"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { companionCollectionPageDots, companionCollectionUnreadDirections, companionCollectionUnreadPages, onCollectionArrowKey, onCollectionPageKey } from "./companion-collection-navigation";

/** 포인터 아래 가장 가까운 점(실측 중심 거리) — 격자·줄바꿈 어느 배치든 '보이는 점'과 고른 쪽이 같다.
 * 점 줄 위아래 14px를 벗어나면(쪽 번호 글자 등) 고르지 않는다. */
function nearestPageDot(container: HTMLElement, x: number, y: number): HTMLElement | null {
  const row = container.querySelector<HTMLElement>(".rhh-collection-page-dots");
  if (!row) return null;
  const box = row.getBoundingClientRect();
  if (y < box.top - 14 || y > box.bottom + 14) return null;
  let best: HTMLElement | null = null, bestDistance = Infinity;
  for (const dot of row.querySelectorAll<HTMLElement>("[data-page]")) {
    const rect = dot.getBoundingClientRect(), dx = x - (rect.left + rect.width / 2), dy = y - (rect.top + rect.height / 2);
    const distance = dx * dx + dy * dy * 4; // 줄바꿈된 다른 줄로 튀지 않게 세로 거리를 더 무겁게
    if (distance < bestDistance) { bestDistance = distance; best = dot; }
  }
  return best;
}
// 호버 표시는 DOM 속성으로만(React 상태 금지 — 움직일 때마다 도감 전체가 다시 그려진다, frame-jank 규칙).
function markHoveredDot(container: HTMLElement, dot: HTMLElement | null) {
  const previous = container.querySelector<HTMLElement>("[data-page][data-hover]");
  if (previous === dot) return;
  previous?.removeAttribute("data-hover");
  dot?.setAttribute("data-hover", "");
}

type InspectionCategory = "food" | "toy" | "behavior" | "moment";
type CollectionPagerProps = {
  label: string;
  previousLabel: string;
  nextLabel: string;
  page: { page: number; count: number };
  size: number;
  length: number;
  selected: number;
  unread: (index: number) => boolean;
  select: (index: number, focus?: boolean, inspect?: boolean) => unknown;
  inspectionAction?: "companion-collection-inspect" | "companion-accessory-select";
  categoryAt?: (index: number) => InspectionCategory;
};

/** One pager for every collection and surface. A direction mark always leads
 * to an actual unread item; Left/Right activate those same visible buttons.
 * Native clicks/committed range changes own activity capture. No item identity
 * or current page value enters activity metadata. */
export function CompanionCollectionPager({ label, previousLabel, nextLabel, page, size, length, selected, unread, select, inspectionAction = "companion-collection-inspect", categoryAt }: CollectionPagerProps) {
  const descriptionId = useId();
  const directions = companionCollectionUnreadDirections(selected, length, unread), dots = companionCollectionPageDots(page.count), unreadPages = companionCollectionUnreadPages(length, size, unread);
  return <nav aria-label={label} className="rhh-collection-pages" onKeyDown={event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") onCollectionArrowKey(event);
    else onCollectionPageKey(event, page.page, page.count, size, (index, focus) => select(index, (event.target as HTMLElement).tagName === "INPUT" ? false : focus, false));
  }}>
    <button aria-label={directions.previous !== null ? "이전 새 발견 보기" : previousLabel} title={directions.previous !== null ? "이전 새 발견 보기" : previousLabel} className="rhh-link rhh-collection-page-arrow" data-act={directions.previous !== null ? inspectionAction : "companion-collection-page"} data-act-opt={directions.previous !== null ? categoryAt?.(directions.previous) : "prev"} data-page-direction="prev" data-unread={directions.previous !== null || undefined} disabled={directions.previous === null && page.page === 0} onClick={event => select(directions.previous ?? (page.page - 1) * size, event.detail === 0, directions.previous !== null)} type="button">
      <ChevronLeft aria-hidden="true" size={17} /><span className="rhh-collection-page-label">이전</span>{directions.previous !== null && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}
    </button>
    {/* 쪽 점 고르기(2026-10-23 소유자: 원하는 점이 안 눌리고 엉뚱한 곳이 눌림) — 예전엔 투명 range가 상자 전체를 덮어
        '상자 폭 비율'로 페이지를 골랐다. 수첩·도감처럼 점이 가운데 모이거나 줄바꿈되면 누른 점과 다른 페이지가 됐다.
        이제 포인터는 상자(44px 표적 그대로)가 받고 실제 점 위치로 가장 가까운 점을 고른다. range는 키보드·화면낭독 전용. */}
    <div className="rhh-collection-page-position" data-act={page.count > 1 ? "companion-collection-page" : undefined}
      onClick={event => {
        if (page.count <= 1 || (event.target as HTMLElement).tagName === "INPUT") return;
        const dot = nearestPageDot(event.currentTarget, event.clientX, event.clientY), target = Number(dot?.dataset.page);
        if (dot && Number.isInteger(target) && target !== page.page) select(target * size, false, false);
      }}
      onPointerLeave={event => markHoveredDot(event.currentTarget, null)}
      onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "touch" || page.count <= 1) return;
        markHoveredDot(event.currentTarget, nearestPageDot(event.currentTarget, event.clientX, event.clientY));
      }}
      style={{ "--collection-dot-count": dots.length } as CSSProperties}>
      <span aria-hidden="true" className="rhh-collection-page-number"><b>{page.page + 1}</b><span>/ {page.count}</span></span>
      <div aria-hidden="true" className="rhh-collection-page-dots">{dots.map(dot => <span aria-current={dot === page.page ? "page" : undefined} data-page={dot} data-unread={unreadPages.has(dot) || undefined} key={dot} />)}</div>
      <input aria-label={`${label} 선택`} aria-valuetext={`${page.count}페이지 중 ${page.page + 1}페이지`} aria-describedby={unreadPages.size ? descriptionId : undefined} className="rhh-collection-page-rail" data-act="companion-collection-page" disabled={page.count <= 1} max={page.count} min={1} onChange={event => select((Number(event.currentTarget.value) - 1) * size, false, false)} step={1} type="range" value={page.page + 1} />
      <span aria-live="polite" className="sr-only">{page.count}페이지 중 {page.page + 1}페이지</span>
      {unreadPages.size > 0 && <span className="sr-only" id={descriptionId}>새 발견이 남은 페이지: {[...unreadPages].map(value => value + 1).join(", ")}</span>}
    </div>
    <button aria-label={directions.next !== null ? "다음 새 발견 보기" : nextLabel} title={directions.next !== null ? "다음 새 발견 보기" : nextLabel} className="rhh-link rhh-collection-page-arrow" data-act={directions.next !== null ? inspectionAction : "companion-collection-page"} data-act-opt={directions.next !== null ? categoryAt?.(directions.next) : "next"} data-page-direction="next" data-unread={directions.next !== null || undefined} disabled={directions.next === null && page.page + 1 >= page.count} onClick={event => select(directions.next ?? (page.page + 1) * size, event.detail === 0, directions.next !== null)} type="button">
      {directions.next !== null && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<span className="rhh-collection-page-label">다음</span><ChevronRight aria-hidden="true" size={17} />
    </button>
  </nav>;
}
