"use client";

import type { CSSProperties, ReactNode } from "react";

/** 늘 모든 상태가 보이는 세그먼트(라디오) — 셀렉트는 무엇을 고를 수 있는지 안 보인다(2026-09-04 소유자). */
export function SettingsSegment<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  dataAct
}: {
  value: T;
  /** opt = 기록용 값 이름(숫자 값은 자릿수가 접혀 #로 뭉치므로 이름을 따로 준다). */
  options: { value: T; label: string; opt?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  dataAct: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="rhh-seg"
      data-act={dataAct}
      role="radiogroup"
      style={
        {
          "--n": options.length,
          "--i": Math.max(0, options.findIndex((o) => o.value === value))
        } as CSSProperties
      }
    >
      {/* 흰 손잡이 하나가 고른 칸으로 미끄러진다(iOS 세그먼트) — 칸마다 배경을 켜고 끄면 '깜빡'이 된다. */}
      <span aria-hidden="true" className="rhh-seg-thumb" />
      {options.map((o) => (
        <button
          aria-checked={o.value === value}
          className={o.value === value ? "on" : ""}
          // 칸마다 id — 없으면 고른 칸은 auto:.on, 나머지는 '클래스 없는 버튼'으로 뭉쳐 무엇을 골랐는지 안 남았다(2026-10-10).
          data-act={dataAct}
          data-act-opt={o.opt ?? String(o.value)}
          key={String(o.value)}
          onClick={() => {
            if (o.value !== value) onChange(o.value);
          }}
          role="radio"
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
