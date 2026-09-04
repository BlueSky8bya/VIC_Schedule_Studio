// 육지 바이옴 얇은 판(2026-09-04, PLAN-004 §3.3~3.5) — 숲(forest)·들판·언덕(hill)·계곡(valley)·산(mountain). P1에서는 바탕·지평선·소품만
// (생물은 P2 에이전트, 소나무·억새·고사리·절벽 아트는 P3 자리). 3/4 시점·축척·안개는 엔진과 view.ts가 준다.
//  · forest: 참나무(아트 tree-oak-*)가 위·좌우를 두르고 가운데는 그늘진 빈터, 그루터기·통나무·바위·버섯(가을)·마른 풀.
//  · hill: 완만한 언덕 띠 두 겹(밝기 차로 원근), 풀포기 빽빽, 바위 무리, 봄엔 꽃, 가을엔 마른 풀(억새 자리는 P3).
//  · valley: 바위 사이를 굽이치는 시내(밝은 물 띠 + 흐르는 거품 점), 이끼 바위.
//  · mountain: 위 띠에 큰 봉우리 실루엣, 바위·눈 얼룩(겨울·초봄엔 눈이 초원보다 오래).

import type { Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { ArtSet, drawArt } from "../art/load";
import { drawProp, scatterProps } from "../art/props";
import { SIZE } from "../world/scale";
import { bakeHorizon, depthScale, horizonY, GROUND_SQUASH } from "../world/view";
import { canopyTreeSprite, bareTreeSprite } from "../world/traces-draw";

export type LandKind = "forest" | "hill" | "valley" | "mountain";

const GROUND: Record<LandKind, Record<SeasonKey, [string, string]>> = {
  forest: { spring: ["#b9cfa2", "#9db98a"], summer: ["#9dbb88", "#7fa270"], autumn: ["#c9b892", "#ad9a74"], winter: ["#eef2f6", "#dde5ec"] },
  hill: { spring: ["#cfe0b6", "#b8cf9c"], summer: ["#b4cf96", "#98b97c"], autumn: ["#d9cba3", "#c2b28a"], winter: ["#f1f4f8", "#e2e8ee"] },
  valley: { spring: ["#c1d6bd", "#a6c2a4"], summer: ["#a9c6a4", "#8bad88"], autumn: ["#cfc2a4", "#b3a586"], winter: ["#eaf0f4", "#d8e2ea"] },
  mountain: { spring: ["#c9cfc3", "#b1b9ad"], summer: ["#bcc6b6", "#a3ae9d"], autumn: ["#cdc5b0", "#b4ab94"], winter: ["#f3f6fa", "#e4eaf1"] }
};

export function createLand(seed: number, opts: { season: SeasonKey; kind: LandKind }): Scene {
  const { season, kind } = opts;
  let w = 0;
  let h = 0;
  let ground: HTMLCanvasElement | null = null;
  let horizon: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  let av = -1;
  const art = new ArtSet(
    ["tree-oak-spring", "tree-oak-summer", "tree-oak-autumn", "tree-oak-winter", "rock", "stump", "log", "mushroom", "grass-dry", "grass-tuft", "daisy", "shrub-spring", "shrub-summer", "shrub-autumn", "shrub-winter"],
    { scaleOf: { "tree-oak-spring": 3, "tree-oak-summer": 3, "tree-oak-autumn": 3, "tree-oak-winter": 3 } }
  );
  const trees: { x: number; y: number; R: number }[] = [];
  const stream: { x: number; y: number }[] = [];
  const foam: { u: number; lane: number; sp: number }[] = [];
  const gy = () => horizonY(h);
  const groundY = (r: number) => gy() + r * (h - gy());
  const shadow = (g: CanvasRenderingContext2D, x: number, y: number, wd: number, a: number) => {
    g.save();
    g.globalAlpha *= a;
    g.fillStyle = "rgb(40 34 30)";
    g.beginPath();
    g.ellipse(x, y, wd / 2, wd * 0.17, 0, 0, TAU);
    g.fill();
    g.restore();
  };

  function drawTree(g: CanvasRenderingContext2D, x: number, y: number, R: number, hour: number) {
    const dx = hour < 12 ? -8 : 8;
    const a = art.get(`tree-oak-${season}`);
    if (a) {
      shadow(g, x + dx * 0.4, y - 2, R * 1.9, 0.26);
      drawArt(g, a, x, y, (2 * R) / a.w);
      return;
    }
    const s = season === "winter" ? bareTreeSprite(R) : canopyTreeSprite(season, R);
    shadow(g, x + dx * 0.4, y - 2, R * 1.8, 0.24);
    g.drawImage(s, x - s.width / 2, y - R * 0.9 - s.height / 2);
  }

  function bake(dpr: number) {
    const g0 = rng((seed * 7 + 13) >>> 0);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const [c0, c1] = GROUND[kind][season];
    const grad = g.createLinearGradient(0, gy(), 0, h);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const patches = Math.round((w * h) / 70000);
    for (let i = 0; i < patches; i++) softBlob(g, g0() * w, groundY(g0()), 120 + g0() * 240, g0() < 0.5 ? "255 255 245" : "90 110 80", 0.08);
    if (kind === "hill") {
      // 언덕 띠 두 겹(밝기 차) — 원근.
      for (let i = 0; i < 2; i++) {
        const base = groundY(0.18 + i * 0.28);
        g.fillStyle = `rgb(255 255 255 / ${0.14 - i * 0.05})`;
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, base + Math.sin(x * 0.003 + i * 2) * 26 + Math.sin(x * 0.009 + i) * 9);
        g.lineTo(w, h);
        g.closePath();
        g.fill();
      }
      const tufts = Math.round((w * h) / 1400);
      for (let i = 0; i < tufts; i++) {
        const x = g0() * w;
        const y = groundY(g0());
        drawProp(g, art, season === "autumn" || season === "winter" ? "grass-dry" : "grass-tuft", x, y, { k: (0.8 + g0() * 0.7) * depthScale(y, h), r: g0(), flip: g0() < 0.5, alpha: 0.9 });
      }
      if (season === "spring") {
        const nd = Math.round((w * h) / 60000);
        for (let i = 0; i < nd; i++) {
          const x = g0() * w;
          const y = groundY(g0());
          drawProp(g, art, "daisy", x, y + 8, { k: (0.9 + g0() * 0.3) * (SIZE.flower / 18) * depthScale(y, h), r: g0(), flip: g0() < 0.5 });
        }
      }
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 5, band: "any" }, { id: `shrub-${season}`, n: 2, band: "any" }]);
    } else if (kind === "forest") {
      // 빈터 — 가운데는 그늘(이끼·솔잎), 가장자리는 어둡게.
      softBlob(g, w / 2, groundY(0.55), Math.min(w, h) * 0.42, "70 90 60", 0.1);
      const tufts = Math.round((w * h) / 3200);
      for (let i = 0; i < tufts; i++) {
        const x = g0() * w;
        const y = groundY(g0());
        drawProp(g, art, "grass-dry", x, y, { k: (0.6 + g0() * 0.5) * depthScale(y, h), r: g0(), flip: g0() < 0.5, alpha: 0.6 });
      }
      if (season === "autumn") {
        for (let i = 0; i < 6; i++) {
          const x = g0() * w;
          const y = groundY(0.3 + g0() * 0.65);
          const k = (0.8 + g0() * 0.6) * depthScale(y, h);
          drawProp(g, art, "mushroom", x, y, { k, r: g0() });
        }
      }
      scatterProps(g, art, w, h, g0, [{ id: "stump", n: 2, band: "any" }, { id: "log", n: 1, band: "any" }, { id: "rock", n: 3, band: "any" }]);
    } else if (kind === "valley") {
      // 시내 — 왼쪽 위에서 오른쪽 아래로 굽이치는 밝은 물 띠(원근: 위는 좁고 아래는 넓다).
      stream.length = 0;
      for (let i = 0; i <= 24; i++) {
        const p = i / 24;
        stream.push({ x: w * (0.25 + 0.45 * p) + Math.sin(p * 9 + 1) * w * 0.08, y: groundY(0.02 + 0.96 * p) });
      }
      const streamW = (p: number) => 10 + 34 * p;
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const [col, k] of [
        ["rgb(120 150 170 / 0.55)", 1.25],
        ["rgb(175 205 225 / 0.9)", 1],
        ["rgb(215 235 245 / 0.6)", 0.55]
      ] as const) {
        g.strokeStyle = col;
        g.beginPath();
        for (let i = 0; i < stream.length; i++) {
          const s = stream[i];
          g.lineWidth = streamW(i / 24) * k;
          if (i === 0) g.moveTo(s.x, s.y);
          else g.lineTo(s.x, s.y);
        }
        g.stroke();
      }
      const tufts = Math.round((w * h) / 2400);
      for (let i = 0; i < tufts; i++) {
        const x = g0() * w;
        const y = groundY(g0());
        drawProp(g, art, season === "winter" ? "grass-dry" : "grass-tuft", x, y, { k: (0.7 + g0() * 0.6) * depthScale(y, h), r: g0(), flip: g0() < 0.5, alpha: 0.85 });
      }
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 8, band: "any" }]);
      foam.length = 0;
      for (let i = 0; i < 26; i++) foam.push({ u: g0(), lane: (g0() - 0.5) * 0.6, sp: 0.06 + g0() * 0.05 });
    } else {
      // 산 — 바위·눈 얼룩(겨울·봄엔 눈이 남는다), 위 띠는 봉우리(지평선 굽기가 크게).
      const snowy = season === "winter" || season === "spring";
      if (snowy) for (let i = 0; i < Math.round((w * h) / 50000); i++) softBlob(g, g0() * w, groundY(g0() * 0.6), 60 + g0() * 120, "255 255 255", season === "winter" ? 0.5 : 0.25);
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 10, band: "any" }, { id: "grass-dry", n: 40, band: "any" }]);
      for (let i = 0; i < 6; i++) {
        const x = g0() * w;
        const y = groundY(0.15 + g0() * 0.8);
        const k = (0.8 + g0() * 0.9) * depthScale(y, h);
        if (!art.has("rock")) {
          const rg = g.createRadialGradient(x - 8 * k, y - 10 * k, 2, x, y - 6 * k, 26 * k);
          rg.addColorStop(0, "#a9afb3");
          rg.addColorStop(1, "#6e767b");
          g.fillStyle = rg;
          g.beginPath();
          g.ellipse(x, y - 6 * k, 24 * k, 14 * k, g0() * 0.5 - 0.25, 0, TAU);
          g.fill();
        }
      }
    }
    ground = c;
    horizon = bakeHorizon(season, w, h, 1);
    // 숲의 나무 자리(결정적) — 위 줄 + 좌우 기둥, 가운데는 비운다.
    trees.length = 0;
    if (kind === "forest") {
      const n = 6 + Math.round(w / 260);
      for (let i = 0; i < n; i++) trees.push({ x: (i + 0.5) * (w / n) + (g0() - 0.5) * 40, y: groundY(0.06 + g0() * 0.1), R: Math.round(SIZE.treeCrownW / 2 * (0.75 + g0() * 0.35)) });
      for (const side of [0.06, 0.94]) for (let i = 0; i < 3; i++) trees.push({ x: w * side + (g0() - 0.5) * 50, y: groundY(0.3 + i * 0.22 + g0() * 0.1), R: Math.round(SIZE.treeCrownW / 2 * (0.8 + g0() * 0.3)) });
      trees.sort((a, b) => a.y - b.y);
    }
    gw = w;
    gh = h;
    gdpr = dpr;
    av = art.version;
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr || av !== art.version) bake(f.dpr);
    },
    step(f) {
      if (av !== art.version) bake(f.dpr);
      if (kind === "valley") for (const q of foam) q.u = (q.u + q.sp * f.dt * lerp(0.6, 1.4, f.load)) % 1;
    },
    draw(g, f) {
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      if (kind === "valley" && stream.length) {
        // 흐르는 거품 점 — 시내를 따라 내려온다(원근: 아래로 갈수록 빠르고 크다).
        for (const q of foam) {
          const i = Math.min(stream.length - 2, Math.floor(q.u * (stream.length - 1)));
          const a = stream[i];
          const b = stream[i + 1];
          const t = q.u * (stream.length - 1) - i;
          const x = a.x + (b.x - a.x) * t + q.lane * (10 + 34 * q.u);
          const y = a.y + (b.y - a.y) * t;
          g.fillStyle = `rgb(255 255 255 / ${0.35 + 0.45 * q.u})`;
          g.beginPath();
          g.ellipse(x, y, 1.6 + 2.4 * q.u, (1.6 + 2.4 * q.u) * GROUND_SQUASH, 0, 0, TAU);
          g.fill();
        }
      }
      for (const tr of trees) drawTree(g, tr.x, tr.y, Math.round((tr.R * depthScale(tr.y, f.h)) / 4) * 4, f.time.hour);
      void clamp;
    },
    debug() {
      return { biomeKind: kind, trees: trees.length, season };
    }
  };
}
