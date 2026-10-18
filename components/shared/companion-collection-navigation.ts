import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import { logActivity } from "@/lib/activity/client";

/** One measured page. Resizing preserves the selected identity; it changes
 * only how many neighbours fit, with at most24 mounted collection tiles. */
export function companionCollectionLayout(width: number, height: number) {
  const columns = Math.max(2, Math.min(6, Math.floor(((Number.isFinite(width) ? Math.max(0, width) : 0) + 8) / 102)));
  const rows = Math.max(1, Math.min(4, Math.floor(((Number.isFinite(height) ? Math.max(0, height) : 0) + 8) / 104)));
  return { columns, rows, size: Math.min(24, columns * rows) };
}
export function companionCollectionPage(index: number, length: number, size: number) {
  const count = Math.max(1, Math.ceil(length / size)), page = Math.min(count - 1, Math.floor(Math.max(0, index) / size));
  return { page, count, offset: page * size, end: Math.min((page + 1) * size, length) };
}
export function useCompanionCollectionLayout(grid: RefObject<HTMLUListElement | null>, active: boolean) {
  const [layout, setLayout] = useState({ columns: 4, rows: 1, size: 4 });
  useEffect(() => {
    if (!active || !grid.current) return;
    const element = grid.current;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!element.isConnected) return;
      const rect = element.getBoundingClientRect(), next = companionCollectionLayout(rect.width, rect.height);
      if (!rect.width || !rect.height) return;
      setLayout(previous => previous.columns === next.columns && previous.rows === next.rows ? previous : next);
    };
    const changed = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(changed); observer.observe(element);
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [active, grid]);
  return layout;
}

export function onCollectionKey(event: KeyboardEvent<HTMLButtonElement>, index: number, length: number, select: (index: number) => void, offset = 0, categoryAt?: (index: number) => string) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const list = event.currentTarget.closest("ul");
  if (!list) return;
  const columns = Math.max(1, getComputedStyle(list).gridTemplateColumns.split(/\s+/).length);
  const next = event.key === "Home" ? 0 : event.key === "End" ? length - 1 : event.key === "ArrowLeft" ? Math.max(0, index - 1) : event.key === "ArrowRight" ? Math.min(length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - columns) : Math.min(length - 1, index + columns);
  event.preventDefault(); event.stopPropagation();
  if (next !== index) {
    select(next);
    const action = event.currentTarget.dataset.act, category = categoryAt?.(next) ?? event.currentTarget.dataset.actOpt;
    if (action === "companion-accessory-select") logActivity("ui.click", { target: action });
    else if (action === "companion-collection-inspect" && category && ["food", "behavior", "moment"].includes(category)) logActivity("ui.click", { target: `${action}#${category}` });
  }
  list.querySelectorAll<HTMLButtonElement>("button")[next - offset]?.focus();
}
