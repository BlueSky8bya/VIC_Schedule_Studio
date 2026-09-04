// 가을 — "낙엽이 소복한 땅을 위에서 내려다본다". **바탕**(2026-09-04 사용자: "가을만 일반 화면") — 마른 흙 얼룩(올리브·
// 엄버, 채도 낮춤)·시든 풀포기(황갈)·잔가지·조약돌·버섯(갈색 갓에 크림 점) 몇을 크기별 결정적으로 한 번 굽는다. 그 위에
// 여러 수종의 잎(둥근 잎·느릅·버들·단풍·은행·참나무·솔잎)이 흩어져 있고, 이따금 바람이 한 줄기 지나가며(gust) 잎들이
// 밀리고 뒤집힌다. 포인터가 지나가면 그 주변 잎이 바람에 날리듯 밀리고, 바탕 위에서 잎을 누르면 집어서 끌 수 있다.
// 잎끼리는 원 충돌로 서로 밀어낸다.
// 랜덤 이벤트: **도토리**(에셋)가 하늘에서 떨어져 튀고 구르며 잎을 밀친다(집어 던지기, 최대 6). **다람쥐**(에셋) — 가장자리에서
// 달려 들어와 킁킁대다 도토리가 있으면 물고 **땅에 묻는다**(2026-09-04 사용자: "동물마다 실제 행동 연구대로 반응하게" —
// 동부회색다람쥐의 분산 저장·속임수 묻기·경계·지그재그 도망·회수, 아래 SqPhase 주석). 묻은 자리엔 흙더미가 남고 잎에 덮이기도
// 한다 — 흙더미를 누르면 도토리가 튀어나온다(찾기 놀이). **회오리** — 작은 낙엽 회오리가 화면을 가로지르며 잎들을 빙글 띄운다.
// 여력(f.load): 잎 26~220장(×면적)이 점진적으로(늘 땐 떨어지고 줄 땐 옅어져) 오르내리고, 돌풍·도토리(≥.4)·다람쥐(≥.5)·
// 회오리(≥.6)도 여력을 따른다. 색은 채도를 낮춘 가을색(붉·주황·노랑을 쨍하게 올리지 않는다 — CLAUDE.md Owner-fit palette).

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawFacing, loadSprite, type Sprite } from "../assets";
import { angleDiff, clamp, leafPath, leafVeins, lerp, makeCanvas, pineNeedles, rng, shadowSprite, softBlob, TAU, threat } from "./util";
import { bakeTraces, drawTraces, type TraceBakes } from "../world/traces-draw";
import { ArtSet } from "../art/load";
import { drawProp, resetPropField, scatterProps } from "../art/props";
import { LEAF_K, SIZE } from "../world/scale";
import { GROUND_SQUASH, bakeHorizon, depthFade, depthScale, flatXform, horizonY, moveScale } from "../world/view";

type Species = { shape: number; colors: string[]; size: [number, number]; weight: number; needle?: boolean };
const SPECIES: Species[] = [
  { shape: 0, colors: ["#a8744f", "#8f5a48", "#9c6a4a", "#8b5f4a"], size: [34, 60], weight: 4 },
  { shape: 1, colors: ["#b08a55", "#9a8a5c", "#8a7a5a"], size: [30, 52], weight: 2 },
  { shape: 2, colors: ["#9c8a4e", "#7f7a45", "#a08a50"], size: [34, 62], weight: 1.5 },
  { shape: 3, colors: ["#7d4a48", "#6f4340", "#84544c", "#8a5b4e"], size: [44, 76], weight: 2 },
  { shape: 4, colors: ["#9a8a56", "#8b7d4c", "#a4956a"], size: [36, 60], weight: 1.5 },
  { shape: 5, colors: ["#8b6a3f", "#a17a4a", "#7a5a38"], size: [40, 70], weight: 3.5 },
  { shape: 6, colors: ["#6b6a3c", "#7a6a3a", "#5f6a40"], size: [26, 40], weight: 2, needle: true }
];
const ACORN = SPECIES.length;
const SPR = 84;
const R0 = 30;
const ACORN_MAX = 6;
const CACHE_MAX = 8;

type Leaf = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  s: number;
  sp: number;
  col: number;
  lift: number;
  flip: number;
  flipV: number;
  fall: number;
  ph: number;
  fade: number;
  born: number;
};
type Gust = { t0: number; dur: number; dir: number; y: number } | null;
// 다람쥐 상태 기계(2026-09-04, 동부회색다람쥐 Sciurus carolinensis 행동 연구 기반):
//  run 달려옴 → sniff 킁킁(1.2s) → grab 도토리를 집어 물고 한 번 통통(0.45s, 도토리는 그 순간 입으로 옮겨진다)
//  → **분산 저장(scatter hoarding)** — 한 번에 하나만 물고 cache 자리(다른 저장소와 180px↑, 포인터와 220px↑, 가장자리 40px
//    안쪽, 핫 존 밖; 후보 12개 안에 없으면 그냥 물고 나간다)로 달려가 dig(0.7s: 앞발로 파며 흙알갱이가 뒤로 튄다) → bury(즉시:
//    도토리를 놓고 흙더미) → pat(0.35s: 다지기, 통통) → look(0.6s: 경계, 고개 ±0.3rad) → 땅에 도토리가 더 있고 이번 방문에
//    3개 미만이면 다시 run, 아니면 leave.
//  → **속임수 묻기(deceptive caching, Steele et al. 2008)** — 파려는 순간 누가 보고 있으면(포인터 260px 안) 파고 다지는
//    시늉만 하고 도토리는 입에 문 채 다른 자리로 간다(도토리당 최대 2번, 그다음은 진짜로 묻는다).
//  → **경계(vigilance)** — 달리는 중(run·cache·retrieve) 2~4초마다 20%로 0.3~0.6s 얼어붙어 꼬리를 떤다(pause); 그때 포인터가
//    200px 안이면 도망.
//  → **얼음→도망(freeze-then-flee)** — 도망 개시 거리는 고정 반경이 아니라 접근 속도로(util.threat): 천천히 오면(rate<60)
//    70px까지 두고, 90px 안·220px 안에서 220px/s↑·300px 안에서 loom 3.5↑면 튄다. 도망은 **지그재그**(출구 방향에 수직
//    ±60px 경유점 둘, 번갈아) — 물고 있던 도토리는 그대로 물고 간다. 누르면(30px) 바로 도망.
//  → **회수(cache retrieval)** — 땅에 도토리가 없고 묻은 자리가 있으면 50%로 기억을 따라(retrieve) 가서 파낸다(dig) → 물고
//    leave, 30%는 다른 자리에 다시 묻는다. 그 사이 사용자가 파 간 자리면 빈손으로 간다.
//  방향은 5rad/s로 돌고, 많이 틀어야 하면 제자리에서 먼저 돈 뒤 달린다(휙 순간 회전 금지). 화면 밖으로 눈에 보이게 나간다.
type SqPhase = "run" | "sniff" | "grab" | "cache" | "dig" | "bury" | "pat" | "look" | "pause" | "retrieve" | "leave";
type DigKind = "cache" | "fake" | "retrieve";
type Squirrel = {
  x: number;
  y: number;
  dir: number;
  phase: SqPhase;
  tx: number;
  ty: number;
  t0: number;
  target: number;
  carry: boolean;
  ph: number;
  dig: DigKind; // 지금 파는 이유
  fakes: number; // 이 도토리로 한 속임수 묻기 횟수(≤2)
  taken: number; // 이번 방문에 가져간 도토리 수(≤3)
  nextPause: number; // 다음 경계 판정 시각
  pauseDur: number;
  prev: SqPhase; // pause에서 돌아갈 단계
  wps: [number, number][]; // leave 경유점(지그재그면 셋, 아니면 출구 하나)
  specksLeft: number; // dig 중 아직 튀길 흙알갱이 수
  nextSpeck: number;
};
/** 묻은 자리(기억) — 흙더미로 그려지고 잎에 덮일 수 있다. 최대 8, 넘치면 가장 오래된 것부터 잊는다. */
type Cache = { x: number; y: number; t: number };
/** 파낼 때 앞발 뒤로 튀는 흙알갱이. */
type Speck = { x: number; y: number; vx: number; vy: number; life: number };
type Whirl = { x: number; y: number; vx: number; vy: number; t0: number; dur: number } | null;

export function createAutumn(seed: number): Scene {
  const rand = rng(seed);
  const leaves: Leaf[] = [];
  const caches: Cache[] = [];
  const specks: Speck[] = [];
  let sprites: HTMLCanvasElement[][] = [];
  let shadows: HTMLCanvasElement[] = [];
  let acornSpr: Sprite | null = null;
  let acornShadow: HTMLCanvasElement | null = null;
  let traceBakes: TraceBakes | null = null; // 연대기(지난 해 나무·이번 가을 결정적 저장소) 렌더
  let squirrelSpr: Sprite | null = null;
  let sqShadow: HTMLCanvasElement | null = null;
  let moundSpr: HTMLCanvasElement | null = null;
  let ground: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  // 바탕 소품 아트(버섯·잔가지·조약돌·마른 풀 + 있으면 관목·바위·그루터기·통나무) — 모두 도착하면 version이 올라 바탕을 한 번 다시 굽는다.
  const groundArt = new ArtSet(["mushroom", "twig", "pebble", "grass-dry", "shrub-autumn", "rock", "stump", "log", "tree-oak-autumn", "tree-pine-autumn"], {
    scaleOf: { "tree-oak-autumn": 3, "tree-pine-autumn": 3 }
  });
  let gav = -1;
  let horizon: HTMLCanvasElement | null = null; // 3/4 시점의 지평선 띠(먼 언덕·작은 나무 줄) — 크기별 한 번
  // 땅의 위 끝(지평선) — 잎·소품·다람쥐·돌풍은 이 아래에서만 산다(지평선 띠는 먼 곳: 소유자 2026-09-04 "언덕에 겹쳐서 떠다닌다").
  const gy = () => horizonY(h);
  /** 작은 식물의 추가 원근 테이퍼 — 0.3(지평선) → 1.0(발치). depthScale(0.6~1.0)만으로는 지평선의 풀이 근경의 0.75배로 남는다. */
  const smallK = (y: number) => 0.3 + 0.7 * Math.min(1, Math.max(0, (y - gy()) / Math.max(1, h - gy())));
  const groundY = (r: number) => gy() + r * (h - gy());
  let grabbed = -1;
  let gox = 0;
  let goy = 0;
  let gust: Gust = null;
  let nextGust = 4 + rand() * 5;
  let nextSpawn = 0;
  let nextTrim = 0;
  let nextAcorn = 7 + rand() * 6;
  let acornsDropped = 0;
  let squirrel: Squirrel | null = null;
  let nextSquirrel = 16 + rand() * 8;
  let squirrels = 0;
  let stolen = 0;
  let fakes = 0;
  let dugUp = 0;
  let retrieved = 0;
  let flees = 0;
  let pauses = 0;
  let whirl: Whirl = null;
  let nextWhirl = 24 + rand() * 20;
  let whirls = 0;
  let w = 0;
  let h = 0;
  let windCount = 0;
  let filled = false;

  function bake() {
    if (sprites.length) return;
    sprites = [];
    shadows = [];
    for (const sp of SPECIES) {
      const row: HTMLCanvasElement[] = [];
      for (const col of sp.colors) {
        const { c, g } = makeCanvas(SPR, SPR);
        g.translate(SPR / 2, SPR / 2);
        if (sp.needle) {
          pineNeedles(g, R0 * 0.55, col, 2.1);
          g.strokeStyle = "rgb(255 245 230 / 0.25)";
          g.lineWidth = 0.8;
          g.stroke();
        } else {
          leafPath(g, R0, sp.shape);
          g.fillStyle = col;
          g.fill();
          g.save();
          leafPath(g, R0, sp.shape);
          g.clip();
          const lg = g.createLinearGradient(0, R0, 0, -R0);
          lg.addColorStop(0, "rgb(30 18 12 / 0.2)");
          lg.addColorStop(0.5, "rgb(30 18 12 / 0)");
          lg.addColorStop(1, "rgb(255 240 210 / 0.14)");
          g.fillStyle = lg;
          g.fillRect(-SPR / 2, -SPR / 2, SPR, SPR);
          const spots = 2 + Math.floor(rand() * 3);
          for (let k = 0; k < spots; k++) {
            softBlob(g, (rand() - 0.5) * R0 * 1.2, (rand() - 0.5) * R0 * 1.4, R0 * (0.18 + rand() * 0.22), "60 36 24", 0.2);
          }
          if (rand() < 0.5) softBlob(g, (rand() - 0.5) * R0, (rand() - 0.5) * R0, R0 * 0.25, "255 235 200", 0.18);
          const hl = g.createLinearGradient(-R0, -R0, R0, R0);
          hl.addColorStop(0, "rgb(255 245 230 / 0.22)");
          hl.addColorStop(0.55, "rgb(255 245 230 / 0)");
          hl.addColorStop(1, "rgb(40 28 20 / 0.14)");
          g.fillStyle = hl;
          g.fillRect(-SPR / 2, -SPR / 2, SPR, SPR);
          g.restore();
          g.lineCap = "round";
          g.strokeStyle = "rgb(255 245 225 / 0.4)";
          g.lineWidth = 1.1;
          leafVeins(g, R0, sp.shape);
          g.strokeStyle = "rgb(50 30 20 / 0.16)";
          g.lineWidth = 0.5;
          g.translate(0.6, 0.6);
          leafVeins(g, R0, sp.shape);
          g.translate(-0.6, -0.6);
          leafPath(g, R0, sp.shape);
          g.strokeStyle = "rgb(60 40 30 / 0.3)";
          g.lineWidth = 0.9;
          g.stroke();
          g.strokeStyle = "rgb(70 50 36 / 0.55)";
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(0, R0 * 0.88);
          g.lineTo(sp.shape === 4 ? 0 : R0 * 0.06, R0 * 1.22);
          g.stroke();
        }
        row.push(c);
      }
      sprites.push(row);
      const { c, g } = makeCanvas(SPR, SPR);
      g.translate(SPR / 2, SPR / 2);
      if (sp.needle) pineNeedles(g, R0 * 0.55, "#2b2320", 2.6);
      else {
        leafPath(g, R0 * 1.04, sp.shape);
        g.fillStyle = "#2b2320";
        g.fill();
      }
      shadows.push(c);
    }
    acornShadow = shadowSprite(44, 52, "43 35 32", 0.9);
    traceBakes = bakeTraces();
    sqShadow = shadowSprite(56, 44, "43 35 32", 0.6);
    // 흙더미(묻은 자리) — 22×14 타원, 가운데 어둡고 테는 밝은 갈색, 알파 최대 .55. 우리 소품(동물이 아니다)이라 한 번 굽는다.
    {
      const { c, g } = makeCanvas(22, 14);
      g.translate(11, 7);
      g.scale(1, 14 / 22);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 11);
      rg.addColorStop(0, "rgb(88 66 46 / 0.55)");
      rg.addColorStop(0.55, "rgb(120 95 70 / 0.5)");
      rg.addColorStop(0.82, "rgb(152 128 98 / 0.4)");
      rg.addColorStop(1, "rgb(152 128 98 / 0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, 11, 0, TAU);
      g.fill();
      moundSpr = c;
    }
    void loadSprite(ASSET.acorn, 40, 52).then((s) => (acornSpr = s)).catch(() => {});
    void loadSprite(ASSET.chipmunk, 52, 52).then((s) => (squirrelSpr = s)).catch(() => {});
  }
  // 가을 바탕 — 크기별 결정적. 마른 흙 얼룩 + 시든 풀 + 잔가지 + 조약돌 + 버섯.
  function bakeGround(dpr: number) {
    const g0 = rng((seed * 7 + 13) >>> 0);
    resetPropField();
    const { c, g } = makeCanvas(w * dpr, h * dpr);
    g.scale(dpr, dpr);
    // 흙 바탕 — 이게 없어 지금까지 "가을 땅"이 페이지의 흰색이었고, 낙엽·잔가지가 흰 종이 위의 점으로 보였다.
    const bg = g.createLinearGradient(0, gy(), 0, h);
    // 근경을 확실히 낮춘다(옛 #85795a는 원경 #d3c7a8과 명도 폭이 좁아 화면 전체가 단일 카키였다).
    bg.addColorStop(0, "#cdc09f");
    bg.addColorStop(1, "#5b5340");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const patches = Math.round((w * h) / 42000);
    // 따뜻한 흙 + **차가운 두 톤**(회녹·회청) — 한 색만 있으면 "흙먼지 폭풍"이 된다(검토 4차).
    const PATCH = ["158 142 100", "132 108 74", "172 156 114", "118 96 76", "118 126 114", "104 112 118"];
    for (let i = 0; i < patches; i++) {
      const pi = Math.floor(g0() * PATCH.length);
      const cool = pi >= 4; // 차가운 두 톤은 작고 옅게 — 크게 깔면 "때 묻은 얼룩"이 된다(검토 5차)
      const py2 = groundY(g0());
      const pk2 = depthScale(py2, h) * depthScale(py2, h);
      softBlob(g, g0() * w, py2, (cool ? 70 + g0() * 90 : 110 + g0() * 240) * pk2, PATCH[pi], cool ? 0.07 : 0.13, 0, GROUND_SQUASH);
    }
    // 이끼·마른 잔디 얼룩 — 흙 한 톤짜리 사막이 되지 않게 초록빛 기운을 남긴다.
    for (let i = 0; i < Math.round((w * h) / 120000); i++) softBlob(g, g0() * w, groundY(0.2 + g0() * 0.8), 60 + g0() * 60, "116 128 88", 0.09, 0, GROUND_SQUASH);
    // 소품은 전부 drawProp(art/props.ts) — 아트 파일이 있으면 그 그림, 없으면 대체물(옛 도형). 자리는 결정적.
    // 3/4 시점: 서 있는 것은 위(멀다)에서 작게(depthScale), 납작한 것(잔가지·조약돌)은 세로로 눌린다(GROUND_SQUASH).
    // 무리 심기 — 균일 분포는 벽지로 읽힌다(검토 3차).
    const tufts = Math.round((w * h) / 2600);
    let clumpX = 0;
    let clumpY = 0;
    let clumpLeft = 0;
    for (let i = 0; i < tufts; i++) {
      if (clumpLeft <= 0) {
        clumpX = g0() * w;
        clumpY = groundY(g0());
        clumpLeft = 1 + Math.floor(g0() * 7);
      }
      clumpLeft--;
      const spread = 26 + g0() * 54;
      const x = clumpX + (g0() - 0.5) * spread * 2;
      const y = clumpY + (g0() - 0.5) * spread;
      drawProp(g, groundArt, "grass-dry", x, y, { k: (0.55 + g0() * 1.0) * depthScale(y, h) * smallK(y), r: g0(), flip: g0() < 0.5, alpha: 0.75 + g0() * 0.25 });
    }
    const twigs = Math.round((w * h) / 80000);
    for (let i = 0; i < twigs; i++) {
      const x = g0() * w;
      const y = groundY(g0());
      drawProp(g, groundArt, "twig", x, y, { k: (0.8 + g0() * 0.8) * depthScale(y, h) * smallK(y), rot: g0() * TAU, r: g0(), sy: GROUND_SQUASH });
    }
    const pebbles = Math.round((w * h) / 130000);
    for (let i = 0; i < pebbles; i++) {
      const x = g0() * w;
      const y = groundY(g0());
      drawProp(g, groundArt, "pebble", x, y, { k: (0.7 + g0() * 0.9) * depthScale(y, h), rot: g0() * TAU, r: g0(), sy: GROUND_SQUASH });
    }
    const shrooms = clamp(Math.round((w * h) / 300000), 3, 7);
    for (let i = 0; i < shrooms; i++) {
      const x = 30 + g0() * (w - 60);
      const y = gy() + 30 + g0() * (h - gy() - 60);
      const k = (0.8 + g0() * 0.6) * depthScale(y, h);
      softBlob(g, x + 3, y - 4, 12 * k, "43 35 32", 0.22);
      drawProp(g, groundArt, "mushroom", x, y + 8 * k, { k, r: g0() });
    }
    // 있을 때만 놓이는 큰 소품(아트가 오면 나타난다) — 바깥 띠(달력 밖)에 결정적으로.
    scatterProps(g, groundArt, w, h, g0, [
      { id: "shrub-autumn", n: 3 },
      { id: "rock", n: 2 },
      { id: "stump", n: 1 },
      { id: "log", n: 1 }
    ]);
    // 낙엽·잔가지·도토리가 쌓이려면 **떨어뜨릴 나무**가 있어야 한다 — 무입목 초지에 활엽 낙엽 융단은
    // 있을 수 없다(검토 라운드2 현실성 #13). 화면 위·좌우 가장자리에 참나무 무리를 두르고, 낙엽 더미도
    // 그 발치에 모인다(균등 산포 = confetti, 미관 #11).
    {
      const spots: { x: number; y: number; k: number }[] = [];
      for (let c2 = 0; c2 < 3; c2++) {
        const cx2 = w * (0.12 + 0.38 * c2 + (g0() - 0.5) * 0.14);
        const n2 = 2 + Math.floor(g0() * 3);
        for (let i = 0; i < n2; i++) {
          const y = groundY(0.02 + g0() * 0.16);
          spots.push({ x: cx2 + (g0() - 0.5) * w * 0.16, y, k: (0.85 + g0() * 0.6) * depthScale(y, h) });
        }
      }
      // 코앞 한 그루 — 화면 아래에서 잘린다(가까움의 신호).
      spots.push({ x: w * (0.05 + g0() * 0.12), y: groundY(1.02), k: 1.15 + g0() * 0.2 });
      spots.sort((a2, b2) => a2.y - b2.y);
      for (const t2 of spots) {
        softBlob(g, t2.x + 6, t2.y - 3, 60 * t2.k, "70 58 46", 0.14, 0, GROUND_SQUASH * 0.5);
        drawProp(g, groundArt, g0() < 0.25 ? "tree-pine-autumn" : "tree-oak-autumn", t2.x, t2.y, { k: t2.k, r: g0(), flip: g0() < 0.5 });
        // 발치의 낙엽 더미 — 여기가 낙엽의 출처다.
        for (let q = 0; q < 5; q++) {
          softBlob(g, t2.x + (g0() - 0.5) * 170 * t2.k, t2.y + (g0() * 0.7) * 80 * t2.k, (40 + g0() * 70) * t2.k, g0() < 0.5 ? "94 70 44" : "84 56 50", 0.3, 0, GROUND_SQUASH);
        }
      }
    }
    ground = c;
    horizon = bakeHorizon("autumn", w, h, 1);
    gw = w;
    gh = h;
    gdpr = dpr;
    gav = groundArt.version;
  }

  const totalWeight = SPECIES.reduce((a, s) => a + s.weight, 0);
  function pickSpecies(): number {
    let r = rand() * totalWeight;
    for (let i = 0; i < SPECIES.length; i++) {
      r -= SPECIES[i].weight;
      if (r <= 0) return i;
    }
    return 0;
  }
  function spawn(t: number, falling = false): Leaf {
    const sp = pickSpecies();
    const [lo, hi] = SPECIES[sp].size;
    // 축척(PLAN-004 §2): 낙엽은 나무의 1/12 — 옛 30~76을 LEAF_K(≈.36)로 줄인다(물리 반지름·집기 판정도 s에 비례하므로 같이 줄어든다).
    return { x: rand() * w, y: groundY(0.12 + rand() * 0.86), vx: 0, vy: 0, a: rand() * TAU, va: 0, s: (lo + rand() * (hi - lo)) * LEAF_K, sp, col: Math.floor(rand() * SPECIES[sp].colors.length), lift: 0, flip: 0, flipV: 0, fall: falling ? 1 : 0, ph: rand() * TAU, fade: 0, born: t };
  }
  /** 도토리는 최대 6 — 넘치면 가장 오래된 것이 옅어진다. */
  function capAcorns() {
    const acorns = leaves.filter((l) => l.sp === ACORN && l.fade === 0);
    if (acorns.length > ACORN_MAX) acorns.sort((a, b) => a.born - b.born)[0].fade = 0.001;
  }
  function pushAcorn(x: number, y: number, fall: number, t: number) {
    leaves.push({ x, y, vx: 0, vy: 0, a: rand() * TAU, va: 0, s: SIZE.acorn * (0.75 + rand() * 0.35), sp: ACORN, col: 0, lift: 0, flip: 0, flipV: 0, fall, ph: rand() * TAU, fade: 0, born: t });
    capAcorns();
  }
  function dropAcorn(t: number) {
    // 먼 띠(v < 0.3)엔 떨어뜨리지 않는다 — 안개 속 지평선 부근이라 "공중에 있는" 것으로 보인다.
    pushAcorn(w * (0.1 + rand() * 0.8), groundY(0.32 + rand() * 0.58), 1, t);
    acornsDropped++;
  }
  // leavesOnly = 다람쥐의 발놀림: 잎만 헤치고 도토리는 건드리지 않는다 — 제 목표 도토리를 앞으로 차 보내며 화면 끝까지
  // 쫓아다니는 무한 추격이 있었다(2026-09-04 실측: 90초 동안 run만).
  function shove(x: number, y: number, R: number, F: number, leavesOnly = false) {
    for (const o of leaves) {
      if (leavesOnly && o.sp === ACORN) continue;
      const dx = o.x - x;
      const dy = o.y - y;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.01 && o.fall === 0) {
        const k = (1 - d / R) * F;
        o.vx += (dx / d) * k;
        o.vy += (dy / d) * k;
        o.va += (rand() - 0.5) * 3;
        if (o.lift < 0.3) o.lift = 0.3;
      }
    }
  }
  function land(l: Leaf) {
    if (l.sp === ACORN) {
      const a = rand() * TAU;
      const sp = 70 + rand() * 90;
      l.vx = Math.cos(a) * sp;
      l.vy = Math.sin(a) * sp;
      l.va = (rand() - 0.5) * 8;
      l.lift = 0.6;
      shove(l.x, l.y, 46, 120);
    } else {
      l.vx = (rand() - 0.5) * 30;
      l.vy = (rand() - 0.5) * 30;
    }
  }
  /** 땅에 놓인(떨어지는 중·옅어지는 중이 아닌) 가장 가까운 도토리 인덱스, 없으면 -1. */
  function nearestAcorn(x: number, y: number): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      if (l.sp !== ACORN || l.fade > 0 || l.fall > 0) continue;
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
  /** r 안의 가장 가까운 묻은 자리 인덱스, 없으면 -1. */
  function nearestCache(x: number, y: number, r: number): number {
    let best = -1;
    let bd = r;
    for (let i = 0; i < caches.length; i++) {
      const d = Math.hypot(caches[i].x - x, caches[i].y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
  const inHot = (f: Frame, x: number, y: number) => !!f.hot && x >= f.hot.x && x <= f.hot.x + f.hot.w && y >= f.hot.y && y <= f.hot.y + f.hot.h;
  /** 분산 저장 자리 — 다른 저장소와 180px↑, 포인터와 220px↑, 가장자리 40px 안쪽, 핫 존 밖. 후보 12개, 없으면 null. */
  function pickCacheSpot(f: Frame): [number, number] | null {
    if (w < 120 || h < 120) return null;
    for (let k = 0; k < 12; k++) {
      const x = 40 + rand() * (w - 80);
      const y = 40 + rand() * (h - 80);
      if (inHot(f, x, y)) continue;
      if (f.p.inside && Math.hypot(x - f.p.x, y - f.p.y) < 220) continue;
      if (caches.some((c) => Math.hypot(c.x - x, c.y - y) < 180)) continue;
      return [x, y];
    }
    return null;
  }
  /** 묻으러 간다 — 자리가 없으면 false(호출 쪽이 leave). */
  function goCache(f: Frame, t: number): boolean {
    if (!squirrel) return false;
    const spot = pickCacheSpot(f);
    if (!spot) return false;
    squirrel.tx = spot[0];
    squirrel.ty = spot[1];
    squirrel.phase = "cache";
    squirrel.t0 = t;
    return true;
  }
  function beginDig(t: number, kind: DigKind) {
    if (!squirrel) return;
    squirrel.dig = kind;
    squirrel.phase = "dig";
    squirrel.t0 = t;
    squirrel.specksLeft = 6 + Math.floor(rand() * 5);
    squirrel.nextSpeck = t + 0.05;
  }
  /** 흙알갱이 — 앞발(코 앞 14px)에서 몸 뒤쪽으로 튄다. */
  function spawnSpeck(s: Squirrel) {
    const back = s.dir + Math.PI + (rand() - 0.5) * 0.9;
    const v = 90 + rand() * 110;
    specks.push({ x: s.x + Math.cos(s.dir) * 14, y: s.y + Math.sin(s.dir) * 14, vx: Math.cos(back) * v, vy: Math.sin(back) * v, life: 1 });
  }
  function startSquirrel(t: number) {
    // 가장자리는 좌·우·아래 셋뿐 — 위로 드나들면 지평선을 넘어 "언덕 위 하늘로 사라진다"(2026-09-04 소유자).
    const e = Math.floor(rand() * 3);
    const x = e === 0 ? -40 : e === 1 ? w + 40 : rand() * w;
    const y = e === 2 ? h + 40 : groundY(rand());
    const target = nearestAcorn(x, y);
    let phase: SqPhase = "run";
    let tx = w * (0.2 + rand() * 0.6);
    // 먼 띠(v < 0.28)는 화면에서 거의 안 움직이는 곳이라 목표로 잡지 않는다 — 지평선 쪽으로 몰리지 않게.
    let ty = groundY(0.32 + rand() * 0.6);
    if (target >= 0) {
      tx = leaves[target].x;
      ty = leaves[target].y;
    } else if (caches.length && rand() < 0.5) {
      // 회수 — 땅에 도토리가 없으면 절반은 기억 속 저장소로 간다.
      const c = caches[Math.floor(rand() * caches.length)];
      tx = c.x;
      ty = c.y;
      phase = "retrieve";
    }
    squirrel = {
      x,
      y,
      dir: Math.atan2(ty - y, tx - x),
      phase,
      tx,
      ty,
      t0: t,
      target,
      carry: false,
      ph: rand() * TAU,
      dig: "cache",
      fakes: 0,
      taken: 0,
      nextPause: t + 2 + rand() * 2,
      pauseDur: 0,
      prev: phase,
      wps: [],
      specksLeft: 0,
      nextSpeck: 0
    };
    squirrels++;
  }
  /** 가장 가까운 출구로 나간다. zigzag = 도망: 출구 방향에 수직으로 ±60px 어긋난 경유점 둘(1/3·2/3 지점, 번갈아)을 거친다. */
  function squirrelLeave(t: number, zigzag = false) {
    if (!squirrel) return;
    const s = squirrel;
    // 출구도 좌·우·아래만(위 = 하늘). 땅짐승은 지평선 너머로 걸어 나가지 않는다.
    const exits: [number, number][] = [
      [-60, s.y],
      [w + 60, s.y],
      [s.x, h + 60]
    ];
    exits.sort((a, b) => Math.hypot(a[0] - s.x, a[1] - s.y) - Math.hypot(b[0] - s.x, b[1] - s.y));
    const [ex, ey] = exits[0];
    s.wps = [];
    if (zigzag) {
      const dx = ex - s.x;
      const dy = ey - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      const side = rand() < 0.5 ? 1 : -1;
      s.wps.push([s.x + dx / 3 + nx * 60 * side, s.y + dy / 3 + ny * 60 * side]);
      s.wps.push([s.x + (dx * 2) / 3 - nx * 60 * side, s.y + (dy * 2) / 3 - ny * 60 * side]);
    }
    s.wps.push([ex, ey]);
    [s.tx, s.ty] = s.wps.shift()!;
    s.phase = "leave";
    s.t0 = t;
  }
  /** 도망 — 지그재그로 나간다(물고 있던 도토리는 그대로). 이미 나가는 중이면 무시. */
  function squirrelFlee(t: number) {
    if (!squirrel || squirrel.phase === "leave") return;
    flees++;
    squirrelLeave(t, true);
  }

  function targetCount(f: Frame) {
    const areaK = clamp((f.w * f.h) / 1_440_000, 0.55, 1.5);
    return Math.round(lerp(26, 220, f.load) * areaK);
  }
  const liveLeaves = () => leaves.reduce((n, l) => n + (l.sp !== ACORN && l.fade === 0 ? 1 : 0), 0);

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      bake();
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr || gav !== groundArt.version) bakeGround(f.dpr);
      const n = targetCount(f);
      if (!filled) {
        while (leaves.length < n) leaves.push(spawn(f.t));
        filled = true;
      }
      if (grabbed >= leaves.length) grabbed = -1;
      for (const l of leaves) {
        if (l.x > w + l.s) l.x = rand() * w;
        if (l.y > h + l.s || l.y < gy() - l.s) l.y = groundY(rand());
      }
      // 화면 밖으로 밀려난 저장소는 잊는다(찾을 수 없는 흙더미를 남기지 않는다).
      for (let i = caches.length - 1; i >= 0; i--) if (caches[i].x > w || caches[i].y > h) caches.splice(i, 1);
    },
    step(f) {
      const { dt, t, p, load } = f;
      const target = targetCount(f);
      const live = liveLeaves();
      if (live < target && t > nextSpawn) {
        leaves.push(spawn(t, true));
        nextSpawn = t + 0.12;
      } else if (live > target + 3 && t > nextTrim) {
        let far = -1;
        let fd = -1;
        for (let i = 0; i < leaves.length; i++) {
          const l = leaves[i];
          if (l.sp === ACORN || l.fade > 0 || i === grabbed || l.fall > 0) continue;
          const d = p.inside ? Math.hypot(l.x - p.x, l.y - p.y) : rand() * 1000;
          if (d > fd) {
            fd = d;
            far = i;
          }
        }
        if (far >= 0) leaves[far].fade = 0.001;
        nextTrim = t + clamp((0.35 * 30) / (live - target), 0.07, 0.35);
      }
      if (load >= 0.4 && t > nextAcorn) {
        dropAcorn(t);
        nextAcorn = t + 15 + rand() * 25;
      }
      // 다람쥐 — 여력 0.5부터, 30~70초 간격(첫 손님은 16~24초).
      if (!squirrel && load >= 0.5 && t > nextSquirrel) startSquirrel(t);
      if (squirrel) {
        const s = squirrel;
        // 위협 지각 — 도망 개시 거리는 접근 속도에 따라 늘어난다(util.threat): 가만히·천천히(rate<60) 오면 70px까지 두고, 90px
        // 안이면 무조건, 220px 안에서 220px/s↑로 오거나 300px 안에서 loom(접근속도÷거리) 3.5↑면 튄다. 옛 규칙은 고정 100px.
        if (s.phase !== "leave") {
          const th = threat(p, s.x, s.y);
          const spooked = th.rate < 60 ? th.d < 70 : th.d < 90 || (th.rate > 220 && th.d < 220) || (th.loom > 3.5 && th.d < 300);
          if (spooked) squirrelFlee(t);
        }
        if (s.phase === "sniff") {
          if (t - s.t0 > 1.2) {
            if (s.target >= 0 && s.target < leaves.length && leaves[s.target].sp === ACORN && leaves[s.target].fade === 0) {
              // 도토리는 **지금** 입으로 옮겨진다(바닥에서 즉시 사라지고 다람쥐 앞에 그려진다) — 옛 구현은 0.7초 흐려지며
              // 남아 "안 가져갔는데 도토리가 녹는다"로 보였다.
              leaves.splice(s.target, 1);
              if (grabbed === s.target) grabbed = -1;
              else if (grabbed > s.target) grabbed--;
              s.target = -1;
              s.carry = true;
              s.fakes = 0;
              s.taken++;
              stolen++;
              s.phase = "grab";
              s.t0 = t;
            } else squirrelLeave(t);
          }
        } else if (s.phase === "grab") {
          s.ph += dt * 26; // 물고 한 번 통통
          if (t - s.t0 > 0.45) {
            // 분산 저장 — 65%(여력 .5↑)는 묻으러 가고, 나머지는 물고 그냥 나간다.
            if (!(rand() < 0.65 && load >= 0.5 && goCache(f, t))) squirrelLeave(t);
          }
        } else if (s.phase === "dig") {
          // 파기 — 앞발로 잎을 헤치고(반경 40) 흙알갱이를 뒤로 튀긴다(6~10개, 0.7초에 걸쳐).
          shove(s.x, s.y, 40, 30 * dt * 60, true);
          if (s.specksLeft > 0 && t > s.nextSpeck) {
            spawnSpeck(s);
            s.specksLeft--;
            s.nextSpeck = t + 0.07;
          }
          if (t - s.t0 > 0.7) {
            if (s.dig === "cache") s.phase = "bury";
            else if (s.dig === "fake") {
              // 속임수 — 묻지 않고 다지는 시늉만.
              s.phase = "pat";
              s.t0 = t;
            } else {
              // 회수 — 기억한 자리를 파 도토리를 문다. 사용자가 먼저 파 갔으면 빈손.
              const ci = nearestCache(s.x, s.y, 30);
              if (ci >= 0) {
                caches.splice(ci, 1);
                s.carry = true;
                s.fakes = 0;
                retrieved++;
              }
              if (!(s.carry && rand() < 0.3 && goCache(f, t))) squirrelLeave(t);
            }
          }
        } else if (s.phase === "bury") {
          // 묻기(즉시) — 도토리를 앞발 자리에 놓고 흙더미를 남긴다. 저장소는 최대 8, 오래된 것부터 잊는다.
          s.carry = false;
          // 흙더미는 땅 위에만 — 지평선 부근이면 안개에 떠 보인다. 아래로 끌어당긴다.
          caches.push({ x: s.x + Math.cos(s.dir) * 12, y: Math.max(groundY(0.3), s.y + Math.sin(s.dir) * 12), t });
          while (caches.length > CACHE_MAX) caches.shift();
          s.phase = "pat";
          s.t0 = t;
        } else if (s.phase === "pat") {
          s.ph += dt * 26; // 다지기 — 잡을 때처럼 통통
          if (t - s.t0 > 0.35) {
            if (s.dig === "fake") {
              if (!goCache(f, t)) squirrelLeave(t);
            } else {
              s.phase = "look";
              s.t0 = t;
            }
          }
        } else if (s.phase === "look") {
          // 경계 — 두리번(고개 ±0.3rad, draw). 끝나면 도토리가 더 있고 이번 방문 3개 미만이면 다음 도토리로.
          if (t - s.t0 > 0.6) {
            const n = s.taken < 3 ? nearestAcorn(s.x, s.y) : -1;
            if (n >= 0) {
              s.target = n;
              s.tx = leaves[n].x;
              s.ty = leaves[n].y;
              s.phase = "run";
              s.t0 = t;
            } else squirrelLeave(t);
          }
        } else if (s.phase === "pause") {
          // 얼어붙기 — 몸은 멈추고 꼬리만 떤다(draw). 포인터가 200px 안이면 도망.
          if (p.inside && Math.hypot(s.x - p.x, s.y - p.y) < 200) squirrelFlee(t);
          else if (t - s.t0 > s.pauseDur) s.phase = s.prev;
        } else {
          // run · cache · retrieve · leave — 목표로 달린다.
          // 노리는 도토리가 굴러가면(던져지면) 따라간다.
          if (s.phase === "run" && s.target >= 0 && s.target < leaves.length && leaves[s.target].sp === ACORN) {
            s.tx = leaves[s.target].x;
            s.ty = leaves[s.target].y;
          }
          // 경계 — 달리는 중 2~4초마다 20%로 0.3~0.6s 멈춘다(도망 중엔 안 멈춘다).
          if (s.phase !== "leave" && t > s.nextPause) {
            s.nextPause = t + 2 + rand() * 2;
            if (rand() < 0.2) {
              s.prev = s.phase;
              s.phase = "pause";
              s.t0 = t;
              s.pauseDur = 0.3 + rand() * 0.3;
              pauses++;
            }
          }
          if (s.phase !== "pause") {
            const dx = s.tx - s.x;
            const dy = s.ty - s.y;
            const d = Math.hypot(dx, dy);
            const sp = s.phase === "leave" ? 300 : 250;
            const arrive = s.phase === "leave" && s.wps.length ? 24 : 6; // 지그재그 경유점은 모서리를 깎듯 지난다
            if (d < arrive) {
              if (s.phase === "run") {
                s.phase = "sniff";
                s.t0 = t;
              } else if (s.phase === "cache") {
                // 속임수 묻기(Steele et al. 2008) — 파려는 순간 누가 보고 있으면(포인터 260px 안) 시늉만(도토리당 최대 2번).
                const watched = threat(p, s.x, s.y).d < 260;
                if (watched && s.fakes < 2) {
                  s.fakes++;
                  fakes++;
                  beginDig(t, "fake");
                } else beginDig(t, "cache");
              } else if (s.phase === "retrieve") beginDig(t, "retrieve");
              else if (s.wps.length) [s.tx, s.ty] = s.wps.shift()!;
              else {
                squirrel = null;
                nextSquirrel = t + 30 + rand() * 40;
              }
            } else {
              const want = Math.atan2(dy, dx);
              const diff = angleDiff(want, s.dir);
              s.dir += clamp(diff, -5 * dt, 5 * dt);
              // 몸이 목표 쪽을 향할 때까지는 제자리에서 돈다(휙 순간 회전 대신 돌아서는 동작).
              if (Math.abs(diff) < 0.7) {
                // 원근 — 멀리 있을수록 화면에서 느리게(같은 걸음도 지평선 쪽에선 픽셀이 덜 움직인다).
                const step = Math.min(d, sp * dt * moveScale(s.y, h));
                s.x += Math.cos(s.dir) * step;
                s.y += Math.sin(s.dir) * step;
                s.ph += dt * 22;
                shove(s.x, s.y, 44, 60 * dt * 60, true);
              } else s.ph += dt * 8;
            }
          }
        }
      }
      // 흙알갱이 — 짧게 날다 멎고 0.6초에 스러진다.
      if (specks.length) {
        const speckFr = Math.pow(0.03, dt);
        for (let i = specks.length - 1; i >= 0; i--) {
          const k = specks[i];
          k.x += k.vx * dt;
          k.y += k.vy * dt;
          k.vx *= speckFr;
          k.vy *= speckFr;
          k.life -= dt / 0.6;
          if (k.life <= 0) specks.splice(i, 1);
        }
      }
      // 회오리 — 여력 0.6부터, 25~60초 간격, 4.5초. 반경 170 안의 잎이 접선 방향으로 돌며 떠오른다.
      if (!whirl && load >= 0.6 && t > nextWhirl) {
        const e = Math.floor(rand() * 4);
        const x = e === 0 ? -80 : e === 1 ? w + 80 : rand() * w;
        const y = e === 2 ? gy() - 80 : e === 3 ? h + 80 : groundY(rand());
        const tx = w * (0.3 + rand() * 0.4);
        const ty = groundY(0.3 + rand() * 0.4);
        const d = Math.hypot(tx - x, ty - y) || 1;
        whirl = { x, y, vx: ((tx - x) / d) * 95, vy: ((ty - y) / d) * 95, t0: t, dur: 4.5 };
        whirls++;
      }
      if (whirl) {
        const e = (t - whirl.t0) / whirl.dur;
        if (e >= 1) {
          whirl = null;
          nextWhirl = t + 25 + rand() * 35;
        } else {
          whirl.x += whirl.vx * dt;
          whirl.y += whirl.vy * dt;
        }
      }
      const gk = lerp(0.35, 1, load);
      if (!gust && t > nextGust) gust = { t0: t, dur: 3 + rand() * 1.8, dir: rand() < 0.5 ? -1 : 1, y: groundY(rand()) };
      if (gust && t - gust.t0 > gust.dur) {
        gust = null;
        // 바람 부는 날(날짜 시드 날씨)엔 돌풍이 두 배 잦다.
        nextGust = t + (lerp(22, 7, load) + rand() * lerp(14, 9, load)) * (f.weather.now === "wind" ? 0.45 : 1);
      }
      const front = gust ? (gust.dir > 0 ? -240 + ((t - gust.t0) / gust.dur) * (w + 480) : w + 240 - ((t - gust.t0) / gust.dur) * (w + 480)) : 0;
      const pushy = p.inside && p.speed > 30;
      const groundFr = Math.pow(0.02, dt);
      const acornFr = Math.pow(0.1, dt);
      const spinFr = Math.pow(0.04, dt);
      const wEnv = whirl ? Math.sin(Math.PI * clamp((t - whirl.t0) / whirl.dur, 0, 1)) : 0;
      for (let i = leaves.length - 1; i >= 0; i--) {
        const l = leaves[i];
        if (l.fade > 0) {
          l.fade += dt / 0.7;
          if (l.fade >= 1) {
            leaves.splice(i, 1);
            if (grabbed === i) grabbed = -1;
            else if (grabbed > i) grabbed--;
            if (squirrel && squirrel.target > i) squirrel.target--;
            else if (squirrel && squirrel.target === i) squirrel.target = -1;
            continue;
          }
        }
        if (l.fall > 0) {
          const dur = l.sp === ACORN ? 0.9 : 1.3;
          l.fall = Math.max(0, l.fall - dt / dur);
          if (l.sp !== ACORN) {
            l.x += Math.sin(t * 3.1 + l.ph) * 34 * dt;
            l.a += Math.sin(t * 2.2 + l.ph) * 1.6 * dt;
          } else l.a += 3 * dt;
          if (l.fall === 0) land(l);
          continue;
        }
        if (i === grabbed) {
          gox *= 0.88;
          goy *= 0.88;
          const tx = p.x + gox;
          const ty = p.y + goy;
          l.vx = (tx - l.x) * 18;
          l.vy = (ty - l.y) * 18;
          l.x += l.vx * dt;
          l.y += l.vy * dt;
          l.va *= 0.9;
          l.a += l.va * dt + (l.vx * 0.0006 + l.vy * 0.0004) * dt * 3;
          l.lift = 1;
          continue;
        }
        const acorn = l.sp === ACORN;
        let fx = acorn ? 0 : 4 * Math.sin(l.y * 0.011 + t * 0.5);
        let fy = acorn ? 0 : 3 * Math.cos(l.x * 0.009 + t * 0.37);
        if (gust) {
          const d = (l.x - front) / 240;
          const e = Math.exp(-d * d) * (1 - clamp(Math.abs(l.y - gust.y) / (h * 1.3), 0, 0.85));
          if (e > 0.02) {
            const G = (acorn ? 90 : 560) * e * gk;
            fx += G * gust.dir;
            fy += G * 0.22 * Math.sin(l.x * 0.02 + l.y * 0.013);
            if (!acorn) {
              l.va += e * (rand() - 0.5) * 9;
              if (l.lift < e * 0.55) l.lift = e * 0.55;
              if (e > 0.4 && l.flipV === 0 && rand() < 0.03) l.flipV = 5 + rand() * 3;
            }
          }
        }
        if (whirl && !acorn) {
          const dx = l.x - whirl.x;
          const dy = l.y - whirl.y;
          const d = Math.hypot(dx, dy);
          const R = 170;
          if (d < R && d > 0.01) {
            const k = Math.pow(1 - d / R, 1.2) * wEnv;
            const nx = dx / d;
            const ny = dy / d;
            fx += (-ny * 900 - nx * 140) * k;
            fy += (nx * 900 - ny * 140) * k;
            l.va += k * (rand() - 0.5) * 8;
            if (l.lift < k * 0.95) l.lift = k * 0.95;
            if (k > 0.5 && l.flipV === 0 && rand() < 0.08) l.flipV = 7 + rand() * 3;
          }
        }
        if (pushy) {
          const dx = l.x - p.x;
          const dy = l.y - p.y;
          const d = Math.hypot(dx, dy);
          const R = lerp(110, 170, load) + l.s * 0.6;
          if (d < R && d > 0.001) {
            const k = (1 - d / R) * gk * (acorn ? 0.25 : 1);
            const sp = clamp(p.speed, 0, 2600);
            const push = k * sp * 1.05;
            const nx = dx / d;
            const ny = dy / d;
            fx += nx * push + p.vx * 0.45 * k - ny * sp * 0.18 * k;
            fy += ny * push + p.vy * 0.45 * k + nx * sp * 0.18 * k;
            l.va += k * (rand() - 0.5) * 18;
            if (!acorn) {
              if (l.lift < k * 0.8) l.lift = k * 0.8;
              if (k > 0.5 && l.flipV === 0 && rand() < 0.1) l.flipV = 6 + rand() * 3;
            }
            if (k > 0.3) windCount++;
          }
        }
        l.vx += fx * dt;
        l.vy += fy * dt;
        const fr = acorn ? acornFr : groundFr;
        l.vx *= fr;
        l.vy *= fr;
        l.va *= spinFr;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.a += l.va * dt + (acorn ? Math.hypot(l.vx, l.vy) * 0.02 * dt : 0);
        const m = l.s;
        if (l.x < -m) l.x += w + 2 * m;
        else if (l.x > w + m) l.x -= w + 2 * m;
        // 세로 랩은 땅(지평선~아래) 안에서 — 위로 날아간 잎은 아래에서 다시 들어온다(지평선 띠 = 먼 곳, 잎이 놓이지 않는다).
        const top = gy();
        if (l.y < top + m * 0.4) l.y += h - top + m; // 지평선 위로는 못 올라간다 — 아래에서 다시 들어온다
        else if (l.y > h + m) l.y -= h - top + m;
      }
      for (const l of leaves) {
        if (l.lift > 0 && l.fall === 0) l.lift = Math.max(0, l.lift - dt * 1.6);
        if (l.flipV > 0) {
          l.flip += l.flipV * dt;
          if (l.flip >= Math.PI) {
            l.flip = 0;
            l.flipV = 0;
          }
        }
      }
      if (f.q > 0) {
        for (let i = 0; i < leaves.length; i++) {
          const a = leaves[i];
          if (a.fall > 0) continue;
          const ra = a.s * 0.32;
          for (let j = i + 1; j < leaves.length; j++) {
            const b = leaves[j];
            if (b.fall > 0) continue;
            const dx = b.x - a.x;
            if (dx > 80 || dx < -80) continue;
            const dy = b.y - a.y;
            if (dy > 80 || dy < -80) continue;
            const min = ra + b.s * 0.32;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 < 0.0001) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const ov = (min - d) * 0.5;
            const aFixed = i === grabbed;
            const bFixed = j === grabbed;
            if (!aFixed) {
              a.x -= nx * ov * (bFixed ? 2 : 1);
              a.y -= ny * ov * (bFixed ? 2 : 1);
            }
            if (!bFixed) {
              b.x += nx * ov * (aFixed ? 2 : 1);
              b.y += ny * ov * (aFixed ? 2 : 1);
            }
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              const imp = -rv * 0.45;
              if (!aFixed) {
                a.vx -= nx * imp;
                a.vy -= ny * imp;
                a.va += (rand() - 0.5) * imp * 0.02;
              }
              if (!bFixed) {
                b.vx += nx * imp;
                b.vy += ny * imp;
                b.va += (rand() - 0.5) * imp * 0.02;
              }
            }
          }
        }
      }
    },
    draw(g, f) {
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      // 3/4 시점의 지평선 띠(위 12%) — 먼 언덕·작은 나무 줄·안개. 바탕 위, 모든 것 아래.
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 서리 안개 — 안개 낀 날(11월에 잦다)은 더 깊이 내려온다.
      const fogK = f.weather.now === "fog" ? 1.7 : 1;
      const mistH = f.h * 0.34 * (f.weather.now === "fog" ? 1.6 : 1);
      const mist = g.createLinearGradient(0, 0, 0, mistH);
      mist.addColorStop(0, `rgb(234 238 242 / ${Math.min(0.7, 0.42 * fogK)})`);
      mist.addColorStop(0.5, `rgb(234 238 242 / ${Math.min(0.4, 0.16 * fogK)})`);
      mist.addColorStop(1, "rgb(234 238 242 / 0)");
      g.fillStyle = mist;
      g.fillRect(0, 0, f.w, mistH);
      // 연대기 — 지난 해들의 나무(위 헤지로우), 이번 가을의 결정적 저장소 흙더미(살아 있는 다람쥐의 저장소와 별개).
      if (traceBakes) drawTraces(g, f, "autumn", traceBakes);
      // 흙더미 — 바탕 위, 잎 **아래**(잎이 덮을 수 있다 — 찾는 게 놀이). 묻은 직후 0.6초에 걸쳐 드러난다.
      if (moundSpr && caches.length) {
        for (const c of caches) {
          g.save();
          g.globalAlpha = clamp((f.t - c.t) / 0.6, 0, 1) * depthFade(c.y, f.h);
          flatXform(g, c.x, c.y, depthScale(c.y, f.h));
          g.drawImage(moundSpr, -11, -7);
          g.restore();
        }
      }
      const drawLeaf = (l: Leaf, shadow: boolean) => {
        const acorn = l.sp === ACORN;
        if (acorn && (!acornSpr || !acornShadow)) return;
        const up = l.fall > 0 ? Math.pow(l.fall, 0.8) : l.lift;
        // 3/4 시점: 위(멀다)는 작게, 바닥에 누운 잎은 세로로 눌린다(떨어지는 중·들린 잎은 안 눌림).
        const ds = depthScale(l.y, f.h);
        const k = (acorn ? l.s / 40 : (l.s / SPR) * 1.4) * (1 + up * (l.fall > 0 ? 1.4 : 0.12)) * ds;
        const sq = l.fall > 0 || l.lift > 0.5 ? 1 : GROUND_SQUASH;
        const sx = l.flipV > 0 ? Math.cos(l.flip) : 1;
        // 거리 흐림 — 다람쥐만 옅어지고 도토리·낙엽은 그대로면 괴리가 생긴다(2026-09-04 소유자).
        const alpha = (1 - l.fade) * depthFade(l.y, f.h);
        g.save();
        if (shadow) {
          g.globalAlpha = (l.fall > 0 ? 0.08 + 0.1 * (1 - l.fall) : 0.16 + up * 0.12) * alpha;
          g.translate(l.x + 2.5 + up * (l.fall > 0 ? 34 : 8), l.y + 3.5 + up * (l.fall > 0 ? 40 : 10));
        } else {
          g.globalAlpha = (l.fall > 0 ? 0.55 + 0.45 * (1 - l.fall) : 1) * alpha;
          g.translate(l.x, l.y);
        }
        g.scale(1, sq);
        g.rotate(l.a);
        if (acorn) {
          g.scale(k, k);
          if (shadow) g.drawImage(acornShadow!, -22, -26);
          else g.drawImage(acornSpr!.c, -20, -26, 40, 52);
        } else {
          g.scale(k * sx, k);
          g.drawImage(shadow ? shadows[l.sp] : sprites[l.sp][l.col], -SPR / 2, -SPR / 2);
        }
        g.restore();
      };
      for (let i = 0; i < leaves.length; i++) if (i !== grabbed && leaves[i].fall === 0) drawLeaf(leaves[i], true);
      for (let i = 0; i < leaves.length; i++) if (i !== grabbed && leaves[i].fall === 0) drawLeaf(leaves[i], false);
      if (grabbed >= 0 && grabbed < leaves.length) {
        drawLeaf(leaves[grabbed], true);
        drawLeaf(leaves[grabbed], false);
      }
      // 흙알갱이 — 작은 갈색 점, 스러지며 옅어진다.
      for (const k of specks) {
        g.fillStyle = `rgb(96 74 52 / ${(clamp(k.life, 0, 1) * 0.85).toFixed(2)})`;
        g.beginPath();
        g.arc(k.x, k.y, 1.6, 0, TAU);
        g.fill();
      }
      // 다람쥐 — 달릴 땐 몸이 위아래로 통통, 물고 갈 땐 머리 앞에 도토리. 단계별 몸짓: sniff 킁킁 · dig 앞발질 · grab/pat 통통 ·
      // look 두리번(±0.3) · pause 얼어붙어 꼬리 떨기(±0.2).
      if (squirrel && squirrelSpr) {
        const s = squirrel;
        const running = s.phase === "run" || s.phase === "cache" || s.phase === "retrieve" || s.phase === "leave";
        const hop = s.phase === "grab" || s.phase === "pat";
        const bounce = running ? Math.abs(Math.sin(s.ph)) : hop ? Math.abs(Math.sin(s.ph)) * 1.3 : s.phase === "dig" ? Math.abs(Math.sin(f.t * 16)) * 0.35 : 0;
        const wig =
          s.phase === "sniff"
            ? Math.sin(f.t * 12) * 0.12
            : s.phase === "dig"
              ? Math.sin(f.t * 30) * 0.07
              : s.phase === "look"
                ? Math.sin(f.t * 5) * 0.3
                : s.phase === "pause"
                  ? Math.sin(f.t * 20) * 0.2
                  : 0;
        const sds = depthScale(s.y, f.h) * (SIZE.chipmunk / 52); // 3/4 시점 거리 축소 × 축척(52 → 36)
        if (sqShadow) {
          g.save();
          g.globalAlpha = 0.3;
          g.translate(s.x + 4 + 6 * bounce, s.y + 10 * sds + 8 * bounce);
          g.drawImage(sqShadow, -28 * sds, -22 * sds * GROUND_SQUASH, 56 * sds, 44 * sds * GROUND_SQUASH);
          g.restore();
        }
        // 거리 흐림 — 지평선 쪽 생물은 옅어진다(안개에 잠긴다). 2026-09-04 소유자.
        g.save();
        g.globalAlpha *= depthFade(s.y, f.h);
        drawFacing(g, squirrelSpr, s.x, s.y - 6 * bounce, s.dir, (1 + 0.1 * bounce) * sds, wig);
        g.restore();
        if (s.carry && acornSpr) {
          // 입에 문 도토리 — 코 끝(앞 22px)에, 몸과 같은 각도로.
          g.save();
          g.translate(s.x + Math.cos(s.dir) * 22, s.y + Math.sin(s.dir) * 22 - 6 * bounce);
          g.rotate(s.dir + Math.PI / 2);
          g.drawImage(acornSpr.c, -7, -9, 14, 18);
          g.restore();
        }
      }
      for (const l of leaves) {
        if (l.fall > 0) {
          drawLeaf(l, true);
          drawLeaf(l, false);
        }
      }
    },
    pointerDown(f, onBackground) {
      // 다람쥐를 누르면 놀라 지그재그로 달아난다(어디서든).
      if (squirrel && squirrel.phase !== "leave" && Math.hypot(squirrel.x - f.p.x, squirrel.y - f.p.y) < 30) {
        squirrelFlee(f.t);
        return true;
      }
      if (!onBackground) return false;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        if (l.fall > 0 || l.fade > 0) continue;
        const d = Math.hypot(l.x - f.p.x, l.y - f.p.y);
        if (d < Math.max(14, l.s * 0.55) && d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) {
        // 찾기 놀이 — 잎이 없는 자리의 흙더미(16px 안)를 누르면 묻힌 도토리가 튀어나온다(잎이 덮고 있으면 먼저 치워야 한다).
        const ci = nearestCache(f.p.x, f.p.y, 16);
        if (ci < 0) return false;
        const c = caches[ci];
        caches.splice(ci, 1);
        pushAcorn(c.x, c.y, 0.5, f.t);
        dugUp++;
        return true;
      }
      grabbed = best;
      gox = leaves[best].x - f.p.x;
      goy = leaves[best].y - f.p.y;
      leaves[best].lift = 1;
      return true;
    },
    pointerUp(f) {
      if (grabbed < 0) return;
      const l = leaves[grabbed];
      if (l) {
        l.vx = f.p.vx * 0.7;
        l.vy = f.p.vy * 0.7;
        l.va += (rand() - 0.5) * 6;
        if (l.sp !== ACORN && Math.hypot(l.vx, l.vy) > 500 && l.flipV === 0) l.flipV = 7;
      }
      grabbed = -1;
    },
    debug() {
      return {
        leaves: leaves.length,
        live: liveLeaves(),
        falling: leaves.filter((l) => l.fall > 0).length,
        fading: leaves.filter((l) => l.fade > 0).length,
        acorns: leaves.filter((l) => l.sp === ACORN).length,
        acornsDropped,
        acornSprite: !!acornSpr,
        ground: !!ground,
        squirrel: squirrel ? [Math.round(squirrel.x), Math.round(squirrel.y), squirrel.phase, squirrel.carry ? 1 : 0] : null,
        sqPhase: squirrel ? squirrel.phase : null,
        squirrels,
        squirrelSprite: !!squirrelSpr,
        stolen,
        caches: caches.map((c) => [Math.round(c.x), Math.round(c.y)]),
        fakes,
        dugUp,
        retrieved,
        flees,
        pauses,
        whirl: whirl ? [Math.round(whirl.x), Math.round(whirl.y)] : null,
        whirls,
        grabbed,
        gust: !!gust,
        wind: windCount,
        species: SPECIES.map((_, i) => leaves.filter((l) => l.sp === i).length),
        pos: leaves.map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.s)])
      };
    }
  };
}
