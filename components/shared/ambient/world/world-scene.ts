import {drawFogField} from "./fog";
// 세계 장면(2026-09-04, PLAN-20260904-004 §5·§6) — 엔진에는 여느 Scene처럼 끼워지고, 안에서 바이옴 장면 열한 개를 **필요할 때만** 만들어 캐시한다.
// 카메라는 화면 단위로 미끄러진다(620ms ease-out-quint, 오버슈트 없음): 이동 중엔 출발·도착 두 장면을 translate로 한 캔버스에 함께 그리고,
// 평소엔 활성 장면 하나만 step·draw 한다(비용 = 지금과 같음). 감상 모드가 아니면(달력 뒤) 카메라는 늘 초원 — 감상을 나가면 초원으로 스냅.
// 입력(방향키·WASD·스와이프·쉐브론·미니맵)은 React(showcase.tsx ShowcaseNav)가 받아 `window.__vicAmbient.goTo()`로 넣고, 도착·튕김은
// `vic:biome` / `vic:biome-bounce` 이벤트로 알린다.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Frame, Scene, SceneFactory } from "@/components/shared/ambient/scene-engine";
import { createDepthPointer, depthOffsets, type DepthPoint } from "./depth";
import { surfaceLocalPoint, withDepthScene, withDepthLayer, bakeDepthFrame, depthCacheStats, clearDepthCache, retainDepthOwners } from "./depth-render";
import { createParticles } from "./particles";
import { drawDepthHaze, drawLightPass, HORIZON_V, HILL_HORIZON_V, SPRING_MEADOW_HORIZON_V, withViewHorizon } from "./view";
import { BIOMES, biomeAt, isBiomeKey, neighbor, screenDelta, type BiomeKey, type Dir } from "./biomes";
import { BIOME_LOADERS } from "@/components/shared/ambient/scenes/biome-loaders";

export const PAN_DUR = 0.62;
const easeOutQuint = (p: number) => 1 - Math.pow(1 - p, 5);
const DIRS: readonly Dir[] = ["up", "down", "left", "right"];

/** Continuous travel projection: sky stays fixed, near terrain passes faster.
 * The overscan is geometric, so no repeated edge pixels or transparent wedges. */
export function travelStrip(v: number, phase: number, dx: number, dy: number, horizon: number) {
  const depth = Math.max(0, Math.min(1, (v - horizon) / (1 - horizon)));
  const near = depth * depth * (3 - 2 * depth);
  const shiftX = Math.sign(dx) * phase * .14 * near;
  const shiftY = Math.sign(dy) * phase * .075 * near;
  // Scale only during travel; source and destination are exact at their endpoints.
  const scale = 1 + Math.abs(phase) * .34 * near;
  return { x: (1 - scale) / 2 + shiftX, y: v + Math.abs(phase) * .08 * near + shiftY, scale };
}

export type WorldNav = {
  go(target: BiomeKey | Dir): boolean;
  at(): BiomeKey;
  moving(): boolean;
  /** 이웃이 있는 방향(쉐브론 표시용) */
  exits(): Record<Dir, BiomeKey | null>;
};

type Loaded = { key: BiomeKey; scene: Scene; sizeKey: string; particles: ReturnType<typeof createParticles>; front?: ReturnType<typeof bakeDepthFrame> };

/** opts.pin = 감상 속성이 없어도 시작 바이옴에 머물고 이동도 허용한다 — 검증 fixture 전용(PLAN-20260905-005 P0). 실제 화면은 pin 없음. */
export function createWorld(season: SeasonKey, initial: BiomeKey = "meadow", opts: { pin?: boolean } = {}): SceneFactory {
  const pinned = !!opts.pin;
  return (seed: number): Scene & { nav: WorldNav } => {
    const scenes = new Map<BiomeKey, Loaded>();
    const horizonOf = (key: BiomeKey) => key === "meadow" ? SPRING_MEADOW_HORIZON_V : key === "hill" || key==='pond'||key==='valley'||key==='forest'||key==='mountain' ? HILL_HORIZON_V : HORIZON_V;
    const inView = <T,>(key: BiomeKey, run: () => T): T => withViewHorizon(horizonOf(key), run);
    const skyHorizonOf=(key:BiomeKey,f:Frame)=>scenes.get(key)?.scene.skyHorizon?.(f.w,f.h)??f.h*horizonOf(key);
    const pending = new Map<BiomeKey, Promise<void>>();
    let cur: BiomeKey = initial;
    let lastCoastX = 0;
    let lastFrame: Frame | null = null;
    let trans: { from: BiomeKey; to: BiomeKey; dx: number; dy: number; t0: number; dur: number } | null = null;
    let queued: BiomeKey | null = null;
    const visited = new Set<BiomeKey>([initial]);
    const pointer = createDepthPointer();
    let panPointer: DepthPoint = { x: 0, y: 0 };
    let disposed = false;
    let panCanvas: HTMLCanvasElement | undefined;
    const releasePanel = () => { if (panCanvas) panCanvas.width = panCanvas.height = 1; panCanvas = undefined; };
    const offsetsOf = (f: Frame) => {
      const active = !f.reduced && showcase() && f.depthTier !== "still";
      const gain = trans ? Math.pow(1 - Math.min(1, Math.max(0, (f.t - trans.t0) / trans.dur)), 5) : 1;
      return depthOffsets(trans ? panPointer : pointer.value(f.t), f.w, f.dpr, active ? f.depthTier ?? (f.q < 2 ? "lite" : "full") : "still", Number.isFinite(gain) ? gain : 0);
    };
    const localFrame = (f: Frame, key:BiomeKey=cur): Frame => {
      const off = offsetsOf(f).ground;
      if(key==='meadow'||key==='hill'||key==='pond'||key==='valley'||key==='forest'||key==='mountain'){
        const scene=scenes.get(key)?.scene,tier=f.depthTier??'full';
        const motion=scene?.surfaceMotion?(x:number,y:number)=>scene.surfaceMotion!(x,y,tier)??0:undefined;
        const local=(x:number,y:number)=>surfaceLocalPoint(x,y,off,f.h*horizonOf(key),f.h,motion);
        const p=local(f.p.x,f.p.y),a=f.hot?local(f.hot.x,f.hot.y):null,b=f.hot?local(f.hot.x+f.hot.w,f.hot.y+f.hot.h):null;
        return {...f,surfaceOffset:off,p:{...f.p,...p},hot:f.hot&&a&&b?{...f.hot,x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y}:null};
      }
      return { ...f, p: { ...f.p, x: f.p.x - off.x, y: f.p.y - off.y }, hot: f.hot ? { ...f.hot, x: f.hot.x - off.x, y: f.hot.y - off.y } : null };
    };

    const sizeKeyOf = (f: Frame) => `${f.w}x${f.h}@${f.dpr}/${f.q}`;
    const emit = (name: string, detail: Record<string, unknown>) => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
    };
    const ensure = (key: BiomeKey): Promise<void> => {
      if (scenes.has(key)) return Promise.resolve();
      let p = pending.get(key);
      if (!p) {
        p = BIOME_LOADERS[key](season)
          .then((factory) => {
            if (disposed) return;
            const scene = inView(key, () => factory(seed + key.length * 131 + key.charCodeAt(0) * 17));
            const entry: Loaded = { key, scene, sizeKey: "", particles: createParticles(seed) };
            scenes.set(key, entry);
            if (lastFrame) {
              fit(entry, lastFrame);
            }
          })
          .catch(() => {
            if (!disposed && queued === key) {
              queued = null;
              emit("vic:biome-loading", { to:key, state:"error" });
            }
          })
          .finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    };
    const fit = (entry: Loaded, f: Frame) => {
      const k = sizeKeyOf(f);
      if (entry.sizeKey !== k || !entry.front) {
        if (entry.sizeKey !== k) inView(entry.key, () => entry.scene.resize(f));
        entry.sizeKey = k;
        entry.front = bakeDepthFrame(f.w, f.h, entry.key, season, seed);
      }
    };
    const showcase = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-showcase");
    const resolve = (target: BiomeKey | Dir): BiomeKey | null => {
      if (isBiomeKey(target)) return target;
      if ((DIRS as readonly string[]).includes(target)) return neighbor(cur, target, lastCoastX);
      return null;
    };
    const begin = (to: BiomeKey, f: Frame) => {
      const [dx, dy] = screenDelta(cur, to, lastCoastX);
      if (BIOMES[cur].gy === 1) lastCoastX = BIOMES[cur].gx; // 해안에서 바다로 내려가면 돌아올 해안을 기억
      if (BIOMES[to].gy === 1) lastCoastX = BIOMES[to].gx;
      const dur = f.reduced ? 0 : PAN_DUR;
      panPointer = pointer.value(f.t);
      trans = { from: cur, to, dx, dy, t0: f.t, dur };
      emit("vic:biome-depart", { from: cur, to, dx, dy, dur });
      if (dur === 0) finish(f);
    };
    const finish = (f: Frame) => {
      if (!trans) return;
      const from = trans.from;
      cur = trans.to;
      trans = null;
      releasePanel();
      retainDepthOwners([scenes.get(cur)!]);
      for (const entry of scenes.values()) if (entry.key !== cur && entry.front) {
        entry.front.c.width = entry.front.c.height = 1;
        entry.front = undefined;
      }
      pointer.reset(f.t);
      pointer.aim(f.t, f.p, f.w, f.h);
      const first = !visited.has(cur);
      visited.add(cur);
      emit("vic:biome", { biome: cur, from, first, season, band: f.time.band });
    };
    const go = (target: BiomeKey | Dir): boolean => {
      if (trans || queued || !lastFrame) return false;
      if (!pinned && !showcase() && target !== "meadow") return false; // 달력 뒤에선 초원 고정(fixture pin은 예외)
      const to = resolve(target);
      if (!to || to === cur) {
        if (!to) emit("vic:biome-bounce", { from: cur, dir: target });
        return false;
      }
      if (scenes.has(to)) {
        const target = scenes.get(to)!;
        fit(target, lastFrame);
        if (target.scene.ready?.() ?? true) begin(to, lastFrame);
        else { queued = to; emit("vic:biome-loading", {to,state:"loading"}); }
      } else {
        queued = to;
        emit("vic:biome-loading", {to,state:"loading"});
        void ensure(to);
      }
      return true;
    };
    const nav: WorldNav = {
      go,
      at: () => cur,
      moving: () => !!trans || !!queued,
      exits: () => ({
        up: neighbor(cur, "up", lastCoastX),
        down: neighbor(cur, "down", lastCoastX),
        left: neighbor(cur, "left", lastCoastX),
        right: neighbor(cur, "right", lastCoastX)
      })
    };

    const stepEntry = (entry: Loaded, f: Frame) => inView(entry.key, () => {
      const lf = localFrame(f,entry.key);
      entry.particles.step(f.dt, f.w, f.h, f.weather.now, f.light, f.load, f.q < 2 || f.depthTier === "lite", entry.scene.ownsWeather?.(f.weather.now) ?? false);
      entry.scene.step(lf);
    });
    const renderEntry = (entry: Loaded | undefined, g: CanvasRenderingContext2D, f: Frame) => {
      if (!entry) return;
      const lf = localFrame({...f,solarHorizon:f.solarHorizon??skyHorizonOf(entry.key,f)},entry.key);
      inView(entry.key, () => withDepthScene(g, offsetsOf(f), () => {
        entry.scene.draw(g, lf);
        if (entry.scene.sealed?.()) {
          if (entry.front) withDepthLayer(g, "frame", () => g.drawImage(entry.front!.c, -32, entry.front!.y));
          return;
        }
        if (entry.scene.splitHaze?.()) {
          drawDepthHaze(g, season, f.w, f.h, f.light);
          entry.scene.drawAbove?.(g, lf);
          entry.particles.draw(g, f.w, f.h, season, f.weather.now, f.light, f.t);
        } else {
          entry.particles.draw(g, f.w, f.h, season, f.weather.now, f.light, f.t);
          drawDepthHaze(g, season, f.w, f.h, f.light);
        }
        if (!entry.scene.drawForeground?.(g, lf) && entry.front) withDepthLayer(g, "frame", () => g.drawImage(entry.front!.c, -32, entry.front!.y));
        const rootFog=entry.scene.fogBeforeAirborne?.()??false;
        if(rootFog)drawFogField(g,f.w,f.h,f.light.groundFog,f.light.hazeRgb||"228 232 234",null,"forest");
        entry.scene.drawAirborne?.(g, lf);
        drawLightPass(g, f.w, f.h, f.light, entry.scene.fogFloor ? x => entry.scene.fogFloor!(x, lf) : null, entry.scene.fogFloorKey?.(lf) ?? "", rootFog);
      }, f.depthTier ?? "full", entry));
    };
    void ensure(initial);

    return {
      nav,
      composed: true,
      dispose() { disposed = true; if(queued)emit("vic:biome-loading",{state:"idle"}); releasePanel(); clearDepthCache(); for (const e of scenes.values()) e.scene.dispose?.(); scenes.clear(); },
      resize(f) {
        lastFrame = f;
        for (const entry of scenes.values()) if (entry.key === cur || entry.key === trans?.to) fit(entry, f);
      },
      step(f) {
        lastFrame = f;
        if (f.reduced || !showcase() || f.depthTier === "still") pointer.reset(f.t);
        else if (!trans) pointer.aim(f.t - f.dt, f.p, f.w, f.h);
        // 감상 모드가 아니면 초원 고정 — 나가는 순간 스냅(달력 뒤에 다른 바이옴이 남지 않게).
        if (!pinned && !showcase() && (cur !== "meadow" || trans || queued)) {
          trans = null;
          releasePanel();
          retainDepthOwners(scenes.has("meadow") ? [scenes.get("meadow")!] : []);
          queued = null;
          cur = "meadow";
          void ensure("meadow");
          emit("vic:biome", { biome: cur, from: cur, first: false, season, band: f.time.band, snap: true });
        }
        if (queued && !trans) {
          const q = queued;
          if (scenes.has(q)) {
            const target = scenes.get(q)!;
            fit(target, f);
            // Warm late-arriving art without advancing its simulation offscreen.
            inView(q, () => target.scene.step({ ...localFrame(f, q), dt: 0 }));
            if (target.scene.ready?.() ?? true) {
              queued = null;
              begin(q, f);
            }
          } else if (!pending.has(q)) queued = null; // 로드 실패
        }
        const active = scenes.get(cur);
        if (active) {
          fit(active, f);
          stepEntry(active, f);
        }
        if (trans) {
          const to = scenes.get(trans.to);
          if (to) stepEntry(to, f);
          if (f.t - trans.t0 >= trans.dur) finish(f);
        }
      },
      draw(g, f) {
        const active = scenes.get(cur);
        if (!trans) {
          renderEntry(active, g, f);
          return;
        }
        const p = trans.dur > 0 ? easeOutQuint(Math.min(1, (f.t - trans.t0) / trans.dur)) : 1;
        const ox = Math.round(-trans.dx * p * f.w * f.dpr) / f.dpr;
        const oy = Math.round(-trans.dy * p * f.h * f.dpr) / f.dpr;
        const from = scenes.get(trans.from);
        const to = scenes.get(trans.to);
        // Continuous travel joins the two delivered terrain/sky contracts.
        // Other biome pairs retain their existing directional panel transition
        // until their new background and celestial contracts are delivered.
        if ([trans.from,trans.to].every(key=>key==='meadow'||key==='hill'||key==='pond'||key==='valley'||key==='forest'||key==='mountain')) {
          // Render complete worlds (including light) once each. Reproject their
          // rows with one continuous depth curve instead of sliding two cards.
          // The departing world is opaque underneath; only the arrival fades.
          const scale = Math.min(f.dpr, Math.sqrt(12 * 1024 * 1024 / (4 * f.w * f.h)) * .99);
          const pw = Math.max(1, Math.floor(f.w * scale)), ph = Math.max(1, Math.floor(f.h * scale));
          panCanvas ??= document.createElement("canvas");
          if (panCanvas.width !== pw || panCanvas.height !== ph) { panCanvas.width = pw; panCanvas.height = ph; }
          const pg = panCanvas.getContext("2d")!;
          const solarHorizon = skyHorizonOf(trans.from,f)*(1-p)+skyHorizonOf(trans.to,f)*p;
          const drawTravel = (entry: Loaded | undefined, phase: number, opacity: number) => {
            if (!entry || !trans || !panCanvas) return;
            pg.setTransform(pw / f.w, 0, 0, ph / f.h, 0, 0);
            pg.globalAlpha = 1; pg.globalCompositeOperation = "source-over";
            pg.clearRect(0, 0, f.w, f.h);
            renderEntry(entry, pg, { ...f, solarHorizon });
            g.save();
            g.beginPath(); g.rect(0, 0, f.w, f.h); g.clip();
            g.globalAlpha *= opacity;
            g.imageSmoothingEnabled = true;
            const bands = f.depthTier === "lite" || f.q < 2 ? 32 : 72;
            // Both panels share a sky projection; keep that entire region
            // stationary, including sky visible through the hill saddles.
            const hz = Math.max(skyHorizonOf(trans.from,f),skyHorizonOf(trans.to,f))/f.h;
            // One untouched sky span keeps sun/moon/stars at the shared position.
            const split = Math.round(hz * f.h * f.dpr) / (f.h * f.dpr);
            g.drawImage(panCanvas, 0, 0, pw, split * ph, 0, 0, f.w, split * f.h);
            for (let i = 0; i < bands; i++) {
              const v0 = split + (1 - split) * i / bands;
              const v1 = split + (1 - split) * (i + 1) / bands;
              const a = travelStrip(v0, phase, trans.dx, trans.dy, split);
              const b = travelStrip(v1, phase, trans.dx, trans.dy, split);
              const middle = travelStrip((v0 + v1) / 2, phase, trans.dx, trans.dy, split);
              // Adjacent rows share rounded device boundaries: no dark overlap
              // and no transparent hairline in night scenes.
              const y0 = Math.round(a.y * f.h * f.dpr) / f.dpr;
              const y1 = Math.round(b.y * f.h * f.dpr) / f.dpr;
              g.drawImage(panCanvas, 0, v0 * ph, pw, (v1 - v0) * ph,
                middle.x * f.w, y0, middle.scale * f.w, y1 - y0);
            }
            g.restore();
          };
          drawTravel(from, -p, 1);
          drawTravel(to, 1 - p, p);
          return;
        }
        // 이동 방향 앞머리의 옅은 빛 띠 + 뒤쪽의 옅은 그늘 — "지금 그쪽으로 가고 있다"를 몸으로 알려 준다.
        const sweep = (gg: CanvasRenderingContext2D, ff: Frame, prog: number) => {
          if (!trans) return;
          const punch = Math.sin(Math.PI * Math.min(1, prog / 0.85)); // 가운데서 가장 세다
          if (punch < 0.02) return;
          const horiz = trans.dx !== 0;
          const sgn = horiz ? trans.dx : trans.dy;
          const span = (horiz ? ff.w : ff.h) * 0.34;
          const lead = horiz ? (sgn > 0 ? ff.w : 0) : sgn > 0 ? ff.h : 0;
          const gd = horiz
            ? gg.createLinearGradient(lead - sgn * span, 0, lead, 0)
            : gg.createLinearGradient(0, lead - sgn * span, 0, lead);
          gd.addColorStop(0, "rgb(255 255 255 / 0)");
          gd.addColorStop(1, `rgb(255 255 255 / ${0.16 * punch})`);
          gg.save();
          gg.fillStyle = gd;
          gg.fillRect(0, 0, ff.w, ff.h);
          const tail = horiz ? (sgn > 0 ? 0 : ff.w) : sgn > 0 ? 0 : ff.h;
          const gd2 = horiz
            ? gg.createLinearGradient(tail, 0, tail + sgn * span * 0.8, 0)
            : gg.createLinearGradient(0, tail, 0, tail + sgn * span * 0.8);
          gd2.addColorStop(0, `rgb(40 52 70 / ${0.1 * punch})`);
          gd2.addColorStop(1, "rgb(40 52 70 / 0)");
          gg.fillStyle = gd2;
          gg.fillRect(0, 0, ff.w, ff.h);
          gg.restore();
        };
        const draw = (entry: Loaded | undefined, tx: number, ty: number, backing = false) => {
          if (!entry) return;
          if (trans?.dy) {
            // A complete panel is faded exactly once. Inner scenes may set absolute
            // alpha or multiply blends, which must not escape the camera crossfade.
            const scale = Math.min(f.dpr, Math.sqrt(12 * 1024 * 1024 / (4 * f.w * f.h)) * .99);
            const pw = Math.max(1, Math.floor(f.w * scale)), ph = Math.max(1, Math.floor(f.h * scale));
            panCanvas ??= document.createElement("canvas");
            if (panCanvas.width !== pw || panCanvas.height !== ph) { panCanvas.width = pw; panCanvas.height = ph; }
            const pg = panCanvas.getContext("2d")!;
            pg.setTransform(pw / f.w, 0, 0, ph / f.h, 0, 0);
            pg.globalAlpha = 1; pg.globalCompositeOperation = "source-over";
            pg.clearRect(0, 0, f.w, f.h);
            renderEntry(entry, pg, f);
            if (backing) {
              // Keep the departing world behind both moving panels; two source-over
              // alpha weights alone would expose the page through their crossfade.
              g.save(); g.globalAlpha = 1;
              g.drawImage(panCanvas, 0, 0, f.w, f.h);
              g.restore();
            }
          }
          g.save();
          g.beginPath(); g.rect(tx, ty, f.w, f.h); g.clip(); g.translate(tx, ty);
          if (trans?.dy && panCanvas) g.drawImage(panCanvas, 0, 0, f.w, f.h);
          else renderEntry(entry, g, f);
          g.restore();
        };
        if (trans.dy !== 0) {
          // 세로 이동은 "가까운 땅 ↔ 먼 하늘"이 맞붙어 620ms 동안 어두운 모서리와 옅은 지평선이 붙어 미끄러진다.
          // 가로는 좌우 가장자리가 서로 닮아 그대로 밀어도 되지만, 세로는 겹쳐 넘긴다(crossfade, 2026-09-04 검토 3차).
          // 다만 **움직임은 남긴다** — 순수 crossfade는 "넘어가는 중"이 안 느껴진다(2026-09-04 소유자) → 22%만 민다.
          const slide = f.h * 0.22;
          g.save();
          g.globalAlpha *= 1 - p;
          draw(from, 0, -trans.dy * p * slide, true);
          g.restore();
          g.save();
          g.globalAlpha *= p;
          draw(to, 0, trans.dy * (1 - p) * slide);
          g.restore();
          sweep(g, f, p);
          return;
        }
        draw(from, ox, oy);
        draw(to, ox + trans.dx * f.w, oy + trans.dy * f.h);
        sweep(g, f, p);
      },
      pointerDown(f, onBackground) {
        if (trans) return false;
        return inView(cur, () => scenes.get(cur)?.scene.pointerDown?.(localFrame(f), onBackground) ?? false);
      },
      pointerUp(f) {
        if (trans) return;
        inView(cur, () => scenes.get(cur)?.scene.pointerUp?.(localFrame(f)));
      },
      ownsWeather(wx) {
        return scenes.get(cur)?.scene.ownsWeather?.(wx) ?? false;
      },
      // 닫힌 방(깊은 바다)은 **멈췄을 때만** 봉인다 — 카메라가 두 장면을 걸치고 있는 동안에
      // 조명 패스를 끄면 이웃 바이옴 절반이 시간대를 잃는다(잠수하는 620ms는 그대로 밝기가 죽어간다).
      // 안개 밀도장의 지면선(라운드 12, 검토 C #2 — **라운드 11의 배선 결함**): 세계 장면이 이걸 위임하지 않아 언덕 능선·산 애추·
      // 계곡 유로·물가·해안선 다섯 지면선이 화면에 도달한 적이 없었다(숲 = 초원 α̂ 소수점까지 동일). 전이 중엔 평지(NaN).
      fogFloor(x, f) {
        if (trans) return Number.NaN;
        return scenes.get(cur)?.scene.fogFloor?.(x, f) ?? Number.NaN;
      },
      fogFloorKey(f) {
        return `${cur}:${trans ? "t" : scenes.get(cur)?.scene.fogFloorKey?.(f) ?? ""}`;
      },
      sealed() {
        if (trans) return false;
        return scenes.get(cur)?.scene.sealed?.() ?? false;
      },
      // 안개 뒤 층(2026-09-07, AMB-D3-04) — `fogFloor`와 같은 배선 결함을 되풀이하지 않게 여기서 위임한다.
      // 팬 중에는 false(위 draw가 클립 안에서 직접 그린다).
      splitHaze() {
        if (trans) return false;
        return scenes.get(cur)?.scene.splitHaze?.() ?? false;
      },
      drawAbove(g, f) {
        if (trans) return;
        scenes.get(cur)?.scene.drawAbove?.(g, f);
      },
      debug() {
        const active = scenes.get(cur);
        return {
            ...inView(cur, () => active?.scene.debug?.() ?? {}),
          depth: lastFrame ? offsetsOf(lastFrame) : null,
          depthCache: { ...depthCacheStats(), panelBytes: panCanvas ? panCanvas.width * panCanvas.height * 4 : 0, foregroundBytes: [...scenes.values()].reduce((n, e) => n + (e.front ? e.front.c.width * e.front.c.height * 4 : 0), 0) },
          weatherParticles: active?.particles.debug() ?? {},
          biome: cur,
          moving: !!trans,
          loaded: [...scenes.keys()],
          visited: [...visited],
          lastCoastX,
          grid: biomeAt(BIOMES[cur].gx, BIOMES[cur].gy)
        };
      }
    };
  };
}
