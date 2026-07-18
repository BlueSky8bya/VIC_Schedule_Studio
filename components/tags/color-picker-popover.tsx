"use client";

import { Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyTone,
  hexToHsv,
  hslToHex,
  hsvToHex,
  inkContrast,
  TONE_PRESETS
} from "@/lib/tags/color-tone";
import { hapticTick } from "@/lib/ui/haptics";
import type { TagKind } from "@/lib/domain/schedule-types";

// 커스텀 색 피커 — 색 스와치를 누르면 뜨는 팝오버. 연구/벤치마킹(팝오버 패턴 + 색 영역+색조 슬라이더)
// 기준: 네이티브 OS 피커 대신 앱 디자인에 맞는 인라인 피커. 좌표로 채도·명도, 슬라이더로 색조,
// 자주 쓰는 프리셋·톤으로 빠르게, hex 직접 입력, 대비(AA) 즉시 확인.

// '기본 색상 18' — 고정 팔레트가 아니라 색조를 20°씩 훑는 18색(6×3). 딱 이만큼으로 제한된다는
// 뜻이 아니라(색은 위 영역/슬라이더로 무제한), '여기서 하나 고르고 위에서 미세조정'하는 출발점.
// 이 의미는 텍스트가 아니라 디자인으로 표현한다: 트레이(움푹한 판) + 위를 가리키는 홈 + 고른 칸에 링.
// kind별 톤을 render에 맞춘다: 콘텐츠=칸 배경이라 '연하게'(밝은 파스텔), 형식=점이라 '진하게'.
function spectrum(kind: TagKind): string[] {
  const light = kind !== "modifier";
  const s = light ? 72 : 60;
  const l = light ? 82 : 50;
  return Array.from({ length: 18 }, (_, i) => hslToHex((i * 20) % 360, s, l));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

const POP_W = 268;
const POP_H = 486; // kind 전환 줄 + 실행취소로 살짝 커졌다(화면 밖이면 위로 뒤집는 계산용).

export function ColorPickerPopover({
  value,
  anchor,
  kind,
  onChange,
  onClear,
  onClose,
  onToggleKind,
  canClear
}: {
  value: string; // 현재 색(hex)
  anchor: DOMRect; // 트리거(스와치) 화면 좌표 — 여기에 붙여 띄운다(포털이라 부모 overflow에 안 잘림).
  kind: TagKind; // 콘텐츠(연한 스펙트럼) / 형식(진한 스펙트럼)
  onChange: (hex: string) => void;
  onClear: () => void; // 기본(팔레트) 색으로
  onClose: () => void;
  onToggleKind?: () => void; // 콘텐츠↔형식 전환(행에서 라벨 뺀 대신 여기로 옮김)
  canClear: boolean;
}) {
  const presets = useMemo(() => spectrum(kind), [kind]);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);
  // 실행취소 스택 — 조작 '직전' hex를 쌓는다(드래그는 시작 때 1번만). 잘못 눌러 색이 바뀌어도 되돌린다.
  const [history, setHistory] = useState<string[]>([]);
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

  // 조작 직전 현재 hex를 스택에 쌓는다(최근 30개). 되돌릴 지점을 만든다.
  function snapshot() {
    setHistory((prev) => [...prev, hex].slice(-30));
  }
  // 실행취소 — 직전 색으로. 스택이 비면 아무 것도 안 한다.
  function undo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      hapticTick();
      const target = prev[prev.length - 1];
      setHsv(hexToHsv(target)); // 위 effect가 onChange로 부모까지 되돌린다.
      return prev.slice(0, -1);
    });
  }

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
  const curHexLower = hex.toLowerCase();
  // 현재 색이 기본 18색 중 어디에 '가장 가까운지'를 항상 계산한다(색조 기준, 20°씩). 그 칸을
  // 하이라이팅해 "지금 이 근처를 다듬는 중"을 시각으로 알린다 — 미세조정·hex입력 중에도 따라온다.
  // 아주 연하거나 진해도(채도 낮아도) 색조는 있으므로 항상 가장 가까운 칸을 잡는다.
  const nearestIdx = Math.round(hsv.h / 20) % 18;

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
      {/* 이 태그의 종류(콘텐츠=칸 색·통계 / 형식=얹는 점). 행에서 라벨을 뺀 대신 여기서 전환. */}
      {onToggleKind ? (
        <div className="cpop-kind">
          <span className="cpop-kind-cur">{kind === "modifier" ? "형식" : "콘텐츠"}</span>
          <button className="cpop-kind-swap" onClick={onToggleKind} type="button">
            {kind === "modifier" ? "콘텐츠로 바꾸기" : "형식으로 바꾸기"}
          </button>
        </div>
      ) : null}

      {/* ── 미세조정 존(위) — 채도·명도 영역 + 색조 슬라이더 + 미리보기/hex/실행취소 + 톤 ── */}
      {/* 채도(가로) × 명도(세로) 영역 — 좌표를 찍어 고른다. */}
      <div
        aria-label="채도·명도"
        className="cpop-sv"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          snapshot(); // 드래그 시작 = 되돌릴 지점 1개
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
          snapshot();
          pickHue(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pickHue(e);
        }}
        ref={hueRef}
      >
        <span className="cpop-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>

      {/* 미리보기(글자 읽힘을 눈으로 바로 확인) + hex 입력 + 실행취소. 대비 배지는 안 둔다 —
          자동 글자색이라 거의 항상 읽히므로 '통과' 표시는 잡음. 드물게 흐릴 때만 아래 한 줄 경고. */}
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
          onFocus={snapshot}
          spellCheck={false}
          value={hexText}
        />
        <button
          aria-label="실행취소(직전 색으로)"
          className="cpop-undo"
          disabled={history.length === 0}
          onClick={undo}
          title="직전 색으로 되돌리기"
          type="button"
        >
          <Undo2 aria-hidden="true" size={16} />
        </button>
      </div>
      {!con.passesAA ? <p className="cpop-warn">글자가 흐릴 수 있어요</p> : null}

      {/* 톤 프리셋 — 색조는 그대로 두고 톤(파스텔~깊게)만. '필터'처럼: 각 버튼을 '현재 색조에 그
          톤을 씌운 실제 결과색'으로 칠해(인스타 필터 썸네일) 누르기 전에 결과를 보여준다. */}
      <div className="cpop-tones">
        {TONE_PRESETS.map((t) => {
          const preview = applyTone(hex, t.key); // 이 버튼을 누르면 될 색
          const ink = inkContrast(preview).ink;
          return (
            <button
              className="tag-tone"
              key={t.key}
              onClick={() => {
                hapticTick();
                snapshot();
                setHsv(hexToHsv(preview));
              }}
              style={{ background: preview, color: ink, borderColor: "transparent" }}
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── 기본 색상 존(아래) — 트레이(움푹한 판) + 위 미세조정 존을 가리키는 홈(notch).
          텍스트 없이 "여기서 골라 위에서 다듬는다"를 시각으로: 판 안에 18색, '지금 색과 가장
          가까운 기본색'에 항상 링(미세조정 중에도 따라옴), 정확히 그 색이면 체크까지. ── */}
      <div className="cpop-tray" role="group" aria-label="기본 색상 18 — 골라서 위에서 미세조정">
        <div className="cpop-presets">
          {presets.map((c, i) => {
            const active = i === nearestIdx; // 현재 색과 가장 가까운 기본색 = 하이라이팅
            const exact = c.toLowerCase() === curHexLower; // 정확히 그 색이면 체크(미세조정 전)
            return (
              <button
                aria-label={c}
                aria-pressed={active}
                className={`cpop-swatch${active ? " active" : ""}`}
                key={c}
                onClick={() => {
                  hapticTick();
                  snapshot();
                  setHsv(hexToHsv(c));
                }}
                style={{ background: c }}
                type="button"
              >
                {active && exact ? <span className="cpop-swatch-check" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
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
