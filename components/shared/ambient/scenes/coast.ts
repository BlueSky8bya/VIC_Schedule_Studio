// 해안 셋(2026-09-04, PLAN-004 §3.6) — 갯벌(tidal)·모래해안(sandy)·암석해안(rocky). 공통 골격: 3/4 시점의 수평선(위 12%) 아래 바다가 화면
// 36%까지 내려오고, 그 아래 2/3가 뭍… 이 아니라 **위 1/3 뭍 + 아래 2/3 바다**? — 소유자 ⓪ "바닷가는 바다만 보여도 된다"를 따르되, 해안은
// 뭍이 있어야 해안이다: 3/4 시점에선 관찰자가 뭍에 서서 바다를 보는 구도가 자연스러워 **뭍이 아래(가까움), 바다가 위(멀리, 수평선까지)**.
// 파도는 수평선에서 내려와 물가 선(화면 64%)에 닿아 거품이 되고, 젖은 모래 띠가 숨쉬듯 넓어졌다 좁아진다.
//  · tidal: 뻘(어두운 회갈색·젖은 광택)·물골·게 구멍 점 — 밀물·썰물은 세계 시간 띠(새벽·저녁 썰물 → 뻘 넓음).
//  · sandy: 모래(밝은 크림)·조개·유목(아트가 있을 때만)·발자국은 P2.
//  · rocky: 검은 바위(rock 자리 대체물)·물웅덩이(밝은 타원)·물보라(파도가 바위에 부딪힐 때 흰 점 몇 개).
// 생물(게·갈매기·가마우지·소라게)은 P2 에이전트. 규칙: 바탕 한 번 굽기, 매 프레임 stroke/작은 fill만.

import type { Frame, Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { ArtSet } from "../art/load";
import { claimSpot, drawProp, drawSubmerged, propShadow, propSpots, resetPropField } from "../art/props";
import { currentLight, shadowKey } from "../world/light";
import { bakeClouds, bakeSky, drawSky, drawSkyLive, skyKey } from "../world/sky";
import { groundYAt, horizonY, depthScale, GROUND_SQUASH, bakeHorizon } from "../world/view";
import { bakeWater, drawGlints, drawRainRings, drawTrail, drawWaterLight, drawWaves, newTrail, stepRainRings, stepTrail, waterPalette, type RainRing } from "./water";

export type CoastMode = "tidal" | "sandy" | "rocky";

// 계절마다 다른 배치(2026-09-04 소유자) — 같은 시드면 네 계절이 색만 다른 한 장이다.
const SEASON_SEED: Record<SeasonKey, number> = { spring: 0, summer: 977, autumn: 1861, winter: 2749 };


// 물가 선(정규화) — 그 아래가 뭍. **실제 사진 비율**(2026-09-04 조사): 갯벌은 바다가 가느다란 띠(3~5%)이고
// 뻘이 화면의 58~63%, 모래해안은 바다 22~26%·모래 38%, 암석해안은 바다 30~35%·바위 25~32%.
// 옛 0.64 하나로는 셋 다 "물 반 땅 반"이라 갯벌이 갯벌로 안 읽혔다.
// 2026-09-06(하늘 확대): 화면 분수가 아니라 **지평선 아래 땅에서의 비율**로 적는다. 화면 분수로 두면
// hz가 .12 → .26으로 오를 때 바다 띠(hz~물가 선)가 22% → 6%로 눈 깜짝할 사이에 사라진다. 값은 옛 비율 그대로
// 환산한 것((0.34−0.12)/0.88 등) — 물·묍의 상대 비율은 유지되고 하늘만 넓어진다.
// 갯벌만 0.25 → **0.08**(2026-09-06 라운드 9, 검토 B 두 라운드 연속): 규격은 "뻘이 화면 58~63%, 바다는 위 띠 3~5%"인데
// 실측 바다 띠가 화면 22.0% / 18.3%로 대여섯 배였다. 하늘 확대 때 옛 비율을 그대로 환산한 것이 화근 — 갯벌은
// 애초에 "바다가 멀리 물러난 땅"이라 다른 두 해안과 규격 자체가 다르다. 비어난 세로 공간은 배수망·건열이 갖는다.
const SEA_GV_BY: Record<CoastMode, number> = { tidal: 0.08, sandy: 0.295, rocky: 0.386 };
// 뭍 캔버스 여분 — 물가 선이 조석·숨·만곡으로 최대 ±(0.06h + 34)px 움직인다. 정적 shoreY()로 높이를 잡으면
// 화면 맨 아래에 물이 새어 나온다(2026-09-04 검토 1차: "해안마다 바닥에 파란 실선").
const PAD = 140;
// 물가 선의 **정적** 낙차(x별) — `draw()`의 `lineY(x)`에서 t 항(숨쉬기 ±2.5px)만 뺀 것. 뭍 캔버스를 이 값만큼
// 열 단위로 밀어 구워야 조류대·물보라·표착선·자갈이 물가 곡선을 따라간다(2026-09-06 라운드 7, 검토 B #6:
// "물가 선은 44px 굽는데 조류대 아래 경계는 y 414±1 직선"). 두 곳이 같은 식을 쓰지 않으면 다시 어긋난다.
export function shoreOffsetAt(x: number, mode: CoastMode): number {
  const mp = mode === "tidal" ? 0 : mode === "sandy" ? 2.1 : 4.2;
  const cusp = mode === "sandy" ? Math.sin(x * 0.026 + 1.1) * 7 + Math.sin(x * 0.052 + 0.3) * 2.5 : 0;
  return Math.sin(x * 0.0021 + 0.7 + mp) * 22 + Math.sin(x * 0.0067 + 2.1 + mp * 1.3) * 9 + cusp;
}
// 뭍 바탕은 계절을 탄다 — 옛 코드는 mode만 봐서 네 계절의 해안이 한 장이었다.
const LAND_COLORS: Record<CoastMode, Record<SeasonKey, [string, string]>> = {
  tidal: {
    // 실제 한국 갯벌은 물막이 하늘을 비춰 **은회색~회녹색**이다(초콜릿 갈색이 가장 흔한 오류, 2026-09-04 조사).
    spring: ["#9aa0a2", "#7b8184"],
    summer: ["#8e8f91", "#6f7275"],
    autumn: ["#8c9391", "#6c7476"],
    winter: ["#a8aeb1", "#878e91"]
  },
  sandy: {
    spring: ["#e2ddc6", "#d2cdb2"],
    summer: ["#f0e6c2", "#e0d3a6"],
    autumn: ["#dbd2b8", "#c6bc9c"],
    winter: ["#dfe4ea", "#bcc4cd"]
  },
  rocky: {
    spring: ["#a4b0ac", "#889692"],
    summer: ["#aeb2b0", "#929896"],
    autumn: ["#a3a29c", "#878882"],
    winter: ["#bcc6ce", "#9ea9b2"]
  }
};

export function createCoast(seed: number, opts: { season: SeasonKey; mode: CoastMode }): Scene {
  const rand = rng(seed);
  const { season, mode } = opts;
  let w = 0;
  let h = 0;
  let water: HTMLCanvasElement | null = null;
  let land: HTMLCanvasElement | null = null;
  // 물가 띠 바위 층(2026-09-06 라운드 13, 우선순위 D — 검토 B 라운드 10 #3 · 라운드 13 #1~#4): 뭍 판(`land`)은 물가 폴리곤으로
  // **클립**되어 물가 띠에 선 바위의 윗부분이 물가선에서 잘리고(물이 돌 앞에), 거품 줄·흰 원반이 몸통을 덮어 "반투명 사다리꼴 판"이 됐다.
  // 꼭대기(발 y − 30k)가 밀물선 위로 올라올 수 있는 바위는 전부 판 밖 **별도 층**에 굽는다. 물가선은 띠마다 조석으로 ±0.02h 움직이므로
  // 층은 **조석 상태(−1/0/+1)별로** 다시 굽고(`bakeShoreRocks`), 그 조석의 물가선 기준으로 발이 물속이면 `rocksSea`(잠김 + 링, 거품 줄 **앞**에
  // 그려 물가 거품이 돌을 지난다), 뭍 위면 `rocksLand`(마른 돌 + 그림자, 거품 줄 **뒤**). 둘 다 y 정렬, 클립 없음.
  let rocksSea: HTMLCanvasElement | null = null;
  let rocksLand: HTMLCanvasElement | null = null;
  let rocksTide = Number.NaN;
  // 조석 **연속값**(라운드 13, C #4): `tide(f)`는 띠 스텝(−1/0/+1)이라 띠 전환 첫 100ms에 물가선이 17~18px 순간이동했다(조명은 3s lerp).
  // step()에서 τ 3s로 따라간다. 첫 프레임은 목표값으로 시작 — 캡처(띠 고정)는 상수라 결정성이 그대로다.
  let tideK = Number.NaN;
  let rocksArt = -1;
  let shoreRocks: { x: number; y: number; k: number; r1: number; f: boolean }[] = [];
  let lcW = 0;
  let lcH = 0;
  let skyC: HTMLCanvasElement | null = null; // 하늘 판(라운드 5) — 계절 × 날씨
  let skyKeyCur = "";
  // 흐르는 구름 두 층(라운드 6 결정 4) — 폭 2w 타일, 오프셋은 t의 순수 함수라 캡처는 여전히 결정적이다.
  let cloudC: { far: HTMLCanvasElement; near: HTMLCanvasElement } | null = null;
  let horizon: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const glints: { x: number; y: number; ph: number; r: number }[] = [];
  const spray: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  // 빗방울 고리(2026-09-06 라운드 14, 우선순위 B — A #1 · B #2 · C: 비가 물에 닿는 자국이 민물 못 말고는 하나도 없었다).
  // 물가선 `lineY(x)` 위(= 바다 쪽)에만 나고, 크기·밀도는 원근을 따른다.
  const rings: RainRing[] = [];
  let rainRings = 0;
  let windDir = 1;
  const trail = newTrail();
  const art = new ArtSet(["rock", "log", "reed", "pebble", "shell-clam", "starfish", "driftwood", "tree-pine", "tree-pine-autumn", "tree-pine-winter"], {
    scaleOf: { "tree-pine": 3, "tree-pine-autumn": 3, "tree-pine-winter": 3 }
  });
  let av = -1;
  let gsh = ""; // 바탕에 구운 소품 그림자의 조명 키(라운드 4) — 달라지면 한 번 다시 굽는다
  const pal = waterPalette(season);
  const top = () => horizonY(h);
  const shoreY = () => groundYAt(SEA_GV_BY[mode], h);
  // 조석(갯벌) — 새벽·저녁 썰물(뻘 넓음), 점심 밀물. 물가 선이 ±6% 움직인다.
  const tide = (f: Frame) => {
    const b = f.time.band;
    const k = 1; // 셋이 같은 바다를 본다 — 모드별로 다르면 이웃 화면과 수면 높이가 어긋난다
    return (b === "dawn" || b === "evening" || b === "night" ? 1 : b === "noon" ? -1 : 0) * k;
  };

  // 물가 띠 바위 층(라운드 13, B #1~#4 + A #1) — 조석 상태 `tv`(−1 밀물 · 0 · +1 썰물)의 물가선(로컬, 전단 전 = draw()의 `sy − ly`, 숨쉬기 ±5.5 제외)
  // 기준으로 발이 물속이면 잠김(깊이 = 6 + .5·잠긴 폭, 4~18k) + 뒤 반원 링 + 발 앞 거품 조각 → `rocksSea`(거품 줄 앞), 뭍 위면 마른 돌 + 그림자 →
  // `rocksLand`(거품 줄 뒤). 판과 같은 로컬 프레임, 앵커 x의 `shoreOffsetAt` 하나로만 내려 열 전단 없이 선다. y 정렬(먼 것부터).
  function bakeShoreRocks(tv: number, dpr: number) {
    rocksSea = null;
    rocksLand = null;
    rocksTide = tv;
    rocksArt = art.version;
    if (!shoreRocks.length || !lcW) return;
    const WL = 60 + 0.02 * h * (1 - tv);
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = lcW;
      c.height = lcH;
      const cg = c.getContext("2d")!;
      cg.scale(dpr, dpr);
      return { c, cg };
    };
    const sea = mk();
    const lnd = mk();
    let nSea = 0;
    let nLand = 0;
    for (const rk of [...shoreRocks].sort((a2, b2) => a2.y - b2.y)) {
      const ry = rk.y + shoreOffsetAt(rk.x, mode);
      const d = WL - rk.y; // > 0 = 발이 이 조석의 물속(바다 쪽), ≤ 0 = 뭍 위(마른 돌)
      if (d > 0) {
        const cg = sea.cg;
        nSea++;
        // 뒤(위) 반원 물살은 바위 **앞**에 그린다 — 뒤에 그리면 몸통을 가로질러 접시 테가 된다(2026-09-06 라운드 9, 검토 B).
        // 앞 반원은 `drawSubmerged`가 소품 폭에 맞춰 안에서 긋는다. 물 위 돌엔 지면 그림자 타원을 두지 않는다(수면에 그림자 원반 = 떠 있는 돌).
        cg.strokeStyle = "rgb(252 254 255 / 0.38)";
        cg.lineWidth = 1.6 + 1.2 * rk.k;
        cg.beginPath();
        cg.ellipse(rk.x, ry + 2, 19 * rk.k, 6 * rk.k, 0, Math.PI * 1.05, TAU - 0.15);
        cg.stroke();
        const sub = drawSubmerged(cg, art, "rock", rk.x, ry, {
          k: rk.k,
          r: rk.r1,
          flip: rk.f,
          depth: clamp(6 + 0.5 * d, 4, 18 * rk.k), // 잠긴 폭에 비례(B #3) — 옛 고정 min(16, 9k)은 밀물엔 "물 위에 얹힌 돌", 썰물엔 마른 판 위 링이었다
          water: "44 52 50", // 조류대 색
          wet: 0.3,
          alphaDeep: 0.16
        });
        if (!sub) drawProp(cg, art, "rock", rk.x, ry, { k: rk.k, r: rk.r1, flip: rk.f });
        // 흰 물살 원반(15k α .2)은 **삭제**(A #1 조건 ①: 소프트 원반은 크기와 무관하게 렌즈 먼지 — F-1; B: 반지름 45~70px가 몸통을 덮어 "판"의
        // 절반을 만들었다). 대신 발 앞 물가에 2px 격자 거품 조각 셋(≤ 6k, α ≤ .3) — 파도가 돌에 부딪혀 남는 자국.
        const fw = Math.max(2, Math.round(rk.k));
        const seeds = [rk.r1, (rk.r1 * 7.31) % 1, (rk.r1 * 13.7) % 1];
        for (let i = 0; i < 3; i++) {
          const sx = rk.x + (seeds[i] - 0.5) * 22 * rk.k;
          const sy2 = ry + 2 + ((seeds[(i + 1) % 3] * 3) | 0) * fw;
          const len = fw * (2 + ((seeds[(i + 2) % 3] * 3) | 0));
          cg.fillStyle = `rgb(250 253 255 / ${(0.22 + seeds[i] * 0.08).toFixed(3)})`;
          cg.fillRect(Math.round(sx / fw) * fw, Math.round(sy2 / fw) * fw, len, fw);
        }
      } else {
        const cg = lnd.cg;
        nLand++;
        propShadow(cg, rk.x + 3 * rk.k, ry - 1, 22 * rk.k, 0.18, GROUND_SQUASH * 0.5, "58 64 68");
        drawProp(cg, art, "rock", rk.x, ry, { k: rk.k, r: rk.r1, flip: rk.f });
      }
    }
    rocksSea = nSea ? sea.c : null;
    rocksLand = nLand ? lnd.c : null;
  }

  function bake(dpr: number) {
    water = bakeWater(w, h, top(), dpr, pal, seed, true, season === "winter" ? "#e8eef4" : "#eef5fa");
    // 뭍 — 모드별 바탕(아래 36%).
    const lc = document.createElement("canvas");
    lc.width = Math.max(1, Math.ceil(w * dpr));
    lc.height = Math.max(1, Math.ceil((h - shoreY() + 60 + PAD) * dpr));
    lcW = lc.width;
    lcH = lc.height;
    // 물가 띠 한계(로컬 y, 전단 전): 밀물(조석 −1) 물가선 60 + 0.04h에 숨쉬기 ±5.5 — 꼭대기(발 − 30k)가 이 위면 클립이 자를 수 있다(B 라운드 13 #1:
    // 옛 기준 `발 y < 110`은 k 2.7~3의 큰 뭍 바위 셋(꼭대기가 물가선 위 22~50px)을 놓쳤다).
    const shoreLim = 60 + 0.04 * h + 6;
    shoreRocks = [];
    rocksTide = Number.NaN;
    const g = lc.getContext("2d")!;
    g.scale(dpr, dpr);
    const r = rng(seed * 7 + 3 + SEASON_SEED[season]);
    resetPropField();
    const H = h - shoreY() + 60 + PAD;
    const VIS = H - PAD;
    // 뭍 띠 안의 원근 — 전역 depthScale은 이 좁은 띠에서 0.85~1.0밖에 안 움직여 원근이 안 읽힌다(검토 4차).
    const landK = (yLocal: number) => 0.6 + 0.4 * Math.max(0, Math.min(1, (yLocal - 40) / Math.max(1, VIS - 60))); // 화면에 실제로 보이는 뭍의 높이 — 소품은 전부 이 안에(검토 2차: 던 그래스 16개가 전부 화면 밖이었다)
    const base = LAND_COLORS[mode][season];
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, base[0]);
    grad.addColorStop(1, base[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, H);
    // 물 마스크(QA 라운드 2 B#1, P0): 갯벌은 물골 폴리곤을 자리 필드에 등록하지 않아 바위·조개·게 구멍이 물 한복판에
    // 마른 채 서 있었다. 물골 중심선 거리 ≤ hw + 6px 이면 물 — 소품·조개·구멍·해조·조약돌은 전부 이 밖에만 놓는다.
    let inWater: (x: number, y: number) => boolean = () => false;
    if (mode === "tidal") {
      // 물막이 하늘을 비춘다 — 갯벌이 갈색이 아니라 은빛으로 보이는 이유(물가 쪽이 가장 밝다).
      {
        const mg = g.createLinearGradient(0, 58, 0, VIS * 0.9);
        mg.addColorStop(0, "rgb(206 216 222 / 0.5)");
        mg.addColorStop(0.45, "rgb(196 206 214 / 0.22)");
        mg.addColorStop(1, "rgb(190 200 208 / 0)");
        g.fillStyle = mg;
        g.fillRect(0, 58, w, VIS);
        for (let i = 0; i < 14; i++) softBlob(g, r() * w, 70 + r() * (VIS - 110), 60 + r() * 150, "212 222 228", 0.16, 0, GROUND_SQUASH);
      }
      // 갯골(2026-09-04, 실제 갯벌 조사 반영) — 물골은 **배수망**이다: 바다 쪽이 하구라 **바다로 갈수록 넓어진다**
      // (Strahler 차수가 오를수록 폭·길이 증가; 한국 갯벌 본류 200~900m, 잔가지 2~30m). 여기서는 화면 위가 바다이므로
      // 세계 폭은 바다 쪽으로 커지고, 원근 축소(landK)를 곱해도 화면에서 바다 끝이 3~4배 넓게 남는다.
      // 가지치기 비율 ≈ 3.5, 차수 3~4단이면 충분. 굽이는 작은 가지일수록 심하다(사행도 1.0 → 1.42).
      const chanPts: { x: number; y: number; hw: number }[][] = [];
      const chanOrder: number[] = [];
      /** 물골 하나 — (sx,sy) 육지 끝에서 (ex,ey) 바다/합류점까지. QA 라운드 2(AMB-S5-01, 라운드 1 #4 "직선 현 + 단일 사인 + 등폭
       *  리본, 3차 지류 갈고리, 본류 꺾임"): 굽이는 **두 옥타브 + 결정적 흔들림**이고 진폭·파수가 **길이에 비례**한다(짧은
       *  지류가 큰 사인을 타면 갈고리가 된다) → Chaikin 한 번으로 꺾임을 없앤다. 폭은 바다 쪽으로 멱함수로 넓어지고(하구 3~4배,
       *  Strahler) 구간마다 ±14% 숨 쉬어 등폭 리본이 아니다. 양 끝은 0으로 수렴해 합류가 확실하다. */
      const chan = (sx: number, sy: number, ex: number, ey: number, order: number, ph: number) => {
        const raw: { x: number; y: number; t: number }[] = [];
        const n2 = order === 3 ? 30 : order === 2 ? 20 : 12;
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const amp = Math.min(60, len * (order === 3 ? 0.085 : order === 2 ? 0.1 : 0.11));
        const waves = Math.max(0.7, len / (order === 3 ? 320 : order === 2 ? 190 : 150));
        const jit = amp * 0.2;
        for (let k2 = 0; k2 <= n2; k2++) {
          const t2 = k2 / n2; // 0 = 육지, 1 = 바다·합류점
          const taper = Math.pow(Math.sin(Math.PI * t2), 0.8); // 양 끝 0
          const wob =
            (Math.sin(t2 * Math.PI * waves + ph) * 0.68 + Math.sin(t2 * Math.PI * waves * 2.3 + ph * 1.9) * 0.32) * amp * taper +
            (r() - 0.5) * jit * taper;
          raw.push({ x: sx + dx * t2 + nx * wob, y: sy + dy * t2 + ny * wob, t: t2 });
        }
        // Chaikin 한 번(끝점 유지) — 각진 마디가 굽이로 풀린다.
        const sm: { x: number; y: number; t: number }[] = [];
        for (let i = 0; i < raw.length - 1; i++) {
          const a = raw[i];
          const b = raw[i + 1];
          if (i === 0) sm.push(a);
          sm.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25, t: a.t * 0.75 + b.t * 0.25 });
          sm.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, t: a.t * 0.25 + b.t * 0.75 });
          if (i === raw.length - 2) sm.push(b);
        }
        const pts = sm.map((p, i) => {
          const t2 = p.t;
          // 세계 폭은 바다 쪽으로 3~4배(실제 배수망), 화면 폭 = 세계 폭 × 원근. 멱 1.5~1.7 = 하구 근처에서 급히 넓어진다.
          const world = order === 3 ? 7 + 96 * Math.pow(t2, 1.7) : order === 2 ? 5 + 32 * Math.pow(t2, 1.6) : 2.5 + 13 * Math.pow(t2, 1.5);
          // 양 끝은 폭 0으로 수렴 — 뭉툭한 사각 끝은 "죽은 리본"으로 읽힌다(사이클4 경계 #3).
          const cap = Math.min(1, i / 4) * Math.min(1, (sm.length - 1 - i) / 3);
          const breath = 0.86 + 0.28 * (0.5 + 0.5 * Math.sin(t2 * 17 + ph * 3));
          // 말단 폭 하한 0.4 → 2(2026-09-06 라운드 7, 검토 B #8: 지류 끝이 물 한복판에서 바늘 끝으로 끝났다).
          return { x: p.x, y: p.y, hw: Math.max(2, world * landK(p.y) * cap * breath) };
        });
        chanPts.push(pts);
        chanOrder.push(order);
        return pts;
      };
      /** 두 선분 교차 판정(끝점 공유는 제외). 물골은 **합류 외에 교차하지 않는다**(BIOME_GRAMMAR §7). */
      const segX = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
        const d1 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const d2 = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
        const d3 = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
        const d4 = (d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x);
        return d1 * d2 < 0 && d3 * d4 < 0;
      };
      /** 이미 놓인 물골의 중심선과 교차하는가(합류점 부근 6마디는 제외 — 거기서 만나는 건 합류다). */
      const crossesExisting = (pts: { x: number; y: number }[]) => {
        for (let i = 2; i < pts.length - 6; i++) {
          for (const other of chanPts) {
            if (other === pts) continue;
            for (let j = 2; j < other.length - 3; j++) {
              if (segX(pts[i], pts[i + 1], other[j], other[j + 1])) return true;
            }
          }
        }
        return false;
      };
      /** 지류 놓기 — 교차하면 반대쪽·다른 길이로 최대 4번 다시 뽑는다(그래도 교차하면 그 지류는 없다). */
      const tryChan = (mk: (attempt: number) => { sx: number; sy: number; ex: number; ey: number; order: number; ph: number }) => {
        for (let a = 0; a < 4; a++) {
          const q = mk(a);
          const pts = chan(q.sx, q.sy, q.ex, q.ey, q.order, q.ph);
          if (!crossesExisting(pts)) return pts;
          chanPts.pop();
          chanOrder.pop();
        }
        return null;
      };
      // 배수망은 **비대칭 한 벌**이다: 큰 본류 하나가 화면을 비스듬히 가로지르고, 작은 본류 하나가 반대쪽에서
      // 짧게 들어와 다른 지점으로 빠진다. 옛 구조(폭 0.3·0.7에 같은 길이의 수직 본류 둘)는 세 검토자 모두
      // "사람 다리 두 짝 / 타일 반복"으로 읽었다(검토 라운드2). 하구는 위(바다)이므로 위로 갈수록 넓다.
      const outletBase = 0.24 + r() * 0.2; // 큰 갯골이 바다로 빠지는 자리
      let mainPts: { x: number; y: number; hw: number }[] = [];
      {
        // ① 큰 본류 — 육지 쪽 시작점과 하구의 x가 크게 다르다(대각선). 이것만으로 "수직 기둥"이 사라진다.
        const ex = w * outletBase;
        const sx = ex + w * (0.2 + r() * 0.22);
        const main = chan(sx, VIS + 60, ex, 30, 3, 0.4);
        mainPts = main;
        for (let b2 = 0; b2 < 3; b2++) {
          const at = Math.round(main.length * (0.2 + 0.26 * b2 + r() * 0.08));
          const node = main[Math.min(main.length - 1, at)];
          if (!node) continue;
          const side0 = b2 === 1 ? 1 : -1;
          const run0 = 70 + r() * 130; // 길이를 크게 흩는다(옛 90~180은 지류가 서로 복제로 보였다)
          const rise0 = 0.5 + r() * 0.7;
          const sub = tryChan((a) => ({
            sx: node.x + (a % 2 === 0 ? side0 : -side0) * run0 * (1 - a * 0.12),
            sy: node.y + run0 * rise0 * (1 - a * 0.1),
            ex: node.x,
            ey: node.y,
            order: 2,
            ph: b2 * 1.7 + a * 0.6
          }));
          if (!sub) continue;
          for (let c2 = 0; c2 < 2; c2++) {
            const at2 = Math.round(sub.length * (0.28 + 0.34 * c2 + r() * 0.12));
            const n3 = sub[Math.min(sub.length - 1, at2)];
            if (!n3) continue;
            const s3 = c2 % 2 === 0 ? -1 : 1;
            const run2 = 30 + r() * 70;
            const rise2 = 0.5 + r() * 0.6;
            tryChan((a) => ({
              sx: n3.x + (a % 2 === 0 ? s3 : -s3) * run2 * (1 - a * 0.14),
              sy: n3.y + run2 * rise2,
              ex: n3.x,
              ey: n3.y,
              order: 1,
              ph: b2 + c2 * 1.3 + a * 0.5
            }));
          }
        }
      }
      {
        // ② 작은 본류 — 반대쪽 뭍에서 들어와 **큰 본류의 중간에 합류**한다. 하구 근처에서 나란히 내려오면
        // 두 줄기가 "다리 두 짝/위시본"으로 읽힌다(사이클4 미관 #2 재발).
        const jn = mainPts[Math.max(1, Math.round(mainPts.length * (0.42 + r() * 0.18)))];
        const main2 = chan(w * (0.8 + r() * 0.14), Math.min(VIS + 20, jn.y + 150 + r() * 120), jn.x, jn.y, 2, 2.6);
        for (let b2 = 0; b2 < 2; b2++) {
          const at = Math.round(main2.length * (0.3 + 0.32 * b2 + r() * 0.1));
          const node = main2[Math.min(main2.length - 1, at)];
          if (!node) continue;
          const run2 = 34 + r() * 56;
          const rise3 = 0.5 + r() * 0.6;
          tryChan((a) => ({
            sx: node.x + ((b2 ? 1 : -1) * (a % 2 === 0 ? 1 : -1)) * run2,
            sy: node.y + run2 * rise3,
            ex: node.x,
            ey: node.y,
            order: 1,
            ph: b2 * 2.2 + a * 0.7
          }));
        }
      }
      inWater = (x, y) => {
        for (const pts of chanPts) {
          for (let j = 0; j < pts.length; j += 2) {
            const p = pts[j];
            const dx = x - p.x;
            const dy = y - p.y;
            const rr = p.hw + 6;
            if (dx * dx + dy * dy < rr * rr) return true;
          }
        }
        return false;
      };
      /** 물골 그리기 — kw = 폭 배, minOrder = 이 차수 이상만, (ox, oy) = 비껴 그리기(둔치 한쪽 그늘).
       *  한 path에 전부 모아 **한 번만** 칠한다 — 채널마다 fill하면 겹치는 구간이 곱해져 X자 얼룩이 된다(검토 라운드2 경계 #2).
       *  stroke = 젖은 가장자리 — **두 둔치를 열린 선으로** 긋고 끝 캡은 긋지 않는다(옛 닫힌 외곽선은 하구·합류점에서 물을
       *  가로지르는 밝은 선이 됐다 — 라운드 1 #4 "stroke가 물 위 가로지름"). */
      const drawChan = (kw: number, col: string, stroke = false, minOrder = 1, ox = 0, oy = 0, pathOnly = false) => {
        const side = (pts: { x: number; y: number; hw: number }[], jj: number, s: number): [number, number] => {
          const a2 = pts[Math.max(0, jj - 1)];
          const b2 = pts[Math.min(pts.length - 1, jj + 1)];
          const len = Math.hypot(b2.x - a2.x, b2.y - a2.y) || 1;
          const nx = -(b2.y - a2.y) / len;
          const ny = (b2.x - a2.x) / len;
          const hw = pts[jj].hw * kw;
          return [pts[jj].x + s * nx * hw + ox, pts[jj].y + s * ny * hw + oy];
        };
        if (!pathOnly) g.beginPath();
        chanPts.forEach((pts, ci) => {
          if (pts.length < 8 || chanOrder[ci] < minOrder) return;
          if (stroke) {
            for (const s of [1, -1]) {
              for (let jj = 3; jj < pts.length - 3; jj++) {
                const [x, y] = side(pts, jj, s);
                if (jj === 3) g.moveTo(x, y);
                else g.lineTo(x, y);
              }
            }
            return;
          }
          for (let jj = 0; jj < pts.length; jj++) {
            const [x, y] = side(pts, jj, 1);
            if (jj === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          for (let jj = pts.length - 1; jj >= 0; jj--) {
            const [x, y] = side(pts, jj, -1);
            g.lineTo(x, y);
          }
          g.closePath();
        });
        if (pathOnly) return; // 클립용 — 칠하지 않고 path만 남긴다
        if (stroke) {
          g.strokeStyle = col;
          g.lineWidth = 1.2;
          g.stroke();
        } else {
          g.fillStyle = col;
          g.fill();
        }
      };
      // 물길 표현은 셋뿐이다: **둔치(한쪽으로 비낀 그늘 한 겹)** → **물(폴리곤 채움)** → **젖은 가장자리(두 둔치 선)**.
      // 오프셋 폴리곤을 여러 겹 **동심**으로 겹치면 등폭 리본이 되고 굽이에서 자기교차한다(검토 라운드2·라운드 1 #4).
      // 둔치 그늘은 오른쪽 아래로 3·2px 비껴 한 겹 — 깎인 둔치의 그늘로 읽힌다. 구간별 스트로크는 lineCap:round 탓에
      // 구간마다 큰 원이 찍혀 "겹친 검은 얼룩"이 된다(사이클5 미관 #1) — 폴리곤 한 겹만.
      drawChan(1.3, "rgb(58 62 60 / 0.13)", false, 1, 3, 2);
      drawChan(1, "rgb(66 84 96 / 0.62)");
      // 잔류수 — 본류·2차 물골 바닥에만(1차 잔가지는 물이 빠져 젖은 뻘만 남는다 — 폭 절반의 동심 띠가 세 겹이면 리본이다).
      drawChan(0.5, season === "winter" ? "rgb(96 124 146 / 0.5)" : "rgb(88 112 126 / 0.45)", false, 2);
      // 젖은 가장자리 — 두 둔치 선(끝 캡 없음). **물 밖으로 클립**한다(2026-09-06 라운드 7, 검토 B #8:
      // 겹친 리본의 가장자리 획이 본류 물 위를 대각선으로 지나 와이어프레임이 됐다). 큰 사각 + 물 폴리곤을
      // even-odd로 클립하면 "물이 아닌 곳"만 남는다 — 획은 자기 물골의 둔치에만 그려진다.
      g.save();
      g.beginPath();
      g.rect(-20, -20, w + 40, H + 40);
      drawChan(1, "", false, 1, 0, 0, true); // 같은 폴리곤을 path에만 얹는다
      g.clip("evenodd");
      drawChan(1.04, "rgb(206 220 228 / 0.3)", true);
      g.restore();
      // 소품 군집 — 갯벌의 생물 흔적은 **밭**을 이룬다(균등 산포는 잡티로 읽힌다, 사이클4 미관 #2).
      for (let c2 = 0; c2 < 4; c2++) {
        const cx3 = r() * w;
        const cy3 = 90 + r() * (VIS - 140);
        const kind = c2 % 2;
        for (let i = 0; i < 30; i++) {
          const a2 = r() * TAU;
          const d = Math.pow(r(), 0.6) * (50 + r() * 70);
          const x = cx3 + Math.cos(a2) * d;
          const y = cy3 + Math.sin(a2) * d * GROUND_SQUASH;
          if (inWater(x, y)) continue; // 조개·숨구멍은 물 안에 없다(라운드 2 P0)
          const k = landK(y);
          if (kind === 0) {
            // 조개 숨구멍 — 작은 어두운 점 + 그 둘레의 밝은 흙 테.
            g.fillStyle = `rgb(226 232 234 / ${0.2 + r() * 0.2})`;
            g.beginPath();
            g.ellipse(x, y, 4 * k, 2.4 * k, 0, 0, TAU);
            g.fill();
            g.fillStyle = `rgb(46 50 50 / ${0.3 + r() * 0.3})`;
            g.beginPath();
            g.ellipse(x, y, 1.5 * k, 1 * k, 0, 0, TAU);
            g.fill();
          } else {
            // 굴 껍데기 — 흰 파편이 무더기로.
            g.fillStyle = `rgb(238 240 236 / ${0.4 + r() * 0.4})`;
            g.save();
            g.translate(x, y);
            g.rotate(r() * TAU);
            g.beginPath();
            g.ellipse(0, 0, (2.4 + r() * 3) * k, (1.4 + r() * 1.6) * k, 0, 0, TAU);
            g.fill();
            g.restore();
          }
        }
      }
      // 계절 — 갯벌은 색이 아니라 **표면 상태**로 계절을 말한다(검토 라운드2 미관 #1).
      if (season === "winter") {
        // 결빙 — 물골 가장자리와 웅덩이에 살얼음(밝은 각진 판)과 성에.
        drawChan(1.16, "rgb(226 238 246 / 0.34)");
        for (let i = 0; i < 90; i++) {
          const x = r() * w;
          const y = 70 + r() * (VIS - 110);
          g.fillStyle = `rgb(236 244 250 / ${0.2 + r() * 0.3})`;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 4 + r() * 8, y - 1 - r() * 3);
          g.lineTo(x + 6 + r() * 10, y + 2 + r() * 3);
          g.closePath();
          g.fill();
        }
      } else if (season === "spring") {
        // 조수 웅덩이 — 하늘을 비추는 밝은 얕은 물이 여기저기.
        for (let i = 0; i < 16; i++) {
          const x = r() * w;
          const y = 80 + r() * (VIS - 130);
          const rx = 12 + r() * 26;
          softBlob(g, x, y, rx, "196 214 226", 0.4, 0, GROUND_SQUASH);
          g.strokeStyle = "rgb(236 244 248 / 0.35)";
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(x, y, rx * 0.7, rx * 0.7 * GROUND_SQUASH, 0, 0, TAU);
          g.stroke();
        }
      } else if (season === "summer") {
        // 젖은 뻘의 광택 — 넓고 낮은 하늘 반사 띠(가장 더운 철에 물이 가장 얇게 남는다).
        for (let i = 0; i < 10; i++) softBlob(g, r() * w, 80 + r() * (VIS - 140), 70 + r() * 140, "182 200 210", 0.18, 0, GROUND_SQUASH * 0.6);
      } else {
        // 가을 — 마른 해조·검불이 물골 둔치에 걸린다.
        for (let i = 0; i < 70; i++) {
          const x = r() * w;
          const y = 80 + r() * (VIS - 130);
          g.strokeStyle = `rgb(104 86 62 / ${0.2 + r() * 0.3})`;
          g.lineWidth = 1 + r();
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + 6, y + 2, x + 10 + r() * 12, y + (r() - 0.5) * 5);
          g.stroke();
        }
      }
      // 갈라진 뻘(펄) — 순수 펄에는 잔물결이 아니라 **건열 다각형**(장축 평균 37cm). 위(바다) 쪽 모래질엔 없다.
      {
        const cell = 30;
        g.lineWidth = 1;
        // 시작 줄이 전폭 직선이면 그 자리에서 격자가 뚝 켜져 "와이어프레임 층"이 된다(사이클4 경계 #3).
        // 시작 높이를 x마다 흩고, 위쪽 100px에 걸쳐 서서히 짙어지게 한다.
        const crackTop = (x: number) => VIS * 0.36 + Math.sin(x * 0.0037 + 1.1) * VIS * 0.07 + Math.sin(x * 0.011) * VIS * 0.03;
        for (let gy2 = VIS * 0.26; gy2 < VIS - 10; gy2 += cell) {
          for (let gx = 0; gx < w; gx += cell) {
            const ct = crackTop(gx);
            if (gy2 < ct) continue;
            const fade = Math.min(1, (gy2 - ct) / 110);
            g.strokeStyle = `rgb(120 110 92 / ${0.1 * fade})`;
            if (r() < 0.42) continue; // 띄엄띄엄 — 다 이으면 격자무늬가 된다
            const jx = (r() - 0.5) * cell * 0.9;
            const jy = (r() - 0.5) * cell * 0.9;
            g.beginPath();
            g.moveTo(gx + jx, gy2 + jy);
            g.lineTo(gx + cell + (r() - 0.5) * cell * 0.5, gy2 + (r() - 0.5) * cell * 0.5);
            g.moveTo(gx + jx, gy2 + jy);
            g.lineTo(gx + (r() - 0.5) * cell * 0.5, gy2 + cell + (r() - 0.5) * cell * 0.5);
            g.stroke();
          }
        }
      }
      // 게 구멍 — 실제 갯벌은 **20~80개/m²이지만 지면의 7% 미만**이고, 균일하지 않다: 물골 둔치와 펄이 많은 곳에
      // 몰린다(조사: 쏙 밭 856개/m², 칠게 62개/m², 구멍 지름 6~34mm). 무리 지어 찍고, 위쪽 모래질엔 거의 없다.
      {
        const holeSpots: [number, number][] = [];
        for (const pts of chanPts) {
          for (let jj = 2; jj < pts.length; jj += 2) {
            const n = pts[jj];
            for (let s2 = 0; s2 < 6; s2++) {
              const side = s2 % 2 === 0 ? -1 : 1;
              holeSpots.push([n.x + side * (n.hw + 4 + r() * 46), n.y + (r() - 0.5) * 22]);
            }
          }
        }
        for (let i = 0; i < 26; i++) holeSpots.push([r() * w, VIS * (0.45 + r() * 0.5)]);
        for (const [hx, hy] of holeSpots) {
          if (hy < VIS * 0.3 || hy > VIS - 6 || inWater(hx, hy)) continue; // 위(모래질)·화면 밖·물 안 제외
          const k = landK(hy) * (0.85 + r() * 0.4);
          g.fillStyle = "rgb(72 66 58 / 0.32)";
          g.beginPath();
          g.ellipse(hx, hy, 2.2 * k, 1.4 * k, 0, 0, TAU);
          g.fill();
          // 파낸 흙 부스러기 — 구멍 둘레에 부챗살로(실제 갯벌의 표지).
          for (let d = 0; d < 3; d++) {
            softBlob(g, hx + (r() - 0.5) * 9 * k, hy + (r() - 0.5) * 5 * k, 4 * k, "214 206 186", 0.2, 0, GROUND_SQUASH);
          }
        }
      }
      // 갯벌 살림 — 조약돌·작은 바위·해조 무리·조개껍데기. 없으면 뻘은 통짜 갈색 판이다(검토 4차).
      for (let i = 0; i < 46; i++) {
        const px = r() * w;
        const py = 70 + r() * (VIS - 100);
        if (inWater(px, py)) continue;
        drawProp(g, art, "pebble", px, py, { k: 0.9 * landK(py), r: r(), sy: GROUND_SQUASH, rot: r() * TAU });
      }
      // 바위 7개 — 물 안 자리는 다시 뽑는다(최대 6회; 끝내 물이면 그 바위는 없다 — 물 위에 마른 바위보다 낫다).
      for (let i = 0; i < 7; i++) {
        let x = 0;
        let y = 0;
        let ok = false;
        for (let t2 = 0; t2 < 6 && !ok; t2++) {
          x = 40 + r() * (w - 80);
          y = 90 + r() * (VIS - 130);
          ok = !inWater(x, y);
        }
        if (!ok) continue;
        const tk = (0.6 + r() * 0.5) * depthScale(shoreY() - 60 + y, h);
        // 라운드 13(B #4): 갯벌 바위도 필드(실루엣 규칙)를 거치고, 물가 띠에 서면 해안 공통 조석 층으로 — 점심 밀물에 꼭대기 31%가 클립에 잘렸다.
        if (!claimSpot(x, y, 11 * tk, true, 30 * tk)) continue;
        const tr = r();
        const tf = r() < 0.5;
        if (y - 30 * tk < shoreLim) {
          shoreRocks.push({ x, y, k: tk, r1: tr, f: tf });
          continue;
        }
        drawProp(g, art, "rock", x, y, { k: tk, r: tr, flip: tf });
      }
      // 해조 — 젖은 뻘에 붙은 짙은 초록 얼룩 무리(가장자리가 갈라진 느낌으로 여러 겹).
      for (let i = 0; i < 16; i++) {
        const cx3 = r() * w;
        const cy3 = 80 + r() * (VIS - 110);
        if (inWater(cx3, cy3)) continue; // 해조 무리는 둔치·뻘에(물골 물 안 금지)
        for (let k = 0; k < 4; k++) {
          softBlob(g, cx3 + (r() - 0.5) * 46, cy3 + (r() - 0.5) * 22, 10 + r() * 18, r() < 0.5 ? "78 96 70" : "96 106 74", 0.2, 0, GROUND_SQUASH);
        }
      }
      for (let i = 0; i < 10; i++) {
        const x = r() * w;
        const y = 80 + r() * (VIS - 110);
        const k = (0.85 + r() * 0.35) * landK(y);
        propShadow(g, x + 1.5 * k, y + 1.5 * k, 7 * k, 0.16, GROUND_SQUASH, "110 98 74");
        g.fillStyle = "rgb(238 230 212)";
        g.beginPath();
        g.ellipse(x, y, 6 * k, 3.8 * k, r(), 0, TAU);
        g.fill();
        g.strokeStyle = "rgb(160 142 112 / 0.7)";
        g.lineWidth = 0.9;
        g.stroke();
      }
      // 젖은 광택 얼룩 — 뻘이 통짜 갈색 판이 되지 않게.
      for (let i = 0; i < 26; i++) softBlob(g, r() * w, 50 + r() * (VIS - 80), 70 + r() * 190, r() < 0.45 ? "196 208 214" : r() < 0.7 ? "104 98 86" : "138 130 110", 0.16, 0, GROUND_SQUASH);
    } else if (mode === "sandy") {
      // 반사형(reflective) 해빈 단면 — 2026-09-04 웹 레퍼런스. 한국 동해안형 모래해안은 해빈 경사 5.5~10.6°로
      // **가파르고**, 그래서 쇄파대(surf zone)가 없다(파도가 물가에서 바로 부서진다). 화면 문법:
      //   젖은 급경사 전빈(좁다) → **범(berm) 마루** 한 줄 → 평평하고 밝은 후빈(넓다) → 사구 → 해송림.
      // 옛 코드는 젖은 띠가 뭍의 62%라 단면이 없는 "물 반 모래 반" 판이었다.
      const faceH = VIS * 0.24; // 급경사 전빈
      const bermY = 60 + faceH; // 범 마루
      // 3단 — 각 단의 경계가 **범 마루 곡선을 따라간다**. 가로 그라데이션 정지점으로 나누면 전폭 직선이
      // 그어진다(사이클5 경계 #9).
      {
        const bw = (x: number) => Math.sin(x * 0.0024 + 1.2) * 9 + Math.sin(x * 0.009 + 0.4) * 3.5;
        const steps: [number, number, string][] = [
          [0, 0.44, "rgb(128 116 92 / 0.4)"],
          [0.44, 0.78, "rgb(142 130 104 / 0.24)"],
          [0.78, 1, "rgb(150 138 112 / 0.1)"]
        ];
        for (const [a0, a1, col] of steps) {
          g.fillStyle = col;
          g.beginPath();
          for (let x = -10; x <= w + 10; x += 10) {
            const y = 40 + (bermY - 40) * a0 + bw(x) * (0.4 + a0);
            if (x === -10) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          for (let x = w + 10; x >= -10; x -= 10) g.lineTo(x, 40 + (bermY - 40) * a1 + bw(x) * (0.4 + a1));
          g.closePath();
          g.fill();
        }
      }
      // 비치 커습(beach cusp) — 반사형 해빈의 표지. 물이 남는 어두운 초승달 만입과, 굵은 모래가 쌓여
      // 밝게 튀어나온 뿔이 규칙적으로 번갈아 선다. 평행한 가로 띠만 있으면 절대 안 나오는 리듬이다.
      {
        const horns = 5 + Math.floor(r() * 3);
        const step = w / horns;
        for (let i2 = 0; i2 <= horns; i2++) {
          const cx2 = i2 * step;
          softBlob(g, cx2 + step * 0.5, 60 + faceH * 0.4, step * 0.36, "104 94 74", 0.17, 0, GROUND_SQUASH);
          softBlob(g, cx2, 60 + faceH * 0.14, step * 0.19, "255 250 236", 0.22, 0, GROUND_SQUASH);
        }
      }
      // 범 마루 — 전빈과 후빈을 가르는 유일한 선. 밝은 능선 한 줄 + 바로 아래 옅은 그늘.
      {
        g.strokeStyle = "rgb(255 251 240 / 0.42)";
        g.lineWidth = 2;
        g.beginPath();
        for (let x = -10; x <= w + 10; x += 12) g.lineTo(x, bermY + Math.sin(x * 0.0024 + 1.2) * 9 + Math.sin(x * 0.009 + 0.4) * 3.5);
        g.stroke();
        g.strokeStyle = "rgb(126 112 86 / 0.18)";
        g.lineWidth = 4;
        g.beginPath();
        for (let x = -10; x <= w + 10; x += 12) g.lineTo(x, bermY + 4 + Math.sin(x * 0.0024 + 1.2) * 9 + Math.sin(x * 0.009 + 0.4) * 3.5);
        g.stroke();
      }
      // 물결 자국 — 젖은 전빈 안에만(그 아래 후빈은 평평하고 마른 면이다).
      for (let i = 0; i < 7; i++) {
        const y0 = 66 + (i / 7) * faceH * 0.86 + r() * 3;
        g.strokeStyle = `rgb(255 250 236 / ${0.26 - i * 0.028})`;
        g.lineWidth = 1.3;
        // 만 곡선과 같은 파형을 따라간다(가로 직선 격자로 보이지 않게) + 끊어 그린다.
        let pen = false;
        g.beginPath();
        for (let x = -10; x <= w + 10; x += 16) {
          if (Math.sin(x * 0.016 + i * 1.6) + 0.35 * Math.sin(x * 0.034 + i) <= -0.2) { pen = false; continue; }
          const yy = y0 + Math.sin(x * 0.0021 + 0.7) * 22 + Math.sin(x * 0.0067 + 2.1) * 9;
          if (!pen) { g.moveTo(x, yy); pen = true; } else g.lineTo(x, yy);
        }
        g.stroke();
      }
      // 모래 알갱이 — 반사형 해빈은 입자가 **굵다**(그래서 물이 빨리 빠지고 경사가 선다). 알갱이를 키우고 수를 줄인다.
      for (let i = 0; i < Math.round(w / 4); i++) {
        g.fillStyle = r() < 0.5 ? "rgb(255 250 235 / 0.5)" : "rgb(186 170 134 / 0.38)";
        g.beginPath();
        g.arc(r() * w, r() * H, 1.1 + r() * 1.7, 0, TAU);
        g.fill();
      }
      // 조개·조약돌·유목 — 아래(가까움)로 갈수록 크게.
      for (let i = 0; i < 30; i++) {
        const x = r() * w;
        const y = 100 + r() * (VIS - 130);
        const k = (0.85 + r() * 0.35) * landK(y);
        if (!drawProp(g, art, "shell-clam", x, y, { k, r: r(), sy: GROUND_SQUASH, rot: r() * TAU })) {
          propShadow(g, x + 1.5 * k, y + 1.5 * k, 7 * k, 0.18, GROUND_SQUASH, "120 106 78");
          g.fillStyle = "rgb(252 246 234)";
          g.beginPath();
          g.ellipse(x, y, 7 * k, 4.5 * k, r(), 0, TAU);
          g.fill();
          g.strokeStyle = "rgb(168 150 118 / 0.85)";
          g.lineWidth = 1;
          g.stroke();
        }
      }
      for (let i = 0; i < 40; i++) {
        const x = r() * w;
        const y = 100 + r() * (VIS - 130);
        drawProp(g, art, "pebble", x, y, { k: (0.85 + r() * 0.35) * landK(y), r: r(), sy: GROUND_SQUASH, rot: r() * TAU });
      }
      const VH = H - PAD;
      for (let i = 0; i < 3; i++) {
        const x = 80 + r() * (w - 160);
        const y = VH * (0.45 + r() * 0.4);
        const k = 0.9 * landK(y);
        propShadow(g, x + 3 * k, y + 2 * k, 16 * k, 0.13, GROUND_SQUASH, "112 98 72");
        drawProp(g, art, "log", x, y, { k, r: r(), flip: r() < 0.5 });
      }
      // 중경 앵커 — 사구 능선(낮은 밝은 이랑 + 그늘)과 표류목 무리. 상단 45%가 두 개의 평평한 가로 줄무늬로
      // 남아 초점이 없었다(검토 라운드2 미관 #5).
      {
        const dy = bermY + (VIS - bermY) * 0.34;
        const ridgeY = (x: number) => dy + Math.sin(x * 0.0032 + 0.9) * 16 + Math.sin(x * 0.0091 + 2.4) * 7;
        // 능선은 **폭이 있는 언덕**이지 선이 아니다 — 밝은 등마루와 그 아래 그늘, 둘 다 폴리곤으로.
        const band = (dyTop: number, dyBot: number, col: string) => {
          g.fillStyle = col;
          g.beginPath();
          for (let x = -10; x <= w + 10; x += 12) {
            if (x === -10) g.moveTo(x, ridgeY(x) + dyTop);
            else g.lineTo(x, ridgeY(x) + dyTop);
          }
          for (let x = w + 10; x >= -10; x -= 12) g.lineTo(x, ridgeY(x) + dyBot);
          g.closePath();
          g.fill();
        };
        band(-30, 2, "rgb(255 252 242 / 0.3)");
        band(2, 30, "rgb(132 116 90 / 0.22)");
        // 표류목 무리 하나 — 화면의 초점.
        const cx3 = w * (0.3 + r() * 0.4);
        for (let i = 0; i < 4; i++) {
          const x = cx3 + (r() - 0.5) * 150;
          const y = dy + 20 + r() * 60;
          const k = 1.0 + r() * 0.7;
          propShadow(g, x + 4 * k, y - 2, 18 * k, 0.16, GROUND_SQUASH * 0.5, "112 98 72");
          drawProp(g, art, i === 0 ? "log" : "driftwood", x, y, { k, r: r(), flip: r() < 0.5, rot: i === 0 ? 0 : (r() - 0.5) * 0.5 });
        }
      }
      // 표착선(wrack) — 만조선에 밀려 온 해조·나뭇조각 띠. 활동 해빈과 후빈을 가르는 생태 경계다.
      {
        const wy = bermY + 10;
        for (let i = 0; i < 140; i++) {
          const x = r() * w;
          const y = wy + (r() - 0.5) * 22 + Math.sin(x * 0.0026 + 1.2) * 9;
          g.strokeStyle = `rgb(${r() < 0.6 ? "96 84 58" : "120 108 78"} / ${0.3 + r() * 0.4})`;
          g.lineWidth = 1 + r();
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + 5, y + 2, x + 8 + r() * 12, y + (r() - 0.5) * 5);
          g.stroke();
        }
      }
      // 해송(곰솔) 방풍림 — 반사형 모래해안의 후빈·사구 뒤에는 거의 언제나 솔숲 띠가 있다(한국 동해안 표준 경관).
      // 화면 맨 아래(가까움)에서 잘리며 액자를 만든다(동물의 숲 카메라). 사구 풀보다 **먼저** 그려 풀이 앞에 온다.
      {
        // 곰솔은 사구 풀(무릎 높이)의 **10배가 넘는다** — 옛 k 0.75~1.03은 사초의 3배뿐이라 관목 울타리로 읽혔다.
        // 또 등간격·같은 y·같은 크기가 울타리 인상을 굳혔다(검토 라운드2 세 명 모두). 두 무리로 뭉치고,
        // 크기·깊이를 크게 흩고, 서로 겹치게 놓는다.
        const pineId = season === "winter" ? "tree-pine-winter" : season === "autumn" ? "tree-pine-autumn" : "tree-pine";
        const clumps = [
          { c: w * (0.1 + r() * 0.16), n: 5, sp: w * 0.2 },
          { c: w * (0.58 + r() * 0.3), n: 4, sp: w * 0.17 }
        ];
        type P = { x: number; y: number; k: number };
        const belt: P[] = [];
        for (const cl of clumps) {
          for (let i = 0; i < cl.n; i++) {
            belt.push({
              x: cl.c + (r() - 0.5) * cl.sp * 2,
              y: VH * (0.96 + r() * 0.16),
              k: 1.25 + r() * 0.85
            });
          }
        }
        // 무리 사이를 잇는 낮은 몇 그루(띠가 끊겨 보이지 않게, 그러나 작게).
        for (let i = 0; i < 3; i++) belt.push({ x: r() * w, y: VH * (0.86 + r() * 0.08), k: 0.7 + r() * 0.3 });
        // 프레임 **안쪽**으로 올라온 두 그루 — 전부 하단 모서리에 걸려 잘리면 무게가 아래로만 몰린다(미관 #5).
        for (let i = 0; i < 2; i++) belt.push({ x: w * (0.24 + r() * 0.5), y: VH * (0.84 + r() * 0.1), k: 0.95 + r() * 0.35 });
        belt.sort((a2, b2) => a2.y - b2.y); // 뒤가 앞에 가려진다
        for (const t2 of belt) {
          // 밝은 모래 위에서는 그림자가 없으면 "붙여 넣은 스티커"가 된다(사이클5 현실성 #2).
          propShadow(g, t2.x + 10 * t2.k, t2.y - 3, 30 * t2.k, 0.26, GROUND_SQUASH * 0.45, "88 82 62");
          drawProp(g, art, pineId, t2.x, t2.y, { k: t2.k, r: r(), flip: r() < 0.5 });
        }
      }
      // 모래언덕 풀 — 방풍림 **둘레와 앞**에 넓게. 솔숲이 맨 모래 위에 서 있으면 "다른 화면 소품"으로 읽힌다
      // (사이클5 미관 #6). 풀 → 사구 → 솔숲의 식생 계단이 있어야 해변으로 읽힌다.
      for (let i = 0; i < 70; i++) {
        const x = r() * w;
        const y = VH * (0.6 + r() * 0.44);
        drawProp(g, art, "grass-dry", x, y, { k: 0.9 + r() * 1.1, r: r(), flip: r() < 0.5, alpha: 0.75 + r() * 0.25 });
      }
    } else {
      // 시스택 — 옛 절벽 자리를 표시하므로 **바다와 나란히 한 줄**로, 뭍에서 멀수록 작다(흩뿌리면 신호가 죽는다).
      {
        const line = 24 + r() * 16;
        let sx2 = w * (0.08 + r() * 0.12);
        for (let i2 = 0; i2 < 5; i2++) {
          const k = (1.9 - i2 * 0.3) * landK(line);
          const sy2 = line - i2 * 3;
          softBlob(g, sx2 + 4, sy2 + 4, 26 * k, "60 66 70", 0.2, 0, GROUND_SQUASH);
          drawProp(g, art, "rock", sx2, sy2, { k, r: r(), flip: i2 % 2 === 0 });
          // 발치의 흰 물살 고리 — 파도가 늘 같은 자리에서 부서진다.
          g.strokeStyle = "rgb(250 253 255 / 0.5)";
          g.lineWidth = 1.6;
          g.beginPath();
          g.ellipse(sx2, sy2 + 3 * k, 20 * k, 7 * k, 0, 0, TAU);
          g.stroke();
          sx2 += (110 + r() * 90) * (1 - i2 * 0.12);
        }
      }
      {
        // 파도가 부서지는 자리 — 물가 바로 아래에 흰 물보라 얼룩이 흩어진다(없으면 바위와 바다가 그냥 붙어 있다).
        for (let i = 0; i < 34; i++) {
          const x = r() * w;
          const y = 56 + Math.pow(r(), 1.6) * 70;
          softBlob(g, x, y, 8 + r() * 22, "255 255 255", 0.3 + r() * 0.34, 0, GROUND_SQUASH);
        }
      }
      if (season === "winter") {
        // 조간대(파도 세척선까지)는 하루 두 번 해수에 잠기고 염수에 젖어 **눈이 남지 않는다**(검토 라운드2 현실성 #14d).
        // 눈은 물에서 먼 쪽(화면 아래 = 뭍 안쪽)에만, 그것도 바위 사이 골에만 쌓인다.
        const snowTop = VIS * 0.52;
        for (let i = 0; i < 60; i++) {
          const y = snowTop + Math.pow(r(), 0.7) * (VIS - snowTop);
          const t2 = (y - snowTop) / Math.max(1, VIS - snowTop);
          softBlob(g, r() * w, y, 20 + r() * 60, "250 253 255", 0.16 + t2 * 0.4, 0, GROUND_SQUASH);
        }
      }
      // 암반(wave-cut platform)의 성격 — 절리(joint)로 갈린 **블록**과 단차(ledge)가 있어야 "바위"로 읽힌다.
      // 없으면 갯벌·콘크리트와 구분되지 않는다(검토 라운드2 현실성 #6·#8).
      {
        // ① 단차 — 물가와 나란한 층 서넛. 위쪽 면은 밝고 그 아래 좁은 그늘.
        for (let i = 0; i < 4; i++) {
          const y0 = 70 + (i + r() * 0.5) * (VIS / 5);
          const ly = (x: number) => y0 + Math.sin(x * 0.0034 + i * 1.9) * 14 + Math.sin(x * 0.011 + i) * 6;
          g.fillStyle = `rgb(236 240 244 / ${0.1 - i * 0.014})`;
          g.beginPath();
          for (let x = -10; x <= w + 10; x += 12) {
            if (x === -10) g.moveTo(x, ly(x));
            else g.lineTo(x, ly(x));
          }
          for (let x = w + 10; x >= -10; x -= 12) g.lineTo(x, ly(x) + 26);
          g.closePath();
          g.fill();
          g.fillStyle = `rgb(64 70 74 / ${0.12 - i * 0.02})`;
          g.beginPath();
          for (let x = -10; x <= w + 10; x += 12) {
            if (x === -10) g.moveTo(x, ly(x) + 26);
            else g.lineTo(x, ly(x) + 26);
          }
          for (let x = w + 10; x >= -10; x -= 12) g.lineTo(x, ly(x) + 34);
          g.closePath();
          g.fill();
        }
        // ② 절리 — 거의 직교하는 두 방향의 갈라진 금. 짧게 끊어 그린다(전폭 선은 도로가 된다).
        for (let i = 0; i < 46; i++) {
          const x0 = r() * w;
          const y0 = 60 + r() * (VIS - 90);
          // 절리는 거의 직교하는 **두 방향**이다 — 각도가 흩어지면 정체불명의 실선 낙서가 된다(사이클5 경계 #10).
          const a0 = (r() < 0.5 ? 0.12 : 1.45) + (r() - 0.5) * 0.12;
          const len = 26 + r() * 90;
          g.strokeStyle = `rgb(58 62 66 / ${0.12 + r() * 0.14})`;
          g.lineWidth = 1 + r() * 0.6;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x0 + Math.cos(a0) * len, y0 + Math.sin(a0) * len * GROUND_SQUASH);
          g.stroke();
        }
        // ③ 자갈밭 — 절리로 부서진 각력이 단차 사이에 고인다.
        for (let c2 = 0; c2 < 3; c2++) {
          const cx3 = r() * w;
          const cy3 = 100 + r() * (VIS - 150);
          for (let i = 0; i < 26; i++) {
            const a2 = r() * TAU;
            const d = Math.pow(r(), 0.6) * (40 + r() * 60);
            drawProp(g, art, "pebble", cx3 + Math.cos(a2) * d, cy3 + Math.sin(a2) * d * GROUND_SQUASH, {
              k: (0.9 + r() * 0.9) * landK(cy3),
              r: r(),
              sy: GROUND_SQUASH,
              rot: r() * TAU
            });
          }
        }
      }
      for (let i = 0; i < 10; i++) softBlob(g, r() * w, 40 + r() * (VIS - 60), 30 + r() * 46, "228 232 236", 0.045, 0, GROUND_SQUASH);
      // 바위 결 — 굵고 긴 획은 "회색 붓자국"으로 읽힌다. 가늘게·옅게·끊어서.
      for (let i = 0; i < 7; i++) {
        const y0 = 50 + r() * (VIS - 90);
        const amp = 10 + r() * 14;
        g.strokeStyle = `rgb(74 80 84 / ${0.04 + r() * 0.04})`;
        g.lineWidth = 1 + r() * 0.4;
        let pen = false;
        g.beginPath();
        for (let x = -10; x <= w + 10; x += 18) {
          if (Math.sin(x * 0.013 + i * 1.7) + 0.4 * Math.sin(x * 0.029 + i * 2.3) <= -0.1) { pen = false; continue; }
          const yy = y0 + Math.sin(x * 0.006 + i) * amp + Math.sin(x * 0.018 + i * 2) * amp * 0.3;
          if (!pen) { g.moveTo(x, yy); pen = true; } else g.lineTo(x, yy);
        }
        g.stroke();
      }
      // (해조 소프트 얼룩 철거 — 픽셀 화면에서 "정체불명 청회색 얼룩"으로 읽혔다, 사이클5 현실성 #4.
      //  해조는 조류대 띠 안의 픽셀 점으로만 그린다.)
      // 물웅덩이 먼저(바위 밑에 깔린다 — 옛 순서는 웅덩이가 바위 **위**에 얹혀 "바위 꼭대기의 물"이었다).
      const pools: [number, number, number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const x = 40 + r() * (w - 80);
        const y = 110 + r() * (VIS - 160);
        // 납작한 것은 아래로 갈수록 커진다 — 개체 편차를 줄이고 원근을 이기게(사이클3 현실성 #8).
        const rx = (12 + r() * 8) * (0.7 + 1.1 * (y / Math.max(1, VIS)));
        const ry = rx * (0.4 + r() * 0.12);
        pools.push([x, y, rx, ry]);
        const k = depthScale(shoreY() - 60 + y, h);
        // 웅덩이는 "칠한 구멍"이 아니라 하늘을 비추는 물 — 옅게 깔고 안에 하늘빛 줄 두 개.
        // 고인 물은 암반보다 **어둡다**(하늘 반사만 국부적으로 밝다) — 옛 밝은 하늘색은 스티커로 읽혔다
        // (검토 라운드2 현실성 #6 · 경계 #10).
        // 웅덩이 윤곽은 완전한 타원이 아니다 — 매끈한 타원 + 밝은 테두리는 "단추/렌즈"로 읽힌다.
        const poolPath = () => {
          g.beginPath();
          for (let q = 0; q <= 16; q++) {
            const a2 = (q / 16) * TAU;
            const wob = 0.82 + 0.3 * Math.sin(a2 * 3 + x * 0.03) + 0.12 * Math.sin(a2 * 5 + y * 0.05);
            const px2 = x + Math.cos(a2) * rx * k * wob;
            const py2 = y + Math.sin(a2) * ry * k * wob;
            if (q === 0) g.moveTo(px2, py2);
            else g.lineTo(px2, py2);
          }
          g.closePath();
        };
        g.fillStyle = season === "winter" ? "rgb(128 148 164 / 0.66)" : "rgb(88 110 120 / 0.56)";
        poolPath();
        g.fill();
        g.save();
        poolPath();
        g.clip();
        softBlob(g, x - rx * 0.2 * k, y - ry * 0.55 * k, rx * 0.66 * k, "226 238 246", season === "winter" ? 0.2 : 0.3, 0, 0.5);
        softBlob(g, x + rx * 0.3 * k, y + ry * 0.4 * k, rx * 0.8 * k, "46 64 74", 0.3, 0, 0.5);
        // 웅덩이 안의 해조 — 어두운 초록 몇 점(빈 파란 타원이 아니게).
        for (let q = 0; q < 3; q++) softBlob(g, x + (r() - 0.5) * rx * 1.2 * k, y + (r() - 0.5) * ry * 1.2 * k, (3 + r() * 5) * k, "44 74 56", 0.5, 0, 0.6);
        g.restore();
        // 바위 턱 — 웅덩이 위쪽 테두리는 어둡고 아래는 밝다(깊이).
        // 젖은 테두리 — 웅덩이 둘레의 축축한 바위(없으면 지면에 붙인 데칼).
        // 젖은 테두리 — 웅덩이 둘레의 축축한 바위(없으면 지면에 붙인 데칼).
        g.strokeStyle = "rgb(96 104 106 / 0.26)";
        g.lineWidth = 6;
        poolPath();
        g.stroke();
        g.strokeStyle = "rgb(52 58 62 / 0.34)";
        g.lineWidth = 1.6;
        poolPath();
        g.stroke();
      }
      // 바위는 **노두(露頭) 단위로 뭉친다** — 균등 난수 산포는 크기 위계도 방향성도 없어 "돌 스티커 뿌리기"로
      // 읽혔다(검토 라운드2 세 명). 노두 4곳에 큰 것 하나 + 붙은 작은 것들, 그리고 근경에 초점 바위 하나.
      // 물가 띠 바위는 판 밖 조석 층(`shoreRocks`, 라운드 13)으로 — 옛 순서(바위 → 띠)는 띠가 바위를 덮어 α≈.25 유령 + 흰 호만 남겼고
      // (QA 라운드 3 A#5 = AMB-S4-03), 판 안에 굽는 한 물가 클립이 꼭대기를 잘랐다(라운드 10~13).
      {
        type R2 = { x: number; y: number; k: number };
        const rocks: R2[] = [];
        const outcrops = 7; // 4는 지면 점유율 2% 미만 — 암석해안으로 안 읽혔다(사이클5 현실성 #4)
        for (let o = 0; o < outcrops; o++) {
          const cx2 = w * (0.06 + 0.15 * o + (r() - 0.5) * 0.1);
          const cy2 = 120 + r() * (VIS - 190);
          const dir = r() * Math.PI; // 노두마다 결의 방향이 있다
          const big = (2.1 + r() * 1.1) * landK(cy2) * 1.5;
          rocks.push({ x: cx2, y: cy2, k: big });
          const n2 = 3 + Math.floor(r() * 3); // 위성 3~5(규칙: 큰 것 1 + 작은 것 ≤ 5 — 라운드 3 B)
          for (let i = 0; i < n2; i++) {
            const d = 20 + r() * 70;
            rocks.push({
              x: cx2 + Math.cos(dir + (r() - 0.5) * 1.1) * d,
              y: cy2 + Math.sin(dir + (r() - 0.5) * 1.1) * d * GROUND_SQUASH,
              k: big * (0.3 + r() * 0.4)
            });
          }
        }
        // 근경 초점 — 화면 아래쪽의 큰 바위 하나(가까움의 신호).
        rocks.push({ x: w * (0.2 + r() * 0.6), y: VIS * (0.86 + r() * 0.1), k: 2.6 + r() * 0.8 });
        // **바다에 닿은 바위** — 물가 선에 걸친 노두가 없으면 "모래해안 위에 바위를 뿌린 것"으로 읽힌다
        // (사이클4 현실성 #10). 물가 바로 아래에 두 무리, 발치엔 흰 물살.
        for (let o = 0; o < 2; o++) {
          const cx3 = w * (0.16 + 0.5 * o + (r() - 0.5) * 0.2);
          for (let i = 0; i < 4; i++) {
            const y = 62 + r() * 42;
            rocks.push({ x: cx3 + (r() - 0.5) * 130, y, k: (0.9 + r() * 1.1) * landK(y) * 1.5 });
          }
        }
        rocks.sort((a2, b2) => a2.y - b2.y);
        for (const rk of rocks) {
          if (rk.y < 56 || rk.y > VIS - 6) continue;
          if (pools.some(([px, py, prx, pry]) => Math.abs(rk.x - px) < prx + 14 && Math.abs(rk.y - py) < pry + 12)) continue;
          // 노두 안에서도 서로 겹치지 않는다(QA 라운드 3, 소유자 "돌이 어색하게 잘려 있다") — 대체물 바위끼리 겹치면 윤곽이 서로를
          // 뚫고 지나가 잘린 돌로 읽힌다. 자리 점유 실패면 그 돌은 없다(무리는 큰 것 하나 + 붙은 작은 것들로 충분).
          // 실루엣 규칙(라운드 12 `claimSpot` stand/hy, 라운드 13 B #2): 원판만 보던 옛 호출은 뒤 노두의 발이 앞 바위 몸통 안에 오는 쌍(dy 50)을 통과시켰다.
          if (!claimSpot(rk.x, rk.y, 11 * rk.k, true, 30 * rk.k)) continue;
          const r1 = r();
          const f = r() < 0.5;
          if (rk.y - 30 * rk.k < shoreLim) {
            shoreRocks.push({ x: rk.x, y: rk.y, k: rk.k, r1, f });
            continue;
          }
          propShadow(g, rk.x + 3 * rk.k, rk.y - 1, 22 * rk.k, 0.18, GROUND_SQUASH * 0.5, "58 64 68");
          drawProp(g, art, "rock", rk.x, rk.y, { k: rk.k, r: r1, flip: f });
        }
      }
      // 조류대(해조 띠) — 물가 선 바로 아래 **검은 가로 띠**. 실제 암석해안에서 대비가 가장 센 요소이고,
      // 이게 있어야 "바다의 바위"로 읽힌다(없으면 산의 바위처럼 보인다, 2026-09-04 조사).
      {
        // 조류대는 굵기가 일정한 띠가 아니다 — 파도가 닿는 높이가 바위마다 다르므로 상·하연이 들쭉날쭉하다.
        // 균일 사각 띠는 "그려진 외곽선"으로 읽혔다(검토 라운드2 경계 #7).
        // 세로 사각형을 잇대어 칠하면 **빗살·바코드**가 된다(검토 라운드2 사이클3 경계 #1 · 미관 #2).
        // 위·아래 가장자리가 각각 굽이치는 폴리곤 하나를 그라데이션으로 칠한다.
        const belt = 30 + r() * 14;
        const topB = (x: number) => 58 + Math.sin(x * 0.0071 + 0.7) * 9 + Math.sin(x * 0.019 + 2.2) * 5;
        const botB = (x: number) => topB(x) + belt * (0.55 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.0104 + 1.1)));
        // 3단 계단 — 부드러운 그라데이션은 "지면 때/JPEG 뭉개짐"으로 읽힌다(사이클4 미관 #9).
        // 최암부를 올린다(QA 라운드 3 A#5: 프레임에서 유일하게 검은 띠 — VISUAL_DIRECTION "위협적인 검은 덩어리 없음", 밤 L ≥ 14).
        const steps: [number, number, string][] = [
          [0, 0.42, "rgb(36 40 38 / 0.36)"],
          [0.42, 0.74, "rgb(52 56 54 / 0.28)"],
          [0.74, 1, "rgb(66 70 68 / 0.15)"]
        ];
        for (const [a0, a1, col] of steps) {
          g.fillStyle = col;
          g.beginPath();
          for (let x = -10; x <= w + 10; x += 12) {
            const y = topB(x) + (botB(x) - topB(x)) * a0;
            if (x === -10) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          for (let x = w + 10; x >= -10; x -= 12) g.lineTo(x, topB(x) + (botB(x) - topB(x)) * a1);
          g.closePath();
          g.fill();
        }
        // 해조 점 — 띠 안에 픽셀 질감.
        for (let i = 0; i < 160; i++) {
          const x = r() * w;
          const tt = r();
          const y = topB(x) + (botB(x) - topB(x)) * tt;
          g.fillStyle = `rgb(${r() < 0.5 ? "26 34 28" : "58 66 58"} / ${0.2 + r() * 0.4})`;
          g.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
        // 위쪽 물보라 띠 — 표백돼 밝다.
        const sp2 = g.createLinearGradient(0, 58 + belt, 0, 58 + belt + 26);
        sp2.addColorStop(0, "rgb(236 240 242 / 0.3)");
        sp2.addColorStop(1, "rgb(236 240 242 / 0)");
        g.fillStyle = sp2;
        g.fillRect(0, 58 + belt, w, 26);
      }
      // 물가 바위 — **잠긴 규칙**으로 그린다(2026-09-06 라운드 7, 검토 B #7: "흰 물살 호만 또렷하고 몸통이
      // 조류대에 묻혀 바위 없는 물살이 떠 있다"). 민물·계곡은 라운드 1에서 이미 `drawSubmerged`로 옮겼는데
      // 해안만 남아 있었다 — 발치가 조류대 색에 잠기고 젖은 띠가 생겨야 "물에 발을 담근 바위"가 된다.
      // 흰 물살 호는 α .55 → .38로 낮춘다(호가 몸통보다 20L 밝아 호만 보였다).
      // (물가 띠 바위는 `bakeShoreRocks`가 조석별로 굽는다 — 라운드 13.)
      // 따개비·자갈 — 바위 사이 빈 회색 판을 메운다.
      for (let i = 0; i < 70; i++) {
        drawProp(g, art, "pebble", r() * w, 60 + r() * (VIS - 90), { k: 0.8 + r() * 0.8, r: r(), sy: GROUND_SQUASH, rot: r() * TAU });
      }
    }
    // 표착선 — 만조선 바로 아래 3~5m 폭의 **끊이지 않는 띠**(실제 100m에 500점). 해조(겨울·봄 괭생이모자반),
    // 조개껍데기, 잔가지·유목. 세 해안 공통이라 여기서 한 번에 그린다.
    {
      const band = 26 + r() * 14;
      const wrackTop = 62;
      const n2 = Math.round(w / 7);
      for (let i = 0; i < n2; i++) {
        const x = r() * w;
        const y = wrackTop + Math.pow(r(), 0.7) * band;
        const k = landK(y) * (0.8 + r() * 0.5);
        const pick = r();
        if (pick < 0.42) {
          const heavy = season === "winter" || season === "spring";
          softBlob(g, x, y, (5 + r() * 9) * k * (heavy ? 1.25 : 1), r() < 0.5 ? "108 92 62" : "86 78 56", heavy ? 0.34 : 0.24, 0, GROUND_SQUASH);
        } else if (pick < 0.72) {
          g.fillStyle = "rgb(240 234 220 / 0.9)";
          g.beginPath();
          g.ellipse(x, y, 2.6 * k, 1.7 * k, r() * TAU, 0, TAU);
          g.fill();
        } else if (pick < 0.9) {
          g.strokeStyle = "rgb(126 108 78 / 0.55)";
          g.lineWidth = 1.1 * k;
          const a2 = (r() - 0.5) * 1.2;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a2) * 12 * k, y + Math.sin(a2) * 4 * k);
          g.stroke();
        } else {
          softBlob(g, x, y, 4 * k, "246 242 232", 0.4, 0, GROUND_SQUASH);
        }
      }
    }
    // 겨울 — 뭍 위쪽(물가에서 먼 곳)에 눈이 얹히고 물가로 갈수록 얇아진다. 이 띠가 눈→젖은 뭍 전이다.
    if (season === "winter") {
      const sg = g.createLinearGradient(0, H, 0, 70);
      sg.addColorStop(0, "rgb(250 253 255 / 0.82)");
      sg.addColorStop(0.55, "rgb(248 252 255 / 0.5)");
      sg.addColorStop(1, "rgb(248 252 255 / 0)");
      g.fillStyle = sg;
      g.fillRect(0, 60, w, H - 60);
    }
    // **물가 곡선 따라 밀기**(라운드 7) — 여기까지 구운 뭍 판은 전부 로컬 y 고정이라, 화면에서는 물가가 44px
    // 굽는데 조류대·물보라·표착선은 자로 그은 가로 띠였다(검토 B #6, P1). 열마다 `shoreOffsetAt(x)`만큼 내려
    // 다시 그리면 판 전체가 물가를 따라간다 — 소품도 같이 따라가므로 접촉 관계가 유지된다.
    {
      const sc = document.createElement("canvas");
      sc.width = lc.width;
      sc.height = lc.height;
      const sg2 = sc.getContext("2d")!;
      const step = 2; // CSS px — 1px이면 열 1400개, 2px면 700개(굽기 때 한 번뿐이라 충분히 싸다)
      for (let x = 0; x < w; x += step) {
        const off = shoreOffsetAt(x + step / 2, mode);
        sg2.drawImage(lc, x * dpr, 0, step * dpr, lc.height, x * dpr, off * dpr, step * dpr, lc.height);
      }
      land = sc;
    }
    // 하늘 + 수평선 — 뭍 장면과 **같은 문법**의 지평선 띠(sea 프로파일: 먼 언덕·나무 줄 없이 안개만).
    // 옛 코드는 자체 그라데이션 + 1.5px 흰 선이라 초원 ↔ 해안 이동에서 지평선 처리가 통째로 바뀌었다.
    horizon = bakeHorizon(season, w, h, 1, "sea");
    gw = w;
    gh = h;
    gdpr = dpr;
    av = art.version;
    gsh = shadowKey(currentLight());
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!water || gw !== w || gh !== h || gdpr !== f.dpr || av !== art.version) bake(f.dpr);
      if (rocksTide !== tide(f) || rocksArt !== art.version) bakeShoreRocks(tide(f), f.dpr);
    },
    step(f) {
      const { dt, load } = f;
      // 조석 τ 3s(라운드 13, C #4). 층(`bakeShoreRocks`)은 목표 조석으로 바로 굽고 물가선만 3초에 걸쳐 닿는다 — 전이 중 ≤ 3s의 링 어긋남은 감수.
      const tv = tide(f);
      // 물가 띠 바위 층은 조석 상태별 — 띠가 바뀌어 물가선이 움직이면 그 조석 기준으로 잠김/마른 돌을 다시 나눈다(층만, 판은 그대로).
      // **`step()`에 있어야 한다**(2026-09-06 라운드 14, 검토 B #3): 라운드 13은 `resize()`에만 두어 창 크기가 그대로면 층이 영영 다시 굽지 않았다
      // — 점심에 마운트한 화면이 밤이 되어도 점심 조석의 잠김·수면선 링을 유지(바위 bbox 16.4% 차, 2/7 틀린 접촉 등급, 몸통 +12L 유령).
      if (rocksTide !== tv || rocksArt !== art.version) bakeShoreRocks(tv, f.dpr);
      tideK = Number.isFinite(tideK) ? tideK + (tv - tideK) * (1 - Math.exp(-dt / 3)) : tv;
      // 포인터 물결 — 물가 선 위쪽(바다)에서만.
      stepTrail(trail, f.p, f.t, top(), shoreY() - 34);
      // 아트 도착 또는 조명 전이 끝(그림자 채널 변화) → 뭍 다시 굽기(라운드 4 AMB-T1-03: 바위·통나무·소나무의 발밑 그림자).
      if (av !== art.version || (f.lightStable && gsh !== shadowKey(f.light))) bake(f.dpr);
      // 글린트 수 × 조명 글린트(라운드 4 C#2 — 저녁·흐림·비·안개 0, 노을 ×1.2; 민물과 같은 식). 점심·맑음 1 = 항등.
      const gt = Math.round(lerp(4, 16, load) * currentLight().glint);
      while (glints.length < gt) glints.push({ x: rand() * w, y: top() + 20 + rand() * (shoreY() - top() - 40), ph: rand() * TAU, r: 1.2 + rand() * 1.4 });
      if (glints.length > gt) glints.length = gt;
      // 물보라(암석해안) — 파도 주기마다 바위 근처에서 흰 점 몇 개. **바람에 비례**해 잦아지고 높이 솟는다
      // (2026-09-06 라운드 8, GRAMMAR §3.2 바람 행 "물보라 ×2" — 검토 C: 바람이 해안에서 입자 한 열뿐이었다).
      const wind = currentLight().wind;
      windDir = f.windDir;
      // 물보라는 **파도가 무엇에 부딪혀** 생긴다(라운드 14, 검토 B #1): 옛 코드는 `x = rand()·w, y = shoreY() − 4` 고정선이라
      // 썰물 띠엔 x의 63%가 마른 뭍 안쪽에서 솟았고(그려진 점의 26%가 물가선 아래), 점심엔 반대로 빈 바다 −52px에서 솟았다.
      // 이제 **물속에 발을 담근 물가 바위**(`shoreRocks` 중 이 조석에서 바다 쪽인 것)에서만, 그 x의 물가선 바로 위에서 튄다.
      // vx는 부호 있는 바람(`f.windDir`) — 입자층과 방향이 갈리면 한 화면에 바람이 둘이 된다(B #4).
      const tideK0 = Number.isFinite(tideK) ? tideK : tv;
      if (mode === "rocky" && load >= 0.4 && rand() < dt * 2.2 * (1 + 2 * wind)) {
        const WL = 60 + 0.02 * h * (1 - tv);
        const wet = shoreRocks.filter((rk) => WL - rk.y > 0);
        // 물속에 발을 담근 바위가 있으면 거기서, 없으면(썰물 = 바위가 전부 뭍 위) **물가선 자체**에서 — 파도는 바위가 없어도 물가에서 부서진다.
        // (바위 목록만 보면 밤 썰물에 물보라가 0이 된다 — 라운드 14 자체 실측.)
        const src = wet.length ? wet[Math.floor(rand() * wet.length)] : null;
        const sx = src ? src.x : rand() * w;
        const spread = src ? 24 * src.k : 26;
        const base = src
          ? shoreY() - 60 - h * 0.02 + src.y + shoreOffsetAt(sx, mode)
          : shoreY() - tideK0 * h * 0.02 - Math.sin(f.t * 0.5) * 3 + shoreOffsetAt(sx, mode) + Math.sin(sx * 0.02 + f.t * 1.1) * 2.5;
        const n = 5 + Math.round(5 * wind);
        for (let i = 0; i < n; i++)
          spray.push({
            x: sx + (rand() - 0.5) * spread,
            y: base - 2 - rand() * 6,
            vx: (rand() - 0.5) * 60 + windDir * wind * 40,
            vy: (-60 - rand() * 90) * (1 + 0.6 * wind),
            life: 1
          });
      }
      // 빗방울 고리 — 물가선 위(바다)에서만. 원근: 아래(가까운 물)일수록 잦고 크다.
      rainRings += stepRainRings(
        rings,
        dt,
        f.weather.now === "rain",
        rand,
        (r) => {
          const rx = r() * w;
          const lw = shoreY() - tv * h * 0.02 - Math.sin(f.t * 0.5) * 3 + shoreOffsetAt(rx, mode) + Math.sin(rx * 0.02 + f.t * 1.1) * 2.5;
          const t0 = top() + 8;
          if (lw - t0 < 12) return null;
          // v^1.6 = 근경 쪽으로 몰린다(고른 산포는 "하늘에서 뿌린 스티커"로 읽힌다 — A #1 조건 ③).
          const u = Math.pow(r(), 0.55);
          return { x: rx, y: t0 + u * (lw - t0 - 2) };
        },
        lerp(6, 18, load),
        140
      );
      for (let i = spray.length - 1; i >= 0; i--) {
        const s = spray[i];
        s.vy += 260 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 1.6;
        if (s.life <= 0) spray.splice(i, 1);
      }
    },
    draw(g, f) {
      const t = f.t;
      // 하늘(라운드 5, world/sky.ts) — 옛 단색 그라데이션 대신 계절 × 날씨 판(구름 포함). 수평선(top) 위만 보인다.
      {
        const sk = skyKey(season, f.weather.now, f.time.band, f.w, f.h);
        if (!skyC || sk !== skyKeyCur) {
          skyC = bakeSky(season, f.weather.now, f.time.band, f.w, f.h, seed);
          cloudC = bakeClouds(season, f.weather.now, f.time.band, f.w, f.h, seed);
          skyKeyCur = sk;
        }
        drawSky(g, skyC, cloudC, f.w, f.t, f.weather.now);
      }
      if (water) g.drawImage(water, 0, 0, f.w, f.h);
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 별·달·해 — 수평선 위 하늘 전부(가릴 것이 없다). 해는 수평선 가까이.
      drawSkyLive(g, f.w, f, seed, top() * 0.9, { moonY: top() * 0.38, sunY: top() * 0.8 });
      // 물가 선이 숨쉰다. 조석 진폭은 세 해안이 함께 움직이도록 작게(옛 0.06h는 갯벌만 바다 높이가 52px 달랐다).
      const sy = shoreY() - (Number.isFinite(tideK) ? tideK : tide(f)) * f.h * 0.02 - Math.sin(t * 0.5) * 3;
      // 파도 — 수평선에서 물가까지, 마지막 선은 물가에서 거품이 된다.
      // 파도는 물가 곡선의 가장 높은 지점보다 위에서 끝난다(곡선이 파도 선을 덮어 잘라내지 않게).
      // 먼 섬 — 바다 판이 완전 공백이면 해안 셋이 같은 층 케이크로 읽힌다(사이클4 미관 #4).
      {
        const iy = top() + 6;
        const ix = f.w * (mode === "tidal" ? 0.17 : mode === "sandy" ? 0.68 : 0.42);
        const iw = f.w * (mode === "rocky" ? 0.2 : 0.13);
        const ih = 10 + (mode === "rocky" ? 8 : 0);
        g.fillStyle = season === "winter" ? "rgb(196 208 218 / 0.75)" : "rgb(168 182 186 / 0.6)";
        g.beginPath();
        g.moveTo(ix - iw / 2, iy + 2);
        for (let q = 0; q <= 10; q++) {
          const u = q / 10;
          g.lineTo(ix - iw / 2 + iw * u, iy + 2 - Math.sin(u * Math.PI) * ih * (0.7 + 0.4 * Math.sin(u * 7)));
        }
        g.lineTo(ix + iw / 2, iy + 2);
        g.closePath();
        g.fill();
      }
      // 파도 띠 수 = 해안형(2026-09-04 조사). 갯벌은 소산형(dissipative) — 경사가 완만해 쇄파대가 넓고 잔파도 여러 줄.
      // 모래는 반사형(reflective) — 경사가 가팔라 **쇄파대가 없고** 물가에서 한 번에 부서진다(줄 둘, 크고 느리게).
      // 셋이 같은 4줄이면 흑백에서 같은 그림이 된다.
      const WV = mode === "tidal" ? { bands: 7, amp: 8, speed: 0.034 } : mode === "sandy" ? { bands: 2, amp: 17, speed: 0.062 } : { bands: 3, amp: 13, speed: 0.055 };
      // 파도 진폭 × (1 + .5·바람) — GRAMMAR §3.2 바람 "파도 ×1.5"(라운드 3 C#3: 해안·바다의 바람이 점 34개뿐이었다). 맑음(.08)은 ≈ 항등.
      // 바람은 진폭만이 아니라 **선의 두께·밝기**로도 말한다(라운드 14, 검토 A #1 조건 ②: 같은 획을 굵게 = 형광펜이 아니라 마디가 늘어야 한다 —
      // 여기서는 α만 소폭, 굵기는 `foamRows`가 맡는다). 맑음(.08)은 ≈ 항등.
      drawWaves(g, t, f.w, { top: top(), bottom: sy - 30, bands: WV.bands, speed: WV.speed, amp: WV.amp * (1 + 0.5 * currentLight().wind), alpha: 0.15 * (1 + 0.5 * currentLight().wind), foam: pal.foam, shore: true });
      drawTrail(g, trail, t, GROUND_SQUASH, pal.foam);
      drawGlints(g, t, glints);
      // 빛의 길(라운드 4 AMB-T1-03) — 노을 반사 띠·밤 달빛 띠·새벽 옅은 반사. 수평선에서 물가까지(뭍이 위를 덮는다). 점심 0.
      drawWaterLight(g, t, f.w, top() + 4, sy, currentLight());
      // 빗방울 고리(라운드 14) — 뭍 판이 덮기 **전**에, 수평선 아래 바다에만. 뭍은 뒤에 그려지므로 물가선 위로 넘어간 고리는 판이 가린다.
      if (rings.length) {
        g.save();
        g.beginPath();
        g.rect(0, top() + 6, f.w, f.h - top() - 6);
        g.clip();
        drawRainRings(g, rings, GROUND_SQUASH);
        g.restore();
      }
      // 뭍 — 물가 선 아래. 젖은 띠(어두운 반투명)가 물가 위로 살짝.
      if (land) {
        // 물가 선은 자로 그은 가로선이 아니다 — 완만하게 굽이치는 곡선(만·곶). 뭍 클립·젖은 띠·거품이 같은 곡선을 쓴다.
        // 해안별 위상과 모래해안의 **비치 커습**(주기 ~240px 초승달 만입/뿔)은 `shoreOffsetAt`이 갖고 있다 —
        // 뭍 판을 밀 때 쓴 식과 하나여야 다시 어긋나지 않는다(라운드 7).
        // 정적 낙차는 `shoreOffsetAt`(뭍 판을 밀 때 쓴 식과 같은 것) + 숨쉬기 t 항만 여기서.
        const lineY = (x: number) => sy + shoreOffsetAt(x, mode) + Math.sin(x * 0.02 + t * 1.1) * 2.5;
        const shorePath = (extend: number) => {
          g.beginPath();
          g.moveTo(-12, lineY(-12) + extend);
          for (let x = -12; x <= f.w + 12; x += 10) g.lineTo(x, lineY(x) + extend);
          g.lineTo(f.w + 12, f.h + 40);
          g.lineTo(-12, f.h + 40);
          g.closePath();
        };
        g.save();
        shorePath(0);
        g.clip();
        // 뭍 판은 **고정**(QA 라운드 2, AMB-M2-02): 옛 코드는 `sy − 60`에 그려 바위·웅덩이·절리가 물가 숨쉬기와 함께 ±3px
        // 오르내렸다(라운드 1·2 C 지적). 이제 판은 제자리에 있고 물가 클립(shorePath)만 숨쉰다 — 물이 뭍을 덮었다 드러낸다.
        // 목적지 높이를 화면 아래까지 명시 — 정적 shoreY()로 잰 이미지 높이를 쓰면 물가가 올라간 순간 바닥에 물이 샜다.
        const ly = shoreY() - 60 - f.h * 0.02;
        g.drawImage(land, 0, ly, f.w, Math.max(land.height / (gdpr || 1), f.h - ly + 8));
        // 젖은 모래/뻘 띠 — 물가 곡선 아래 12~22px, 파도 주기로 넓어졌다 좁아진다(클립 안이라 뭍에만 얹힌다).
        const wet2 = 12 + 10 * (0.5 + 0.5 * Math.sin(t * 0.5));
        const wg = g.createLinearGradient(0, sy - 24, 0, sy + wet2 + 26);
        wg.addColorStop(0, mode === "rocky" ? "rgb(40 50 60 / 0.4)" : "rgb(88 78 58 / 0.3)");
        wg.addColorStop(1, "rgb(88 78 58 / 0)");
        g.fillStyle = wg;
        g.fillRect(0, sy - 24, f.w, wet2 + 50);
        g.restore();
        // 물속 발 바위 층(라운드 13) — 클립 **밖**(꼭대기가 물가선 위로 솟는다), 거품 줄 **앞**(물가 거품은 물속 돌보다 앞에 있다).
        if (rocksSea) g.drawImage(rocksSea, 0, ly, f.w, Math.max(rocksSea.height / (gdpr || 1), f.h - ly + 8));
        // 물가 거품 — 두 줄(짙은 안쪽 선 + 옅은 바깥 여운).
        // 반사형 해빈은 쇄파대가 없는 대신 물가에서 파도가 **붕괴**한다 — 그 자리의 포말이 두껍고 밝다.
        // 물가 거품 — **끊어진 마디**로 그린다(2026-09-06 라운드 7, AMB-F1-06: 폭 1~2px 전폭 연속 흰 AA 획이
        // "픽셀 세계 위의 펜 선"이었다 — 실측 s13 y=379 한 행만 물 대비 +7 · 뭍 대비 +23). 마디 40~160px,
        // 사이 60px 이상 비우고, 폭 2~6px·α를 흔들며 2px 격자에 스냅한다. 파도가 닿은 자리만 하얗다.
        const foamRows = mode === "sandy" ? ([[0, 0.6, 4], [-7, 0.3, 2.5], [4, 0.22, 2]] as const) : ([[0, 0.42, 3], [-5, 0.18, 2]] as const);
        for (let ri = 0; ri < foamRows.length; ri++) {
          const [off, a, lw] = foamRows[ri];
          // 마디 배치는 **정적 시드**(라운드 13, C #4): 옛 `Math.round(sy)` 시드는 숨쉬기로 sy 정수가 바뀔 때마다(≈ 1회/초) 마디 전체를 재추첨해
          // 40ms diff에 ×5~11 스파이크(갯벌 3,077px)를 냈다. 주기 P(≥ 1100px)로 한 번 뽑아 타일링하고 4px/s로 흘린다 — t의 순수 함수라 캡처는 결정적.
          const fr = rng(seed * 131 + ri * 17 + Math.round(shoreY()));
          const segs: [number, number, number, number][] = [];
          let cursor = 0;
          // 바람은 **마디를 길게·틈을 좁게**(파도가 더 자주 닿는다) — 흰 α를 올리면 형광펜이 된다(라운드 14, 검토 A #1 조건 ②).
          const wk = currentLight().wind;
          while (cursor < 1100) {
            const seg = (40 + fr() * 120) * (1 + 0.5 * wk);
            const gap = (60 + fr() * 120) * (1 - 0.3 * wk);
            const aa = a * (0.7 + fr() * 0.6);
            const lw2 = Math.max(2, Math.round((lw * (0.7 + fr() * 0.7) * (1 + 0.35 * wk)) / 2) * 2);
            segs.push([cursor, seg, aa, lw2]);
            cursor += seg + gap;
          }
          const P = cursor;
          // 거품 마디는 **바람 방향**으로 흐른다(라운드 14, 검토 B #4: 옛 `t·4`는 늘 −x라 입자가 오른쪽으로 갈 때도 거품은 왼쪽이었다).
          // 맑음(wind .08)도 방향은 있다 — 세기만 작다.
          const drift = (t * 4 * (1 + 1.6 * currentLight().wind) * windDir + P * 1000) % P;
          for (let k0 = -1; k0 * P - drift < f.w + 20; k0++) {
            for (const [s0, seg, aa, lw2] of segs) {
              const x = k0 * P + s0 - drift;
              if (x + seg < -20 || x > f.w + 20) continue;
              g.strokeStyle = `rgb(${pal.foam} / ${aa.toFixed(3)})`;
              g.lineWidth = lw2;
              g.beginPath();
              for (let px = x; px <= x + seg; px += 8) {
                const yy = Math.round((lineY(px) + off) / 2) * 2;
                if (px === x) g.moveTo(px, yy);
                else g.lineTo(px, yy);
              }
              g.stroke();
            }
          }
        }
      }
      // 뭍 위 발 바위 층(라운드 13) — 클립 **밖**, 거품 줄 **뒤**: 마른 돌이 물가선 위로 솟고 거품은 몸통 뒤로 지나간다. 좌표계는 뭍 판과 같다.
      if (rocksLand) {
        const ly2 = shoreY() - 60 - f.h * 0.02;
        g.drawImage(rocksLand, 0, ly2, f.w, Math.max(rocksLand.height / (gdpr || 1), f.h - ly2 + 8));
      }
      for (const s of spray) {
        g.fillStyle = `rgb(255 255 255 / ${clamp(s.life, 0, 1) * 0.9})`;
        g.beginPath();
        g.arc(s.x, s.y, 1.6, 0, TAU);
        g.fill();
      }
      void depthScale;
    },
    // 안개 밀도장의 지면선(라운드 11) — 물가 곡선. 바다 위는 지면선 아래(고도항 1) = 해무가 물 위에 눕는다.
    fogFloor(x) {
      return shoreY() + shoreOffsetAt(x, mode);
    },
    fogFloorKey(f) {
      return `${mode}:${f.w}:${f.h}`;
    },
    debug() {
      // shoreRocks: 물가 띠 층의 바위(로컬 y, 전단 전) — 검사 도구가 꼭대기·발−물가선을 정확히 재도록(라운드 13 B 부록).
      return {
        biomeKind: mode,
        glints: glints.length,
        spray: spray.length,
        season,
        rocksTide,
        rings: rings.length,
        rainRings,
        windDir,
        shoreRocks: shoreRocks.map((rk) => [Math.round(rk.x), Math.round(rk.y), Math.round(rk.k * 100) / 100]),
        spots: propSpots().map((p2) => [Math.round(p2.x), Math.round(p2.y), Math.round(p2.r), p2.stand ? 1 : 0, Math.round(p2.hy ?? 0)])
      };
    }
  };
}
