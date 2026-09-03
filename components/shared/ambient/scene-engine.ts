// 계절 장면 엔진(2026-09-04, ADR-0017 개정 2) — 봄·가을·겨울 캔버스 레이어의 공용 뼈대.
// 왜 캔버스인가: 낙엽 물리(충돌·바람·집기)·나비(회피·클릭)·눈 발자국처럼 **상호작용하는** 장면은 DOM/CSS
// 애니로는 못 만든다. 전체 화면 캔버스 하나 = 합성 레이어 하나, 매 프레임 스프라이트 drawImage 수십 개 —
// GPU 캔버스에선 물결(SVG 필터 합성)보다 싸다. 규칙: 필터/블러는 프레임마다 쓰지 않는다(스프라이트에 미리
// 굽는다), 바탕(풀밭·눈밭)은 리사이즈 때 한 번만 그린다, 탭이 숨거나 스위치가 꺼지면 루프를 멈춘다.
//
// 품질 단계 q: 2 최대(data-gfx 없음) · 1 가벼움(data-gfx="lite": 입자 절반, DPR 1) · 0 최소(스스로 내려온 경우:
// 30fps·최소 입자). 자체 조절기: 최근 120프레임 중 34ms 초과가 20%를 넘으면 한 단계 내린다(세션 한정 — 영구
// 판정은 lib/ui/gfx.ts). 생동감 있는 동작 OFF(data-reduce-motion)면 정지 화면 한 장만 그린다.
//
// 포인터: window에서 듣는다(캔버스는 z:-1·pointer-events:none). 이동 = 바람/회피(어디서든), 누르기 = 배경
// (버튼·칸·팝오버가 아닌 곳)에서만 '집기/도장', 단 나비처럼 장면이 직접 맞힌 건 어디서든 반응한다.

export type Quality = 0 | 1 | 2;

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
  reduced: boolean;
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
}

// 검증 훅 — Playwright가 장면 상태(입자 위치·소비된 클릭 수·품질·프레임)를 읽는다. 렌더 무영향.
type AmbientDebug = { season: string; q: Quality; frames: number; consumed: number; running: boolean; scene: () => Record<string, unknown> };
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
  return g === "soft" ? 0 : g === "lite" ? 1 : 2;
}
const readReduced = () => document.documentElement.hasAttribute("data-reduce-motion");
const readOff = () => document.documentElement.getAttribute("data-ambient") === "off";

export function mountScene(canvas: HTMLCanvasElement, factory: SceneFactory): () => void {
  const g = canvas.getContext("2d", { alpha: true });
  if (!g) return () => {};
  const p: Pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, down: false, inside: false, moved: false, ts: 0 };
  let q = readQuality();
  const frame: Frame = { w: 0, h: 0, dpr: 1, t: 0, dt: 0, p, q, reduced: readReduced() };
  const scene = factory((Date.now() % 100000) + 7);
  const dbg: AmbientDebug = {
    season: canvas.dataset.season ?? "",
    q,
    frames: 0,
    consumed: 0,
    running: false,
    scene: () => scene.debug?.() ?? {}
  };
  window.__vicAmbient = dbg;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let running = false;
  let skip = false;
  const gaps: number[] = [];

  const drawOnce = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    scene.draw(g, frame);
  };
  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    dpr = q >= 2 ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    frame.w = w;
    frame.h = h;
    frame.dpr = dpr;
    frame.q = q;
    scene.resize(frame);
    if (!running) drawOnce();
  };
  const tick = (now: number) => {
    raf = 0;
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    // 자체 조절기 — 프레임이 계속 늦으면 한 단계 내린다(입자 수 재조정은 scene.resize).
    gaps.push(dt);
    if (gaps.length >= 120) {
      const bad = gaps.filter((x) => x > 0.034).length / gaps.length;
      gaps.length = 0;
      if (bad > 0.2 && q > 0) {
        q = (q - 1) as Quality;
        resize();
      }
    }
    if (q === 0) {
      skip = !skip;
      if (skip) {
        raf = requestAnimationFrame(tick);
        return;
      }
      dt *= 2;
    }
    frame.t += dt;
    frame.dt = dt;
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
  const sync = () => {
    const nq = readQuality();
    frame.reduced = readReduced();
    const off = readOff();
    if (nq !== q) {
      q = nq;
      resize();
    }
    // CSS가 숨긴 상태(gfx=soft·모바일 폭·스위치 OFF·생동감 OFF)면 루프를 돌리지 않는다 — 안 보이는 그림에 CPU를 안 쓴다.
    const hiddenByCss = getComputedStyle(canvas).display === "none";
    if (frame.reduced || off || document.hidden || hiddenByCss) {
      stop();
      if (frame.reduced && !off && !hiddenByCss) drawOnce(); // 정지 화면 한 장
    } else start();
  };
  const onResize = () => {
    resize();
    sync();
  };

  const onMove = (e: PointerEvent) => {
    const dts = Math.max(4, e.timeStamp - p.ts) / 1000;
    if (p.inside) {
      const ivx = Math.max(-4000, Math.min(4000, (e.clientX - p.x) / dts));
      const ivy = Math.max(-4000, Math.min(4000, (e.clientY - p.y) / dts));
      p.vx = p.vx * 0.45 + ivx * 0.55;
      p.vy = p.vy * 0.45 + ivy * 0.55;
    }
    p.x = e.clientX;
    p.y = e.clientY;
    p.ts = e.timeStamp;
    p.inside = true;
    p.moved = true;
    p.speed = Math.hypot(p.vx, p.vy);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    p.x = e.clientX;
    p.y = e.clientY;
    p.down = true;
    p.inside = true;
    if (!running) return;
    if (scene.pointerDown?.(frame, isBackgroundTarget(e.target))) dbg.consumed += 1;
  };
  const onUp = () => {
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

  resize();
  sync();
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { capture: true, passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", sync);
  const mo = new MutationObserver(sync);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion", "data-gfx", "data-ambient"] });

  return () => {
    stop();
    if (window.__vicAmbient === dbg) delete window.__vicAmbient;
    mo.disconnect();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown, { capture: true } as EventListenerOptions);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("visibilitychange", sync);
  };
}
