// 가을 — "낙엽이 소복한 땅을 위에서 내려다본다". 잎 40~90장이 바닥에 흩어져 있고, 이따금 바람이 한 줄기
// 지나가며(gust) 잎들이 밀리고 뒤집힌다. 포인터가 빠르게 지나가면 그 주변 잎이 바람 맞은 듯 밀리고, 바탕
// 위에서 잎을 누르면 집어서 끌 수 있다(집은 잎은 떠서 그림자가 커지고, 놓으면 손 속도로 미끄러진다). 잎끼리는
// 원 충돌로 서로 밀어낸다. 색은 채도 낮춘 갈색·와인·올리브(붉·주황·노랑 금지 — CLAUDE.md Owner-fit palette).
// 스프라이트(잎·그림자)는 한 번 굽고 매 프레임 drawImage만 — 필터/blur 없음.

import type { Frame, Scene } from "../scene-engine";
import { clamp, leafPath, makeCanvas, rng, TAU } from "./util";

const COLORS = ["#a8744f", "#8f5a48", "#b08a55", "#7d4b4f", "#9c6a4a", "#8a7a5a", "#a06a52", "#8b5f4a", "#9a8a5c", "#6f5646"];
const SHAPES = 3;
const SPR = 76; // 스프라이트 한 변(px), 잎 반지름 28 + 여백
const R0 = 28;

type Leaf = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number; // 회전(rad)
  va: number;
  s: number; // 지름(px)
  col: number;
  shape: number;
  lift: number; // 0 바닥 ~ 1 들림(그림자 오프셋·크기)
  flip: number; // 뒤집힘 위상(0~π)
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
  let nextGust = 5 + rand() * 5;
  let w = 0;
  let h = 0;

  function bake() {
    if (sprites.length) return;
    sprites = [];
    shadows = [];
    for (let sh = 0; sh < SHAPES; sh++) {
      const row: HTMLCanvasElement[] = [];
      for (const col of COLORS) {
        const { c, g } = makeCanvas(SPR, SPR);
        g.translate(SPR / 2, SPR / 2);
        leafPath(g, R0, sh);
        g.fillStyle = col;
        g.fill();
        // 윗면 광택 — 왼쪽 위가 살짝 밝다(입체감, 필터 없이).
        const hl = g.createLinearGradient(-R0, -R0, R0, R0);
        hl.addColorStop(0, "rgb(255 245 230 / 0.26)");
        hl.addColorStop(0.55, "rgb(255 245 230 / 0)");
        hl.addColorStop(1, "rgb(40 28 20 / 0.14)");
        g.fillStyle = hl;
        g.fill();
        // 잎맥
        g.strokeStyle = "rgb(255 245 230 / 0.38)";
        g.lineWidth = 1.1;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(0, -R0 * 0.82);
        g.lineTo(0, R0 * 0.86);
        for (let k = -2; k <= 2; k++) {
          const y = k * R0 * 0.3;
          g.moveTo(0, y);
          g.lineTo(R0 * 0.34, y - R0 * 0.22);
          g.moveTo(0, y + R0 * 0.14);
          g.lineTo(-R0 * 0.34, y - R0 * 0.08);
        }
        g.stroke();
        // 잎 가장자리 헤어라인
        leafPath(g, R0, sh);
        g.strokeStyle = "rgb(60 40 30 / 0.22)";
        g.lineWidth = 0.9;
        g.stroke();
        row.push(c);
      }
      sprites.push(row);
      const { c, g } = makeCanvas(SPR, SPR);
      g.translate(SPR / 2, SPR / 2);
      leafPath(g, R0 * 1.04, sh);
      g.fillStyle = "#2b2320";
      g.fill();
      shadows.push(c);
    }
  }

  function spawn(): Leaf {
    return {
      x: rand() * w,
      y: rand() * h,
      vx: 0,
      vy: 0,
      a: rand() * TAU,
      va: 0,
      s: 36 + rand() * 38,
      col: Math.floor(rand() * COLORS.length),
      shape: Math.floor(rand() * SHAPES),
      lift: 0,
      flip: 0,
      flipV: 0
    };
  }

  function targetCount(f: Frame) {
    const area = f.w * f.h;
    // "풍성하게"(사용자) — 1600×900에서 120장, 1920×1080 130장(상한). 90장은 달력 밑에 깔려 여백에만 듬성했다.
    if (f.q >= 2) return Math.round(clamp(area / 12000, 60, 130));
    if (f.q === 1) return Math.round(clamp(area / 24000, 30, 65));
    return 20;
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
        nextGust = t + 8 + rand() * 10;
      }
      const front = gust ? (gust.dir > 0 ? -240 + ((t - gust.t0) / gust.dur) * (w + 480) : w + 240 - ((t - gust.t0) / gust.dur) * (w + 480)) : 0;
      const pushy = p.inside && p.speed > 40;
      const groundFr = Math.pow(0.02, dt); // 바닥 마찰 — 1초 안에 거의 멈춘다
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
          l.a += l.va * dt + (l.vx * 0.0006 + l.vy * 0.0004) * dt * 60 * 0.05;
          l.lift = 1;
          continue;
        }
        // 잔잔한 들바람(느린 요동)
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
          const R = 150 + l.s * 0.6;
          if (d < R && d > 0.001) {
            const k = 1 - d / R;
            const push = k * clamp(p.speed, 0, 2400) * 0.95;
            fx += (dx / d) * push + p.vx * 0.4 * k;
            fy += (dy / d) * push + p.vy * 0.4 * k;
            l.va += k * (rand() - 0.5) * 16;
            if (l.lift < k * 0.75) l.lift = k * 0.75;
            if (k > 0.55 && l.flipV === 0 && rand() < 0.08) l.flipV = 6 + rand() * 3;
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
        // 화면 밖으로 밀리면 반대편에서 들어온다(밀도 유지).
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
      // 원 충돌 — 서로 밀어내고 속도를 조금 나눈다(집은 잎이 이웃을 밀어낸다).
      if (f.q > 0) {
        for (let i = 0; i < leaves.length; i++) {
          const a = leaves[i];
          const ra = a.s * 0.34;
          for (let j = i + 1; j < leaves.length; j++) {
            const b = leaves[j];
            const dx = b.x - a.x;
            if (dx > 80 || dx < -80) continue;
            const dy = b.y - a.y;
            if (dy > 80 || dy < -80) continue;
            const min = ra + b.s * 0.34;
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
      // 은빛 서리 안개(金) — 위쪽 띠, 매 프레임 그라데이션 한 장(싸다).
      const mist = g.createLinearGradient(0, 0, 0, f.h * 0.34);
      mist.addColorStop(0, "rgb(234 238 242 / 0.42)");
      mist.addColorStop(0.5, "rgb(234 238 242 / 0.16)");
      mist.addColorStop(1, "rgb(234 238 242 / 0)");
      g.fillStyle = mist;
      g.fillRect(0, 0, f.w, f.h * 0.34);
      const drawLeaf = (l: Leaf, shadow: boolean) => {
        const k = (l.s / SPR) * (1 + l.lift * 0.12);
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
        g.drawImage(shadow ? shadows[l.shape] : sprites[l.shape][l.col], -SPR / 2, -SPR / 2);
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
        pos: leaves.slice(0, 8).map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.s)])
      };
    }
  };
}
