"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { companionCollectionPageDots, companionCollectionUnreadDirections, onCollectionPageKey } from "./companion-collection-navigation";

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
 * to an actual unread item; the rail and arrow keys remain ordinary paging.
 * Native clicks/committed range changes own activity capture. No item identity
 * or current page value enters activity metadata. */
export function CompanionCollectionPager({ label, previousLabel, nextLabel, page, size, length, selected, unread, select, inspectionAction = "companion-collection-inspect", categoryAt }: CollectionPagerProps) {
  const directions = companionCollectionUnreadDirections(selected, length, unread), dots = companionCollectionPageDots(page.page, page.count);
  const progress = page.count > 1 ? page.page / (page.count - 1) : 0;
  return <nav aria-label={label} className="rhh-collection-pages" onKeyDown={event => onCollectionPageKey(event, page.page, page.count, size, (index, focus) => select(index, (event.target as HTMLElement).tagName === "INPUT" ? false : focus, false))}>
    <button aria-label={directions.previous !== null ? "이전 새 발견 보기" : previousLabel} title={directions.previous !== null ? "이전 새 발견 보기" : previousLabel} className="rhh-link rhh-collection-page-arrow" data-act={directions.previous !== null ? inspectionAction : "companion-collection-page"} data-act-opt={directions.previous !== null ? categoryAt?.(directions.previous) : "prev"} data-page-direction="prev" data-unread={directions.previous !== null || undefined} disabled={directions.previous === null && page.page === 0} onClick={event => select(directions.previous ?? (page.page - 1) * size, event.detail === 0, directions.previous !== null)} type="button">
      <ChevronLeft aria-hidden="true" size={17} /><span className="rhh-collection-page-label">이전</span>{directions.previous !== null && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}
    </button>
    <div className="rhh-collection-page-position" style={{ "--collection-progress": `${progress * 100}%`, "--collection-dot-count": dots.length } as CSSProperties}>
      <div aria-hidden="true" className="rhh-collection-page-dots">{dots.map(dot => <span aria-current={dot === page.page ? "page" : undefined} data-page={dot} data-continuation={dot === dots[0] && dot > 0 || dot === dots[dots.length - 1] && dot + 1 < page.count || undefined} key={dot} />)}</div>
      <div aria-hidden="true" className="rhh-collection-page-bar" />
      <input aria-label={`${label} 선택`} aria-valuetext={`${page.count}페이지 중 ${page.page + 1}페이지`} className="rhh-collection-page-rail" data-act="companion-collection-page" disabled={page.count <= 1} max={page.count} min={1} onChange={event => select((Number(event.currentTarget.value) - 1) * size, false, false)} step={1} type="range" value={page.page + 1} />
      <span aria-live="polite" className="sr-only">{page.count}페이지 중 {page.page + 1}페이지</span>
    </div>
    <button aria-label={directions.next !== null ? "다음 새 발견 보기" : nextLabel} title={directions.next !== null ? "다음 새 발견 보기" : nextLabel} className="rhh-link rhh-collection-page-arrow" data-act={directions.next !== null ? inspectionAction : "companion-collection-page"} data-act-opt={directions.next !== null ? categoryAt?.(directions.next) : "next"} data-page-direction="next" data-unread={directions.next !== null || undefined} disabled={directions.next === null && page.page + 1 >= page.count} onClick={event => select(directions.next ?? (page.page + 1) * size, event.detail === 0, directions.next !== null)} type="button">
      {directions.next !== null && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<span className="rhh-collection-page-label">다음</span><ChevronRight aria-hidden="true" size={17} />
    </button>
  </nav>;
}
