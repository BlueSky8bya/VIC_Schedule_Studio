"use client";

import type { ComponentType, KeyboardEvent } from "react";

// Real tabs fill every row: shared views first, then the developer-only views.
export function insightTabRows(count: number): number[] {
  return count <= 4 ? [count] : [Math.floor(count / 2), Math.ceil(count / 2)];
}

export function insightTabStep(index: number, key: string, count: number): number {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowLeft") return Math.max(0, index - 1);
  if (key === "ArrowRight") return Math.min(count - 1, index + 1);
  const rows = insightTabRows(count);
  if (rows.length === 1) return index;
  const row = index < rows[0] ? 0 : 1;
  const nextRow = key === "ArrowUp" ? row - 1 : key === "ArrowDown" ? row + 1 : row;
  if (nextRow === row || nextRow < 0 || nextRow >= rows.length) return index;
  const offset = row === 0 ? 0 : rows[0];
  const center = (index - offset + 0.5) / rows[row];
  return (nextRow === 0 ? 0 : rows[0]) + Math.min(rows[nextRow] - 1, Math.floor(center * rows[nextRow]));
}

export function InsightsTabs({ tabs, active, onChange }: {
  tabs: readonly { key: string; label: string; icon: ComponentType<{ "aria-hidden"?: boolean; size?: number }> }[];
  active: number;
  onChange: (index: number) => void;
}) {
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing ||
      !["Home", "End", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = insightTabStep(index, event.key, tabs.length);
    // Native click keeps pointer/keyboard on the same single activity path.
    buttons[next]?.focus();
    if (next !== active) buttons[next]?.click();
  };
  if (tabs.length <= 1) return null;
  let offset = 0;
  return <div aria-label="인사이트 영역" className="insights-tabs" onKeyDown={onKey} role="tablist">
    {insightTabRows(tabs.length).map((length, row) => {
      const start = offset;
      offset += length;
      return <div className="insights-tab-row" key={row} role="presentation">
        {tabs.slice(start, start + length).map((tab, col) => {
          const index = start + col;
          return <button aria-selected={index === active} className={`insights-tab${index === active ? " active" : ""}`}
            data-act="insights-tab" key={tab.key} onClick={() => onChange(index)} role="tab"
            tabIndex={index === active ? 0 : -1} type="button">
            <tab.icon aria-hidden={true} size={14} />{tab.label}
          </button>;
        })}
      </div>;
    })}
  </div>;
}
