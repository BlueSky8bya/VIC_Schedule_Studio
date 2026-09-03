// 가을 — "낙엽이 소복한 땅을 위에서 내려다본다". 여러 수종의 잎(둥근 잎·느릅·버들·**단풍·은행·참나무·솔잎**) 90~220장이
// 바닥에 흩어져 있고, 이따금 바람이 한 줄기 지나가며(gust) 잎들이 밀리고 뒤집힌다. 포인터가 지나가면 그 주변 잎이
// 바람에 날리듯 밀리고(속도 비례, 소용돌이 성분), 바탕 위에서 잎을 누르면 집어서 끌 수 있다(집은 잎은 떠서 그림자가
// 커지고, 놓으면 손 속도로 미끄러진다). 잎끼리는 원 충돌로 서로 밀어낸다.
// 색은 채도를 낮춘 가을색 — 단풍은 와인·벽돌, 은행은 머스터드, 참나무·솔잎은 갈색·올리브(붉·주황·노랑을 쨍하게
// 올리지 않는다 — CLAUDE.md Owner-fit palette; 사용자가 2026-09-04 수종 다양화를 요청해 종류만 늘렸다).
// 스프라이트(잎·그림자)는 한 번 굽고 매 프레임 drawImage만 — 필터/blur 없음.

import type { Frame, Scene } from "../scene-engine";
import { clamp, leafPath, makeCanvas, pineNeedles, rng, TAU } from "./util";

type Species = { shape: number; colors: string[]; size: [number, number]; weight: number; needle?: boolean };
const SPECIES: Species[] = [
  { shape: 0, colors: ["#a8744f", "#8f5a48", "#9c6a4a", "#8b5f4a"], size: [34, 60], weight: 3 }, // 둥근 잎(느티·벚)
  { shape: 1, colors: ["#b08a55", "#9a8a5c", "#8a7a5a"], size: [30, 52], weight: 2 }, // 느릅·자작(황갈)
  { shape: 2, colors: ["#9c8a4e", "#7f7a45", "#a08a50"], size: [34, 62], weight: 1.5 }, // 버들(올리브)
  { shape: 3, colors: ["#9a4a4a", "#a6574a", "#8c3e48", "#b06a52"], size: [44, 76], weight: 3.5 }, // 단풍(와인·벽돌)
  { shape: 4, colors: ["#c9a84c", "#b8973f", "#d3b55e"], size: [36, 60], weight: 3 }, // 은행(머스터드)
  { shape: 5, colors: ["#8b6a3f", "#a17a4a", "#7a5a38"], size: [40, 70], weight: 2.5 }, // 참나무(갈색)
  { shape: 6, colors: ["#6b6a3c", "#7a6a3a", "#5f6a40"], size: [26, 40], weight: 2, needle: true } // 솔잎
];
const SPR = 84; // 스프라이트 한 변(px) — 잎 반지름 30 + 여백(단풍 갈래·솔잎 길이)
const R0 = 30;

type Leaf = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  s: number;
  sp: number; // 수종
  col: number;
  lift: number;
  flip: number;
  flipV: number;
};

type Gust = { t0: number; dur: number; dir: number; y: number } | null;

export function createAutumn(seed: number): Scene {
  const rand = rng(seed);
  const leaves: Leaf[] = [];
  let sprites: HTMLCanvasElement[][] = [];
  let shadows: HTMLCanvasElement[] = [];
  let grabbed = -1;
  let gox = 0;
  let goy = 0;
  let gust: Gust = null;
  let nextGust = 4 + rand() * 5;
  let w = 0;
  let h = 0;
  let windCount = 0; // 검증용 — 포인터 바람에 밀린 잎 누적

  function bake() {
    if (sprites.length) return;
    sprites = [];
    shadows = [];
    for (const sp of SPECIES) {
      const row: HTMLCanvasElement[] = [];
      for (const col of sp.colors) {
        const { c, g } = makeCanvas(SPR, SPR);
        g.translate(SPR / 2, SPR / 2);
        if (sp.needle) {
          pineNeedles(g, R0 * 0.55, col, 2.1);
          g.strokeStyle = "rgb(255 245 230 / 0.25)";
          g.lineWidth = 0.8;
          g.stroke();
        } else {
          leafPath(g, R0, sp.shape);
          g.fillStyle = col;
          g.fill();
          // 윗면 광택(왼쪽 위 밝게) + 가장자리 그늘
          const hl = g.createLinearGradient(-R0, -R0, R0, R0);
          hl.addColorStop(0, "rgb(255 245 230 / 0.28)");
          hl.addColorStop(0.55, "rgb(255 245 230 / 0)");
          hl.addColorStop(1, "rgb(40 28 20 / 0.16)");
          g.fillStyle = hl;
          g.fill();
          // 잎맥 — 수종별로 다르게(은행은 부채살, 단풍은 갈래마다 한 줄, 나머지는 중심맥+곁맥)
          g.strokeStyle = "rgb(255 245 230 / 0.36)";
          g.lineWidth = 1;
          g.lineCap = "round";
          g.beginPath();
          if (sp.shape === 4) {
            for (let k = -3; k <= 3; k++) {
              const a = (-90 + k * 17) * (Math.PI / 180);
              g.moveTo(0, R0 * 0.42);
              g.lineTo(Math.cos(a) * R0 * 1.0, R0 * 0.42 + Math.sin(a) * R0 * 1.0);
            }
          } else if (sp.shape === 3) {
            for (const [x, y] of [[0, -0.95], [0.6, -0.7], [0.95, -0.1], [0.58, 0.58], [-0.58, 0.58], [-0.95, -0.1], [-0.6, -0.7]]) {
              g.moveTo(0, R0 * 0.3);
              g.lineTo(x * R0, y * R0);
            }
          } else {
            g.moveTo(0, -R0 * 0.82);
            g.lineTo(0, R0 * 0.86);
            for (let k = -2; k <= 2; k++) {
              const y = k * R0 * 0.3;
              g.moveTo(0, y);
              g.lineTo(R0 * 0.36, y - R0 * 0.22);
              g.moveTo(0, y + R0 * 0.14);
              g.lineTo(-R0 * 0.36, y - R0 * 0.08);
            }
          }
          g.stroke();
          leafPath(g, R0, sp.shape);
          g.strokeStyle = "rgb(60 40 30 / 0.24)";
          g.lineWidth = 0.9;
          g.stroke();
          // 잎자루
          g.strokeStyle = "rgb(70 50 36 / 0.55)";
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(0, R0 * 0.88);
          g.lineTo(sp.shape === 4 ? 0 : R0 * 0.06, R0 * 1.22);
          g.stroke();
        }
        row.push(c);
      }
      sprites.push(row);
      const { c, g } = makeCanvas(SPR, SPR);
      g.translate(SPR / 2, SPR / 2);
      if (sp.needle) pineNeedles(g, R0 * 0.55, "#2b2320", 2.6);
      else {
        leafPath(g, R0 * 1.04, sp.shape);
        g.fillStyle = "#2b2320";
        g.fill();
      }
      shadows.push(c);
    }
  }

  const totalWeight = SPECIES.reduce((a, s) => a + s.weight, 0);
  function pickSpecies(): number {
    let r = rand() * totalWeight;
    for (let i = 0; i < SPECIES.length; i++) {
      r -= SPECIES[i].weight;
      if (r <= 0) return i;
    }
    return 0;
  }
  function spawn(): Leaf {
    const sp = pickSpecies();
    const [lo, hi] = SPECIES[sp].size;
    return {
      x: rand() * w,
      y: rand() * h,
      vx: 0,
      vy: 0,
      a: rand() * TAU,
      va: 0,
      s: lo + rand() * (hi - lo),
      sp,
      col: Math.floor(rand() * SPECIES[sp].colors.length),
      lift: 0,
      flip: 0,
      flipV: 0
    };
  }

  function targetCount(f: Frame) {
    const area = f.w * f.h;
    if (f.q >= 2) return Math.round(clamp(area / 9000, 90, 220)); // "풍성하게" — 1600×900 160장, 큰 화면 220장
    if (f.q === 1) return Math.round(clamp(area / 18000, 50, 110));
    return 40; // 최소 단계도 눈에 띄게 남긴다(사용자: '가볍게'가 '끄기'처럼 보였다)
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      bake();
      const n = targetCount(f);
      while (leaves.length < n) leaves.push(spawn());
      if (leaves.length > n) leaves.length = n;
      if (grabbed >= leaves.length) grabbed = -1;
      for (const l of leaves) {
        if (l.x > w + l.s) l.x = rand() * w;
        if (l.y > h + l.s) l.y = rand() * h;
      }
    },
    step(f) {
      const { dt, t, p } = f;
      if (!gust && t > nextGust) gust = { t0: t, dur: 3 + rand() * 1.8, dir: rand() < 0.5 ? -1 : 1, y: rand() * h };
      if (gust && t - gust.t0 > gust.dur) {
        gust = null;
        nextGust = t + 7 + rand() * 9;
      }
      const front = gust ? (gust.dir > 0 ? -240 + ((t - gust.t0) / gust.dur) * (w + 480) : w + 240 - ((t - gust.t0) / gust.dur) * (w + 480)) : 0;
      const pushy = p.inside && p.speed > 30;
      const groundFr = Math.pow(0.02, dt);
      const spinFr = Math.pow(0.04, dt);
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        if (i === grabbed) {
          gox *= 0.88;
          goy *= 0.88;
          const tx = p.x + gox;
          const ty = p.y + goy;
          l.vx = (tx - l.x) * 18;
          l.vy = (ty - l.y) * 18;
          l.x += l.vx * dt;
          l.y += l.vy * dt;
          l.va *= 0.9;
          l.a += l.va * dt + (l.vx * 0.0006 + l.vy * 0.0004) * dt * 3;
          l.lift = 1;
          continue;
        }
        let fx = 4 * Math.sin(l.y * 0.011 + t * 0.5);
        let fy = 3 * Math.cos(l.x * 0.009 + t * 0.37);
        if (gust) {
          const d = (l.x - front) / 240;
          const e = Math.exp(-d * d) * (1 - clamp(Math.abs(l.y - gust.y) / (h * 1.3), 0, 0.85));
          if (e > 0.02) {
            const G = 560 * e;
            fx += G * gust.dir;
            fy += G * 0.22 * Math.sin(l.x * 0.02 + l.y * 0.013);
            l.va += e * (rand() - 0.5) * 9;
            if (l.lift < e * 0.55) l.lift = e * 0.55;
            if (e > 0.4 && l.flipV === 0 && rand() < 0.03) l.flipV = 5 + rand() * 3;
          }
        }
        if (pushy) {
          const dx = l.x - p.x;
          const dy = l.y - p.y;
          const d = Math.hypot(dx, dy);
          const R = 170 + l.s * 0.6;
          if (d < R && d > 0.001) {
            // 바람에 날리듯: 포인터에서 멀어지는 힘 + 포인터 진행 방향 + 살짝 도는 소용돌이 성분.
            const k = 1 - d / R;
            const sp = clamp(p.speed, 0, 2600);
            const push = k * sp * 1.05;
            const nx = dx / d;
            const ny = dy / d;
            fx += nx * push + p.vx * 0.45 * k - ny * sp * 0.18 * k;
            fy += ny * push + p.vy * 0.45 * k + nx * sp * 0.18 * k;
            l.va += k * (rand() - 0.5) * 18;
            if (l.lift < k * 0.8) l.lift = k * 0.8;
            if (k > 0.5 && l.flipV === 0 && rand() < 0.1) l.flipV = 6 + rand() * 3;
            if (k > 0.3) windCount++;
          }
        }
        l.vx += fx * dt;
        l.vy += fy * dt;
        l.vx *= groundFr;
        l.vy *= groundFr;
        l.va *= spinFr;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.a += l.va * dt;
        const m = l.s;
        if (l.x < -m) l.x += w + 2 * m;
        else if (l.x > w + m) l.x -= w + 2 * m;
        if (l.y < -m) l.y += h + 2 * m;
        else if (l.y > h + m) l.y -= h + 2 * m;
      }
      for (const l of leaves) {
        if (l.lift > 0) l.lift = Math.max(0, l.lift - dt * 1.6);
        if (l.flipV > 0) {
          l.flip += l.flipV * dt;
          if (l.flip >= Math.PI) {
            l.flip = 0;
            l.flipV = 0;
          }
        }
      }
      if (f.q > 0) {
        for (let i = 0; i < leaves.length; i++) {
          const a = leaves[i];
          const ra = a.s * 0.32;
          for (let j = i + 1; j < leaves.length; j++) {
            const b = leaves[j];
            const dx = b.x - a.x;
            if (dx > 80 || dx < -80) continue;
            const dy = b.y - a.y;
            if (dy > 80 || dy < -80) continue;
            const min = ra + b.s * 0.32;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 < 0.0001) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const ov = (min - d) * 0.5;
            const aFixed = i === grabbed;
            const bFixed = j === grabbed;
            if (!aFixed) {
              a.x -= nx * ov * (bFixed ? 2 : 1);
              a.y -= ny * ov * (bFixed ? 2 : 1);
            }
            if (!bFixed) {
              b.x += nx * ov * (aFixed ? 2 : 1);
              b.y += ny * ov * (aFixed ? 2 : 1);
            }
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              const imp = -rv * 0.45;
              if (!aFixed) {
                a.vx -= nx * imp;
                a.vy -= ny * imp;
                a.va += (rand() - 0.5) * imp * 0.02;
              }
              if (!bFixed) {
                b.vx += nx * imp;
                b.vy += ny * imp;
                b.va += (rand() - 0.5) * imp * 0.02;
              }
            }
          }
        }
      }
    },
    draw(g, f) {
      const mist = g.createLinearGradient(0, 0, 0, f.h * 0.34);
      mist.addColorStop(0, "rgb(234 238 242 / 0.42)");
      mist.addColorStop(0.5, "rgb(234 238 242 / 0.16)");
      mist.addColorStop(1, "rgb(234 238 242 / 0)");
      g.fillStyle = mist;
      g.fillRect(0, 0, f.w, f.h * 0.34);
      const drawLeaf = (l: Leaf, shadow: boolean) => {
        const k = (l.s / SPR) * 1.4 * (1 + l.lift * 0.12);
        const sx = l.flipV > 0 ? Math.cos(l.flip) : 1;
        g.save();
        if (shadow) {
          g.globalAlpha = 0.16 + l.lift * 0.12;
          g.translate(l.x + 2.5 + l.lift * 8, l.y + 3.5 + l.lift * 10);
        } else {
          g.translate(l.x, l.y);
        }
        g.rotate(l.a);
        g.scale(k * sx, k);
        g.drawImage(shadow ? shadows[l.sp] : sprites[l.sp][l.col], -SPR / 2, -SPR / 2);
        g.restore();
      };
      for (let i = 0; i < leaves.length; i++) if (i !== grabbed) drawLeaf(leaves[i], true);
      for (let i = 0; i < leaves.length; i++) if (i !== grabbed) drawLeaf(leaves[i], false);
      if (grabbed >= 0 && grabbed < leaves.length) {
        drawLeaf(leaves[grabbed], true);
        drawLeaf(leaves[grabbed], false);
      }
    },
    pointerDown(f, onBackground) {
      if (!onBackground) return false;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        const d = Math.hypot(l.x - f.p.x, l.y - f.p.y);
        if (d < l.s * 0.55 && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return false;
      grabbed = best;
      gox = leaves[best].x - f.p.x;
      goy = leaves[best].y - f.p.y;
      leaves[best].lift = 1;
      return true;
    },
    pointerUp(f) {
      if (grabbed < 0) return;
      const l = leaves[grabbed];
      if (l) {
        l.vx = f.p.vx * 0.7;
        l.vy = f.p.vy * 0.7;
        l.va += (rand() - 0.5) * 6;
        if (Math.hypot(l.vx, l.vy) > 500 && l.flipV === 0) l.flipV = 7;
      }
      grabbed = -1;
    },
    debug() {
      return {
        leaves: leaves.length,
        grabbed,
        gust: !!gust,
        wind: windCount,
        species: SPECIES.map((_, i) => leaves.filter((l) => l.sp === i).length),
        pos: leaves.slice(0, 8).map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.s)])
      };
    }
  };
}
