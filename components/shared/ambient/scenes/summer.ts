// 여름 — 물결(.gs-tide, CSS/SVG caustic) 위의 캔버스: ① 포인터 **항적**(제트스키) ② 물 위에 둥둥 뜬 **오리**(늘) ③ 가끔
// 가장자리에서 **밀려오는 튜브**(랜덤 이벤트) — 둘 다 집어 끌고 던질 수 있고, 빨리 끌면 제 항적을 남긴다. ④ 물 밑 **물고기 그림자**.
//
// 항적(2026-09-04 사용자: 선 몇 줄은 "이게 뭐야") — 벤치마크 = 항공 사진의 제트스키 항적: 몸통은 뒤로 넓게 번지며 천천히
// 가라앉는 **흰 거품 띠**(turbulent wash), V자 두 팔은 그 바깥의 옅은 잔물결, 팔 사이엔 가로 마루. 구현 = **LOD 레이어**:
// 저해상(0.28~0.36×) 오프스크린 캔버스에 거품 도장(소프트 스프라이트 — 나이 들수록 커지고 옅어진다)·팔·마루·고리·물고기
// 그림자를 그리고 확대 합성한다 — 흐릿해야 하는 것은 흐릿하게 그려야 싸고 자연스럽다. 소품·뱃머리는 본 캔버스에 또렷하게.
//
// 물고기(2026-09-04 사용자: "위에서 내려다보는 시점인데 옆모습 물고기가 누워 다니니 어색 — 동물의 숲 그림자처럼") — 물고기는
// **물 밑 그림자**다. 퍼블릭 도메인 top-view 도안에서 구운 실루엣(assets.ts fishShadow*)을 저해상 층에 흐릿하게 찍는다: 몸통과
// 꼬리를 관절에서 나눠 꼬리가 좌우로 젓고, 수면에 가까울수록(depth) 크고 짙다. 행동은 연구 기반(scenes/util.ts threat):
//  · 도망(C-start, Domenici & Hale 2019): 거리가 아니라 **덮쳐오는 속도**(loom)로 판단 — 천천히 오면 코앞까지 두고, 휙 덤비면
//    멀리서 튄다. 튈 땐 반대쪽 ±, 가끔 옆으로(protean), 순간 4.5배로 치고 나가 1초 안에 잦아들며 깊이 숨는다(그림자 옅어짐).
//  · 놀람 전염: 한 마리가 튀면 90px 안의 이웃도 같은 곳에서 튄다(무리의 startle wave).
//  · 머리 위에 멈춘 그림자(포인터)는 새다 — 폭발 없이 슬금슬금 비켜간다.
//  · 먹이 학습(잉어·코이): 물이 튀면(누르기) 1초 뒤부터 겁먹지 않은 놈들이 모여들어 수면에서 맴돌며 뻐끔댄다(작은 고리).
//    누른 자리 140px 안의 물고기는 반대로 놀란다(물보라).
//  · 무리(boids): 정렬·응집·분리 + 몇 초마다 옮겨지는 무리 목표. 큰 놈은 혼자 느긋하게 순찰, 더 대담하다.
// 오리(Noto 🦆, 옆모습) — 위에서 보는 시점에 옆모습을 진행 방향으로 눕히면 "누워 다닌다"(사용자). 그래서 **세워 그린다**(좌우만
// 뒤집음, 3/4 시점 소품처럼) — top-view 오리 에셋은 공개 라이선스로 어디에도 없었다(openclipart 0건·OGA·Commons·itch 확인).
// 행동은 청둥오리 에토그램(휴식 ~65% · 먹이 ~15% · 깃 다듬기·목욕 ~5% · 이동 ~8%): 둥둥 쉬기 → 노 젓기 → 자맥질(엉덩이만
// 남는 tip-up, 머리 쪽 고리) → 깃 다듬기(흔들) → 목욕(머리 담그기 + 물방울) → 몸 털기. 사람 = 먹이 주는 손: 포인터가 느리게
// 다가와 머물면 다가와서 기다린다(호기심); 물 튀는 곳(먹이)으로 헤엄쳐 가 자맥질; 덮쳐오면(loom) 퍼덕이며 달아난다.
// 여력(f.load): 도장 간격·기억 시간·저해상 배율·글로우/마루·튜브·물고기 수·오리 잔행동이 load에 따라 늘고 준다.

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawSprite, loadSprite, type Sprite } from "../assets";
import { angleDiff, clamp, lerp, makeCanvas, rng, shadowSprite, softBlob, TAU, threat } from "./util";

type Node = { x: number; y: number; t0: number; nx: number; ny: number; sf: number }; // n = 진행 직각 단위벡터
type Stamp = { x: number; y: number; t0: number; sf: number; r: number };
type Ring = { x: number; y: number; life: number; dur: number; maxR: number; a: number; w: number };
type PropKind = "duck" | "ring";
type DuckState = "drift" | "paddle" | "dabble" | "preen" | "bathe" | "shake" | "curious" | "wait" | "alarm";
// 물고기 그림자. shape 0 = 날씬한 잉어형 · 1 = 부채꼬리(금붕어형). depth 0(깊다) ~ 1(수면) — 클수록 크고 짙다.
// flee = 남은 도망 시간, burst = 순간 가속 잔량, avoidT = 슬금슬금 비켜가기, curious = 먹이 쪽으로 가는 중, scare = 놀란 기억(예민).
type Fish = {
  x: number;
  y: number;
  hd: number;
  spd: number;
  cruise: number;
  k: number;
  shape: 0 | 1;
  big: boolean;
  ph: number;
  depth: number;
  depthT: number;
  flee: number;
  burst: number;
  avoid: number;
  avoidT: number;
  curious: number;
  scare: number;
  bold: number;
  side: number;
  nextGulp: number;
  wag: number;
  leave: boolean; // 여력이 줄어 가장자리로 나가는 중(화면 밖에서 제거)
  grp: 0 | 1; // 무리 — 두 무리가 다른 목표를 따라 흩어진다(많을 때 한 덩어리로 뭉치지 않게)
};
type Crumb = { x: number; y: number; t0: number; food: number };
type Drop = { x: number; y: number; vx: number; vy: number; life: number };
type Bubble = { x: number; y: number; t0: number };
type Glint = { x: number; y: number; ph: number; r: number };
type Prop = {
  kind: PropKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number; // 회전(튜브 자전용)
  ph: number; // 흔들림 위상
  k: number;
  grab: boolean;
  gox: number;
  goy: number;
  lift: number;
  born: number;
  entered: boolean;
  dvx: number; // 해류/노 젓기(목표 속도)
  dvy: number;
  lx: number; // 마지막 항적 도장 위치
  ly: number;
  nextRing: number;
  // 오리 행동
  state: DuckState;
  until: number;
  face: 1 | -1; // -1 = 왼쪽을 본다(스프라이트 원본)
  tx: number;
  ty: number;
  nextCurious: number;
  curiousT: number;
  nextTick: number;
  crumb: Crumb | null;
};
type FishParts = { body: HTMLCanvasElement; tail: HTMLCanvasElement; jx: number };

const STAMP_SPR = 96;
const FISH_SPR = 80; // 그림자 스프라이트 한 변(CSS px). k 0.45~0.7 → 36~56px, 큰 놈 1.05~1.2
const JOINT = 0.56; // 머리(왼쪽 끝 = 0)에서 꼬리 관절까지의 비율

export function createSummer(seed: number): Scene {
  const rand = rng(seed);
  const path: Node[] = [];
  const stamps: Stamp[] = [];
  const rings: Ring[] = [];
  const props: Prop[] = [];
  let lo: { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;
  let loS = 0.5;
  let loW = 0;
  let loH = 0;
  let stampSpr: HTMLCanvasElement | null = null;
  let shadow: HTMLCanvasElement | null = null;
  let duckSpr: Sprite | null = null;
  let duckSub: Sprite | null = null; // 물속 부분용 — 물빛으로 물든 사본(수면선 아래를 이걸로 그린다)
  let ringSpr: Sprite | null = null;
  const fishParts: (FishParts | null)[] = [null, null];
  let lastX = -9999;
  let lastY = -9999;
  let sx = -9999;
  let sy = -9999;
  let spawned = 0;
  let stamped = 0;
  let nextTube = 10;
  let tubes = 0;
  const fish: Fish[] = [];
  const crumbs: Crumb[] = [];
  const drops: Drop[] = [];
  let schoolX = 0;
  let schoolY = 0;
  let school2X = 0;
  let school2Y = 0;
  let schoolNext = 0;
  let startles = 0;
  let contagions = 0;
  let gulps = 0;
  let avoids = 0;
  let alarms = 0;
  let curiosities = 0;
  const duckStates: Record<DuckState, number> = { drift: 0, paddle: 0, dabble: 0, preen: 0, bathe: 0, shake: 0, curious: 0, wait: 0, alarm: 0 };
  const bubbles: Bubble[] = [];
  let nextBubble = 4;
  const glints: Glint[] = [];
  let w = 0;
  let h = 0;

  // 실루엣을 **한 번** 부드럽게 흐린 뒤(그림자는 가장자리가 없어야 한다 — 저해상 층에 또렷한 실루엣을 찍으면 계단이 드러났다,
  // 2026-09-04 실측) 몸통/꼬리 두 장으로 나눠 굽는다 — 꼬리는 관절(jx)에서 따로 돌린다(매 프레임 clip 없이 drawImage 둘).
  // 흐림은 굽는 순간 한 번뿐(프레임마다 filter 금지 규칙과 충돌 없음); canvas filter가 없는 브라우저는 고리 겹치기로 대신한다.
  function soften(s: Sprite): HTMLCanvasElement {
    const { c, g } = makeCanvas(s.c.width, s.c.height);
    const ctx = g as CanvasRenderingContext2D & { filter?: string };
    if (typeof ctx.filter === "string") {
      ctx.filter = "blur(7px)";
      g.drawImage(s.c, 0, 0);
      ctx.filter = "none";
    } else {
      for (const [r, n, a] of [
        [16, 12, 0.05],
        [10, 10, 0.07],
        [5, 8, 0.1]
      ] as const) {
        g.globalAlpha = a;
        for (let i = 0; i < n; i++) g.drawImage(s.c, Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r);
      }
      g.globalAlpha = 0.5;
      g.drawImage(s.c, 0, 0);
    }
    return c;
  }
  function splitFish(s: Sprite): FishParts {
    const soft = soften(s);
    const W = soft.width;
    const H = soft.height;
    const jp = Math.round(W * JOINT);
    const body = makeCanvas(W, H);
    body.g.drawImage(soft, 0, 0, jp + 1, H, 0, 0, jp + 1, H);
    const tail = makeCanvas(W, H);
    tail.g.drawImage(soft, jp - 1, 0, W - jp + 1, H, jp - 1, 0, W - jp + 1, H);
    return { body: body.c, tail: tail.c, jx: (JOINT - 0.5) * FISH_SPR };
  }
  function bake() {
    if (stampSpr) return;
    // 거품 = 옅은 물빛 무리 + 흰 거품(2026-09-04 사용자: "너무 진해서 어색한 부분이 보인다 — 흐릿하게 글러듯"). 진한 파랑은
    // 쓰지 않고, 흐림은 저해상 레이어 배율(ensureLo)로 낸다.
    const { c, g } = makeCanvas(STAMP_SPR, STAMP_SPR);
    softBlob(g, STAMP_SPR / 2, STAMP_SPR / 2, STAMP_SPR / 2, "150 195 228", 0.28, 0);
    softBlob(g, STAMP_SPR / 2, STAMP_SPR / 2, STAMP_SPR * 0.3, "255 255 252", 0.7, 0);
    stampSpr = c;
    shadow = shadowSprite(96, 64, "30 60 90", 0.4);
    void loadSprite(ASSET.duck, 56, 56).then((s) => (duckSpr = s)).catch(() => {});
    void loadSprite(ASSET.duck, 56, 56, 2, "rgb(150 190 222 / 0.78)").then((s) => (duckSub = s)).catch(() => {});
    void loadSprite(ASSET.ring, 92, 92).then((s) => (ringSpr = s)).catch(() => {});
    const tint = "rgb(28 58 88)";
    void loadSprite(ASSET.fishShadowSlim, FISH_SPR, FISH_SPR, 2, tint).then((s) => (fishParts[0] = splitFish(s))).catch(() => {});
    void loadSprite(ASSET.fishShadowFantail, FISH_SPR, FISH_SPR, 2, tint).then((s) => (fishParts[1] = splitFish(s))).catch(() => {});
  }
  function ensureLo(f: Frame) {
    // 항적·그림자는 일부러 흐리게(0.28~0.36×) — 또렷한 가장자리가 어색함을 드러낸다(사용자 2026-09-04).
    const want = f.load >= 0.6 ? 0.36 : f.load >= 0.3 ? 0.32 : 0.28;
    if (lo && Math.abs(want - loS) < 0.001 && loW === f.w && loH === f.h) return;
    loS = want;
    loW = f.w;
    loH = f.h;
    lo = makeCanvas(Math.ceil(f.w * loS), Math.ceil(f.h * loS));
  }
  function ring(x: number, y: number, maxR: number, a: number, delay: number, dur: number, wd: number) {
    rings.push({ x, y, life: -delay, dur, maxR, a, w: wd });
  }
  function stamp(x: number, y: number, t: number, sf: number, r: number) {
    stamps.push({ x, y, t0: t, sf, r });
    stamped++;
    if (stamps.length > 1400) stamps.shift();
  }
  function newProp(kind: PropKind, t: number): Prop {
    return {
      kind,
      x: rand() * w,
      y: rand() * h,
      vx: 0,
      vy: 0,
      a: rand() * TAU,
      ph: rand() * TAU,
      k: kind === "duck" ? 0.9 + rand() * 0.25 : 1,
      grab: false,
      gox: 0,
      goy: 0,
      lift: 0,
      born: t,
      entered: kind === "duck",
      dvx: 0,
      dvy: 0,
      lx: 0,
      ly: 0,
      nextRing: t + 1 + rand() * 2,
      state: "drift",
      until: t + 3 + rand() * 4,
      face: rand() < 0.5 ? -1 : 1,
      tx: 0,
      ty: 0,
      nextCurious: t + 6,
      curiousT: 0,
      nextTick: 0,
      crumb: null
    };
  }
  // 튜브 — 가장자리 밖에서 천천히 들어와 가로질러 나간다("가끔 밀려온다").
  function spawnTube(t: number) {
    const p = newProp("ring", t);
    const edge = Math.floor(rand() * 4);
    const m = 80;
    p.x = edge === 0 ? -m : edge === 1 ? w + m : w * (0.2 + rand() * 0.6);
    p.y = edge === 2 ? -m : edge === 3 ? h + m : h * (0.2 + rand() * 0.6);
    const tx = w * (0.25 + rand() * 0.5);
    const ty = h * (0.25 + rand() * 0.5);
    const d = Math.hypot(tx - p.x, ty - p.y) || 1;
    const sp = 22 + rand() * 14;
    p.dvx = ((tx - p.x) / d) * sp;
    p.dvy = ((ty - p.y) / d) * sp;
    p.vx = p.dvx;
    p.vy = p.dvy;
    p.lx = p.x;
    p.ly = p.y;
    props.push(p);
    tubes++;
  }
  const radiusOf = (p: Prop) => (p.kind === "duck" ? 27 * p.k : 46);
  // 물고기 수 = 여력에 비례(2026-09-04 사용자: "컴퓨터 능력에 따라 늘리거나 줄여라") × 화면 넓이. 가볍게(load .3)도 4마리쯤은
  // 보인다(lite는 계절이 알아보여야 한다). 큰 놈은 .6부터 하나, .9부터 둘. 늘 땐 가장자리에서 헤엄쳐 들어오고 줄 땐 가장자리로
  // 나간다(순간 등장·소멸 금지 — 소품 원칙).
  const areaK = () => clamp((w * h) / 1_440_000, 0.6, 1.5);
  const fishTarget = (load: number) => (load < 0.12 ? 0 : Math.round(lerp(2, 14, clamp((load - 0.12) / 0.88, 0, 1)) * areaK()));
  const bigTarget = (load: number) => (load >= 0.9 ? 2 : load >= 0.6 ? 1 : 0);
  let nextFishChange = 0;
  let lastLoad = 0.5;
  function newFish(big: boolean): Fish {
    const cruise = big ? 16 + rand() * 8 : 26 + rand() * 30; // 개체마다 다른 걸음 — 큰 놈은 느긋하게
    // 가장자리 밖에서 안쪽을 향해 들어온다.
    const e = Math.floor(rand() * 4);
    const m = 70;
    const x = e === 0 ? -m : e === 1 ? w + m : rand() * w;
    const y = e === 2 ? -m : e === 3 ? h + m : rand() * h;
    return {
      x,
      y,
      hd: Math.atan2(h * (0.2 + rand() * 0.6) - y, w * (0.2 + rand() * 0.6) - x),
      spd: cruise,
      cruise,
      k: big ? 1.15 + rand() * 0.2 : 0.5 + rand() * 0.3,
      shape: big ? 0 : rand() < 0.65 ? 0 : 1,
      big,
      ph: rand() * TAU,
      depth: 0.5,
      depthT: 0.5,
      flee: 0,
      burst: 0,
      avoid: 0,
      avoidT: 0,
      curious: 0,
      scare: 0,
      bold: big ? 1.7 : 0.8 + rand() * 0.5, // 대담함 — 클수록 늦게, 가까이서 튄다
      side: rand() < 0.5 ? 1 : -1,
      nextGulp: 0,
      wag: 0,
      leave: false,
      grp: rand() < 0.5 ? 0 : 1
    };
  }
  // 나갈 놈 고르기 — 포인터에서 가장 먼 놈이 가장 가까운 가장자리로 헤엄쳐 나간다.
  function fishLeave(big: boolean, p: Frame["p"]) {
    let pick: Fish | null = null;
    let fd = -1;
    for (const q of fish) {
      if (q.big !== big || q.leave) continue;
      const d = p.inside ? Math.hypot(q.x - p.x, q.y - p.y) : rand() * 1000;
      if (d > fd) {
        fd = d;
        pick = q;
      }
    }
    if (pick) pick.leave = true;
  }
  // C-start — 자극 반대쪽으로 순간 가속(가끔 옆으로 튀는 protean), 깊이 숨는다.
  function startle(q: Fish, fromX: number, fromY: number, strong: boolean) {
    const away = Math.atan2(q.y - fromY, q.x - fromX);
    const side = rand() < 0.14 ? (rand() < 0.5 ? 1 : -1) * (Math.PI / 2) : 0;
    q.hd = away + side + (rand() - 0.5) * 0.8;
    q.flee = (strong ? 1.1 : 0.7) + rand() * 0.5;
    q.burst = 1;
    q.spd = q.cruise * 4.5;
    q.curious = 0;
    q.avoidT = 0;
    q.scare = Math.min(1, q.scare + 0.6);
    q.depthT = 0.08;
    startles++;
  }
  function duckSet(d: Prop, state: DuckState, dur: number, t: number) {
    d.state = state;
    d.until = t + dur;
    duckStates[state]++;
  }
  function splash(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const sp = 40 + rand() * 90;
      drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.55 + rand() * 0.3 });
    }
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      bake();
      ensureLo(f);
      if (!props.some((p) => p.kind === "duck")) {
        const d = newProp("duck", f.t);
        d.x = w * (0.3 + rand() * 0.4);
        d.y = h * (0.3 + rand() * 0.4);
        // 핫 존(달력)이 있으면 그 둘레의 빈 띠 중 가장 넓은 곳에서 시작한다(위·아래·왼쪽·오른쪽).
        const hot = f.hot;
        if (hot) {
          const bands: [number, number, number, number][] = [
            [0, 0, w, hot.y],
            [0, hot.y + hot.h, w, h - hot.y - hot.h],
            [0, 0, hot.x, h],
            [hot.x + hot.w, 0, w - hot.x - hot.w, h]
          ];
          const best = bands.filter((b) => b[2] >= 70 && b[3] >= 70).sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
          if (best) {
            d.x = best[0] + 35 + rand() * (best[2] - 70);
            d.y = best[1] + 35 + rand() * (best[3] - 70);
          }
        }
        d.lx = d.x;
        d.ly = d.y;
        props.push(d);
      }
    },
    step(f) {
      const { dt, p, t, load } = f;
      lastLoad = load;
      ensureLo(f);
      const ttl = lerp(1.5, 3.0, load);
      const gapPx = lerp(9, 4, load);
      // ① 포인터 항적 — 길(팔·마루용 노드) + 거품 도장(길 위 몇 px마다). 집중 모드(끌기 중)엔 쉰다 — 끌기 스프링에 프레임 양보.
      if (!f.dim && p.inside && p.moved && p.speed > 40) {
        const sp = clamp(p.speed, 40, 2400);
        const sf = clamp((sp - 40) / 1400, 0.12, 1);
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        if (moved > gapPx * 1.6) {
          const dx = p.vx / (p.speed || 1);
          const dy = p.vy / (p.speed || 1);
          path.push({ x: p.x, y: p.y, t0: t, nx: -dy, ny: dx, sf });
          spawned++;
          lastX = p.x;
          lastY = p.y;
          if (path.length > 360) path.shift();
        }
        if (sx < -9000 || Math.hypot(p.x - sx, p.y - sy) > 90) {
          sx = p.x;
          sy = p.y;
        }
        let d = Math.hypot(p.x - sx, p.y - sy);
        while (d >= gapPx) {
          const k = gapPx / d;
          sx += (p.x - sx) * k;
          sy += (p.y - sy) * k;
          stamp(sx + (rand() - 0.5) * 3, sy + (rand() - 0.5) * 3, t, sf, 8 + 22 * sf);
          d = Math.hypot(p.x - sx, p.y - sy);
        }
      }
      while (path.length && t - path[0].t0 > ttl) path.shift();
      const sttl = ttl * 1.15;
      while (stamps.length && t - stamps[0].t0 > sttl) stamps.shift();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt / r.dur;
        if (r.life >= 1) rings.splice(i, 1);
      }
      // 먹이(누른 자리) — 12초 또는 다 먹히면 사라진다.
      for (let i = crumbs.length - 1; i >= 0; i--) {
        const c = crumbs[i];
        c.food -= dt * 0.06;
        if (c.food <= 0 || t - c.t0 > 12) crumbs.splice(i, 1);
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const q = drops[i];
        q.life -= dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 320 * dt;
        if (q.life <= 0) drops.splice(i, 1);
      }
      // ② 소품 — 해류 따라 둥둥, 잡히면 손을 따라, 놓으면 물의 저항으로 멈춘다. 튜브는 여력이 있을 때만 가끔.
      if (load >= 0.5 && t > nextTube && !props.some((q) => q.kind === "ring")) {
        spawnTube(t);
        nextTube = t + 40 + rand() * 40;
      }
      const drag = Math.pow(0.28, dt);
      for (let i = props.length - 1; i >= 0; i--) {
        const q = props[i];
        if (q.grab) {
          q.gox *= 0.9;
          q.goy *= 0.9;
          const tx = p.x + q.gox;
          const ty = p.y + q.goy;
          q.vx = (tx - q.x) * 16;
          q.vy = (ty - q.y) * 16;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.lift = Math.min(1, q.lift + dt * 6);
        } else {
          if (q.kind === "duck") {
            // 해류 — 늘 조금은 흐른다.
            const cx = 7 * Math.sin(q.y * 0.004 + t * 0.11) + 3 * Math.cos(t * 0.07 + q.ph);
            const cy = 6 * Math.cos(q.x * 0.005 + t * 0.09) + 3 * Math.sin(t * 0.05 + q.ph);
            q.dvx = cx;
            q.dvy = cy;
            const th = threat(p, q.x, q.y);
            // 덮쳐오면(loom·급접근·코앞) 퍼덕이며 달아난다 — 느린 접근은 참는다.
            if (q.state !== "alarm" && ((th.loom > 2.6 && th.d < 240) || (th.rate > 320 && th.d < 200) || th.d < 24)) {
              duckSet(q, "alarm", 1.4, t);
              const away = Math.atan2(q.y - p.y, q.x - p.x);
              q.tx = clamp(q.x + Math.cos(away) * 260, 40, w - 40);
              q.ty = clamp(q.y + Math.sin(away) * 260, 40, h - 40);
              q.curiousT = 0;
              q.crumb = null;
              q.nextCurious = t + 10;
              alarms++;
              splash(q.x, q.y, 6);
            }
            // 먹이가 튀면(누르기) 220px 안이면 그리로 헤엄쳐 간다 — 사람 손 = 먹이.
            if ((q.state === "drift" || q.state === "paddle" || q.state === "wait" || q.state === "preen") && !q.crumb) {
              let best: Crumb | null = null;
              let bd = 220;
              for (const c of crumbs) {
                const d = Math.hypot(c.x - q.x, c.y - q.y);
                if (d < bd && t - c.t0 < 6) {
                  bd = d;
                  best = c;
                }
              }
              if (best) {
                q.crumb = best;
                q.tx = best.x;
                q.ty = best.y;
                duckSet(q, "paddle", 20, t);
              }
            }
            // 호기심 — 포인터가 느리게 다가와 근처에 1초쯤 머물면 "먹이 주나?" 하고 다가온다(오리는 사람을 먹이와 연결한다).
            if ((q.state === "drift" || q.state === "paddle") && !q.crumb && p.inside && t > q.nextCurious && th.d < 280 && th.d > 90 && p.speed < 160 && th.rate > -60) {
              q.curiousT += dt;
              if (q.curiousT > 1.0) {
                duckSet(q, "curious", 8, t);
                q.curiousT = 0;
                curiosities++;
              }
            } else q.curiousT = 0;
            const state = q.state;
            if (state === "drift") {
              if (t > q.until) {
                const r = rand();
                if (r < 0.32) duckSet(q, "drift", 3 + rand() * 4, t);
                else if (r < 0.56) {
                  duckSet(q, "paddle", 12, t);
                  q.tx = 40 + rand() * (w - 80);
                  q.ty = 40 + rand() * (h - 80);
                } else if (r < 0.74) duckSet(q, "dabble", 2 + rand() * 1.5, t);
                else if (r < 0.88) duckSet(q, "preen", 1.6 + rand() * 1.2, t);
                else duckSet(q, "bathe", 1.4, t);
              }
            } else if (state === "paddle" || state === "curious" || state === "alarm") {
              if (state === "curious") {
                q.tx = p.x;
                q.ty = p.y;
              }
              const dx = q.tx - q.x;
              const dy = q.ty - q.y;
              const d = Math.hypot(dx, dy);
              const stop = state === "curious" ? 70 : 14;
              const sp = state === "alarm" ? 130 : state === "curious" ? 32 : 26;
              if (d > stop) {
                q.dvx += (dx / d) * sp;
                q.dvy += (dy / d) * sp;
                if (state !== "alarm") q.face = dx > 0 ? 1 : -1;
              } else if (state === "paddle") {
                if (q.crumb) duckSet(q, "dabble", 2.5 + rand() * 1.5, t);
                else duckSet(q, "drift", 2 + rand() * 3, t);
              } else if (state === "curious") duckSet(q, "wait", 3.5, t);
              if (t > q.until) {
                if (state === "alarm") q.nextCurious = t + 10;
                duckSet(q, "drift", 2 + rand() * 3, t);
                q.crumb = null;
              }
              if (state === "alarm") q.face = q.dvx > 0 ? 1 : -1;
            } else if (state === "wait") {
              // 포인터를 바라보며 기다린다 — 먹이가 안 오면 실망하고 흘러간다.
              if (p.inside) q.face = p.x > q.x ? 1 : -1;
              if (t > q.until) {
                duckSet(q, "drift", 3 + rand() * 3, t);
                q.nextCurious = t + 14;
              }
            } else if (state === "dabble") {
              // 자맥질 — 머리를 물속에 박고(엉덩이만 남는다) 머리 쪽(face 방향)에서 고리가 번진다.
              if (t > q.nextTick) {
                ring(q.x + q.face * 14 * q.k, q.y + 4, 26, 0.3, 0, 1.4, 1.2);
                if (q.crumb) q.crumb.food -= 0.12;
                q.nextTick = t + 0.5 + rand() * 0.3;
              }
              if (t > q.until) {
                q.crumb = null;
                duckSet(q, "drift", 2 + rand() * 3, t);
              }
            } else if (state === "preen") {
              if (t > q.until) duckSet(q, "drift", 2 + rand() * 3, t);
            } else if (state === "bathe") {
              // 목욕 — 머리를 담갔다 들며 물방울이 튄다.
              if (t > q.nextTick) {
                ring(q.x + q.face * 14 * q.k, q.y + 6, 22, 0.35, 0, 1.0, 1.4);
                splash(q.x + q.face * 10, q.y, 5);
                q.nextTick = t + 0.28;
              }
              if (t > q.until) duckSet(q, "shake", 0.55, t);
            } else if (state === "shake") {
              if (t > q.nextTick) {
                splash(q.x, q.y - 8, 3);
                q.nextTick = t + 0.12;
              }
              if (t > q.until) duckSet(q, "drift", 3 + rand() * 3, t);
            }
            // 핫 존(달력·포스터 표면) 위에선 집을 수 없고 칸을 가리니 — 가장 가까운 가장자리 밖으로 살살 밀려난다.
            const hot = f.hot;
            if (hot) {
              const m = 24;
              const inX = q.x > hot.x - m && q.x < hot.x + hot.w + m;
              const inY = q.y > hot.y - m && q.y < hot.y + hot.h + m;
              if (inX && inY) {
                const dl = q.x - hot.x;
                const dr = hot.x + hot.w - q.x;
                const dtp = q.y - hot.y;
                const db = hot.y + hot.h - q.y;
                const min = Math.min(dl, dr, dtp, db);
                const k = 46;
                if (min === dl) q.dvx -= k;
                else if (min === dr) q.dvx += k;
                else if (min === dtp) q.dvy -= k;
                else q.dvy += k;
              }
            }
          }
          q.vx = q.dvx + (q.vx - q.dvx) * drag;
          q.vy = q.dvy + (q.vy - q.dvy) * drag;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.lift = Math.max(0, q.lift - dt * 4);
          if (q.kind === "duck") {
            const m = 34;
            if (q.x < m) {
              q.x = m;
              q.vx = Math.abs(q.vx) + 4;
            } else if (q.x > w - m) {
              q.x = w - m;
              q.vx = -Math.abs(q.vx) - 4;
            }
            if (q.y < m) {
              q.y = m;
              q.vy = Math.abs(q.vy) + 4;
            } else if (q.y > h - m) {
              q.y = h - m;
              q.vy = -Math.abs(q.vy) - 4;
            }
            // 흐름만으로도 조금 움직이면 그쪽을 본다(히스테리시스).
            if (q.state === "drift" || q.state === "paddle") {
              if (q.vx > 9) q.face = 1;
              else if (q.vx < -9) q.face = -1;
            }
          } else {
            const inside = q.x > -60 && q.x < w + 60 && q.y > -60 && q.y < h + 60;
            if (inside) q.entered = true;
            const gone = q.x < -110 || q.x > w + 110 || q.y < -110 || q.y > h + 110;
            if ((q.entered && gone) || t - q.born > 150) {
              props.splice(i, 1);
              continue;
            }
          }
        }
        const sp = Math.hypot(q.vx, q.vy);
        if (q.kind === "duck") {
          if (q.grab) q.face = q.vx > 20 ? 1 : q.vx < -20 ? -1 : q.face;
        } else q.a += (0.12 + (q.grab ? 0 : sp * 0.002)) * dt;
        q.ph += dt * 1.7;
        // 소품 항적 — 빠르게 끌거나 던지면 거품 띠를, 노를 저으면 옅은 띠를 남긴다.
        const paddling = q.kind === "duck" && !q.grab && sp > 18 && sp <= 70 && (q.state === "paddle" || q.state === "curious");
        if (load >= 0.4 && (sp > 70 || paddling)) {
          const dd = Math.hypot(q.x - q.lx, q.y - q.ly);
          if (dd > (paddling ? 14 : 7)) {
            const sf = paddling ? 0.12 : clamp(sp / 900, 0.15, 1);
            stamp(q.x + (rand() - 0.5) * 4, q.y + (rand() - 0.5) * 4, t, sf, paddling ? 6 : 5 + 10 * sf);
            q.lx = q.x;
            q.ly = q.y;
          }
        } else {
          q.lx = q.x;
          q.ly = q.y;
        }
        // 떠 있는 동안 둘레로 잔물결 고리 하나씩(둥둥).
        if (load >= 0.25 && !q.grab && t > q.nextRing) {
          ring(q.x, q.y, radiusOf(q) + 26, 0.22, 0, 1.9, 1.2);
          q.nextRing = t + 2.2 + rand() * 2.4;
        }
      }
      // ③ 물고기 — 수는 여력으로(2~14 × 넓이 + 큰 놈 0~2), 0.5초에 한 마리씩 가장자리로 드나든다. 무리 목표가 몇 초마다 옮겨진다.
      if (t > nextFishChange) {
        const wantSmall = fishTarget(load);
        const wantBig = bigTarget(load);
        const small = fish.filter((q) => !q.big && !q.leave).length;
        const big = fish.filter((q) => q.big && !q.leave).length;
        let changed = false;
        if (small < wantSmall) {
          fish.push(newFish(false));
          changed = true;
        } else if (small > wantSmall) {
          fishLeave(false, p);
          changed = true;
        }
        if (big < wantBig) {
          fish.push(newFish(true));
          changed = true;
        } else if (big > wantBig) {
          fishLeave(true, p);
          changed = true;
        }
        nextFishChange = t + (changed ? 0.5 : 0.2);
      }
      for (let i = fish.length - 1; i >= 0; i--) {
        const q = fish[i];
        if (q.leave && (q.x < -90 || q.x > w + 90 || q.y < -90 || q.y > h + 90)) fish.splice(i, 1);
      }
      if (fish.length) {
        if (t > schoolNext) {
          schoolX = w * (0.15 + rand() * 0.7);
          schoolY = h * (0.15 + rand() * 0.7);
          // 둘째 무리 목표는 첫째에서 화면 너비의 1/4 이상 떨어진 곳.
          school2X = clamp(schoolX + (rand() < 0.5 ? -1 : 1) * w * (0.25 + rand() * 0.3), w * 0.1, w * 0.9);
          school2Y = h * (0.15 + rand() * 0.7);
          schoolNext = t + 6 + rand() * 8;
        }
        const justStartled: Fish[] = [];
        for (const q of fish) {
          q.scare = Math.max(0, q.scare - dt * 0.12);
          const th = threat(p, q.x, q.y);
          const sens = (1 / q.bold) * (1 + q.scare * 0.8); // 방금 놀란 놈은 더 예민하다
          if (q.flee <= 0 && p.inside) {
            const touch = th.d < 26 + 14 * q.k;
            const fast = (th.loom * sens > 3.0 && th.d < 260) || (th.rate * sens > 300 && th.d < 190);
            if (touch || fast) {
              startle(q, p.x, p.y, fast);
              justStartled.push(q);
            } else if (th.d < 80 && th.rate > -30 && q.avoidT <= 0 && q.curious <= 0) {
              // 머리 위에 멈춘 그림자(새) — 폭발 없이 슬금슬금 비켜간다.
              q.avoid = Math.atan2(q.y - p.y, q.x - p.x) + (rand() - 0.5) * 0.6;
              q.avoidT = 0.6;
              avoids++;
            }
          }
        }
        // 놀람 전염 — 튄 놈 90px 안의 이웃도 같은 곳에서 튄다.
        for (const s of justStartled) {
          for (const o of fish) {
            if (o === s || o.flee > 0) continue;
            if (Math.hypot(o.x - s.x, o.y - s.y) < 90) {
              startle(o, p.x, p.y, false);
              contagions++;
            }
          }
        }
        for (const q of fish) {
          // 먹이 — 겁먹지 않은 놈이 380px 안의 가라앉은(1초 지난) 먹이로.
          let crumb: Crumb | null = null;
          if (q.flee <= 0 && q.scare < 0.35 && crumbs.length) {
            let bd = 380;
            for (const c of crumbs) {
              if (t - c.t0 < 1.0) continue;
              const d = Math.hypot(c.x - q.x, c.y - q.y);
              if (d < bd) {
                bd = d;
                crumb = c;
              }
            }
          }
          q.curious = crumb ? 1 : 0;
          let freq = 9;
          if (q.flee > 0) {
            q.flee -= dt;
            q.burst = Math.max(0, q.burst - dt / 0.9);
            q.hd += Math.sin(t * 30 + q.ph) * 0.4 * dt;
            freq = 24;
          } else if (q.avoidT > 0) {
            q.avoidT -= dt;
            q.hd += clamp(angleDiff(q.avoid, q.hd), -2.5 * dt, 2.5 * dt);
            q.depthT = 0.3;
          } else if (q.leave) {
            // 가장 가까운 가장자리로 헤엄쳐 나간다(여력이 줄었다).
            const exits: [number, number][] = [
              [-100, q.y],
              [w + 100, q.y],
              [q.x, -100],
              [q.x, h + 100]
            ];
            exits.sort((a, b) => Math.hypot(a[0] - q.x, a[1] - q.y) - Math.hypot(b[0] - q.x, b[1] - q.y));
            q.hd += clamp(angleDiff(Math.atan2(exits[0][1] - q.y, exits[0][0] - q.x), q.hd), -2 * dt, 2 * dt);
            q.depthT = 0.3;
          } else if (crumb) {
            const dx = crumb.x - q.x;
            const dy = crumb.y - q.y;
            const d = Math.hypot(dx, dy);
            freq = 12;
            if (d < 26 + 10 * q.k) {
              // 먹이 둘레를 맴돌며 수면에서 뻐끔 — 작은 고리.
              const tang = Math.atan2(dy, dx) + (Math.PI / 2) * q.side;
              q.hd += clamp(angleDiff(tang, q.hd), -3.5 * dt, 3.5 * dt);
              q.depthT = 1;
              crumb.food -= dt * 0.25;
              if (t > q.nextGulp) {
                ring(q.x + Math.cos(q.hd) * 8 * q.k, q.y + Math.sin(q.hd) * 8 * q.k, 14 + 8 * q.k, 0.32, 0, 1.1, 1);
                q.nextGulp = t + 0.6 + rand() * 0.6;
                gulps++;
              }
            } else {
              q.hd += clamp(angleDiff(Math.atan2(dy, dx), q.hd), -3 * dt, 3 * dt);
              q.depthT = 0.7;
            }
          } else if (q.big) {
            // 큰 놈 — 혼자 느긋하게 순찰(무리 목표 둘레 큰 원).
            const tx = schoolX + Math.cos(q.ph) * 140;
            const ty = schoolY + Math.sin(q.ph) * 140;
            q.hd += clamp(angleDiff(Math.atan2(ty - q.y, tx - q.x), q.hd), -1.2 * dt, 1.2 * dt) + Math.sin(t * 1.3 + q.ph) * 0.3 * dt;
            q.depthT = 0.4 + 0.15 * Math.sin(t * 0.25 + q.ph);
          } else {
            // 무리(boids): 목표 + 정렬 + 응집 + 분리. 두 무리(grp)가 다른 목표를 따르고, 같은 무리끼리만 정렬·응집한다.
            const gx = q.grp === 0 ? schoolX : school2X;
            const gy = q.grp === 0 ? schoolY : school2Y;
            const tx = gx + Math.cos(q.ph + t * 0.3) * 90;
            const ty = gy + Math.sin(q.ph + t * 0.27) * 90;
            let dx = tx - q.x;
            let dy = ty - q.y;
            const dl = Math.hypot(dx, dy) || 1;
            dx /= dl;
            dy /= dl;
            let ax = 0;
            let ay = 0;
            let cx = 0;
            let cy = 0;
            let n = 0;
            let sepx = 0;
            let sepy = 0;
            const sepR = 34 + 14 * q.k; // 몸집만큼 간격 — 뭉쳐 한 덩어리 그림자가 되지 않게
            for (const o of fish) {
              if (o === q || o.big) continue;
              const ox = o.x - q.x;
              const oy = o.y - q.y;
              const d = Math.hypot(ox, oy);
              if (d > 110 || d < 0.01) continue;
              if (d < sepR) {
                sepx -= (ox / d) * (1 - d / sepR);
                sepy -= (oy / d) * (1 - d / sepR);
              }
              if (o.grp !== q.grp) continue;
              n++;
              ax += Math.cos(o.hd);
              ay += Math.sin(o.hd);
              cx += ox;
              cy += oy;
            }
            let vx = dx;
            let vy = dy;
            if (n) {
              const cl = Math.hypot(cx, cy) || 1;
              vx += 0.8 * (ax / n) + 0.35 * (cx / cl);
              vy += 0.8 * (ay / n) + 0.35 * (cy / cl);
            }
            vx += 1.8 * sepx;
            vy += 1.8 * sepy;
            q.hd += clamp(angleDiff(Math.atan2(vy, vx), q.hd), -1.8 * dt, 1.8 * dt) + Math.sin(t * 2.1 + q.ph) * 0.5 * dt;
            q.depthT = 0.45 + 0.15 * Math.sin(t * 0.3 + q.ph);
          }
          // 헤엄은 꼬리질 박자에 맞춰 밀렸다 미끄러진다(등속 아님). 튈 땐 순간 4.5배에서 1초 안에 잦아든다.
          const pulse = 0.75 + 0.5 * Math.max(0, Math.sin(t * freq + q.ph));
          const want = q.cruise * (q.flee > 0 ? 1 + 3.5 * q.burst : crumb ? 1.35 : q.leave ? 1.3 : 1) * pulse;
          q.spd += (want - q.spd) * Math.min(1, dt * (q.flee > 0 ? 3 : 8));
          q.x += Math.cos(q.hd) * q.spd * dt;
          q.y += Math.sin(q.hd) * q.spd * dt;
          q.ph += dt * (q.flee > 0 ? 3 : 1);
          q.depth += (q.depthT - q.depth) * Math.min(1, dt * (q.flee > 0 ? 4 : 1.2));
          q.wag = Math.sin(t * freq + q.ph) * (q.flee > 0 ? 0.42 : 0.18 + 0.12 * clamp(q.spd / (q.cruise * 2), 0, 1));
          if (!q.leave) {
            const m = 60;
            if (q.x < -m) q.x = w + m - 1;
            else if (q.x > w + m) q.x = -m + 1;
            if (q.y < -m) q.y = h + m - 1;
            else if (q.y > h + m) q.y = -m + 1;
          }
        }
      }
      // ④ 물방울 — 여력 0.5부터 3~8초에 하나, 1.4초 동안 커졌다 톡 터진다.
      if (load >= 0.5 && t > nextBubble) {
        bubbles.push({ x: 40 + rand() * (w - 80), y: 40 + rand() * (h - 80), t0: t });
        nextBubble = t + 3 + rand() * 5;
      }
      for (let i = bubbles.length - 1; i >= 0; i--) if (t - bubbles[i].t0 > 1.6) bubbles.splice(i, 1);
      // ⑤ 햇빛 반짝임 — 여력 0.3부터 6~14개.
      const wantGl = load >= 0.3 ? Math.round(lerp(6, 14, load)) : 0;
      while (glints.length < wantGl) glints.push({ x: rand() * w, y: rand() * h, ph: rand() * TAU, r: 1.6 + rand() * 1.8 });
      if (glints.length > wantGl) glints.length = wantGl;
      // 소품끼리 겹치지 않게(원 분리).
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          const a = props[i];
          const b = props[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = radiusOf(a) + radiusOf(b) - 6;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 0.001) continue;
          const d = Math.sqrt(d2);
          const ov = (min - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          if (!a.grab) {
            a.x -= nx * ov;
            a.y -= ny * ov;
            a.vx -= nx * 20;
            a.vy -= ny * 20;
          }
          if (!b.grab) {
            b.x += nx * ov;
            b.y += ny * ov;
            b.vx += nx * 20;
            b.vy += ny * 20;
          }
        }
      }
    },
    draw(g, f) {
      const { t, load } = f;
      if (!lo || !stampSpr) return;
      const ttl = lerp(1.5, 3.0, load);
      const sttl = ttl * 1.15;
      const L = lo.g;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.clearRect(0, 0, lo.c.width, lo.c.height);
      L.setTransform(loS, 0, 0, loS, 0, 0);
      L.lineCap = "round";
      L.lineJoin = "round";
      // 물고기 그림자(동물의 숲) — 저해상 층이라 절로 흐릿하다. 수면에 가까울수록(depth) 크고 짙게, 꼬리는 관절에서 젓는다.
      for (const q of fish) {
        const parts = fishParts[q.shape];
        if (!parts) continue;
        const size = q.k * (0.86 + 0.28 * q.depth);
        L.save();
        L.globalAlpha = 0.18 + 0.3 * q.depth;
        L.translate(q.x, q.y);
        L.rotate(q.hd + Math.PI); // 실루엣의 머리 = 왼쪽(−x)
        L.scale(size, size);
        L.drawImage(parts.body, -FISH_SPR / 2, -FISH_SPR / 2, FISH_SPR, FISH_SPR);
        L.translate(parts.jx, 0);
        L.rotate(q.wag);
        L.drawImage(parts.tail, -FISH_SPR / 2 - parts.jx, -FISH_SPR / 2, FISH_SPR, FISH_SPR);
        L.restore();
      }
      // 물방울 — 커지는 고리, 끝에 톡(작은 십자 튐).
      for (const b of bubbles) {
        const e = clamp((t - b.t0) / 1.4, 0, 1);
        const r = 2 + 8 * e;
        L.strokeStyle = `rgb(255 255 255 / ${0.55 * (1 - e * 0.5)})`;
        L.lineWidth = 1.6;
        L.beginPath();
        L.arc(b.x, b.y, r, 0, TAU);
        L.stroke();
        L.strokeStyle = `rgb(150 195 228 / ${0.35 * (1 - e)})`;
        L.beginPath();
        L.arc(b.x, b.y, r + 2, 0, TAU);
        L.stroke();
        if (t - b.t0 > 1.4) {
          const pe = (t - b.t0 - 1.4) / 0.2;
          L.strokeStyle = `rgb(255 255 255 / ${0.7 * (1 - pe)})`;
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + 0.4;
            L.beginPath();
            L.moveTo(b.x + Math.cos(a) * (r + 2), b.y + Math.sin(a) * (r + 2));
            L.lineTo(b.x + Math.cos(a) * (r + 6 + 8 * pe), b.y + Math.sin(a) * (r + 6 + 8 * pe));
            L.stroke();
          }
        }
      }
      // 거품 띠 — 나이 들수록 넓게 번지고 옅어진다(에너지가 흩어짐).
      for (const s of stamps) {
        const age = t - s.t0;
        const k = 1 - age / sttl;
        if (k <= 0) continue;
        const R = s.r * (1 + 1.9 * (1 - k));
        L.globalAlpha = 0.3 * Math.pow(k, 1.3) * (0.4 + 0.6 * s.sf);
        L.drawImage(stampSpr, s.x - R, s.y - R, R * 2, R * 2);
      }
      L.globalAlpha = 1;
      if (path.length > 1) {
        // 각 점의 벌어진 정도 d = (옆으로 퍼지는 속도 ≈ 0.34×진행속도 상당) × 나이. 나이 0.85승 — 처음 빠르게 벌어지고
        // 뒤로 갈수록 느려진다.
        const armPt = (n: Node, s: number, age: number): [number, number] => {
          const d = (36 + 150 * n.sf) * Math.pow(age, 0.85) + 4;
          return [n.x + n.nx * s * d, n.y + n.ny * s * d];
        };
        const passes = load >= 0.3 ? [0, 1] : [1];
        for (const s of [-1, 1]) {
          for (const pass of passes) {
            for (let i = 1; i < path.length; i++) {
              const a0 = path[i - 1];
              const a1 = path[i];
              const age = t - a1.t0;
              const k = 1 - age / ttl;
              if (k <= 0) continue;
              const [x0, y0] = armPt(a0, s, t - a0.t0);
              const [x1, y1] = armPt(a1, s, age);
              const weight = 0.5 + 0.5 * a1.sf;
              if (pass === 0) {
                L.strokeStyle = `rgb(150 195 228 / ${0.14 * k * weight})`;
                L.lineWidth = 14 + 12 * (1 - k);
              } else {
                L.strokeStyle = `rgb(255 255 250 / ${0.28 * Math.pow(k, 1.1) * weight})`;
                L.lineWidth = 4 + 2 * (1 - k);
              }
              L.beginPath();
              L.moveTo(x0, y0);
              L.lineTo(x1, y1);
              L.stroke();
            }
          }
        }
        // 가로 마루 — 몇 점마다 두 팔 사이를 뒤로 볼록하게(항적 안쪽의 층층 물결). 여력이 있을 때만.
        if (load >= 0.55) {
          for (let i = 2; i < path.length; i += 4) {
            const n = path[i];
            const age = t - n.t0;
            const k = 1 - age / ttl;
            if (k <= 0.05) continue;
            const [lx, ly] = armPt(n, -1, age);
            const [rx, ry] = armPt(n, 1, age);
            const back = path[i - 2];
            const bx = back.x - n.x;
            const by = back.y - n.y;
            const bl = Math.hypot(bx, by) || 1;
            const bulge = (14 + 40 * n.sf) * Math.pow(age, 0.6);
            L.strokeStyle = `rgb(255 255 250 / ${0.22 * k * (0.5 + 0.5 * n.sf)})`;
            L.lineWidth = 2.2;
            L.beginPath();
            L.moveTo(lx, ly);
            L.quadraticCurveTo(n.x + (bx / bl) * bulge, n.y + (by / bl) * bulge, rx, ry);
            L.stroke();
          }
        }
      }
      // 원형 잔물결(누름·뻐끔·자맥질) — 부드러운 저해상 층에서.
      for (const r of rings) {
        if (r.life < 0) continue;
        const e = 1 - Math.pow(1 - r.life, 2.4);
        const rad = 6 + r.maxR * e;
        const a = r.a * (1 - r.life);
        const lw = r.w * (1 - r.life * 0.6) + 0.8;
        L.lineWidth = lw * 2.6;
        L.strokeStyle = `rgb(120 175 215 / ${a * 0.4})`;
        L.beginPath();
        L.arc(r.x, r.y, rad, 0, TAU);
        L.stroke();
        L.lineWidth = lw;
        L.strokeStyle = `rgb(255 255 250 / ${a})`;
        L.beginPath();
        L.arc(r.x, r.y, rad, 0, TAU);
        L.stroke();
      }
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "medium";
      g.drawImage(lo.c, 0, 0, f.w, f.h);
      // 햇빛 반짝임 — 물결 위의 작은 별(숨쉬듯 밝아졌다 사라짐), 본 캔버스에 또렷하게.
      for (const gl of glints) {
        const a = Math.max(0, Math.sin(t * 1.4 + gl.ph));
        if (a < 0.05) continue;
        g.save();
        g.translate(gl.x, gl.y);
        g.rotate(gl.ph);
        g.strokeStyle = `rgb(255 255 255 / ${a * 0.9})`;
        g.lineWidth = 1.2;
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * TAU;
          g.moveTo(0, 0);
          g.lineTo(Math.cos(ang) * gl.r * 2.2 * a, Math.sin(ang) * gl.r * 2.2 * a);
        }
        g.stroke();
        g.fillStyle = `rgb(255 255 255 / ${a})`;
        g.beginPath();
        g.arc(0, 0, gl.r * 0.6, 0, TAU);
        g.fill();
        g.restore();
      }
      // 뱃머리 — 빠르게 움직이는 포인터 앞의 밝은 물마루(본 캔버스, 또렷하게).
      const p = f.p;
      if (load >= 0.3 && p.inside && p.speed > 160) {
        const sf = clamp((p.speed - 160) / 1400, 0, 1);
        const dir = Math.atan2(p.vy, p.vx);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(dir);
        g.scale(0.55, 1);
        softBlob(g, 10, 0, 12 + 10 * sf, "255 255 252", 0.5 * sf + 0.12);
        g.restore();
      }
      // 소품 — 그림자(높이만큼 멀리) + 스프라이트(둥둥: 미세한 회전·크기 숨쉬기).
      for (const q of props) {
        const spr = q.kind === "duck" ? duckSpr : ringSpr;
        if (!spr) continue;
        const bob = Math.sin(q.ph) * 0.03;
        const size = q.k * (1 + bob + 0.1 * q.lift);
        if (shadow) {
          // 그림자는 바로 아래(물 위 소품은 그림자가 발밑에 있다 — 옆으로 멀리 떨어진 그림자가 "공중부양"으로 읽혔다,
          // 2026-09-04 사용자). 들어 올리면(끌기) 그제야 멀어진다.
          g.save();
          g.globalAlpha = (q.kind === "duck" ? 0.16 : 0.26) + 0.14 * q.lift;
          g.translate(q.x + 1 + 9 * q.lift, q.y + (q.kind === "duck" ? 9 : 5) + 12 * q.lift);
          if (q.kind === "ring") g.rotate(q.a);
          const sw = q.kind === "duck" ? 52 : 100;
          const sh = q.kind === "duck" ? 26 : 100;
          g.drawImage(shadow, (-sw / 2) * size, (-sh / 2) * size, sw * size, sh * size);
          g.restore();
        }
        if (q.kind === "duck") {
          // 세워 그린다(좌우만 뒤집음). 물에 **잠긴 채**(2026-09-04 사용자: "공중부양 같다"): 수면선(waterY) 아래는 물빛으로 물든
          // 사본(duckSub)을 옅게 — 헤엄칠 땐 발·아랫배가 물속, 자맥질(tip-up)은 코를 물에 박고 몸 대부분이 잠겨 엉덩이만 남는다.
          // 목욕 = 머리를 담갔다 들며 잠긴 깊이가 오르내림, 털기·놀람(퍼덕)은 몸이 물 위로 솟는다. 들어 올리면 전부 물 밖.
          // 기울기 부호: 회전은 세계 좌표 — face(+1 = 오른쪽을 봄)와 같은 부호가 **코를 내린다**.
          const s = q.state;
          let sxk = 1;
          let syk = 1;
          let tilt = Math.sin(q.ph * 0.7) * 0.05;
          let dy = 0;
          let wl = 9 * q.k; // 수면선 = 몸통 중심 아래 (발 + 아랫배 잠김)
          if (s === "dabble") {
            const e = clamp((t - (q.until - 3)) * 2, 0, 1);
            tilt += q.face * 1.05 * e; // 코를 60° 아래로
            dy = 5 * e;
            wl = lerp(9 * q.k, -10 * q.k, e); // 몸 대부분이 물속, 엉덩이만 수면 위
          } else if (s === "shake") {
            sxk = 1 + 0.07 * Math.sin(t * 46);
            syk = 1 - 0.07 * Math.sin(t * 46);
            wl = 13 * q.k;
          } else if (s === "bathe") {
            const dip = Math.abs(Math.sin(t * 5));
            tilt += q.face * 0.3 * dip;
            dy = 3 * dip;
            wl = 9 * q.k - 7 * dip;
          } else if (s === "preen") tilt += Math.sin(t * 6) * 0.1;
          else if (s === "alarm") {
            const fl = Math.abs(Math.sin(t * 24));
            sxk = 1 + 0.14 * fl;
            syk = 1 + 0.1 * fl;
            wl = 14 * q.k; // 퍼덕이며 몸을 세운다
          } else if (s === "wait") tilt += Math.sin(t * 2.2) * 0.06;
          wl += 40 * q.lift; // 들어 올리면 물 밖
          const waterY = q.y + dy + wl;
          const drawDuck = (sp: Sprite) => {
            g.save();
            g.translate(q.x, q.y + dy);
            g.scale(sxk, syk);
            drawSprite(g, sp, 0, 0, tilt, size, q.face > 0);
            g.restore();
          };
          // 수면 위 — 수면선까지만.
          g.save();
          g.beginPath();
          g.rect(q.x - 90, q.y - 100, 180, Math.max(0, waterY - (q.y - 100)));
          g.clip();
          drawDuck(spr);
          g.restore();
          // 수면 아래 — 물빛 사본을 옅게(굴절·탁함).
          if (duckSub) {
            g.save();
            g.beginPath();
            g.rect(q.x - 90, waterY, 180, 140);
            g.clip();
            g.globalAlpha = 0.55;
            drawDuck(duckSub);
            g.restore();
          }
          // 수면선 — 잠긴 자리 둘레의 옅은 흰 타원(물에 '박혀' 있다는 신호). 들어 올리면 사라진다.
          if (q.lift < 0.5) {
            const rw = (s === "dabble" ? 20 : 24) * q.k * size;
            g.save();
            g.globalAlpha = (1 - q.lift * 2) * 0.55;
            g.strokeStyle = "rgb(255 255 255)";
            g.lineWidth = 1.2;
            g.beginPath();
            g.ellipse(q.x, waterY, rw, rw * 0.22, 0, 0, TAU);
            g.stroke();
            g.restore();
          }
        } else drawSprite(g, spr, q.x, q.y, q.a + Math.sin(q.ph * 0.7) * 0.05, size);
      }
      // 물방울(목욕·털기·놀람) — 흰 점, 튀었다 떨어진다.
      for (const d of drops) {
        g.fillStyle = `rgb(255 255 255 / ${clamp(d.life * 1.6, 0, 0.9)})`;
        g.beginPath();
        g.arc(d.x, d.y, 1.4, 0, TAU);
        g.fill();
      }
    },
    pointerDown(f, onBackground) {
      const { x, y } = f.p;
      // 소품 집기 — 바탕 위에서만(칸·버튼 위 클릭은 그쪽 일).
      if (onBackground) {
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < props.length; i++) {
          const q = props[i];
          const d = Math.hypot(q.x - x, q.y - y);
          if (d < radiusOf(q) + 6 && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          const q = props[best];
          q.grab = true;
          q.gox = q.x - x;
          q.goy = q.y - y;
          q.lift = 0.4;
          if (q.kind === "duck") {
            q.crumb = null;
            q.curiousT = 0;
          }
          ring(q.x, q.y, radiusOf(q) + 30, 0.35, 0, 1.2, 1.6);
          return true;
        }
      }
      // 누르면 묵직한 원형 잔물결 — 바탕이 아니어도(칸 위) 물은 튄다: 장난감이라 방해가 아니다.
      if (f.load < 0.3) ring(x, y, 130, 0.5, 0, 1.8, 2.4);
      else {
        ring(x, y, 150, 0.7, 0, 2.0, 3.2);
        ring(x, y, 190, 0.5, 0.18, 2.3, 2.6);
        ring(x, y, 230, 0.32, 0.4, 2.6, 2);
      }
      // 물보라 = 먹이 신호이자 놀람: 140px 안의 물고기는 튀고, 나머지는 1초 뒤부터 모여든다.
      crumbs.push({ x, y, t0: f.t, food: 1 });
      if (crumbs.length > 4) crumbs.shift();
      for (const q of fish) {
        if (q.flee <= 0 && Math.hypot(q.x - x, q.y - y) < 140) startle(q, x, y, true);
      }
      return onBackground;
    },
    pointerUp(f) {
      for (const q of props) {
        if (!q.grab) continue;
        q.grab = false;
        q.vx = clamp(f.p.vx * 0.85, -1400, 1400);
        q.vy = clamp(f.p.vy * 0.85, -1400, 1400);
        ring(q.x, q.y, radiusOf(q) + 40, 0.3, 0, 1.6, 1.4);
        if (q.kind === "duck") {
          // 손에서 놓이면 잠깐 퍼덕이고 진정한다.
          duckSet(q, "alarm", 0.8, f.t);
          q.tx = q.x;
          q.ty = q.y;
        }
      }
    },
    debug() {
      const duck = props.find((q) => q.kind === "duck");
      return {
        path: path.length,
        stamps: stamps.length,
        stamped,
        rings: rings.length,
        spawned,
        loScale: loS,
        props: props.map((q) => [q.kind, Math.round(q.x), Math.round(q.y), q.grab ? 1 : 0]),
        tubes,
        sprites: { duck: !!duckSpr, duckSub: !!duckSub, ring: !!ringSpr },
        fish: fish.map((q) => [Math.round(q.x), Math.round(q.y), q.big ? 1 : 0, q.flee > 0 ? 1 : 0]),
        fishTarget: fishTarget(lastLoad) + bigTarget(lastLoad),
        fishLeaving: fish.filter((q) => q.leave).length,
        fishShapes: fish.map((q) => q.shape),
        fishSpds: fish.map((q) => Math.round(q.cruise)),
        fishDepth: fish.map((q) => Math.round(q.depth * 100) / 100),
        fishCurious: fish.filter((q) => q.curious > 0).length,
        fishFled: startles,
        startles,
        contagions,
        avoids,
        gulps,
        crumbs: crumbs.length,
        fishShadow: fishParts.every((s) => !!s),
        duck: duck ? { state: duck.state, face: duck.face, x: Math.round(duck.x), y: Math.round(duck.y) } : null,
        duckStates: { ...duckStates },
        alarms,
        curiosities,
        bubbles: bubbles.length,
        glints: glints.length
      };
    }
  };
}
