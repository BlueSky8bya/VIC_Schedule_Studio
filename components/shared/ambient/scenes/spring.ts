// 봄 — "풀밭을 위에서 내려다본다". 바탕(연둣빛 필름 + 풀포기 수백 + 클로버·작은 데이지·꽃잎 몇)은 한 번 굽고,
// 빛 얼룩 둘이 느리게 지나가며 풀이 반짝인다. 나비 두어 마리가 그림자를 끌며 날아다니고(높이에 따라 그림자가
// 멀어진다), 포인터가 다가가면 팔랑거리며 달아난다. 나비를 누르면 꽃잎·반짝이가 터지고 한 바퀴 돌아 날아간다.
// 색은 木(초목)·水(이슬) — 쨍한 햇빛·붉은 꽃은 쓰지 않는다(CLAUDE.md Owner-fit palette).

import type { Frame, Scene } from "../scene-engine";
import { clamp, makeCanvas, rng, softBlob, TAU } from "./util";

const WINGS = [
  { a: "#c3b3ec", b: "#9a86d6", spot: "#ffffff" },
  { a: "#f6cfe0", b: "#dea3bf", spot: "#fff6fa" },
  { a: "#fbe9ab", b: "#dcc36f", spot: "#ffffff" },
  { a: "#b6dcea", b: "#86bdd2", spot: "#f4fbff" }
];
const SPR = 64;

type Fly = {
  x: number;
  y: number;
  hd: number; // 진행 방향(rad)
  spd: number;
  tx: number;
  ty: number;
  next: number; // 다음 목표를 고를 시각
  ph: number; // 날갯짓 위상
  bob: number; // 높이 위상
  col: number;
  flee: number; // 남은 도망 시간
  loop: number; // 남은 한 바퀴 시간
  k: number; // 크기
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string; a: number; va: number };

export function createSpring(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const wings: HTMLCanvasElement[] = [];
  const flies: Fly[] = [];
  const sparks: Spark[] = [];
  let w = 0;
  let h = 0;

  function bakeWings() {
    if (wings.length) return;
    for (const c of WINGS) {
      const { c: cv, g } = makeCanvas(SPR, SPR);
      g.translate(SPR / 2, SPR / 2);
      for (const side of [-1, 1]) {
        g.save();
        g.scale(side, 1);
        // 윗날개
        g.beginPath();
        g.moveTo(2, -2);
        g.bezierCurveTo(10, -30, 30, -26, 26, -8);
        g.bezierCurveTo(24, 0, 12, 4, 2, 2);
        g.closePath();
        g.fillStyle = c.a;
        g.fill();
        g.strokeStyle = c.b;
        g.lineWidth = 1.4;
        g.stroke();
        // 아랫날개
        g.beginPath();
        g.moveTo(2, 3);
        g.bezierCurveTo(14, 4, 22, 14, 14, 22);
        g.bezierCurveTo(8, 26, 3, 16, 2, 8);
        g.closePath();
        g.fillStyle = c.b;
        g.fill();
        g.strokeStyle = c.b;
        g.stroke();
        // 점무늬
        g.fillStyle = c.spot;
        g.globalAlpha = 0.8;
        g.beginPath();
        g.arc(17, -14, 3.2, 0, TAU);
        g.fill();
        g.beginPath();
        g.arc(10, 14, 2, 0, TAU);
        g.fill();
        g.restore();
      }
      wings.push(cv);
    }
  }

  function bakeGround(dpr: number) {
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    g.fillStyle = "rgb(214 232 200 / 0.42)";
    g.fillRect(0, 0, w, h);
    // 풀빛 얼룩(짙고 옅은 구역) — 위에서 본 잔디의 얼룩.
    const patches = Math.round((w * h) / 70000);
    for (let i = 0; i < patches; i++) {
      softBlob(g, rand() * w, rand() * h, 120 + rand() * 260, rand() < 0.5 ? "150 196 120" : "232 244 214", 0.16);
    }
    // 풀포기 — 짧은 곡선 두세 가닥씩.
    const tufts = Math.round((w * h) / 1500);
    g.lineCap = "round";
    for (let i = 0; i < tufts; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const n = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const len = 6 + rand() * 8;
        const a = -Math.PI / 2 + (rand() - 0.5) * 1.5;
        const bend = (rand() - 0.5) * 6;
        g.strokeStyle = rand() < 0.5 ? "rgb(140 190 118 / 0.62)" : "rgb(112 168 104 / 0.55)";
        g.lineWidth = 1.2 + rand() * 0.8;
        g.beginPath();
        g.moveTo(x + k * 2 - 2, y);
        g.quadraticCurveTo(x + k * 2 - 2 + bend, y + Math.sin(a) * len * 0.5, x + k * 2 - 2 + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
    // 클로버(세 잎) 몇 + 작은 데이지 + 흩어진 연분홍 꽃잎.
    const clovers = Math.round((w * h) / 60000);
    for (let i = 0; i < clovers; i++) {
      const x = rand() * w;
      const y = rand() * h;
      g.fillStyle = "rgb(96 150 92 / 0.55)";
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + rand() * 0.3;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 3.4, 2.6, a, 0, TAU);
        g.fill();
      }
    }
    const daisies = Math.round((w * h) / 90000);
    for (let i = 0; i < daisies; i++) {
      const x = rand() * w;
      const y = rand() * h;
      g.fillStyle = "rgb(255 255 255 / 0.92)";
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 1.8, a, 0, TAU);
        g.fill();
      }
      g.fillStyle = "rgb(240 214 120 / 0.95)";
      g.beginPath();
      g.arc(x, y, 2.2, 0, TAU);
      g.fill();
    }
    const petals = Math.round((w * h) / 120000);
    for (let i = 0; i < petals; i++) {
      g.fillStyle = "rgb(244 200 216 / 0.7)";
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 4, 2.4, rand() * TAU, 0, TAU);
      g.fill();
    }
    ground = c;
    gw = w;
    gh = h;
    gdpr = dpr;
  }

  function flyCount(f: Frame) {
    return f.q >= 2 ? 3 : f.q === 1 ? 2 : 1;
  }
  function newFly(): Fly {
    return {
      x: rand() * w,
      y: rand() * h,
      hd: rand() * TAU,
      spd: 46 + rand() * 40,
      tx: rand() * w,
      ty: rand() * h,
      next: 0,
      ph: rand() * TAU,
      bob: rand() * TAU,
      col: Math.floor(rand() * WINGS.length),
      flee: 0,
      loop: 0,
      k: 0.62 + rand() * 0.28
    };
  }
  function burst(x: number, y: number, col: number, q: number) {
    const c = WINGS[col];
    const n = q >= 1 ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const sp = 90 + rand() * 220;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        r: 2 + rand() * 3.5,
        col: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? c.a : c.b,
        a: rand() * TAU,
        va: (rand() - 0.5) * 12
      });
    }
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      bakeWings();
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
      const n = flyCount(f);
      while (flies.length < n) flies.push(newFly());
      if (flies.length > n) flies.length = n;
    },
    step(f) {
      const { dt, t, p } = f;
      for (let i = 0; i < flies.length; i++) {
        const b = flies[i];
        if (t > b.next) {
          b.tx = 40 + rand() * (w - 80);
          b.ty = 40 + rand() * (h - 80);
          b.next = t + 2.5 + rand() * 4;
          b.spd = 42 + rand() * 44;
        }
        // 포인터 회피 — 가까우면 반대쪽으로 도망(속도 2.4배, 날갯짓 빨라짐).
        if (p.inside) {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 130 && d > 0.001) {
            b.tx = clamp(b.x + (dx / d) * 320, 30, w - 30);
            b.ty = clamp(b.y + (dy / d) * 320, 30, h - 30);
            b.flee = 1.1;
            b.next = t + 1.4;
          }
        }
        const fleeing = b.flee > 0;
        if (fleeing) b.flee -= dt;
        if (b.loop > 0) {
          b.loop -= dt;
          b.hd += (TAU / 0.65) * dt;
        } else {
          const want = Math.atan2(b.ty - b.y, b.tx - b.x);
          let diff = want - b.hd;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const turn = (fleeing ? 7 : 2.6) * dt;
          b.hd += clamp(diff, -turn, turn) + Math.sin(t * 4.2 + i * 1.7) * 0.9 * dt;
        }
        const sp = b.spd * (fleeing ? 2.4 : 1) * (b.loop > 0 ? 0.6 : 1);
        b.x += Math.cos(b.hd) * sp * dt;
        b.y += Math.sin(b.hd) * sp * dt;
        b.ph += (fleeing ? 30 : 14) * dt;
        b.bob += (fleeing ? 3.6 : 1.7) * dt;
        if (b.x < -30) b.x = w + 20;
        else if (b.x > w + 30) b.x = -20;
        if (b.y < -30) b.y = h + 20;
        else if (b.y > h + 30) b.y = -20;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt / 0.9;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= Math.pow(0.04, dt);
        s.vy *= Math.pow(0.04, dt);
        s.a += s.va * dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }
    },
    draw(g, f) {
      const { t } = f;
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      // 지나가는 빛 얼룩 둘 — 풀이 반짝인다(느린 이동, radial 두 장).
      softBlob(g, f.w * (0.3 + 0.2 * Math.sin(t * 0.09)), f.h * (0.4 + 0.25 * Math.cos(t * 0.07)), f.w * 0.28, "255 255 236", 0.16);
      softBlob(g, f.w * (0.7 + 0.18 * Math.cos(t * 0.06 + 2)), f.h * (0.6 + 0.2 * Math.sin(t * 0.08 + 1)), f.w * 0.24, "255 255 236", 0.13);
      // 꽃잎·반짝이(클릭 폭발)
      for (const s of sparks) {
        g.save();
        g.globalAlpha = Math.max(0, s.life);
        g.translate(s.x, s.y);
        g.rotate(s.a);
        g.fillStyle = s.col;
        g.beginPath();
        g.ellipse(0, 0, s.r * (0.5 + s.life * 0.6), s.r * 0.55, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      // 나비 — 그림자(높이만큼 멀리·옅게) → 날개(날갯짓 = 몸 축과 직각으로 접힘) → 몸통.
      for (const b of flies) {
        const hgt = 0.5 + 0.5 * Math.sin(b.bob);
        const flap = Math.abs(Math.cos(b.ph));
        g.save();
        g.translate(b.x + 5 + 9 * hgt, b.y + 7 + 12 * hgt);
        g.rotate(b.hd + Math.PI / 2);
        g.scale(flap * b.k, b.k);
        g.globalAlpha = 0.18 * (1 - 0.45 * hgt);
        g.fillStyle = "#2a3a2a";
        g.beginPath();
        g.ellipse(0, 0, 26, 24, 0, 0, TAU);
        g.fill();
        g.restore();
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.hd + Math.PI / 2);
        g.save();
        g.scale(Math.max(0.12, flap) * b.k * (1 + 0.06 * hgt), b.k * (1 + 0.06 * hgt));
        g.drawImage(wings[b.col], -SPR / 2, -SPR / 2);
        g.restore();
        g.scale(b.k, b.k);
        g.strokeStyle = "#3b3346";
        g.lineWidth = 2.2;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(0, -10);
        g.lineTo(0, 12);
        g.stroke();
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -10);
        g.lineTo(-5, -17);
        g.moveTo(0, -10);
        g.lineTo(5, -17);
        g.stroke();
        g.fillStyle = "#3b3346";
        g.beginPath();
        g.arc(0, -10, 2.4, 0, TAU);
        g.fill();
        g.restore();
      }
    },
    pointerDown(f) {
      // 나비는 어디서든 누를 수 있다(칸 위라면 칸 선택도 같이 일어난다 — 장난감이니 괜찮다).
      for (const b of flies) {
        if (Math.hypot(b.x - f.p.x, b.y - f.p.y) < 28 * b.k + 8) {
          burst(b.x, b.y, b.col, f.q);
          b.loop = 0.65;
          b.flee = 1.6;
          b.tx = clamp(b.x + (rand() - 0.5) * 600, 30, w - 30);
          b.ty = clamp(b.y + (rand() - 0.5) * 600, 30, h - 30);
          b.next = f.t + 2;
          return true;
        }
      }
      return false;
    },
    debug() {
      return { flies: flies.map((b) => [Math.round(b.x), Math.round(b.y), b.flee > 0 ? 1 : 0]), sparks: sparks.length };
    }
  };
}
