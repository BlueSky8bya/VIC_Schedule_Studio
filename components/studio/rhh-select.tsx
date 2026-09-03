"use client";

// 설정 줄 드롭다운(2026-09-04 사용자: "기본 셀렉트 말고 주변이랑 어울리게") — 네이티브 <select>의 목록은 OS가 그려
// 스타일이 안 먹어, 트리거 버튼 + 금(金) 문법의 목록(role=listbox)으로 직접 그린다. 목록은 body 포털 + fixed 좌표
// (모달 카드의 overflow에 안 잘린다). 키보드: ↑↓ 이동·Enter/Space 선택·Esc 닫기. 바깥 누르면 닫힌다.
// disabled + lockedLabel: 잠긴 상태(계절 배경 OFF → "끄기")를 값과 무관하게 보여 준다.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type RhhOption<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  value: V;
  options: readonly RhhOption<V>[];
  onChange: (value: V) => void;
  ariaLabel: string;
  dataAct: string;
  disabled?: boolean;
  lockedLabel?: string;
};

export function RhhSelect<V extends string>({ value, options, onChange, ariaLabel, dataAct, disabled, lockedLabel }: Props<V>) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [pos, setPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0];
  const label = disabled && lockedLabel ? lockedLabel : current?.label ?? "";

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), width: Math.max(r.width, 150) });
    setFocusIdx(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelectorAll<HTMLButtonElement>(".rhh-opt")[focusIdx];
    el?.focus();
  }, [open, focusIdx]);

  const pick = (v: V) => {
    setOpen(false);
    if (v !== value) onChange(v);
    btnRef.current?.focus();
  };

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`rhh-select${open ? " open" : ""}`}
        data-act={dataAct}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        ref={btnRef}
        type="button"
      >
        <span className="rhh-select-label">{label}</span>
        <ChevronDown aria-hidden="true" className="rhh-select-chev" size={14} />
      </button>
      {open && pos
        ? createPortal(
            <div
              aria-label={ariaLabel}
              className="rhh-menu"
              ref={menuRef}
              role="listbox"
              style={{ top: pos.top, right: pos.right, minWidth: pos.width }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusIdx((i) => Math.min(options.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusIdx((i) => Math.max(0, i - 1));
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setFocusIdx(0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  setFocusIdx(options.length - 1);
                } else if (e.key === "Tab") {
                  setOpen(false);
                }
              }}
            >
              {options.map((o, i) => (
                <button
                  aria-selected={o.value === value}
                  className={`rhh-opt${o.value === value ? " selected" : ""}`}
                  key={o.value}
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setFocusIdx(i)}
                  role="option"
                  tabIndex={-1}
                  type="button"
                >
                  <span className="rhh-opt-check" aria-hidden="true">
                    {o.value === value ? "✓" : ""}
                  </span>
                  {o.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
