"use client";

// 배경 감상 모드(2026-09-04 사용자: "누가 봐도 한 번은 눌러보고 싶게, 설정 밖에") — 편집실·시청자 공용.
// 켜면 `<html data-showcase>`가 붙고 CSS가 배경 레이어(.gs-season)만 남기고 크롬을 전부 투명·클릭 통과로
// 만든다(studio-shell.css / public-poster.css). 화면 전체가 '바탕'이 되어 잎 집기·발자국·잔물결이 어디서든 된다.
// 상태는 모듈 전역(속성 하나) — 어느 화면의 버튼이든 같은 스위치. 나가기 = Esc 또는 상단 알약(body 포털이라 숨김
// 규칙에 안 걸린다). 버튼은 계절 아이콘으로 "지금 계절을 보러 가자"를 말한다.
//
// 2026-10-23: everyone shares one meadow. Viewing keeps only exit and environment controls;
// the retired map, directional shortcuts and swipe navigation are intentionally absent.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ShowcaseDate, shiftShowcaseDay } from "./showcase-date";
import { ChevronDown, Flower2, Haze, Leaf, Power, Settings2, Snowflake, Sparkles, Waves } from "lucide-react";
import { kstToday, type SeasonKey } from "@/components/shared/ambient/registry";
import { type AmbientMode, ambientMode, setAmbientMode } from "@/lib/ui/motion";
import { BIOMES } from "@/components/shared/ambient/world/biomes";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";
import type { DayBand } from "@/components/shared/ambient/world/time";
import { WEATHER_LABEL, weatherOptionsForMonth, type Weather } from "@/components/shared/ambient/world/weather";
import type { GfxPref } from "@/lib/ui/gfx";
import { hapticTick } from "@/lib/ui/haptics";
import { PanelSection } from "@/components/shared/panel-section";

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
      title="초원에서 함께 산책하기 · Esc로 나가기"
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
            data-act-opt={value}
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
  showcase = true,
  collapsible = false,
  onChange
}: {
  season: SeasonKey;
  className?: string;
  /** Shared viewer/staff entry. Noninteractive surfaces can explicitly omit it. */
  showcase?: boolean;
  /** Viewer and its previews share the same optional panel disclosure. */
  collapsible?: boolean;
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
    <PanelSection as="div" title="계절 배경" sectionKey="season" collapsible={collapsible} className={`viewer-ambient-ctl ${className}`.trim()} role="group" aria-label="계절 배경">
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
    </PanelSection>
  );
}

// ── 감상 중 배경 설정(2026-09-05 소유자: "감상하면서 시간대·날씨 바꿔 가며 바로 확인") ────────────────────
// 감상 모드에선 편집실 크롬이 전부 사라져 설정 모달로 갈 길이 없다(나가서 → 톱니 → 고르고 → 다시 감상 = 왕복 4번).
// 그래서 오른쪽 위 꼭짓점에 톱니 하나. 여는 판은 **바꾸면 바로 보이는 것들만** 담는다: 계절 · 시간대 · 날씨 · 배경 효과.
// Everyone can experiment locally. Leaving the meadow restores the outside world; only the shared graphics preference persists.
// 시간대·날씨는 장면을 다시 굽지 않고 엔진에 바로 들어가고(scene-engine forceWorld), 계절만 캔버스를 다시 만든다.
type WorldForce = NonNullable<WorldCtx["force"]>;

export type ShowcaseSettings = {
  /** Season override for this viewing session; null follows the calendar. */
  sessionOnly?: boolean;
  seasonForce: SeasonKey | null;
  onChangeSeasonForce: (season: SeasonKey | null) => void;
  /** 보고 있는 달 — 계절이 '자동'일 때 날씨 목록을 정한다. */
  month: number;
  year: number;
  world: { force: WorldForce; onChange: (force: WorldForce) => void };
  gfxPref: GfxPref;
  onChangeGfxPref: (pref: GfxPref) => void;
};

/** Local scenery experiments never change the calendar or grant studio authority. */
export function useShowcaseEnvironment({
  month, year, seasonForce = null, worldForce, gfxPref, onChangeGfxPref
}: {
  month: number;
  year: number;
  seasonForce?: SeasonKey | null;
  worldForce?: WorldCtx["force"];
  gfxPref: GfxPref;
  onChangeGfxPref: (pref: GfxPref) => void;
}) {
  const on = useShowcase();
  const [preview, setPreview] = useState<{ season?: SeasonKey | null; force?: WorldForce }>({});
  useEffect(() => {
    if (!on) setPreview(previous => Object.keys(previous).length ? {} : previous);
  }, [on]);
  const season = on && preview.season !== undefined ? preview.season : seasonForce;
  const force = on && preview.force !== undefined ? preview.force : worldForce;
  const settings: ShowcaseSettings = {
    sessionOnly: true,
    month, year, seasonForce: season,
    onChangeSeasonForce: value => setPreview(previous => ({ ...previous, season: value })),
    world: {
      force: force ?? {},
      onChange: value => setPreview(previous => ({ ...previous, force: value }))
    },
    gfxPref, onChangeGfxPref
  };
  return { seasonForce: season, worldForce: force, settings };
}

const AUTO = "auto";
const BANDS: { value: DayBand; label: string }[] = [
  { value: "dawn", label: "새벽" },
  { value: "morning", label: "아침" },
  { value: "noon", label: "점심" },
  { value: "dusk", label: "노을" },
  { value: "evening", label: "저녁" },
  { value: "night", label: "밤" }
];
// 계절을 강제하면 날씨 목록도 그 계절의 것이어야 한다(9월에 겨울을 강제해 놓고 눈을 못 고르면 소용없다).
const SEASON_MONTH: Record<SeasonKey, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 };

/** 한 줄 = 이름 + 칩 묶음. 고른 칸은 세그먼트 공통 기법(--seg-on-*)으로 채운다 — 테두리 칩 금지(2026-09-05 규칙). */
function SetRow<T extends string>({
  label,
  value,
  options,
  onPick,
  dataAct
}: {
  label: string;
  value: T;
  options: { value: T; label: string; tip?: string }[];
  onPick: (value: T) => void;
  dataAct: string;
}) {
  // 칸을 고르게 나눈다 — 한 줄에 최대 5개, 줄 수가 정해지면 열 수는 그 줄들이 **같은 길이**가 되도록.
  // (7개면 4+3, 6개면 3+3.) 왼쪽 정렬 flex는 마지막 줄에 칩 하나만 남아 들쭉날쭉해 보였다.
  const rows = Math.ceil(options.length / 5);
  const cols = Math.ceil(options.length / rows);
  return (
    <div className="sc-set-row">
      <span className="sc-set-name">{label}</span>
      <div aria-label={label} className="sc-set-chips" role="radiogroup" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              aria-checked={on}
              className={`sc-set-chip${on ? " on" : ""}`}
              data-act={dataAct}
              data-act-opt={o.value}
              key={o.value}
              onClick={() => {
                if (on) return;
                hapticTick();
                onPick(o.value);
              }}
              role="radio"
              tabIndex={on ? 0 : -1}
              onKeyDown={e=>{
                const delta=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;
                if(!delta)return;
                e.preventDefault();e.stopPropagation();
                const index=(options.indexOf(o)+delta+options.length)%options.length;
                onPick(options[index].value);
                const buttons=e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');buttons?.[index]?.focus();
              }}
              title={o.tip}
              type="button"
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShowcaseSettingsPanel({ s, open, onOpen }: { s: ShowcaseSettings; open: boolean; onOpen: (open: boolean) => void }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const gearRef = useRef<HTMLButtonElement | null>(null);
  const dateRef = useRef<HTMLButtonElement | null>(null);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const [position,setPosition]=useState<{x:number;y:number}|null>(null);
  const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const constrain=(x:number,y:number)=>{
    const rect=boxRef.current?.getBoundingClientRect();
    return {x:Math.max(12,Math.min(window.innerWidth-(rect?.width ?? 280)-12,x)),y:Math.max(12,Math.min(window.innerHeight-(rect?.height ?? 280)-12,y))};
  };
  useEffect(()=>{
    if(!open){drag.current=null;setCalendarOpen(false);return;}
    const keepVisible=()=>setPosition(p=>{
      if(!p)return p;
      const next=constrain(p.x,p.y);
      return next.x===p.x&&next.y===p.y?p:next;
    });
    const observer=new ResizeObserver(keepVisible);
    if(boxRef.current)observer.observe(boxRef.current);
    window.addEventListener('resize',keepVisible);
    return ()=>{observer.disconnect();window.removeEventListener('resize',keepVisible);};
  },[open]);
  const closeCalendar=()=>{setCalendarOpen(false);dateRef.current?.focus();};

  // 지금 실제로 그려지는 값 — '자동'을 골라 뒀을 때 무엇이 나오는지가 QA의 절반이다(엔진에서 직접 읽는다).
  const [now, setNow] = useState<{ biome: string; band: string; weather: string; date:string; hour:number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const read = () => {
      const a = window.__vicAmbient;
      if (!a) return;
      const w = a.world();
      setNow({ date:w.date, hour:w.hour, biome: BIOMES[a.biome()]?.nameKo ?? "", band: BANDS.find((b) => b.value === w.band)?.label ?? w.band, weather: WEATHER_LABEL[w.weather as Weather] ?? w.weather });
    };
    read();
    const iv = window.setInterval(read, 500);
    return () => window.clearInterval(iv);
  }, [open]);
  // 바깥을 누르면 닫는다 — 배경을 만지러 간 손이 판을 치우게(감상 중엔 화면 전체가 놀잇감이다).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || boxRef.current?.contains(t) || gearRef.current?.contains(t)) return;
      onOpen(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open, onOpen]);

  const f = s.world.force;
  const month = s.seasonForce ? SEASON_MONTH[s.seasonForce] : f.month ?? s.month;
  const observedDate=now?.date.split('-').map(Number);
  const yy=f.year ?? observedDate?.[0] ?? s.year, mm=f.month ?? observedDate?.[1] ?? s.month;
  const dd=f.day ?? observedDate?.[2] ?? 1;
  const pad=(v:number)=>String(v).padStart(2,'0');
  const dateValue=`${yy}-${pad(mm)}-${pad(dd)}`;
  const minute=Math.max(0,Math.min(1439,Math.round((f.band ? now?.hour ?? 12 : f.hour ?? now?.hour ?? 12)*60)));
  const clock=`${pad(Math.floor(minute/60))}:${pad(minute%60)}`;
  const changeTime=(value:number)=>s.world.onChange({...f,band:undefined,hour:value/60});
  const changeDate=(value:string)=>{
    const [year,month,day]=value.split('-').map(Number);
    if(!year||year<1900||year>2100||!month||!day)return;
    s.onChangeSeasonForce(null);
    s.world.onChange({...f,year,month,day,biome:window.__vicAmbient?.biome() ?? f.biome});
  };
  const shiftDay=(delta:number)=>{
    const next=shiftShowcaseDay(dateValue,delta);
    if(next<'1900-01-01'||next>'2100-12-31')return;
    const [year,month,day]=next.split('-').map(Number);
    const hour=delta>0&&minute===1439?0:delta<0&&minute===0?1439/60:minute/60;
    s.onChangeSeasonForce(null);
    s.world.onChange({...f,year,month,day,band:undefined,hour,biome:window.__vicAmbient?.biome() ?? f.biome});
  };
  const reset=()=>{
    const today=kstToday();
    setCalendarOpen(false);
    s.onChangeSeasonForce(null);
    s.world.onChange({...f,year:today.y,month:today.m,day:today.d,hour:undefined,band:undefined,biome:window.__vicAmbient?.biome() ?? f.biome});
  };
  return (
    <>
      <button
        aria-expanded={open}
        aria-label="배경 설정"
        className={`showcase-gear${open ? " on" : ""}`}
        data-act="ambient-showcase-settings"
        onClick={() => {
          hapticTick();
          onOpen(!open);
        }}
        ref={gearRef}
        title="배경 설정"
        type="button"
      >
        <Settings2 aria-hidden="true" size={18} /><span>환경 조절</span>
      </button>
      {open ? (
        <div aria-label="배경 설정" aria-modal="false" onKeyDown={e=>e.stopPropagation()} className="showcase-set" ref={boxRef} role="dialog"
          style={position?{left:position.x,top:position.y,right:'auto',maxHeight:'calc(100dvh - 24px)'}:undefined}>
          <div className="sc-set-heading">
            <button className="sc-set-handle" data-act="sc-set-handle" type="button" aria-label="설정창 이동: 드래그 또는 방향키" onPointerDown={e=>{
              if(e.button!==0)return;
              const rect=boxRef.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};e.currentTarget.setPointerCapture(e.pointerId);
            }} onPointerMove={e=>{const d=drag.current;if(d)setPosition(constrain(d.left+e.clientX-d.x,d.top+e.clientY-d.y));}}
            onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
            onKeyDown={e=>{const delta=({ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]} as Record<string,number[]>)[e.key];if(!delta)return;e.preventDefault();e.stopPropagation();const rect=boxRef.current!.getBoundingClientRect();setPosition(constrain(rect.left+delta[0],rect.top+delta[1]));}}>
              <span aria-hidden="true">⠿</span> 환경 조절
            </button>
            <div className="sc-set-head-actions"><button type="button" aria-label="오늘 날짜와 현재 시각으로 복귀" onClick={reset}>현재</button><button type="button" aria-label="배경 설정 닫기" onClick={()=>{onOpen(false);gearRef.current?.focus();}}>닫기</button></div>
          </div>
          <p className="sc-set-now">서울 · {now ? `${now.biome} · ${now.weather}` : '한국 시간'}</p>
          <SetRow<NonNullable<WorldForce['skyBearing']>> dataAct="showcase-bearing" label="방향" value={f.skyBearing ?? 'south'}
            options={[{value:'east',label:'동'},{value:'west',label:'서'},{value:'south',label:'남'},{value:'north',label:'북'}]}
            onPick={v=>s.world.onChange({...f,skyBearing:v})}/>
          <div className="sc-set-date-row">
            <button type="button" aria-label="전날" disabled={dateValue<='1900-01-01'} onClick={()=>shiftDay(-1)}>‹</button>
            <button className="sc-set-date-trigger" data-act="showcase-date" ref={dateRef} type="button" aria-label="날짜 선택" aria-expanded={calendarOpen} onClick={()=>{setCalendarOpen(v=>!v);dateRef.current?.focus();}}>{dateValue} <ChevronDown size={13} aria-hidden="true"/></button>
            <button type="button" aria-label="다음 날" disabled={dateValue>='2100-12-31'} onClick={()=>shiftDay(1)}>›</button>
            <output className="sc-set-clock" aria-label="선택 시각">{clock}</output>
          </div>
          {calendarOpen?<ShowcaseDate value={dateValue} onChange={value=>{changeDate(value);closeCalendar();}} onClose={closeCalendar}/>:null}
          <input className="sc-set-time-range" aria-label="하루 시각" aria-valuetext={`${Math.floor(minute/60)}시 ${minute%60}분`} type="range" min="0" max="1439" step="1" value={minute} onChange={e=>changeTime(Number(e.target.value))}
            onKeyDown={e=>{
              const next=e.key==='ArrowRight'&&minute===1439,prev=e.key==='ArrowLeft'&&minute===0;
              if(!next&&!prev)return;
              e.preventDefault();
              const date=shiftShowcaseDay(dateValue,next?1:-1);if(date<'1900-01-01'||date>'2100-12-31')return;
              const [year,month,day]=date.split('-').map(Number);s.onChangeSeasonForce(null);s.world.onChange({...f,year,month,day,band:undefined,hour:next?0:1439/60,biome:window.__vicAmbient?.biome() ?? f.biome});
            }}/>
          <div className="sc-set-hours" aria-hidden="true"><span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>24시</span></div>
          <details className="sc-set-more"><summary>계절 · 날씨 · 효과</summary>
          <SetRow<SeasonKey | typeof AUTO>
            dataAct="showcase-season"
            label="계절"
            onPick={(v) => s.onChangeSeasonForce(v === AUTO ? null : v)}
            options={[
              { value: AUTO, label: "자동", tip: "달력 달을 따라감" },
              { value: "spring", label: "봄" },
              { value: "summer", label: "여름" },
              { value: "autumn", label: "가을" },
              { value: "winter", label: "겨울" }
            ]}
            value={s.seasonForce ?? AUTO}
          />
          <SetRow<DayBand | typeof AUTO>
            dataAct="showcase-band"
            label="시간대"
            onPick={(v) => s.world.onChange({ ...f, band: v === AUTO ? undefined : v, hour: undefined })}
            options={[{ value: AUTO, label: "자동", tip: "지금 시각" }, ...BANDS]}
            value={f.band ?? AUTO}
          />
          <SetRow<Weather | typeof AUTO>
            dataAct="showcase-weather"
            label="날씨"
            onPick={(v) => s.world.onChange({ ...f, weather: v === AUTO ? undefined : v })}
            options={[
              { value: AUTO, label: "자동", tip: "날짜 시드 난수" },
              ...weatherOptionsForMonth(month).map((w) => ({ value: w as Weather | typeof AUTO, label: WEATHER_LABEL[w] }))
            ]}
            value={f.weather ?? AUTO}
          />
          {/* 하늘 사건(2026-09-08) — 별똥별 평균 1분, 혜성 9분이라 기다려서는 확인이 안 된다. 고르면 쉬지 않고 되풀이한다.
              설정 모달의 같은 줄과 **같은 상태**다(world.force) — 두 자리가 어긋나면 안 된다는 규칙(CLAUDE.md 감상 톱니). */}
          <SetRow<"auto" | "shooting-star" | "comet">
            dataAct="showcase-sky-event"
            label="하늘 사건"
            onPick={(v) => s.world.onChange({ ...f, skyEvent: v === AUTO ? undefined : v })}
            options={[
              { value: AUTO, label: "자동", tip: "실제 확률대로" },
              { value: "shooting-star", label: "별똥별", tip: "밤·맑음에서만" },
              { value: "comet", label: "혜성", tip: "밤·맑음에서만" }
            ]}
            value={f.skyEvent ?? AUTO}
          />
          <SetRow<GfxPref>
            dataAct="showcase-gfx"
            label="배경 효과"
            onPick={s.onChangeGfxPref}
            options={[
              { value: "auto", label: "자동" },
              { value: "max", label: "최대" },
              { value: "lite", label: "가볍게" }
            ]}
            value={s.gfxPref === "off" ? "auto" : s.gfxPref}
          />
          </details>
        </div>
      ) : null}
    </>
  );
}

/** Shared meadow controls. The body portal stays reachable while the underlying app is inert. */
export function ShowcaseExit({ settings }: { settings?: ShowcaseSettings | null } = {}) {
  const on = useShowcase();
  const surfaceRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!on) return;
    const trigger = document.activeElement;
    // Opacity/pointer-events on parents do not disable descendants that opt
    // back into pointer-events:auto. Keep the underlying app out of hit testing
    // and keyboard navigation; the body portal and global ambient input stay live.
    const previous = new Map<HTMLElement, boolean>();
    const isolate = () => {
      for (const node of document.body.children) {
        if (!(node instanceof HTMLElement) || node === surfaceRef.current || node.matches(".vc-meadow-walk")) continue;
        if (!previous.has(node)) previous.set(node, node.inert);
        node.inert = true;
      }
    };
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, {childList:true});
    surfaceRef.current?.focus({ preventScroll: true });
    return () => {
      observer.disconnect();
      for (const [node, inert] of previous) node.inert = inert;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [on]);
  const [setOpen, setSetOpen] = useState(false);
  const before = useRef<{ season: SeasonKey | null; force: WorldForce } | null>(null);
  // Environment experiments belong to this viewing session. Restore the
  // outside settings (normally automatic), including date/time/direction.
  // Graphics preference is intentionally persistent and is not part of this snapshot.
  useEffect(() => {
    if (on && settings && !settings.sessionOnly && !before.current) {
      before.current = { season: settings.seasonForce, force: { ...settings.world.force } };
    } else if (!on && before.current) {
      const saved = before.current;
      before.current = null;
      settings?.onChangeSeasonForce(saved.season);
      settings?.world.onChange(saved.force);
    }
  }, [on, settings]);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if(document.querySelector('.sc-date-picker'))return;
        if(document.querySelector('.sc-date-calendar')){e.stopPropagation();document.querySelector<HTMLButtonElement>('[data-act="showcase-date"]')?.click();return;}
        e.stopPropagation();
        // 설정 판이 열려 있으면 Esc는 판만 닫는다 — 설정을 만지다 실수로 감상까지 나가지 않게.
        if (setOpen) {setSetOpen(false);document.querySelector<HTMLButtonElement>('.showcase-gear')?.focus();}
        else exitShowcase();
        return;
      }
      const target=e.target as HTMLElement;
      if(target?.closest?.('.showcase-set'))return;
      if(target?.closest?.('input,select,textarea,button,[contenteditable="true"]')){
        e.stopPropagation();return;
      }
      // Keep calendar arrow shortcuts out of the meadow; there are no map destinations.
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      // 감상 중엔 다른 단축키를 전부 삼킨다 — ←/→ 달 이동이 계절(배경)을 바꿔 감상이 깨졌다(2026-09-04 사용자). 브라우저
      // 기본 동작(새로고침·탭 이동)은 막지 않는다(stopPropagation만).
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [on, setOpen]);
  // 감상에서 나가면 설정 판도 접는다(다음 진입은 늘 깨끗한 화면으로).
  useEffect(() => {
    if (!on) setSetOpen(false);
  }, [on]);
  // 언마운트(화면 전환)되면 감상 모드도 끝낸다 — 속성이 남아 다음 화면이 빈 채로 뜨지 않게.
  useEffect(() => () => set(false), []);
  if (!on || typeof document === "undefined") return null;
  return createPortal(
    <div ref={surfaceRef} role="region" aria-label="배경 감상" tabIndex={-1} style={{ outline: "none" }}>
      {/* 눈 아이콘을 뺐다(2026-09-05 소유자: "굳이 눈모양을 넣은 이유가 뭐야, 쓸모 없잖아") — 나가는
          버튼에 '보다'를 그려 두면 뜻이 반대고, 키 칩 [Esc] + "나가기"가 이미 무엇을·어떻게를 다 말한다.
          같은 이유로 title도 없앴다(보이는 글자를 그대로 되풀이할 뿐이었다). */}
      <button className="showcase-exit" data-act="ambient-showcase-exit" onClick={() => exitShowcase()} type="button">
        <span className="showcase-exit-key">Esc</span>
        나가기
      </button>
      {settings ? <ShowcaseSettingsPanel onOpen={setSetOpen} open={setOpen} s={settings} /> : null}
    </div>,
    document.body
  );
}
