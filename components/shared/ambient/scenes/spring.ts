// 봄 — "풀밭을 위에서 내려다본다". 바탕(연둣빛 필름 + 클로버·작은 데이지·꽃잎 몇)은 한 번 굽고, **풀포기 층은 따로 구워**
// 바람에 흔들린다(2026-09-04 사용자: "꽃잎이 휘날릴 때 잔디도 같이") — 가로 띠 12개로 잘라 띠마다 진행파(sin)만큼 옆으로
// 밀어 그린다(drawImage 12번, 필터 없음). 꽃잎 바람이 불면 크게, 평소엔 여력이 있을 때 미세하게 숨쉰다.
// 빛 얼룩(양지) 둘이 느리게 지나가며 풀이 반짝인다. 나비가 그림자를 끌며 날아다니고(높이에 따라 그림자가 멀어지고 옅어진다),
// 방향을 틀 때 몸이 기울어(bank) 한쪽 날개가 좁아 보인다. 가끔 데이지에 내려앉아 천천히 날개를 여닫다가 다시 난다.
// 누르면 꽃잎·반짝이가 터지며 한 바퀴 돌아 날아간다. 바탕을 누르면 풀이 밟힌다.
// 소품·이벤트: **무당벌레**(에셋; 기어다님·클릭에 날아오름), **꽃잎 바람**, **민들레**(누르면 홀씨가 흩어져 떠오르고
// 한참 뒤 다시 핀다 — 미니게임), **꿀벌**(에셋; 데이지 사이를 오가며 잠깐 머문다).
// 여력(f.load): 나비 1~3(가장자리 출입), 무당벌레 0~2, 민들레(≥.4), 꿀벌(≥.6), 꽃잎 바람(≥.55), 풀 숨쉬기(≥.5).
// 색은 木(초목)·水(이슬) — 쨍한 햇빛·붉은 꽃은 쓰지 않는다(CLAUDE.md Owner-fit palette).
//
// 생물 지능(2026-09-04 사용자: "실제 동물이 사용자에게 반응하듯, 행동 연구 기반으로"). 위협은 고정 반경이 아니라 util.threat()
// (거리 d · 접근 속도 rate · looming) — 천천히 오면 참고, 휙 덤비면 멀리서 튄다.
//  · 나비 — 맛있는(palatable) 나비의 불규칙 비행: 60px 안이거나, 빠른 접근(rate>200)은 160px, 덮쳐옴(loom>3)은 220px에서
//    도망; 느린 접근(rate<50)은 60px까지 참는다. 도망칠 땐 급히 솟아 그림자가 멀어진다. 둘이 나는 중에 60px 안에서 마주치면
//    (전역 쿨다운 8s) 30%로 **나선 추격**(수컷 순찰·spiral chase, 1.4s, 반지름 20→60, 높이 최고) 뒤 흩어진다. 양지(빛 얼룩)
//    120px 안을 지나면(마리당 쿨다운 10s) 25%로 땅에 내려앉아 날개를 활짝 펴고 **일광욕**(basking, 2.5~4s, 0.9~1.0 숨쉬기)
//    — 위협이 오면 즉시 날아오른다.
//  · 무당벌레 — 교란에 **죽은 척**(thanatosis): 위협(70px 안 rate>40, 또는 loom>2 110px 안)이면 멈추고 움츠려(×0.88) 1.5~3s
//    죽은 척; 그동안 포인터가 30px 안까지 오거나 누르면 날아간다. 시간이 지나 포인터가 멀면(90px+) 새 방향으로 걷고, 아직
//    가까우면 더 버틴다(총 6s까지, 그 뒤 날아감). 걷다 닿이면(22px) 0.6s 종종걸음 뒤 죽은 척.
//  · 꿀벌 — 꽃 일관성·**트랩라인**(trapline) 채집: 가까운 6송이 중 45s 안에 안 간 가장 가까운 꽃으로 짧게 옮겨 다닌다(무작위
//    없음). 꽃 위 0.4s **맴돌기**(반지름 6, 붕붕) → 1~2s 먹기(작게 까딱) → 다음 꽃. 7~10송이면 가장 가까운 가장자리로
//    귀소(home, bee=null) 하고 20~40s 뒤 새 벌이 온다. 위협: 40px 안 · 빠른 접근 120px · 덮쳐옴 160px. 손으로 치면(클릭)
//    1.2s 포인터 둘레(반지름 40)를 성나서 맴돌다(angry) 달아난다.

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawFacing, drawSprite, loadSprite, type Sprite } from "../assets";
import { bakeTraces, drawTraces, type TraceBakes } from "../world/traces-draw";
import { ArtSet } from "../art/load";
import { drawProp, scatterProps } from "../art/props";
import { SIZE } from "../world/scale";
import { bakeHorizon, depthScale, GROUND_SQUASH, horizonY } from "../world/view";
import { angleDiff, clamp, lerp, makeCanvas, rng, shadowSprite, softBlob, TAU, threat } from "./util";

const WINGS = [
  { a: "#c9b9ee", b: "#a08fd8", rim: "#6f5db3", spot: "#ffffff", eye: "#4a3f7a" },
  { a: "#f7d3e2", b: "#e2a9c4", rim: "#b7708f", spot: "#fff8fb", eye: "#7a4a62" },
  { a: "#fbe9b0", b: "#e2c874", rim: "#a68a3a", spot: "#ffffff", eye: "#6b5a26" },
  { a: "#bfe0ec", b: "#8ec3d8", rim: "#5a93ad", spot: "#f6fcff", eye: "#2f5b6e" }
];
// 풀포기 층 타일(가로 24 × 세로 12) — 타일마다 옆으로 밀어 그린다. 흔들림은 **꽃잎 무리가 지나가는 x 앞머리 둘레**에서만
// (2026-09-04 사용자: "전체가 흩어져 흔들리니 지진 난 것 같다") — 가로 띠는 x로 국소화가 안 돼 타일로 바꿨다.
const COLS = 24;
const ROWS = 12;
// 행동 상수 — 나선 추격 길이·전역 쿨다운, 일광욕 쿨다운(마리당), 꿀벌이 같은 꽃을 다시 찾지 않는 시간.
const CHASE_DUR = 1.4;
const CHASE_COOLDOWN = 8;
const BASK_COOLDOWN = 10;
const VISIT_MEMORY = 45;

type State = "fly" | "land" | "sit" | "leave" | "chase" | "bask";
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
  w1: number;
  // 나선 추격 — 둘이 공유하는 중심(cx,cy), 내 각(ca), 회전 방향(cdir), 남은 시간(chase), 상대(mate).
  cx: number;
  cy: number;
  ca: number;
  cdir: number;
  chase: number;
  mate: Fly | null;
  // 일광욕 — land 목표가 양지인가(sun), 다음 일광욕 가능 시각(nextBask).
  sun: boolean;
  nextBask: number;
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string; a: number; va: number; star: boolean };
type Press = { x: number; y: number; life: number; r: number; blades: { a: number; r0: number; len: number; w: number; col: string }[] };
type BugState = "walk" | "pause" | "flee" | "dead" | "off";
type Bug = { x: number; y: number; hd: number; spd: number; state: BugState; until: number; k: number; ph: number; off: number; respawn: number; deadAt: number };
type Petal = { x: number; y: number; vx: number; ph: number; a: number; va: number; born: number; dur: number; k: number };
type Dandelion = { x: number; y: number; k: number; puffed: number; regrow: number; born: number }; // puffed = 홀씨 날린 시각(0 = 핀 상태)
type Seed = { x: number; y: number; vx: number; vy: number; ph: number; born: number; dur: number };
type BeeState = "fly" | "hover" | "feed" | "flee" | "angry" | "home";
type Bee = {
  x: number;
  y: number;
  hd: number;
  tx: number;
  ty: number;
  state: BeeState;
  timer: number; // 현재 상태의 남은 시간(hover·feed·flee·angry)
  ph: number;
  ang: number; // 맴돌기 각(hover 꽃 둘레 · angry 포인터 둘레)
  target: number; // 데이지 인덱스(-1 = 없음)
  visits: number; // 이번 채집 나들이에서 먹은 꽃 수
  quota: number; // 7~10송이면 귀소
  visited: Map<number, number>; // 데이지 인덱스 → 먹은 시각(45s 동안 다시 안 감)
};

/** 빛 얼룩(양지) 둘의 위치 — draw(그리기)와 step(나비 일광욕 판단)이 같은 식을 쓴다. */
function sunAt(t: number, w: number, h: number): [number, number][] {
  return [
    [w * (0.3 + 0.2 * Math.sin(t * 0.09)), h * (0.4 + 0.25 * Math.cos(t * 0.07))],
    [w * (0.7 + 0.18 * Math.cos(t * 0.06 + 2)), h * (0.6 + 0.2 * Math.sin(t * 0.08 + 1))]
  ];
}

export function createSpring(seed: number): Scene {
  const rand = rng(seed);
  let ground: HTMLCanvasElement | null = null;
  let blades: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  // 바탕 소품 아트(클로버·데이지·풀포기·민들레 + 있으면 관목·바위·그루터기·민들레 꽃) — 모두 도착하면 version이 올라 바탕을 한 번 다시 굽는다.
  const groundArt = new ArtSet(["clover", "daisy", "grass-tuft", "dandelion-puff", "dandelion-flower", "shrub-spring", "rock", "stump"]);
  let gav = -1;
  let horizon: HTMLCanvasElement | null = null; // 3/4 시점의 지평선 띠
  // 땅의 위 끝(지평선) — 꽃·풀·벌레·나비·민들레는 이 아래에서만(지평선 띠는 먼 곳).
  const gy = () => horizonY(h);
  const groundY = (r: number) => gy() + r * (h - gy());
  let shadow: HTMLCanvasElement | null = null;
  let traceBakes: TraceBakes | null = null; // 연대기(지난 가을 저장소의 싹·나무·두더지 흙더미) 렌더
  let petalSpr: HTMLCanvasElement | null = null;
  let dandSpr: HTMLCanvasElement | null = null;
  let seedSpr: HTMLCanvasElement | null = null;
  let bugSpr: Sprite | null = null;
  let beeSpr: Sprite | null = null;
  const daisies: [number, number][] = [];
  const flies: Fly[] = [];
  const sparks: Spark[] = [];
  const presses: Press[] = [];
  const bugs: Bug[] = [];
  const petals: Petal[] = [];
  const dands: Dandelion[] = [];
  const seeds: Seed[] = [];
  let bee: Bee | null = null;
  let nextBee = 0; // 귀소한 벌 대신 새 벌이 오는 시각
  let nextBreeze = 9;
  let breezes = 0;
  let bugsFled = 0;
  let puffs = 0;
  let wind = 0; // 0~1 풀 흔들림 세기(꽃잎 바람 중 1로, 끝나면 서서히 0)
  let windDir = 1;
  let front = -1000; // 꽃잎 무리의 x 앞머리(평균) — 풀은 이 둘레(±280px)에서만 눕는다
  let bugsLeftScreen = 0;
  let w = 0;
  let h = 0;
  let fleeCount = 0;
  let pressCount = 0;
  // 행동 카운터(검증용) — 나선 추격·일광욕·죽은 척·꿀벌 방문·손찌검.
  let chases = 0;
  let basks = 0;
  let plays = 0;
  let beeVisits = 0;
  let swats = 0;
  let nextChase = 0;

  function press(x: number, y: number, load: number) {
    const n = load >= 0.5 ? 18 : 9;
    const bl: Press["blades"] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (rand() - 0.5) * 0.4;
      bl.push({ a, r0: 8 + rand() * 20, len: 9 + rand() * 9, w: 1.2 + rand() * 1, col: rand() < 0.5 ? "112 168 104" : "140 190 118" });
    }
    presses.push({ x, y, life: 1, r: (18 + rand() * 8) * depthScale(y, h), blades: bl });
    pressCount++;
    const pollen = load >= 0.5 ? 7 : 3;
    for (let i = 0; i < pollen; i++) {
      const b = rand() * TAU;
      const sp = 40 + rand() * 90;
      sparks.push({ x, y, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp - 30, life: 1, r: 1.4 + rand() * 1.6, col: "#fff3b0", a: 0, va: 0, star: false });
    }
  }

  // 바탕은 크기별로 같은 그림(리사이즈 때 다시 구워도 배치가 안 바뀐다 — 별도 결정적 난수).
  function bakeGround(dpr: number) {
    const g0 = rng((seed * 7 + 13) >>> 0);
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    g.fillStyle = "rgb(214 232 200 / 0.42)";
    g.fillRect(0, 0, w, h);
    const patches = Math.round((w * h) / 70000);
    for (let i = 0; i < patches; i++) {
      softBlob(g, g0() * w, g0() * h, 120 + g0() * 260, g0() < 0.5 ? "150 196 120" : "232 244 214", 0.16);
    }
    // 소품은 전부 drawProp(art/props.ts) — 아트 파일이 있으면 그 그림, 없으면 대체물(옛 도형). 자리는 결정적(같은 g0 순서).
    // 3/4 시점: 클로버(납작)는 세로로 눌리고, 데이지·풀포기(서 있음)는 위(멀다)에서 작다. 꽃은 축척표대로 과장(SIZE.flower 26).
    const clovers = Math.round((w * h) / 60000);
    for (let i = 0; i < clovers; i++) {
      const x = g0() * w;
      const y = groundY(g0());
      drawProp(g, groundArt, "clover", x, y, { k: (0.8 + g0() * 0.5) * depthScale(y, h), rot: g0() * TAU, r: g0(), sy: GROUND_SQUASH });
    }
    daisies.length = 0;
    const nd = Math.round((w * h) / 80000);
    const flowerK = SIZE.flower / 18;
    for (let i = 0; i < nd; i++) {
      const x = g0() * w;
      const y = groundY(g0());
      daisies.push([x, y]);
      // 데이지의 (x,y) = 꽃 얼굴(벌·나비가 앉는 자리) — 서 있는 그림은 발을 그 아래에 둔다.
      const k = (0.9 + g0() * 0.3) * flowerK * depthScale(y, h);
      drawProp(g, groundArt, "daisy", x, y + 8 * k, { k, r: g0(), flip: g0() < 0.5 });
    }
    const nPetals = Math.round((w * h) / 120000);
    for (let i = 0; i < nPetals; i++) {
      g.fillStyle = "rgb(244 200 216 / 0.7)";
      g.beginPath();
      g.ellipse(g0() * w, groundY(g0()), 4, 2.4, g0() * TAU, 0, TAU);
      g.fill();
    }
    // 있을 때만 놓이는 큰 소품(아트가 오면 나타난다) — 바깥 띠(달력 밖)에 결정적으로.
    scatterProps(g, groundArt, w, h, g0, [
      { id: "shrub-spring", n: 3 },
      { id: "rock", n: 2 },
      { id: "stump", n: 1 },
      { id: "dandelion-flower", n: 6, band: "any" }
    ]);
    ground = c;
    // 풀포기 층 — 바람에 흔들리는 것만 따로.
    const b = makeCanvas(w * dpr, h * dpr);
    b.g.scale(dpr, dpr);
    const tufts = Math.round((w * h) / 1500);
    for (let i = 0; i < tufts; i++) {
      const x = g0() * w;
      const y = groundY(g0());
      drawProp(b.g, groundArt, "grass-tuft", x, y, { k: (0.7 + g0() * 0.6) * depthScale(y, h), r: g0(), flip: g0() < 0.5, alpha: 0.9 });
    }
    blades = b.c;
    horizon = bakeHorizon("spring", w, h, 1);
    // 민들레 자리(4~7) — 데이지에서 떨어진 곳.
    dands.length = 0;
    const ndd = clamp(Math.round((w * h) / 260000), 4, 7);
    for (let i = 0; i < ndd; i++) {
      dands.push({ x: 40 + g0() * (w - 80), y: gy() + 40 + g0() * (h - gy() - 80), k: 0.85 + g0() * 0.35, puffed: 0, regrow: 0, born: -10 });
    }
    gw = w;
    gh = h;
    gdpr = dpr;
    gav = groundArt.version;
  }
  function bakeSprites() {
    if (petalSpr) return;
    shadow = shadowSprite(64, 44, "40 60 40", 0.55);
    traceBakes = bakeTraces();
    {
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
    }
    {
      // 민들레 홀씨 머리 — 흰 솜뭉치(방사 털 + 가운데 옅은 초록), 줄기 그림자 조금.
      const { c, g } = makeCanvas(40, 40);
      g.translate(20, 20);
      softBlob(g, 0, 0, 15, "255 255 255", 0.55, 0);
      g.strokeStyle = "rgb(255 255 255 / 0.85)";
      g.lineWidth = 0.9;
      g.lineCap = "round";
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        g.lineTo(Math.cos(a) * 12.5, Math.sin(a) * 12.5);
        g.stroke();
        g.fillStyle = "rgb(255 255 255 / 0.95)";
        g.beginPath();
        g.arc(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 1.1, 0, TAU);
        g.fill();
      }
      g.fillStyle = "rgb(190 210 150)";
      g.beginPath();
      g.arc(0, 0, 3.2, 0, TAU);
      g.fill();
      dandSpr = c;
    }
    {
      // 홀씨 하나 — 흰 점 + 갈라진 털 셋.
      const { c, g } = makeCanvas(14, 14);
      g.translate(7, 7);
      g.strokeStyle = "rgb(255 255 255 / 0.9)";
      g.lineWidth = 0.8;
      g.lineCap = "round";
      for (const a of [-0.5, 0, 0.5]) {
        g.beginPath();
        g.moveTo(0, 2);
        g.lineTo(Math.sin(a) * 5, -4.5 + Math.abs(a));
        g.stroke();
      }
      g.fillStyle = "rgb(230 225 200 / 0.95)";
      g.beginPath();
      g.arc(0, 3, 1.2, 0, TAU);
      g.fill();
      seedSpr = c;
    }
    // 축척(PLAN-004 §2): 무당벌레 12 · 꿀벌 14(옛 20 · 24).
    void loadSprite(ASSET.ladybug, SIZE.ladybug, SIZE.ladybug).then((s) => (bugSpr = s)).catch(() => {});
    void loadSprite(ASSET.bee, SIZE.bee, SIZE.bee).then((s) => (beeSpr = s)).catch(() => {});
  }

  const flyTarget = (f: Frame) => clamp(1 + Math.round(f.load * 2.4), 1, 3);
  function newFly(t: number, fromEdge: boolean): Fly {
    const b: Fly = {
      x: rand() * w,
      y: groundY(rand()),
      hd: rand() * TAU,
      spd: 46 + rand() * 40,
      tx: rand() * w,
      ty: groundY(rand()),
      next: 0,
      ph: rand() * TAU,
      bob: rand() * TAU,
      col: Math.floor(rand() * WINGS.length),
      flee: 0,
      loop: 0,
      k: (0.62 + rand() * 0.3) * (SIZE.butterfly / 22), // 축척: 나비 ≈ 18px(옛 ≈ 22)
      bank: 0,
      state: "fly",
      sit: 0,
      nextLand: t + 4 + rand() * 8,
      w1: rand() * TAU,
      cx: 0,
      cy: 0,
      ca: 0,
      cdir: 1,
      chase: 0,
      mate: null,
      sun: false,
      nextBask: t + 5 + rand() * 10
    };
    if (fromEdge) {
      const e = Math.floor(rand() * 4);
      b.x = e === 0 ? -30 : e === 1 ? w + 30 : rand() * w;
      b.y = e === 2 ? gy() - 30 : e === 3 ? h + 30 : groundY(rand());
      b.tx = w * (0.2 + rand() * 0.6);
      b.ty = groundY(0.2 + rand() * 0.6);
      b.hd = Math.atan2(b.ty - b.y, b.tx - b.x);
      b.next = t + 3;
    }
    return b;
  }
  // 도망칠 때 급히 솟는다 — 지금 높이(sin bob)는 그대로 두고 위상만 '올라가는 쪽'으로 돌려, 도망 중엔 최고점(π/2)까지 오른다.
  function climb(b: Fly) {
    let ph = ((((b.bob + Math.PI / 2) % TAU) + TAU) % TAU) - Math.PI / 2; // [-π/2, 3π/2)
    if (ph > Math.PI / 2) ph = Math.PI - ph; // 내려가던 중이면 같은 높이의 올라가는 위상으로
    b.bob = ph;
  }
  // 나선 추격 시작 — 둘의 중점을 공유하고 서로 반대편(각 차 π)에서 같은 방향으로 돈다.
  function startChase(a: Fly, c: Fly, t: number) {
    const mx = (a.x + c.x) / 2;
    const my = (a.y + c.y) / 2;
    const dir = rand() < 0.5 ? 1 : -1;
    const a0 = Math.atan2(a.y - my, a.x - mx);
    for (const b of [a, c]) {
      b.state = "chase";
      b.chase = CHASE_DUR;
      b.cx = mx;
      b.cy = my;
      b.ca = b === a ? a0 : a0 + Math.PI;
      b.cdir = dir;
      b.mate = b === a ? c : a;
      b.sun = false;
      b.next = t + CHASE_DUR + 1;
    }
    chases++;
  }
  // 추격 끝(시간 종료·위협·퇴장) — 둘 다 새 목표로 흩어진다. 떠나는 중(leave)인 쪽은 상태를 건드리지 않는다.
  function endChase(b: Fly, t: number) {
    const m = b.mate;
    for (const x of m ? [b, m] : [b]) {
      if (x.state === "chase") x.state = "fly";
      x.chase = 0;
      x.mate = null;
      x.tx = 40 + rand() * (w - 80);
      x.ty = 40 + rand() * (h - 80);
      x.next = t + 2.5 + rand() * 4;
      x.nextLand = Math.max(x.nextLand, t + 6 + rand() * 6);
    }
  }
  // 나는 중(도망·회전 아님)인 두 마리가 60px 안에서 마주친 쌍 — 없으면 null.
  function meetingPair(): [Fly, Fly] | null {
    for (let i = 0; i < flies.length; i++) {
      const a = flies[i];
      if (a.state !== "fly" || a.flee > 0 || a.loop > 0) continue;
      for (let j = i + 1; j < flies.length; j++) {
        const c = flies[j];
        if (c.state !== "fly" || c.flee > 0 || c.loop > 0) continue;
        if (Math.hypot(a.x - c.x, a.y - c.y) <= 60) return [a, c];
      }
    }
    return null;
  }
  function burst(x: number, y: number, col: number, load: number) {
    const c = WINGS[col];
    const n = load >= 0.3 ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const sp = 90 + rand() * 230;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: 2 + rand() * 3.5, col: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? c.a : c.b, a: rand() * TAU, va: (rand() - 0.5) * 12, star: i % 4 === 0 });
    }
  }
  const bugTarget = (load: number) => (load >= 0.85 ? 2 : load >= 0.45 ? 1 : 0);
  function newBug(t: number): Bug {
    const e = Math.floor(rand() * 4);
    const x = e === 0 ? -12 : e === 1 ? w + 12 : rand() * w;
    const y = e === 2 ? gy() - 12 : e === 3 ? h + 12 : groundY(rand());
    return { x, y, hd: Math.atan2(groundY(0.5) - y, w / 2 - x) + (rand() - 0.5), spd: 18 + rand() * 14, state: "walk", until: t + 3 + rand() * 4, k: 0.9 + rand() * 0.25, ph: rand() * TAU, off: 0, respawn: 0, deadAt: 0 };
  }
  // 죽은 척(thanatosis) — 그 자리에서 멈추고 움츠린다. 1.5~3s 뒤 포인터가 멀면 다시 걷는다.
  function playDead(b: Bug, t: number) {
    b.state = "dead";
    b.deadAt = t;
    b.until = t + 1.5 + rand() * 1.5;
    plays++;
  }
  // 날아오름 — 날개를 편 채 화면 밖까지(off 상태가 그린다), 6~10s 뒤 가장자리에서 새로 들어온다.
  function takeOff(b: Bug, t: number, hd: number) {
    b.state = "off";
    b.off = 0;
    b.hd = hd;
    b.respawn = t + 6 + rand() * 4;
  }
  function breeze(t: number, load: number) {
    windDir = rand() < 0.5 ? 1 : -1;
    const n = Math.round(lerp(18, 40, load));
    for (let i = 0; i < n; i++) {
      petals.push({ x: windDir > 0 ? -40 - rand() * 300 : w + 40 + rand() * 300, y: groundY(rand()), vx: windDir * (90 + rand() * 70), ph: rand() * TAU, a: rand() * TAU, va: (rand() - 0.5) * 4, born: t + rand() * 1.5, dur: 7 + rand() * 4, k: 0.7 + rand() * 0.6 });
    }
    breezes++;
  }
  function puff(d: Dandelion, t: number, load: number) {
    d.puffed = t;
    d.regrow = t + 25 + rand() * 15;
    puffs++;
    const n = Math.round(lerp(10, 26, load));
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
      const sp = 20 + rand() * 40;
      seeds.push({ x: d.x + (rand() - 0.5) * 8, y: d.y + (rand() - 0.5) * 8, vx: Math.cos(a) * sp + 22, vy: Math.sin(a) * sp - 10, ph: rand() * TAU, born: t, dur: 5 + rand() * 4 });
    }
  }
  // 트랩라인 — 가까운 6송이 중 45s 안에 안 간 가장 가까운 꽃. 전부 다녀왔으면 가장 오래전에 간 꽃. 지금 앉은 꽃은 제외.
  function pickFlower(b: Bee, t: number) {
    if (!daisies.length) {
      goHome(b);
      return;
    }
    const near = daisies
      .map((d, i) => [Math.hypot(d[0] - b.x, d[1] - b.y), i] as [number, number])
      .sort((u, v) => u[0] - v[0])
      .slice(0, 6);
    let pick = -1;
    let oldest = Infinity;
    for (const [, i] of near) {
      if (i === b.target) continue;
      const v = b.visited.get(i);
      if (v === undefined || t - v > VISIT_MEMORY) {
        pick = i;
        break;
      }
      if (v < oldest) {
        oldest = v;
        pick = i;
      }
    }
    if (pick < 0) pick = near[0]?.[1] ?? 0;
    b.target = pick;
    b.tx = daisies[pick][0];
    b.ty = daisies[pick][1];
    b.state = "fly";
  }
  function newBee(t: number): Bee {
    const left = rand() < 0.5;
    const b: Bee = { x: left ? -20 : w + 20, y: groundY(rand()), hd: left ? 0 : Math.PI, tx: 0, ty: 0, state: "fly", timer: 0, ph: rand() * TAU, ang: 0, target: -1, visits: 0, quota: 7 + Math.floor(rand() * 4), visited: new Map() };
    pickFlower(b, t);
    return b;
  }
  // 귀소 — 가장 가까운 가장자리로 날아 나간다(사라지지 않는다). 밖에 닿으면 bee = null.
  function goHome(b: Bee) {
    const exits: [number, number][] = [[-60, b.y], [w + 60, b.y], [b.x, -60], [b.x, h + 60]];
    let best = exits[0];
    let bd = Infinity;
    for (const q of exits) {
      const d = Math.hypot(q[0] - b.x, q[1] - b.y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    b.tx = best[0];
    b.ty = best[1];
    b.state = "home";
  }
  // 도망 — 포인터 반대쪽 280px로 1s. 끝나면 트랩라인을 이어간다.
  function beeFlee(b: Bee, px: number, py: number) {
    const dx = b.x - px;
    const dy = b.y - py;
    const d = Math.hypot(dx, dy) || 1;
    b.tx = clamp(b.x + (dx / d) * 280 + (rand() - 0.5) * 120, 20, w - 20);
    b.ty = clamp(b.y + (dy / d) * 280 + (rand() - 0.5) * 120, 20, h - 20);
    b.state = "flee";
    b.timer = 1;
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
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr || gav !== groundArt.version) bakeGround(f.dpr);
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
          if (b.state === "chase") endChase(b, t);
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
        // 위협 지각 — 60px 안이면 무조건, 빠른 접근(rate>200)은 160px, 덮쳐옴(loom>3)은 220px에서 도망. 느리게 오면 60px까지 참는다.
        if (p.inside && load >= 0.35 && b.state !== "leave") {
          const th = threat(p, b.x, b.y);
          if (th.d < 60 || (th.rate > 200 && th.d < 160) || (th.loom > 3 && th.d < 220)) {
            if (b.state === "chase") endChase(b, t);
            const ux = (b.x - p.x) / th.d;
            const uy = (b.y - p.y) / th.d;
            b.tx = clamp(b.x + ux * 340 + (rand() - 0.5) * 80, 30, w - 30);
            b.ty = clamp(b.y + uy * 340 + (rand() - 0.5) * 80, 30, h - 30);
            if (b.flee <= 0) {
              fleeCount++;
              climb(b);
            }
            b.flee = 1.2;
            b.next = t + 1.5;
            if (b.state !== "fly") {
              // 앉아 있던(일광욕·데이지) 것도 즉시 날아오른다.
              b.state = "fly";
              b.sun = false;
              b.nextLand = t + 10 + rand() * 10;
            }
          }
        }
        const fleeing = b.flee > 0;
        if (fleeing) b.flee -= dt;
        if (b.state === "chase") {
          // 나선 추격 — 공유 중심 둘레를 같은 방향으로, 반지름 20→60으로 벌어지며 돈다. 머리는 접선(살짝 바깥), 높이 최고.
          b.chase -= dt;
          const prog = 1 - clamp(b.chase / CHASE_DUR, 0, 1);
          const r = lerp(20, 60, prog);
          b.ca += b.cdir * 4.4 * dt;
          const nx = b.cx + Math.cos(b.ca) * r;
          const ny = b.cy + Math.sin(b.ca) * r;
          const k = Math.min(1, dt * 10);
          b.x += (nx - b.x) * k;
          b.y += (ny - b.y) * k;
          b.hd = b.ca + b.cdir * (Math.PI / 2 - 0.2);
          b.bank += (0.5 * b.cdir - b.bank) * Math.min(1, dt * 6);
          b.ph += 30 * dt;
          b.bob = Math.PI / 2;
          if (b.chase <= 0) endChase(b, t);
          continue;
        }
        if (b.state === "sit" || b.state === "bask") {
          // 앉음 — 데이지 위에선 천천히 여닫고, 일광욕은 활짝 편 채 0.9~1.0 사이로 숨쉰다(draw가 flap으로 읽는다).
          const basking = b.state === "bask";
          b.sit -= dt;
          b.ph += (basking ? 1.2 : 3.2) * dt;
          b.bob = -Math.PI / 2;
          b.bank *= 0.9;
          if (b.sit <= 0) {
            b.state = "fly";
            b.sun = false;
            b.tx = 40 + rand() * (w - 80);
            b.ty = 40 + rand() * (h - 80);
            b.next = t + 3 + rand() * 3;
            b.nextLand = t + (basking ? 6 + rand() * 8 : 12 + rand() * 14);
            if (basking) b.nextBask = t + BASK_COOLDOWN + rand() * 10;
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
            b.sun = false;
            b.tx = daisies[best][0];
            b.ty = daisies[best][1];
          } else b.nextLand = t + 8;
        }
        // 일광욕 — 양지(빛 얼룩) 120px 안을 지나면 25%로 그 근처 땅(데이지 아님)에 내려앉는다. 판단은 마리당 10s에 한 번.
        if (b.state === "fly" && t > b.nextBask && !fleeing && b.loop <= 0 && load >= 0.2) {
          for (const [sx, sy] of sunAt(t, w, h)) {
            if (Math.hypot(sx - b.x, sy - b.y) < 120) {
              b.nextBask = t + BASK_COOLDOWN;
              if (rand() < 0.25) {
                b.state = "land";
                b.sun = true;
                b.tx = clamp(sx + (rand() - 0.5) * 60, 30, w - 30);
                b.ty = clamp(sy + (rand() - 0.5) * 60, 30, h - 30);
              }
              break;
            }
          }
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
          const diff = angleDiff(Math.atan2(b.ty - b.y, b.tx - b.x), b.hd);
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
        // 도망 중엔 최고점까지 솟아 그 높이를 유지한다(그림자가 멀어짐); 평소엔 위아래로 너울거린다.
        if (fleeing) b.bob = Math.min(b.bob + 3.8 * dt, Math.PI / 2);
        else b.bob += 1.9 * dt;
        if (b.state === "land" && dist < 6) {
          b.x = b.tx;
          b.y = b.ty;
          if (b.sun) {
            b.state = "bask";
            b.sit = 2.5 + rand() * 1.5;
            b.ph = rand() * TAU;
            basks++;
          } else {
            b.state = "sit";
            b.sit = 2 + rand() * 2.5;
          }
        }
        if (b.state !== "leave") {
          if (b.x < -30) b.x = w + 20;
          else if (b.x > w + 30) b.x = -20;
          if (b.y < gy() - 30) b.y = h + 20;
          else if (b.y > h + 30) b.y = gy() - 20;
        }
      }
      // 나선 추격 — 나는 중인 둘이 60px 안에서 마주치면(전역 쿨다운 8s) 30%로 서로 감아 돈다. 실패해도 쿨다운은 소모(스쳐 지남).
      if (t > nextChase && load >= 0.35) {
        const pair = meetingPair();
        if (pair) {
          nextChase = t + CHASE_COOLDOWN;
          if (rand() < 0.3) startChase(pair[0], pair[1], t);
        }
      }
      // 무당벌레 — 수는 여력으로(0~2). 걷기 ↔ 멈춤. 위협엔 죽은 척(thanatosis), 닿이면 종종걸음, 들키면 날아오름.
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
          // 날아오름 — 사라지지 않고 날개를 편 채 화면 밖까지 날아간다(2026-09-04 사용자: "순간이동 금지").
          b.off = Math.min(1, b.off + dt / 0.5);
          b.x += Math.cos(b.hd) * 260 * dt;
          b.y += Math.sin(b.hd) * 260 * dt;
          b.ph += 40 * dt;
          if (b.x < -30 || b.x > w + 30 || b.y < -30 || b.y > h + 30) {
            bugsLeftScreen++;
            if (b.respawn === Infinity) bugs.splice(i, 1);
            else if (t > b.respawn) bugs[i] = newBug(t);
            else {
              b.x = -9999; // 밖에서 기다린다
              b.y = -9999;
            }
          }
          continue;
        }
        const th = threat(p, b.x, b.y);
        const aware = p.inside && load >= 0.35;
        const away = () => Math.atan2(b.y - p.y, b.x - p.x) + (rand() - 0.5) * 0.8;
        if (b.state === "dead") {
          // 죽은 척 — 꼼짝 않는다. 포인터가 30px 안까지 오면(들킴, 움츠린 뒤 0.3s부터) 날아가고, 시간이 지나 포인터가
          // 멀면(90px+) 새 방향으로 걷는다. 아직 가까우면 더 버틴다(총 6s까지), 그래도 안 가면 날아간다.
          if (aware && th.d < 30 && t - b.deadAt > 0.3) {
            takeOff(b, t, away());
            continue;
          }
          if (t > b.until) {
            if (!aware || th.d > 90) {
              b.state = "walk";
              b.hd = rand() * TAU;
              b.until = t + 2.5 + rand() * 4;
            } else if (t - b.deadAt < 6) b.until = Math.min(b.deadAt + 6, t + 1 + rand() * 1.5);
            else takeOff(b, t, away());
          }
          continue;
        }
        if (aware && b.state !== "flee") {
          if (th.d < 22) {
            // 걷다 닿였다 — 0.6s 종종걸음으로 반대쪽, 그러고 죽은 척.
            b.state = "flee";
            b.hd = away();
            b.until = t + 0.6;
            bugsFled++;
          } else if ((th.d < 70 && th.rate > 40) || (th.loom > 2 && th.d < 110)) {
            playDead(b, t);
            continue;
          }
        }
        if (t > b.until) {
          if (b.state === "flee") {
            playDead(b, t);
            continue;
          }
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
          const m = 10;
          if (b.x < -m || b.x > w + m || b.y < gy() - m || b.y > h + m) b.hd = Math.atan2(groundY(0.5) - b.y, w / 2 - b.x) + (rand() - 0.5) * 0.4;
        }
      }
      // 꽃잎 바람 — 여력 0.55부터, 20~45초 간격. 부는 동안 풀이 같이 흔들린다(wind → 1).
      if (load >= 0.55 && t > nextBreeze) {
        breeze(t, load);
        nextBreeze = t + (20 + rand() * 25) * (f.weather.now === "wind" ? 0.4 : 1); // 바람 부는 날은 꽃잎 바람이 잦다
      }
      const blowing = petals.length > 0;
      wind += ((blowing ? 1 : 0) - wind) * Math.min(1, dt * (blowing ? 1.2 : 0.5));
      if (blowing) {
        let sx = 0;
        let n = 0;
        for (const q of petals) {
          if (t < q.born) continue;
          sx += q.x;
          n++;
        }
        if (n) front += ((sx / n) - front) * Math.min(1, dt * 3);
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
      // 민들레 — 날린 뒤 25~40초면 다시 핀다(통통 커지며).
      for (const d of dands) {
        if (d.puffed > 0 && t > d.regrow) {
          d.puffed = 0;
          d.born = t;
        }
      }
      for (let i = seeds.length - 1; i >= 0; i--) {
        const s = seeds[i];
        const age = t - s.born;
        if (age > s.dur) {
          seeds.splice(i, 1);
          continue;
        }
        s.x += (s.vx + Math.sin(t * 1.7 + s.ph) * 12 + wind * windDir * 40) * dt;
        s.y += (s.vy + Math.cos(t * 1.1 + s.ph) * 8) * dt;
        s.vx *= Math.pow(0.6, dt);
        s.vy = s.vy * Math.pow(0.6, dt) - 6 * dt;
      }
      // 꿀벌 — 여력 0.6부터 한 마리(귀소 뒤엔 nextBee까지 기다린다). 트랩라인: fly → hover(0.4s) → feed(1~2s) → 다음 꽃,
      // 7~10송이면 home. 위협은 threat(), 손찌검(클릭)은 angry.
      if (load >= 0.6 && !bee && t > nextBee && daisies.length) bee = newBee(t);
      if (bee && load < 0.5 && bee.state !== "home") {
        // 여력이 떨어지면 가장 가까운 가장자리로 날아 나간다(사라지지 않는다).
        goHome(bee);
        nextBee = t + 8 + rand() * 8;
      }
      if (bee) {
        const b = bee;
        b.ph += dt;
        if (p.inside && (b.state === "fly" || b.state === "hover" || b.state === "feed")) {
          const th = threat(p, b.x, b.y);
          if (th.d < 40 || (th.rate > 200 && th.d < 120) || (th.loom > 3 && th.d < 160)) beeFlee(b, p.x, p.y);
        }
        if (b.state === "angry") {
          // 맴돌기 — 포인터를 따라다니며 반지름 40으로 1.2s 돈다(머리는 접선), 끝나면 달아난다.
          b.timer -= dt;
          b.ang += 9 * dt;
          const hx = p.x + Math.cos(b.ang) * 40;
          const hy = p.y + Math.sin(b.ang) * 40;
          const k = Math.min(1, dt * 12);
          b.x += (hx - b.x) * k;
          b.y += (hy - b.y) * k;
          b.hd = b.ang + Math.PI / 2;
          if (b.timer <= 0) beeFlee(b, p.x, p.y);
        } else if (b.state === "hover") {
          // 착지 전 맴돌기 — 꽃 위 반지름 6의 작은 원, 0.4s.
          b.timer -= dt;
          b.ang += 14 * dt;
          const hx = b.tx + Math.cos(b.ang) * 6;
          const hy = b.ty - 4 + Math.sin(b.ang) * 6;
          const k = Math.min(1, dt * 14);
          b.x += (hx - b.x) * k;
          b.y += (hy - b.y) * k;
          if (b.timer <= 0) {
            b.state = "feed";
            b.timer = 1 + rand();
            b.visited.set(b.target, t);
            b.visits++;
            beeVisits++;
          }
        } else if (b.state === "feed") {
          // 먹기 — 꽃 한가운데 붙어 1~2s(draw가 작게 까딱인다). 할당량을 채웠으면 귀소, 아니면 다음 꽃.
          b.timer -= dt;
          const k = Math.min(1, dt * 10);
          b.x += (b.tx - b.x) * k;
          b.y += (b.ty - 2 - b.y) * k;
          if (b.timer <= 0) {
            if (b.visits >= b.quota) {
              goHome(b);
              nextBee = t + 20 + rand() * 20;
            } else pickFlower(b, t);
          }
        } else {
          // fly · flee · home — 목표를 향해 지그재그.
          let dx = b.tx - b.x;
          let dy = b.ty - b.y;
          let d = Math.hypot(dx, dy);
          if (b.state === "flee") {
            b.timer -= dt;
            if (b.timer <= 0 || d < 8) {
              pickFlower(b, t);
              dx = b.tx - b.x;
              dy = b.ty - b.y;
              d = Math.hypot(dx, dy);
            }
          }
          if (b.state === "fly" && d < 8) {
            b.state = "hover";
            b.timer = 0.4;
            b.ang = Math.atan2(b.y - b.ty, b.x - b.tx);
          } else if (b.state === "home" && (b.x < -40 || b.x > w + 40 || b.y < -40 || b.y > h + 40)) {
            bee = null;
          } else {
            b.hd += clamp(angleDiff(Math.atan2(dy, dx), b.hd), -6 * dt, 6 * dt) + Math.sin(t * 13 + b.ph) * 1.6 * dt;
            const sp = b.state === "flee" ? 260 : b.state === "home" ? 150 : 110;
            b.x += Math.cos(b.hd) * sp * dt;
            b.y += Math.sin(b.hd) * sp * dt;
          }
        }
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
      const { t, load } = f;
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      // 3/4 시점의 지평선 띠(위 12%) — 먼 언덕·작은 나무 줄·안개.
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 풀포기 층 — 타일(24×12). 꽃잎 앞머리(front) 둘레 ±280px에서만 바람 방향으로 눕고 진행파로 일렁인다(꽃잎 열과 함께
      // 지나간다). 평소엔 여력이 있을 때 아주 미세한 숨쉬기(0.8px)만. 필터 없음, drawImage 288번.
      if (blades) {
        const idle = load >= 0.5 ? 0.8 : 0;
        if (wind > 0.02 || idle > 0) {
          const tw = f.w / COLS;
          const th = f.h / ROWS;
          const bw = blades.width / COLS;
          const bh = blades.height / ROWS;
          for (let i = 0; i < COLS; i++) {
            const cx = (i + 0.5) * tw;
            const near = wind > 0.02 ? Math.exp(-Math.pow((cx - front) / 280, 2)) * wind : 0;
            const gustDx = near * (8 * Math.sin(t * 3.4 - i * 0.7 * windDir) + windDir * 5);
            for (let j = 0; j < ROWS; j++) {
              const dx = gustDx + idle * Math.sin(t * 0.9 + j * 0.8 + i * 0.4);
              g.drawImage(blades, i * bw, j * bh, bw, bh, i * tw + dx, j * th, tw + 0.5, th + 0.5);
            }
          }
        } else g.drawImage(blades, 0, 0, f.w, f.h);
      }
      // 연대기 — 지난 가을 저장소에서 난 싹(3~5월 점점 자람), 지난 해들의 나무(위 헤지로우), 두더지 흙더미. 풀 위·생물 아래.
      if (traceBakes) drawTraces(g, f, "spring", traceBakes);
      // 양지 — 빛 얼룩 둘(sunAt: 나비 일광욕 판단과 같은 자리).
      const suns = sunAt(t, f.w, f.h);
      softBlob(g, suns[0][0], suns[0][1], f.w * 0.28, "255 255 236", 0.16);
      softBlob(g, suns[1][0], suns[1][1], f.w * 0.24, "255 255 236", 0.13);
      // 민들레(여력 0.4부터) — 핀 것만. 다시 필 땐 통통(오버슈트) 커진다.
      if (dandSpr && load >= 0.4) {
        for (const d of dands) {
          if (d.puffed > 0) continue;
          const age = t - d.born;
          const pop = age < 0.6 ? 1 + 0.35 * Math.sin((age / 0.6) * Math.PI) : 1;
          const k = d.k * Math.min(1, age / 0.25) * pop * depthScale(d.y, f.h) * (SIZE.flower / 20);
          if (groundArt.has("dandelion-puff")) {
            // 아트 — 홀씨 머리 중심이 (d.x, d.y)에 오게(홀씨는 거기서 날아간다), 발은 그 아래.
            drawProp(g, groundArt, "dandelion-puff", d.x, d.y + 16 * k, { k: k * 1.25 });
            continue;
          }
          g.save();
          g.translate(d.x, d.y);
          g.strokeStyle = "rgb(120 165 100 / 0.7)";
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(0, 6 * k);
          g.lineTo(3 * k, 16 * k);
          g.stroke();
          g.scale(k, k);
          g.drawImage(dandSpr, -20, -20);
          g.restore();
        }
      }
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
      if (bugSpr) {
        for (const b of bugs) {
          const flying = b.state === "off";
          const dead = b.state === "dead";
          if (b.x < -100) continue;
          // 죽은 척은 0.25s에 걸쳐 움츠린다(×0.88) — 걷는 흔들림 없음.
          const tuck = dead ? 0.88 + 0.12 * Math.max(0, 1 - (t - b.deadAt) / 0.25) : 1;
          const k = b.k * (flying ? 1 + b.off * 0.35 : tuck) * depthScale(b.y, f.h);
          g.save();
          g.globalAlpha = 1;
          if (shadow && !flying) {
            g.save();
            g.globalAlpha = 0.25;
            g.translate(b.x + 2, b.y + 3);
            g.scale(1, GROUND_SQUASH);
            g.rotate(b.hd + Math.PI / 2);
            g.drawImage(shadow, -12 * k, -9 * k, 24 * k, 18 * k);
            g.restore();
          }
          if (flying) {
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
          const wob = b.state === "pause" || dead || flying ? 0 : Math.sin(b.ph) * 0.12;
          drawSprite(g, bugSpr, b.x, b.y, b.hd + Math.PI / 2 + wob, k);
          g.restore();
        }
      }
      // 홀씨 — 살랑 떠오르며 멀어진다(끝에 옅어짐).
      if (seedSpr) {
        for (const s of seeds) {
          const age = t - s.born;
          const a = Math.min(1, age / 0.4) * Math.min(1, (s.dur - age) / 1.5);
          g.save();
          g.globalAlpha = a;
          g.translate(s.x, s.y);
          g.rotate(Math.sin(t * 2 + s.ph) * 0.5);
          g.drawImage(seedSpr, -7, -7);
          g.restore();
        }
      }
      if (petalSpr) {
        for (const q of petals) {
          if (t < q.born) continue;
          const age = t - q.born;
          const a = Math.min(1, age / 0.8) * Math.min(1, (q.dur - age) / 1.2);
          g.save();
          g.globalAlpha = a * 0.9;
          g.translate(q.x, q.y);
          g.rotate(q.a);
          const pk = q.k * 0.55 * depthScale(q.y, f.h); // 축척: 꽃잎 ≈ 6~10px
          g.scale(pk, pk * (0.55 + 0.45 * Math.abs(Math.cos(t * 2.1 + q.ph))));
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
      // 꿀벌(Noto Emoji 🐝, 옆모습) — 진행 방향으로 뒤집어 그리고 붕붕 떨림, 그림자 조금. 맴돌기·성남은 떨림이 크고, 먹을 땐 작게 까딱.
      if (bee && beeSpr) {
        const b = bee;
        const feeding = b.state === "feed";
        const buzz = feeding ? 0.25 : b.state === "hover" || b.state === "angry" ? 1.6 : 1;
        if (shadow) {
          g.save();
          g.globalAlpha = feeding ? 0.3 : 0.22;
          g.translate(b.x + 5, b.y + (feeding ? 5 : b.state === "hover" ? 12 : 9));
          g.drawImage(shadow, -10, -6, 20, 12);
          g.restore();
        }
        const bob = feeding ? Math.sin(t * 6 + b.ph) * 0.5 : Math.sin(t * 40 + b.ph) * 0.8 * buzz;
        drawFacing(g, beeSpr, b.x, b.y + bob, b.hd, depthScale(b.y, f.h), Math.sin(t * 13 + b.ph) * 0.08 * buzz);
      }
      for (const b of flies) {
        const grounded = b.state === "sit" || b.state === "bask";
        const hgt = grounded ? 0 : 0.5 + 0.5 * Math.sin(b.bob);
        const raw = Math.abs(Math.cos(b.ph));
        // 일광욕은 활짝 편 채 0.9~1.0 숨쉬기, 데이지 위는 천천히 여닫기, 날 때는 팔랑.
        const flap = b.state === "bask" ? 0.95 + 0.05 * Math.sin(b.ph) : b.state === "sit" ? 0.35 + 0.65 * raw : 0.14 + 0.86 * Math.pow(raw, 0.8);
        const size = b.k * (1 + 0.08 * hgt) * depthScale(b.y, f.h);
        if (shadow) {
          g.save();
          g.translate(b.x + 5 + 10 * hgt, b.y + 7 + 13 * hgt);
          g.scale(1, GROUND_SQUASH);
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
          if (b.state === "chase") endChase(b, f.t);
          burst(b.x, b.y, b.col, f.load);
          b.loop = 0.65;
          if (b.flee <= 0) climb(b);
          b.flee = 1.6;
          b.state = "fly";
          b.sun = false;
          b.nextLand = f.t + 12;
          b.tx = clamp(b.x + (rand() - 0.5) * 600, 30, w - 30);
          b.ty = clamp(b.y + (rand() - 0.5) * 600, 30, h - 30);
          b.next = f.t + 2;
          return true;
        }
      }
      // 꿀벌을 손으로 치면(클릭) 성나서 포인터 둘레를 1.2s 맴돌다 달아난다.
      if (bee && bee.state !== "home" && bee.state !== "angry" && Math.hypot(bee.x - f.p.x, bee.y - f.p.y) < 18) {
        bee.state = "angry";
        bee.timer = 1.2;
        bee.ang = Math.atan2(bee.y - f.p.y, bee.x - f.p.x);
        swats++;
        return true;
      }
      // 무당벌레를 누르면(죽은 척 중이어도) 날아오른다.
      for (const b of bugs) {
        if (b.state !== "off" && Math.hypot(b.x - f.p.x, b.y - f.p.y) < 18) {
          takeOff(b, f.t, Math.atan2(b.y - f.p.y, b.x - f.p.x) + (rand() - 0.5) * 0.8);
          return true;
        }
      }
      // 민들레 — 바탕 위에서만(달력 칸 위 클릭은 그쪽 일). 홀씨가 흩어진다.
      if (onBackground && f.load >= 0.4) {
        for (const d of dands) {
          if (d.puffed === 0 && Math.hypot(d.x - f.p.x, d.y - f.p.y) < 20 * d.k) {
            puff(d, f.t, f.load);
            return true;
          }
        }
      }
      if (!onBackground) return false;
      if (f.p.y < gy()) return false; // 지평선 띠(먼 언덕)의 풀은 밟히지 않는다
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
        beeSprite: !!beeSpr,
        petals: petals.length,
        breezes,
        wind: Math.round(wind * 100) / 100,
        front: Math.round(front),
        bugsLeftScreen,
        dandelions: dands.map((d) => [Math.round(d.x), Math.round(d.y), d.puffed > 0 ? 1 : 0]),
        seeds: seeds.length,
        puffs,
        bee: bee ? [Math.round(bee.x), Math.round(bee.y), bee.state] : null,
        beeState: bee ? bee.state : null,
        chases,
        basks,
        plays,
        beeVisits,
        swats
      };
    }
  };
}
