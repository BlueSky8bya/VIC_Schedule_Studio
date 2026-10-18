import type { KeyboardEvent } from "react";
import { logActivity } from "@/lib/activity/client";

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
