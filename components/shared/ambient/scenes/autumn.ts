// 가을 — "낙엽이 소복한 땅을 위에서 내려다본다". **바탕**(2026-09-04 사용자: "가을만 일반 화면") — 마른 흙 얼룩(올리브·
// 엄버, 채도 낮춤)·시든 풀포기(황갈)·잔가지·조약돌·버섯(갈색 갓에 크림 점) 몇을 크기별 결정적으로 한 번 굽는다. 그 위에
// 여러 수종의 잎(둥근 잎·느릅·버들·단풍·은행·참나무·솔잎)이 흩어져 있고, 이따금 바람이 한 줄기 지나가며(gust) 잎들이
// 밀리고 뒤집힌다. 포인터가 지나가면 그 주변 잎이 바람에 날리듯 밀리고, 바탕 위에서 잎을 누르면 집어서 끌 수 있다.
// 잎끼리는 원 충돌로 서로 밀어낸다.
// 랜덤 이벤트: **도토리**(에셋)가 하늘에서 떨어져 튀고 구르며 잎을 밀친다(집어 던지기, 최대 6). **다람쥐**(에셋) — 가장자리에서
// 달려 들어와 킁킁대다 도토리가 있으면 물고 달아난다(없으면 한 번 두리번거리고 지나간다; 누르면 바로 도망). **회오리** —
// 작은 낙엽 회오리가 화면을 가로지르며 잎들을 빙글 띄운다.
// 여력(f.load): 잎 26~220장(×면적)이 점진적으로(늘 땐 떨어지고 줄 땐 옅어져) 오르내리고, 돌풍·도토리(≥.4)·다람쥐(≥.5)·
// 회오리(≥.6)도 여력을 따른다. 색은 채도를 낮춘 가을색(붉·주황·노랑을 쨍하게 올리지 않는다 — CLAUDE.md Owner-fit palette).

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawSprite, loadSprite, type Sprite } from "../assets";
import { clamp, leafPath, leafVeins, lerp, makeCanvas, pineNeedles, rng, shadowSprite, softBlob, TAU } from "./util";

type Species = { shape: number; colors: string[]; size: [number, number]; weight: number; needle?: boolean };
const SPECIES: Species[] = [
  { shape: 0, colors: ["#a8744f", "#8f5a48", "#9c6a4a", "#8b5f4a"], size: [34, 60], weight: 3 },
  { shape: 1, colors: ["#b08a55", "#9a8a5c", "#8a7a5a"], size: [30, 52], weight: 2 },
  { shape: 2, colors: ["#9c8a4e", "#7f7a45", "#a08a50"], size: [34, 62], weight: 1.5 },
  { shape: 3, colors: ["#9a4a4a", "#a6574a", "#8c3e48", "#b06a52"], size: [44, 76], weight: 3.5 },
  { shape: 4, colors: ["#c9a84c", "#b8973f", "#d3b55e"], size: [36, 60], weight: 3 },
  { shape: 5, colors: ["#8b6a3f", "#a17a4a", "#7a5a38"], size: [40, 70], weight: 2.5 },
  { shape: 6, colors: ["#6b6a3c", "#7a6a3a", "#5f6a40"], size: [26, 40], weight: 2, needle: true }
];
const ACORN = SPECIES.length;
const SPR = 84;
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
  sp: number;
  col: number;
  lift: number;
  flip: number;
  flipV: number;
  fall: number;
  ph: number;
  fade: number;
  born: number;
};
type Gust = { t0: number; dur: number; dir: number; y: number } | null;
type SqPhase = "run" | "sniff" | "leave";
type Squirrel = { x: number; y: number; dir: number; phase: SqPhase; tx: number; ty: number; t0: number; target: number; carry: boolean; ph: number };
type Whirl = { x: number; y: number; vx: number; vy: number; t0: number; dur: number } | null;

export function createAutumn(seed: number): Scene {
  const rand = rng(seed);
  const leaves: Leaf[] = [];
  let sprites: HTMLCanvasElement[][] = [];
  let shadows: HTMLCanvasElement[] = [];
  let acornSpr: Sprite | null = null;
  let acornShadow: HTMLCanvasElement | null = null;
  let squirrelSpr: Sprite | null = null;
  let sqShadow: HTMLCanvasElement | null = null;
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  let grabbed = -1;
  let gox = 0;
  let goy = 0;
  let gust: Gust = null;
  let nextGust = 4 + rand() * 5;
  let nextSpawn = 0;
  let nextTrim = 0;
  let nextAcorn = 7 + rand() * 6;
  let acornsDropped = 0;
  let squirrel: Squirrel | null = null;
  let nextSquirrel = 16 + rand() * 8;
  let squirrels = 0;
  let stolen = 0;
  let whirl: Whirl = null;
  let nextWhirl = 24 + rand() * 20;
  let whirls = 0;
  let w = 0;
  let h = 0;
  let windCount = 0;
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
    sqShadow = shadowSprite(52, 70, "43 35 32", 0.6);
    void loadSprite(ASSET.acorn, 40, 52).then((s) => (acornSpr = s)).catch(() => {});
    void loadSprite(ASSET.squirrel, 44, 68).then((s) => (squirrelSpr = s)).catch(() => {});
  }
  // 가을 바탕 — 크기별 결정적. 마른 흙 얼룩 + 시든 풀 + 잔가지 + 조약돌 + 버섯.
  function bakeGround(dpr: number) {
    const g0 = rng((seed * 7 + 13) >>> 0);
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    const patches = Math.round((w * h) / 60000);
    for (let i = 0; i < patches; i++) {
      softBlob(g, g0() * w, g0() * h, 110 + g0() * 240, g0() < 0.5 ? "150 135 95" : "125 100 70", 0.075);
    }
    g.lineCap = "round";
    const tufts = Math.round((w * h) / 2600);
    for (let i = 0; i < tufts; i++) {
      const x = g0() * w;
      const y = g0() * h;
      const n = 2 + Math.floor(g0() * 2);
      for (let k = 0; k < n; k++) {
        const len = 6 + g0() * 9;
        const a = -Math.PI / 2 + (g0() - 0.5) * 1.6;
        g.strokeStyle = g0() < 0.5 ? "rgb(168 140 88 / 0.5)" : "rgb(140 118 74 / 0.45)";
        g.lineWidth = 1.1 + g0() * 0.7;
        g.beginPath();
        g.moveTo(x + k * 2 - 2, y);
        g.quadraticCurveTo(x + k * 2 - 2 + (g0() - 0.5) * 6, y + Math.sin(a) * len * 0.5, x + k * 2 - 2 + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
    const twigs = Math.round((w * h) / 40000);
    for (let i = 0; i < twigs; i++) {
      const x = g0() * w;
      const y = g0() * h;
      const a = g0() * TAU;
      const len = 18 + g0() * 30;
      g.strokeStyle = "rgb(96 74 52 / 0.55)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x, y);
      const mx = x + Math.cos(a) * len * 0.55;
      const my = y + Math.sin(a) * len * 0.55;
      g.lineTo(mx, my);
      g.lineTo(mx + Math.cos(a + (g0() - 0.5) * 0.9) * len * 0.45, my + Math.sin(a + (g0() - 0.5) * 0.9) * len * 0.45);
      g.stroke();
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(mx + Math.cos(a + 0.9) * len * 0.3, my + Math.sin(a + 0.9) * len * 0.3);
      g.stroke();
    }
    const pebbles = Math.round((w * h) / 70000);
    for (let i = 0; i < pebbles; i++) {
      const x = g0() * w;
      const y = g0() * h;
      const r = 3 + g0() * 4;
      const a = g0() * TAU;
      g.fillStyle = "rgb(60 55 50 / 0.12)";
      g.beginPath();
      g.ellipse(x + 1.5, y + 2, r * 1.3, r * 0.9, a, 0, TAU);
      g.fill();
      g.fillStyle = g0() < 0.5 ? "rgb(178 172 160)" : "rgb(160 150 138)";
      g.beginPath();
      g.ellipse(x, y, r * 1.3, r * 0.9, a, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(255 255 250 / 0.35)";
      g.beginPath();
      g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.3, a, 0, TAU);
      g.fill();
    }
    const shrooms = clamp(Math.round((w * h) / 300000), 3, 7);
    for (let i = 0; i < shrooms; i++) {
      const x = 30 + g0() * (w - 60);
      const y = 30 + g0() * (h - 60);
      const r = 7 + g0() * 6;
      softBlob(g, x + 3, y + 4, r * 1.6, "43 35 32", 0.22);
      g.fillStyle = "rgb(236 224 200)";
      g.beginPath();
      g.ellipse(x, y + r * 0.5, r * 0.45, r * 0.7, 0, 0, TAU);
      g.fill();
      const cap = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      cap.addColorStop(0, "#b48864");
      cap.addColorStop(1, "#7f5a40");
      g.fillStyle = cap;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.86, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(245 236 218 / 0.85)";
      for (let k = 0; k < 4; k++) {
        const aa = g0() * TAU;
        const rr = g0() * r * 0.6;
        g.beginPath();
        g.arc(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr * 0.86, 1 + g0() * 1.3, 0, TAU);
        g.fill();
      }
    }
    ground = c;
    gw = w;
    gh = h;
    gdpr = dpr;
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
    return { x: rand() * w, y: rand() * h, vx: 0, vy: 0, a: rand() * TAU, va: 0, s: lo + rand() * (hi - lo), sp, col: Math.floor(rand() * SPECIES[sp].colors.length), lift: 0, flip: 0, flipV: 0, fall: falling ? 1 : 0, ph: rand() * TAU, fade: 0, born: t };
  }
  function dropAcorn(t: number) {
    leaves.push({ x: w * (0.1 + rand() * 0.8), y: h * (0.1 + rand() * 0.8), vx: 0, vy: 0, a: rand() * TAU, va: 0, s: 18 + rand() * 6, sp: ACORN, col: 0, lift: 0, flip: 0, flipV: 0, fall: 1, ph: rand() * TAU, fade: 0, born: t });
    acornsDropped++;
    const acorns = leaves.filter((l) => l.sp === ACORN && l.fade === 0);
    if (acorns.length > ACORN_MAX) acorns.sort((a, b) => a.born - b.born)[0].fade = 0.001;
  }
  function shove(x: number, y: number, R: number, F: number) {
    for (const o of leaves) {
      const dx = o.x - x;
      const dy = o.y - y;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.01 && o.fall === 0) {
        const k = (1 - d / R) * F;
        o.vx += (dx / d) * k;
        o.vy += (dy / d) * k;
        o.va += (rand() - 0.5) * 3;
        if (o.lift < 0.3) o.lift = 0.3;
      }
    }
  }
  function land(l: Leaf) {
    if (l.sp === ACORN) {
      const a = rand() * TAU;
      const sp = 70 + rand() * 90;
      l.vx = Math.cos(a) * sp;
      l.vy = Math.sin(a) * sp;
      l.va = (rand() - 0.5) * 8;
      l.lift = 0.6;
      shove(l.x, l.y, 46, 120);
    } else {
      l.vx = (rand() - 0.5) * 30;
      l.vy = (rand() - 0.5) * 30;
    }
  }
  function startSquirrel(t: number) {
    const e = Math.floor(rand() * 4);
    const x = e === 0 ? -40 : e === 1 ? w + 40 : rand() * w;
    const y = e === 2 ? -40 : e === 3 ? h + 40 : rand() * h;
    let target = -1;
    let bd = Infinity;
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      if (l.sp !== ACORN || l.fade > 0 || l.fall > 0) continue;
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < bd) {
        bd = d;
        target = i;
      }
    }
    const tx = target >= 0 ? leaves[target].x : w * (0.2 + rand() * 0.6);
    const ty = target >= 0 ? leaves[target].y : h * (0.2 + rand() * 0.6);
    squirrel = { x, y, dir: Math.atan2(ty - y, tx - x), phase: "run", tx, ty, t0: t, target, carry: false, ph: rand() * TAU };
    squirrels++;
  }
  function squirrelLeave(t: number) {
    if (!squirrel) return;
    const s = squirrel;
    const exits: [number, number][] = [
      [-60, s.y],
      [w + 60, s.y],
      [s.x, -60],
      [s.x, h + 60]
    ];
    exits.sort((a, b) => Math.hypot(a[0] - s.x, a[1] - s.y) - Math.hypot(b[0] - s.x, b[1] - s.y));
    s.tx = exits[0][0];
    s.ty = exits[0][1];
    s.phase = "leave";
    s.t0 = t;
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
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
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
        nextTrim = t + clamp((0.35 * 30) / (live - target), 0.07, 0.35);
      }
      if (load >= 0.4 && t > nextAcorn) {
        dropAcorn(t);
        nextAcorn = t + 15 + rand() * 25;
      }
      // 다람쥐 — 여력 0.5부터, 30~70초 간격(첫 손님은 16~24초).
      if (!squirrel && load >= 0.5 && t > nextSquirrel) startSquirrel(t);
      if (squirrel) {
        const s = squirrel;
        if (p.inside && s.phase !== "leave" && Math.hypot(s.x - p.x, s.y - p.y) < 100) squirrelLeave(t);
        if (s.phase === "sniff") {
          if (t - s.t0 > 1.2) {
            if (s.target >= 0 && s.target < leaves.length && leaves[s.target].sp === ACORN && leaves[s.target].fade === 0) {
              leaves[s.target].fade = 0.001;
              s.carry = true;
              stolen++;
            }
            squirrelLeave(t);
          }
        } else {
          const dx = s.tx - s.x;
          const dy = s.ty - s.y;
          const d = Math.hypot(dx, dy);
          const sp = s.phase === "leave" ? 320 : 250;
          if (d < 6) {
            if (s.phase === "run") {
              s.phase = "sniff";
              s.t0 = t;
            } else {
              squirrel = null;
              nextSquirrel = t + 30 + rand() * 40;
            }
          } else {
            const want = Math.atan2(dy, dx);
            let diff = want - s.dir;
            while (diff > Math.PI) diff -= TAU;
            while (diff < -Math.PI) diff += TAU;
            s.dir += clamp(diff, -9 * dt, 9 * dt);
            const step = Math.min(d, sp * dt);
            s.x += Math.cos(s.dir) * step;
            s.y += Math.sin(s.dir) * step;
            s.ph += dt * 22;
            shove(s.x, s.y, 44, 60 * dt * 60);
          }
        }
      }
      // 회오리 — 여력 0.6부터, 25~60초 간격, 4.5초. 반경 170 안의 잎이 접선 방향으로 돌며 떠오른다.
      if (!whirl && load >= 0.6 && t > nextWhirl) {
        const e = Math.floor(rand() * 4);
        const x = e === 0 ? -80 : e === 1 ? w + 80 : rand() * w;
        const y = e === 2 ? -80 : e === 3 ? h + 80 : rand() * h;
        const tx = w * (0.3 + rand() * 0.4);
        const ty = h * (0.3 + rand() * 0.4);
        const d = Math.hypot(tx - x, ty - y) || 1;
        whirl = { x, y, vx: ((tx - x) / d) * 95, vy: ((ty - y) / d) * 95, t0: t, dur: 4.5 };
        whirls++;
      }
      if (whirl) {
        const e = (t - whirl.t0) / whirl.dur;
        if (e >= 1) {
          whirl = null;
          nextWhirl = t + 25 + rand() * 35;
        } else {
          whirl.x += whirl.vx * dt;
          whirl.y += whirl.vy * dt;
        }
      }
      const gk = lerp(0.35, 1, load);
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
      const wEnv = whirl ? Math.sin(Math.PI * clamp((t - whirl.t0) / whirl.dur, 0, 1)) : 0;
      for (let i = leaves.length - 1; i >= 0; i--) {
        const l = leaves[i];
        if (l.fade > 0) {
          l.fade += dt / 0.7;
          if (l.fade >= 1) {
            leaves.splice(i, 1);
            if (grabbed === i) grabbed = -1;
            else if (grabbed > i) grabbed--;
            if (squirrel && squirrel.target > i) squirrel.target--;
            else if (squirrel && squirrel.target === i) squirrel.target = -1;
            continue;
          }
        }
        if (l.fall > 0) {
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
        if (whirl && !acorn) {
          const dx = l.x - whirl.x;
          const dy = l.y - whirl.y;
          const d = Math.hypot(dx, dy);
          const R = 170;
          if (d < R && d > 0.01) {
            const k = Math.pow(1 - d / R, 1.2) * wEnv;
            const nx = dx / d;
            const ny = dy / d;
            fx += (-ny * 900 - nx * 140) * k;
            fy += (nx * 900 - ny * 140) * k;
            l.va += k * (rand() - 0.5) * 8;
            if (l.lift < k * 0.95) l.lift = k * 0.95;
            if (k > 0.5 && l.flipV === 0 && rand() < 0.08) l.flipV = 7 + rand() * 3;
          }
        }
        if (pushy) {
          const dx = l.x - p.x;
          const dy = l.y - p.y;
          const d = Math.hypot(dx, dy);
          const R = lerp(110, 170, load) + l.s * 0.6;
          if (d < R && d > 0.001) {
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
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      const mist = g.createLinearGradient(0, 0, 0, f.h * 0.34);
      mist.addColorStop(0, "rgb(234 238 242 / 0.42)");
      mist.addColorStop(0.5, "rgb(234 238 242 / 0.16)");
      mist.addColorStop(1, "rgb(234 238 242 / 0)");
      g.fillStyle = mist;
      g.fillRect(0, 0, f.w, f.h * 0.34);
      const drawLeaf = (l: Leaf, shadow: boolean) => {
        const acorn = l.sp === ACORN;
        if (acorn && (!acornSpr || !acornShadow)) return;
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
      // 다람쥐 — 달릴 땐 몸이 위아래로 통통, 물고 갈 땐 머리 앞에 도토리.
      if (squirrel && squirrelSpr) {
        const s = squirrel;
        const running = s.phase !== "sniff";
        const bounce = running ? Math.abs(Math.sin(s.ph)) : 0;
        const wig = s.phase === "sniff" ? Math.sin(f.t * 12) * 0.12 : 0;
        if (sqShadow) {
          g.save();
          g.globalAlpha = 0.3;
          g.translate(s.x + 4 + 6 * bounce, s.y + 6 + 8 * bounce);
          g.rotate(s.dir + Math.PI / 2);
          g.drawImage(sqShadow, -26, -35, 52, 70);
          g.restore();
        }
        drawSprite(g, squirrelSpr, s.x, s.y - 6 * bounce, s.dir + Math.PI / 2 + wig, 1 + 0.1 * bounce);
        if (s.carry && acornSpr) {
          g.save();
          g.translate(s.x + Math.cos(s.dir) * 30, s.y + Math.sin(s.dir) * 30 - 6 * bounce);
          g.rotate(s.dir + Math.PI / 2);
          g.drawImage(acornSpr.c, -9, -12, 18, 24);
          g.restore();
        }
      }
      for (const l of leaves) {
        if (l.fall > 0) {
          drawLeaf(l, true);
          drawLeaf(l, false);
        }
      }
    },
    pointerDown(f, onBackground) {
      // 다람쥐를 누르면 놀라 달아난다(어디서든).
      if (squirrel && squirrel.phase !== "leave" && Math.hypot(squirrel.x - f.p.x, squirrel.y - f.p.y) < 30) {
        squirrelLeave(f.t);
        return true;
      }
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
        ground: !!ground,
        squirrel: squirrel ? [Math.round(squirrel.x), Math.round(squirrel.y), squirrel.phase, squirrel.carry ? 1 : 0] : null,
        squirrels,
        squirrelSprite: !!squirrelSpr,
        stolen,
        whirl: whirl ? [Math.round(whirl.x), Math.round(whirl.y)] : null,
        whirls,
        grabbed,
        gust: !!gust,
        wind: windCount,
        species: SPECIES.map((_, i) => leaves.filter((l) => l.sp === i).length),
        pos: leaves.map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.s)])
      };
    }
  };
}
