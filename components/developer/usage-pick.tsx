"use client";

import { useEffect, useRef, useState } from "react";
import { hapticTick } from "@/lib/ui/haptics";

// 작은 고르기 메뉴 — 네이티브 <select>는 펼친 목록을 꾸밀 수 없어 이 화면의 재질(둥근 알약·
// 연보라 강조·부드러운 그림자)과 따로 놀았다. 같은 문법으로 직접 그린다.
//
// 열림 상태는 이 컴포넌트 안에만 있고, 바깥을 누르거나 Esc면 닫는다(오버레이 스택을 쓰지
// 않는다 — 이 메뉴는 히스토리에 층을 쌓을 만큼 무겁지 않고, 되감기가 진행 중인 갱신을
// 취소하는 함정도 피한다).

export type PickOption = { value: string; label: string };

export function UsagePick({
  label,
  value,
  options,
  onChange,
  act
}: {
  label: string;
  value: string;
  options: PickOption[];
  onChange: (v: string) => void;
  act: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="upick" ref={boxRef}>
      <span className="upick-label">{label}</span>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`upick-btn${open ? " is-open" : ""}`}
        data-act={act}
        onClick={() => {
          hapticTick();
          setOpen((v) => !v);
        }}
        type="button"
      >
        {current?.label ?? "전체"}
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="upick-menu" role="listbox">
          {options.map((o) => (
            <button
              aria-selected={o.value === value}
              className={o.value === value ? "is-on" : ""}
              key={o.value}
              onClick={() => {
                hapticTick();
                onChange(o.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
