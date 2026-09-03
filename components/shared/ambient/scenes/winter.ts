// 겨울 — "소복이 쌓인 눈밭을 위에서 내려다본다". 바탕(눈밭 + 둔덕 그늘 + 반짝이 + 이미 지나간 발자국 몇 줄)은
// 리사이즈 때 한 번 굽는다. 그 위에서: ① 보이지 않는 누군가가 **걸어간다** — 사람(신발 자국)만이 아니라 **고양이·새·
// 토끼**(2026-09-04 사용자: "동물 발자국 등 계절별 랜덤 이펙트")가 제 걸음걸이(살금살금·콩콩 두 발·뒷발 앞 두 짝)로
// 화면을 가로지르고, 다 지나가면 잠시 뒤 다른 가장자리에서 다음 손님. ② 눈송이가 내려앉는다(위에서 보는 시점이라 점이
// 커지며 나타났다가 바닥에 스며들고, 닿는 순간 옅은 고리가 번진다). ③ 포인터가 빠르게 지나가면 **눈가루가 흩날린다**.
// ④ 바탕을 누르면 그 자리에 발자국 한 쌍 + 눈가루. 자국은 눌린 눈의 푸른 그늘 + 빛 받는 쪽(왼쪽 위) 흰 테.
// LOD: 자국은 종류별 스프라이트 한 장씩 굽고(경로 채우기 ×200/프레임 → drawImage), 여력(f.load)에 따라 눈송이 수·
// 손님 빈도·눈가루·고리를 점진적으로 늘리고 줄인다(툭 사라지지 않게 — 눈송이는 제 수명을 마치고 빠진다).

import type { Frame, Scene } from "../scene-engine";
import { clamp, lerp, makeCanvas, rng, softBlob, TAU } from "./util";

type Flake = { x: number; y: number; life: number; dur: number; wait: number; r: number; rung: boolean };
type Kind = "human" | "cat" | "bird" | "rabbit";
type PrintKind = "sole" | "paw" | "bird" | "rHind" | "rFore";
type Print = { x: number; y: number; a: number; kind: PrintKind; left: boolean; k: number; born: number };
type Dust = { x: number; y: number; vx: number; vy: number; life: number; r: number };
type Ring = { x: number; y: number; life: number };
type Twinkle = { x: number; y: number; ph: number; r: number };
type Walker = { kind: Kind; x: number; y: number; dir: number; left: boolean; k: number; next: number; active: boolean; steps: number };

const SPR: Record<PrintKind, number> = { sole: 36, paw: 20, bird: 18, rHind: 20, rFore: 14 };

export function createWinter(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const sprites = new Map<PrintKind, HTMLCanvasElement>();
  const flakes: Flake[] = [];
  const prints: Print[] = [];
  const dust: Dust[] = [];
  const rings: Ring[] = [];
  const twinkles: Twinkle[] = [];
  const walker: Walker = { kind: "human", x: 0, y: 0, dir: 0, left: false, k: 1, next: 0, active: false, steps: 0 };
  let nextWalker = 2.5;
  let w = 0;
  let h = 0;
  let dustSpawned = 0;
  const visitors: Record<Kind, number> = { human: 0, cat: 0, bird: 0, rabbit: 0 };

  // ── 자국 모양(단위: CSS px, 앞 = 위) ─────────────────────────────────────────────────────────────
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
  function paw(g: CanvasRenderingContext2D) {
    g.beginPath();
    g.ellipse(0, 2.2, 4, 3.4, 0, 0, TAU);
    for (const [x, y, r] of [[-4.2, -2.6, 1.9], [-1.5, -4.6, 2], [1.5, -4.6, 2], [4.2, -2.6, 1.9]] as const) {
      g.moveTo(x + r, y);
      g.ellipse(x, y, r, r * 1.25, 0, 0, TAU);
    }
  }
  function birdFoot(g: CanvasRenderingContext2D) {
    // 세 발가락 앞으로 + 뒷발가락 하나 — 채우기 대신 굵은 선(path fill 호환을 위해 stroke를 fill로 흉내: 얇은 다각형).
    g.beginPath();
    for (const ang of [-38, 0, 38]) {
      const a = ((-90 + ang) * Math.PI) / 180;
      const x = Math.cos(a) * 6.5;
      const y = Math.sin(a) * 6.5;
      const px = -Math.sin(a) * 0.9;
      const py = Math.cos(a) * 0.9;
      g.moveTo(px, py);
      g.lineTo(x + px, y + py);
      g.lineTo(x - px, y - py);
      g.lineTo(-px, -py);
      g.closePath();
    }
    g.moveTo(0.9, 0);
    g.lineTo(0.9, 3.6);
    g.lineTo(-0.9, 3.6);
    g.lineTo(-0.9, 0);
    g.closePath();
    g.moveTo(1.6, 0);
    g.arc(0, 0, 1.6, 0, TAU);
  }
  function rHind(g: CanvasRenderingContext2D) {
    g.beginPath();
    g.ellipse(0, 0, 2.6, 7.2, 0, 0, TAU);
  }
  function rFore(g: CanvasRenderingContext2D) {
    g.beginPath();
    g.ellipse(0, 0, 2.2, 2.6, 0, 0, TAU);
  }
  const SHAPE: Record<PrintKind, (g: CanvasRenderingContext2D) => void> = { sole, paw, bird: birdFoot, rHind, rFore };

  // 눌린 눈 — 왼쪽 위로 1px 밀린 흰 테 + 푸른 그늘 채움(+ 신발은 홈 세 줄).
  function pressed(g: CanvasRenderingContext2D, kind: PrintKind) {
    const shape = SHAPE[kind];
    g.save();
    g.translate(-1.1, -1.1);
    shape(g);
    g.fillStyle = "rgb(255 255 255 / 0.9)";
    g.fill();
    g.restore();
    shape(g);
    const grad = g.createRadialGradient(0.5, 0, 1, 0, 0, 14);
    grad.addColorStop(0, "rgb(168 190 216)");
    grad.addColorStop(1, "rgb(196 212 232)");
    g.fillStyle = grad;
    g.fill();
    if (kind === "sole") {
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
    }
  }
  function bakeSprites() {
    if (sprites.size) return;
    for (const kind of Object.keys(SPR) as PrintKind[]) {
      const s = SPR[kind];
      const { c, g } = makeCanvas(s * 2, s * 2);
      g.scale(2, 2);
      g.translate(s / 2, s / 2);
      pressed(g, kind);
      sprites.set(kind, c);
    }
  }
  function drawPrint(g: CanvasRenderingContext2D, p: Print, alpha: number) {
    const spr = sprites.get(p.kind);
    if (!spr) return;
    const s = SPR[p.kind];
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.a + (p.kind === "sole" ? (p.left ? -0.08 : 0.08) : 0));
    g.scale(p.left ? -p.k : p.k, p.k);
    g.globalAlpha = alpha;
    g.drawImage(spr, -s / 2, -s / 2, s, s);
    g.restore();
  }

  // ── 걸음걸이 — 살아 있는 손님과 바탕에 미리 찍는 자국이 같은 규칙을 쓴다. 자국 하나마다 emit. ──────────
  function newWalker(kind: Kind, x: number, y: number, dir: number, t: number): Walker {
    const k = kind === "human" ? 1.25 + rand() * 0.3 : kind === "cat" ? 0.85 + rand() * 0.2 : kind === "bird" ? 0.8 + rand() * 0.25 : 1 + rand() * 0.2;
    return { kind, x, y, dir, left: rand() < 0.5, k, next: t, active: true, steps: 0 };
  }
  function advance(wk: Walker, t: number, emit: (p: Print) => void, puffAt: (x: number, y: number) => void): "walk" | "gone" {
    const px = Math.cos(wk.dir + Math.PI / 2);
    const py = Math.sin(wk.dir + Math.PI / 2);
    const fx = Math.cos(wk.dir);
    const fy = Math.sin(wk.dir);
    const a = wk.dir + Math.PI / 2;
    if (wk.kind === "human") {
      wk.dir += (rand() - 0.5) * 0.24;
      const side = (wk.left ? -8 : 8) * wk.k;
      emit({ x: wk.x + px * side, y: wk.y + py * side, a, kind: "sole", left: wk.left, k: wk.k, born: t });
      puffAt(wk.x + px * side, wk.y + py * side);
      wk.x += fx * 30 * wk.k;
      wk.y += fy * 30 * wk.k;
      wk.left = !wk.left;
      wk.next = t + 0.38 + rand() * 0.1;
    } else if (wk.kind === "cat") {
      wk.dir += (rand() - 0.5) * 0.34;
      const side = (wk.left ? -3 : 3) * wk.k;
      emit({ x: wk.x + px * side, y: wk.y + py * side, a, kind: "paw", left: wk.left, k: wk.k, born: t });
      wk.x += fx * 13 * wk.k;
      wk.y += fy * 13 * wk.k;
      wk.left = !wk.left;
      wk.next = t + 0.2 + (rand() < 0.05 ? 0.8 + rand() * 1.4 : 0); // 가끔 멈춰 선다
    } else if (wk.kind === "bird") {
      wk.dir += (rand() - 0.5) * 0.6;
      for (const s of [-1, 1]) emit({ x: wk.x + px * s * 4 * wk.k, y: wk.y + py * s * 4 * wk.k, a, kind: "bird", left: false, k: wk.k, born: t });
      wk.x += fx * 15 * wk.k;
      wk.y += fy * 15 * wk.k;
      wk.next = t + 0.36 + rand() * 0.22;
      if (wk.steps > 6 && rand() < 0.025) {
        puffAt(wk.x, wk.y);
        return "gone"; // 푸드덕 날아간다
      }
    } else {
      wk.dir += (rand() - 0.5) * 0.3;
      for (const s of [-1, 1]) emit({ x: wk.x + px * s * 6 * wk.k, y: wk.y + py * s * 6 * wk.k, a, kind: "rHind", left: false, k: wk.k, born: t });
      emit({ x: wk.x - fx * 11 * wk.k + px * 2, y: wk.y - fy * 11 * wk.k + py * 2, a, kind: "rFore", left: false, k: wk.k, born: t });
      emit({ x: wk.x - fx * 18 * wk.k - px * 2, y: wk.y - fy * 18 * wk.k - py * 2, a, kind: "rFore", left: false, k: wk.k, born: t });
      puffAt(wk.x, wk.y);
      wk.x += fx * 42 * wk.k;
      wk.y += fy * 42 * wk.k;
      wk.next = t + 0.48 + rand() * 0.12;
    }
    wk.steps++;
    return "walk";
  }
  function edgeStart(): [number, number, number] {
    const edge = Math.floor(rand() * 4);
    const x = edge === 0 ? -14 : edge === 1 ? w + 14 : rand() * w;
    const y = edge === 2 ? -14 : edge === 3 ? h + 14 : rand() * h;
    const dir = Math.atan2(h * (0.3 + rand() * 0.4) - y, w * (0.3 + rand() * 0.4) - x) + (rand() - 0.5) * 0.8;
    return [x, y, dir];
  }
  function pickKind(): Kind {
    const r = rand();
    return r < 0.45 ? "human" : r < 0.65 ? "cat" : r < 0.85 ? "bird" : "rabbit";
  }

  function bakeGround(dpr: number) {
    bakeSprites();
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
    // 이미 지나간 자국 — 사람 한 줄 + 동물 한 줄(옅게). 살아 있는 손님과 같은 걸음 규칙.
    for (const kind of ["human", rand() < 0.5 ? "cat" : "rabbit"] as Kind[]) {
      const [x, y, dir] = edgeStart();
      const wk = newWalker(kind, x, y, dir, 0);
      let guard = 0;
      while (guard++ < 140 && wk.x > -40 && wk.x < w + 40 && wk.y > -40 && wk.y < h + 40) {
        if (advance(wk, 0, (p) => drawPrint(g, p, 0.5), () => {}) === "gone") break;
      }
    }
    ground = c;
    gw = w;
    gh = h;
    gdpr = dpr;
  }

  const areaK = () => clamp((w * h) / 1_440_000, 0.6, 1.6);
  const flakeTarget = (f: Frame) => Math.round(lerp(8, 70, f.load) * areaK());
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
  function startWalker(t: number, load: number) {
    const [x, y, dir] = edgeStart();
    const kind = load < 0.3 && rand() < 0.5 ? (rand() < 0.5 ? "cat" : "bird") : pickKind();
    Object.assign(walker, newWalker(kind, x, y, dir, t));
    visitors[kind]++;
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
      const n = flakeTarget(f);
      if (!flakes.length) while (flakes.length < n) flakes.push(newFlake());
      for (const s of flakes) {
        if (s.x > w) s.x = rand() * w;
        if (s.y > h) s.y = rand() * h;
      }
    },
    step(f) {
      const { dt, t, p, load } = f;
      // ① 손님 — 여력 0.2부터. 빈도는 여력에 비례(여유로우면 6~14초, 빠듯하면 28~48초 간격).
      if (!walker.active && t > nextWalker && load >= 0.2) startWalker(t, load);
      if (walker.active && t >= walker.next) {
        const pn = walker.kind === "human" ? (load >= 0.5 ? 4 : 2) : 1;
        const r = advance(
          walker,
          t,
          (pr) => prints.push(pr),
          (x, y) => puff(x, y, pn, walker.kind === "rabbit" ? 60 : 40)
        );
        // 걸음 상한 — 새·토끼는 지그재그라 화면을 오래 못 벗어난다(실측: 새 158자국/45초). 사람 160·고양이 90·새 44·토끼 36.
        const maxSteps = walker.kind === "human" ? 160 : walker.kind === "cat" ? 90 : walker.kind === "bird" ? 44 : 36;
        if (r === "gone" || walker.steps > maxSteps || walker.x < -40 || walker.x > w + 40 || walker.y < -40 || walker.y > h + 40) {
          if (walker.kind === "bird" && r !== "gone") puff(walker.x, walker.y, 6, 60); // 푸드덕
          walker.active = false;
          nextWalker = t + lerp(28, 6, load) + rand() * lerp(20, 8, load);
        }
      }
      if (prints.length > 260) prints.splice(0, prints.length - 260);
      while (prints.length && t - prints[0].born > 80) prints.shift();
      // ② 내려앉는 눈 — 목표 수는 여력으로. 늘릴 땐 기다렸다 하나씩, 줄일 땐 수명을 마친 것부터 뺀다.
      const target = flakeTarget(f);
      if (flakes.length < target) for (let i = 0; i < 2 && flakes.length < target; i++) flakes.push({ ...newFlake(), wait: rand() * 1.5 });
      for (let i = flakes.length - 1; i >= 0; i--) {
        const s = flakes[i];
        if (s.wait > 0) {
          s.wait -= dt;
          if (flakes.length > target && s.life === 0) flakes.splice(i, 1); // 아직 안 보이는 것은 그냥 뺀다
          continue;
        }
        s.life += dt / s.dur;
        if (!s.rung && s.life >= 0.62) {
          s.rung = true;
          if (load >= 0.2 && rings.length < 40) rings.push({ x: s.x, y: s.y, life: 1 });
        }
        if (s.life >= 1) {
          if (flakes.length > target) {
            flakes.splice(i, 1);
            continue;
          }
          s.x = rand() * w;
          s.y = rand() * h;
          s.life = 0;
          s.dur = 1.8 + rand() * 1.6;
          s.wait = rand() * 2.5;
          s.r = 2.2 + rand() * 2;
          s.rung = false;
        }
      }
      const tw = Math.round(lerp(4, 16, load));
      while (twinkles.length < tw) twinkles.push({ x: rand() * w, y: rand() * h, ph: rand() * TAU, r: 1.6 + rand() * 1.6 });
      if (twinkles.length > tw) twinkles.length = tw;
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].life -= dt / 0.7;
        if (rings[i].life <= 0) rings.splice(i, 1);
      }
      // ③ 포인터 눈가루 — 빠를수록 많이, 손 방향으로. 여력 0.45부터.
      if (p.inside && p.moved && p.speed > 220 && load >= 0.45) {
        const cap = Math.round(60 + 120 * load);
        for (let i = 0; i < 3 && dust.length < cap; i++) {
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
      // 자국(살아 있는 것) — 70초 뒤 10초에 걸쳐 옅어진다.
      for (const p of prints) {
        const age = t - p.born;
        const a = age > 70 ? Math.max(0, 1 - (age - 70) / 10) : 1;
        drawPrint(g, p, 0.72 * a);
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
      if (!onBackground || f.load < 0.15) return false;
      const a = rand() * TAU;
      const px = Math.cos(a + Math.PI / 2) * 10;
      const py = Math.sin(a + Math.PI / 2) * 10;
      prints.push({ x: f.p.x - px, y: f.p.y - py, a: a + Math.PI / 2, kind: "sole", left: true, k: 1.4, born: f.t });
      prints.push({ x: f.p.x + px + Math.cos(a) * 18, y: f.p.y + py + Math.sin(a) * 18, a: a + Math.PI / 2, kind: "sole", left: false, k: 1.4, born: f.t + 0.15 });
      puff(f.p.x, f.p.y, f.load >= 0.4 ? 12 : 6, 140);
      return true;
    },
    debug() {
      return {
        flakes: flakes.length,
        prints: prints.length,
        dust: dust.length,
        dustSpawned,
        walker: walker.active ? walker.kind : false,
        walkerSteps: walker.steps,
        visitors: { ...visitors },
        kinds: prints.reduce<Record<string, number>>((m, p) => ((m[p.kind] = (m[p.kind] ?? 0) + 1), m), {})
      };
    }
  };
}
