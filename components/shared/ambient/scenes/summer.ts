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
import { bakeShore, bakeTraces, drawTraces, SHORE_V, shoreEdgeOffset, type TraceBakes } from "../world/traces-draw";
import { ArtSet, artFile } from "../art/load";
import { artSlot } from "../art/manifest";
import { drawProp, drawSubmerged } from "../art/props";
import { SIZE } from "../world/scale";
import { currentLight } from "../world/light";
import { GROUND_SQUASH, bakeHorizon, depthFade, depthScale, horizonY, moveScale } from "../world/view";
import type { SeasonKey } from "../registry";
import { bakeWater, drawGlints, drawTrail, newTrail, stepTrail, waterPalette } from "./water";

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
  wagAmp: number; // 꼬리 파형 진폭(꼬리 끝 변위, 스프라이트 px)
  wagPh: number; // 꼬리 파형 위상
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
// 부드럽게 흐린 실루엣 한 장 — 그릴 때 머리→꼬리 방향의 얇은 조각 14개로 잘라 진행파만큼 위아래로 **밀어**(회전 없음) 몸이
// 물결친다. 2026-09-04 사용자: "절반 딱 잘려 궁뎅이만 움직이는 게 매직아이처럼 눈이 피로하다" — 두 조각 경첩은 관절에 줄이
// 남고(반투명 겹침), 띠 회전 체인도 바깥쪽에 실금이 벌어졌다 → 평행 이동 조각은 틈도 겹침도 없다. 스크래치에 불투명 합성 뒤
// 저해상 층에 한 번에 옅게.
type FishParts = { img: HTMLCanvasElement };

const STAMP_SPR = 96;
const FISH_SPR = 80; // 그림자 스프라이트 한 변(CSS px). k 0.5~0.8 → 40~64px, 큰 놈 1.15~1.35
const FISH_SLICES = 32; // 조각 사이 단차 < 1px — 14개는 옆선에 톱니가 보였다(실측)
const FISH_WAVE_K = 2.4; // 몸 길이당 파수(rad) — 꼬리로 갈수록 위상이 늦다(파도가 뒤로 흘러간다)

/** 민물(연못) 바이옴 — 옛 "여름 물 장면"이 PLAN-004에서 연못이 됐다. season으로 옷을 갈아입는다: 겨울 = 얼음(오리 없음·물고기 느림), 봄·가을 =
 *  연잎 없음(연대기가 6~8월에만 준다). 물 바탕은 이제 캔버스가 굽는다(CSS 물결 층은 더 마운트하지 않는다 — 여름 기본 화면이 초원이라). */
// 계절마다 다른 배치(season.length는 넷 다 6이라 변주가 없었다).
const SEASON_SEED: Record<SeasonKey, number> = { spring: 0, summer: 977, autumn: 1861, winter: 2749 };

export function createSummer(seed: number, opts: { season?: SeasonKey } = {}): Scene {
  const rand = rng(seed);
  const season: SeasonKey = opts.season ?? "summer";
  const winter = season === "winter";
  let waterBase: HTMLCanvasElement | null = null;
  let waterKey = "";
  const path: Node[] = [];
  const stamps: Stamp[] = [];
  const rings: Ring[] = [];
  const trail = newTrail(); // 포인터 물결 — 바다·해안과 같은 공용 판
  const props: Prop[] = [];
  let lo: { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;
  let loS = 0.5;
  let loW = 0;
  let loH = 0;
  let stampSpr: HTMLCanvasElement | null = null;
  let shadow: HTMLCanvasElement | null = null;
  let traces: TraceBakes | null = null; // 연대기(연잎·기슭의 데뷔 나무) 렌더 스프라이트
  let midWater: HTMLCanvasElement | null = null; // 열린 물의 앵커(뜬 통나무·바위·연잎 군락 — 사이클3 미관 #1)
  let nearBank: HTMLCanvasElement | null = null; // 화면 **아래**의 가까운 기슭(2026-09-04 검토 라운드2)
  let nearW = 0;
  let shore: HTMLCanvasElement | null = null; // 위 띠의 기슭(뭍) — 땅 흔적이 물 위에 떠 보이지 않게
  let shoreW = 0;
  // 기슭 소품 아트(갈대·통나무·바위·관목 — 있을 때만 기슭에 선다)와 오리 아트(있으면 Noto 오리 대신).
  const shoreArt = new ArtSet(["reed", "log", "rock", "shrub-summer"]);
  let shoreArtV = -1;
  let horizon: HTMLCanvasElement | null = null; // 3/4 시점의 지평선 띠(먼 기슭 안개)
  let rainRings = 0;
  let duckSpr: Sprite | null = null;
  let duckSub: Sprite | null = null; // 물속 부분용 — 물빛으로 물든 사본(수면선 아래를 이걸로 그린다)
  let ringSpr: Sprite | null = null;
  const fishParts: (FishParts | null)[] = [null, null];
  // (옛 제트스키 항적의 상태 — 방출을 멈춘 뒤로 쓰이지 않는다. 여름 한정 이벤트로 되살릴 때 그대로 쓴다.)
  const lastX = -9999;
  const lastY = -9999;
  const sx = -9999;
  const sy = -9999;
  const spawned = 0;
  let stamped = 0;
  const nextTube = 10;
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
    return { img: soften(s) };
  }
  // 물고기 한 마리를 **불투명하게** 합성하는 스크래치(CSS px, 여백 포함) — 저해상 층엔 이걸 한 번에 옅게 찍는다.
  // 조각 i(머리 0 → 꼬리 1)의 위아래 변위 = 진폭 × u² × sin(위상 − u·파수): 머리는 거의 가만, 꼬리로 갈수록 크게, 파도는 뒤로.
  const FS = FISH_SPR * 2;
  let fishScratch: { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;
  function composeFish(parts: FishParts, amp: number, phase: number): HTMLCanvasElement {
    if (!fishScratch) fishScratch = makeCanvas(FS, FS);
    const g = fishScratch.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, FS, FS);
    const W = parts.img.width;
    const H = parts.img.height;
    const sw = W / FISH_SLICES; // 원본(캔버스 px) 조각 폭
    const dw = FISH_SPR / FISH_SLICES; // 그릴 조각 폭(CSS px)
    const x0 = FS / 2 - FISH_SPR / 2;
    const y0 = FS / 2 - FISH_SPR / 2;
    for (let i = 0; i < FISH_SLICES; i++) {
      const u = (i + 0.5) / FISH_SLICES;
      const dy = amp * u * u * Math.sin(phase - u * FISH_WAVE_K);
      // 조각을 0.6px 넓게 그려 이웃과 살짝 겹친다(빈 실선 방지) — 불투명 합성이라 겹침이 짙어지지 않는다.
      g.drawImage(parts.img, i * sw, 0, sw + 1, H, x0 + i * dw, y0 + dy, dw + 0.6, FISH_SPR);
    }
    return fishScratch.c;
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
    traces = bakeTraces();
    // 오리 — 아트(public/ambient/art/duck.png, 동물의 숲 카메라)가 있으면 그것, 없으면 Noto 🦆. 둘 다 56×56 상자·가운데 앵커로 그린다
    // (수면선 자르기는 몸통 중심 기준이라 그대로 맞는다).
    const duckSlot = artSlot("duck");
    const duckArt = duckSlot ? artFile("duck.png", duckSlot, 2) : Promise.resolve(null);
    const duckArtSub = duckSlot ? artFile("duck.png", duckSlot, 2, "rgb(150 190 222 / 0.78)") : Promise.resolve(null);
    void duckArt.then((a) => {
      if (a) duckSpr = { c: a.c, w: a.w, h: a.h };
      else void loadSprite(ASSET.duck, 56, 56, 2, undefined, 0.42).then((s) => (duckSpr = s)).catch(() => {});
    });
    void duckArtSub.then((a) => {
      if (a) duckSub = { c: a.c, w: a.w, h: a.h };
      else void loadSprite(ASSET.duck, 56, 56, 2, "rgb(150 190 222 / 0.78)").then((s) => (duckSub = s)).catch(() => {});
    });
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
    const px = rand() * w;
    return {
      kind,
      x: px,
      y: waterYAt(px, rand()), // 물 위에만(기슭·지평선 띠 위로 떠오르지 않게 — 물가 선의 x별 실제 y 아래)
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
    // 왼쪽·오른쪽·아래에서만 밀려온다 — 위는 기슭·지평선(뭍)이라 튜브가 언덕 위 공중에 떠 보였다(소유자 2026-09-04).
    const edge = Math.floor(rand() * 3);
    const m = 80;
    p.x = edge === 0 ? -m : edge === 1 ? w + m : w * (0.2 + rand() * 0.6);
    p.y = edge === 2 ? h + m : waterYAt(p.x, 0.1 + rand() * 0.7);
    const tx = w * (0.25 + rand() * 0.5);
    const ty = waterYAt(tx, 0.2 + rand() * 0.6);
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
  // 물가 선(캔버스 px) — 위 띠는 뭍(기슭)이라 물고기·오리·빗방울·글린트는 이 아래에서만.
  const shoreY = () => h * SHORE_V + 6;
  // (옛 `waterY(r)` = shoreY() 기준 균일 분포는 제거 — 아래 `waterYAt(x, r)`만 쓴다.)
  // 물가 선의 **실제** y(x별) — 기슭 굽기(bakeShore)의 뭍 경계와 같은 식. shoreY()는 물의 위쪽 한계일 뿐이고 뭍은 그 아래
  // 최대 ~110px까지 내려온다(만곡 44 + 만·곶 ±61). 옛 코드는 shoreY() 기준으로 생물·글린트·포인터 물결을 놓아 오리가 뭍을
  // 헤엄치고 땅 위에 물결이 일었다(QA 라운드 3, 소유자). 물 위에 놓는 것은 전부 이 아래에만.
  const waterTopAt = (x: number) => shoreY() + 46 + shoreEdgeOffset(x, w);
  const waterYAt = (x: number, r: number) => {
    const top2 = waterTopAt(x) + 6;
    return top2 + r * Math.max(20, waterBottom() - top2);
  };
  /** 열린 물의 아래 끝 — 이보다 아래는 가까운 기슭(화면 앞)이라 생물이 가면 가려져 사라진다. */
  const waterBottom = () => h - h * 0.3 * 0.36;
  // 물고기 수 = 여력에 비례(2026-09-04 사용자: "컴퓨터 능력에 따라 늘리거나 줄여라") × 화면 넓이. 가볍게(load .3)도 4마리쯤은
  // 보인다(lite는 계절이 알아보여야 한다). 큰 놈은 .6부터 하나, .9부터 둘. 늘 땐 가장자리에서 헤엄쳐 들어오고 줄 땐 가장자리로
  // 나간다(순간 등장·소멸 금지 — 소품 원칙).
  const areaK = () => clamp((w * h) / 1_440_000, 0.6, 1.5);
  const fishTarget = (load: number) => (load < 0.12 ? 0 : Math.round(lerp(2, 14, clamp((load - 0.12) / 0.88, 0, 1)) * areaK()));
  const bigTarget = (load: number) => (load >= 0.9 ? 2 : load >= 0.6 ? 1 : 0);
  let nextFishChange = 0;
  let lastLoad = 0.5;
  let lastTraces = 0; // 디버그 — 마지막 프레임의 연잎 수
  const f0Traces = () => lastTraces;
  function newFish(big: boolean): Fish {
    const cruise = (big ? 16 + rand() * 8 : 26 + rand() * 30) * (winter ? 0.4 : 1); // 개체마다 다른 걸음 — 큰 놈은 느긋하게, 얼음 밑은 느리게
    // 가장자리 밖에서 안쪽을 향해 들어온다.
    // 위쪽은 기슭이라 왼·오른·아래 가장자리에서만 들어온다.
    const e = Math.floor(rand() * 3);
    const m = 70;
    const x = e === 0 ? -m : e === 1 ? w + m : rand() * w;
    const y = e === 2 ? h + m : waterYAt(x, rand());
    const tx2 = w * (0.2 + rand() * 0.6);
    return {
      x,
      y,
      hd: Math.atan2(waterYAt(tx2, 0.2 + rand() * 0.6) - y, tx2 - x),
      spd: cruise,
      cruise,
      k: big ? 0.9 + rand() * 0.2 : 0.35 + rand() * 0.2, // 축척(PLAN-004 §2): 소 28~44 · 대 72~88(옛 40~64 · 92~108)
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
      wagAmp: 7,
      wagPh: 0,
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
      // 물 바탕(계절 물빛 + caustic 그물) — 물가 선부터 아래. 크기·계절별 한 번.
      const wk = `${w}x${h}@${f.dpr}`;
      if (!waterBase || waterKey !== wk) {
        waterBase = bakeWater(w, h, shoreY() - 6, f.dpr, waterPalette(season), seed);
        waterKey = wk;
      }
      if (!shore || shoreW !== w || shoreArtV !== shoreArt.version) {
        shore = bakeShore(w, h, season);
        shoreW = w;
        shoreArtV = shoreArt.version;
        // 기슭 소품(아트가 있을 때만) — 물가 선 위쪽 띠에 결정적으로: 갈대 무리·통나무·바위·관목.
        const sg = shore.getContext("2d");
        if (sg) {
          const r0 = rng(91 + w + SEASON_SEED[season]); // 계절마다 다른 배치 — 넷이 같은 그림이면 계절이 안 읽힌다
          const edge = shore.height - 24;
          // 아트가 없으면 대체물로 — 옛 코드는 아트 전용이라 기슭이 늘 맨땅이었다(검토 4차).
          // 발은 **x별 물가 선 위**(edge + shoreEdgeOffset)에 — 옛 평평한 `edge − 2`는 물가가 높은 x에서 소품 발이 물에 들어갔다(AMB-S4-04, 라운드 2 B#4·3 B).
          const stand = (id: string, n: number, k: number, rr?: number) => {
            for (let i = 0; i < n; i++) {
              const sx = 30 + r0() * (w - 60);
              const sy = edge + shoreEdgeOffset(sx, w) - 6 - r0() * 10;
              drawProp(sg, shoreArt, id, sx, sy, { k: k * (0.85 + r0() * 0.3), r: rr ?? r0(), flip: r0() < 0.5 });
            }
          };
          // 갈대·억새 — 여름·봄은 초록 변형(r < .5), 가을·겨울은 마른 변형(r ≥ .5).
          stand("reed", Math.max(6, Math.round(w / 120)), 0.5, season === "autumn" || season === "winter" ? 0.7 : 0.2);
          stand("log", 1, 0.9);
          stand("rock", 3, 0.7);
          stand(`shrub-${season}`, 3, 0.75);
        }
      }
      // ── 열린 물의 앵커(사이클3 미관 #1: "화면 42%가 빈 물, 초점은 오리 한 마리") — 물 위에 중간 값의 덩어리가
      //    두셋은 있어야 3단 줄무늬를 벗어난다. 기슭 반영 → 물풀 섬 → 반쯤 잠긴 바위 → 뜬 통나무 순.
      if (!midWater || nearW !== w) {
        const MH = Math.max(1, Math.round(waterBottom() - shoreY()));
        const mw = makeCanvas(w, MH);
        const mg2 = mw.g;
        const r2 = rng(431 + w + SEASON_SEED[season]);
        // 기슭 반영 — 물가 바로 아래에 뒤집힌 뭍 색이 옅게 번진다(수면이 하늘만 비추면 판때기가 된다).
        const rf = mg2.createLinearGradient(0, 0, 0, MH * 0.22);
        rf.addColorStop(0, season === "winter" ? "rgb(198 210 224 / 0.4)" : "rgb(120 148 104 / 0.34)");
        rf.addColorStop(1, "rgb(120 148 104 / 0)");
        mg2.fillStyle = rf;
        mg2.fillRect(0, 0, w, MH * 0.22);
        if (season !== "winter") {
          // 물풀 섬 둘 — 얕은 자리에 모인 수초 덩이(연잎 군락과 다른 결).
          for (let c2 = 0; c2 < 2; c2++) {
            const cx3 = w * (0.16 + r2() * 0.7);
            const cy3 = MH * (0.16 + r2() * 0.5);
            softBlob(mg2, cx3, cy3, 50 + r2() * 60, "88 122 84", 0.3, 0, GROUND_SQUASH);
            for (let i = 0; i < 22; i++) {
              const a2 = r2() * TAU;
              const d = Math.pow(r2(), 0.6) * (46 + r2() * 40);
              const x = cx3 + Math.cos(a2) * d;
              const y = cy3 + Math.sin(a2) * d * GROUND_SQUASH;
              mg2.strokeStyle = `rgb(${r2() < 0.5 ? "104 140 92" : "78 112 76"} / ${0.4 + r2() * 0.4})`;
              mg2.lineWidth = 1.2;
              mg2.beginPath();
              mg2.moveTo(x, y);
              mg2.lineTo(x + (r2() - 0.5) * 7, y - 8 - r2() * 12);
              mg2.stroke();
            }
          }
        }
        // 반쯤 잠긴 바위 셋 — 수면선을 걸치고 앉는다(물에 박혔다는 신호).
        for (let i = 0; i < 3; i++) {
          const x = w * (0.1 + r2() * 0.8);
          // 물 위 앵커도 x별 물가 선 아래(+24)에만 — 기슭이 깊이 내려오는 x에서 바위가 뭍에 얹혔다(AMB-S4-04, 라운드 3 B).
          const y = Math.max(waterTopAt(x) + 24 - shoreY(), MH * (0.22 + r2() * 0.6));
          const k = 0.9 + r2() * 0.9;
          // 수면선의 뒤 반원 — 바위보다 **먼저**(뒤쪽은 몸에 가려야 한다, 2026-09-05 소유자).
          const rockRing = (a0: number, a1: number) => {
            mg2.strokeStyle = season === "winter" ? "rgb(226 238 248 / 0.85)" : "rgb(255 255 255 / 0.5)";
            mg2.lineWidth = season === "winter" ? 3 : 1.4;
            mg2.beginPath();
            mg2.ellipse(x, season === "winter" ? y + 2 : y, (season === "winter" ? 19 : 17) * k, (season === "winter" ? 6 : 5) * k, 0, a0, a1);
            mg2.stroke();
          };
          rockRing(Math.PI, TAU);
          // 잠긴 채 그린다(QA 라운드 1 S-4): 옛 clip은 밑변이 직선으로 잘려 "접시 위 돌"이었다. 수면 아래 8k는 물색으로
          // 물들고 깊을수록 옅어지며, 수면선 위 3px는 젖어 어둡다. 겨울은 얼음이라 옅은 얼음빛·얕게.
          drawSubmerged(mg2, shoreArt, "rock", x, y, {
            k,
            r: r2(),
            flip: r2() < 0.5,
            depth: season === "winter" ? 4 * k : 8 * k,
            water: season === "winter" ? "206 220 234" : "104 156 176",
            wet: season === "winter" ? 0.1 : 0.26
          });
          rockRing(0, Math.PI); // 앞 반원 — 바위 뒤에
          if (season === "winter") {
            // 얼음판 위 — 윗면의 눈(수면선이 아니라 얼어붙은 테두리, 사이클4 현실성 #1).
            mg2.fillStyle = "rgb(250 253 255 / 0.85)";
            mg2.beginPath();
            mg2.ellipse(x, y - 13 * k, 12 * k, 4 * k, 0, Math.PI, TAU);
            mg2.fill();
          }
        }
        // 뜬 통나무 하나 — 화면의 초점.
        {
          const x = w * (0.28 + r2() * 0.44);
          const y = MH * (0.42 + r2() * 0.34);
          const logRing = (a0: number, a1: number) => {
            mg2.strokeStyle = season === "winter" ? "rgb(226 238 248 / 0.85)" : "rgb(255 255 255 / 0.45)";
            mg2.lineWidth = season === "winter" ? 3.4 : 1.6;
            mg2.beginPath();
            mg2.ellipse(x, y + (season === "winter" ? 3 : 2), season === "winter" ? 48 : 44, season === "winter" ? 10 : 8, 0, a0, a1);
            mg2.stroke();
          };
          logRing(Math.PI, TAU); // 뒤 반원 — 통나무보다 먼저
          drawProp(mg2, shoreArt, "log", x, y, { k: 1.5, r: r2(), flip: r2() < 0.5 });
          logRing(0, Math.PI); // 앞 반원 — 통나무 뒤에
          if (season === "winter") {
            mg2.fillStyle = "rgb(250 253 255 / 0.85)";
            mg2.beginPath();
            mg2.ellipse(x, y - 16, 34, 6, 0, Math.PI, TAU);
            mg2.fill();
          }
        }
        midWater = mw.c;
      }
      // ── 가까운 기슭(2026-09-04 검토 라운드2: "물이 화면의 65~70%인 빈 판", "汀線이 자로 그은 직선",
      //    "수심 그라데이션 없는 수직벽 수조"). 연못을 **양쪽 기슭 사이**에 두면 근경이 생기고 깊이가 3단이 된다:
      //    먼 기슭(위) → 열린 물(가운데) → 가까운 기슭과 정수식물(아래, 화면 밖으로 잘린다).
      if (!nearBank || nearW !== w) {
        const NH = Math.round(h * 0.3);
        // 위 여유 PADN — 물가 선 바로 아래 선 갈대(최대 ~130px)가 캔버스 위 모서리(직선)에 잘려 "ㅡ자로 잘린 갈대"가 됐다
        // (QA 라운드 3, 소유자 스크린샷). 캔버스를 위로 늘리고 그리기 원점을 내린다. 그리는 자리(f.h − height)는 자동으로 맞는다.
        const PADN = 140;
        const nb = makeCanvas(w, NH + PADN);
        const ng = nb.g;
        ng.translate(0, PADN);
        const r1 = rng(613 + w + SEASON_SEED[season]);
        // 근경 물가 선 — 위쪽으로 굽이친다(만·곶). 캔버스 위 40%는 물, 아래는 뭍.
        const top = (x: number) => NH * 0.34 + Math.sin((x / w) * 4.2 + 1.9) * NH * 0.1 + Math.sin((x / w) * 9.7 + 0.4) * NH * 0.045;
        const NB: Record<SeasonKey, [string, string]> = {
          spring: ["#9fb783", "#7d9668"],
          summer: ["#8fae76", "#66875a"],
          autumn: ["#ab9a72", "#867757"],
          // 얼음(#f0f6fc대)과 **명도가 갈려야** 물/뭍이 구분된다 — 옛 값은 얼음과 같아 바위·통나무가 얼음 위에 놓인 듯했다.
          winter: ["#cfd8e2", "#a9b5c2"]
        };
        const [nb0, nb1] = NB[season];
        // 얕은 물 — 기슭 바로 앞은 바닥이 비쳐 밝고 탁하다(연안대). 이게 없으면 물이 수직벽이 된다.
        const lg = ng.createLinearGradient(0, 0, 0, NH * 0.5);
        lg.addColorStop(0, season === "winter" ? "rgb(206 220 232 / 0)" : "rgb(150 186 158 / 0)");
        lg.addColorStop(1, season === "winter" ? "rgb(206 220 232 / 0.5)" : "rgb(150 186 158 / 0.45)");
        ng.fillStyle = lg;
        ng.beginPath();
        ng.moveTo(0, 0);
        for (let x = 0; x <= w; x += 10) ng.lineTo(x, top(x));
        ng.lineTo(w, 0);
        ng.closePath();
        ng.fill();
        // 뭍.
        const bg2 = ng.createLinearGradient(0, NH * 0.2, 0, NH);
        bg2.addColorStop(0, nb0);
        bg2.addColorStop(1, nb1);
        ng.fillStyle = bg2;
        ng.beginPath();
        ng.moveTo(0, NH);
        for (let x = 0; x <= w; x += 10) ng.lineTo(x, top(x));
        ng.lineTo(w, NH);
        ng.closePath();
        ng.fill();
        // 젖은 띠 + 물가 선.
        ng.save();
        ng.beginPath();
        ng.moveTo(0, NH);
        for (let x = 0; x <= w; x += 10) ng.lineTo(x, top(x));
        ng.lineTo(w, NH);
        ng.closePath();
        ng.clip();
        for (let x = 0; x <= w; x += 8) softBlob(ng, x, top(x) + 7, 16, season === "winter" ? "108 126 148" : "92 106 74", 0.26, 0, GROUND_SQUASH);
        ng.restore();
        // 물가 선은 **끊어져야** 한다 — 전폭 2px 흰 실선은 자연 물가가 아니라 그어 놓은 스트로크로 읽힌다
        // (검토 라운드2 경계 #9). 잔물결이 닿는 자리에만 남는다.
        ng.lineCap = "round";
        {
          let pen = false;
          ng.beginPath();
          for (let x = 0; x <= w; x += 8) {
            if (Math.sin(x * 0.011 + 1.3) + 0.5 * Math.sin(x * 0.027) < -0.25) {
              pen = false;
              continue;
            }
            if (!pen) {
              ng.moveTo(x, top(x));
              pen = true;
            } else ng.lineTo(x, top(x));
          }
          ng.strokeStyle = season === "winter" ? "rgb(240 248 255 / 0.7)" : "rgb(255 255 250 / 0.65)";
          ng.lineWidth = 1.8;
          ng.stroke();
        }
        // 근경 뭍의 결 — 평평한 초록 판이 되지 않게 얼룩과 짧은 풀획.
        for (let i = 0; i < 40; i++) {
          const x = r1() * w;
          const y = top(x) + NH * (0.1 + r1() * 0.9);
          softBlob(ng, x, y, 26 + r1() * 50, season === "winter" ? "255 255 255" : r1() < 0.5 ? "108 134 84" : "170 194 140", 0.14, 0, GROUND_SQUASH);
        }
        if (season !== "winter") {
          ng.lineCap = "round";
          for (let i = 0; i < 260; i++) {
            const x = r1() * w;
            const y = top(x) + NH * (0.08 + r1() * 0.94);
            const len = 6 + r1() * 12;
            const a = -Math.PI / 2 + (r1() - 0.5) * 1.2;
            ng.strokeStyle = r1() < 0.5 ? "rgb(126 158 96 / 0.55)" : "rgb(96 128 78 / 0.5)";
            ng.lineWidth = 1.3;
            ng.beginPath();
            ng.moveTo(x, y);
            ng.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
            ng.stroke();
          }
        }
        // 정수식물 — **무리**로 자란다. 균등 간격·같은 키로 세우면 말뚝 울타리가 된다(2026-09-04 자체 검토).
        // 무리 4~6곳, 무리마다 키·굵기가 다르고 물가 선을 걸쳐 밑동이 물에 잠긴다.
        {
          const reedR = season === "autumn" || season === "winter" ? 0.7 : 0.2;
          const stands = 4 + Math.floor(r1() * 3);
          for (let c2 = 0; c2 < stands; c2++) {
            const cx3 = r1() * w;
            const spread = 40 + r1() * 130;
            const base = 1.1 + r1() * 1.3; // 무리마다 키가 다르다
            const n2 = 4 + Math.floor(r1() * 7);
            for (let i = 0; i < n2; i++) {
              const x = cx3 + (r1() - 0.5) * spread * 2;
              // 밑동은 **물가 곡선 아래**(뭍)에만 — 위에 두면 얼음/물 위에 떠 보인다. 세로 흩뜨림도 넓게
              // (같은 y에서 일제히 잘리면 울타리 말뚝이 된다, 사이클4 경계 #7).
              const y = top(x) + 4 + r1() * NH * 0.4;
              const kk = base * (0.6 + r1() * 0.8);
              softBlob(ng, x + 3, y - 1, 9 * kk, season === "winter" ? "150 168 186" : "70 86 58", 0.2, 0, GROUND_SQUASH * 0.5);
              drawProp(ng, shoreArt, "reed", x, y, { k: kk, r: reedR, flip: r1() < 0.5, alpha: 0.82 + r1() * 0.18 });
            }
          }
        }
        for (let i = 0; i < 5; i++) {
          const x = r1() * w;
          const y = top(x) + NH * (0.18 + r1() * 0.6);
          const k = 1.4 + r1() * 1.1;
          softBlob(ng, x + 3 * k, y - 1, 13 * k, season === "winter" ? "150 168 186" : "70 78 58", 0.2, 0, GROUND_SQUASH * 0.45);
          drawProp(ng, shoreArt, "rock", x, y, { k, r: r1(), flip: r1() < 0.5 });
        }
        {
          const x = w * (0.12 + r1() * 0.7);
          const y = top(x) + NH * 0.5;
          drawProp(ng, shoreArt, "log", x, y, { k: 1.9, r: r1(), flip: r1() < 0.5 });
        }
        if (season !== "winter") {
          for (let i = 0; i < 3; i++) {
            const x = r1() * w;
            const y = top(x) + NH * (0.4 + r1() * 0.5);
            drawProp(ng, shoreArt, `shrub-${season}`, x, y, { k: 1.5 + r1() * 0.7, r: r1(), flip: r1() < 0.5 });
          }
        } else {
          for (let i = 0; i < 8; i++) softBlob(ng, r1() * w, NH * (0.5 + r1() * 0.5), 30 + r1() * 50, "252 255 255", 0.4, 0, GROUND_SQUASH);
        }
        nearBank = nb.c;
        nearW = w;
      }
      if (!winter && !props.some((p) => p.kind === "duck")) {
        const d = newProp("duck", f.t);
        d.x = w * (0.3 + rand() * 0.4);
        d.y = waterYAt(d.x, 0.3 + rand() * 0.4);
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
      lastTraces = f.traces.filter((tr) => tr.kind === "lilypad").length;
      ensureLo(f);
      const ttl = lerp(1.0, 1.9, load); // 항적 수명 — 더 빨리 흩어지게(2026-09-04 소유자)
      void [lastX, lastY, sx, sy, spawned];
      // ① 포인터 물결 — **바다·해안과 같은 공용 판**(water.ts stepTrail/drawTrail)으로 통일했다
      // (2026-09-04 소유자: "민물의 마우스 물결도 바다처럼 연하게 똑같이"). 옛 제트스키 항적(길·거품 도장)은
      // 더 이상 방출하지 않는다 — 코드는 남겨 두되 배열이 비어 있어 그리지 않는다.
      // 얼음판(겨울)에는 물결이 생기지 않고, 물가 선 위(기슭·뭍)에도 생기지 않는다.
      // 포인터가 기슭(물가 선 위) 위에 있으면 물결을 내지 않는다 — 옛 상한 shoreY()+6은 뭍 위에서도 물결을 일으켰다.
      if (!f.dim && !winter) stepTrail(trail, p.inside && p.y < waterTopAt(p.x) + 6 ? { ...p, inside: false } : p, t, shoreY() + 6, h);
      while (path.length && t - path[0].t0 > ttl) path.shift();
      const sttl = ttl * 0.9; // 거품 띠도 조금 짧게(2026-09-04 사용자: 항적이 너무 오래 남는다)
      while (stamps.length && t - stamps[0].t0 > sttl) stamps.shift();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt / r.dur;
        if (r.life >= 1) rings.splice(i, 1);
      }
      // 비(날짜 시드 날씨) — 수면 곳곳에 작은 빗방울 고리. 여력에 따라 초당 4~14개. 물고기는 비 오면 수면으로 올라온다(아래).
      if (f.weather.now === "rain" && load >= 0.2 && rings.length < 160 && rand() < dt * lerp(4, 14, load)) {
        const rx = rand() * w;
        ring(rx, waterYAt(rx, rand()), 8 + rand() * 12, 0.28, 0, 0.9 + rand() * 0.5, 0.9);
        rainRings++;
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
      // ② 소품 — 해류 따라 둥둥, 잡히면 손을 따라, 놓으면 물의 저항으로 멈춘다.
      // 튜브는 **철수**(2026-09-04 소유자: "겨울에 얼었는데 튜브가 왜 떠다녀 — 다 빼고 생물 위주로").
      // spawnTube/ringSpr/ASSET.ring은 남겨 둔다(여름 한정 이벤트로 되살릴 때 그대로 쓰면 된다).
      void nextTube;
      void spawnTube;
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
              q.ty = clamp(q.y + Math.sin(away) * 260, 40, waterBottom() - 40);
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
            // 기슭(위 띠)엔 오르지 않는다 — 물가 선 아래로 살살 밀려난다.
            if (q.y < shoreY() + 26) q.dvy += 46;
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
            const wtop = waterTopAt(q.x) + m;
            if (q.y < wtop) {
              q.y = wtop; // 물가 선 위(기슭)로는 못 올라간다 — x별 실제 물가 선 기준(옛 shoreY()는 뭍 110px을 물로 봤다)
              q.vy = Math.abs(q.vy) + 4;
            } else if (q.y > waterBottom() - m) {
              q.y = waterBottom() - m; // 가까운 기슭 뒤로는 못 내려간다(가려져 사라진다)
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
            // 튜브도 물 위에만 — 물가 선 위로 밀리면(던지기·흐름) 물가에서 튕겨 내려온다.
            const wy = waterTopAt(q.x) + 24;
            if (q.y < wy) {
              q.y = wy;
              q.vy = Math.abs(q.vy) + 6;
              q.dvy = Math.abs(q.dvy);
            }
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
            // 비가 오면 수면 가까이 올라온다(빗방울에 떨어지는 먹이·산소) — 그림자가 크고 짙어진다.
            q.depthT = 0.45 + 0.15 * Math.sin(t * 0.3 + q.ph) + (f.weather.now === "rain" ? 0.3 : 0);
          }
          // 헤엄은 꼬리질 박자에 맞춰 밀렸다 미끄러진다(등속 아님). 튈 땐 순간 4.5배에서 1초 안에 잦아든다.
          const pulse = 0.75 + 0.5 * Math.max(0, Math.sin(t * freq + q.ph));
          const want = q.cruise * (q.flee > 0 ? 1 + 3.5 * q.burst : crumb ? 1.35 : q.leave ? 1.3 : 1) * pulse;
          q.spd += (want - q.spd) * Math.min(1, dt * (q.flee > 0 ? 3 : 8));
          const mk = moveScale(q.y, h);
          q.x += Math.cos(q.hd) * q.spd * dt * mk;
          q.y += Math.sin(q.hd) * q.spd * dt * mk;
          q.ph += dt * (q.flee > 0 ? 3 : 1);
          q.depth += (q.depthT - q.depth) * Math.min(1, dt * (q.flee > 0 ? 4 : 1.2));
          // 꼬리 파형 — 진폭(꼬리 끝 변위, 스프라이트 px)과 위상. 그리기(composeFish)가 조각마다 위상을 늦춰 파도가 뒤로 흘러가게 한다.
          q.wagAmp = q.flee > 0 ? 16 : 7 + 5 * clamp(q.spd / (q.cruise * 2), 0, 1);
          q.wagPh = t * freq + q.ph;
          if (!q.leave) {
            const m = 60;
            if (q.x < -m) q.x = w + m - 1;
            else if (q.x > w + m) q.x = -m + 1;
            // 위쪽은 기슭(뭍) — 물가 선에서 튕겨 돌아온다(모래 위 그림자 금지). 아래로 나가면 물가 바로 아래로 돌아온다.
            const sy = shoreY() + 8;
            if (q.y < sy) {
              q.y = sy;
              if (Math.sin(q.hd) < 0) q.hd = -q.hd;
            } else if (q.y > h + m) q.y = sy + 1;
          }
        }
      }
      // ④ 물방울 — 여력 0.5부터 3~8초에 하나, 1.4초 동안 커졌다 톡 터진다.
      if (load >= 0.5 && t > nextBubble) {
        const bx = 40 + rand() * (w - 80);
        bubbles.push({ x: bx, y: waterYAt(bx, 0.05 + rand() * 0.9), t0: t });
        nextBubble = t + 3 + rand() * 5;
      }
      for (let i = bubbles.length - 1; i >= 0; i--) if (t - bubbles[i].t0 > 1.6) bubbles.splice(i, 1);
      // ⑤ 햇빛 반짝임 — 여력 0.3부터 6~14개(물 위에만).
      // 글린트는 해의 반짝임 — 조명 글린트 배율(QA 라운드 2: 새벽·저녁·흐림·비·안개 0, 노을 1.2, 밤 .5 달빛)을 곱한다.
      const wantGl = load >= 0.3 ? Math.round(lerp(6, 14, load) * currentLight().glint) : 0;
      while (glints.length < wantGl) {
        const gx = rand() * w;
        glints.push({ x: gx, y: waterYAt(gx, rand()), ph: rand() * TAU, r: 1.6 + rand() * 1.8 });
      }
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
      const ttl = lerp(1.0, 1.9, load); // 항적 수명 — 더 빨리 흩어지게(2026-09-04 소유자)
      const sttl = ttl * 0.9; // 거품 띠도 조금 짧게(2026-09-04 사용자: 항적이 너무 오래 남는다)
      const L = lo.g;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.clearRect(0, 0, lo.c.width, lo.c.height);
      L.setTransform(loS, 0, 0, loS, 0, 0);
      L.lineCap = "round";
      L.lineJoin = "round";
      // 물고기 그림자(동물의 숲) — 저해상 층이라 절로 흐릿하다. 수면에 가까울수록(depth) 크고 짙게. 몸은 네 띠 체인으로 휘어
      // 스크래치에 불투명 합성한 뒤 **한 번에** 옅게 찍는다(겹침이 짙어지는 관절 줄 없음).
      for (const q of fish) {
        const parts = fishParts[q.shape];
        if (!parts) continue;
        const size = q.k * (0.86 + 0.28 * q.depth) * depthScale(q.y, f.h);
        const body = composeFish(parts, q.wagAmp, q.wagPh);
        L.save();
        L.globalAlpha = 0.18 + 0.3 * q.depth;
        L.translate(q.x, q.y);
        L.scale(1, GROUND_SQUASH); // 3/4 시점: 수면 아래 그림자는 세로로 눌린다(회전 전에, 화면 세로로)
        L.rotate(q.hd + Math.PI); // 실루엣의 머리 = 왼쪽(−x)
        L.scale(size, size);
        L.drawImage(body, -FS / 2, -FS / 2, FS, FS);
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
      // (거품 띠 — 옛 항적. 지금은 방출하지 않아 배열이 비어 있다.)
      for (const s of stamps) {
        const age = t - s.t0;
        const k = 1 - age / sttl;
        if (k <= 0) continue;
        const R = s.r * (1 + 1.9 * (1 - k));
        L.globalAlpha = 0.19 * Math.pow(k, 1.7) * (0.4 + 0.6 * s.sf);
        L.drawImage(stampSpr, s.x - R, s.y - R, R * 2, R * 2);
      }
      L.globalAlpha = 1;
      if (path.length > 1) {
        // 각 점의 벌어진 정도 d = (옆으로 퍼지는 속도 ≈ 0.34×진행속도 상당) × 나이. 나이 0.85승 — 처음 빠르게 벌어지고
        // 뒤로 갈수록 느려진다. **팔은 짧게 산다**(2026-09-04 사용자: "선이 너무 멀리까지 퍼져 어색") — 거품 띠의 절반 수명에
        // 가파르게(2.4승) 옅어지고, 벌어짐도 70~130px에서 멈춘다. 오래 남는 건 거품 띠뿐.
        const armTtl = ttl * 0.28; // V자 팔은 아주 짧게
        const armPt = (n: Node, s: number, age: number): [number, number] => {
          const d = Math.min((30 + 110 * n.sf) * Math.pow(age, 0.8) + 3, 42 + 34 * n.sf);
          return [n.x + n.nx * s * d, n.y + n.ny * s * d];
        };
        const passes = load >= 0.3 ? [0, 1] : [1];
        for (const s of [-1, 1]) {
          for (const pass of passes) {
            for (let i = 1; i < path.length; i++) {
              const a0 = path[i - 1];
              const a1 = path[i];
              const age = t - a1.t0;
              const k = 1 - age / armTtl;
              if (k <= 0) continue;
              const fade = Math.pow(k, 2.4);
              const [x0, y0] = armPt(a0, s, t - a0.t0);
              const [x1, y1] = armPt(a1, s, age);
              const weight = 0.5 + 0.5 * a1.sf;
              if (pass === 0) {
                L.strokeStyle = `rgb(150 195 228 / ${0.07 * fade * weight})`;
                L.lineWidth = 14 + 12 * (1 - k);
              } else {
                L.strokeStyle = `rgb(255 255 250 / ${0.14 * fade * weight})`;
                L.lineWidth = 4 + 2 * (1 - k);
              }
              L.beginPath();
              L.moveTo(x0, y0);
              L.lineTo(x1, y1);
              L.stroke();
            }
          }
        }
        // 가로 마루 — 몇 점마다 두 팔 사이를 뒤로 볼록하게(항적 안쪽의 층층 물결). 여력이 있을 때만. 팔과 같이 짧게.
        if (load >= 0.55) {
          for (let i = 2; i < path.length; i += 4) {
            const n = path[i];
            const age = t - n.t0;
            const k = Math.pow(Math.max(0, 1 - age / armTtl), 2);
            if (k <= 0.05) continue;
            const [lx, ly] = armPt(n, -1, age);
            const [rx, ry] = armPt(n, 1, age);
            const back = path[i - 2];
            const bx = back.x - n.x;
            const by = back.y - n.y;
            const bl = Math.hypot(bx, by) || 1;
            const bulge = (14 + 40 * n.sf) * Math.pow(age, 0.6);
            L.strokeStyle = `rgb(255 255 250 / ${0.12 * k * (0.5 + 0.5 * n.sf)})`;
            L.lineWidth = 2.2;
            L.beginPath();
            L.moveTo(lx, ly);
            L.quadraticCurveTo(n.x + (bx / bl) * bulge, n.y + (by / bl) * bulge, rx, ry);
            L.stroke();
          }
        }
      }
      // 원형 잔물결(누름·뻐끔·자맥질) — 부드러운 저해상 층에서.
      // 파문 고리 — 물 위에서만(옛 코드는 화면 전체에 그려 기슭·땅에도 소용돌이가 생겼다).
      L.save();
      L.beginPath();
      L.rect(0, shoreY(), f.w, f.h - shoreY());
      L.clip();
      for (const r of rings) {
        if (r.life < 0) continue;
        const e = 1 - Math.pow(1 - r.life, 2.4);
        const rad = 6 + r.maxR * e;
        const a = r.a * (1 - r.life);
        const lw = r.w * (1 - r.life * 0.6) + 0.8;
        L.lineWidth = lw * 2.6;
        L.strokeStyle = `rgb(120 175 215 / ${a * 0.4})`;
        L.beginPath();
        L.ellipse(r.x, r.y, rad, rad * GROUND_SQUASH, 0, 0, TAU); // 수면의 고리 — 3/4 시점이라 타원
        L.stroke();
        L.lineWidth = lw;
        L.strokeStyle = `rgb(255 255 250 / ${a})`;
        L.beginPath();
        L.ellipse(r.x, r.y, rad, rad * GROUND_SQUASH, 0, 0, TAU);
        L.stroke();
      }
      L.restore();
      if (waterBase) g.drawImage(waterBase, 0, 0, f.w, f.h);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "medium";
      g.drawImage(lo.c, 0, 0, f.w, f.h);
      if (winter) {
        // 얼음 — 물 위에 젖빛 판 한 겹(가장자리가 더 희다) + 실금 몇 줄. 물고기 그림자는 그 밑에서 느리게 지나간다.
        const iy = shoreY();
        const ig = g.createLinearGradient(0, iy, 0, f.h);
        ig.addColorStop(0, "rgb(240 246 252 / 0.72)");
        ig.addColorStop(1, "rgb(226 236 246 / 0.6)");
        g.fillStyle = ig;
        g.fillRect(0, iy, f.w, f.h - iy);
        // 균열 — 같은 각도의 평행선은 "그어 놓은 빗금"이다. 결정적 rng로 방향을 흩고 가지를 친다.
        // 굵기 일정한 선이 허공에서 뚝 끝나면 "남은 스트로크"로 읽힌다(검토 라운드2 경계 #12) →
        // 진행할수록 가늘어지고 옅어져 **0으로 사라진다**. 가지도 더 가늘게.
        g.lineCap = "round";
        const cr = rng(seed * 17 + 5);
        for (let i = 0; i < 7; i++) {
          let x0 = cr() * f.w;
          let y0 = iy + 30 + cr() * (f.h - iy - 60);
          let ang = cr() * TAU;
          const segs = 5;
          for (let k = 0; k < segs; k++) {
            const fade = 1 - k / segs;
            const len = 40 + cr() * 90;
            const x1 = x0 + Math.cos(ang) * len;
            const y1 = y0 + Math.sin(ang) * len * GROUND_SQUASH;
            g.strokeStyle = `rgb(255 255 255 / ${0.72 * fade})`;
            g.lineWidth = 0.35 + 1.15 * fade;
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
            if (cr() < 0.45) {
              const bl = 24 + cr() * 40;
              const ba = ang + (cr() - 0.5) * 1.6;
              g.strokeStyle = `rgb(255 255 255 / ${0.4 * fade})`;
              g.lineWidth = 0.3 + 0.6 * fade;
              g.beginPath();
              g.moveTo(x1, y1);
              g.lineTo(x1 + Math.cos(ba) * bl, y1 + Math.sin(ba) * bl * GROUND_SQUASH);
              g.stroke();
            }
            x0 = x1;
            y0 = y1;
            ang += (cr() - 0.5) * 1.1;
          }
        }
      }
      // 3/4 시점의 지평선 띠 — 먼 것이 안개에 잠긴다. **기슭보다 먼저** 그린다(옛 순서는 안개가 기슭을 덮어
      // 물가가 이중선으로 보였다, 2026-09-04 검토 1차).
      if (!horizon || horizon.width !== Math.ceil(f.w)) horizon = bakeHorizon(season, f.w, f.h, 1);
      g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 기슭(지평선 아래 띠의 뭍) + 연대기 — 연잎 군락은 물 위, 데뷔 나무·싹·흙더미는 기슭 위에만. 항적 위, 생물 아래.
      if (shore) g.drawImage(shore, 0, horizonY(f.h));
      if (traces) drawTraces(g, f, season, traces, { landOnShore: true, water: true });
      // 열린 물의 앵커 — 기슭 바로 아래(생물은 이 위를 지나간다).
      if (midWater) g.drawImage(midWater, 0, shoreY(), f.w, midWater.height);
      // 햇빛 반짝임 — 공용 drawGlints(가로 렌즈). 옛 4획 십자는 화면에서 × · + 글리프로 읽혔다(검토 3차).
      // 포인터 물결 — 물 구역(물가 선 아래)만. 얼음판에는 그리지 않는다.
      if (!winter) {
        g.save();
        g.beginPath();
        g.rect(0, shoreY(), f.w, f.h - shoreY());
        g.clip();
        drawTrail(g, trail, t, GROUND_SQUASH, "255 255 252");
        g.restore();
      }
      drawGlints(g, t, glints);
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
        // 거리 흐림 — 먼 물 위의 오리는 옅어진다(2026-09-04 소유자).
        g.save();
        g.globalAlpha *= depthFade(q.y, f.h);
        const bob = Math.sin(q.ph) * 0.03;
        // 축척(오리 56 → 44, 튜브 92 → 64) × 3/4 시점 거리 축소.
        const size = q.k * (1 + bob + 0.1 * q.lift) * (q.kind === "duck" ? SIZE.duck / 56 : SIZE.swimRing / 92) * depthScale(q.y, f.h);
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
          // 수면선 — 잠긴 자리 둘레의 옅은 흰 타원. **뒤 반원은 몸에 가려야 한다**(한 바퀴 두른 링은
          // 오리 앞으로 선이 지나가 "종이 오려 붙인 것"으로 보인다, 2026-09-05 소유자).
          const wlRing = (a0: number, a1: number) => {
            if (q.lift >= 0.5) return;
            const rw = (s === "dabble" ? 20 : 24) * q.k * size;
            g.save();
            g.globalAlpha = (1 - q.lift * 2) * 0.55;
            g.strokeStyle = "rgb(255 255 255)";
            g.lineWidth = 1.2;
            g.beginPath();
            g.ellipse(q.x, waterY, rw, rw * 0.22, 0, a0, a1);
            g.stroke();
            g.restore();
          };
          wlRing(Math.PI, TAU); // 뒤 반원 — 몸보다 먼저
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
          wlRing(0, Math.PI); // 앞 반원 — 몸 뒤에(물이 몸 앞을 스친다)
        } else drawSprite(g, spr, q.x, q.y, q.a + Math.sin(q.ph * 0.7) * 0.05, size);
        g.restore();
      }
      // 물방울(목욕·털기·놀람) — 흰 점, 튀었다 떨어진다.
      for (const d of drops) {
        g.fillStyle = `rgb(255 255 255 / ${clamp(d.life * 1.6, 0, 0.9)})`;
        g.beginPath();
        g.arc(d.x, d.y, 1.4, 0, TAU);
        g.fill();
      }
      // 가까운 기슭 — 모든 생물보다 **앞**(연못이 양쪽 기슭 사이에 놓인다). 화면 아래에서 잘린다.
      if (nearBank) g.drawImage(nearBank, 0, f.h - nearBank.height, f.w, nearBank.height);
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
      // 뭍(물가 선 위)이나 얼음판을 눌렀을 때는 **파동이 아예 생기지 않는다** — 땅을 눌렀는데 물가에
      // 파동이 일렁이면 안 된다(2026-09-04 소유자). 클립으로 가리는 게 아니라 만들지 않는다.
      if (winter || y < waterTopAt(x) + 4) return onBackground; // 뭍(기슭) 클릭은 물 반응(고리·먹이) 없음 — x별 물가 선 기준
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
        rainRings,
        lilypads: f0Traces(),
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
