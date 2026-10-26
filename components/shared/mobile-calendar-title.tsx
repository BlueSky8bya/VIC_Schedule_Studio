"use client";

import { type ReactNode } from "react";
import { MonthTitleButton } from "./month-picker";
import "./mobile-calendar-title.css";

/** One 44px month/caption control on every narrow calendar surface. */
export function MobileCalendarTitle({ year, month, caption, open, onOpen, failed = false }: {
  year: number; month: number; caption?: ReactNode; open: boolean;
  onOpen: (anchor: DOMRect) => void; failed?: boolean;
}) {
  return <h1 className="mobile-calendar-title">
    <MonthTitleButton className="mobile-month-title" open={open} onOpen={onOpen}>
      <span className="mobile-month-label">{year}년 {month}월</span>
      {caption ? <span className="mobile-month-caption" data-failed={failed}>{caption}</span> : null}
    </MonthTitleButton>
  </h1>;
}
