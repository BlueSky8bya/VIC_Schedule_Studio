"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { logActivity } from "@/lib/activity/client";

/** 늘 모든 상태가 보이는 세그먼트(라디오) — 셀렉트는 무엇을 고를 수 있는지 안 보인다(2026-09-04 소유자). */
export function SettingsSegment<T extends string | number>({
  value,
  options,
  onChange,
  onReselect,
  ariaLabel,
  dataAct,
  columns
}: {
  value: T;
  /** opt = 기록용 값 이름(숫자 값은 자릿수가 접혀 #로 뭉치므로 이름을 따로 준다). */
  options: { value: T; label: string; opt?: string }[];
  onChange: (v: T) => void;
  /** Some choices distinguish an explicit confirmation from an automatic value. */
  onReselect?: (v: T) => void;
  ariaLabel: string;
  dataAct: string;
  /** A bounded multi-row choice keeps the same control and moving thumb. */
  columns?: number;
}) {
  const columnCount = Math.max(1, Math.min(options.length, Number.isFinite(columns) ? Math.floor(columns!) : options.length));
  const rows = Math.max(1, Math.ceil(options.length / columnCount)), selected = Math.max(0, options.findIndex(option => option.value === value));
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!options.length) return;
    const stride = rows === 1 ? 1 : columnCount;
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : event.key === "ArrowRight" ? (index + 1) % options.length : event.key === "ArrowLeft" ? (index - 1 + options.length) % options.length
        : event.key === "ArrowDown" ? (index + stride) % options.length : event.key === "ArrowUp" ? (index - stride + options.length) % options.length : -1;
    if (next < 0) return;
    event.preventDefault(); event.stopPropagation();
    if (options[next].value !== value || onReselect) {
      if (options[next].value !== value) onChange(options[next].value);
      else onReselect?.(options[next].value);
      logActivity("ui.click", { target: `${dataAct}#${options[next].opt ?? String(options[next].value)}` });
    }
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[role='radio']")[next]?.focus();
  };
  return (
    <div
      aria-label={ariaLabel}
      className="rhh-seg"
      data-act={dataAct}
      data-multiline={rows > 1 || undefined}
      role="radiogroup"
      style={
        {
          "--n": columnCount,
          "--i": selected % columnCount,
          "--rows": rows,
          "--row": Math.floor(selected / columnCount)
        } as CSSProperties
      }
    >
      {/* 흰 손잡이 하나가 고른 칸으로 미끄러진다(iOS 세그먼트) — 칸마다 배경을 켜고 끄면 '깜빡'이 된다. */}
      <span aria-hidden="true" className="rhh-seg-thumb" />
      {options.map((o, index) => (
        <button
          aria-checked={o.value === value}
          className={o.value === value ? "on" : ""}
          // 칸마다 id — 없으면 고른 칸은 auto:.on, 나머지는 '클래스 없는 버튼'으로 뭉쳐 무엇을 골랐는지 안 남았다(2026-10-10).
          data-act={dataAct}
          data-act-opt={o.opt ?? String(o.value)}
          key={String(o.value)}
          onClick={() => {
            if (o.value !== value) onChange(o.value);
            else onReselect?.(o.value);
          }}
          onKeyDown={event => onKey(event, index)}
          role="radio"
          tabIndex={index === selected ? 0 : -1}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 줄 머리 — 색 타일 속 아이콘 + 이름. 타일 색은 묶음의 성격(물=화면·움직임, 잎=배경, 쇠=편집·개발). */
export function RowLabel({ icon, tone, children }: { icon: ReactNode; tone: "water" | "leaf" | "metal" | "rose"; children: ReactNode }) {
  return (
    <span className="rhh-label">
      <span aria-hidden="true" className="rhh-ico" data-tone={tone}>
        {icon}
      </span>
      {children}
    </span>
  );
}

export function Switch({ on, onToggle, label, dataAct, dataActOpt }: { on: boolean; onToggle: () => void; label: string; dataAct: string; dataActOpt?: string }) {
  return (
    <button
      aria-checked={on}
      aria-label={label}
      className={`rhh-switch ${on ? "on" : ""}`}
      data-act={dataAct}
      data-act-opt={dataActOpt}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span className="rhh-knob" aria-hidden="true" />
    </button>
  );
}
