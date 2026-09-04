// 겨울 — "소복이 쌓인 눈밭을 위에서 내려다본다". 바탕(눈밭 + 둔덕 그늘 + 반짝이 + 이미 지나간 발자국 몇 줄)은
// 리사이즈 때 한 번 굽는다(크기별 결정적 — 다시 구워도 같은 그림). 그 위에서: ① 보이지 않는 누군가가 **걸어간다** —
// 사람(신발 자국)·**고양이·새·토끼**(제 걸음걸이)가 화면을 가로지르고, 다 지나가면 잠시 뒤 다른 가장자리에서 다음 손님.
// ② 눈송이가 내려앉는다(위에서 보는 시점이라 점이 커지며 나타났다가 바닥에 스며들고, 닿는 순간 옅은 고리가 번진다).
// ③ 포인터가 빠르게 지나가면 **눈가루가 흩날린다**. ④ 바탕을 누르면 그 자리에 발자국 한 쌍 + 눈가루.
// 랜덤 이벤트(2026-09-04 사용자): **눈 토끼**(public/ambient/snow-rabbit.svg) — 눈 속에서 톡 튀어나와(눈가루·통통 커짐)
// 두리번거리며 귀를 쫑긋대다가 몇 번 콩콩 뛰고(뛴 자리에 토끼 자국) 눈을 파헤치다가, 다 놀면 화면 밖으로 뛰어나간다.
// 토끼의 지능(2026-09-04 사용자 "진짜 동물처럼", 행동 연구 기반): 위협(포인터·보이지 않는 손님)을 **접근 속도**로 판단한다 —
// 도주 개시 거리(FID, Ydenberg & Dill 1986)는 천천히 오면 좁고 덤벼들면 넓다. 갑자기 덮쳐오면 **얼음(freeze)** — 잠깐 굳어
// 판단한 뒤 도주. 위협이 근처에 머물면 **경계(alert)** — 꼿꼿이 앉아 귀를 세우고 위협을 향해 몸을 돌리며, 오래 머물면
// **발 구르기(thump)**로 경고(뒷발 뒤로 눈가루), 두 번 굴러도 안 가면 도주. 도주는 **지그재그(protean escape)** — 뜀마다
// 방향을 꺾고 가끔 급선회, 그래도 늘 눈에 보이게 화면 밖까지 달린다(순간이동 금지). 안전하고 한가하면 **빙키(binky)** —
// 제자리에서 높이 뛰며 몸을 비트는 기쁨의 점프. **눈보라 한 줄기** — 흰 눈가루 띠가 화면을 훑고 지나간다.
// LOD: 자국은 종류별 스프라이트 한 장씩(경로 채우기 ×200/프레임 → drawImage), 여력(f.load)에 따라 눈송이 수·손님
// 빈도·눈가루·고리·이벤트를 점진 조절(툭 사라지지 않게 — 눈송이는 제 수명을 마치고 빠진다).

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawFacing, loadSprite, type Sprite } from "../assets";
import { angleDiff, clamp, lerp, makeCanvas, rng, shadowSprite, softBlob, TAU, threat } from "./util";
import { bakeTraces, drawTraces, type TraceBakes } from "../world/traces-draw";
import type { Weather } from "../world/weather";

// 날씨(날짜 시드)별 눈송이 배수 — 눈 오는 날은 촘촘히, 맑은 날은 가끔 한 송이.
const WEATHER_FLAKES: Record<Weather, number> = { snow: 1.8, cloud: 0.8, clear: 0.35, fog: 0.6, wind: 1.2, rain: 0.5 };

type Flake = { x: number; y: number; life: number; dur: number; wait: number; r: number; rung: boolean };
type Kind = "human" | "cat" | "bird" | "rabbit";
type PrintKind = "sole" | "paw" | "bird" | "rHind" | "rFore";
type Print = { x: number; y: number; a: number; kind: PrintKind; left: boolean; k: number; born: number; erase?: number };
// 눈가루 — 흰 눈 알갱이(파란 테 없음), 속도 방향으로 길게 늘어져(모션 블러) 튀었다가 살짝 가라앉는다.
type Dust = { x: number; y: number; vx: number; vy: number; life: number; r: number };
type Ring = { x: number; y: number; life: number };
type Twinkle = { x: number; y: number; ph: number; r: number };
type Walker = { kind: Kind; x: number; y: number; dir: number; left: boolean; k: number; next: number; active: boolean; steps: number };
// 토끼 상태: emerge → sit ⇄ hop/rest(놀이·파헤치기) → flee(화면 밖으로 지그재그 도주 — 사라지지 않는다).
// 위협 반응(행동 연구 기반): alert = 경계(꼿꼿이 앉아 위협을 향함, 머물면 발 구르기) · freeze = 얼음(덮쳐올 때 잠깐 정지 후 도주) ·
// binky = 빙키(안전할 때 기쁨의 점프, 끝나면 sit).
type RabbitPhase = "emerge" | "sit" | "hop" | "rest" | "alert" | "freeze" | "binky" | "flee";
type Rabbit = {
  x: number;
  y: number;
  dir: number;
  phase: RabbitPhase;
  t0: number;
  hops: number;
  sx: number;
  sy: number;
  look: number;
  k: number;
  nextDig: number;
  digT: number;
  exit: number; // 도주 출구 방향 — 지그재그는 이 축을 중심으로 꺾는다
  zig: number; // 지그재그 부호(±1) — 뜀마다 뒤집힌다
  dist: number; // 이번 도주 뜀의 거리(64~72)
  thumpT: number; // 마지막 발 구르기 시각(그리기의 웅크림)
  thumpN: number; // 이번 경계에서 구른 횟수 — 둘이면 도주
  freezeDur: number; // 얼음 지속(0.25~0.5초)
};
type Threat = ReturnType<typeof threat>;
type Gust = { t0: number; dur: number; dir: number; y: number } | null;

const SPR: Record<PrintKind, number> = { sole: 36, paw: 20, bird: 18, rHind: 20, rFore: 14 };

export function createWinter(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const sprites = new Map<PrintKind, HTMLCanvasElement>();
  let rabbitSpr: Sprite | null = null;
  let shadow: HTMLCanvasElement | null = null;
  let traceBakes: TraceBakes | null = null; // 연대기(눈사람·헐벗은 나무·해빙 뒤 저장소) 렌더
  let speck: HTMLCanvasElement | null = null;
  let seeded = false;
  let erased = 0;
  let lastPX = -9999;
  let lastPY = -9999;
  const flakes: Flake[] = [];
  const prints: Print[] = [];
  const dust: Dust[] = [];
  const rings: Ring[] = [];
  const twinkles: Twinkle[] = [];
  const walker: Walker = { kind: "human", x: 0, y: 0, dir: 0, left: false, k: 1, next: 0, active: false, steps: 0 };
  let rabbit: Rabbit | null = null;
  let nextRabbit = 12 + rand() * 10;
  let rabbits = 0;
  // 토끼 행동 카운터(검증·디버그) — 경계·발 구르기·얼음·빙키·지그재그 꺾임.
  let alerts = 0;
  let thumps = 0;
  let freezes = 0;
  let binkies = 0;
  let zigzags = 0;
  let gust: Gust = null;
  let nextGust = 30 + rand() * 30;
  let gusts = 0;
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
    shadow = shadowSprite(64, 64, "120 140 170", 0.45);
    traceBakes = bakeTraces();
    // 눈 알갱이 — 작은 원 다섯을 겹친 울퉁불퉁한 흰 조각(원형 점·파란 테 = 거품처럼 보였다).
    {
      const { c, g } = makeCanvas(24, 24);
      g.translate(12, 12);
      for (const [x, y, r] of [[0, 0, 5], [-3.2, -1.5, 3.2], [3, -2, 2.8], [1.5, 3, 3], [-2.5, 2.6, 2.4]] as const) {
        softBlob(g, x, y, r + 2.5, "255 255 255", 0.55, 0);
        g.fillStyle = "rgb(255 255 255 / 0.95)";
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      speck = c;
    }
    void loadSprite(ASSET.rabbit, 54, 54).then((s) => (rabbitSpr = s)).catch(() => {});
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
  function newWalker(kind: Kind, x: number, y: number, dir: number, t: number, r: () => number = rand): Walker {
    const k = kind === "human" ? 1.25 + r() * 0.3 : kind === "cat" ? 0.85 + r() * 0.2 : kind === "bird" ? 0.8 + r() * 0.25 : 1 + r() * 0.2;
    return { kind, x, y, dir, left: r() < 0.5, k, next: t, active: true, steps: 0 };
  }
  function advance(wk: Walker, t: number, emit: (p: Print) => void, puffAt: (x: number, y: number) => void, r: () => number = rand): "walk" | "gone" {
    const px = Math.cos(wk.dir + Math.PI / 2);
    const py = Math.sin(wk.dir + Math.PI / 2);
    const fx = Math.cos(wk.dir);
    const fy = Math.sin(wk.dir);
    const a = wk.dir + Math.PI / 2;
    if (wk.kind === "human") {
      wk.dir += (r() - 0.5) * 0.24;
      const side = (wk.left ? -8 : 8) * wk.k;
      emit({ x: wk.x + px * side, y: wk.y + py * side, a, kind: "sole", left: wk.left, k: wk.k, born: t });
      puffAt(wk.x + px * side, wk.y + py * side);
      wk.x += fx * 30 * wk.k;
      wk.y += fy * 30 * wk.k;
      wk.left = !wk.left;
      wk.next = t + 0.38 + r() * 0.1;
    } else if (wk.kind === "cat") {
      wk.dir += (r() - 0.5) * 0.34;
      const side = (wk.left ? -3 : 3) * wk.k;
      emit({ x: wk.x + px * side, y: wk.y + py * side, a, kind: "paw", left: wk.left, k: wk.k, born: t });
      wk.x += fx * 13 * wk.k;
      wk.y += fy * 13 * wk.k;
      wk.left = !wk.left;
      wk.next = t + 0.2 + (r() < 0.05 ? 0.8 + r() * 1.4 : 0);
    } else if (wk.kind === "bird") {
      wk.dir += (r() - 0.5) * 0.6;
      for (const s of [-1, 1]) emit({ x: wk.x + px * s * 4 * wk.k, y: wk.y + py * s * 4 * wk.k, a, kind: "bird", left: false, k: wk.k, born: t });
      wk.x += fx * 15 * wk.k;
      wk.y += fy * 15 * wk.k;
      wk.next = t + 0.36 + r() * 0.22;
      if (wk.steps > 6 && r() < 0.025) {
        puffAt(wk.x, wk.y);
        return "gone";
      }
    } else {
      wk.dir += (r() - 0.5) * 0.3;
      for (const s of [-1, 1]) emit({ x: wk.x + px * s * 6 * wk.k, y: wk.y + py * s * 6 * wk.k, a, kind: "rHind", left: false, k: wk.k, born: t });
      emit({ x: wk.x - fx * 11 * wk.k + px * 2, y: wk.y - fy * 11 * wk.k + py * 2, a, kind: "rFore", left: false, k: wk.k, born: t });
      emit({ x: wk.x - fx * 18 * wk.k - px * 2, y: wk.y - fy * 18 * wk.k - py * 2, a, kind: "rFore", left: false, k: wk.k, born: t });
      puffAt(wk.x, wk.y);
      wk.x += fx * 42 * wk.k;
      wk.y += fy * 42 * wk.k;
      wk.next = t + 0.48 + r() * 0.12;
    }
    wk.steps++;
    return "walk";
  }
  function edgeStart(r: () => number = rand): [number, number, number] {
    const edge = Math.floor(r() * 4);
    const x = edge === 0 ? -14 : edge === 1 ? w + 14 : r() * w;
    const y = edge === 2 ? -14 : edge === 3 ? h + 14 : r() * h;
    const dir = Math.atan2(h * (0.3 + r() * 0.4) - y, w * (0.3 + r() * 0.4) - x) + (r() - 0.5) * 0.8;
    return [x, y, dir];
  }
  function pickKind(): Kind {
    const r = rand();
    return r < 0.45 ? "human" : r < 0.65 ? "cat" : r < 0.85 ? "bird" : "rabbit";
  }
  // 토끼 자국 한 뜀(뒷발 둘 앞·앞발 둘 뒤).
  function rabbitPrints(x: number, y: number, dir: number, t: number, k: number) {
    const px = Math.cos(dir + Math.PI / 2);
    const py = Math.sin(dir + Math.PI / 2);
    const fx = Math.cos(dir);
    const fy = Math.sin(dir);
    const a = dir + Math.PI / 2;
    for (const s of [-1, 1]) prints.push({ x: x + px * s * 6 * k, y: y + py * s * 6 * k, a, kind: "rHind", left: false, k, born: t });
    prints.push({ x: x - fx * 11 * k + px * 2, y: y - fy * 11 * k + py * 2, a, kind: "rFore", left: false, k, born: t });
    prints.push({ x: x - fx * 18 * k - px * 2, y: y - fy * 18 * k - py * 2, a, kind: "rFore", left: false, k, born: t });
  }

  function bakeGround(dpr: number) {
    bakeSprites();
    const g0 = rng((seed * 7 + 13) >>> 0);
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "rgb(246 249 253 / 0.92)");
    base.addColorStop(1, "rgb(236 242 249 / 0.94)");
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const blobs = Math.round((w * h) / 90000);
    for (let i = 0; i < blobs; i++) {
      const x = g0() * w;
      const y = g0() * h;
      const r = 90 + g0() * 220;
      if (g0() < 0.5) softBlob(g, x, y, r, "205 220 238", 0.24);
      else softBlob(g, x, y, r, "255 255 255", 0.5);
    }
    const dots = Math.round((w * h) / 9000);
    for (let i = 0; i < dots; i++) {
      const x = g0() * w;
      const y = g0() * h;
      const r = 0.8 + g0() * 1.4;
      g.fillStyle = "rgb(150 180 212 / 0.42)";
      g.beginPath();
      g.arc(x, y, r + 0.9, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(255 255 255 / 0.95)";
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    // (이미 지나간 자국은 바탕에 굽지 않는다 — 살아 있는 자국이어야 포인터로 지울 수 있다. resize에서 산 자국으로 심는다.)
    ground = c;
    gw = w;
    gh = h;
    gdpr = dpr;
  }

  const areaK = () => clamp((w * h) / 1_440_000, 0.6, 1.6);
  const flakeTarget = (f: Frame) => Math.round(lerp(8, 70, f.load) * areaK() * WEATHER_FLAKES[f.weather.now]);
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
  function startRabbit(t: number, hot: Frame["hot"]) {
    let x = 60 + rand() * (w - 120);
    let y = 60 + rand() * (h - 120);
    // 핫 존(달력) 밖 빈 띠가 있으면 거기서 — 달력 위에 숨어 있다 나오면 안 보인다.
    if (hot) {
      const bands: [number, number, number, number][] = [
        [0, 0, w, hot.y],
        [0, hot.y + hot.h, w, h - hot.y - hot.h],
        [0, 0, hot.x, h],
        [hot.x + hot.w, 0, w - hot.x - hot.w, h]
      ];
      const best = bands.filter((b) => b[2] >= 70 && b[3] >= 70).sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
      if (best) {
        x = best[0] + 35 + rand() * (best[2] - 70);
        y = best[1] + 35 + rand() * (best[3] - 70);
      }
    }
    rabbit = {
      x,
      y,
      dir: rand() * TAU,
      phase: "emerge",
      t0: t,
      hops: 3 + Math.floor(rand() * 4),
      sx: x,
      sy: y,
      look: 0,
      k: 0.9 + rand() * 0.2,
      nextDig: t + 1.2,
      digT: -9,
      exit: 0,
      zig: 1,
      dist: 64,
      thumpT: -9,
      thumpN: 0,
      freezeDur: 0.3
    };
    puff(x, y, 14, 130);
    rabbits++;
  }
  // 도주 개시 거리(FID) — 고정 반경이 아니라 접근 방식으로 정한다(Ydenberg & Dill 1986: 접근 속도가 빠를수록 멀리서 튄다).
  // 덮쳐오면(loom > 4) 320px에서 바로, 빠르게 오면(250px/s↑) 200px, 천천히·가만히 있으면(60px/s↓) 70px까지 참는다, 기본 110px.
  function fid(th: Threat): number {
    if (th.loom > 4) return 320;
    if (th.rate > 250) return 200;
    if (th.rate < 60) return 70;
    return 110;
  }
  // 경계(alert) — 제자리에 꼿꼿이 앉아 위협을 향한다. 발 구르기 횟수는 경계마다 새로 센다.
  function enterAlert(r: Rabbit, t: number) {
    r.phase = "alert";
    r.t0 = t;
    r.thumpN = 0;
    r.thumpT = -9;
    alerts++;
  }
  // 발 구르기(thump) — 뒷발로 눈을 쿵 찍는 경고 신호. 몸이 잠깐 웅크리고(그리기) 뒷발 뒤로 눈가루가 튄다.
  function thump(r: Rabbit, t: number) {
    r.thumpT = t;
    r.thumpN++;
    thumps++;
    puff(r.x - Math.cos(r.dir) * 14, r.y - Math.sin(r.dir) * 14, 4, 70);
  }
  // 지그재그 도주(protean escape) — 출구 축을 중심으로 뜀마다 ±35~50°를 번갈아 꺾고, 15%는 ~90° 급선회. 예측 불가한 경로가
  // 포식자의 추격을 따돌린다. first가 아니면 부호가 뒤집힌다(zigzags++).
  function zigHop(r: Rabbit, first: boolean) {
    if (!first) {
      r.zig = -r.zig;
      zigzags++;
    }
    const cut = rand() < 0.15;
    const ang = cut ? (Math.PI / 2) * (0.9 + rand() * 0.2) : ((35 + rand() * 15) * Math.PI) / 180;
    r.dir = r.exit + r.zig * ang;
    r.dist = 64 + rand() * 8;
  }
  // 빙키(binky) — 안전하고(포인터 320px 밖·손님 멀리) 여력이 있을 때 8%로 제자리 높이뛰기+몸 비틀기. 들어갔으면 true.
  function tryBinky(r: Rabbit, t: number, th: Threat, wd: number, load: number): boolean {
    if (load < 0.6 || th.d < 320 || wd < 140 || rand() >= 0.08) return false;
    r.phase = "binky";
    r.t0 = t;
    r.sx = r.x;
    r.sy = r.y;
    binkies++;
    return true;
  }
  // 놀라거나 다 놀았으면 가장 가까운 가장자리로 뛰어나간다 — 화면 밖에서 사라진다(순간이동 금지, 2026-09-04 사용자).
  // 출구 방향은 exit에 두고 실제 뜀은 지그재그(zigHop).
  function rabbitFlee(t: number) {
    if (!rabbit || rabbit.phase === "flee") return;
    const r = rabbit;
    const exits: [number, number][] = [
      [-90, r.y],
      [w + 90, r.y],
      [r.x, -90],
      [r.x, h + 90]
    ];
    exits.sort((a, b) => Math.hypot(a[0] - r.x, a[1] - r.y) - Math.hypot(b[0] - r.x, b[1] - r.y));
    r.exit = Math.atan2(exits[0][1] - r.y, exits[0][0] - r.x);
    r.zig = rand() < 0.5 ? -1 : 1;
    zigHop(r, true);
    r.phase = "flee";
    r.t0 = t;
    r.sx = r.x;
    r.sy = r.y;
    puff(r.x, r.y, 6, 90);
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr) bakeGround(f.dpr);
      // 이미 지나간 자국 두 줄 — 산 자국으로(포인터로 지울 수 있게). 한 번만.
      if (!seeded) {
        seeded = true;
        for (const kind of ["human", rand() < 0.5 ? "cat" : "rabbit"] as Kind[]) {
          const [x, y, dir] = edgeStart();
          const wk = newWalker(kind, x, y, dir, f.t - 30);
          let guard = 0;
          while (guard++ < 120 && wk.x > -40 && wk.x < w + 40 && wk.y > -40 && wk.y < h + 40) {
            if (advance(wk, f.t - 30, (p) => prints.push(p), () => {}) === "gone") break;
          }
        }
      }
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
        const r = advance(walker, t, (pr) => prints.push(pr), (x, y) => puff(x, y, pn, walker.kind === "rabbit" ? 60 : 40));
        const maxSteps = walker.kind === "human" ? 160 : walker.kind === "cat" ? 90 : walker.kind === "bird" ? 44 : 36;
        if (r === "gone" || walker.steps > maxSteps || walker.x < -40 || walker.x > w + 40 || walker.y < -40 || walker.y > h + 40) {
          if (walker.kind === "bird" && r !== "gone") puff(walker.x, walker.y, 6, 60);
          walker.active = false;
          nextWalker = t + lerp(28, 6, load) + rand() * lerp(20, 8, load);
        }
      }
      if (prints.length > 260) prints.splice(0, prints.length - 260);
      while (prints.length && t - prints[0].born > 80) prints.shift();
      // ② 눈 토끼 — 여력 0.45부터, 25~65초 간격.
      if (!rabbit && load >= 0.45 && t > nextRabbit) startRabbit(t, f.hot);
      if (rabbit) {
        const r = rabbit;
        // 위협 지각 — 포인터는 접근 속도·looming으로(threat), 보이지 않는 손님(사람·고양이·새)도 포식자다(거리 wd).
        const th = threat(p, r.x, r.y);
        const wd = walker.active ? Math.hypot(walker.x - r.x, walker.y - r.y) : Infinity;
        const calm = r.phase === "sit" || r.phase === "rest";
        // 나오는 중·얼음·도주 중엔 새 판단 없음(얼음은 제 시간을 채우고 도주, 도주는 끝까지 달린다).
        if (r.phase !== "emerge" && r.phase !== "freeze" && r.phase !== "flee") {
          if (calm && th.loom > 2.5 && th.d < 260) {
            // 얼음(freeze) — 미처 경계하기 전에 덮쳐오면 먼저 굳는다(crypsis: 움직임을 지워 판단할 시간을 번다), 곧 도주.
            r.phase = "freeze";
            r.t0 = t;
            r.freezeDur = 0.25 + rand() * 0.25;
            freezes++;
          } else if (th.d < fid(th) || wd < 60) {
            // FID 안이면 도주(뛰는 중·빙키 중이면 그 자리에서). 손님이 코앞(60px)이어도.
            rabbitFlee(t);
          } else if (calm && (th.d < 240 || wd < 140)) {
            // 경계(alert) — 아직 FID 밖이지만 가까이 있다: 멈추고 꼿꼿이 앉아 위협을 향한다.
            enterAlert(r, t);
          }
        }
        const age = t - r.t0; // 위 전이로 t0가 바뀌었을 수 있다 — 전이 뒤에 잰다
        if (r.phase === "emerge" && age > 0.55) {
          r.phase = "sit";
          r.t0 = t;
          r.look = 2 + rand() * 2.5;
        } else if (r.phase === "freeze") {
          if (age > r.freezeDur) rabbitFlee(t);
        } else if (r.phase === "alert") {
          // 위협의 자리 — 포인터(300px 안) 우선, 아니면 손님(200px 안, 들어올 땐 140: 경계에서 왔다 갔다 않게 히스테리시스).
          const near: [number, number] | null = th.d < 300 ? [p.x, p.y] : wd < 200 ? [walker.x, walker.y] : null;
          if (!near) {
            // 물러갔다 — 다시 앉아 두리번(look 타이머·파헤치기 타이머 새로).
            r.phase = "sit";
            r.t0 = t;
            r.look = 2 + rand() * 2.5;
            r.nextDig = t + 1.2;
            r.thumpN = 0;
          } else {
            // 위협 쪽으로 몸을 돌린다(≤3 rad/s — 홱 돌지 않고 눈으로 좇듯).
            const want = Math.atan2(near[1] - r.y, near[0] - r.x);
            r.dir += clamp(angleDiff(want, r.dir), -3 * dt, 3 * dt);
            // 발 구르기(thump): 1.2초 넘게 머물면 한 번, 1.5초 뒤에도 있으면 한 번 더, 그래도 있으면 "충분히 참았다" — 도주.
            if (r.thumpN === 0 && age > 1.2) thump(r, t);
            else if (r.thumpN === 1 && t - r.thumpT > 1.5) thump(r, t);
            else if (r.thumpN >= 2 && t - r.thumpT > 0.15) rabbitFlee(t);
          }
        } else if (r.phase === "binky") {
          // 빙키 — 0.42초 제자리 높이뛰기(그리기에서 1.6배 높이·몸 비틀기). 착지에 눈가루, 다시 앉는다.
          if (age >= 0.42) {
            puff(r.x, r.y, 5, 70);
            r.phase = "sit";
            r.t0 = t;
            r.look = 1 + rand() * 1.5;
            r.nextDig = t + 0.8;
          }
        } else if (r.phase === "sit" && age > r.look) {
          if (!tryBinky(r, t, th, wd, load)) {
            r.phase = "hop";
            r.t0 = t;
            r.dir += (rand() - 0.5) * 1.2;
            r.sx = r.x;
            r.sy = r.y;
          }
        } else if (r.phase === "sit" && t > r.nextDig) {
          // 앉아서 앞발로 눈을 파헤친다 — 앞발 쪽에서 눈가루가 조금씩 튀고 몸이 앞뒤로 까딱.
          r.digT = t;
          r.nextDig = t + 0.9 + rand() * 1.3;
          const fx = r.x + Math.cos(r.dir) * 18;
          const fy = r.y + Math.sin(r.dir) * 18;
          for (let i = 0; i < 5; i++) dust.push({ x: fx + (rand() - 0.5) * 8, y: fy + (rand() - 0.5) * 8, vx: Math.cos(r.dir + (rand() - 0.5) * 1.2) * (40 + rand() * 60), vy: Math.sin(r.dir + (rand() - 0.5) * 1.2) * (40 + rand() * 60), life: 0.9, r: 1.2 + rand() * 1.4 });
        } else if (r.phase === "hop" || r.phase === "flee") {
          const fleeing = r.phase === "flee";
          const dur = fleeing ? 0.22 : 0.38;
          const dist = fleeing ? r.dist : 46;
          const pgs = Math.min(1, age / dur);
          r.x = r.sx + Math.cos(r.dir) * dist * pgs;
          r.y = r.sy + Math.sin(r.dir) * dist * pgs;
          if (pgs >= 1) {
            rabbitPrints(r.x, r.y, r.dir, t, 1.1);
            puff(r.x, r.y, fleeing ? 4 : 3, 50);
            if (fleeing) {
              if (r.x < -70 || r.x > w + 70 || r.y < -70 || r.y > h + 70) {
                rabbit = null;
                nextRabbit = t + 25 + rand() * 40;
              } else {
                // 다음 뜀 — 지그재그로 꺾는다(출구 축은 그대로, 부호 뒤집기).
                r.t0 = t;
                r.sx = r.x;
                r.sy = r.y;
                zigHop(r, false);
              }
            } else {
              r.hops--;
              if (r.hops > 0) {
                if (th.d < 240 || wd < 140) {
                  enterAlert(r, t); // 뜀 사이에 위협이 가까우면 쉬는 대신 경계
                } else {
                  r.phase = "rest";
                  r.t0 = t;
                  if (r.x < 30 || r.x > w - 30 || r.y < 30 || r.y > h - 30) r.dir = Math.atan2(h / 2 - r.y, w / 2 - r.x);
                }
              } else rabbitFlee(t); // 다 놀았으면 뛰어서 나간다
            }
          }
        } else if (r.phase === "rest" && age > 0.22 + rand() * 0.2) {
          if (!tryBinky(r, t, th, wd, load)) {
            r.phase = "hop";
            r.t0 = t;
            r.dir += (rand() - 0.5) * 0.9;
            r.sx = r.x;
            r.sy = r.y;
          }
        }
      }
      // ③ 눈보라 한 줄기 — 여력 0.6부터, 30~60초 간격, 3초. 앞머리를 따라 눈가루가 흩날린다.
      if (!gust && load >= 0.6 && t > nextGust) {
        gust = { t0: t, dur: 3, dir: rand() < 0.5 ? -1 : 1, y: h * (0.2 + rand() * 0.6) };
        gusts++;
      }
      if (gust) {
        const e = (t - gust.t0) / gust.dur;
        if (e >= 1) {
          gust = null;
          nextGust = t + 30 + rand() * 30;
        } else {
          const front = gust.dir > 0 ? -100 + e * (w + 200) : w + 100 - e * (w + 200);
          const n = dust.length < 220 ? 5 : 0;
          for (let i = 0; i < n; i++) {
            dust.push({
              x: front + (rand() - 0.5) * 80,
              y: gust.y + (rand() - 0.5) * h * 0.5,
              vx: gust.dir * (260 + rand() * 260),
              vy: (rand() - 0.5) * 60,
              life: 1,
              r: 1.2 + rand() * 2
            });
          }
        }
      }
      // ④ 내려앉는 눈 — 목표 수는 여력으로.
      const target = flakeTarget(f);
      if (flakes.length < target) for (let i = 0; i < 2 && flakes.length < target; i++) flakes.push({ ...newFlake(), wait: rand() * 1.5 });
      for (let i = flakes.length - 1; i >= 0; i--) {
        const s = flakes[i];
        if (s.wait > 0) {
          s.wait -= dt;
          if (flakes.length > target && s.life === 0) flakes.splice(i, 1);
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
      // ⑤ 포인터 눈가루 — 빠를수록 많이, 손 방향으로 튀어 부채꼴로 흩어진다(모션 블러는 draw에서). 여력 0.45부터.
      if (p.inside && p.moved && p.speed > 220 && load >= 0.45) {
        const cap = Math.round(60 + 120 * load);
        const n = p.speed > 900 ? 4 : 3;
        for (let i = 0; i < n && dust.length < cap; i++) {
          const b = Math.atan2(p.vy, p.vx) + (rand() - 0.5) * 1.6; // 진행 방향 부채꼴
          const sp = 60 + rand() * 160 + p.speed * 0.18;
          dust.push({ x: p.x + (rand() - 0.5) * 8, y: p.y + (rand() - 0.5) * 8, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, life: 1, r: 1.1 + rand() * 1.5 });
          dustSpawned++;
        }
        // 빠르게 훑고 지나가면 근처 발자국이 쓸려 지워진다(2026-09-04 사용자) — 이번 프레임에 포인터가 지나간 **선분** 둘레
        // 44px 안의 자국이 한 번 훑을 때마다 절반쯤 지워진다(두세 번 왕복이면 사라짐). 지워지는 자국에선 눈이 조금 튄다.
        if (p.speed > 320 && lastPX > -9000) {
          const ax = lastPX;
          const ay = lastPY;
          const bx = p.x;
          const by = p.y;
          const abx = bx - ax;
          const aby = by - ay;
          const ab2 = abx * abx + aby * aby || 1;
          for (let i = prints.length - 1; i >= 0; i--) {
            const pr = prints[i];
            const u = clamp(((pr.x - ax) * abx + (pr.y - ay) * aby) / ab2, 0, 1);
            const d = Math.hypot(pr.x - (ax + abx * u), pr.y - (ay + aby * u));
            if (d > 44) continue;
            pr.erase = Math.min(1, (pr.erase ?? 0) + 0.5 * (1 - d / 44) + dt * 2);
            if (dust.length < cap && rand() < 0.6) dust.push({ x: pr.x + (rand() - 0.5) * 8, y: pr.y + (rand() - 0.5) * 8, vx: p.vx * 0.25 + (rand() - 0.5) * 80, vy: p.vy * 0.25 + (rand() - 0.5) * 80, life: 0.8, r: 1.2 + rand() * 1.2 });
            if (pr.erase >= 1) {
              prints.splice(i, 1);
              erased++;
            }
          }
        }
      }
      if (p.inside) {
        lastPX = p.x;
        lastPY = p.y;
      } else {
        lastPX = -9999;
        lastPY = -9999;
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const q = dust[i];
        q.life -= dt / 0.85;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= Math.pow(0.05, dt);
        q.vy = q.vy * Math.pow(0.05, dt) + 26 * dt; // 살짝 가라앉는다
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
      for (const p of prints) {
        const age = t - p.born;
        const a = (age > 70 ? Math.max(0, 1 - (age - 70) / 10) : 1) * (1 - (p.erase ?? 0));
        if (a <= 0.01) continue;
        drawPrint(g, p, 0.72 * a);
      }
      // 연대기 — 눈사람(12/20부터 손님이 굴려 세움 → 2월 녹음), 헐벗은 나무, 2월 15일 해빙 뒤 드러나는 가을 저장소.
      if (traceBakes) drawTraces(g, f, "winter", traceBakes);
      for (const r of rings) {
        const e = 1 - r.life;
        g.strokeStyle = `rgb(255 255 255 / ${r.life * 0.35})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(r.x, r.y, 3 + e * 9, 0, TAU);
        g.stroke();
      }
      // 눈보라 앞머리 — 옅은 흰 띠(부드러운 얼룩을 가로로 늘려).
      if (gust) {
        const e = (t - gust.t0) / gust.dur;
        const front = gust.dir > 0 ? -100 + e * (f.w + 200) : f.w + 100 - e * (f.w + 200);
        g.save();
        g.translate(front, gust.y);
        g.scale(1, 2.2);
        softBlob(g, 0, 0, 120, "255 255 255", 0.5 * Math.sin(Math.PI * e));
        g.restore();
      }
      // 눈 토끼 — 나올 땐 통통(오버슈트), 뛸 땐 위로 떠올라 커지고 그림자가 멀어진다, 앉아선 귀가 쫑긋.
      // 경계·얼음은 꼿꼿이(세로 1.08배, 귀 고정), 발 구르기는 잠깐 웅크림(납작), 빙키는 높이 뛰며 몸 비틀기.
      // 전부 save/translate/scale로 스프라이트(Noto)를 변형할 뿐 — 손으로 그리는 동물은 없다(사용자 규칙).
      if (rabbit && rabbitSpr) {
        const r = rabbit;
        const age = t - r.t0;
        let k = r.k;
        let up = 0;
        let alpha = 1;
        let bx = 1; // 몸 가로 배율(웅크림)
        let by = 1; // 몸 세로 배율(꼿꼿이·웅크림)
        let twist = 0; // 빙키 몸 비틀기(추가 회전)
        if (r.phase === "emerge") {
          const pgs = Math.min(1, age / 0.55);
          k *= 1 + 0.35 * Math.sin(Math.PI * pgs) * (1 - pgs) + pgs * 0 + (pgs < 1 ? 0 : 0);
          k *= Math.min(1, pgs * 1.6);
          alpha = Math.min(1, pgs * 2);
        } else if (r.phase === "hop") {
          up = Math.sin(Math.PI * Math.min(1, age / 0.38));
        } else if (r.phase === "flee") {
          up = Math.sin(Math.PI * Math.min(1, age / 0.22)) * 1.2;
        } else if (r.phase === "binky") {
          const pgs = Math.min(1, age / 0.42);
          up = Math.sin(Math.PI * pgs) * 1.6;
          twist = Math.sin(pgs * Math.PI) * 0.7;
        } else if (r.phase === "alert" || r.phase === "freeze") {
          by = 1.08; // 뒷다리로 곧추 앉아 살핀다 — 위에서 보면 살짝 길어 보인다
          const since = t - r.thumpT;
          if (r.phase === "alert" && since < 0.15) {
            const s = Math.sin((Math.PI * since) / 0.15); // 발 구르기 — 아래로 쿵(납작·넓게) 하고 되돌아온다
            by = 1.08 - 0.2 * s;
            bx = 1 + 0.07 * s;
          }
        }
        const ear = r.phase === "sit" ? Math.sin(t * 9) * 0.08 : 0; // 경계·얼음은 귀를 세운 채 고정
        const look = r.phase === "sit" ? Math.sin(t * 1.7) * 0.25 : 0;
        const digging = r.phase === "sit" && t - r.digT < 0.35;
        const dig = digging ? Math.sin((t - r.digT) * 36) * 0.06 : 0; // 파헤치는 동안 몸이 잘게 까딱
        if (digging) k *= 1 + Math.abs(dig) * 0.5;
        if (shadow && alpha > 0) {
          g.save();
          g.globalAlpha = 0.35 * alpha * (1 - 0.5 * up);
          g.translate(r.x + 4 + 10 * up, r.y + 6 + 14 * up);
          g.rotate(r.dir + Math.PI / 2);
          g.drawImage(shadow, -22 * k, -28 * k, 44 * k, 56 * k);
          g.restore();
        }
        g.save();
        g.globalAlpha = alpha;
        if (bx !== 1 || by !== 1) {
          // 토끼 자리를 중심으로 몸만 늘이고 줄인다(자리는 그대로).
          g.translate(r.x, r.y);
          g.scale(bx, by);
          g.translate(-r.x, -r.y);
        }
        drawFacing(g, rabbitSpr, r.x + Math.cos(r.dir) * dig * 30, r.y - 10 * up + Math.sin(r.dir) * dig * 30, r.dir, k * (1 + 0.22 * up), ear + look * 0.4 + twist);
        g.restore();
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
      // 눈가루 — 흰 알갱이가 속도 방향으로 늘어져(모션 블러) 튀고, 느려지면 제 모양으로 가라앉는다.
      if (speck) {
        for (const q of dust) {
          const a = Math.max(0, q.life);
          const sp = Math.hypot(q.vx, q.vy);
          const stretch = 1 + Math.min(5, sp * 0.012);
          const r = q.r * (0.9 + (1 - q.life) * 0.5);
          g.save();
          g.globalAlpha = a * 0.92;
          g.translate(q.x, q.y);
          g.rotate(Math.atan2(q.vy, q.vx));
          g.drawImage(speck, -r * stretch, -r, r * 2 * stretch, r * 2);
          g.restore();
        }
      }
    },
    pointerDown(f, onBackground) {
      if (f.load < 0.15) return false;
      // 토끼를 누르면 놀라 뛰어나간다(어디서든).
      if (rabbit && rabbit.phase !== "flee" && Math.hypot(rabbit.x - f.p.x, rabbit.y - f.p.y) < 34) {
        rabbitFlee(f.t);
        return true;
      }
      if (!onBackground) return false;
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
        kinds: prints.reduce<Record<string, number>>((m, p) => ((m[p.kind] = (m[p.kind] ?? 0) + 1), m), {}),
        rabbit: rabbit ? [Math.round(rabbit.x), Math.round(rabbit.y), rabbit.phase, rabbit.hops] : null,
        rabbits,
        rabbitPhase: rabbit ? rabbit.phase : null,
        alerts,
        thumps,
        freezes,
        binkies,
        zigzags,
        erased,
        rabbitSprite: !!rabbitSpr,
        gust: !!gust,
        gusts
      };
    }
  };
}
