// 봄 — "풀밭을 위에서 내려다본다". 바탕(연둣빛 필름 + 풀포기 수백 + 클로버·작은 데이지·꽃잎 몇)은 한 번 굽고,
// 빛 얼룩 둘이 느리게 지나가며 풀이 반짝인다. 나비가 그림자를 끌며 날아다니고(높이에 따라 그림자가 멀어지고 옅어진다),
// 방향을 틀 때 몸이 기울어(bank) 한쪽 날개가 좁아 보인다. 가끔 데이지에 내려앉아 천천히 날개를 여닫다가 다시 난다.
// 포인터가 다가가면 팔랑거리며 달아나고, 누르면 꽃잎·반짝이가 터지며 한 바퀴 돌아 날아간다. 바탕을 누르면 풀이 밟힌다.
// 랜덤 이벤트(2026-09-04 사용자): **무당벌레**(public/ambient/ladybug.svg)가 풀밭을 기어다닌다 — 멈췄다 걷고, 포인터가
// 다가오면 종종걸음으로 피하고, 누르면 날개를 펴고 카메라 쪽으로 날아올라 사라졌다가 가장자리에서 다시 온다. 그리고
// 이따금 **꽃잎 바람** — 연분홍 꽃잎 수십 장이 한쪽에서 흘러 들어와 천천히 가로지른다.
// 여력(f.load): 나비 1~3마리(늘 때는 가장자리에서 날아 들어오고, 줄 때는 가장자리로 날아 나간다), 무당벌레 0~2,
// 꽃잎 바람·포인터 회피는 여력이 있을 때만. 날개는 매 프레임 그린다(마리당 경로 넷 — 스프라이트보다 접힘·기울기가 자연스럽다).
// 색은 木(초목)·水(이슬) — 쨍한 햇빛·붉은 꽃은 쓰지 않는다(CLAUDE.md Owner-fit palette).

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawSprite, loadSprite, type Sprite } from "../assets";
import { clamp, lerp, makeCanvas, rng, shadowSprite, softBlob, TAU } from "./util";

const WINGS = [
  { a: "#c9b9ee", b: "#a08fd8", rim: "#6f5db3", spot: "#ffffff", eye: "#4a3f7a" },
  { a: "#f7d3e2", b: "#e2a9c4", rim: "#b7708f", spot: "#fff8fb", eye: "#7a4a62" },
  { a: "#fbe9b0", b: "#e2c874", rim: "#a68a3a", spot: "#ffffff", eye: "#6b5a26" },
  { a: "#bfe0ec", b: "#8ec3d8", rim: "#5a93ad", spot: "#f6fcff", eye: "#2f5b6e" }
];

type State = "fly" | "land" | "sit" | "leave";
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
// 풀 밟힘(2026-09-04 사용자: "잔디 클릭하면 주변 잔디가 밟히든 흔들리든") — 누른 자리 둘레의 풀잎이 바깥으로 눕혔다
// 되살아나고(sin 곡선), 발자국 그늘이 잠깐 남고, 꽃가루가 흩날린다.
type Press = { x: number; y: number; life: number; r: number; blades: { a: number; r0: number; len: number; w: number; col: string }[] };
type BugState = "walk" | "pause" | "flee" | "off";
type Bug = { x: number; y: number; hd: number; spd: number; state: BugState; until: number; k: number; ph: number; off: number; respawn: number };
type Petal = { x: number; y: number; vx: number; ph: number; a: number; va: number; born: number; dur: number; k: number };

export function createSpring(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  let shadow: HTMLCanvasElement | null = null;
  let petalSpr: HTMLCanvasElement | null = null;
  let bugSpr: Sprite | null = null;
  const daisies: [number, number][] = [];
  const flies: Fly[] = [];
  const sparks: Spark[] = [];
  const presses: Press[] = [];
  const bugs: Bug[] = [];
  const petals: Petal[] = [];
  let nextBreeze = 9;
  let breezes = 0;
  let bugsFled = 0;
  let w = 0;
  let h = 0;
  let fleeCount = 0;
  let pressCount = 0;

  function press(x: number, y: number, load: number) {
    const n = load >= 0.5 ? 18 : 9;
    const blades: Press["blades"] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (rand() - 0.5) * 0.4;
      blades.push({
        a,
        r0: 8 + rand() * 20,
        len: 9 + rand() * 9,
        w: 1.2 + rand() * 1,
        col: rand() < 0.5 ? "112 168 104" : "140 190 118"
      });
    }
    presses.push({ x, y, life: 1, r: 26 + rand() * 10, blades });
    pressCount++;
    const pollen = load >= 0.5 ? 7 : 3;
    for (let i = 0; i < pollen; i++) {
      const b = rand() * TAU;
      const sp = 40 + rand() * 90;
      sparks.push({ x, y, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp - 30, life: 1, r: 1.4 + rand() * 1.6, col: "#fff3b0", a: 0, va: 0, star: false });
    }
  }

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
    const nPetals = Math.round((w * h) / 120000);
    for (let i = 0; i < nPetals; i++) {
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
  function bakeSprites() {
    if (petalSpr) return;
    shadow = shadowSprite(64, 44, "40 60 40", 0.55);
    const { c, g } = makeCanvas(28, 28);
    g.translate(14, 14);
    g.fillStyle = "rgb(246 206 220)";
    g.beginPath();
    g.ellipse(0, 0, 9, 5.2, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgb(255 236 242 / 0.6)";
    g.beginPath();
    g.ellipse(-2.5, -1.2, 4, 2.2, -0.3, 0, TAU);
    g.fill();
    g.strokeStyle = "rgb(214 150 176 / 0.6)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(0, 0, 9, 5.2, 0, 0, TAU);
    g.stroke();
    petalSpr = c;
    void loadSprite(ASSET.ladybug, 14, 16).then((s) => (bugSpr = s)).catch(() => {});
  }

  const flyTarget = (f: Frame) => clamp(1 + Math.round(f.load * 2.4), 1, 3);
  function newFly(t: number, fromEdge: boolean): Fly {
    const b: Fly = {
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
      nextLand: t + 4 + rand() * 8,
      w1: rand() * TAU
    };
    if (fromEdge) {
      const e = Math.floor(rand() * 4);
      b.x = e === 0 ? -30 : e === 1 ? w + 30 : rand() * w;
      b.y = e === 2 ? -30 : e === 3 ? h + 30 : rand() * h;
      b.tx = w * (0.2 + rand() * 0.6);
      b.ty = h * (0.2 + rand() * 0.6);
      b.hd = Math.atan2(b.ty - b.y, b.tx - b.x);
      b.next = t + 3;
    }
    return b;
  }
  function burst(x: number, y: number, col: number, load: number) {
    const c = WINGS[col];
    const n = load >= 0.3 ? 18 : 9;
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
  const bugTarget = (load: number) => (load >= 0.85 ? 2 : load >= 0.45 ? 1 : 0);
  function newBug(t: number): Bug {
    const e = Math.floor(rand() * 4);
    const x = e === 0 ? -12 : e === 1 ? w + 12 : rand() * w;
    const y = e === 2 ? -12 : e === 3 ? h + 12 : rand() * h;
    return { x, y, hd: Math.atan2(h / 2 - y, w / 2 - x) + (rand() - 0.5), spd: 18 + rand() * 14, state: "walk", until: t + 3 + rand() * 4, k: 0.9 + rand() * 0.25, ph: rand() * TAU, off: 0, respawn: 0 };
  }
  function breeze(t: number, load: number) {
    const dir = rand() < 0.5 ? 1 : -1;
    const n = Math.round(lerp(18, 40, load));
    for (let i = 0; i < n; i++) {
      const dur = 7 + rand() * 4;
      petals.push({
        x: dir > 0 ? -40 - rand() * 300 : w + 40 + rand() * 300,
        y: rand() * h,
        vx: dir * (90 + rand() * 70),
        ph: rand() * TAU,
        a: rand() * TAU,
        va: (rand() - 0.5) * 4,
        born: t + rand() * 1.5,
        dur,
        k: 0.7 + rand() * 0.6
      });
    }
    breezes++;
  }

  // 날개 한 쪽(오른쪽 기준; 왼쪽은 scale(-1,1)). 몸 축 = -y(앞). 단위는 k=1일 때 px.
  function wing(g: CanvasRenderingContext2D, c: (typeof WINGS)[number]) {
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
      bakeSprites();
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
      if (!flies.length) {
        const n = flyTarget(f);
        while (flies.length < n) flies.push(newFly(f.t, false));
      }
    },
    step(f) {
      const { dt, t, p, load } = f;
      // 나비 수 점진 조절 — 늘면 가장자리에서 날아 들어오고, 줄면 한 마리가 가장자리로 날아 나간다.
      const want = flyTarget(f);
      const staying = flies.filter((b) => b.state !== "leave").length;
      if (staying < want) flies.push(newFly(t, true));
      else if (staying > want) {
        const b = flies.find((x) => x.state !== "leave");
        if (b) {
          b.state = "leave";
          b.tx = b.x < w / 2 ? -80 : w + 80;
          b.ty = clamp(b.y + (rand() - 0.5) * 300, -80, h + 80);
        }
      }
      for (let i = flies.length - 1; i >= 0; i--) {
        const b = flies[i];
        if (b.state === "leave" && (b.x < -60 || b.x > w + 60 || b.y < -60 || b.y > h + 60)) {
          flies.splice(i, 1);
          continue;
        }
        // 포인터 회피 — 가까우면 반대쪽으로 도망(속도 2.6배, 날갯짓 빨라짐, 앉아 있어도 날아오른다). 여력 0.35부터.
        if (p.inside && load >= 0.35 && b.state !== "leave") {
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
          b.ph += 3.2 * dt;
          b.bob = -Math.PI / 2;
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
        if (b.state === "fly" && t > b.nextLand && daisies.length && !fleeing && load >= 0.2) {
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
        if (b.state !== "leave") {
          if (b.x < -30) b.x = w + 20;
          else if (b.x > w + 30) b.x = -20;
          if (b.y < -30) b.y = h + 20;
          else if (b.y > h + 30) b.y = -20;
        }
      }
      // 무당벌레 — 수는 여력으로(0~2). 걷기 ↔ 멈춤, 포인터 70px 안이면 종종걸음으로 반대쪽.
      const bt = bugTarget(load);
      while (bugs.length < bt) bugs.push(newBug(t));
      if (bugs.length > bt) {
        const b = bugs.find((x) => x.state !== "off");
        if (b) {
          b.state = "off";
          b.off = 0;
          b.respawn = Infinity;
        }
      }
      for (let i = bugs.length - 1; i >= 0; i--) {
        const b = bugs[i];
        if (b.state === "off") {
          b.off += dt / 0.8;
          if (b.off >= 1) {
            if (b.respawn === Infinity) bugs.splice(i, 1);
            else if (t > b.respawn) bugs[i] = newBug(t);
          } else {
            b.x += Math.cos(b.hd) * 180 * dt;
            b.y += Math.sin(b.hd) * 180 * dt;
            b.ph += 40 * dt;
          }
          continue;
        }
        if (p.inside && load >= 0.35 && b.state !== "flee") {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 70 && d > 0.001) {
            b.state = "flee";
            b.hd = Math.atan2(dy, dx) + (rand() - 0.5) * 0.6;
            b.until = t + 1.1;
            bugsFled++;
          }
        }
        if (t > b.until) {
          if (b.state === "walk") {
            b.state = "pause";
            b.until = t + 0.8 + rand() * 2;
          } else {
            b.state = "walk";
            b.hd += (rand() - 0.5) * 1.6;
            b.until = t + 2.5 + rand() * 4;
          }
        }
        if (b.state !== "pause") {
          const sp = b.spd * (b.state === "flee" ? 2.6 : 1);
          b.hd += (rand() - 0.5) * 1.4 * dt;
          b.x += Math.cos(b.hd) * sp * dt;
          b.y += Math.sin(b.hd) * sp * dt;
          b.ph += sp * 0.5 * dt;
          // 화면 밖으로 나가면 안쪽으로 돌아선다.
          const m = 10;
          if (b.x < -m || b.x > w + m || b.y < -m || b.y > h + m) b.hd = Math.atan2(h / 2 - b.y, w / 2 - b.x) + (rand() - 0.5) * 0.4;
        }
      }
      // 꽃잎 바람 — 여력 0.55부터, 20~45초 간격.
      if (load >= 0.55 && t > nextBreeze) {
        breeze(t, load);
        nextBreeze = t + 20 + rand() * 25;
      }
      for (let i = petals.length - 1; i >= 0; i--) {
        const q = petals[i];
        if (t < q.born) continue;
        const age = t - q.born;
        if (age > q.dur) {
          petals.splice(i, 1);
          continue;
        }
        q.x += q.vx * dt;
        q.y += Math.sin(t * 1.3 + q.ph) * 26 * dt;
        q.a += q.va * dt;
      }
      for (let i = presses.length - 1; i >= 0; i--) {
        presses[i].life -= dt / 1.1;
        if (presses[i].life <= 0) presses.splice(i, 1);
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
      // 풀 밟힘 — 발자국 그늘 + 바깥으로 누웠다 일어서는 풀잎(진행 p: 0→1, 눕는 정도 sin(πp)).
      for (const pr of presses) {
        const p = 1 - pr.life;
        const bend = Math.sin(Math.PI * Math.min(1, p * 1.15));
        g.fillStyle = `rgb(60 96 60 / ${0.14 * pr.life})`;
        g.beginPath();
        g.ellipse(pr.x, pr.y, pr.r * 0.55, pr.r * 0.4, 0, 0, TAU);
        g.fill();
        g.lineCap = "round";
        for (const bl of pr.blades) {
          const bx = pr.x + Math.cos(bl.a) * bl.r0;
          const by = pr.y + Math.sin(bl.a) * bl.r0;
          const ux = Math.cos(bl.a);
          const uy = Math.sin(bl.a);
          const tipx = bx + (ux * bend * 0.9) * bl.len;
          const tipy = by + (-1 * (1 - bend * 0.7) + uy * bend * 0.9) * bl.len;
          const cx = bx + (ux * bend * 0.5) * bl.len * 0.5;
          const cy = by - (1 - bend * 0.5) * bl.len * 0.55;
          g.strokeStyle = `rgb(${bl.col} / ${0.75 * Math.min(1, pr.life * 2)})`;
          g.lineWidth = bl.w;
          g.beginPath();
          g.moveTo(bx, by);
          g.quadraticCurveTo(cx, cy, tipx, tipy);
          g.stroke();
        }
      }
      // 무당벌레 — 걸을 때 몸이 살짝 좌우로.
      if (bugSpr) {
        for (const b of bugs) {
          const flying = b.state === "off";
          const k = b.k * (flying ? 1 + b.off * 0.9 : 1);
          g.save();
          g.globalAlpha = flying ? 1 - b.off : 1;
          if (shadow && !flying) {
            g.save();
            g.globalAlpha = 0.25;
            g.translate(b.x + 2, b.y + 3);
            g.rotate(b.hd + Math.PI / 2);
            g.drawImage(shadow, -12 * b.k, -9 * b.k, 24 * b.k, 18 * b.k);
            g.restore();
          }
          if (flying) {
            // 펼친 날개 — 두 타원.
            g.save();
            g.translate(b.x, b.y);
            g.rotate(b.hd + Math.PI / 2);
            g.fillStyle = "rgb(60 50 60 / 0.35)";
            for (const s of [-1, 1]) {
              g.beginPath();
              g.ellipse(s * 7 * k, 1, 6 * k * Math.abs(Math.sin(b.ph)), 9 * k, s * 0.5, 0, TAU);
              g.fill();
            }
            g.restore();
          }
          const wob = b.state === "pause" || flying ? 0 : Math.sin(b.ph) * 0.12;
          drawSprite(g, bugSpr, b.x, b.y, b.hd + Math.PI / 2 + wob, k);
          g.restore();
        }
      }
      // 꽃잎 바람.
      if (petalSpr) {
        for (const q of petals) {
          if (t < q.born) continue;
          const age = t - q.born;
          const a = Math.min(1, age / 0.8) * Math.min(1, (q.dur - age) / 1.2);
          g.save();
          g.globalAlpha = a * 0.9;
          g.translate(q.x, q.y);
          g.rotate(q.a);
          g.scale(q.k, q.k * (0.55 + 0.45 * Math.abs(Math.cos(t * 2.1 + q.ph))));
          g.drawImage(petalSpr, -14, -14);
          g.restore();
        }
      }
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
    pointerDown(f, onBackground) {
      if (f.load < 0.15) return false;
      for (const b of flies) {
        if (Math.hypot(b.x - f.p.x, b.y - f.p.y) < 30 * b.k + 8) {
          burst(b.x, b.y, b.col, f.load);
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
      // 무당벌레를 누르면 날개를 펴고 날아오른다(카메라 쪽으로 커지며 사라짐) — 6~10초 뒤 가장자리에서 다시.
      for (const b of bugs) {
        if (b.state !== "off" && Math.hypot(b.x - f.p.x, b.y - f.p.y) < 18) {
          b.state = "off";
          b.off = 0;
          b.respawn = f.t + 6 + rand() * 4;
          return true;
        }
      }
      // 나비를 안 맞혔으면 풀을 밟는다(바탕 위에서만 — 칸·버튼 위 클릭은 그쪽 일).
      if (!onBackground) return false;
      press(f.p.x, f.p.y, f.load);
      return true;
    },
    debug() {
      return {
        flies: flies.map((b) => [Math.round(b.x), Math.round(b.y), b.flee > 0 ? 1 : 0, b.state]),
        sparks: sparks.length,
        fled: fleeCount,
        presses: presses.length,
        pressed: pressCount,
        daisies: daisies.length,
        bugs: bugs.map((b) => [Math.round(b.x), Math.round(b.y), b.state]),
        bugsFled,
        bugSprite: !!bugSpr,
        petals: petals.length,
        breezes
      };
    }
  };
}
