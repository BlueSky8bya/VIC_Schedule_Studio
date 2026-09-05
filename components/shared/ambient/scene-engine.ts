// 계절 장면 엔진(2026-09-04, ADR-0017 개정 2) — 봄·여름·가을·겨울 캔버스 레이어의 공용 뼈대.
// 왜 캔버스인가: 낙엽 물리(충돌·바람·집기)·나비(회피·클릭)·눈 발자국처럼 **상호작용하는** 장면은 DOM/CSS
// 애니로는 못 만든다. 전체 화면 캔버스 하나 = 합성 레이어 하나, 매 프레임 스프라이트 drawImage 수십 개 —
// GPU 캔버스에선 물결(SVG 필터 합성)보다 싸다. 규칙: 필터/블러는 프레임마다 쓰지 않는다(스프라이트에 미리
// 굽는다), 바탕(풀밭·눈밭)은 리사이즈 때 한 번만 그린다, 탭이 숨거나 스위치가 꺼지면 루프를 멈춘다.
//
// 품질 = 단계 q + **연속 여력 load(0~1)** (2026-09-04 사용자: "자동이면 컴퓨터가 널널할 때 낙엽이 연속적으로 많아지고
// 딸리면 최소로"). q는 기기 판정(data-gfx: 2 최대 · 1 lite · 0 soft/스스로 내려온 경우)이 정하는 **상한/하한 띠**,
// load는 그 띠 안에서 프레임 실측으로 오르내리는 값 — 90프레임마다 늦은 프레임(34ms↑) 비율·평균 간격을 보고
// 좋으면 +0.06, 나쁘면 −0.15(내려갈 땐 빨리, 올라갈 땐 천천히). 장면은 매 프레임 f.load를 읽어 입자 수·소품·효과를
// **점진적으로**(툭 사라지지 않게) 맞춘다. 설정 "배경 효과" = 항상 최대 → load 1 고정, 가볍게 → 0.3 고정, 자동 → 조절.
// DPR(캔버스 해상도)도 load에 따른다(≥0.6 → 1.5 배율, ≤0.4 → 1) — 흐릿해도 되는 것은 흐릿하게 그리는 LOD 원칙의 첫 손잡이.
// 생동감 있는 동작 OFF(data-reduce-motion)면 정지 화면 한 장만 그린다.
//
// 포인터: window에서 듣는다(캔버스는 z:-1·pointer-events:none). 이동 = 바람/회피(어디서든), 누르기 = 배경
// (버튼·칸·팝오버가 아닌 곳)에서만 '집기/도장', 단 나비처럼 장면이 직접 맞힌 건 어디서든 반응한다.

import { gfxPref } from "@/lib/ui/gfx";
import { kstToday, type SeasonKey } from "@/components/shared/ambient/registry";
import { kstHour, worldTime, worldTimeOfBand, type DayBand, type WorldTime } from "@/components/shared/ambient/world/time";
import { weatherAt, type DayWeather, type Weather } from "@/components/shared/ambient/world/weather";
import { monthTraces, type Trace } from "@/components/shared/ambient/world/traces";
import { drawDepthHaze } from "@/components/shared/ambient/world/view";
import type { BiomeKey, Dir } from "@/components/shared/ambient/world/biomes";

export type Quality = 0 | 1 | 2;

/** 세계 문맥(Phase A) — 어느 달력의 어느 달을 보는가 + 검증용 강제값(시각·날씨·날). */
export type WorldCtx = {
  slug: string;
  season: SeasonKey;
  year: number;
  month: number;
  /** 검증·개발자 시간 여행용 강제값 — band가 있으면 hour보다 우선. biome = 시작 바이옴(fixture). */
  force?: { hour?: number; band?: DayBand; weather?: Weather; biome?: BiomeKey };
};

export type Pointer = {
  x: number;
  y: number;
  vx: number; // px/s (EMA)
  vy: number;
  speed: number;
  down: boolean;
  inside: boolean;
  moved: boolean; // 이번 프레임에 움직였나
  ts: number;
};

export type Frame = {
  w: number;
  h: number;
  dpr: number; // 캔버스 배율(바탕을 같은 배율로 굽는다)
  t: number; // 초
  dt: number; // 초(≤0.05)
  p: Pointer;
  q: Quality;
  load: number; // 0~1 연속 여력 — 장면은 이 값으로 입자 수·소품을 점진 조절한다
  reduced: boolean;
  /** 핫 존(달력 패널·포스터 표면)의 캔버스 좌표 — 소품(오리)이 그 위에서 서성이지 않게. 감상 모드·없으면 null. */
  hot: { x: number; y: number; w: number; h: number } | null;
  /** 집중 모드(편집·끌기 중): 배경이 옅고 프레임이 절반 — 장면은 포인터 장난(항적 등)을 쉰다. */
  dim: boolean;
  // ── 세계(Phase A, PLAN-20260904-003) ──
  /** 보고 있는 달의 날(현재 달 = 오늘, 과거 달 = 말일, 미래 달 = 1일). */
  date: { y: number; m: number; d: number };
  /** 하루 여섯 띠 + 빛 톤(KST). */
  time: WorldTime;
  /** 날짜 시드 날씨(오전/오후 마디, 직전 마디). */
  weather: DayWeather;
  /** 연대기 흔적(저장소·싹·나무·흙더미·눈사람·연잎), 정규화 좌표. */
  traces: Trace[];
};

export interface Scene {
  /** 크기·품질이 바뀌면(첫 마운트 포함) — 바탕을 다시 굽고 입자 수를 맞춘다. */
  resize(f: Frame): void;
  step(f: Frame): void;
  draw(g: CanvasRenderingContext2D, f: Frame): void;
  /** 눌림. onBackground = UI가 아닌 바탕 위. 소비했으면 true. */
  pointerDown?(f: Frame, onBackground: boolean): boolean;
  pointerUp?(f: Frame): void;
  /** 검증·디버그용 상태(window.__vicAmbient.scene) — 입자 위치 몇 개, 카운터. */
  debug?(): Record<string, unknown>;
  /** 세계 장면(world-scene.ts)만 — 바이옴 이동. React 내비(showcase.tsx)가 __vicAmbient.goTo로 부른다. */
  nav?: { go(target: BiomeKey | Dir): boolean; at(): BiomeKey; moving(): boolean; exits(): Record<Dir, BiomeKey | null> };
}

// 검증 훅 — Playwright가 장면 상태(입자 위치·소비된 클릭 수·품질·프레임·여력)를 읽는다. forceLoad로 여력을 고정해
// 장면의 점진 조절을 재현할 수 있다(null = 자동으로 복귀). 렌더 무영향.
type AmbientDebug = {
  season: string;
  q: Quality;
  load: number;
  frames: number;
  consumed: number;
  running: boolean;
  scene: () => Record<string, unknown>;
  forceLoad: (v: number | null) => void;
  hot: Frame["hot"];
  /** 세계 상태(띠·날씨·날·흔적 수) */
  world: () => { band: string; hour: number; weather: string; prev: string; date: string; traces: Record<string, number> };
  /** 검증용 강제(시각·날씨·날) — null이면 실제로 복귀 */
  forceWorld: (f: WorldCtx["force"] | null) => void;
  /** 바이옴 이동(감상 모드에서만 초원 밖으로) — 방향 또는 키. 세계 장면이 아니면 false. */
  goTo: (target: BiomeKey | Dir) => boolean;
  biome: () => BiomeKey;
  exits: () => Record<Dir, BiomeKey | null>;
  /** 정지 화면(생동감 OFF) 상태에서 한 장 다시 그린다 — 이동 직후 등. */
  redraw: () => void;
};
declare global {
  interface Window {
    __vicAmbient?: AmbientDebug;
  }
}

export type SceneFactory = (seed: number) => Scene;

// 바탕이 아닌 것 — 여기 위에서의 누르기는 장면이 가로채지 않는다(달력 칸 선택·버튼이 우선).
const INTERACTIVE =
  "button,a,input,textarea,select,label,[role],[tabindex],[contenteditable],[data-export-surface]," +
  ".studio-day,.studio-calendar-panel,.event-editor-panel,.studio-topbar,.avatar-rail,.studio-left-panel," +
  ".bottom-float-row,.modal-backdrop,.kbd-hints,.public-day,.agenda-day,.m-head,.m-bottom";

export function isBackgroundTarget(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return true;
  return !t.closest(INTERACTIVE);
}

function readQuality(): Quality {
  const g = document.documentElement.getAttribute("data-gfx");
  return g === "soft" || g === "off" ? 0 : g === "lite" ? 1 : 2;
}
const readReduced = () => document.documentElement.hasAttribute("data-reduce-motion");
const readOff = () => document.documentElement.getAttribute("data-ambient") === "off";
// 일시정지(lib/ui/ambient-pause.ts): VOD 창·모달 백드롭 등 무거운 미디어 중엔 마지막 프레임을 둔 채 루프만 멈춘다.
const readPaused = () => document.documentElement.hasAttribute("data-ambient-pause");
// 집중 모드(편집·끌기 중, studio-shell.tsx) 또는 설정 '흐리게'(data-ambient="dim", 감상 모드 제외): 배경이 옅어져 있으니 프레임도
// 절반만 그린다 — 끌기 스프링·본문에 프레임을 양보한다.
const readDim = () => {
  const root = document.documentElement;
  if (root.hasAttribute("data-ambient-dim")) return true;
  return root.getAttribute("data-ambient") === "dim" && !root.hasAttribute("data-showcase");
};

// 여력 띠 — [하한, 상한, 고정값|null]. 고정값이 있으면 조절기가 손대지 않는다.
function loadBand(q: Quality): [number, number, number | null] {
  const pref = gfxPref();
  if (pref === "max") return [1, 1, 1];
  if (pref === "lite") return [0.3, 0.3, 0.3];
  if (q >= 2) return [0.12, 1, null];
  if (q === 1) return [0.08, 0.35, null];
  return [0.04, 0.12, null];
}
const EVAL_FRAMES = 90;
const LOAD_UP = 0.06;
const LOAD_DOWN = 0.15;

export function mountScene(canvas: HTMLCanvasElement, factory: SceneFactory, world: WorldCtx): () => void {
  const g = canvas.getContext("2d", { alpha: true });
  if (!g) return () => {};
  const p: Pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, down: false, inside: false, moved: false, ts: 0 };
  let q = readQuality();
  let [floor, cap, fixed] = loadBand(q);
  let load = fixed ?? (q >= 2 ? 0.5 : (floor + cap) / 2);
  let forced: number | null = null;
  // 세계 — 날·띠·날씨·흔적. 5초마다(300프레임) 다시 잰다(자정·띠 경계·마디 경계). 흔적은 날이 바뀔 때만 다시 조립.
  let worldForce: WorldCtx["force"] | null = world.force ?? null;
  let traceKey = "";
  const initialTime = worldTime(world.season, 12);
  const frame: Frame = {
    w: 0,
    h: 0,
    dpr: 1,
    t: 0,
    dt: 0,
    p,
    q,
    load,
    reduced: readReduced(),
    hot: null,
    dim: readDim(),
    date: { y: world.year, m: world.month, d: 1 },
    time: initialTime,
    weather: { now: "clear", prev: "clear", segment: 0 },
    traces: []
  };
  // 보고 있는 달에 쓸 '날' — 날씨 시드에만 쓴다(흔적은 달만 본다). 현재 달은 오늘, 과거 달은 말일, 미래 달은 1일.
  const viewDay = (y: number, m: number, today: { y: number; m: number; d: number }) => {
    if (y === today.y && m === today.m) return today.d;
    if (y < today.y || (y === today.y && m < today.m)) return new Date(Date.UTC(y, m, 0)).getUTCDate();
    return 1;
  };
  const refreshWorld = () => {
    const today = kstToday();
    const d = viewDay(world.year, world.month, today);
    frame.date = { y: world.year, m: world.month, d };
    frame.time = worldForce?.band ? worldTimeOfBand(world.season, worldForce.band) : worldTime(world.season, worldForce?.hour ?? kstHour());
    const hour = frame.time.hour;
    frame.weather = worldForce?.weather
      ? { now: worldForce.weather, prev: worldForce.weather, segment: hour < 13 ? 0 : 1 }
      : weatherAt(world.slug, world.year, world.month, d, hour);
    // 흔적은 **달만** 본다(2026-09-05 연대기 철거) — 날이 바뀌어도 다시 뽑지 않는다.
    const key = `${world.slug}:${world.year}-${world.month}`;
    if (key !== traceKey) {
      traceKey = key;
      frame.traces = monthTraces(world.slug, world.year, world.month);
    }
  };
  refreshWorld();
  const scene = factory((Date.now() % 100000) + 7);
  const dbg: AmbientDebug = {
    season: canvas.dataset.season ?? "",
    q,
    load,
    frames: 0,
    consumed: 0,
    running: false,
    scene: () => scene.debug?.() ?? {},
    forceLoad: (v) => {
      forced = v === null ? null : Math.max(0, Math.min(1, v));
      applyLoad();
    },
    hot: null,
    world: () => ({
      band: frame.time.band,
      hour: Math.round(frame.time.hour * 100) / 100,
      weather: frame.weather.now,
      prev: frame.weather.prev,
      date: `${frame.date.y}-${frame.date.m}-${frame.date.d}`,
      traces: frame.traces.reduce<Record<string, number>>((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {})
    }),
    forceWorld: (f) => {
      worldForce = f;
      traceKey = "";
      refreshWorld();
      if (!running) drawOnce();
    },
    goTo: (target) => {
      const ok = scene.nav?.go(target) ?? false;
      if (ok && !running) drawOnce();
      return ok;
    },
    biome: () => scene.nav?.at() ?? "meadow",
    exits: () => scene.nav?.exits() ?? { up: null, down: null, left: null, right: null },
    redraw: () => drawOnce()
  };
  window.__vicAmbient = dbg;
  let w = 0;
  let h = 0;
  let dpr = 1;
  // DPR은 마운트 때 한 번 정하고 바꾸지 않는다(2026-09-04 사용자: "달 바꾸면 배경이 한 번 그려지고 2초 뒤 다시 그려진다" —
  // 여력이 0.5→0.62로 오르며 DPR 1→1.5로 바뀌어 바탕을 다시 구운 것이 그 '재렌더'였다). LOD는 저해상 레이어·입자 수로만.
  const hiDpr = q >= 2;
  // CSS zoom 보정(편집실 ≥1700px은 .studio-shell zoom .9/.8): 캔버스 크기는 레이아웃 px(offsetWidth = 뷰포트/zoom)로
  // 잡고, 포인터의 화면 px는 zoom으로 나눠 캔버스 좌표로 옮긴다. 옛 innerWidth px는 줌 안에서 80%로 그려져 오른쪽·
  // 아래가 비었다(2026-09-04 사용자 스크린샷).
  let zoomF = 1;
  let rectL = 0;
  let rectT = 0;
  let raf = 0;
  let last = 0;
  let running = false;
  let skip = false;
  let dim = readDim();
  const gaps: number[] = [];

  const wantDpr = () => (q >= 2 && hiDpr ? Math.min(window.devicePixelRatio || 1, 1.5) : 1);
  // 핫 존 실측 — 달력 패널(편집실)·포스터 표면(시청자). 감상 모드에선 전부 바탕이라 null.
  const measureHot = () => {
    if (document.documentElement.hasAttribute("data-showcase")) {
      frame.hot = null;
      dbg.hot = null;
      return;
    }
    // 달력 패널 + rail/왼쪽 패널(편집실) 또는 포스터 표면(시청자)의 합집합 상자 — 소품이 그 안에서 태어나거나 서성이지 않게.
    const els = document.querySelectorAll(".studio-calendar-panel, .avatar-rail, .studio-left-panel, .poster-surface");
    let l = Infinity;
    let tp = Infinity;
    let rgt = -Infinity;
    let btm = -Infinity;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      l = Math.min(l, r.left);
      tp = Math.min(tp, r.top);
      rgt = Math.max(rgt, r.right);
      btm = Math.max(btm, r.bottom);
    });
    frame.hot = Number.isFinite(l) ? { x: (l - rectL) / zoomF, y: (tp - rectT) / zoomF, w: (rgt - l) / zoomF, h: (btm - tp) / zoomF } : null;
    dbg.hot = frame.hot;
  };
  const drawOnce = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    scene.draw(g, frame);
    // 대기 원근(3/4 시점, PLAN-004 §2.5) — 지평선 쪽이 옅어지는 안개 한 겹: 잔디·물·발자국·생물이 멀수록 흐려진다.
    drawDepthHaze(g, world.season, w, h);
    // 빛 톤(하루 여섯 띠) — 장면 위에 옅은 색 한 겹(새벽 회청·노을 회자·저녁·밤 청회). 낮은 없음. 캔버스는 DOM 뒤라 글자엔 안 닿는다.
    const tint = frame.time.tint;
    if (tint.alpha > 0) {
      g.fillStyle = `rgb(${tint.rgb} / ${tint.alpha})`;
      g.fillRect(0, 0, w, h);
    }
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = canvas.offsetWidth || window.innerWidth;
    h = canvas.offsetHeight || window.innerHeight;
    zoomF = rect.width > 0 && w > 0 ? rect.width / w : 1;
    if (!Number.isFinite(zoomF) || zoomF <= 0) zoomF = 1;
    rectL = rect.left;
    rectT = rect.top;
    dpr = wantDpr();
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    frame.w = w;
    frame.h = h;
    frame.dpr = dpr;
    frame.q = q;
    measureHot();
    scene.resize(frame);
    if (!running) drawOnce();
  };
  // 여력을 프레임에 반영. (DPR은 고정 — 위 주석.)
  const applyLoad = () => {
    const v = forced ?? load;
    frame.load = v;
    dbg.load = v;
  };
  const tick = (now: number) => {
    raf = 0;
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt < 0) dt = 0;
    // 자체 조절기 — 90프레임마다: 나쁘면(늦은 프레임 12%↑ 또는 평균 21ms↑) 여력 −0.15, 좋으면(3%↓·18.5ms↓) +0.06.
    gaps.push(dt);
    if (gaps.length >= EVAL_FRAMES) {
      let bad = 0;
      let sum = 0;
      for (const x of gaps) {
        if (x > 0.034) bad++;
        sum += x;
      }
      const badRatio = bad / gaps.length;
      const mean = (sum / gaps.length) * 1000;
      gaps.length = 0;
      if (fixed === null && forced === null) {
        if (badRatio > 0.12 || mean > 21) load = Math.max(floor, load - LOAD_DOWN);
        else if (badRatio < 0.03 && mean < 18.5) load = Math.min(cap, load + LOAD_UP);
        applyLoad();
      }
    }
    if (dt > 0.05) dt = 0.05;
    if (q === 0 || dim) {
      skip = !skip;
      if (skip) {
        raf = requestAnimationFrame(tick);
        return;
      }
      dt *= 2;
    }
    frame.t += dt;
    frame.dt = dt;
    if (dbg.frames % 120 === 60) measureHot(); // 달력이 스크롤·리플로우로 움직여도 2초 안에 따라간다
    if (dbg.frames % 300 === 150) refreshWorld(); // 띠·마디·자정 경계를 5초 안에 따라간다
    scene.step(frame);
    drawOnce();
    dbg.frames += 1;
    dbg.q = q;
    p.moved = false;
    // 포인터가 멈추면 속도는 빠르게 잦아든다(바람이 끊긴다).
    p.vx *= 0.7;
    p.vy *= 0.7;
    p.speed = Math.hypot(p.vx, p.vy);
    raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (running) return;
    running = true;
    dbg.running = true;
    last = performance.now();
    gaps.length = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    dbg.running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const reband = () => {
    [floor, cap, fixed] = loadBand(q);
    load = fixed ?? Math.min(cap, Math.max(floor, load));
    applyLoad();
  };
  const sync = () => {
    const nq = readQuality();
    frame.reduced = readReduced();
    const off = readOff();
    dim = readDim();
    frame.dim = dim;
    measureHot();
    if (nq !== q) {
      q = nq;
      reband();
      resize();
    }
    // CSS가 숨긴 상태(gfx=soft/off·모바일 폭·스위치 OFF·생동감 OFF)면 루프를 돌리지 않는다 — 안 보이는 그림에 CPU를 안 쓴다.
    const hiddenByCss = getComputedStyle(canvas).display === "none";
    // 숨겨졌다 다시 보이면(display none → block) 크기가 0에서 돌아온다 — 다시 잰다.
    if (!hiddenByCss && (canvas.offsetWidth !== w || canvas.offsetHeight !== h)) resize();
    const paused = readPaused();
    if (frame.reduced || off || document.hidden || hiddenByCss || paused) {
      stop();
      if (frame.reduced && !off && !hiddenByCss) drawOnce(); // 정지 화면 한 장(일시정지는 마지막 프레임 그대로)
    } else start();
  };
  const onResize = () => {
    resize();
    sync();
  };
  const onPref = () => {
    reband();
    sync();
  };

  const toCanvas = (e: PointerEvent): [number, number] => [(e.clientX - rectL) / zoomF, (e.clientY - rectT) / zoomF];
  const onMove = (e: PointerEvent) => {
    const dts = Math.max(4, e.timeStamp - p.ts) / 1000;
    const [cx, cy] = toCanvas(e);
    if (p.inside) {
      const ivx = Math.max(-4000, Math.min(4000, (cx - p.x) / dts));
      const ivy = Math.max(-4000, Math.min(4000, (cy - p.y) / dts));
      p.vx = p.vx * 0.45 + ivx * 0.55;
      p.vy = p.vy * 0.45 + ivy * 0.55;
    }
    p.x = cx;
    p.y = cy;
    p.ts = e.timeStamp;
    p.inside = true;
    p.moved = true;
    p.speed = Math.hypot(p.vx, p.vy);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    [p.x, p.y] = toCanvas(e);
    p.down = true;
    p.inside = true;
    if (!running) return;
    if (scene.pointerDown?.(frame, isBackgroundTarget(e.target))) {
      dbg.consumed += 1;
      // 장면이 눌림을 가져갔다(잎 집기·발자국·잔물결) — 브라우저의 텍스트 선택·드래그 시작을 막는다(2026-09-04 사용자:
      // "낙엽 끌면 바깥 글자가 드래그된다"). 끄는 동안 html[data-ambient-grab]로 user-select도 끈다(app/ambient.css).
      e.preventDefault();
      document.documentElement.setAttribute("data-ambient-grab", "1");
    }
  };
  const onUp = () => {
    document.documentElement.removeAttribute("data-ambient-grab");
    if (!p.down) return;
    p.down = false;
    scene.pointerUp?.(frame);
  };
  const onLeave = () => {
    p.inside = false;
    p.vx = 0;
    p.vy = 0;
    p.speed = 0;
  };

  applyLoad();
  resize();
  sync();
  window.addEventListener("resize", onResize);
  window.addEventListener("vic:gfx-pref", onPref);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { capture: true }); // passive 아님 — 소비하면 preventDefault
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", sync);
  const mo = new MutationObserver(sync);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-reduce-motion", "data-gfx", "data-ambient", "data-ambient-pause", "data-showcase", "data-ambient-dim"]
  });

  return () => {
    stop();
    document.documentElement.removeAttribute("data-ambient-grab");
    if (window.__vicAmbient === dbg) delete window.__vicAmbient;
    mo.disconnect();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("vic:gfx-pref", onPref);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown, { capture: true } as EventListenerOptions);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("visibilitychange", sync);
  };
}
