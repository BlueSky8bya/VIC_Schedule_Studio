// 세계 장면(2026-09-04, PLAN-20260904-004 §5·§6) — 엔진에는 여느 Scene처럼 끼워지고, 안에서 바이옴 장면 열한 개를 **필요할 때만** 만들어 캐시한다.
// 카메라는 화면 단위로 미끄러진다(620ms ease-out-quint, 오버슈트 없음): 이동 중엔 출발·도착 두 장면을 translate로 한 캔버스에 함께 그리고,
// 평소엔 활성 장면 하나만 step·draw 한다(비용 = 지금과 같음). 감상 모드가 아니면(달력 뒤) 카메라는 늘 초원 — 감상을 나가면 초원으로 스냅.
// 입력(방향키·WASD·스와이프·쉐브론·미니맵)은 React(showcase.tsx ShowcaseNav)가 받아 `window.__vicAmbient.goTo()`로 넣고, 도착·튕김은
// `vic:biome` / `vic:biome-bounce` 이벤트로 알린다.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Frame, Scene, SceneFactory } from "@/components/shared/ambient/scene-engine";
import { BIOMES, biomeAt, isBiomeKey, neighbor, screenDelta, type BiomeKey, type Dir } from "./biomes";
import { BIOME_LOADERS } from "@/components/shared/ambient/scenes/biome-loaders";

export const PAN_DUR = 0.62;
const easeOutQuint = (p: number) => 1 - Math.pow(1 - p, 5);
const DIRS: readonly Dir[] = ["up", "down", "left", "right"];

export type WorldNav = {
  go(target: BiomeKey | Dir): boolean;
  at(): BiomeKey;
  moving(): boolean;
  /** 이웃이 있는 방향(쉐브론 표시용) */
  exits(): Record<Dir, BiomeKey | null>;
};

type Loaded = { scene: Scene; sizeKey: string };

/** opts.pin = 감상 속성이 없어도 시작 바이옴에 머물고 이동도 허용한다 — 검증 fixture 전용(PLAN-20260905-005 P0). 실제 화면은 pin 없음. */
export function createWorld(season: SeasonKey, initial: BiomeKey = "meadow", opts: { pin?: boolean } = {}): SceneFactory {
  const pinned = !!opts.pin;
  return (seed: number): Scene & { nav: WorldNav } => {
    const scenes = new Map<BiomeKey, Loaded>();
    const pending = new Map<BiomeKey, Promise<void>>();
    let cur: BiomeKey = initial;
    let lastCoastX = 0;
    let lastFrame: Frame | null = null;
    let trans: { from: BiomeKey; to: BiomeKey; dx: number; dy: number; t0: number; dur: number } | null = null;
    let queued: BiomeKey | null = null;
    const visited = new Set<BiomeKey>([initial]);

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
            const scene = factory(seed + key.length * 131 + key.charCodeAt(0) * 17);
            const entry: Loaded = { scene, sizeKey: "" };
            scenes.set(key, entry);
            if (lastFrame) {
              scene.resize(lastFrame);
              entry.sizeKey = sizeKeyOf(lastFrame);
            }
          })
          .finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    };
    const fit = (entry: Loaded, f: Frame) => {
      const k = sizeKeyOf(f);
      if (entry.sizeKey !== k) {
        entry.scene.resize(f);
        entry.sizeKey = k;
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
      trans = { from: cur, to, dx, dy, t0: f.t, dur };
      emit("vic:biome-depart", { from: cur, to, dx, dy, dur });
      if (dur === 0) finish(f);
    };
    const finish = (f: Frame) => {
      if (!trans) return;
      const from = trans.from;
      cur = trans.to;
      trans = null;
      const first = !visited.has(cur);
      visited.add(cur);
      emit("vic:biome", { biome: cur, from, first, season, band: f.time.band });
    };
    const go = (target: BiomeKey | Dir): boolean => {
      if (trans || !lastFrame) return false;
      if (!pinned && !showcase() && target !== "meadow") return false; // 달력 뒤에선 초원 고정(fixture pin은 예외)
      const to = resolve(target);
      if (!to || to === cur) {
        if (!to) emit("vic:biome-bounce", { from: cur, dir: target });
        return false;
      }
      if (scenes.has(to)) {
        fit(scenes.get(to)!, lastFrame);
        begin(to, lastFrame);
      } else {
        queued = to;
        void ensure(to);
      }
      return true;
    };
    const nav: WorldNav = {
      go,
      at: () => cur,
      moving: () => !!trans,
      exits: () => ({
        up: neighbor(cur, "up", lastCoastX),
        down: neighbor(cur, "down", lastCoastX),
        left: neighbor(cur, "left", lastCoastX),
        right: neighbor(cur, "right", lastCoastX)
      })
    };

    void ensure(initial);

    return {
      nav,
      resize(f) {
        lastFrame = f;
        for (const entry of scenes.values()) fit(entry, f);
      },
      step(f) {
        lastFrame = f;
        // 감상 모드가 아니면 초원 고정 — 나가는 순간 스냅(달력 뒤에 다른 바이옴이 남지 않게).
        if (!pinned && !showcase() && (cur !== "meadow" || trans)) {
          trans = null;
          queued = null;
          cur = "meadow";
          void ensure("meadow");
          emit("vic:biome", { biome: cur, from: cur, first: false, season, band: f.time.band, snap: true });
        }
        if (queued && !trans) {
          const q = queued;
          if (scenes.has(q)) {
            queued = null;
            fit(scenes.get(q)!, f);
            begin(q, f);
          } else if (!pending.has(q)) queued = null; // 로드 실패
        }
        const active = scenes.get(cur);
        if (active) {
          fit(active, f);
          active.scene.step(f);
        }
        if (trans) {
          const to = scenes.get(trans.to);
          if (to) to.scene.step(f);
          if (f.t - trans.t0 >= trans.dur) finish(f);
        }
      },
      draw(g, f) {
        const active = scenes.get(cur);
        if (!trans) {
          active?.scene.draw(g, f);
          return;
        }
        const p = trans.dur > 0 ? easeOutQuint(Math.min(1, (f.t - trans.t0) / trans.dur)) : 1;
        const ox = -trans.dx * p * f.w;
        const oy = -trans.dy * p * f.h;
        const from = scenes.get(trans.from);
        const to = scenes.get(trans.to);
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
        const draw = (entry: Loaded | undefined, tx: number, ty: number) => {
          if (!entry) return;
          g.save();
          g.beginPath();
          g.rect(tx, ty, f.w, f.h);
          g.clip();
          g.translate(tx, ty);
          entry.scene.draw(g, f);
          g.restore();
        };
        if (trans.dy !== 0) {
          // 세로 이동은 "가까운 땅 ↔ 먼 하늘"이 맞붙어 620ms 동안 어두운 모서리와 옅은 지평선이 붙어 미끄러진다.
          // 가로는 좌우 가장자리가 서로 닮아 그대로 밀어도 되지만, 세로는 겹쳐 넘긴다(crossfade, 2026-09-04 검토 3차).
          // 다만 **움직임은 남긴다** — 순수 crossfade는 "넘어가는 중"이 안 느껴진다(2026-09-04 소유자) → 22%만 민다.
          const slide = f.h * 0.22;
          g.save();
          g.globalAlpha *= 1 - p;
          draw(from, 0, -trans.dy * p * slide);
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
        return scenes.get(cur)?.scene.pointerDown?.(f, onBackground) ?? false;
      },
      pointerUp(f) {
        if (trans) return;
        scenes.get(cur)?.scene.pointerUp?.(f);
      },
      ownsWeather(wx) {
        return scenes.get(cur)?.scene.ownsWeather?.(wx) ?? false;
      },
      // 닫힌 방(깊은 바다)은 **멈췄을 때만** 봉인다 — 카메라가 두 장면을 걸치고 있는 동안에
      // 조명 패스를 끄면 이웃 바이옴 절반이 시간대를 잃는다(잠수하는 620ms는 그대로 밝기가 죽어간다).
      sealed() {
        if (trans) return false;
        return scenes.get(cur)?.scene.sealed?.() ?? false;
      },
      debug() {
        const active = scenes.get(cur);
        return {
          ...(active?.scene.debug?.() ?? {}),
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
