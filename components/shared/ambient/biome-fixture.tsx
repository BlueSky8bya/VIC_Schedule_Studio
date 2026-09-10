"use client";

// 바이옴 fixture(2026-09-05, PLAN-20260905-005 P0) — 달력·크롬 없이 계절 배경 캔버스 하나를 **결정적으로** 띄운다.
// `/visual-fixture/biome?biome=&season=&band=&weather=&seed=&t=&load=&pointer=&camera=&gfx=&reduced=`(VISUAL_TEST_FIXTURE=1일 때만).
// 엔진은 `force.freeze`로 얼려 rAF 루프를 돌리지 않고, 여기서 `ready()` → `advance(t)`로 t까지만 시간을 흘린 뒤
// `__vicAmbient.settledT`에 도달한 t를 적는다 — 캡처 스크립트(scripts/ambient-qa)는 그 신호를 기다린다.
// 같은 URL = 같은 프레임(시드·dt·경로 순서가 같다). 사람이 열어도 그 프레임이 정지 화면으로 보인다.
//
// fixture 전용 부작용: 배경 게이트와 요청한 그래픽·동작 설정을 이 기기 localStorage에 쓴다 —
// 실제 화면(/, /studio)은 이 컴포넌트를 쓰지 않는다.

import { useEffect, useLayoutEffect, useState } from "react";
import { AmbientLayer } from "@/components/shared/ambient/ambient-layer";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";
import { enterShowcase, exitShowcase, ShowcaseExit } from "@/components/shared/ambient/showcase";
import { setGfxPref, type GfxPref } from "@/lib/ui/gfx";
import { MOBILE_QUERY } from "@/lib/ui/breakpoints";
import { setAmbientMode, setReduceMotion } from "@/lib/ui/motion";

/** 계절 → fixture가 보는 달(계절 판정·날씨 표·흔적이 전부 달에서 나온다). 봄 4 · 여름 8 · 가을 10 · 겨울 1. */
export const SEASON_MONTH: Record<SeasonKey, number> = { spring: 4, summer: 8, autumn: 10, winter: 1 };

export type BiomeFixtureProps = {
  season: SeasonKey;
  year: number;
  /** 달력 달(1~12) — 없으면 계절의 대표 달. 달 위상·흔적 스윕 검증용. */
  month?: number;
  /** 엔진 강제값 — biome·band·weather·seed·load·pointer + freeze·pin은 페이지가 늘 true로 준다. */
  force: NonNullable<WorldCtx["force"]>;
  /** 도달할 애니메이션 시각(ms). 0 = 굽기만 한 첫 프레임. */
  t: number;
  /** showcase = 감상 모드(내비 오버레이 포함, 기본) · plain = 정지 배경. */
  camera: "showcase" | "plain";
  /** 기본 max. auto는 실제 기기 판정/여력을 관측하므로 환경도 함께 기록한다. */
  gfx?: GfxPref;
  reduced?: boolean;
  live?: boolean;
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const waitFor = <T,>(get: () => T | undefined, timeoutMs: number): Promise<T | undefined> =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      const v = get();
      if (v !== undefined) return resolve(v);
      if (performance.now() - t0 > timeoutMs) return resolve(undefined);
      window.setTimeout(poll, 30);
    };
    poll();
  });

export function BiomeFixture({ season, year, month, force, t, camera, gfx = "max", reduced = false, live = false }: BiomeFixtureProps) {
  const [playing, setPlaying] = useState(live);
  const [previewForce, setPreviewForce] = useState(force);
  const changePreview = (patch: Partial<typeof force>) => {
    const next = { ...previewForce, ...patch };
    window.__vicAmbient?.forceWorld(next);
    const observed=window.__vicAmbient?.world();
    setPreviewForce({...next,hour:typeof observed?.hour==='number'?observed.hour:next.hour});
  };
  const forceKey = JSON.stringify(force);
  // 자식(SeasonCanvas)의 마운트 효과보다 **먼저** 게이트를 연다 — 레이아웃 효과는 패시브 효과 전에 전부 돈다.
  // 페인트-전 스크립트는 vic.ambient 미설정 → data-ambient="off"(캔버스 display:none)라, 그대로 두면 엔진이 0×0을 잰다.
  useIsoLayoutEffect(() => {
    setAmbientMode("on");
    setGfxPref(gfx);
    setReduceMotion(reduced);
    if (camera === "showcase") enterShowcase();
    return () => exitShowcase();
  }, [camera, gfx, reduced]);
  useEffect(() => {
    let cancelled = false;
    const root = document.documentElement;
    // 모바일에는 엔진이 마운트되지 않는다. QA는 이 표식을 읽고 준비 대기 대신 제외를 확인한다.
    if (window.matchMedia(MOBILE_QUERY).matches) {
      root.setAttribute("data-biome-fixture-disabled", "mobile");
      return () => root.removeAttribute("data-biome-fixture-disabled");
    }
    root.removeAttribute("data-biome-fixture-disabled");
    void (async () => {
      const dbg = await waitFor(() => window.__vicAmbient, 15000);
      if (!dbg || cancelled) return;
      await dbg.ready(12000);
      if (cancelled) return;
      const reached = await dbg.advance(t);
      if (!cancelled) {
        dbg.settledT = reached;
        const observed=dbg.world();
        setPreviewForce(prev=>({...prev,day:Number(String(observed.date).split('-')[2])||prev.day,hour:typeof observed.hour==='number'?observed.hour:prev.hour}));
        if (live) { dbg.freeze(false); setPlaying(true); }
      }
    })();
    return () => {
      cancelled = true;
    };
    // forceKey = 값 비교(객체 정체성이 아니라) — 서버가 준 force는 매 렌더 새 객체일 수 있다.
  }, [t, season, forceKey, camera, gfx, reduced, live]);
  return (
    <>
      <AmbientLayer force={season} month={month ?? SEASON_MONTH[season]} slug="vic" worldForce={force} year={year} />
      {camera === "showcase" ? <ShowcaseExit /> : null}
      {live ? <div style={{ position: "fixed", top: 16, left: 16, right:16, zIndex: 2147483647, display: "flex", flexWrap:'wrap', alignItems:'center', gap: 12, padding: "10px 14px", borderRadius: 12, background: "#fffef0ed", color: "#284535", fontSize: 14 }}>
        <span>{{ spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" }[season]} 초원 테스트 · 마우스를 움직여 보세요</span>
        {(["spring", "summer", "autumn", "winter"] as const).map(s => <a key={s} href={`?biome=meadow&season=${s}&band=noon&weather=clear&seed=42&t=1500&camera=showcase&gfx=auto&load=auto&live=1`}>{{spring:"봄",summer:"여름",autumn:"가을",winter:"겨울"}[s]}</a>)}
        <button onClick={() => { window.__vicAmbient?.freeze(playing); setPlaying(!playing); }}>{playing ? "일시정지" : "재생"}</button>
        <button onClick={() => changePreview({ band: "noon", skyEvent: undefined })}>낮</button>
        <button onClick={() => changePreview({ band: "night", skyEvent: "shooting-star" })}>밤·별똥별</button>
        <label>서울 하늘 <select aria-label="하늘 방향" value={previewForce.skyBearing ?? 'south'} onChange={e => changePreview({ skyBearing:e.target.value as NonNullable<typeof force.skyBearing> })}>
          <option value="south">남쪽</option><option value="north">북쪽</option><option value="east">동쪽</option><option value="west">서쪽</option>
        </select></label>
        <label>날씨 <select aria-label="날씨" value={previewForce.weather ?? 'clear'} onChange={e => changePreview({ weather:e.target.value as NonNullable<typeof force.weather> })}>
          <option value="clear">맑음</option><option value="cloud">흐림</option><option value="wind">바람</option><option value="rain">비</option><option value="snow">눈</option><option value="fog">안개</option>
        </select></label>
        <label>날짜 <input aria-label="날짜" type="number" min={1} max={new Date(Date.UTC(year,month??SEASON_MONTH[season],0)).getUTCDate()} value={previewForce.day??15} style={{width:40}} onChange={e=>changePreview({day:Math.max(1,Math.min(new Date(Date.UTC(year,month??SEASON_MONTH[season],0)).getUTCDate(),Number(e.target.value)||1))})}/></label>
        <label>시각 <input aria-label="시각" type="number" min={0} max={23.75} step={.25} value={previewForce.hour??(previewForce.band==='night'?21:12)} style={{width:48}} onChange={e=>changePreview({band:undefined,hour:Math.max(0,Math.min(23.75,Number(e.target.value)||0))})}/></label>
      </div> : null}
    </>
  );
}
