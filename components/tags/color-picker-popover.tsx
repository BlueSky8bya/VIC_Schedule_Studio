"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyTone,
  hexToHsv,
  hsvToHex,
  inkContrast,
  TONE_PRESETS
} from "@/lib/tags/color-tone";
import { hapticTick } from "@/lib/ui/haptics";

// 커스텀 색 피커 — 색 스와치를 누르면 뜨는 팝오버. 연구/벤치마킹(팝오버 패턴 + 색 영역+색조 슬라이더)
// 기준: 네이티브 OS 피커 대신 앱 디자인에 맞는 인라인 피커. 좌표로 채도·명도, 슬라이더로 색조,
// 자주 쓰는 프리셋·톤으로 빠르게, hex 직접 입력, 대비(AA) 즉시 확인.

// 앱 결에 맞춘 프리셋(따뜻한 파스텔 12색). 빠르게 고르는 용도 — 세밀 조정은 영역/슬라이더로.
const PRESETS = [
  "#ffd9a8", "#ffec99", "#d8f5a2", "#b2f2bb", "#96f2d7", "#99e9f2",
  "#a5d8ff", "#bac8ff", "#d0bfff", "#eebefa", "#fcc2d7", "#ffc9c9"
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

const POP_W = 244;
const POP_H = 356;

export function ColorPickerPopover({
  value,
  anchor,
  onChange,
  onClear,
  onClose,
  canClear
}: {
  value: string; // 현재 색(hex)
  anchor: DOMRect; // 트리거(스와치) 화면 좌표 — 여기에 붙여 띄운다(포털이라 부모 overflow에 안 잘림).
  onChange: (hex: string) => void;
  onClear: () => void; // 기본(팔레트) 색으로
  onClose: () => void;
  canClear: boolean;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const hex = useMemo(() => hsvToHex(hsv.h, hsv.s, hsv.v), [hsv]);

  // hex가 '사용자 조작으로' 바뀔 때만 부모에 반영한다. 첫 렌더(마운트)에서는 부르지 않는다 —
  // 안 그러면 피커를 '열기만' 해도 현재 색이 bgHex로 박혀(안 건드렸는데 커스텀 처리) 버린다.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onChange(hex);
    setHexText(hex);
    // onChange는 매 렌더 안정적이지 않을 수 있어 hex만 의존.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  // 바깥 클릭 / Esc 로 닫기(light-dismiss).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      // 팝오버 안이면 유지. 스와치(트리거)는 자기 onClick이 토글하므로 여기서 닫지 않는다
      // (여기서 닫으면 이어지는 click이 다시 열어버린다).
      if (rootRef.current?.contains(t) || t.closest?.(".tag-color-swatch")) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function pickSv(e: React.PointerEvent) {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp01((e.clientX - rect.left) / rect.width) * 100;
    const v = (1 - clamp01((e.clientY - rect.top) / rect.height)) * 100;
    setHsv((cur) => ({ ...cur, s: Math.round(s), v: Math.round(v) }));
  }
  function pickHue(e: React.PointerEvent) {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = clamp01((e.clientX - rect.left) / rect.width) * 360;
    setHsv((cur) => ({ ...cur, h: Math.round(h) }));
  }

  const con = inkContrast(hex);

  // 트리거 기준 위치(화면 좌표, fixed). 오른쪽 정렬 + 화면 밖으로 나가면 위로 뒤집는다.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(anchor.right - POP_W, vw - POP_W - 8));
  const below = anchor.bottom + 8;
  const top = below + POP_H > vh ? Math.max(8, anchor.top - POP_H - 8) : below;

  const body = (
    <div
      aria-label="색 고르기"
      className="tag-cpop"
      ref={rootRef}
      role="dialog"
      style={{ left, top }}
    >
      {/* 채도(가로) × 명도(세로) 영역 — 좌표를 찍어 고른다. */}
      <div
        aria-label="채도·명도"
        className="cpop-sv"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickSv(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pickSv(e);
        }}
        ref={svRef}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`
        }}
      >
        <span className="cpop-sv-thumb" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
      </div>

      {/* 색조 슬라이더 */}
      <div
        aria-label="색조"
        className="cpop-hue"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickHue(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pickHue(e);
        }}
        ref={hueRef}
      >
        <span className="cpop-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>

      {/* 미리보기(글자 읽힘을 눈으로 바로 확인) + hex 입력. 대비 배지는 안 둔다 — 자동 글자색이라
          거의 항상 읽히므로 '통과' 표시는 잡음일 뿐. 드물게 흐릴 때만 아래에 한 줄 경고. */}
      <div className="cpop-row">
        <span className="cpop-preview" style={{ background: hex, color: con.ink }}>
          가나
        </span>
        <input
          aria-label="hex 코드"
          className="cpop-hex"
          onChange={(e) => {
            const t = e.target.value;
            setHexText(t);
            if (/^#[0-9a-fA-F]{6}$/.test(t)) setHsv(hexToHsv(t));
          }}
          spellCheck={false}
          value={hexText}
        />
      </div>
      {!con.passesAA ? <p className="cpop-warn">글자가 흐릴 수 있어요</p> : null}

      {/* 톤 프리셋 — 색조 유지, 톤만. */}
      <div className="cpop-tones">
        {TONE_PRESETS.map((t) => (
          <button
            className="tag-tone"
            key={t.key}
            onClick={() => {
              hapticTick();
              setHsv(hexToHsv(applyTone(hex, t.key)));
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 자주 쓰는 색 프리셋 */}
      <div className="cpop-presets">
        {PRESETS.map((c) => (
          <button
            aria-label={c}
            className="cpop-swatch"
            key={c}
            onClick={() => {
              hapticTick();
              setHsv(hexToHsv(c));
            }}
            style={{ background: c }}
            type="button"
          />
        ))}
      </div>

      <div className="cpop-actions">
        {canClear ? (
          <button className="tag-custom-clear" onClick={onClear} type="button">
            기본 색으로
          </button>
        ) : (
          <span />
        )}
        <button className="button primary cpop-done" onClick={onClose} type="button">
          완료
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
