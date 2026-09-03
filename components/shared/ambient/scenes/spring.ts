// 봄 — "풀밭을 위에서 내려다본다". 바탕(연둣빛 필름 + 풀포기 수백 + 클로버·작은 데이지·꽃잎 몇)은 한 번 굽고,
// 빛 얼룩 둘이 느리게 지나가며 풀이 반짝인다. 나비 두어 마리가 그림자를 끌며 날아다니고(높이에 따라 그림자가
// 멀어지고 옅어진다), 방향을 틀 때 몸이 기울어(bank) 한쪽 날개가 좁아 보인다. 가끔 데이지에 내려앉아 천천히 날개를
// 여닫다가 다시 난다. 포인터가 다가가면 팔랑거리며 달아나고(2026-09-04 사용자), 누르면 꽃잎·반짝이가 터지며 한 바퀴
// 돌아 날아간다. 날개는 매 프레임 그린다(마리당 경로 넷 — 스프라이트 늘리기보다 싸고 접힘·기울기가 자연스럽다).
// 색은 木(초목)·水(이슬) — 쨍한 햇빛·붉은 꽃은 쓰지 않는다(CLAUDE.md Owner-fit palette).

import type { Frame, Scene } from "../scene-engine";
import { clamp, makeCanvas, rng, shadowSprite, softBlob, TAU } from "./util";

const WINGS = [
  { a: "#c9b9ee", b: "#a08fd8", rim: "#6f5db3", spot: "#ffffff", eye: "#4a3f7a" },
  { a: "#f7d3e2", b: "#e2a9c4", rim: "#b7708f", spot: "#fff8fb", eye: "#7a4a62" },
  { a: "#fbe9b0", b: "#e2c874", rim: "#a68a3a", spot: "#ffffff", eye: "#6b5a26" },
  { a: "#bfe0ec", b: "#8ec3d8", rim: "#5a93ad", spot: "#f6fcff", eye: "#2f5b6e" }
];

type State = "fly" | "land" | "sit";
type Fly = {
  x: number;
  y: number;
  hd: number;
  spd: number;
  tx: number;
  ty: number;
  next: number;
  ph: number;
  bob: number;
  col: number;
  flee: number;
  loop: number;
  k: number;
  bank: number;
  state: State;
  sit: number;
  nextLand: number;
  w1: number; // 개체별 요동 위상
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string; a: number; va: number; star: boolean };

export function createSpring(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  let shadow: HTMLCanvasElement | null = null;
  const daisies: [number, number][] = [];
  const flies: Fly[] = [];
  const sparks: Spark[] = [];
  let w = 0;
  let h = 0;
  let fleeCount = 0;

  function bakeGround(dpr: number) {
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    g.fillStyle = "rgb(214 232 200 / 0.42)";
    g.fillRect(0, 0, w, h);
    const patches = Math.round((w * h) / 70000);
    for (let i = 0; i < patches; i++) {
      softBlob(g, rand() * w, rand() * h, 120 + rand() * 260, rand() < 0.5 ? "150 196 120" : "232 244 214", 0.16);
    }
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
    daisies.length = 0;
    const nd = Math.round((w * h) / 80000);
    for (let i = 0; i < nd; i++) {
      const x = rand() * w;
      const y = rand() * h;
      daisies.push([x, y]);
      g.fillStyle = "rgb(255 255 255 / 0.92)";
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * 4.2, y + Math.sin(a) * 4.2, 3.2, 1.9, a, 0, TAU);
        g.fill();
      }
      g.fillStyle = "rgb(240 214 120 / 0.95)";
      g.beginPath();
      g.arc(x, y, 2.3, 0, TAU);
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
    return f.q >= 2 ? 3 : 2;
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
      k: 0.62 + rand() * 0.3,
      bank: 0,
      state: "fly",
      sit: 0,
      nextLand: 4 + rand() * 8,
      w1: rand() * TAU
    };
  }
  function burst(x: number, y: number, col: number, q: number) {
    const c = WINGS[col];
    const n = q >= 1 ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const sp = 90 + rand() * 230;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        r: 2 + rand() * 3.5,
        col: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? c.a : c.b,
        a: rand() * TAU,
        va: (rand() - 0.5) * 12,
        star: i % 4 === 0
      });
    }
  }

  // 날개 한 쪽(오른쪽 기준; 왼쪽은 scale(-1,1)). 몸 축 = -y(앞). 단위는 k=1일 때 px.
  function wing(g: CanvasRenderingContext2D, c: (typeof WINGS)[number]) {
    // 앞날개 — 끝이 뾰족하고 바깥 가장자리가 물결친다.
    g.beginPath();
    g.moveTo(2, -3);
    g.bezierCurveTo(8, -20, 22, -30, 31, -25);
    g.bezierCurveTo(35, -21, 33, -13, 34, -8);
    g.quadraticCurveTo(31, -6, 30, -3);
    g.quadraticCurveTo(26, 1, 20, 2);
    g.quadraticCurveTo(12, 3, 3, 1);
    g.closePath();
    g.fillStyle = c.a;
    g.fill();
    g.strokeStyle = c.rim;
    g.lineWidth = 1.3;
    g.stroke();
    // 뒷날개 — 둥글고 아래로 꼬리가 살짝.
    g.beginPath();
    g.moveTo(3, 3);
    g.bezierCurveTo(14, 3, 24, 8, 22, 16);
    g.bezierCurveTo(21, 21, 16, 25, 12, 24);
    g.quadraticCurveTo(10, 28, 8, 25);
    g.bezierCurveTo(5, 22, 3, 16, 3, 9);
    g.closePath();
    g.fillStyle = c.b;
    g.fill();
    g.stroke();
    // 잎맥(시맥) — 밑동에서 방사.
    g.strokeStyle = c.rim;
    g.globalAlpha = 0.35;
    g.lineWidth = 0.8;
    g.beginPath();
    for (const [x, y] of [[30, -23], [33, -12], [26, -1], [21, 14], [11, 22]]) {
      g.moveTo(3, 0);
      g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
    // 눈알 무늬 + 흰 점
    g.fillStyle = c.eye;
    g.beginPath();
    g.arc(20, -13, 4.2, 0, TAU);
    g.fill();
    g.fillStyle = c.spot;
    g.beginPath();
    g.arc(20, -13, 2, 0, TAU);
    g.fill();
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(29, -20, 1.7, 0, TAU);
    g.arc(31, -13, 1.3, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(15, 14, 1.8, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!shadow) shadow = shadowSprite(64, 44, "40 60 40", 0.55);
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
      const n = flyCount(f);
      while (flies.length < n) flies.push(newFly());
      if (flies.length > n) flies.length = n;
    },
    step(f) {
      const { dt, t, p } = f;
      for (let i = 0; i < flies.length; i++) {
        const b = flies[i];
        // 포인터 회피 — 가까우면 반대쪽으로 도망(속도 2.6배, 날갯짓 빨라짐, 앉아 있어도 날아오른다).
        if (p.inside) {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 140 && d > 0.001) {
            b.tx = clamp(b.x + (dx / d) * 340 + (rand() - 0.5) * 80, 30, w - 30);
            b.ty = clamp(b.y + (dy / d) * 340 + (rand() - 0.5) * 80, 30, h - 30);
            if (b.flee <= 0) fleeCount++;
            b.flee = 1.2;
            b.next = t + 1.5;
            if (b.state !== "fly") {
              b.state = "fly";
              b.nextLand = t + 10 + rand() * 10;
            }
          }
        }
        const fleeing = b.flee > 0;
        if (fleeing) b.flee -= dt;
        if (b.state === "sit") {
          b.sit -= dt;
          b.ph += 3.2 * dt; // 앉아서 천천히 여닫음
          b.bob = -Math.PI / 2; // 높이 0
          b.bank *= 0.9;
          if (b.sit <= 0) {
            b.state = "fly";
            b.tx = 40 + rand() * (w - 80);
            b.ty = 40 + rand() * (h - 80);
            b.next = t + 3 + rand() * 3;
            b.nextLand = t + 12 + rand() * 14;
            b.bob = -Math.PI / 2 + 0.2;
          }
          continue;
        }
        if (b.state === "fly" && t > b.nextLand && daisies.length && !fleeing && f.q >= 1) {
          // 가까운 데이지로 착지하러 간다.
          let best = -1;
          let bd = Infinity;
          for (let k = 0; k < daisies.length; k++) {
            const d = Math.hypot(daisies[k][0] - b.x, daisies[k][1] - b.y);
            if (d < bd && d > 60) {
              bd = d;
              best = k;
            }
          }
          if (best >= 0 && bd < 700) {
            b.state = "land";
            b.tx = daisies[best][0];
            b.ty = daisies[best][1];
          } else b.nextLand = t + 8;
        }
        if (t > b.next && b.state === "fly") {
          b.tx = 40 + rand() * (w - 80);
          b.ty = 40 + rand() * (h - 80);
          b.next = t + 2.5 + rand() * 4;
          b.spd = 42 + rand() * 44;
        }
        if (b.loop > 0) {
          b.loop -= dt;
          b.hd += (TAU / 0.65) * dt;
          b.bank = 0.6;
        } else {
          const want = Math.atan2(b.ty - b.y, b.tx - b.x);
          let diff = want - b.hd;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const turn = (fleeing ? 7 : b.state === "land" ? 3.4 : 2.6) * dt;
          const steer = clamp(diff, -turn, turn);
          const wobble = (Math.sin(t * 5.1 + b.w1) * 0.9 + Math.sin(t * 2.3 + b.w1 * 2) * 0.5) * dt;
          b.hd += steer + (b.state === "land" ? wobble * 0.3 : wobble);
          // 방향을 트는 만큼 몸이 기운다(한쪽 날개가 좁아 보임).
          const targetBank = clamp((steer / Math.max(dt, 0.001)) * 0.16 + Math.sin(t * 5.1 + b.w1) * 0.12, -0.55, 0.55);
          b.bank += (targetBank - b.bank) * Math.min(1, dt * 6);
        }
        const dist = Math.hypot(b.tx - b.x, b.ty - b.y);
        let sp = b.spd * (fleeing ? 2.6 : 1) * (b.loop > 0 ? 0.6 : 1) * (1 + 0.18 * Math.sin(t * 1.7 + b.w1));
        if (b.state === "land") sp = Math.max(18, Math.min(sp, dist * 1.6));
        b.x += Math.cos(b.hd) * sp * dt;
        b.y += Math.sin(b.hd) * sp * dt;
        b.ph += (fleeing ? 44 : b.state === "land" ? 26 : 20) * dt;
        b.bob += (fleeing ? 3.8 : 1.9) * dt;
        if (b.state === "land" && dist < 6) {
          b.state = "sit";
          b.sit = 2 + rand() * 2.5;
          b.x = b.tx;
          b.y = b.ty;
        }
        if (b.x < -30) b.x = w + 20;
        else if (b.x > w + 30) b.x = -20;
        if (b.y < -30) b.y = h + 20;
        else if (b.y > h + 30) b.y = -20;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt / 0.95;
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
      softBlob(g, f.w * (0.3 + 0.2 * Math.sin(t * 0.09)), f.h * (0.4 + 0.25 * Math.cos(t * 0.07)), f.w * 0.28, "255 255 236", 0.16);
      softBlob(g, f.w * (0.7 + 0.18 * Math.cos(t * 0.06 + 2)), f.h * (0.6 + 0.2 * Math.sin(t * 0.08 + 1)), f.w * 0.24, "255 255 236", 0.13);
      for (const s of sparks) {
        g.save();
        g.globalAlpha = Math.max(0, s.life);
        g.translate(s.x, s.y);
        g.rotate(s.a);
        g.fillStyle = s.col;
        g.beginPath();
        if (s.star) {
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU;
            g.moveTo(0, 0);
            g.lineTo(Math.cos(a) * s.r * 1.6, Math.sin(a) * s.r * 1.6);
          }
          g.strokeStyle = s.col;
          g.lineWidth = 1.2;
          g.stroke();
        } else {
          g.ellipse(0, 0, s.r * (0.5 + s.life * 0.6), s.r * 0.55, 0, 0, TAU);
          g.fill();
        }
        g.restore();
      }
      for (const b of flies) {
        const sitting = b.state === "sit";
        const hgt = sitting ? 0 : 0.5 + 0.5 * Math.sin(b.bob);
        const raw = Math.abs(Math.cos(b.ph));
        const flap = sitting ? 0.35 + 0.65 * raw : 0.14 + 0.86 * Math.pow(raw, 0.8);
        const size = b.k * (1 + 0.08 * hgt);
        // 그림자 — 높이만큼 멀리·옅게·크게(빛은 왼쪽 위).
        if (shadow) {
          g.save();
          g.translate(b.x + 5 + 10 * hgt, b.y + 7 + 13 * hgt);
          g.rotate(b.hd + Math.PI / 2);
          g.scale(flap * size * 1.35 * (1 + 0.25 * hgt), size * 1.2 * (1 + 0.25 * hgt));
          g.globalAlpha = 0.32 * (1 - 0.5 * hgt);
          g.drawImage(shadow, -32, -22);
          g.restore();
        }
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.hd + Math.PI / 2);
        g.scale(size, size);
        const c = WINGS[b.col];
        const left = flap * (1 - b.bank * 0.45);
        const right = flap * (1 + b.bank * 0.45);
        g.save();
        g.scale(-Math.max(0.1, left), 1);
        wing(g, c);
        g.restore();
        g.save();
        g.scale(Math.max(0.1, right), 1);
        wing(g, c);
        g.restore();
        // 몸통 — 가늘고 마디가 있는 검은 몸, 머리, 곤봉 더듬이.
        g.strokeStyle = "#3b3346";
        g.lineCap = "round";
        g.lineWidth = 3.2;
        g.beginPath();
        g.moveTo(0, -8);
        g.lineTo(0, 14);
        g.stroke();
        g.strokeStyle = "rgb(255 255 255 / 0.35)";
        g.lineWidth = 0.8;
        g.beginPath();
        for (let y = -2; y <= 12; y += 3.5) {
          g.moveTo(-1.4, y);
          g.lineTo(1.4, y);
        }
        g.stroke();
        g.fillStyle = "#3b3346";
        g.beginPath();
        g.arc(0, -9.5, 2.6, 0, TAU);
        g.fill();
        g.strokeStyle = "#3b3346";
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(-1, -11);
        g.quadraticCurveTo(-5, -16, -7, -20);
        g.moveTo(1, -11);
        g.quadraticCurveTo(5, -16, 7, -20);
        g.stroke();
        g.beginPath();
        g.arc(-7, -20.5, 1.1, 0, TAU);
        g.arc(7, -20.5, 1.1, 0, TAU);
        g.fill();
        g.restore();
      }
    },
    pointerDown(f) {
      for (const b of flies) {
        if (Math.hypot(b.x - f.p.x, b.y - f.p.y) < 30 * b.k + 8) {
          burst(b.x, b.y, b.col, f.q);
          b.loop = 0.65;
          b.flee = 1.6;
          b.state = "fly";
          b.nextLand = f.t + 12;
          b.tx = clamp(b.x + (rand() - 0.5) * 600, 30, w - 30);
          b.ty = clamp(b.y + (rand() - 0.5) * 600, 30, h - 30);
          b.next = f.t + 2;
          return true;
        }
      }
      return false;
    },
    debug() {
      return {
        flies: flies.map((b) => [Math.round(b.x), Math.round(b.y), b.flee > 0 ? 1 : 0, b.state]),
        sparks: sparks.length,
        fled: fleeCount,
        daisies: daisies.length
      };
    }
  };
}
