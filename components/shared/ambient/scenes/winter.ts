// 겨울 — "소복이 쌓인 눈밭을 위에서 내려다본다". 바탕(눈밭 + 둔덕 그늘 + 반짝이 + 이미 걸어간 발자국 두 줄)은
// 리사이즈 때 한 번 굽는다. 그 위에서: ① 보이지 않는 누군가가 **걸어간다** — 0.4초마다 신발 자국이 하나씩 찍히며
// 화면을 가로지르고(자국이 찍힐 때 눈가루가 톡), 다 지나가면 잠시 뒤 다른 가장자리에서 다음 사람. ② 눈송이가
// 내려앉는다(위에서 보는 시점이라 점이 커지며 나타났다가 바닥에 스며들고, 닿는 순간 옅은 고리가 번진다).
// ③ 포인터가 빠르게 지나가면 **눈가루가 흩날린다**(2026-09-04 사용자: 겨울 마우스 이펙트) — 가루가 손 방향으로
// 튀어 반짝이며 가라앉는다. ④ 바탕을 누르면 그 자리에 발자국 한 쌍 + 눈가루. 자국은 눌린 눈의 푸른 그늘 + 빛 받는
// 쪽(왼쪽 위) 흰 테로 그린다. 어둡게 만들지 않는다(순백은 아이보리 위에서 안 읽히니 얼음빛 테두리를 준다).

import type { Frame, Scene } from "../scene-engine";
import { clamp, makeCanvas, rng, softBlob, TAU } from "./util";

type Flake = { x: number; y: number; life: number; dur: number; wait: number; r: number; rung: boolean };
type Print = { x: number; y: number; a: number; left: boolean; k: number; born: number };
type Dust = { x: number; y: number; vx: number; vy: number; life: number; r: number };
type Ring = { x: number; y: number; life: number };
type Twinkle = { x: number; y: number; ph: number; r: number };
type Walker = { x: number; y: number; dir: number; left: boolean; k: number; next: number; active: boolean; steps: number };

export function createWinter(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const flakes: Flake[] = [];
  const prints: Print[] = [];
  const dust: Dust[] = [];
  const rings: Ring[] = [];
  const twinkles: Twinkle[] = [];
  const walker: Walker = { x: 0, y: 0, dir: 0, left: false, k: 1, next: 0, active: false, steps: 0 };
  let nextWalker = 2.5;
  let w = 0;
  let h = 0;
  let dustSpawned = 0;

  // 신발 자국 — 앞볼(넓음)+허리(좁음)+뒤꿈치. 눌린 눈 = 푸른 그늘, 빛 받는 왼쪽 위 테두리는 흰빛, 안쪽 바닥은 더 짙고
  // 발가락 쪽 홈 두 줄. 왼발/오른발은 좌우 대칭(mirror) + 살짝 다른 각도.
  function sole(g: CanvasRenderingContext2D) {
    g.beginPath();
    g.moveTo(-5.6, -9);
    g.bezierCurveTo(-5.2, -14.5, 5.2, -14.5, 5.6, -9);
    g.bezierCurveTo(6.2, -3, 4.6, 0.5, 4.2, 3);
    g.bezierCurveTo(4.6, 6, 4.8, 9, 3.6, 11.5);
    g.bezierCurveTo(2.4, 13.6, -2.4, 13.6, -3.6, 11.5);
    g.bezierCurveTo(-4.8, 9, -4.6, 6, -4.2, 3);
    g.bezierCurveTo(-4.6, 0.5, -6.2, -3, -5.6, -9);
    g.closePath();
  }
  function print(g: CanvasRenderingContext2D, x: number, y: number, a: number, k: number, alpha: number, left: boolean) {
    g.save();
    g.translate(x, y);
    g.rotate(a + (left ? -0.08 : 0.08));
    g.scale(left ? -k : k, k);
    g.globalAlpha = alpha;
    // 빛 받는 테(왼쪽 위로 1px 밀린 흰 사본)
    g.save();
    g.translate(-1.1, -1.1);
    sole(g);
    g.fillStyle = "rgb(255 255 255 / 0.9)";
    g.fill();
    g.restore();
    // 눌린 바닥(푸른 그늘) — 가장자리는 옅고 안쪽은 짙게
    sole(g);
    const grad = g.createRadialGradient(0.5, 0, 1, 0, 0, 14);
    grad.addColorStop(0, "rgb(168 190 216)");
    grad.addColorStop(1, "rgb(196 212 232)");
    g.fillStyle = grad;
    g.fill();
    // 홈(발가락 쪽 두 줄 + 뒤꿈치 한 줄)
    g.strokeStyle = "rgb(150 174 204 / 0.8)";
    g.lineWidth = 1;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3.5, -9);
    g.lineTo(3.5, -9);
    g.moveTo(-3.8, -5.5);
    g.lineTo(3.8, -5.5);
    g.moveTo(-2.4, 9.5);
    g.lineTo(2.4, 9.5);
    g.stroke();
    g.restore();
  }

  function bakeGround(dpr: number) {
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "rgb(246 249 253 / 0.92)");
    base.addColorStop(1, "rgb(236 242 249 / 0.94)");
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const blobs = Math.round((w * h) / 90000);
    for (let i = 0; i < blobs; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 90 + rand() * 220;
      if (rand() < 0.5) softBlob(g, x, y, r, "205 220 238", 0.24);
      else softBlob(g, x, y, r, "255 255 255", 0.5);
    }
    const dots = Math.round((w * h) / 9000);
    for (let i = 0; i < dots; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 0.8 + rand() * 1.4;
      g.fillStyle = "rgb(150 180 212 / 0.42)";
      g.beginPath();
      g.arc(x, y, r + 0.9, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(255 255 255 / 0.95)";
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    // 이미 걸어간 발자국 두 줄(옅게) — 살아 있는 walker와 같은 걸음 규칙.
    for (let tIdx = 0; tIdx < 2; tIdx++) {
      const edge = Math.floor(rand() * 4);
      let x = edge === 0 ? -10 : edge === 1 ? w + 10 : rand() * w;
      let y = edge === 2 ? -10 : edge === 3 ? h + 10 : rand() * h;
      let dir = Math.atan2(h / 2 - y, w / 2 - x) + (rand() - 0.5) * 1.2;
      const k = 1.25 + rand() * 0.3;
      let step = 0;
      let left = rand() < 0.5;
      while (step < 80 && x > -40 && x < w + 40 && y > -40 && y < h + 40) {
        dir += (rand() - 0.5) * 0.26;
        const px = x + Math.cos(dir + Math.PI / 2) * (left ? -8 : 8) * k;
        const py = y + Math.sin(dir + Math.PI / 2) * (left ? -8 : 8) * k;
        print(g, px, py, dir + Math.PI / 2, k, 0.5, left);
        x += Math.cos(dir) * 30 * k;
        y += Math.sin(dir) * 30 * k;
        left = !left;
        step++;
      }
    }
    ground = c;
    gw = w;
    gh = h;
    gdpr = dpr;
  }

  function flakeCount(f: Frame) {
    if (f.q >= 2) return Math.round(clamp((f.w * f.h) / 26000, 28, 70));
    if (f.q === 1) return Math.round(clamp((f.w * f.h) / 52000, 14, 34));
    return 16;
  }
  function newFlake(): Flake {
    return { x: rand() * w, y: rand() * h, life: 0, dur: 1.8 + rand() * 1.6, wait: rand() * 3, r: 2.2 + rand() * 2, rung: false };
  }
  function puff(x: number, y: number, n: number, spread: number) {
    for (let i = 0; i < n; i++) {
      const b = rand() * TAU;
      const sp = spread * (0.4 + rand() * 0.8);
      dust.push({ x, y, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, life: 1, r: 1.6 + rand() * 2.2 });
    }
  }
  function startWalker(t: number) {
    const edge = Math.floor(rand() * 4);
    walker.x = edge === 0 ? -14 : edge === 1 ? w + 14 : rand() * w;
    walker.y = edge === 2 ? -14 : edge === 3 ? h + 14 : rand() * h;
    walker.dir = Math.atan2(h * (0.3 + rand() * 0.4) - walker.y, w * (0.3 + rand() * 0.4) - walker.x) + (rand() - 0.5) * 0.8;
    walker.left = rand() < 0.5;
    walker.k = 1.25 + rand() * 0.3;
    walker.next = t;
    walker.active = true;
    walker.steps = 0;
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
      const n = flakeCount(f);
      while (flakes.length < n) flakes.push(newFlake());
      if (flakes.length > n) flakes.length = n;
      const tw = f.q >= 1 ? 14 : 6;
      while (twinkles.length < tw) twinkles.push({ x: rand() * w, y: rand() * h, ph: rand() * TAU, r: 1.6 + rand() * 1.6 });
      if (twinkles.length > tw) twinkles.length = tw;
    },
    step(f) {
      const { dt, t, p } = f;
      // ① 걷는 사람
      if (!walker.active && t > nextWalker && f.q >= 1) startWalker(t);
      if (walker.active && t >= walker.next) {
        walker.dir += (rand() - 0.5) * 0.24;
        const side = walker.left ? -8 : 8;
        const px = walker.x + Math.cos(walker.dir + Math.PI / 2) * side * walker.k;
        const py = walker.y + Math.sin(walker.dir + Math.PI / 2) * side * walker.k;
        prints.push({ x: px, y: py, a: walker.dir + Math.PI / 2, left: walker.left, k: walker.k, born: t });
        puff(px, py, f.q >= 2 ? 4 : 2, 40);
        walker.x += Math.cos(walker.dir) * 30 * walker.k;
        walker.y += Math.sin(walker.dir) * 30 * walker.k;
        walker.left = !walker.left;
        walker.next = t + 0.38 + rand() * 0.1;
        walker.steps++;
        if (walker.steps > 120 || walker.x < -40 || walker.x > w + 40 || walker.y < -40 || walker.y > h + 40) {
          walker.active = false;
          nextWalker = t + 6 + rand() * 10;
        }
      }
      if (prints.length > 200) prints.splice(0, prints.length - 200);
      while (prints.length && t - prints[0].born > 80) prints.shift();
      // ② 내려앉는 눈
      for (const s of flakes) {
        if (s.wait > 0) {
          s.wait -= dt;
          continue;
        }
        s.life += dt / s.dur;
        if (!s.rung && s.life >= 0.62) {
          s.rung = true;
          if (f.q >= 1 && rings.length < 40) rings.push({ x: s.x, y: s.y, life: 1 });
        }
        if (s.life >= 1) {
          s.x = rand() * w;
          s.y = rand() * h;
          s.life = 0;
          s.dur = 1.8 + rand() * 1.6;
          s.wait = rand() * 2.5;
          s.r = 2.2 + rand() * 2;
          s.rung = false;
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].life -= dt / 0.7;
        if (rings[i].life <= 0) rings.splice(i, 1);
      }
      // ③ 포인터 눈가루 — 빠를수록 많이, 손 방향으로.
      if (p.inside && p.moved && p.speed > 220) {
        const n = f.q >= 2 ? 3 : 1;
        const cap = f.q >= 2 ? 160 : 60;
        for (let i = 0; i < n && dust.length < cap; i++) {
          const b = rand() * TAU;
          const spread = 30 + rand() * 60;
          dust.push({
            x: p.x + (rand() - 0.5) * 10,
            y: p.y + (rand() - 0.5) * 10,
            vx: p.vx * 0.22 + Math.cos(b) * spread,
            vy: p.vy * 0.22 + Math.sin(b) * spread,
            life: 1,
            r: 1.4 + rand() * 2
          });
          dustSpawned++;
        }
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const q = dust[i];
        q.life -= dt / 0.75;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= Math.pow(0.03, dt);
        q.vy *= Math.pow(0.03, dt);
        if (q.life <= 0) dust.splice(i, 1);
      }
    },
    draw(g, f) {
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      const t = f.t;
      for (const k of twinkles) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.3 + k.ph));
        g.fillStyle = `rgb(255 255 255 / ${a})`;
        g.beginPath();
        g.arc(k.x, k.y, k.r, 0, TAU);
        g.fill();
        g.strokeStyle = `rgb(150 180 212 / ${a * 0.6})`;
        g.lineWidth = 1;
        g.stroke();
      }
      // 발자국(살아 있는 것) — 70초 뒤 10초에 걸쳐 옅어진다.
      for (const p of prints) {
        const age = t - p.born;
        const a = age > 70 ? Math.max(0, 1 - (age - 70) / 10) : 1;
        print(g, p.x, p.y, p.a, p.k, 0.7 * a, p.left);
      }
      for (const r of rings) {
        const e = 1 - r.life;
        g.strokeStyle = `rgb(255 255 255 / ${r.life * 0.35})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(r.x, r.y, 3 + e * 9, 0, TAU);
        g.stroke();
      }
      for (const s of flakes) {
        if (s.wait > 0) continue;
        const l = s.life;
        const r = 0.8 + s.r * Math.min(1, l * 1.25);
        const a = l < 0.65 ? (l / 0.65) * 0.95 : ((1 - l) / 0.35) * 0.95;
        g.fillStyle = `rgb(150 180 212 / ${a * 0.55})`;
        g.beginPath();
        g.arc(s.x, s.y, r + 1, 0, TAU);
        g.fill();
        g.fillStyle = `rgb(255 255 255 / ${a})`;
        g.beginPath();
        g.arc(s.x, s.y, r, 0, TAU);
        g.fill();
      }
      for (const q of dust) {
        const a = Math.max(0, q.life);
        g.fillStyle = `rgb(150 180 212 / ${a * 0.5})`;
        g.beginPath();
        g.arc(q.x, q.y, q.r * (0.6 + (1 - q.life) * 0.6) + 0.8, 0, TAU);
        g.fill();
        g.fillStyle = `rgb(255 255 255 / ${a * 0.95})`;
        g.beginPath();
        g.arc(q.x, q.y, q.r * (0.6 + (1 - q.life) * 0.6), 0, TAU);
        g.fill();
      }
    },
    pointerDown(f, onBackground) {
      if (!onBackground) return false;
      const a = rand() * TAU;
      const px = Math.cos(a + Math.PI / 2) * 10;
      const py = Math.sin(a + Math.PI / 2) * 10;
      prints.push({ x: f.p.x - px, y: f.p.y - py, a: a + Math.PI / 2, left: true, k: 1.4, born: f.t });
      prints.push({ x: f.p.x + px + Math.cos(a) * 18, y: f.p.y + py + Math.sin(a) * 18, a: a + Math.PI / 2, left: false, k: 1.4, born: f.t + 0.15 });
      puff(f.p.x, f.p.y, f.q >= 1 ? 12 : 6, 140);
      return true;
    },
    debug() {
      return { flakes: flakes.length, prints: prints.length, dust: dust.length, dustSpawned, walker: walker.active, walkerSteps: walker.steps };
    }
  };
}
