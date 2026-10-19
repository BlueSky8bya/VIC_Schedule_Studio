import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import { logActivity } from "@/lib/activity/client";

/** One measured page. Resizing preserves the selected identity; it changes
 * only how many neighbours fit, with at most24 mounted collection tiles. */
type CollectionLayout = "default" | "memory" | "wardrobe" | "toy";
export function companionCollectionLayout(width: number, height: number, kind: CollectionLayout = "default") {
  const columns = Math.max(2, Math.min(kind === "memory" ? 5 : 6, Math.floor(((Number.isFinite(width) ? Math.max(0, width) : 0) + 8) / (kind === "memory" ? 120 : 102))));
  const rowHeight = kind === "default" ? 108 : 116;
  // Food/toy galleries reserve two rows even on the compact sheet. Their
  // compact CSS reduces artwork, not the44px hit target or readable names.
  const minimumRows = kind === "default" || kind === "toy" ? 2 : 1;
  const rows = kind === "wardrobe" ? 1 : Math.max(minimumRows, Math.min(4, Math.floor(((Number.isFinite(height) ? Math.max(0, height - 4) : 0) + 8) / (rowHeight + 8))));
  return { columns, rows, size: Math.min(24, columns * rows) };
}
export function companionCollectionPage(index: number, length: number, size: number) {
  const count = Math.max(1, Math.ceil(length / size)), page = Math.min(count - 1, Math.floor(Math.max(0, index) / size));
  return { page, count, offset: page * size, end: Math.min((page + 1) * size, length) };
}
export function useCompanionCollectionLayout(grid: RefObject<HTMLUListElement | null>, active: boolean, kind: CollectionLayout = "default") {
  const rows = kind === "default" || kind === "toy" ? 2 : 1;
  const [layout, setLayout] = useState({ columns: 4, rows, size: 4 * rows });
  useEffect(() => {
    if (!active || !grid.current) return;
    const element = grid.current;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!element.isConnected) return;
      const rect = element.getBoundingClientRect(), next = companionCollectionLayout(rect.width, rect.height, kind);
      if (!rect.width || !rect.height) return;
      setLayout(previous => previous.columns === next.columns && previous.rows === next.rows ? previous : next);
    };
    const changed = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(changed); observer.observe(element);
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [active, grid, kind]);
  return layout;
}

/** Registry order, wrapping once. Unknown and already-read entries are skipped;
 * a missing acknowledgment list is handled by the caller's existing store. */
export function nextCompanionCollectionUnread(index: number, length: number, unread: (index: number) => boolean): number | null {
  for (let step = 1; step <= length; step++) {
    const next = (Math.max(0, index) + step) % length;
    if (unread(next)) return next;
  }
  return null;
}

/** Pager arrows own page movement; tile arrows continue to own individual
 * cards, including a boundary that mounts the next finite page. */
export function onCollectionPageKey(event: KeyboardEvent<HTMLElement>, page: number, count: number, size: number, select: (index: number, focus: boolean) => void) {
  const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : event.key === "ArrowLeft" || event.key === "PageUp" ? Math.max(0, page - 1) : event.key === "ArrowRight" || event.key === "PageDown" ? Math.min(count - 1, page + 1) : -1;
  if (next < 0) return;
  event.preventDefault(); event.stopPropagation();
  if (next === page) return;
  select(next * size, true);
  logActivity("ui.click", { target: `companion-collection-page#${next < page ? "prev" : "next"}` });
}

export function onCollectionKey(event: KeyboardEvent<HTMLButtonElement>, index: number, length: number, select: (index: number) => boolean | void, offset = 0, categoryAt?: (index: number) => string) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const list = event.currentTarget.closest("ul");
  if (!list) return;
  const columns = Math.max(1, getComputedStyle(list).gridTemplateColumns.split(/\s+/).length);
  const next = event.key === "Home" ? 0 : event.key === "End" ? length - 1 : event.key === "ArrowLeft" ? Math.max(0, index - 1) : event.key === "ArrowRight" ? Math.min(length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - columns) : Math.min(length - 1, index + columns);
  event.preventDefault(); event.stopPropagation();
  // Home on an unread first tile is still an intentional inspection. Already
  // read/unknown clamped keys remain a no-op; a real acknowledgment logs once.
  const acknowledged = select(next) === true;
  if (next !== index || acknowledged) {
    const action = event.currentTarget.dataset.act, category = categoryAt?.(next) ?? event.currentTarget.dataset.actOpt;
    if (action === "companion-accessory-select") logActivity("ui.click", { target: action });
    else if (action === "companion-collection-inspect" && category && ["food", "toy", "behavior", "moment"].includes(category)) logActivity("ui.click", { target: `${action}#${category}` });
  }
  list.querySelectorAll<HTMLButtonElement>("button")[next - offset]?.focus();
}
