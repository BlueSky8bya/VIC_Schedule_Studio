"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";

const monthLabel = (value: string) => value ? `${value.slice(0, 4)}년 ${Number(value.slice(5))}월` : "전체 연월";

/** Shared search control: keep the menu inside the search focus owner. */
export function SearchMonthPicker({ months, value, count, onChange }: {
  months: readonly string[];
  value: string;
  count: number | string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ above: false, height: 280 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const options = ["", ...months];

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const height = Math.min(280, options.length * 36 + 12);
      const upwards = below < height && above > below;
      setPlacement({ above: upwards, height: Math.max(36, Math.min(280, upwards ? above : below)) });
    };
    position();
    const selected = menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: "nearest" });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", position);
    };
  }, [open, options.length]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  return (
    <div className="ps-month-filter" ref={root}>
      <button type="button" ref={trigger} className="ps-month-trigger" aria-haspopup="menu"
        aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={`불러온 결과 연월: ${monthLabel(value)}, 결과 ${count}개`}
        data-act="search-month" data-activity-manual=""
        onClick={() => setOpen(previous => !previous)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); event.stopPropagation(); setOpen(true);
          }
        }}>
        <CalendarDays aria-hidden="true" size={14} />
        <span>{monthLabel(value)}</span>
        <span className="ps-count" aria-live="polite">{count}</span>
        <ChevronDown aria-hidden="true" size={13} />
      </button>
      {open ? <div id={id} className={`ps-month-menu${placement.above ? " is-above" : ""}`}
        ref={menu} role="menu" aria-label="불러온 결과 연월" style={{ maxHeight: placement.height }}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation(); close();
          } else if (event.key === "Tab") {
            // Move from the trigger in the sheet's existing Tab order.
            close();
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }
        }}>
        {options.map(option => <button type="button" key={option} role="menuitemradio"
          aria-checked={value === option} tabIndex={value === option ? 0 : -1}
          data-activity-manual="" onClick={() => { if (option !== value) onChange(option); close(); }}>
          <span>{monthLabel(option)}</span><Check aria-hidden="true" size={14} />
        </button>)}
      </div> : null}
    </div>
  );
}
