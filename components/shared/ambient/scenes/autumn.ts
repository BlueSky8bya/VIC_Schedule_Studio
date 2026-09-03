// 가을 — "낙엽이 소복한 땅을 위에서 내려다본다". 여러 수종의 잎(둥근 잎·느릅·버들·단풍·은행·참나무·솔잎)이 바닥에
// 흩어져 있고, 이따금 바람이 한 줄기 지나가며(gust) 잎들이 밀리고 뒤집힌다. 포인터가 지나가면 그 주변 잎이 바람에
// 날리듯 밀리고(속도 비례, 소용돌이 성분), 바탕 위에서 잎을 누르면 집어서 끌 수 있다(집은 잎은 떠서 그림자가 커지고,
// 놓으면 손 속도로 미끄러진다). 잎끼리는 원 충돌로 서로 밀어낸다.
// 랜덤 이벤트(2026-09-04 사용자): **도토리**(public/ambient/acorn.svg)가 이따금 하늘에서 떨어진다 — 위에서 보는 시점이라
// 크고 흐린 그림자와 함께 커졌다가(카메라 가까이서 출발) 바닥에 통 떨어져 튀고 구르며 근처 잎을 밀친다. 떨어진 도토리는
// 잎처럼 집어 던질 수 있다(최대 6개, 넘치면 오래된 것이 스르르 사라진다).
// 여력(f.load): 잎 수 26~220장(×화면 면적)이 **점진적으로** 오르내린다 — 늘어날 땐 잎이 하늘에서 하나씩 떨어져 쌓이고,
// 줄어들 땐 포인터에서 먼 잎부터 옅어져 사라진다(툭 사라지지 않는다). 돌풍 빈도·세기, 도토리 이벤트도 여력에 따른다.
// 색은 채도를 낮춘 가을색 — 단풍은 와인·벽돌, 은행은 머스터드, 참나무·솔잎은 갈색·올리브(붉·주황·노랑을 쨍하게
// 올리지 않는다 — CLAUDE.md Owner-fit palette). 스프라이트(잎·그림자)는 한 번 굽고 매 프레임 drawImage만.

import type { Frame, Scene } from "../scene-engine";
import { ASSET, loadSprite, type Sprite } from "../assets";
import { clamp, leafPath, leafVeins, lerp, makeCanvas, pineNeedles, rng, shadowSprite, softBlob, TAU } from "./util";

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
const ACORN = SPECIES.length; // 수종 인덱스 — 에셋 스프라이트, 무작위로는 안 생긴다(이벤트로만)
const SPR = 84; // 스프라이트 한 변(px) — 잎 반지름 30 + 여백(단풍 갈래·솔잎 길이)
const R0 = 30;
const ACORN_MAX = 6;

type Leaf = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  s: number;
  sp: number; // 수종(ACORN = 도토리)
  col: number;
  lift: number;
  flip: number;
  flipV: number;
  fall: number; // 1 → 0 떨어지는 중(하늘에서)
  ph: number;
  fade: number; // 0 정상, >0 사라지는 중(1에서 제거)
  born: number;
};

type Gust = { t0: number; dur: number; dir: number; y: number } | null;

export function createAutumn(seed: number): Scene {
  const rand = rng(seed);
  const leaves: Leaf[] = [];
  let sprites: HTMLCanvasElement[][] = [];
  let shadows: HTMLCanvasElement[] = [];
  let acornSpr: Sprite | null = null;
  let acornShadow: HTMLCanvasElement | null = null;
  let grabbed = -1;
  let gox = 0;
  let goy = 0;
  let gust: Gust = null;
  let nextGust = 4 + rand() * 5;
  let nextSpawn = 0;
  let nextTrim = 0;
  let nextAcorn = 7 + rand() * 6;
  let acornsDropped = 0;
  let w = 0;
  let h = 0;
  let windCount = 0; // 검증용 — 포인터 바람에 밀린 잎 누적
  let filled = false;

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
          // 잎 안쪽만(clip): 밑동→끝 명도 변화 + 얼룩(마른 반점) + 왼쪽 위 광택. 실물 낙엽의 얼룩덜룩함.
          g.save();
          leafPath(g, R0, sp.shape);
          g.clip();
          const lg = g.createLinearGradient(0, R0, 0, -R0);
          lg.addColorStop(0, "rgb(30 18 12 / 0.2)");
          lg.addColorStop(0.5, "rgb(30 18 12 / 0)");
          lg.addColorStop(1, "rgb(255 240 210 / 0.14)");
          g.fillStyle = lg;
          g.fillRect(-SPR / 2, -SPR / 2, SPR, SPR);
          const spots = 2 + Math.floor(rand() * 3);
          for (let k = 0; k < spots; k++) {
            softBlob(g, (rand() - 0.5) * R0 * 1.2, (rand() - 0.5) * R0 * 1.4, R0 * (0.18 + rand() * 0.22), "60 36 24", 0.2);
          }
          if (rand() < 0.5) softBlob(g, (rand() - 0.5) * R0, (rand() - 0.5) * R0, R0 * 0.25, "255 235 200", 0.18);
          const hl = g.createLinearGradient(-R0, -R0, R0, R0);
          hl.addColorStop(0, "rgb(255 245 230 / 0.22)");
          hl.addColorStop(0.55, "rgb(255 245 230 / 0)");
          hl.addColorStop(1, "rgb(40 28 20 / 0.14)");
          g.fillStyle = hl;
          g.fillRect(-SPR / 2, -SPR / 2, SPR, SPR);
          g.restore();
          // 잎맥 — 중심맥 + 휘어 오르는 곁맥(단풍은 갈래마다, 은행은 부채살). 밝은 맥 위에 가는 그늘 맥.
          g.lineCap = "round";
          g.strokeStyle = "rgb(255 245 225 / 0.4)";
          g.lineWidth = 1.1;
          leafVeins(g, R0, sp.shape);
          g.strokeStyle = "rgb(50 30 20 / 0.16)";
          g.lineWidth = 0.5;
          g.translate(0.6, 0.6);
          leafVeins(g, R0, sp.shape);
          g.translate(-0.6, -0.6);
          leafPath(g, R0, sp.shape);
          g.strokeStyle = "rgb(60 40 30 / 0.3)";
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
    acornShadow = shadowSprite(44, 52, "43 35 32", 0.9);
    void loadSprite(ASSET.acorn, 40, 52).then((s) => (acornSpr = s)).catch(() => {});
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
  function spawn(t: number, falling = false): Leaf {
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
      flipV: 0,
      fall: falling ? 1 : 0,
      ph: rand() * TAU,
      fade: 0,
      born: t
    };
  }
  function dropAcorn(t: number) {
    leaves.push({
      x: w * (0.1 + rand() * 0.8),
      y: h * (0.1 + rand() * 0.8),
      vx: 0,
      vy: 0,
      a: rand() * TAU,
      va: 0,
      s: 18 + rand() * 6,
      sp: ACORN,
      col: 0,
      lift: 0,
      flip: 0,
      flipV: 0,
      fall: 1,
      ph: rand() * TAU,
      fade: 0,
      born: t
    });
    acornsDropped++;
    const acorns = leaves.filter((l) => l.sp === ACORN && l.fade === 0);
    if (acorns.length > ACORN_MAX) acorns.sort((a, b) => a.born - b.born)[0].fade = 0.001;
  }
  // 떨어져 닿는 순간 — 튀어 오르고(lift) 구르며 근처 잎을 밀친다.
  function land(l: Leaf) {
    if (l.sp === ACORN) {
      const a = rand() * TAU;
      const sp = 70 + rand() * 90;
      l.vx = Math.cos(a) * sp;
      l.vy = Math.sin(a) * sp;
      l.va = (rand() - 0.5) * 8;
      l.lift = 0.6;
      for (const o of leaves) {
        if (o === l) continue;
        const dx = o.x - l.x;
        const dy = o.y - l.y;
        const d = Math.hypot(dx, dy);
        if (d < 46 && d > 0.01) {
          const k = (1 - d / 46) * 120;
          o.vx += (dx / d) * k;
          o.vy += (dy / d) * k;
          o.va += (rand() - 0.5) * 3;
          if (o.lift < 0.3) o.lift = 0.3;
        }
      }
    } else {
      l.vx = (rand() - 0.5) * 30;
      l.vy = (rand() - 0.5) * 30;
    }
  }

  function targetCount(f: Frame) {
    const areaK = clamp((f.w * f.h) / 1_440_000, 0.55, 1.5);
    return Math.round(lerp(26, 220, f.load) * areaK);
  }
  const liveLeaves = () => leaves.reduce((n, l) => n + (l.sp !== ACORN && l.fade === 0 ? 1 : 0), 0);

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      bake();
      const n = targetCount(f);
      if (!filled) {
        while (leaves.length < n) leaves.push(spawn(f.t));
        filled = true;
      }
      if (grabbed >= leaves.length) grabbed = -1;
      for (const l of leaves) {
        if (l.x > w + l.s) l.x = rand() * w;
        if (l.y > h + l.s) l.y = rand() * h;
      }
    },
    step(f) {
      const { dt, t, p, load } = f;
      // 여력에 따른 점진 조절 — 모자라면 0.12초마다 한 장 떨어지고, 남으면 0.35초마다 한 장(포인터에서 먼 것)이 옅어진다.
      const target = targetCount(f);
      const live = liveLeaves();
      if (live < target && t > nextSpawn) {
        leaves.push(spawn(t, true));
        nextSpawn = t + 0.12;
      } else if (live > target + 3 && t > nextTrim) {
        let far = -1;
        let fd = -1;
        for (let i = 0; i < leaves.length; i++) {
          const l = leaves[i];
          if (l.sp === ACORN || l.fade > 0 || i === grabbed || l.fall > 0) continue;
          const d = p.inside ? Math.hypot(l.x - p.x, l.y - p.y) : rand() * 1000;
          if (d > fd) {
            fd = d;
            far = i;
          }
        }
        if (far >= 0) leaves[far].fade = 0.001;
        // 남는 잎이 많을수록 빠르게(200장 → 60장이 15초 안에), 몇 장이면 천천히.
        nextTrim = t + clamp((0.35 * 30) / (live - target), 0.07, 0.35);
      }
      // 도토리 이벤트 — 여력 0.4부터, 15~40초 간격.
      if (load >= 0.4 && t > nextAcorn) {
        dropAcorn(t);
        nextAcorn = t + 15 + rand() * 25;
      }
      const gk = lerp(0.35, 1, load); // 돌풍 세기 — 여력이 적으면 약하게
      if (!gust && t > nextGust) gust = { t0: t, dur: 3 + rand() * 1.8, dir: rand() < 0.5 ? -1 : 1, y: rand() * h };
      if (gust && t - gust.t0 > gust.dur) {
        gust = null;
        nextGust = t + lerp(22, 7, load) + rand() * lerp(14, 9, load);
      }
      const front = gust ? (gust.dir > 0 ? -240 + ((t - gust.t0) / gust.dur) * (w + 480) : w + 240 - ((t - gust.t0) / gust.dur) * (w + 480)) : 0;
      const pushy = p.inside && p.speed > 30;
      const groundFr = Math.pow(0.02, dt);
      const acornFr = Math.pow(0.1, dt);
      const spinFr = Math.pow(0.04, dt);
      for (let i = leaves.length - 1; i >= 0; i--) {
        const l = leaves[i];
        if (l.fade > 0) {
          l.fade += dt / 0.7;
          if (l.fade >= 1) {
            leaves.splice(i, 1);
            if (grabbed === i) grabbed = -1;
            else if (grabbed > i) grabbed--;
            continue;
          }
        }
        if (l.fall > 0) {
          // 하늘에서 떨어지는 중 — 잎은 1.3초 흔들리며, 도토리는 0.9초 곧장.
          const dur = l.sp === ACORN ? 0.9 : 1.3;
          l.fall = Math.max(0, l.fall - dt / dur);
          if (l.sp !== ACORN) {
            l.x += Math.sin(t * 3.1 + l.ph) * 34 * dt;
            l.a += Math.sin(t * 2.2 + l.ph) * 1.6 * dt;
          } else l.a += 3 * dt;
          if (l.fall === 0) land(l);
          continue;
        }
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
        const acorn = l.sp === ACORN;
        let fx = acorn ? 0 : 4 * Math.sin(l.y * 0.011 + t * 0.5);
        let fy = acorn ? 0 : 3 * Math.cos(l.x * 0.009 + t * 0.37);
        if (gust) {
          const d = (l.x - front) / 240;
          const e = Math.exp(-d * d) * (1 - clamp(Math.abs(l.y - gust.y) / (h * 1.3), 0, 0.85));
          if (e > 0.02) {
            const G = (acorn ? 90 : 560) * e * gk;
            fx += G * gust.dir;
            fy += G * 0.22 * Math.sin(l.x * 0.02 + l.y * 0.013);
            if (!acorn) {
              l.va += e * (rand() - 0.5) * 9;
              if (l.lift < e * 0.55) l.lift = e * 0.55;
              if (e > 0.4 && l.flipV === 0 && rand() < 0.03) l.flipV = 5 + rand() * 3;
            }
          }
        }
        if (pushy) {
          const dx = l.x - p.x;
          const dy = l.y - p.y;
          const d = Math.hypot(dx, dy);
          const R = lerp(110, 170, load) + l.s * 0.6;
          if (d < R && d > 0.001) {
            // 바람에 날리듯: 포인터에서 멀어지는 힘 + 포인터 진행 방향 + 살짝 도는 소용돌이 성분.
            const k = (1 - d / R) * gk * (acorn ? 0.25 : 1);
            const sp = clamp(p.speed, 0, 2600);
            const push = k * sp * 1.05;
            const nx = dx / d;
            const ny = dy / d;
            fx += nx * push + p.vx * 0.45 * k - ny * sp * 0.18 * k;
            fy += ny * push + p.vy * 0.45 * k + nx * sp * 0.18 * k;
            l.va += k * (rand() - 0.5) * 18;
            if (!acorn) {
              if (l.lift < k * 0.8) l.lift = k * 0.8;
              if (k > 0.5 && l.flipV === 0 && rand() < 0.1) l.flipV = 6 + rand() * 3;
            }
            if (k > 0.3) windCount++;
          }
        }
        l.vx += fx * dt;
        l.vy += fy * dt;
        const fr = acorn ? acornFr : groundFr;
        l.vx *= fr;
        l.vy *= fr;
        l.va *= spinFr;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.a += l.va * dt + (acorn ? Math.hypot(l.vx, l.vy) * 0.02 * dt : 0);
        const m = l.s;
        if (l.x < -m) l.x += w + 2 * m;
        else if (l.x > w + m) l.x -= w + 2 * m;
        if (l.y < -m) l.y += h + 2 * m;
        else if (l.y > h + m) l.y -= h + 2 * m;
      }
      for (const l of leaves) {
        if (l.lift > 0 && l.fall === 0) l.lift = Math.max(0, l.lift - dt * 1.6);
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
          if (a.fall > 0) continue;
          const ra = a.s * 0.32;
          for (let j = i + 1; j < leaves.length; j++) {
            const b = leaves[j];
            if (b.fall > 0) continue;
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
        const acorn = l.sp === ACORN;
        if (acorn && (!acornSpr || !acornShadow)) return;
        // 떨어지는 중: 카메라 가까이서 출발(크고 흐리게) → 바닥(제 크기). 그림자는 멀리서 다가온다.
        const up = l.fall > 0 ? Math.pow(l.fall, 0.8) : l.lift;
        const k = (acorn ? l.s / 40 : (l.s / SPR) * 1.4) * (1 + up * (l.fall > 0 ? 1.4 : 0.12));
        const sx = l.flipV > 0 ? Math.cos(l.flip) : 1;
        const alpha = 1 - l.fade;
        g.save();
        if (shadow) {
          g.globalAlpha = (l.fall > 0 ? 0.08 + 0.1 * (1 - l.fall) : 0.16 + up * 0.12) * alpha;
          g.translate(l.x + 2.5 + up * (l.fall > 0 ? 34 : 8), l.y + 3.5 + up * (l.fall > 0 ? 40 : 10));
        } else {
          g.globalAlpha = (l.fall > 0 ? 0.55 + 0.45 * (1 - l.fall) : 1) * alpha;
          g.translate(l.x, l.y);
        }
        g.rotate(l.a);
        if (acorn) {
          g.scale(k, k);
          if (shadow) g.drawImage(acornShadow!, -22, -26);
          else g.drawImage(acornSpr!.c, -20, -26, 40, 52);
        } else {
          g.scale(k * sx, k);
          g.drawImage(shadow ? shadows[l.sp] : sprites[l.sp][l.col], -SPR / 2, -SPR / 2);
        }
        g.restore();
      };
      for (let i = 0; i < leaves.length; i++) if (i !== grabbed && leaves[i].fall === 0) drawLeaf(leaves[i], true);
      for (let i = 0; i < leaves.length; i++) if (i !== grabbed && leaves[i].fall === 0) drawLeaf(leaves[i], false);
      if (grabbed >= 0 && grabbed < leaves.length) {
        drawLeaf(leaves[grabbed], true);
        drawLeaf(leaves[grabbed], false);
      }
      // 떨어지는 것은 맨 위(카메라에 가깝다).
      for (const l of leaves) {
        if (l.fall > 0) {
          drawLeaf(l, true);
          drawLeaf(l, false);
        }
      }
    },
    pointerDown(f, onBackground) {
      if (!onBackground) return false;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        if (l.fall > 0 || l.fade > 0) continue;
        const d = Math.hypot(l.x - f.p.x, l.y - f.p.y);
        if (d < Math.max(14, l.s * 0.55) && d < bd) {
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
        if (l.sp !== ACORN && Math.hypot(l.vx, l.vy) > 500 && l.flipV === 0) l.flipV = 7;
      }
      grabbed = -1;
    },
    debug() {
      return {
        leaves: leaves.length,
        live: liveLeaves(),
        falling: leaves.filter((l) => l.fall > 0).length,
        fading: leaves.filter((l) => l.fade > 0).length,
        acorns: leaves.filter((l) => l.sp === ACORN).length,
        acornsDropped,
        acornSprite: !!acornSpr,
        grabbed,
        gust: !!gust,
        wind: windCount,
        species: SPECIES.map((_, i) => leaves.filter((l) => l.sp === i).length),
        pos: leaves.slice(0, 8).map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.s)])
      };
    }
  };
}
