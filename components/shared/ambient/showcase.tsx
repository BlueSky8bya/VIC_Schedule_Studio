"use client";

// 배경 감상 모드(2026-09-04 사용자: "누가 봐도 한 번은 눌러보고 싶게, 설정 밖에") — 편집실·시청자 공용.
// 켜면 `<html data-showcase>`가 붙고 CSS가 배경 레이어(.gs-season)만 남기고 크롬을 전부 투명·클릭 통과로
// 만든다(studio-shell.css / public-poster.css). 화면 전체가 '바탕'이 되어 잎 집기·발자국·잔물결이 어디서든 된다.
// 상태는 모듈 전역(속성 하나) — 어느 화면의 버튼이든 같은 스위치. 나가기 = Esc 또는 상단 알약(body 포털이라 숨김
// 규칙에 안 걸린다). 버튼은 계절 아이콘으로 "지금 계절을 보러 가자"를 말한다.
//
// 바이옴 세계(PLAN-20260904-004 §5, 소유자 ③④): 감상 중엔 **방향키·WASD·스와이프·가장자리 쉐브론·미니맵**으로 열한 화면을 오간다
// (초원 ↔ 연못·숲·언덕·계곡·산·해안 셋·먼바다·깊은 바다). 카메라는 엔진 안의 세계 장면이 620ms로 미끄러지고, 여기(ShowcaseNav)는 입력을
// `window.__vicAmbient.goTo()`로 넣고 `vic:biome` 이벤트로 도착 알약·미니맵을 갱신한다. 시청자 화면도 같은 컴포넌트(ShowcaseExit 안).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flower2, Haze, Leaf, Power, Snowflake, Sparkles, Waves } from "lucide-react";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { type AmbientMode, ambientMode, setAmbientMode } from "@/lib/ui/motion";
import { BIOME_ROWS, BIOMES, type BiomeKey, type Dir } from "@/components/shared/ambient/world/biomes";
import { hapticTick } from "@/lib/ui/haptics";

let active = false;
const listeners = new Set<() => void>();

function set(on: boolean): void {
  if (typeof document === "undefined" || active === on) return;
  active = on;
  if (on) document.documentElement.setAttribute("data-showcase", "1");
  else document.documentElement.removeAttribute("data-showcase");
  for (const l of listeners) l();
}
export const enterShowcase = () => set(true);
export const exitShowcase = () => set(false);
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const get = () => active;
const getServer = () => false;

export function useShowcase(): boolean {
  return useSyncExternalStore(subscribe, get, getServer);
}

const ICON: Record<SeasonKey, typeof Leaf> = { spring: Flower2, summer: Waves, autumn: Leaf, winter: Snowflake };
const WORD: Record<SeasonKey, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };

/** 진입 버튼 — 계절 아이콘 + "가을 감상하기". className으로 자리별 모양(편집실 아바타 자리 · 시청자 레일). */
export function ShowcaseButton({ season, className = "", compact = false }: { season: SeasonKey; className?: string; compact?: boolean }) {
  const Icon = ICON[season];
  return (
    <button
      aria-label={`${WORD[season]} 배경 감상 모드`}
      className={`showcase-btn showcase-btn-${season} ${className}`.trim()}
      data-act="ambient-showcase"
      onClick={() => enterShowcase()}
      title="방향키로 이동 · Esc로 나가기"
      type="button"
    >
      <span className="showcase-btn-glow" aria-hidden="true" />
      <Icon aria-hidden="true" size={compact ? 16 : 18} />
      <span className="showcase-btn-label">{compact ? "감상" : `${WORD[season]} 감상하기`}</span>
    </button>
  );
}

/** 배경 세 상태 세그먼트 [켜기 | 흐리게 | 끄기] — 2026-09-04 사용자: "흐리게에서 바로 켜기, 켜기에서 바로 끄기가 되게, 버튼 셋으로
 *  말끔히". 순환 버튼(다음 동작이 라벨) 대신 **상태 셋이 늘 다 보이고 지금 상태가 채워진** 라디오 묶음. 시청자 레일·편집실
 *  아바타 자리(유리 알약)와 편집실 설정 줄(금 문법, .metal)이 같은 컴포넌트를 쓴다 — 상태의 진실은 <html data-ambient>. */
// `tip` = 호버 상자. 라벨(켜기/흐리게/끄기)과 채워진 칸이 이미 "무엇이고 지금 어디인지"를 말하므로
// 되풀이하지 않고 **결과**만 적는다(2026-09-05 소유자: "이미 다 보이는 내용 또 띄우지 마").
const MODES: { value: AmbientMode; label: string; tip: string; Icon: typeof Leaf }[] = [
  { value: "on", label: "켜기", tip: "배경 그대로", Icon: Sparkles },
  { value: "dim", label: "흐리게", tip: "옅게 — 일정이 잘 보이게", Icon: Haze },
  { value: "off", label: "끄기", tip: "배경 없음", Icon: Power }
];
export function AmbientModeSegment({
  mode,
  onChange,
  dataAct,
  className = "",
  ariaLabel = "계절 배경 상태"
}: {
  mode: AmbientMode;
  onChange: (mode: AmbientMode) => void;
  dataAct: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className={`ambient-seg ${className}`.trim()} role="radiogroup">
      {MODES.map(({ value, label, tip, Icon }) => {
        const on = value === mode;
        return (
          <button
            aria-checked={on}
            className={`ambient-seg-btn mode-${value}${on ? " on" : ""}`}
            data-act={dataAct}
            data-mode={value}
            key={value}
            onClick={() => {
              if (!on) onChange(value);
            }}
            role="radio"
            title={tip}
            type="button"
          >
            <Icon aria-hidden="true" size={13} />
            <span className="lbl">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 레일·아바타 자리용: [계절 감상하기 | 켜기·흐리게·끄기] — 시청자는 설정 화면이 없어 여기서 바꾼다(2026-09-04 사용자). 같은 기기
 *  저장값(vic.ambient)이라 편집실 설정과 한 상태(편집실은 속성 변화를 지켜보며 설정·배경 효과 잠금을 맞춘다). 배경 OFF면
 *  감상 버튼은 숨고(볼 게 없다) 세그먼트만 남는다(다시 켜는 손잡이). */
export function ViewerAmbientControl({
  season,
  className = "",
  showcase = false,
  onChange
}: {
  season: SeasonKey;
  className?: string;
  /** 감상 진입 버튼을 보일지. **개발자만 true**(2026-09-04 소유자: 세계가 다 만들어지기 전엔 관리자·시청자에게
   *  배경으로만 보이게 하고 감상 모드는 감춘다). 다 만들면 한꺼번에 열어 보여 준다. */
  showcase?: boolean;
  /** 바꾼 뒤 알림(편집실은 설정 상태·배경 효과 잠금을 맞춘다). 저장·속성은 여기서 이미 처리한다. */
  onChange?: (mode: AmbientMode) => void;
}) {
  const [mode, setMode] = useState<AmbientMode>("off"); // 기본 OFF — 첫 프레임에 감상 버튼이 번쩍이지 않게
  useEffect(() => {
    const read = () => setMode(ambientMode());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ambient"] });
    return () => mo.disconnect();
  }, []);
  return (
    <div className={`viewer-ambient-ctl ${className}`.trim()} role="group" aria-label="계절 배경">
      {/* 카드 형태(레일·아바타 자리)에만 이름 한 줄 — 유리 알약에는 자리가 없어 CSS가 감춘다. 타일 글자를
          "계절 켜기"로 늘리면 셋의 등분이 깨지므로 이름은 머리에 붙인다(2026-09-05 소유자). */}
      <span className="amb-ctl-title" aria-hidden="true">
        계절 배경
      </span>
      {/* 순서: 상태 세그먼트 **위**, 감상하기 **아래**(2026-09-04 소유자, HCI) — 상태를 바꾼 손이
          바로 아래 감상하기로 이어지도록. 반대 순서면 토글 ↔ 감상 사이를 마우스가 왕복한다. */}
      <AmbientModeSegment
        dataAct="ambient-toggle-viewer"
        mode={mode}
        onChange={(next) => {
          setAmbientMode(next);
          setMode(next);
          if (next === "off") exitShowcase();
          onChange?.(next);
        }}
      />
      {showcase && mode !== "off" ? <ShowcaseButton season={season} /> : null}
    </div>
  );
}

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right"
};
const DIR_KO: Record<Dir, string> = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" };

function goTo(target: BiomeKey | Dir): boolean {
  return window.__vicAmbient?.goTo(target) ?? false;
}

/** 바이옴 내비(감상 중에만, body 포털) — 가장자리 쉐브론 4 · 미니맵(3×3 + 아래 2) · 도착 알약. 입력은 ShowcaseExit의 키 핸들러와 여기의
 *  스와이프가 goTo로 넣는다. 상태의 진실은 엔진(__vicAmbient.biome/exits) + vic:biome 이벤트. */
// 가 본 곳 — 기기에 남긴다(localStorage). 도감이 서버로 오기 전까지의 임시 자리(P2에서 계정 기록으로 승격).
const SEEN_KEY = "vic.biomeSeen";
function readSeen(): BiomeKey[] {
  const base: BiomeKey[] = ["meadow"];
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return base;
    const ks = raw.filter((k): k is BiomeKey => typeof k === "string" && k in BIOMES);
    return ks.includes("meadow") ? ks : [...base, ...ks];
  } catch {
    return base;
  }
}
function saveSeen(list: BiomeKey[]): BiomeKey[] {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    /* 무시 */
  }
  return list;
}

// 지도 칸에 적는 짧은 이름 — 62px 칸에 들어가야 한다(긴 이름은 머리줄이 맡는다).
const SHORT: Record<BiomeKey, string> = {
  valley: "계곡",
  pond: "민물",
  mountain: "산",
  hill: "언덕",
  meadow: "초원",
  forest: "숲",
  tidal: "갯벌",
  sandy: "모래",
  rocky: "암석",
  sea: "먼바다",
  deep: "깊은바다"
};

function ShowcaseNav() {
  const [biome, setBiome] = useState<BiomeKey>("meadow");
  const [exits, setExits] = useState<Record<Dir, BiomeKey | null>>({ up: null, down: null, left: null, right: null });
  // 가 본 곳은 **기기에 남는다**(감상에서 나갔다 들어오면 다 처음으로 돌아가던 문제, 2026-09-04 소유자).
  const [visited, setVisited] = useState<BiomeKey[]>(() => readSeen());
  const [pill, setPill] = useState<{ text: string; sub?: string; key: number } | null>(null);
  const [bounce, setBounce] = useState<Dir | null>(null);
  const pillTimer = useRef<number | null>(null);
  const bounceTimer = useRef<number | null>(null);
  const moveTimer = useRef<number | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const sync = () => {
      const a = window.__vicAmbient;
      if (!a) return;
      setBiome(a.biome());
      setExits(a.exits());
    };
    sync();
    const iv = window.setInterval(sync, 500);
    const onArrive = (e: Event) => {
      const d = (e as CustomEvent<{ biome: BiomeKey; first: boolean; season: SeasonKey; band: string; snap?: boolean }>).detail;
      setBiome(d.biome);
      setVisited((v) => (v.includes(d.biome) ? v : saveSeen([...v, d.biome])));
      sync();
      if (d.snap) return;
      hapticTick();
      // 도착 알약은 **바이옴 이름만**(2026-09-04 소유자). 계절·시간대는 화면이 이미 말하고,
      // 어떤 동식물이 사는지는 도감에서 직접 만나 채우는 재미라 미리 알려 주지 않는다.
      setPill({ text: BIOMES[d.biome].nameKo, key: Date.now() });
      if (pillTimer.current) window.clearTimeout(pillTimer.current);
      pillTimer.current = window.setTimeout(() => setPill(null), 1400);
    };
    const onBounce = (e: Event) => {
      const d = (e as CustomEvent<{ dir: string }>).detail;
      const dir = (["up", "down", "left", "right"] as Dir[]).find((k) => k === d.dir) ?? null;
      setBounce(dir);
      if (bounceTimer.current) window.clearTimeout(bounceTimer.current);
      bounceTimer.current = window.setTimeout(() => setBounce(null), 260);
      setPill({ text: "여긴 아직 없어요", key: Date.now() });
      if (pillTimer.current) window.clearTimeout(pillTimer.current);
      pillTimer.current = window.setTimeout(() => setPill(null), 1200);
    };
    // 떠나는 순간 방향을 문서에 적는다 — 그 쪽 쉐브론이 밀려나며 빛나고, 화면 가장자리에 진행 방향 빛이 스친다.
    const onDepart = (e: Event) => {
      const d = (e as CustomEvent<{ dx: number; dy: number; dur: number }>).detail;
      const dir: Dir = d.dx !== 0 ? (d.dx > 0 ? "right" : "left") : d.dy > 0 ? "down" : "up";
      const root = document.documentElement;
      root.setAttribute("data-biome-move", dir);
      if (moveTimer.current) window.clearTimeout(moveTimer.current);
      moveTimer.current = window.setTimeout(() => root.removeAttribute("data-biome-move"), Math.max(240, d.dur * 1000));
    };
    window.addEventListener("vic:biome-depart", onDepart);
    window.addEventListener("vic:biome", onArrive);
    window.addEventListener("vic:biome-bounce", onBounce);
    // 스와이프(터치·펜) — 60px 이상 한 방향.
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      swipe.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const onUp = (e: PointerEvent) => {
      const s = swipe.current;
      swipe.current = null;
      if (!s || e.timeStamp - s.t > 700) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 60) return;
      // 손가락 방향의 반대로 세계가 온다(왼쪽으로 쓸면 오른쪽 화면).
      const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "right" : "left") : dy < 0 ? "down" : "up";
      goTo(dir);
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("vic:biome-depart", onDepart);
      document.documentElement.removeAttribute("data-biome-move");
      if (moveTimer.current) window.clearTimeout(moveTimer.current);
      window.removeEventListener("vic:biome", onArrive);
      window.removeEventListener("vic:biome-bounce", onBounce);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      if (pillTimer.current) window.clearTimeout(pillTimer.current);
      if (bounceTimer.current) window.clearTimeout(bounceTimer.current);
    };
  }, []);

  const chev = (dir: Dir, Icon: typeof ChevronUp) => (
    <button
      aria-label={exits[dir] ? `${DIR_KO[dir]}: ${BIOMES[exits[dir]!].nameKo}` : `${DIR_KO[dir]}: 없음`}
      className={`biome-chev biome-chev-${dir}${exits[dir] ? "" : " none"}${bounce === dir ? " bounce" : ""}`}
      data-act="biome-move"
      data-dir={dir}
      key={dir}
      onClick={() => goTo(dir)}
      title={exits[dir] ? BIOMES[exits[dir]!].nameKo : "여긴 아직 없어요"}
      type="button"
    >
      <Icon aria-hidden="true" size={22} />
    </button>
  );

  return (
    <>
      {chev("up", ChevronUp)}
      {chev("down", ChevronDown)}
      {chev("left", ChevronLeft)}
      {chev("right", ChevronRight)}
      {/* 지도 — 계산기 버튼 판이 아니라 **읽히는 지도**로(2026-09-04 소유자). 머리줄에 지금 있는 곳과 진행 막대,
          칸마다 이름(안 가 본 곳은 ?), 뭍/바다 구역을 나눠 적는다. 현재 칸은 링 + 굵은 이름. */}
      <nav aria-label="바이옴 지도" className="biome-map" data-biome={biome}>
        <div className="biome-map-head">
          <span className="biome-map-here" data-water={BIOMES[biome].land ? undefined : "1"} />
          <span className="biome-map-title">{BIOMES[biome].nameKo}</span>
          <span className="biome-map-count">
            {visited.length}<i>/{Object.keys(BIOMES).length}</i>
          </span>
        </div>
        <div className="biome-map-bar">
          <i style={{ width: `${(visited.length / Object.keys(BIOMES).length) * 100}%` }} />
        </div>
        {BIOME_ROWS.map((row, i) => {
          const sea = row.length === 1;
          const firstSea = sea && BIOME_ROWS.findIndex((r) => r.length === 1) === i;
          return (
            <div key={i}>
              {i === 0 ? <p className="biome-map-cap">육지</p> : null}
              {firstSea ? <p className="biome-map-cap sea">바다</p> : null}
              <div className={`biome-map-row${sea ? " wide" : ""}`}>
                {row.map((k) => {
                  const def = BIOMES[k];
                  const on = k === biome;
                  const seen = visited.includes(k);
                  const near = (Object.keys(exits) as Dir[]).some((d) => exits[d] === k);
                  return (
                    <button
                      aria-current={on ? "location" : undefined}
                      aria-label={seen ? def.nameKo : "아직 못 가 본 곳"}
                      className={`biome-dot${on ? " on" : ""}${seen ? " seen" : ""}${near ? " near" : ""} biome-dot-${k}`}
                      data-act="biome-map-pick"
                      data-biome={k}
                      key={k}
                      onClick={() => goTo(k)}
                      title={seen ? def.nameKo : "아직 못 가 본 곳"}
                      type="button"
                    >
                      <span className="biome-dot-name">{seen ? SHORT[k] : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      {pill ? (
        <div className="biome-pill" key={pill.key} role="status">
          <span className="biome-pill-main">{pill.text}</span>
          {pill.sub ? <span className="biome-pill-sub">{pill.sub}</span> : null}
        </div>
      ) : null}
    </>
  );
}

/** 감상 중 상단 알약(나가기) + Esc + 바이옴 내비. 한 화면에 하나만 두면 된다(body 포털). */
export function ShowcaseExit() {
  const on = useShowcase();
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        exitShowcase();
        return;
      }
      // 방향키·WASD = 바이옴 이동(PLAN-004). 페이지 스크롤은 막는다.
      const dir = KEY_DIR[e.key];
      if (dir && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        goTo(dir);
        return;
      }
      // 감상 중엔 다른 단축키를 전부 삼킨다 — ←/→ 달 이동이 계절(배경)을 바꿔 감상이 깨졌다(2026-09-04 사용자). 브라우저
      // 기본 동작(새로고침·탭 이동)은 막지 않는다(stopPropagation만).
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [on]);
  // 언마운트(화면 전환)되면 감상 모드도 끝낸다 — 속성이 남아 다음 화면이 빈 채로 뜨지 않게.
  useEffect(() => () => set(false), []);
  if (!on || typeof document === "undefined") return null;
  return createPortal(
    <>
      {/* 안내는 짧게 — 긴 설명은 감상을 방해한다(2026-09-04 소유자). 이동은 쉐브론·미니맵이 스스로 말한다. */}
      {/* 눈 아이콘을 뺐다(2026-09-05 소유자: "굳이 눈모양을 넣은 이유가 뭐야, 쓸모 없잖아") — 나가는
          버튼에 '보다'를 그려 두면 뜻이 반대고, 키 칩 [Esc] + "나가기"가 이미 무엇을·어떻게를 다 말한다.
          같은 이유로 title도 없앴다(보이는 글자를 그대로 되풀이할 뿐이었다). */}
      <button className="showcase-exit" data-act="ambient-showcase-exit" onClick={() => exitShowcase()} type="button">
        <span className="showcase-exit-key">Esc</span>
        나가기
      </button>
      <ShowcaseNav />
    </>,
    document.body
  );
}
