// 겨울 — "소복이 쌓인 눈밭을 위에서 내려다본다". 바탕(눈밭 + 옅은 둔덕 + 반짝이 + 걸어간 발자국 두세 줄)은
// 리사이즈 때 한 번 굽고, 그 위로 눈송이가 '내려앉는다'(위에서 보는 시점이라 점이 커지며 나타났다가 바닥에
// 스며든다). 바탕을 누르면 그 자리에 발자국 한 쌍이 찍히고 눈가루가 폭 하고 튄다(40초 뒤 옅어져 사라진다).
// 눈은 水의 결정이자 흰 金 — 어둡게 만들지 않는다(순백은 아이보리 위에서 안 읽히니 얼음빛 테두리를 준다).

import type { Frame, Scene } from "../scene-engine";
import { clamp, makeCanvas, rng, softBlob, TAU } from "./util";

type Flake = { x: number; y: number; life: number; dur: number; wait: number; r: number };
type Print = { x: number; y: number; a: number; born: number };
type Poof = { x: number; y: number; vx: number; vy: number; life: number; r: number };
type Twinkle = { x: number; y: number; ph: number; r: number };

export function createWinter(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const flakes: Flake[] = [];
  const prints: Print[] = [];
  const poofs: Poof[] = [];
  const twinkles: Twinkle[] = [];
  let w = 0;
  let h = 0;

  // 발자국 한 개(작은 신발 자국): 앞볼(둥근 사각) + 뒤꿈치. 눌린 눈 = 푸르스름한 그늘 + 안쪽 흰 빛.
  function print(g: CanvasRenderingContext2D, x: number, y: number, a: number, k: number, alpha: number) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.scale(k, k);
    g.globalAlpha = alpha;
    g.fillStyle = "rgb(178 196 218)";
    g.beginPath();
    g.ellipse(0, -5, 5.2, 7, 0, 0, TAU); // 앞볼
    g.fill();
    g.beginPath();
    g.ellipse(0, 7, 4.2, 4.6, 0, 0, TAU); // 뒤꿈치
    g.fill();
    g.fillStyle = "rgb(214 226 240)";
    g.beginPath();
    g.ellipse(-0.8, -5.6, 3.2, 4.8, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(-0.6, 6.6, 2.6, 3, 0, 0, TAU);
    g.fill();
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
    // 둔덕 — 얼음빛 그늘·흰 봉우리 얼룩(위에서 본 요철).
    const blobs = Math.round((w * h) / 90000);
    for (let i = 0; i < blobs; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 90 + rand() * 220;
      if (rand() < 0.5) softBlob(g, x, y, r, "205 220 238", 0.22);
      else softBlob(g, x, y, r, "255 255 255", 0.5);
    }
    // 반짝이 — 작은 흰 점 + 얼음빛 테두리(아이보리 위에서 읽히게).
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
    // 걸어간 발자국 두세 줄 — 가장자리에서 시작해 화면을 가로지르며 살짝 휜다. 왼발·오른발 번갈아.
    const trails = 2 + Math.round(rand());
    for (let tIdx = 0; tIdx < trails; tIdx++) {
      const edge = Math.floor(rand() * 4);
      let x = edge === 0 ? -10 : edge === 1 ? w + 10 : rand() * w;
      let y = edge === 2 ? -10 : edge === 3 ? h + 10 : rand() * h;
      let dir = Math.atan2(h / 2 - y, w / 2 - x) + (rand() - 0.5) * 1.2;
      const k = 1.25 + rand() * 0.35; // 1차 실측: 1.0은 점선처럼 작아 발자국으로 안 읽혔다
      let step = 0;
      let left = rand() < 0.5;
      while (step < 70 && x > -40 && x < w + 40 && y > -40 && y < h + 40) {
        dir += (rand() - 0.5) * 0.28;
        const px = x + Math.cos(dir + Math.PI / 2) * (left ? -8 : 8) * k;
        const py = y + Math.sin(dir + Math.PI / 2) * (left ? -8 : 8) * k;
        print(g, px, py, dir + Math.PI / 2, k, 0.74 - step * 0.002);
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
    return 8;
  }
  function newFlake(): Flake {
    return { x: rand() * w, y: rand() * h, life: 0, dur: 1.8 + rand() * 1.6, wait: rand() * 3, r: 2.2 + rand() * 2 };
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      const dpr = f.dpr;
      if (!ground || gw !== w || gh !== h || gdpr !== dpr) bakeGround(dpr);
      const n = flakeCount(f);
      while (flakes.length < n) flakes.push(newFlake());
      if (flakes.length > n) flakes.length = n;
      const tw = f.q >= 1 ? 14 : 6;
      while (twinkles.length < tw) twinkles.push({ x: rand() * w, y: rand() * h, ph: rand() * TAU, r: 1.6 + rand() * 1.6 });
      if (twinkles.length > tw) twinkles.length = tw;
    },
    step(f) {
      const { dt, t } = f;
      for (const s of flakes) {
        if (s.wait > 0) {
          s.wait -= dt;
          continue;
        }
        s.life += dt / s.dur;
        if (s.life >= 1) {
          s.x = rand() * w;
          s.y = rand() * h;
          s.life = 0;
          s.dur = 1.8 + rand() * 1.6;
          s.wait = rand() * 2.5;
          s.r = 2.2 + rand() * 2;
        }
      }
      for (let i = poofs.length - 1; i >= 0; i--) {
        const q = poofs[i];
        q.life -= dt / 0.7;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= Math.pow(0.05, dt);
        q.vy *= Math.pow(0.05, dt);
        if (q.life <= 0) poofs.splice(i, 1);
      }
      while (prints.length && t - prints[0].born > 46) prints.shift();
    },
    draw(g, f) {
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      const t = f.t;
      // 반짝이 — 천천히 숨쉬는 흰 점 몇 개.
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
      // 내려앉는 눈 — 커지며 나타나 바닥에 스며든다.
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
      // 사용자가 찍은 발자국 — 40초 뒤 6초에 걸쳐 옅어진다.
      for (const p of prints) {
        const age = t - p.born;
        const a = age > 40 ? Math.max(0, 1 - (age - 40) / 6) : 1;
        print(g, p.x, p.y, p.a, 1.4, 0.74 * a);
      }
      for (const q of poofs) {
        g.fillStyle = `rgb(255 255 255 / ${Math.max(0, q.life) * 0.9})`;
        g.beginPath();
        g.arc(q.x, q.y, q.r * (0.4 + (1 - q.life) * 0.9), 0, TAU);
        g.fill();
      }
    },
    pointerDown(f, onBackground) {
      if (!onBackground) return false;
      const a = rand() * TAU;
      const px = Math.cos(a + Math.PI / 2) * 10;
      const py = Math.sin(a + Math.PI / 2) * 10;
      prints.push({ x: f.p.x - px, y: f.p.y - py, a: a + Math.PI / 2, born: f.t });
      prints.push({ x: f.p.x + px + Math.cos(a) * 18, y: f.p.y + py + Math.sin(a) * 18, a: a + Math.PI / 2, born: f.t + 0.15 });
      if (prints.length > 40) prints.splice(0, prints.length - 40);
      const n = f.q >= 1 ? 10 : 5;
      for (let i = 0; i < n; i++) {
        const b = rand() * TAU;
        const sp = 60 + rand() * 120;
        poofs.push({ x: f.p.x, y: f.p.y, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, life: 1, r: 2 + rand() * 3 });
      }
      return true;
    },
    debug() {
      return { flakes: flakes.length, prints: prints.length, poofs: poofs.length };
    }
  };
}
