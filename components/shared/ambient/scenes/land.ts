// 육지 바이옴 얇은 판(2026-09-04, PLAN-004 §3.3~3.5) — 숲(forest)·들판·언덕(hill)·계곡(valley)·산(mountain). P1에서는 바탕·지평선·소품만
// (생물은 P2 에이전트, 소나무·억새·고사리·절벽 아트는 P3 자리). 3/4 시점·축척·안개는 엔진과 view.ts가 준다.
//  · forest: **소나무-참나무 혼효림**(2026-09-04 웹 레퍼런스 — 한국 산림의 대표 임상). 참나무(둥근 잎 덩이)와
//    소나무(톱니 원뿔)가 45:55로 섞이고, 수관 틈 30~40%라 바닥에 볕 얼룩이 여럿 진다. 바닥은 낙엽 + 솔가리(솔잎 깔개).
//  · hill: 완만한 언덕 띠 두 겹(밝기 차로 원근), 풀포기 빽빽, 바위 무리, 봄엔 꽃, 가을엔 마른 풀(억새 자리는 P3).
//  · valley: 바위 사이를 굽이치는 시내(밝은 물 띠 + 흐르는 거품 점), 이끼 바위. 사면은 **참나무 극상림**(수관 틈
//    0~20% — 하늘이 열리는 곳은 물길뿐)이라 숲보다 나무가 빽빽하고 어둡다.
//  · mountain: 위 띠에 큰 봉우리 실루엣, 바위·눈 얼룩(겨울·초봄엔 눈이 초원보다 오래).

import type { Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { ArtSet, drawArt } from "../art/load";
import { claimSpot, drawProp, drawSubmerged, propShadow, resetPropField, scatterProps, setPropShadow, propSpots } from "../art/props";
import { currentLight, shadowKey } from "../world/light";
import { SIZE } from "../world/scale";
import { GROUND_SQUASH, aboveHz, bakeHorizon, depthFade, depthScale, horizonY } from "../world/view";
import { bakeClouds, bakeSky, drawSky, drawSkyLive, skyKey } from "../world/sky";
import { canopyTreeSprite, bareTreeSprite } from "../world/traces-draw";

export type LandKind = "forest" | "hill" | "valley" | "mountain";

// 계절마다 소품·나무 자리를 다르게 — 같은 시드면 네 계절이 "색만 바꾼 한 장"이 된다(2026-09-04 소유자).
const SEASON_SEED: Record<SeasonKey, number> = { spring: 0, summer: 977, autumn: 1861, winter: 2749 };


// 땅 그라데이션 — 위(멀다)는 밝고 아래(가깝다)는 확실히 짙게(≈45 L 폭). 폭이 좁으면 원근을 안개가 혼자 지고
// 열 바이옴이 "같은 뿌연 판"이 된다(2026-09-04 검토 5차: 숲만 σ 30+, 나머지는 9~16).
const GROUND: Record<LandKind, Record<SeasonKey, [string, string]>> = {
  forest: { spring: ["#cce0b4", "#5d7c50"], summer: ["#b6d29f", "#4e6d43"], autumn: ["#b6ab86", "#514a34"], winter: ["#f4f8fd", "#9fb7ce"] },
  hill: { spring: ["#e0ecca", "#7d9b62"], summer: ["#cbe2ac", "#5f8146"], autumn: ["#d0c8a8", "#6b6647"], winter: ["#f6faff", "#9db6d0"] },
  valley: { spring: ["#d5e5cc", "#728e6f"], summer: ["#c2dcbb", "#5a7c56"], autumn: ["#c2c0a2", "#5d5d44"], winter: ["#f2f8ff", "#9ab3ce"] },
  mountain: { spring: ["#dce1d6", "#7d8a78"], summer: ["#d1dacc", "#6e7a69"], autumn: ["#c8c4b6", "#63604f"], winter: ["#f8fbff", "#a3b8ce"] }
};

/** 두 hex 색의 선형 보간(봉우리 발치를 그 높이의 땅색에 맞물리기 위해). */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const k = Math.max(0, Math.min(1, t));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

export function createLand(seed: number, opts: { season: SeasonKey; kind: LandKind }): Scene {
  const { season, kind } = opts;
  let w = 0;
  let h = 0;
  let ground: HTMLCanvasElement | null = null;
  let horizon: HTMLCanvasElement | null = null;
  // 능선선만 따로 구운 판(QA 라운드 3, AMB-D1-01) — 안개·밤 조명이 산 층을 누를 때 능선선을 그만큼 되살린다(draw()에서 조명 배율로 덧그림).
  let ridgeC: HTMLCanvasElement | null = null;
  let ridge1: { pts: number[]; step: number } | null = null; // 산 ① 능선(하늘 clip용, 라운드 5)
  const clipAboveRidge1 = (c: CanvasRenderingContext2D) => {
    if (!ridge1) return;
    const { pts, step } = ridge1;
    c.beginPath();
    c.moveTo(-step, -10);
    for (let i = 0; i < pts.length; i++) c.lineTo(-step + i * step, pts[i] - 1);
    c.lineTo(w + step, -10);
    c.closePath();
    c.clip();
  };
  // 하늘 판(라운드 5, world/sky.ts) — 계절 × 날씨로 굽고 날씨가 바뀌면 다시. 언덕 능선 그늘 오버레이(hillShade)는 draw()에서 그림자 길이에 비례해 얹는다.
  let skyC: HTMLCanvasElement | null = null;
  let skyKeyCur = "";
  // 흐르는 구름 두 층(라운드 6 결정 4) — 폭 2w 타일, 오프셋은 t의 순수 함수라 캡처는 여전히 결정적이다.
  let cloudC: { far: HTMLCanvasElement; near: HTMLCanvasElement } | null = null;
  let hillShade: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  let av = -1;
  let gsh = ""; // 바탕에 구운 소품 그림자의 조명 키(라운드 4) — 달라지면 한 번 다시 굽는다
  const art = new ArtSet(
    ["tree-oak-spring", "tree-oak-summer", "tree-oak-autumn", "tree-oak-winter", "tree-pine", "tree-pine-autumn", "tree-pine-winter", "rock", "stump", "log", "mushroom", "grass-dry", "grass-tuft", "grass-tall", "snow-pile", "daisy", "shrub-spring", "shrub-summer", "shrub-autumn", "shrub-winter"],
    { scaleOf: { "tree-oak-spring": 3, "tree-oak-summer": 3, "tree-oak-autumn": 3, "tree-oak-winter": 3, "tree-pine": 3, "tree-pine-winter": 3 } }
  );
  const trees: { x: number; y: number; R: number; pine?: boolean }[] = [];
  const stream: { x: number; y: number }[] = [];
  const foam: { u: number; lane: number; sp: number }[] = [];
  const gy = () => horizonY(h);
  const groundY = (r: number) => gy() + r * (h - gy());
  /** 작은 식물(풀포기·꽃)의 추가 원근 테이퍼 — 0.3(지평선) → 1.0(발치). 큰 물체(나무·바위)에는 쓰지 않는다. */
  const smallK = (y: number) => 0.3 + 0.7 * Math.min(1, Math.max(0, (y - gy()) / Math.max(1, h - gy())));
  // 발밑 그림자 — 딱딱한 검은 타원은 밝은 땅(눈·모래)에서 "기름 웅덩이"로 읽혔다(2026-09-04 검토 1차).
  // 좁게·옅게·가장자리가 풀리게, 겨울엔 청회색(눈 그늘).
  const shColor = season === "winter" ? "92 106 124" : "60 66 58";
  // 라운드 4(AMB-T1-03, B#1 "한 장면에 해가 둘"): 언덕 나무·산 침엽수 띠·숲 그루터기·계곡 바위의 구운 그림자도 나무와 같은 조명 경로 —
  // `propShadow`가 해 반대쪽으로 늘리고 농도를 띠·날씨로 맞춘다(점심·맑음은 옛 softBlob과 픽셀 동일). 바탕은 shadowKey로 재굽기.
  const shadow = (g: CanvasRenderingContext2D, x: number, y: number, wd: number, a: number) => propShadow(g, x, y, wd * 0.5, a, 0.34, shColor);

  function drawTree(g: CanvasRenderingContext2D, x0: number, y: number, R: number, t: number, pine = false) {
    // 조명(QA 라운드 2, world/light.ts): 그림자는 해 반대쪽으로 길어지고(새벽 서쪽·노을 동쪽) 농도는 띠·날씨를 따른다.
    // 옛 `hour < 12 ? −8 : 8`은 방향 한 채널뿐이라 아침=점심이었고 점심에도 8px 비껴 있었다.
    const L = currentLight();
    // (그림자의 방향·길이·농도는 shadow() → propShadow가 조명에서 읽는다 — 라운드 4. 옛 dx·sw·sa 계산은 거기로 갔다.)
    // 바람 흔들림(M-3): 바람 .15 이상에서만(맑음은 정지 그대로 — 굽은 바탕과 회귀 해시 유지). 나무마다 위상·주기가 다르다.
    const amp = L.wind >= 0.15 ? L.wind * 2.2 : 0;
    const x = amp ? x0 + Math.sin(t * (0.9 + (Math.round(x0) % 7) * 0.08) + x0 * 0.013) * amp : x0;
    if (pine) {
      // 소나무 — 폭은 참나무(2R)보다 좁고(1.45R) 키는 조금 크다. 실루엣이 갈려야 "혼효림"으로 읽힌다.
      shadow(g, x0, y - 2, R * 0.95, 0.16);
      drawProp(g, art, season === "winter" ? "tree-pine-winter" : season === "autumn" ? "tree-pine-autumn" : "tree-pine", x, y, {
        k: (R * 1.78) / 92,
        r: ((x0 * 7919) % 997) / 997,
        flip: (Math.round(x0) & 1) === 1
      });
      return;
    }
    const a = art.get(`tree-oak-${season}`);
    if (a) {
      shadow(g, x0, y - 2, R * 1.05, 0.16);
      drawArt(g, a, x, y, (2 * R) / a.w);
      return;
    }
    const s = season === "winter" ? bareTreeSprite(R) : canopyTreeSprite(season, R);
    shadow(g, x0, y - 2, R * 1.0, 0.15);
    g.drawImage(s, x - s.width / 2, y - R * 0.9 - s.height / 2);
  }

  // 풀포기 한 포기 — 계절이 색을 고른다(봄·여름 = 초록, 가을·겨울 = 마른 풀). 겨울엔 눈이 얹힌다:
  // 마른 풀만 흰 눈밭에 서 있으면 "밝기만 올린 가을"로 읽혔다(2026-09-04 검토 1차).
  const green = season === "spring" || season === "summer";
  // 능선 그늘·선의 색 — 계절 고정이면 가을 언덕에 초록 띠가 두 줄 생긴다(검토 4차).
  const RIDGE: Record<SeasonKey, string> = { spring: "88 108 74", summer: "88 108 74", autumn: "116 100 66", winter: "150 168 190" };
  // 무리 심기 상태 — bake마다 초기화. 완전 무작위 분포는 "균일한 벽지"로 읽힌다.
  let clumpX = 0;
  let clumpY = 0;
  let clumpLeft = 0;
  function tuftClump(g: CanvasRenderingContext2D, r: () => number, k0: number, alpha: number) {
    if (clumpLeft <= 0) {
      clumpX = r() * w;
      // v를 제곱근으로 편향 — 위(멀다)에 무리가 더 자주 생긴다. 비스듬한 시점에서 먼 땅은 화면에서 압축되어
      // 단위 면적당 밀도가 **올라가야** 한다(사이클4 현실성 #4: 상반부가 빈 물감판).
      clumpY = groundY(Math.pow(r(), 1.6));
      clumpLeft = 1 + Math.floor(r() * 7);
    }
    clumpLeft--;
    const spread = 26 + r() * 54;
    const x = clumpX + (r() - 0.5) * spread * 2;
    const y = clumpY + (r() - 0.5) * spread;
    tuftAt(g, x, y, k0 * (0.55 + r() * 1.0) * depthScale(y, h) * smallK(y), r(), r() < 0.5, alpha * (0.75 + r() * 0.25));
  }
  function tuftAt(g: CanvasRenderingContext2D, x: number, y: number, k: number, v: number, flip: boolean, alpha = 1) {
    const tk = season === "winter" ? k * 0.6 : k;
    drawProp(g, art, green ? "grass-tuft" : "grass-dry", x, y, { k: tk, r: v, flip, alpha });
    if (season !== "winter") return;
    // 눈모자 — 통짜 흰 알약을 균일한 크기로 뿌리면 "팝콘밭"이 된다(검토 2차). 윗면만 호로, 아래엔 그늘 입술.
    const ck = (0.7 + v * 0.8) * tk;
    g.save();
    g.globalAlpha *= 0.55;
    g.fillStyle = "rgb(250 253 255)";
    g.beginPath();
    g.ellipse(x, y - 4 * tk, 3.4 * ck, 1.6 * ck, 0, Math.PI, TAU);
    g.fill();
    g.globalAlpha *= 0.7;
    g.fillStyle = "rgb(198 214 232)";
    g.beginPath();
    g.ellipse(x, y - 3.4 * tk, 3.4 * ck, 0.9 * ck, 0, 0, Math.PI);
    g.fill();
    g.restore();
  }

  function bake(dpr: number) {
    setPropShadow(shColor);
    resetPropField();
    const g0 = rng((seed * 7 + 13 + SEASON_SEED[season]) >>> 0);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const [c0, c1] = GROUND[kind][season];
    const grad = g.createLinearGradient(0, gy(), 0, h);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // 얼룩 밀도·알파는 초원(spring.ts)과 같아야 한다 — 달랐던 탓에 초원이 이웃보다 20~30% 밝아 이동 중 세로 이음매가 보였다.
    const patches = Math.round((w * h) / 46000);
    // 세 번째 톤은 **밝거나 차가운** 색만 — 어두운 톤을 큰 반경으로 깔면 "기름 얼룩"이 된다(어두운 얼룩 금지, 검토 5차).
    const PATCH: Record<SeasonKey, [string, string, string]> = {
      spring: ["255 255 245", "205 228 180", "196 214 200"],
      summer: ["255 255 245", "205 228 180", "186 206 190"],
      autumn: ["248 242 226", "190 178 138", "122 92 96"],
      winter: ["255 255 255", "222 234 246", "168 190 214"]
    };
    const pc = PATCH[season];
    for (let i = 0; i < patches; i++) {
      const py = groundY(g0());
      // 얼룩도 원근을 탄다 — 지평선 근처에서 같은 반경이면 "공중의 안개 뭉치"가 된다(검토 4차).
      const pk = depthScale(py, h) * depthScale(py, h);
      const pick = g0();
      const third = pick >= 0.75;
      softBlob(g, g0() * w, py, (third ? 60 + g0() * 60 : 120 + g0() * 260) * pk, third ? pc[2] : pick < 0.45 ? pc[0] : pc[1], third ? (season === "autumn" ? 0.1 : 0.16) : 0.17, 0, GROUND_SQUASH);
    }
    if (kind === "hill") {
      // 언덕 띠 두 겹 — 옛 코드는 능선 아래를 통짜 흰색으로 채워 "계단식 논"으로 읽혔다. 능선에서만 밝고
      // 120px 안에 사라지는 그라데이션 + 능선 선 한 줄(그래야 땅의 접힘으로 읽힌다).
      // 능선 그늘 오버레이(라운드 5 AMB-D2-02, B: 띠 단차가 시간 불변·노을 < 점심): 세 능선의 그늘 띠만 따로 구워 draw()가
      // 그림자 길이(light.shadow.len)에 비례해 얹는다 — 점심(len .5)은 0(항등), 노을(1.8) 1, 새벽 .85, 밤 .08.
      // 능선 함수는 하나(B: 다른 함수면 능선선이 둘) — 띠 그리기·그늘 오버레이·나무·노두 자리가 같은 식을 쓴다.
      // 진폭도 땅 높이 비례 — 절대 26/9를 두면 땅이 줄었을 때 세 띠가 서로 교차한다(검토 B).
      const hillRidge = (i: number, x: number) => groundY(0.14 + i * 0.24) + Math.sin(x * 0.003 + i * 2) * ((h - gy()) * 0.0344) + Math.sin(x * 0.009 + i) * ((h - gy()) * 0.0119);
      const hs = document.createElement("canvas");
      hs.width = c.width;
      hs.height = c.height;
      const hg = hs.getContext("2d")!;
      hg.scale(dpr, dpr);
      hillShade = hs;
      for (let i = 0; i < 3; i++) {
        const base = groundY(0.14 + i * 0.24);
        const ridge = (x: number) => base + Math.sin(x * 0.003 + i * 2) * 26 + Math.sin(x * 0.009 + i) * 9;
        const bg = g.createLinearGradient(0, base - 30, 0, base + 130);
        const a0 = 0.2 - i * 0.05;
        {
          // 오버레이 띠 — 능선 아래 70px, 뒤 띠일수록 옅게. 색은 계절 능선색.
          const og2 = hg.createLinearGradient(0, base - 2, 0, base + 70);
          og2.addColorStop(0, `rgb(${RIDGE[season]} / ${(0.34 - i * 0.05).toFixed(2)})`);
          og2.addColorStop(1, "rgb(0 0 0 / 0)");
          hg.fillStyle = og2;
          hg.beginPath();
          hg.moveTo(0, h);
          for (let x = 0; x <= w; x += 20) hg.lineTo(x, ridge(x));
          hg.lineTo(w, h);
          hg.closePath();
          hg.fill();
        }
        bg.addColorStop(0, `rgb(255 255 252 / ${a0})`);
        bg.addColorStop(1, "rgb(255 255 252 / 0)");
        // 먼 사면은 **더 밝다**(대기 원근) — 어둡게 칠했더니 원근이 뒤집혀 "계단식 논"으로 읽혔다(검토 3차).
        // 먼 사면일수록 밝다 — 계단이 보여야 "접힌 땅"으로 읽힌다(0.08 한 값은 평면이었다).
        // 띠 3(i=2)이 1.1~1.5 L로 사라졌다(라운드 4 B#8) — 뒤 띠의 감쇠를 .05 → .03으로(점심 세 띠 ≥ 5 목표).
        g.fillStyle = `rgb(255 255 255 / ${0.16 - i * 0.03})`;
        g.beginPath();
        g.moveTo(0, gy());
        for (let x = 0; x <= w; x += 20) g.lineTo(x, ridge(x));
        g.lineTo(w, gy());
        g.closePath();
        g.fill();
        // 가림 그늘은 능선 **바로 아래** 좁은 띠에만.
        const og = g.createLinearGradient(0, base - 4, 0, base + 40);
        og.addColorStop(0, `rgb(${RIDGE[season]} / ${0.3 - i * 0.03})`);
        og.addColorStop(1, "rgb(0 0 0 / 0)");
        g.fillStyle = og;
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, ridge(x));
        g.lineTo(w, h);
        g.closePath();
        g.fill();
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, ridge(x));
        g.lineTo(w, h);
        g.closePath();
        g.fill();
        // 끊어진 호 서너 개 — 전폭 1px 선은 "등고선/철선"으로 읽힌다(검토 2차).
        g.strokeStyle = `rgb(${RIDGE[season]} / ${season === "winter" ? 0.34 : 0.28 - i * 0.06})`;
        g.lineWidth = 1;
        let pen = false;
        g.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const on = Math.sin(x * 0.014 + i * 2.2) + 0.4 * Math.sin(x * 0.031 + i) > -0.15;
          if (!on) { pen = false; continue; }
          if (!pen) { g.moveTo(x, ridge(x)); pen = true; } else g.lineTo(x, ridge(x));
        }
        g.stroke();
      }
      if (season === "winter") {
        // 겨울 언덕은 "색만 식힌 가을"이었다(사이클3 현실성 #5) — 능선 바람 그늘에 눈이 쌓인다.
        for (let i = 0; i < 22; i++) {
          const y = groundY(0.14 + g0() * 0.84);
          const x = g0() * w;
          const R = (30 + g0() * 70) * depthScale(y, h);
          // 단계진 눈 무더기 — 부드러운 방사 그라데이션은 "렌즈 먼지"로 읽힌다(사이클4 미관 #9).
          // 이삭은 **흰색이 아니다**(QA 라운드 3 A#8: 흰 V 스탬프 70개가 낮엔 불꽃·밤엔 반딧불) — 은빛·베이지(계절표), α ≤ .55.
          for (const [k2, col] of [[1, "rgb(212 212 198 / 0.34)"], [0.72, "rgb(224 222 206 / 0.44)"], [0.42, "rgb(234 230 212 / 0.55)"]] as const) {
            g.fillStyle = col;
            g.beginPath();
            for (let q = 0; q <= 14; q++) {
              const a2 = (q / 14) * TAU;
              // 눈더미는 바람 방향으로 **비대칭**이다(풍상 완만, 풍하 급) — 좌우 대칭 반구는 플라스틱 돔으로
              // 읽힌다(사이클4 현실성 #9).
              const lee = 1 + 0.55 * Math.max(0, Math.cos(a2 - 0.5));
              const wob = (0.84 + 0.26 * Math.sin(a2 * 3 + x * 0.02) + 0.1 * Math.sin(a2 * 6 + y * 0.03)) * lee;
              const px2 = x + Math.cos(a2) * R * k2 * wob;
              const py2 = y + Math.sin(a2) * R * k2 * wob * GROUND_SQUASH * 0.72;
              if (q === 0) g.moveTo(px2, py2);
              else g.lineTo(px2, py2);
            }
            g.closePath();
            g.fill();
          }
        }
        scatterProps(g, art, w, h, g0, [{ id: "snow-pile", n: 6, band: "any" }]);
      }
      // 언덕의 표지 — 능선을 따라 드러난 바위 노두 둘과 능선 위 단독 나무. 초원에는 없는 것들이라야
      // 두 화면이 갈린다(사이클4 미관 #6: "같은 브러시, 다른 색 필터").
      {
        for (let c2 = 0; c2 < 2; c2++) {
          const cx2 = w * (0.14 + 0.5 * c2 + (g0() - 0.5) * 0.16);
          // 노두는 **능선선 위에 발**(B#4: 옛 자리는 능선 아래 50~110px 사면 중턱) — ridge_k(x) + [−4, 28].
          const cy2 = hillRidge(c2, cx2) + 12;
          for (let i = 0; i < 5; i++) {
            const x = cx2 + (g0() - 0.5) * 160;
            const y = hillRidge(c2, x) + 12 + (g0() - 0.5) * 24;
            void cy2;
            const k = (0.7 + g0() * 0.9) * depthScale(y, h);
            if (!claimSpot(x, y, 18 * k)) continue;
            shadow(g, x + 3 * k, y, 20 * k, 0.14);
            drawProp(g, art, "rock", x, y, { k, r: g0(), flip: g0() < 0.5 });
          }
        }
        // 능선 위 단독 나무 — 언덕 화면의 초점.
        const tx = w * (0.2 + g0() * 0.6);
        const ty = hillRidge(0, tx) + 2 + g0() * 8; // 능선 위 단독 나무 — 발이 능선선에(B#4: 옛 −64px)
        const tk = (0.7 + g0() * 0.3) * depthScale(ty, h);
        shadow(g, tx + 6 * tk, ty - 2, 46 * tk, 0.15);
        drawProp(g, art, season === "winter" ? "tree-oak-winter" : `tree-oak-${season}`, tx, ty, { k: (tk * SIZE.treeCrownW * 1.1) / 120, r: g0(), flip: g0() < 0.5 });
      }
      const tufts = Math.round((w * h) / (season === "winter" ? 6400 : 3400));
      clumpLeft = 0;
      for (let i = 0; i < tufts; i++) tuftClump(g, g0, 1.1, 0.9);
      if (season === "spring") {
        // 봄 언덕 = 야생화가 흔한 새 풀밭(여름과 확실히 갈리게 밀도를 올린다).
        const nd = Math.round((w * h) / 26000);
        for (let i = 0; i < nd; i++) {
          const x = g0() * w;
          const y = groundY(g0());
          drawProp(g, art, "daisy", x, y + 8, { k: (0.9 + g0() * 0.3) * (SIZE.flower / 18) * depthScale(y, h) * smallK(y), r: g0(), flip: g0() < 0.5 });
        }
      } else if (season === "summer") {
        // 여름 언덕 = 억새가 이삭 없이 잎만 무성한 철 — 키큰 초록 풀로 "무성함"을 신호한다.
        const nt = Math.round((w * h) / 11000);
        for (let i = 0; i < nt; i++) {
          const x = g0() * w;
          const y = groundY(0.04 + g0() * 0.96);
          drawProp(g, art, "grass-tall", x, y, { k: (0.9 + g0() * 0.8) * depthScale(y, h) * smallK(y), r: g0(), flip: g0() < 0.5, alpha: 0.85 });
        }
      }
      // 억새 밭(2026-09-04 조사) — 억새는 **포기**로 자란다: 지름 0.9~1.8m 덩이가 1.5m 간격으로 거의 맞닿아
      // 언덕 전체를 덮는다. 그 울퉁불퉁한 결이 곧 억새 언덕의 표지다(매끈한 잔디 돔이 가장 흔한 오류).
      // 이삭은 **9월~2월만**(여름엔 없다), 색은 자주빛 → 은빛 → 황금 갈색 → 베이지로 흐른다.
      {
        const plume = season === "autumn" || season === "winter";
        const clumps = Math.round((w * h) / 5200);
        for (let i2 = 0; i2 < clumps; i2++) {
          const cx5 = g0() * w;
          const cy5 = groundY(0.06 + g0() * 0.94);
          const ds = depthScale(cy5, h) * smallK(cy5);
          const rr = (16 + g0() * 14) * ds; // 포기 반지름
          const lean = (g0() - 0.5) * 0.7; // 포기마다 기운 방향 — 같은 부채꼴이 반복되면 격자로 읽힌다
          // 잎 덩이 — 부채꼴로 벌어진 가닥 여럿(포기 하나가 하나의 덩이로 읽혀야 한다).
          const leaf = season === "winter" ? "rgb(178 164 132" : season === "autumn" ? "rgb(186 158 108" : "rgb(132 149 45";
          for (let k2 = 0; k2 < 7; k2++) {
            const a2 = -Math.PI / 2 + lean + (k2 - 3) * (0.22 + g0() * 0.16) + (g0() - 0.5) * 0.22;
            const len = rr * (1.5 + g0() * 0.9);
            g.strokeStyle = `${leaf} / ${0.4 + g0() * 0.35})`;
            g.lineWidth = 1.1 + g0() * 1.1;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(cx5, cy5);
            g.quadraticCurveTo(cx5 + Math.cos(a2) * len * 0.5, cy5 + Math.sin(a2) * len * 0.55, cx5 + Math.cos(a2) * len * 0.9, cy5 + Math.sin(a2) * len);
            g.stroke();
          }
          if (plume && g0() < 0.72) {
            // 이삭 — 잎 덩이보다 30~50cm 위에 뜬 반투명 층.
            const py2 = cy5 - rr * 2.2;
            // 이삭 명도(라운드 5, AMB-F3-01 재개 — A: 색만 베이지, 최대 L 74~80 vs 지면 49~70): 지면 +10~14L 안으로 — 톤을 내리고 α를 낮춘다.
            const pc2 = season === "winter" ? "rgb(188 180 164" : "rgb(196 188 172";
            for (let k2 = 0; k2 < 3; k2++) {
              const a2 = -Math.PI / 2 + (k2 - 1) * 0.34;
              g.strokeStyle = `${pc2} / ${0.3 + g0() * 0.2})`;
              g.lineWidth = 2.4 * ds;
              g.beginPath();
              g.moveTo(cx5 + (k2 - 1) * 2, cy5 - rr * 0.8);
              g.quadraticCurveTo(cx5 + Math.cos(a2) * rr * 0.7, py2, cx5 + Math.cos(a2) * rr * 1.5, py2 + rr * 0.3);
              g.stroke();
            }
          }
        }
      }
            scatterProps(g, art, w, h, g0, [{ id: "rock", n: 9, band: "any" }, { id: `shrub-${season}`, n: 5, band: "any" }]);
    } else if (kind === "forest") {
      // 빈터 — 가운데는 그늘(이끼·솔잎), 가장자리는 어둡게. 나무 그늘이 좌우에서 안쪽으로 번진다.
      // 빈터 그늘 — 계절색(초록 고정이면 눈밭·가을 숲 한가운데 초록 얼룩이 생긴다, 검토 3차).
      const CLEAR: Record<SeasonKey, [string, string, number, number]> = {
        spring: ["70 90 60", "58 74 52", 0.06, 0.14],
        summer: ["70 90 60", "58 74 52", 0.06, 0.14],
        autumn: ["96 78 50", "78 62 42", 0.09, 0.13],
        winter: ["160 172 186", "142 154 170", 0.07, 0.09]
      };
      const [cc0, cc1, ca0, ca1] = CLEAR[season];
      softBlob(g, w / 2, groundY(0.55), Math.min(w, h) * 0.42, cc0, ca0, 0, GROUND_SQUASH);
      for (const sx of [0.04, 0.96]) softBlob(g, w * sx, groundY(0.5), Math.min(w, h) * 0.5, cc1, ca1, 0, GROUND_SQUASH);
      // 숲 바닥 — 낙엽·솔잎 부스러기(가을엔 두껍게). 큰 것 없이 작은 점만, 오행 팔레트(갈색·와인·올리브).
      const litter = Math.round((w * h) / (season === "autumn" ? 900 : season === "winter" ? 11000 : 2600));
      const LIT: Record<string, string[]> = {
        spring: ["120 140 96", "104 124 84", "150 140 108"],
        summer: ["96 122 78", "84 108 70", "132 128 96"],
        autumn: ["112 86 58", "94 68 54", "124 102 70", "110 63 70", "122 77 82"],
        winter: ["150 152 150", "132 136 138", "160 154 140"]
      };
      for (let i = 0; i < litter; i++) {
        const y = groundY(g0());
        const k = depthScale(y, h);
        const c = LIT[season][Math.floor(g0() * LIT[season].length)];
        g.fillStyle = `rgb(${c} / ${0.18 + g0() * 0.3})`;
        g.save();
        g.translate(g0() * w, y);
        g.rotate(g0() * TAU);
        g.scale(1, GROUND_SQUASH);
        g.beginPath();
        g.ellipse(0, 0, (2.2 + g0() * 3.6) * k, (1.2 + g0() * 1.8) * k, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      // 볕 얼룩 — 소나무-참나무 혼효림의 수관 틈은 30~40%(순림보다 훨씬 밝다). 바닥에 밝은 얼룩 넷이
      // 흩어져야 "빛이 새는 숲"으로 읽힌다(겨울엔 눈이 이미 밝으니 약하게).
      {
        const sun = season === "winter" ? 0.05 : 0.1;
        for (let i = 0; i < 4; i++) {
          const x = w * (0.1 + g0() * 0.8);
          const y = groundY(0.2 + g0() * 0.7);
          softBlob(g, x, y, (60 + g0() * 110) * depthScale(y, h), season === "winter" ? "255 255 255" : "246 240 202", sun, 0, GROUND_SQUASH);
        }
      }
      // 솔가리(솔잎 깔개) — 침엽수 밑의 마른 갈색 바늘. 짧고 가는 선이라 낙엽 점과 결이 다르다.
      {
        const needles = Math.round((w * h) / (season === "winter" ? 5200 : 1800));
        g.lineCap = "butt";
        for (let i = 0; i < needles; i++) {
          const y = groundY(0.08 + g0() * 0.94);
          const x = g0() * w;
          const k = depthScale(y, h);
          const a2 = g0() * Math.PI;
          g.strokeStyle = `rgb(${season === "winter" ? "146 140 132" : "126 100 66"} / ${0.16 + g0() * 0.22})`;
          g.lineWidth = 0.9;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a2) * 6 * k, y + Math.sin(a2) * 6 * k * GROUND_SQUASH);
          g.stroke();
        }
      }
      const tufts = Math.round((w * h) / 3200);
      clumpLeft = 0;
      for (let i = 0; i < tufts; i++) tuftClump(g, g0, 0.85, 0.6);
      if (season === "autumn") {
        // 버섯은 나무·그루터기·통나무 곁에 군집으로(라운드 7, 검토 B). 숫무언가 발밑 그림자도 없었다.
        const anchors = propSpots().filter((sp) => sp.r >= 10);
        const groups = anchors.length === 0 ? 0 : Math.min(anchors.length, 2);
        for (let gi = 0; gi < groups; gi++) {
          const a = anchors[Math.floor(g0() * anchors.length) % anchors.length];
          const ax = a.x + (g0() - 0.5) * 90;
          const ay = Math.max(gy() + 30, Math.min(h - 30, a.y + (g0() - 0.5) * 40));
          for (let i = 0; i < 2 + Math.floor(g0() * 2); i++) {
            const x = ax + (g0() - 0.5) * 24;
            const y = ay + (g0() - 0.5) * 14;
            const k = (0.8 + g0() * 0.5) * depthScale(y, h);
            propShadow(g, x + 2 * k, y + 8 * k, 12 * k, 0.22, GROUND_SQUASH * 0.5, "43 35 32");
            drawProp(g, art, "mushroom", x, y + 8 * k, { k, r: g0() });
          }
        }
      }
      scatterProps(g, art, w, h, g0, [{ id: "stump", n: 6, band: "any" }, { id: "log", n: 5, band: "any" }, { id: "rock", n: 12, band: "any" }, { id: `shrub-${season}`, n: 10, band: "any" }]);
      if (season === "winter") {
        // 그루터기·통나무의 **수평 윗면**은 눈이 가장 잘 쌓이는 면이다 — 맨 나무색으로 남으면 계절이 깨진다
        // (검토 라운드2 현실성 #9). scatterProps와 같은 rng 흐름 밖이라 자리는 근사치로 흩뿌린다.
        for (let i = 0; i < 14; i++) {
          const x = g0() * w;
          const y = groundY(0.12 + g0() * 0.86);
          const k = (0.7 + g0() * 0.8) * depthScale(y, h);
          g.fillStyle = "rgb(250 253 255 / 0.75)";
          g.beginPath();
          g.ellipse(x, y - 10 * k, 15 * k, 5 * k, 0, Math.PI, TAU);
          g.fill();
          g.fillStyle = "rgb(206 220 236 / 0.5)";
          g.beginPath();
          g.ellipse(x, y - 9 * k, 15 * k, 2.4 * k, 0, 0, Math.PI);
          g.fill();
        }
      }
    } else if (kind === "valley") {
      // 계곡(2026-09-04, 하천지형학 조사 반영) — "잔디밭 위의 리본"을 다시 만든다.
      //  · 사행: 진폭 ≈ 1.1×하폭, 파장 ≈ 5.5×하폭(자연값 10×은 한 화면에 굽이가 0.4개뿐이라 조인다).
      //    축을 대각선으로 눕혀 길이를 벌어 화면에 굽이 2~3개(사행도 ≈ 1.5).
      //  · 굽이 바깥(공격사면) = 깊고 어두운 소 + 하식애 + 바위 무리, 안쪽(퇴적사면) = 밝은 자갈톱.
      //  · 소(굽이 정점) ↔ 여울(변곡점) 교대. 젖은 바위 띠는 마른 바위보다 30~40% 어둡다.
      //  · 계곡 벽은 35° 사면이 **먼 땅을 가린다**(가장자리 비네팅이 아니라 실루엣).
      const nS = 44;
      const wNear = w * 0.135; // 하폭(발치) — 화면 폭의 12~16%가 실제 비율
      // 원근 테이퍼를 세게(0.42 → 0.26): 옛 값은 상·하류 폭 차가 작아 "평행 두 줄 = 도로"로 읽혔다(검토 라운드2 #6).
      const chW = (t: number) => wNear * (0.14 + 0.86 * t * t * 0.55 + 0.86 * t * 0.45); // 하류로 갈수록 크게 넓어진다(도로처럼 평행하지 않게)
      const cxAxis = (t: number) => w * (0.3 + 0.42 * t);
      stream.length = 0;
      const bends: { i: number; side: number }[] = [];
      {
        let phase = 1.1;
        // 물길은 **지평선에서 시작**한다. 옛 -0.05는 지평선 위(하늘)에서 시작해 원경 언덕 위에 삼각 쐐기가
        // 남았다(검토 라운드2 #4 — 땅에 붙는 것은 지평선 아래에만). 상류 끝은 아래 ⑧에서 안개에 녹인다.
        let prevY = groundY(0);
        for (let i2 = 0; i2 <= nS; i2++) {
          const t = i2 / nS;
          // 하류 끝은 화면 **훨씬 아래**(v 1.5)에서 끝난다 — 1.14는 끝 단면(리본 폭 ±1.42·hw의 직선 캡)이 화면 아래 모서리에
          // 비스듬한 직선으로 걸려 "계곡 가장자리가 어색하게 이어진" 그림이 됐다(QA 라운드 3, 소유자 스크린샷).
          const y = groundY(1.5 * t);
          const W2 = chW(t);
          const lam = 5.5 * W2;
          phase += ((y - prevY) / lam) * TAU;
          prevY = y;
          const off = Math.sin(phase) * 1.1 * W2;
          stream.push({ x: cxAxis(t) + off, y });
          if (i2 > 3 && Math.abs(Math.cos(phase)) < 0.16) bends.push({ i: i2, side: Math.sin(phase) > 0 ? 1 : -1 });
        }
      }
      // 상류 끝 세 점은 폭을 0으로 좁힌다 — 안 그러면 지평선 아래에서 둥근 마개로 뚝 끝난다(사이클3 현실성 #3).
      const halfAt = (i2: number) => (chW(Math.min(1, i2 / nS)) / 2) * Math.min(1, i2 / 4);
      // 물길을 자리 점유 필드에 **가장 먼저** 등록 — 안 그러면 그 뒤에 놓이는 바위·관목·나무가 물 위에 선다
      // (사이클3 경계 #6). 점을 건너뛰면 그 틈에 소품이 앉으므로 모든 점, 자갈 둔치까지 덮는 넓은 반경.
      for (let i2 = 0; i2 < stream.length; i2++) claimSpot(stream[i2].x, stream[i2].y, halfAt(i2) * 2.4);
      const normalAt = (i2: number): [number, number] => {
        const a = stream[Math.max(0, i2 - 1)];
        const b = stream[Math.min(stream.length - 1, i2 + 1)];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return [-(b.y - a.y) / len, (b.x - a.x) / len];
      };
      // 리본의 어떤 점도 지평선 위로 못 간다 — 상류는 진행 방향이 대각선이라 법선의 세로 성분이 커서
      // 단면이 하늘로 22px 솟았고, 그게 44장 중 계곡 4장의 "허공에 뜬 삼각 쐐기"였다(검토 라운드2 현실성 #3).
      const clampY = (y: number) => Math.max(gy() + 1, y);
      const ribbonPath = (kw: number) => {
        g.beginPath();
        for (let i2 = 0; i2 < stream.length; i2++) {
          const [nx, ny] = normalAt(i2);
          const hw = halfAt(i2) * kw;
          const px = stream[i2].x + nx * hw;
          const py = clampY(stream[i2].y + ny * hw);
          if (i2 === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        for (let i2 = stream.length - 1; i2 >= 0; i2--) {
          const [nx, ny] = normalAt(i2);
          const hw = halfAt(i2) * kw;
          g.lineTo(stream[i2].x - nx * hw, clampY(stream[i2].y - ny * hw));
        }
        g.closePath();
      };
      // ① 계곡 벽 — 좌우에서 솟아 **먼 땅을 가린다**. 실루엣 가장자리가 있어야 계곡으로 읽힌다.
      // 벽은 바닥(GROUND.valley)과 **명도가 확실히 갈려야** 보인다 — 옛 값은 지면과 거의 같아 계곡이
      // "평지 위의 리본"으로 읽혔다(검토 라운드2 현실성 #13①). 볕 받는 쪽은 더 밝게, 그늘 쪽은 더 어둡게.
      const WALL: Record<SeasonKey, [string, string]> = {
        spring: ["#dcecc8", "#5d7554"],
        summer: ["#cbe2b2", "#465e40"],
        autumn: ["#d6cfae", "#54503a"],
        winter: ["#ffffff", "#7d90a3"]
      };
      const [wallLit, wallShade] = WALL[season];
      for (const sd of [-1, 1]) {
        // 벽 능선(QA 라운드 3 A#4·소유자 "아래 모서리에서 비스듬한 직선"): 옛 `inset .3 − .27t`는 지평선 w·.30 → 발치 w·.03으로
        // **곧게 수렴**하는 현이었고 흔들림(≤ 70px 저주파)이 현을 못 벗어나 무대 세트 판 두 장으로 읽혔다. 이제 발치는 w·.12에서
        // 넓게 끝나고(모서리로 안 몰림), 저주파 "무릎" 두셋(진폭 w·.05~.07)이 능선을 굽힌다 — 200px 구간마다 현 이탈 ≥ 8px.
        const ridge = (t: number) => {
          const inset = 0.3 - 0.18 * t; // 지평선에서 30% 안쪽 → 발치에서 12%
          const knee = Math.sin(t * 3.4 + (sd > 0 ? 1.4 : 0.3)) * w * 0.055 + Math.sin(t * 7.9 + (sd > 0 ? 2.6 : 1.1)) * w * 0.028;
          const wob = Math.sin(t * 13.1 + (sd > 0 ? 0.7 : 3.3)) * w * 0.012 + Math.sin(t * 2.3) * w * 0.02;
          return sd < 0 ? w * inset + knee + wob : w * (1 - inset) - knee + wob;
        };
        const wc2 = sd < 0 ? wallLit : wallShade;
        // 벽은 **폴리곤 한 장**이다 — 가로 띠를 잇대어 칠하면 3px 간격 스캔라인이 지면을 덮는다(사이클4 경계 #1).
        // 가로 그라데이션(가장자리 짙음 → 능선 투명) + 세로 페이드(지평선 쪽이 안개에 스민다) 두 번의 fill.
        const wallPath = () => {
          g.beginPath();
          g.moveTo(sd < 0 ? 0 : w, gy());
          for (let y = gy(); y <= h + 4; y += 8) {
            const t = (y - gy()) / Math.max(1, h - gy());
            g.lineTo(ridge(Math.min(1, t / 1.06)), y);
          }
          g.lineTo(sd < 0 ? 0 : w, h + 4);
          g.closePath();
        };
        const rxMid = ridge(0.5);
        const gx = g.createLinearGradient(sd < 0 ? 0 : w, 0, rxMid, 0);
        gx.addColorStop(0, `${wc2}f0`);
        gx.addColorStop(0.55, `${wc2}80`);
        gx.addColorStop(1, `${wc2}00`);
        g.save();
        wallPath();
        g.clip();
        g.fillStyle = gx;
        g.fillRect(0, gy(), w, h - gy() + 4);
        // 지평선 쪽 페이드 — 위 22%는 안개에 스민다.
        const gy2 = g.createLinearGradient(0, gy(), 0, gy() + (h - gy()) * 0.24);
        gy2.addColorStop(0, "rgb(0 0 0 / 1)");
        gy2.addColorStop(1, "rgb(0 0 0 / 0)");
        g.globalCompositeOperation = "destination-out";
        g.fillStyle = gy2;
        g.fillRect(0, gy(), w, (h - gy()) * 0.24 + 2);
        g.restore();
        // 능선 — 가린다는 신호. 밝은 능선 선 + 그 **바로 아래** 그늘(사면이 꺾인다는 유일한 증거).
        g.save();
        g.lineWidth = 5;
        for (let k2 = 1; k2 <= 28; k2++) {
          const t0 = (k2 - 1) / 28;
          const t1 = k2 / 28;
          // 밝은 능선 획은 **끊기며 흩어진다**(라운드 3 A#4 (b): 폭 1~5px 연속 흰 선 ≥ 120px 금지) — 조각마다 밝기 ±40%, 넷 중 하나는 비운다.
          const wobA = 0.6 + 0.4 * Math.sin(k2 * 1.9 + (sd > 0 ? 0.4 : 2.2));
          const a = Math.min(1, t1 / 0.24) * 0.11 * wobA;
          if (k2 % 4 === (sd > 0 ? 1 : 3)) {
            g.lineWidth = 5;
          } else {
            g.strokeStyle = `rgb(255 255 255 / ${a})`;
            g.beginPath();
            g.moveTo(ridge(t0), groundY(t0 * 1.06));
            g.lineTo(ridge(t1), groundY(t1 * 1.06));
            g.stroke();
          }
          // 능선 안쪽(계곡 쪽) 그늘 — 사면이 아래로 꺾인다.
          g.strokeStyle = `rgb(${RIDGE[season]} / ${a * 0.55})`;
          g.lineWidth = 11;
          g.beginPath();
          g.moveTo(ridge(t0) - sd * 7, groundY(t0 * 1.06) + 5);
          g.lineTo(ridge(t1) - sd * 7, groundY(t1 * 1.06) + 5);
          g.stroke();
          g.lineWidth = 5;
        }
        g.restore();
      }
      // ①-b 곡지형의 단면 — 물길 쪽이 낮고 양 가장자리가 높다. 이 명암이 없으면 "평지 위의 강"이다
      // (사이클5 현실성 #8①: "계곡이 없다"). 가로 그라데이션 두 겹으로 V자를 만든다.
      {
        const cx5 = (t: number) => cxAxis(Math.min(1, t));
        for (let y = gy(); y < h; y += 6) {
          const t = (y - gy()) / Math.max(1, h - gy());
          const ax = cx5(t);
          const gl = g.createLinearGradient(0, 0, ax, 0);
          gl.addColorStop(0, "rgb(40 48 38 / 0.2)");
          gl.addColorStop(1, "rgb(40 48 38 / 0)");
          g.fillStyle = gl;
          g.fillRect(0, y, ax, 7);
          const gr = g.createLinearGradient(w, 0, ax, 0);
          gr.addColorStop(0, "rgb(40 48 38 / 0.26)");
          gr.addColorStop(1, "rgb(40 48 38 / 0)");
          g.fillStyle = gr;
          g.fillRect(ax, y, w - ax, 7);
        }
      }
      // ② 계곡 바닥 — 벽 사이의 좁은 띠(하폭의 4배 이내). 자갈·모래.
      {
        const fg2 = g.createLinearGradient(0, gy(), 0, h);
        fg2.addColorStop(0, season === "winter" ? "#dee7f1" : "#a39e88");
        fg2.addColorStop(1, season === "winter" ? "#cad7e5" : "#938f77");
        g.save();
        ribbonPath(1.5);
        g.clip();
        g.fillStyle = fg2;
        g.fillRect(0, gy(), w, h - gy());
        g.restore();
      }
      // ③ 자갈톱(퇴적사면) — 굽이 안쪽의 밝은 초승달.
      for (const b of bends) {
        const [nx, ny] = normalAt(b.i);
        const side = -b.side;
        for (let d = -5; d <= 5; d++) {
          const ii = Math.min(stream.length - 1, Math.max(0, b.i + d));
          const hw = halfAt(ii);
          const px = stream[ii].x + nx * side * (hw * (0.5 + 0.06 * Math.abs(d)));
          const py = stream[ii].y + ny * side * (hw * (0.5 + 0.06 * Math.abs(d)));
          softBlob(g, px, py, hw * (0.9 - 0.06 * Math.abs(d)), season === "winter" ? "236 242 248" : "206 196 172", 0.5 - 0.03 * Math.abs(d), 0, GROUND_SQUASH);
        }
      }
      // ④ 물 — 자갈 둔치 → 얕은 여울. 겨울엔 언다.
      const WATER: Record<SeasonKey, [string, string]> = {
        spring: ["rgb(154 146 120 / 0.4)", "rgb(63 125 118 / 0.95)"],
        summer: ["rgb(150 142 116 / 0.4)", "rgb(58 120 112 / 0.95)"],
        autumn: ["rgb(146 134 106 / 0.4)", "rgb(72 122 114 / 0.93)"],
        // 옛 214/228/238은 설원(#f0f6fd~#a4bcd4)과 명도가 같아 물길이 활주로로 보였다(검토 라운드2 #6·#9).
        winter: ["rgb(178 190 202 / 0.5)", "rgb(146 174 196 / 0.95)"]
      };
      const [wGravel, wShallow] = WATER[season];
      const ribbon = (kw: number, col: string) => {
        ribbonPath(kw);
        g.fillStyle = col;
        g.fill();
      };
      // 자갈 둔치는 굽이 **안쪽(퇴적사면)**에만 넓다 — 좌우 등폭이면 포장도로의 갓길이 된다(사이클4 미관 #3).
      {
        g.beginPath();
        for (let i2 = 0; i2 < stream.length; i2++) {
          const [nx, ny] = normalAt(i2);
          // 이 지점이 어느 쪽으로 휘는지 = 안쪽 방향(곡률 부호).
          const a2 = stream[Math.max(0, i2 - 2)];
          const b2 = stream[Math.min(stream.length - 1, i2 + 2)];
          const cross = (stream[i2].x - a2.x) * (b2.y - stream[i2].y) - (stream[i2].y - a2.y) * (b2.x - stream[i2].x);
          const inner = cross > 0 ? 1 : -1;
          const hwIn = halfAt(i2) * 1.42;
          const hwOut = halfAt(i2) * 1.02;
          const hp = inner > 0 ? hwIn : hwOut;
          const px = stream[i2].x + nx * hp;
          const py = clampY(stream[i2].y + ny * hp);
          if (i2 === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        for (let i2 = stream.length - 1; i2 >= 0; i2--) {
          const [nx, ny] = normalAt(i2);
          const a2 = stream[Math.max(0, i2 - 2)];
          const b2 = stream[Math.min(stream.length - 1, i2 + 2)];
          const cross = (stream[i2].x - a2.x) * (b2.y - stream[i2].y) - (stream[i2].y - a2.y) * (b2.x - stream[i2].x);
          const inner = cross > 0 ? 1 : -1;
          const hm = inner < 0 ? halfAt(i2) * 1.42 : halfAt(i2) * 1.02;
          g.lineTo(stream[i2].x - nx * hm, clampY(stream[i2].y - ny * hm));
        }
        g.closePath();
        g.fillStyle = wGravel;
        g.fill();
      }
      ribbon(1, wShallow);
      // 얕은 물 선반 — 굽이 **안쪽**만 밝다(자갈톱 위로 물이 얕게 깔린다).
      for (const b of bends) {
        const [nx, ny] = normalAt(b.i);
        const side = -b.side;
        const hw = halfAt(b.i);
        g.save();
        ribbonPath(1);
        g.clip();
        for (let d = -6; d <= 6; d++) {
          const ii = Math.min(stream.length - 1, Math.max(0, b.i + d));
          const [nx2, ny2] = normalAt(ii);
          const hw2 = halfAt(ii);
          softBlob(
            g,
            stream[ii].x + nx2 * side * hw2 * 0.62,
            stream[ii].y + ny2 * side * hw2 * 0.62,
            hw2 * 0.8,
            season === "winter" ? "236 244 250" : "150 195 186",
            0.55 - 0.04 * Math.abs(d),
            0,
            GROUND_SQUASH
          );
        }
        g.restore();
        void nx;
        void ny;
        void hw;
      }
      // ⑤ 소 — 굽이 정점의 바깥 기슭이 가장 깊고 어둡다.
      for (const b of bends) {
        const [nx, ny] = normalAt(b.i);
        const hw = halfAt(b.i);
        const px = stream[b.i].x + nx * b.side * hw * 0.42;
        const py = stream[b.i].y + ny * b.side * hw * 0.42;
        g.save();
        ribbonPath(1);
        g.clip();
        if (season === "winter") {
          // 얼음 위의 열린 물 — 부드러운 얼룩이 아니라 **테두리가 있는 구멍**이다(사이클3 경계 #12).
          g.fillStyle = "rgb(74 100 124 / 0.85)";
          g.beginPath();
          g.ellipse(px, py, hw * 0.7, hw * 0.7 * GROUND_SQUASH, 0, 0, TAU);
          g.fill();
          g.strokeStyle = "rgb(236 246 255 / 0.9)";
          g.lineWidth = 2.4;
          g.stroke();
        } else {
          // 깊은 자리는 **윤곽이 있는 면**이다 — 부드러운 방사 얼룩은 "오염"으로 읽힌다(사이클4 경계 #9).
          for (const [kk, col] of [[1.35, "rgb(48 96 94 / 0.45)"], [0.9, "rgb(30 68 68 / 0.5)"], [0.5, "rgb(20 50 52 / 0.45)"]] as const) {
            g.fillStyle = col;
            g.beginPath();
            for (let q = 0; q <= 14; q++) {
              const a2 = (q / 14) * TAU;
              const wob = 0.85 + 0.24 * Math.sin(a2 * 3 + px * 0.02) + 0.1 * Math.sin(a2 * 5 + py * 0.03);
              const qx = px + Math.cos(a2) * hw * kk * wob;
              const qy = py + Math.sin(a2) * hw * kk * wob * GROUND_SQUASH;
              if (q === 0) g.moveTo(qx, qy);
              else g.lineTo(qx, qy);
            }
            g.closePath();
            g.fill();
          }
        }
        g.restore();
      }
      // ⑥ 여울 — 변곡점에서 흰 부서진 물이 물길을 가로지른다(겨울엔 얼어 없다).
      if (season !== "winter") {
        for (let bIdx = 0; bIdx < bends.length - 1; bIdx++) {
          const iA = Math.round((bends[bIdx].i + bends[bIdx + 1].i) / 2);
          const hw = halfAt(iA);
          g.save();
          ribbonPath(1);
          g.clip();
          // 여울 — 부서진 흰 물은 **흐름 방향(하류)**으로 늘어진다. 유로를 가로지르는 선은 도로 중앙선으로
          // 읽힌다(사이클4 현실성 #2). 짧은 획을 폭 방향으로 흩어 놓되 각 획은 흐름을 따라 눕는다.
          g.lineCap = "round";
          for (let m = 0; m < 16; m++) {
            const ii = Math.min(stream.length - 2, Math.max(1, iA + Math.round((g0() - 0.5) * 6)));
            const [nx, ny] = normalAt(ii);
            const off = (g0() - 0.5) * 1.7 * hw;
            const px = stream[ii].x + nx * off;
            const py = stream[ii].y + ny * off;
            const dx = stream[ii + 1].x - stream[ii].x;
            const dy = stream[ii + 1].y - stream[ii].y;
            const dl = Math.hypot(dx, dy) || 1;
            const len = 6 + g0() * 16;
            g.strokeStyle = `rgb(238 243 242 / ${0.25 + g0() * 0.35})`;
            g.lineWidth = 1 + g0() * 2.2;
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(px + (dx / dl) * len, py + (dy / dl) * len);
            g.stroke();
          }
          g.restore();
        }
      }
      // ⑥-b 물 밖으로 튀어나온 바위 — 흐름을 갈라야 강이 도로가 아니라 강으로 읽힌다(사이클4 미관 #3).
      for (let k2 = 0; k2 < 5; k2++) {
        const ii = Math.round(stream.length * (0.3 + k2 * 0.14 + g0() * 0.06));
        if (ii >= stream.length - 1) continue;
        const [nx, ny] = normalAt(ii);
        const hw = halfAt(ii);
        const off = (g0() - 0.5) * hw * 1.1;
        const x = stream[ii].x + nx * off;
        const y = stream[ii].y + ny * off;
        const k = (0.5 + g0() * 0.5) * depthScale(y, h);
        // 물에 박힌 바위(QA 라운드 1 S-4) — 발치 10k가 물색으로 물들고 젖은 띠가 생긴다.
        const VALLEY_WATER: Record<SeasonKey, string> = { spring: "63 125 118", summer: "58 120 112", autumn: "72 122 114", winter: "146 174 196" };
        // alphaDeep .42 → .12(라운드 7, 검토 B #9): 잠긴 부분 아래 끝이 직선으로 끊겨 "판"으로 보였다.
        drawSubmerged(g, art, "rock", x, y, { k, r: g0(), flip: g0() < 0.5, depth: 10 * k, water: VALLEY_WATER[season], wet: season === "winter" ? 0.12 : 0.26, alphaDeep: 0.12 });
        // 상류 흰 물살은 **바위 뒤가 아니라 위**에 — 옛 코드는 `drawSubmerged`보다 먼저 그려 몸통에 100% 가려졌다
        // (검토 B #9: "상류 물살이 몸에 가려지고 후류 두 줄만 발밑에서 세로로 뻗어 다리를 짚은 탁자"). 순서를 뒤집는다.
        g.strokeStyle = "rgb(244 250 250 / 0.5)";
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x - 12 * k, y - 9 * k);
        g.quadraticCurveTo(x, y - 15 * k, x + 12 * k, y - 9 * k);
        g.stroke();
        // 앞 반원 수면선 — 민물(`rockRing`)에는 있고 계곡에만 없었다. 물에 잠긴 경계를 말하는 가장 싼 단서다.
        g.strokeStyle = "rgb(236 246 246 / 0.34)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(x, y - 2 * k, 13 * k, 4.4 * k, 0, 0.12, Math.PI - 0.12);
        g.stroke();
        // 후류(꼬리) — **바위 폭 바깥**에서, 8~12px 뒤부터 시작해 끝을 흐린다. 발밑에서 곧게 뻗으면 다리가 된다.
        for (const sgn of [-1, 1] as const) {
          const x0 = x + sgn * 13 * k;
          const y0 = y + 10 * k;
          const wg = g.createLinearGradient(0, y0, 0, y0 + 20 * k);
          wg.addColorStop(0, "rgb(255 255 255 / 0.26)");
          wg.addColorStop(1, "rgb(255 255 255 / 0)");
          g.strokeStyle = wg;
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo(x0 + sgn * 2 * k, y0 + 10 * k, x0 + sgn * 5 * k, y0 + 20 * k);
          g.stroke();
        }
      }
      // ⑦ 물가 마감. 여름·봄·가을 = 젖은 바위 띠(마른 바위보다 30~40% 어둡다).
      //    겨울 = **눈 두둑**(양안에 소복이) + 부분 결빙 구멍. 옛 균일 회색 두 줄은 좌우 대칭이라 차선으로
      //    읽혔다(검토 라운드2 #6·#9).
      if (season !== "winter") {
        g.save();
        ribbonPath(1.34);
        g.clip();
        ribbonPath(1.03);
        g.strokeStyle = "rgb(133 125 123 / 0.5)";
        g.lineWidth = 7;
        g.stroke();
        g.restore();
      } else {
        // 눈 두둑 — 양안을 따라 끊어진 흰 덩이(굵기가 들쭉날쭉해야 '쌓인 눈'으로 읽힌다).
        // 결빙 가장자리는 **불투명하고 경계가 뚜렷한 얼음 선반**이다 — 부드러운 블롭을 이어 붙이면 강이
        // 스스로 발광하는 흰 후광이 된다(사이클3 현실성 #6). 몇 군데에만, 다각형으로.
        for (const sd of [-1, 1]) {
          // 좌우를 번갈아 띄엄띄엄 — 같은 자리에 겹쳐 찍으면 동심 초승달이 된다(사이클5 경계 #7).
          let i2 = (sd < 0 ? 4 : 12) + Math.floor(g0() * 5);
          while (i2 < stream.length - 5) {
            const len = 4 + Math.floor(g0() * 5);
            g.fillStyle = "rgb(248 252 255 / 0.9)";
            g.beginPath();
            for (let k3 = 0; k3 <= len; k3++) {
              const ii = Math.min(stream.length - 1, i2 + k3);
              const [nx, ny] = normalAt(ii);
              const hw = halfAt(ii);
              const t3 = Math.sin((k3 / len) * Math.PI);
              const o = hw * (1.0 + 0.02);
              const x = stream[ii].x + nx * sd * o;
              const y = stream[ii].y + ny * sd * o;
              if (k3 === 0) g.moveTo(x, y);
              else g.lineTo(x, y);
              void t3;
            }
            for (let k3 = len; k3 >= 0; k3--) {
              const ii = Math.min(stream.length - 1, i2 + k3);
              const [nx, ny] = normalAt(ii);
              const hw = halfAt(ii);
              const t3 = Math.sin((k3 / len) * Math.PI);
              const o = hw * (1.0 - 0.1 - 0.5 * t3);
              g.lineTo(stream[ii].x + nx * sd * o, stream[ii].y + ny * sd * o);
            }
            g.closePath();
            g.fill();
            i2 += len + 12 + Math.floor(g0() * 12);
          }
        }
        // 부분 결빙 — 얼음이 깨져 검은 물이 드러난 구멍 둘(얼음이 '면'이라는 신호).
        for (let k2 = 0; k2 < 2; k2++) {
          const ii = Math.round(stream.length * (0.42 + k2 * 0.3));
          const hw = halfAt(ii);
          g.save();
          ribbonPath(0.92);
          g.clip();
          softBlob(g, stream[ii].x + (g0() - 0.5) * hw, stream[ii].y, hw * (0.42 + g0() * 0.3), "40 62 82", 0.62, 0, GROUND_SQUASH);
          g.restore();
        }
      }
      // ⑧ 바위 — 굽이 **바깥**에만 모인다(직선 구간엔 없다).
      for (const b of bends) {
        const [nx, ny] = normalAt(b.i);
        const hw = halfAt(b.i);
        for (let k2 = 0; k2 < 5; k2++) {
          const ii = Math.min(stream.length - 1, Math.max(0, b.i + Math.round((g0() - 0.5) * 7)));
          const off = hw * (0.85 + g0() * 0.7) * b.side;
          const x = stream[ii].x + nx * off;
          const y = stream[ii].y + ny * off;
          const k = (0.9 + g0() * 0.8) * depthScale(y, h);
          if (!claimSpot(x, y, 20 * k)) continue;
          shadow(g, x + 2, y - 1, 30 * k, 0.16);
          drawProp(g, art, "rock", x, y, { k, r: g0(), flip: b.side < 0 });
        }
      }
      // ⑨ 하식애 + 굴 — 급한 굽이 바깥. 3/4 시점에선 입술 밑의 **어두운 초승달**(화면에서 가장 어두운 값), 발치엔 너덜.
      if (bends.length) {
        const b = bends[Math.max(0, Math.min(bends.length - 1, Math.floor(bends.length * 0.45)))];
        const [nx, ny] = normalAt(b.i);
        const hw = halfAt(b.i);
        // 하식애는 물 **바깥**의 기슭에 선다 — 1.05는 물 위였다(검토 라운드2 현실성 #4).
        const cx4 = stream[b.i].x + nx * b.side * hw * 1.85;
        const cy4 = Math.max(gy() + 30, stream[b.i].y + ny * b.side * hw * 1.85);
        g.save();
        g.fillStyle = "#9e9d9c";
        g.beginPath();
        g.ellipse(cx4, cy4 - hw * 0.16, hw * 0.72, hw * 0.36, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#857d7b";
        g.beginPath();
        g.ellipse(cx4, cy4, hw * 0.66, hw * 0.22, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#4a453d";
        g.beginPath();
        g.ellipse(cx4, cy4 - hw * 0.04, hw * 0.2, hw * 0.09, 0, Math.PI, TAU);
        g.fill();
        g.fillStyle = "#332f28";
        g.beginPath();
        g.ellipse(cx4, cy4 - hw * 0.06, hw * 0.12, hw * 0.05, 0, Math.PI, TAU);
        g.fill();
        g.fillStyle = "rgb(96 92 88 / 0.5)";
        for (let k2 = 0; k2 < 9; k2++) {
          const a2 = Math.PI + g0() * Math.PI;
          g.beginPath();
          g.ellipse(cx4 + Math.cos(a2) * hw * 0.8 * g0(), cy4 - hw * 0.2 + Math.sin(a2) * hw * 0.3 * g0(), 2 + g0() * 5, 1.5 + g0() * 3, 0, 0, TAU);
          g.fill();
        }
        g.restore();
        for (let k2 = 0; k2 < 7; k2++) {
          const a2 = Math.PI * (0.15 + g0() * 0.7);
          const d = hw * (0.6 + g0() * 0.9);
          drawProp(g, art, "pebble", cx4 + Math.cos(a2) * d, cy4 + Math.sin(a2) * d * 0.5, { k: 1 + g0() * 1.4, r: g0(), sy: GROUND_SQUASH, rot: g0() * TAU });
        }
      }
      // ⑩ 풀·관목은 벽 쪽에만 — 물길 옆에 잔디 마진이 생기면 공원이 된다.
      const tufts = Math.round((w * h) / 3000);
      clumpLeft = 0;
      for (let i2 = 0; i2 < tufts; i2++) {
        const x = g0() * w;
        const y = groundY(g0());
        let near = false;
        for (let k2 = 0; k2 < stream.length; k2 += 2) {
          if (Math.abs(stream[k2].y - y) < 24 && Math.abs(stream[k2].x - x) < halfAt(k2) * 2.6) {
            near = true;
            break;
          }
        }
        if (near) continue;
        tuftAt(g, x, y, (0.55 + g0() * 1.0) * depthScale(y, h) * smallK(y), g0(), g0() < 0.5, 0.85);
      }
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 5, band: "any" }, { id: `shrub-${season}`, n: 5, band: "any" }]);
      // ⑩-b 수변 식생 — 하안 40px가 완전 무식생이면 생태적으로 정반대다(사이클4 현실성 #2). 물가를 따라
      // 사초·관목이 띠를 이룬다(물 위에는 서지 않게 자갈 둔치 바깥에만).
      for (let i2 = 2; i2 < stream.length - 2; i2 += 1) {
        const [nx, ny] = normalAt(i2);
        const hw = halfAt(i2);
        for (const sd of [-1, 1]) {
          if (g0() < 0.45) continue;
          const off = hw * (1.5 + g0() * 0.7) * sd;
          const x = stream[i2].x + nx * off;
          const y = stream[i2].y + ny * off;
          if (y < gy() + 10 || y > h - 4 || x < 0 || x > w) continue;
          const k = (0.5 + g0() * 0.7) * depthScale(y, h) * smallK(y);
          if (g0() < 0.24) drawProp(g, art, `shrub-${season}`, x, y, { k: k * 0.9, r: g0(), flip: g0() < 0.5 });
          else drawProp(g, art, season === "winter" || season === "autumn" ? "grass-dry" : "grass-tuft", x, y, { k: k * 1.5, r: g0(), flip: g0() < 0.5, alpha: 0.9 });
        }
      }
      // ⑪ 상류 끝을 안개에 녹인다 — 물길이 지평선 바로 아래에서 딱 끝나면 "잘린 리본"이 된다.
      {
        const HZC: Record<SeasonKey, string> = { spring: "232 240 226", summer: "226 236 222", autumn: "228 224 214", winter: "240 243 247" };
        const veil = g.createLinearGradient(0, gy(), 0, groundY(0.3));
        veil.addColorStop(0, `rgb(${HZC[season]} / 1)`);
        veil.addColorStop(0.3, `rgb(${HZC[season]} / 0.8)`);
        veil.addColorStop(0.62, `rgb(${HZC[season]} / 0.34)`);
        veil.addColorStop(1, `rgb(${HZC[season]} / 0)`);
        g.fillStyle = veil;
        g.fillRect(0, gy(), w, groundY(0.3) - gy());
      }
      foam.length = 0;
      for (let i2 = 0; i2 < 22; i2++) foam.push({ u: g0(), lane: (g0() - 0.5) * 1.6, sp: 0.04 + g0() * 0.09 });
    } else {
      // 산 — 바위·눈 얼룩(겨울·봄엔 눈이 남는다), 위 띠는 봉우리(지평선 굽기가 크게).
      // 봉우리는 **별도 캔버스**에 굽는다 — 바탕에 구우면 그 위에 지평선 띠(먼 언덕·나무 점)가 덮여
      // 봉우리 비탈에 나무가 서 있는 그림이 된다(2026-09-04 검토 4차).
      // 라운드 5(B#1 "산 층 순서가 뒤집혀 있다"): 봉우리 ①②·애추 띠·원경 침엽수를 **바탕 캔버스에, 소품(너덜·큰 바위·벨트)보다 먼저** 굽는다.
      // 옛 별도 봉우리 캔버스는 draw()에서 바탕 위에 얹혀 먼 것(② 발치·반투명 침엽수)이 가까운 바위·소나무를 덮었다(겹침 단서 역전).
      // 지평선 띠(산 프로파일 = 안개만)가 그 위에 오는 것은 대기 원근이라 무방. 하늘은 draw()에서 ① 능선 위만 clip해 그린다.
      const gp = g;
      const rc2 = document.createElement("canvas");
      rc2.width = Math.max(1, Math.ceil(w * dpr));
      rc2.height = Math.max(1, Math.ceil(h * dpr));
      const rg = rc2.getContext("2d")!;
      rg.scale(dpr, dpr);
      ridgeC = rc2;
      // 봉우리 — 산을 산으로 만드는 유일한 신호. 지평선 띠 바로 아래에 두 겹(뒤가 밝고 옅다), 꼭대기에 만년설.
      const peak = (baseV: number, amp: number, fill: string, alpha: number, ph: number, snowLine: number, cap: boolean, rimGlow = false) => {
        const g = gp;
        g.save();
        g.globalAlpha = alpha;
        const base = groundY(baseV);
        const foot = base + (h - gy()) * 0.182; // = 옛 h·.16(hz .12 기준)
        // 능선은 사인 곡선이 아니라 **각진 걸음**이다(부드러운 혹 두 개 = 회색 벽). 결정적 rng로 걸어 올린다.
        const pr = rng(Math.round(ph * 977) + 41);
        // 봉우리 천장 — **지평선 위 .06h**(2026-09-06 라운드 7). 라운드 6에선 B의 조언대로 지평선 아래(hz+18)에
        // 가뒀는데, A가 실측으로 뒤집었다: 같은 빌드에서 **초원의 먼 언덕이 y 120~147(지평선 위 77~104px)**인데
        // 산의 최고봉은 y 243~263(지평선 **아래** 19~39px) — 초원 언덕이 산보다 100px 높아 산 바이옴의 정체성이
        // 실루엣에서 사라졌다(R-2). "지평선 띠에 땅의 것은 없다"는 규칙은 `bakeHorizon`의 먼 언덕 자신이 이미
        // 예외이며(그 띠가 곧 원경의 땅이다), 산은 그 원경의 주인공이다. 안개 위로 솟은 봉우리는 MOUNTAIN §4
        // 안개 행이 명시적으로 허용한다("구름 바다"). 아래 하한(gy() + gh·.005)은 그대로 — 발치는 땅에 붙는다.
        const peakTop = aboveHz(h, 0.06);
        const ridge: number[] = [];
        let yv = base - amp * 0.15;
        let slope = (pr() - 0.5) * 0.6;
        const step = 14; // 26은 꺾임점이 그대로 보이는 각진 폴리라인이 됐다(사이클5 경계 #6)
        for (let x = -step; x <= w + step; x += step) {
          // 꺾임 확률 .14 → .2, 되돌리는 힘 .06 → .045: 옛 값은 오른쪽 절반이 650px 직선 고원이 됐다(QA 라운드 1 A#2).
          if (pr() < 0.2) slope = (pr() - 0.5) * 2.2; // 봉우리·안부
          yv -= slope * step * 0.5;
          yv += (base - amp * 0.55 - yv) * 0.045; // 평균 고도로 되돌리는 힘
          // 꼭대기 근처에서 꺾어 내린다 — 옛 clamp(gy()+4)는 ①의 오른쪽 700px을 지평선에 붙은 평탄 고원으로 만들었다(라운드 4 A#7·B#4).
          // 2026-09-06(하늘 확대): 천장은 지평선이 아니라 **지평선 위 .10h**다 — 산은 수평선을 넘어야 산이다.
          // 지평선에서 멈췄 hz가 .28로 오르면 봉우리가 화면 아래쪽에 주저앉고 위로는 빈 하늘 판만 남는다.
          // 하늘 판·별은 ① 능선 위만 clip하므로(draw) 봉우리가 하늘을 가리는 관계는 그대로다.
          if (yv < peakTop) {
            yv = peakTop + (peakTop - yv) * 0.6;
            slope = -Math.abs(slope) - 0.3;
          }
          ridge.push(Math.max(peakTop, Math.min(base - amp * 0.05, yv)));
        }
        // 이웃 평균 한 번 — 걸음의 각을 눕힌다(만년설·암반 전이가 칼같이 꺾이지 않게).
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 1; i < ridge.length - 1; i++) ridge[i] = (ridge[i - 1] + ridge[i] * 2 + ridge[i + 1]) / 4;
        }
        if (rimGlow) ridge1 = { pts: ridge.slice(), step }; // ① 능선 — draw()가 하늘·별을 이 위에만 그린다(라운드 5)
        const yAt = (x: number) => {
          const i = Math.max(0, Math.min(ridge.length - 2, Math.floor((x + step) / step)));
          const t2 = ((x + step) / step) - i;
          return ridge[i] + (ridge[i + 1] - ridge[i]) * t2;
        };
        const silhouette = () => {
          g.beginPath();
          g.moveTo(-step, foot);
          for (let x = -step; x <= w + step; x += step / 2) g.lineTo(x, yAt(x));
          g.lineTo(w + step, foot);
          g.closePath();
        };
        // 발치는 **투명으로 녹이지 않는다**(QA 라운드 1 D-2: "산에 발이 없다") — 그 높이의 땅색으로 맞물려 ③층(애추·침엽수)이
        // 그 위를 덮는다. 아래 들쭉 컷이 가장자리를 흩는다.
        const [gc0, gc1] = GROUND[kind][season];
        const footGround = mixHex(gc0, gc1, (foot - gy()) / Math.max(1, h - gy()));
        if (rimGlow) {
          // 능선 위 하늘 림 광(라운드 5 AMB-D1-03, B: 하늘↔①이 능선 바로 위에서 1.0~2.9 L) — 먼 능선 뒤의 대기가 밝다(역광 산란).
          // 능선 위 28px에서 α .34 → 0. 열마다 능선 y를 따라간다(2px 열, 픽셀 격자).
          for (let x = 0; x < w; x += 2) {
            const yq = Math.round(yAt(x + 1) / 2) * 2;
            const gl = g.createLinearGradient(0, yq - 24, 0, yq);
            gl.addColorStop(0, "rgb(240 244 248 / 0)");
            gl.addColorStop(1, "rgb(240 244 248 / 0.3)");
            g.fillStyle = gl;
            g.fillRect(x, yq - 24, 2, 24);
          }
        }
        const fg = g.createLinearGradient(0, base - amp, 0, foot);
        fg.addColorStop(0, fill);
        fg.addColorStop(0.55, fill);
        fg.addColorStop(1, footGround);
        g.fillStyle = fg;
        silhouette();
        g.fill();
        // 능선선(ridgeline) — 형태의 경계는 선이 있어야 읽힌다(MOUNTAIN_DEPTH_RULES §2): 위 1px 밝은 림 + 바로 아래 그늘 띠.
        // 림 밝기는 x 방향으로 흔들려 자로 그은 선이 되지 않는다.
        {
          // 같은 능선선을 봉우리 판(g)과 **능선선 전용 판(rg)**에 함께 긋는다 — 전용 판은 draw()가 조명(안개 배율·밤 어둡기)에 비례해
          // 한 번 더 얹어 능선 대비를 되살린다(QA 라운드 3 AMB-D1-01: 안개·밤에 하늘↔①·①↔② 단차가 규칙 아래로 눌렸다).
          const drawRidge = (c: CanvasRenderingContext2D, alphaK: number) => {
            // 픽셀 계단(라운드 5 AMB-D1-03, A#7 "AA 벡터 컨투어"): 2px 열마다 능선 y를 2px 격자에 스냅해 사각으로 찍는다 — 림 1행(2px) +
            // 아래 그늘 띠 6px(L−7 급) + 옅은 꼬리 4px. 림 밝기는 열마다 ±30% 흔들린다(자로 그은 선 금지). 앞의 픽셀 소나무·바위와 같은 어법.
            const rr = rng(Math.round(ph * 131) + 7);
            c.save();
            c.globalAlpha = alpha * alphaK;
            for (let x = 0; x < w; x += 2) {
              const yq = Math.round(yAt(x + 1) / 2) * 2;
              const wob = 0.7 + 0.6 * rr();
              c.fillStyle = "rgb(40 52 66 / 0.12)";
              c.fillRect(x, yq + 1, 2, 5);
              c.fillStyle = "rgb(40 52 66 / 0.05)";
              c.fillRect(x, yq + 6, 2, 4);
              c.fillStyle = `rgb(255 255 255 / ${(0.18 * wob).toFixed(3)})`;
              c.fillRect(x, yq - 1, 2, 2);
            }
            c.restore();
          };
          drawRidge(g, 1);
          drawRidge(rg, 1);
        }
        // 빛(북서)과 그늘 — 능선에서 오른쪽 아래로 내려가는 면만 어둡게.
        g.save();
        silhouette();
        g.clip();
        // 면마다 사각형을 채우면 세로 이음매가 남아 "반투명 직사각형"으로 보인다(검토 5차) →
        // 북서 광원 방향의 대각 그라데이션 한 겹으로 밝은 면/그늘 면을 만든다.
        const lg = g.createLinearGradient(0, base - amp, w * 0.9, foot);
        lg.addColorStop(0, "rgb(255 255 255 / 0.1)");
        lg.addColorStop(0.45, "rgb(255 255 255 / 0)");
        lg.addColorStop(0.85, "rgb(40 52 66 / 0.12)");
        lg.addColorStop(1, "rgb(40 52 66 / 0)");
        g.fillStyle = lg;
        g.fillRect(-step, gy(), w + step * 2, foot - gy() + 4);
        // 구곡(gully) 그늘은 **그리지 않는다**(QA 라운드 1). 옛 w/7 등간격 세로 사다리꼴 7개는 두 봉우리를 관통하는
        // "블라인드"였고, 안부 쐐기로 줄여도 옅은 세로 띠가 남아 보였다(after 1차 실측). 산체의 기복은 대각 광원 그라데이션(위)
        // + 능선선 + 설선 그늘이 말한다 — 세로 요소는 넣지 않는다(F-1 "전폭·세로 직선" 금지).
        // 발치 전 15%에서 덧칠·만년설을 0으로 — 실루엣 클립의 바닥이 직선이라 그대로 끝나면 전폭 가로선이 남는다.
        // 발치는 **길고 들쭉날쭉하게** 사라져야 한다 — 짧고 균일한 컷은 회색 판이 얹힌 직선 밑변이 된다
        // (검토 라운드2 경계 #6).
        g.save();
        // 바탕 캔버스에 굽으므로(라운드 5) 투명으로 뚫지 않고 — 뚫으면 페이지가 비친다 — 그 높이의 땅색으로 덧칠해 들쭉날쭉 맞물린다.
        for (let x = -step; x <= w + step; x += 10) {
          const gh2 = h - gy();
          const j = Math.sin(x * 0.0041 + ph) * gh2 * 0.034 + Math.sin(x * 0.013 + ph * 2.1) * gh2 * 0.017;
          const c0 = foot - (h - gy()) * 0.159 + j;
          const cut = g.createLinearGradient(0, c0, 0, foot + j + 6);
          cut.addColorStop(0, `${footGround}00`);
          cut.addColorStop(0.6, `${footGround}99`);
          cut.addColorStop(1, footGround);
          g.fillStyle = cut;
          g.fillRect(x, c0, 11, foot + j + 8 - c0);
        }
        g.restore();
        if (cap) {
          // 만년설 — 고도선 위, 능선을 따라 굽이친다.
          const snowY = (x: number) => yAt(x) + amp * snowLine * (0.5 + 0.5 * Math.sin(x * 0.006 + ph * 2.3));
          g.fillStyle = "rgb(250 253 255 / 0.8)";
          g.beginPath();
          g.moveTo(-step, 0);
          for (let x = -step; x <= w + step; x += step / 2) g.lineTo(x, snowY(x));
          g.lineTo(w + step, 0);
          g.closePath();
          g.fill();
          // 설선 아래 청회 그늘 띠 — 만년설·하늘·뒤 봉우리가 92~97 L 한 값으로 뭉쳐 "백 위 백"이었다(QA 라운드 1 B#2).
          g.strokeStyle = "rgb(150 168 190 / 0.34)";
          g.lineWidth = 3;
          g.beginPath();
          for (let x = -step; x <= w + step; x += step / 2) g.lineTo(x, snowY(x) + 2);
          g.stroke();
        }
        g.restore();
        g.restore();
      };
      // 먼 것은 **밝고 옅다**(대기 원근). 옛 값은 앞 땅보다 어두워 "먹구름 벽"으로 읽혔다(검토 4차).
      // 먼 것은 **더 밝고 대비가 낮다** — 옛 값은 근경(눈밭·마른 풀)보다 어두워 "뒤에 세운 벽"으로 읽혔다
      // (사이클3 현실성 #2: 대기 원근 역전).
      // 인접 층 명도 단차 ≥ 8L(MOUNTAIN_DEPTH_RULES §1) — 봄 ②·겨울 ①②는 6L 미만이라 한 판으로 읽혔다(QA 라운드 1 실측).
      // after 1차 실측(x 880~980 열, 안개·틴트 포함): 가을 ①73.9/②60.1/③59.1, 겨울 ①92.5/②82.2/③83.9 → ②↔③이 0에 가까웠다.
      // 가을은 ①·②를 함께 올려 하늘(81.6)↔①↔②↔③(59.1) 사이를 ≥ 8L씩 벌리고, 겨울은 ②를 눈밭(83.9)보다 8L 어둡게 —
      // 먼 산이 가까운 눈밭보다 어두운 것은 눈의 알베도라 대기 원근의 예외로 허용(MOUNTAIN_DEPTH_RULES §4 눈 행).
      const PEAK: Record<SeasonKey, [string, string]> = {
        spring: ["#d5dcdd", "#adb9bd"],
        summer: ["#c8d2ca", "#a9b6ba"],
        autumn: ["#c3bcac", "#aea494"], // 라운드 3 3차: 가을 ①·②를 4~5L 내려 하늘↔①(노을·밤 ≥ 3)과 ①↔②(≥ 5)를 동시에 — 가을 안개빛이 밝아 옛 값은 하늘에 붙었다
        winter: ["#e4ebf2", "#b2c0cf"]
      };
      // 봄 산이 겨울 산보다 하얗던 것(검토 라운드2 현실성 #6) — 봄은 **꼭대기 만년설만**, 지면 눈 얼룩은 없다.
      const snowy = season === "winter";
      const capSnow = season === "winter" || season === "spring";
      // 뒤 봉우리는 반투명(멀다), 앞 봉우리는 **불투명**이라야 뒤를 가린다 — 둘 다 반투명이면 셀로판 두 장이다.
      // 뒤 봉우리 ①은 **불투명**(QA 라운드 3 B 구조 A): α .5 반투명이면 ①의 밝기가 늘 하늘과 몸체색의 중간에 갇혀 하늘↔① 단차가 몸체–하늘 차의
      // 절반을 못 넘는다(라운드 2 실측 2.2~4.0). 같은 밝기를 색으로 만든다(몸체색과 안개빛의 반씩) — 밝기는 유지, 단차는 이제 직접 정한다.
      // 혼합 .25 — .5는 점심 ①이 86 L로 하늘(87.5)에 붙었고 노을·맑음에선 하늘보다 3.4 밝아 뒤집혔다(라운드 3 1차 after). 목표 점심 ① ≈ 83(하늘 −4, ② +8).
      // 혼합 .25/.1 → .18/.06(라운드 5 2차): 능선선을 옅게 하자 하늘↔① 국소가 3.4/2.1/1.4로 내려와 ①을 조금 더 어둡게 — ①↔②는 9.1이라 여유.
      peak(0.2, (h - gy()) * 0.386, mixHex(PEAK[season][0], "#e9edf0", season === "autumn" ? 0.06 : 0.18), 1, 1.2, 0.3, false, true);
      peak(0.32, (h - gy()) * 0.33, PEAK[season][1], 0.88, 3.4, season === "spring" ? 0.16 : 0.42, capSnow);
      // 발치 — 자락이 땅에 닿는 자리(너덜 띠). 알파 0으로 사라지면 "공중에 뜬 구름"이다.
      // 너덜 자락 — 옛 코드는 화면 폭 0.75짜리 **밝은 원 하나**라 "렌즈 얼룩"으로 보였다(검토 라운드2 미관 #12).
      // 봉우리 발치를 따라 낮고 넓게 깔린 어두운(밝지 않은) 애추 띠로 바꾼다.
      {
        // ③ 애추 띠(라운드 5 AMB-D1-02, B: 여름 ②↔③ 3.6~6.9 · 겨울 ②body↔③ |0.8~2.9| — ③에 구조가 없어 ②의 발이 ④에 바로 닿았다).
        // 봉우리 발치 v .34~.47에 **계단 다각형** 띠 — 위 가장자리는 굽이치고 2px 격자로 스냅(픽셀 어법), 아랫단은 땅색에 맞물린다.
        // 색: 그 높이 땅색을 ×.94(−3L) — ②(밝다)와 ④(어둡다) 사이에 든다. 겨울은 눈 위의 청회 그늘 띠(②body·눈밭 둘 다와 ≥ 8L).
        const [gc0, gc1] = GROUND[kind][season];
        const yTop = (x: number) => groundY(0.36 + Math.sin(x * 0.0034 + 0.9) * 0.028 + Math.sin(x * 0.011 + 2.2) * 0.012);
        const yBot = (x: number) => groundY(0.47 + Math.sin(x * 0.0027 + 1.7) * 0.02);
        const midV = 0.415;
        const groundMid = mixHex(gc0, gc1, midV);
        // 겨울 톤 1차 after: ②body 65.7 vs 띠 65.3 = 0.3(기준 |8|) → 더 어두운 청회(L ≈ 58).
        const tone = season === "winter" ? "#a8b6c6" : mixHex(groundMid, "#3c3c38", 0.11); // 겨울 대비 21L → 12L(라운드 7 B: 눈밭보다 21L 어두운 슬래브가 "얼어붙은 강")
        const tone2 = season === "winter" ? "#b8c4d2" : mixHex(groundMid, "#3c3c38", 0.05);
        gp.fillStyle = tone;
        gp.beginPath();
        // 밑변은 **곡선으로 닫는다** — 옛 `moveTo(0, yBot(0)+40) … lineTo(w, yBot(w)+40)`은 화면을 가로지르는
        // 직선 현(y 563~575)이었다(2026-09-06 라운드 7 B #3).
        gp.moveTo(0, yBot(0));
        for (let x = 0; x <= w; x += 2) gp.lineTo(x, Math.round(yTop(x) / 2) * 2);
        for (let x = w; x >= 0; x -= 8) gp.lineTo(x, yBot(x));
        gp.closePath();
        gp.fill();
        // 아랫단 — 땅색으로 맞물리는 그라데이션(투명 페이드 아님).
        const bg2 = gp.createLinearGradient(0, groundY(0.42), 0, groundY(0.5));
        bg2.addColorStop(0, `${tone}00`);
        bg2.addColorStop(1, mixHex(gc0, gc1, 0.5));
        gp.fillStyle = bg2;
        gp.beginPath();
        gp.moveTo(0, groundY(0.42));
        for (let x = 0; x <= w; x += 20) gp.lineTo(x, yBot(x));
        gp.lineTo(w, groundY(0.42));
        gp.closePath();
        gp.fill();
        // 옛 `fillRect(0, groundY(.5) − 1, w, 2)`는 **1400열 중 1373열(98.1%)이 아래보다 2L 이상 밝은**
        // 전폭 직선이었다(2026-09-06 라운드 7, 검토 A #5: "댐·고속도로"). 자로 그은 마감 대신 바위 무리로
        // 발을 만든다 — 무리 120~260px, 사이 ≥ 200px, y는 ±20px 저주파로 굽는다(MOUNTAIN §1 ③행).
        {
          let bx = -60 + g0() * 120;
          while (bx < w) {
            const bw2 = 120 + g0() * 140;
            const by = groundY(0.5) + Math.sin(bx * 0.004 + 1.3) * 20 + Math.sin(bx * 0.011) * 8;
            for (let x = bx; x < bx + bw2; x += 2) {
              if (x < 0 || x > w) continue;
              const yq = Math.round((by + Math.sin(x * 0.03) * 3 + (g0() - 0.5) * 4) / 2) * 2;
              gp.fillStyle = g0() < 0.55 ? tone2 : tone;
              gp.fillRect(x, yq, 2, 2 + Math.floor(g0() * 3) * 2);
            }
            bx += bw2 + 200 + g0() * 160;
          }
        }
        // 윗단 밝은 톤 계단 두 줄(빛 받는 너덜 면) + 굵은 돌 점들 — 격자 스냅, AA 없음.
        gp.fillStyle = tone2;
        for (let x = 0; x < w; x += 2) {
          const yq = Math.round(yTop(x + 1) / 2) * 2;
          gp.fillRect(x, yq, 2, 4);
          if (g0() < 0.18) gp.fillRect(x, yq + 6 + Math.floor(g0() * 30) * 2, 2, 2);
        }
      }
      // 침엽수 고지 — 두 번째 봉우리 발치에 실루엣 줄(산을 산으로 읽히게 하는 두 번째 신호).
      {
        // 침엽수 줄 — 기준선 둘, 단 셋(사다리꼴), 밑동, 겹침 허용. 하나짜리 이등변삼각형 줄은 "톱니 테두리"였다.
        let cx2 = -60;
        for (let i = 0; i < 46; i++) {
          const row = i % 2;
          cx2 += (w / 14) * (0.35 + g0() * 1.1); // 누적 간격 — 고정 피치면 "빗살"이 된다
          if (cx2 > w + 60) cx2 = -40 + g0() * 60;
          // 능선면(② v < .34)에는 나무가 서지 않는다(고산 나지, MOUNTAIN_DEPTH_RULES §5) — 옛 .3±60은 절반이 봉우리 면에 붙었다.
          // 상한은 ② 능선면(v .34), **하한은 중턱 belt의 위**(v .40) — 두 집합이 y가 겹치면 같은 줄에
          // "먼 삼각 실루에"과 "가까운 소나무 스프라이트"가 나란히 서 한 화면에 두 어법이 된다(2026-09-06 라운드 7 B #4:
          // 크기비 4.8배에 명도 방향도 반대였다).
          const line = Math.min(groundY(0.4), Math.max(groundY(0.34), groundY(row ? 0.42 : 0.36) + (g0() - 0.5) * 70));
          const x = cx2 + (g0() - 0.5) * 70;
          if (g0() < 0.14) continue;
          // 아고산 침엽수는 **짧고 굵다**(9~10m에 수관 폭 1:3) — 가느다란 첨탑이 가장 흔한 오류.
          const hh = ((row ? 16 : 12) + g0() * 26) * depthScale(line, h);
          const wr = 0.3 + g0() * 0.16;
          // 불투명(라운드 5 AMB-D1-02, B: "반투명 침엽수 줄 — 뒤 줄기가 비친다"). 멀리 있는 줄(row 0)은 안개색을 더 섞는다.
          gp.globalAlpha = 0.92 + g0() * 0.08;
          const HAZE_HEX: Record<SeasonKey, string> = { spring: "#e8f0e2", summer: "#e2ecde", autumn: "#e4e0d6", winter: "#f0f3f7" };
          // 10% 남짓은 죽은 회색 고사목(구상나무 고사 — 실제 풍경의 일부).
          gp.fillStyle = mixHex(g0() < 0.12 ? "#9aa0a0" : season === "winter" ? "#7f8a92" : season === "autumn" ? "#5f6350" : "#5f7060", HAZE_HEX[season], row ? 0.3 : 0.48);
          for (let tier = 0; tier < 3; tier++) {
            const tw = hh * wr * (1 - tier * 0.28);
            const ty = line - hh * (tier * 0.3);
            const th = hh * (0.5 - tier * 0.08);
            gp.beginPath();
            gp.moveTo(x, ty - th - hh * 0.18);
            gp.lineTo(x + tw, ty);
            gp.lineTo(x - tw, ty);
            gp.closePath();
            gp.fill();
          }
          gp.fillRect(x - 1, line - 3, 2, 5);
        }
        gp.globalAlpha = 1;
      }
      if (snowy) for (let i = 0; i < Math.round((w * h) / 50000); i++) softBlob(g, g0() * w, groundY(0.35 + g0() * 0.6), 60 + g0() * 120, "255 255 255", season === "winter" ? 0.18 : 0.14, 0, GROUND_SQUASH);
      // 너덜지대 — 큰 바위 무리(대체물도 그림자·지면 접점이 있다). 옛 임시 그라데이션 타원은 "공중의 검은 얼룩"이라 철거.
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 10, band: "any", minV: 0.36 }, { id: "grass-dry", n: 34, band: "any", minV: 0.34 }]); // minV .3 → .36(B: ② 능선면에 바위 금지, ③은 v ≥ .34)
      // 고지의 노출암·너덜 — 지평선 바로 아래가 통째로 빈 안개였다(검토 라운드2 현실성 #5).
      for (let i = 0; i < 16; i++) {
        const y = groundY(0.34 + g0() * 0.16); // 능선 실루엣 아래로 — 위에 두면 하늘에 자갈이 뜬다
        const k = (0.35 + g0() * 0.3) * depthScale(y, h);
        const x = g0() * w;
        if (!claimSpot(x, y, 16 * k)) continue;
        shadow(g, x + 2 * k, y, 18 * k, 0.12);
        drawProp(g, art, "rock", x, y, { k, r: g0(), flip: g0() < 0.5 });
      }
      // 큰 바위 — 크기가 y와 무상관하게 흩어져 "먼 것이 가까운 것보다 크다"가 됐다(검토 라운드2 현실성 #9a).
      // 개체 편차를 줄여 depthScale이 이기게 한다.
      for (let i = 0; i < 6; i++) {
        const x = 40 + g0() * (w - 80);
        const y = groundY(0.38 + g0() * 0.4);
        const k = (1.0 + g0() * 0.45) * depthScale(y, h);
        shadow(g, x + 2 * k, y + 1.5 * k, Math.min(36, 22 * k), 0.14);
        drawProp(g, art, "rock", x, y, { k, r: g0(), flip: g0() < 0.5 });
      }
      // 산지림 띠 — 고도가 낮을수록(= 화면 아래일수록) 숲이다. 침엽수를 근경에 무리로 세워 "평지 + 배경 그림판"을
      // 벗어난다(검토 라운드2 현실성 #5). 위(고지)는 나지·애추 그대로 둔다.
      {
        const pineId = season === "winter" ? "tree-pine-winter" : season === "autumn" ? "tree-pine-autumn" : "tree-pine";
        type MT = { x: number; y: number; k: number };
        const belt: MT[] = [];
        for (let c2 = 0; c2 < 4; c2++) {
          const cx3 = w * (0.06 + 0.28 * c2 + (g0() - 0.5) * 0.12);
          const cy3 = groundY(0.6 + g0() * 0.34);
          const n2 = 3 + Math.floor(g0() * 3);
          for (let i = 0; i < n2; i++) {
            const y = cy3 + (g0() - 0.5) * h * 0.14;
            belt.push({ x: cx3 + (g0() - 0.5) * w * 0.2, y, k: (0.75 + g0() * 0.8) * depthScale(y, h) });
          }
        }
        // 중턱 — 균등 산포는 "미니 트리 confetti"가 된다(검토 라운드2 미관 #8). 두세 무리로 뭉치고 크기를 흩는다.
        for (let c3 = 0; c3 < 3; c3++) {
          const mx = w * (0.18 + 0.32 * c3 + (g0() - 0.5) * 0.14);
          const n3 = 2 + Math.floor(g0() * 3);
          for (let i = 0; i < n3; i++) {
            const y = groundY(0.44 + g0() * 0.18); // 실루엣 줄(≤ v .40)과 겹치지 않게 아래로(라운드 7 B #4)
            belt.push({ x: mx + (g0() - 0.5) * w * 0.12, y, k: (0.55 + g0() * 0.4) * depthScale(y, h) });
          }
        }
        // 우측이 통째로 비던 것(미관 #8) — 오른쪽 아래에 무리 하나를 더.
        {
          const rx3 = w * (0.72 + g0() * 0.2);
          for (let i = 0; i < 4; i++) {
            const y = groundY(0.62 + g0() * 0.32);
            belt.push({ x: rx3 + (g0() - 0.5) * w * 0.16, y, k: (0.7 + g0() * 0.7) * depthScale(y, h) });
          }
        }
        belt.sort((a2, b2) => a2.y - b2.y);
        for (const t2 of belt) {
          if (!claimSpot(t2.x, t2.y, 26 * t2.k, true)) continue;
          shadow(g, t2.x + 6 * t2.k, t2.y - 2, 40 * t2.k, 0.15);
          drawProp(g, art, pineId, t2.x, t2.y, { k: t2.k, r: g0(), flip: g0() < 0.5 });
        }
      }
    }
    ground = c;
    // 산은 봉우리 뒤에 초원의 언덕·나무 줄이 비치지 않게 안개 띠만(QA 라운드 1 D-2).
    horizon = bakeHorizon(season, w, h, 1, kind === "mountain" ? "mountain" : "land");
    // 숲의 나무 자리(결정적) — 위 줄 + 좌우 기둥, 가운데는 비운다. 45%는 소나무(혼효림).
    trees.length = 0;
    const pineMix = () => g0() < 0.45;
    if (kind === "forest") {
      // 나무 수 **34~48**(소유자 결정 2026-09-05 "숲은 일단 성글게" — AMB-S1-01, 열린 결정 확정).
      // 옛 76~81그루는 소나무-참나무 혼효림의 수관 틈(30~40%)을 메워 한 덩이 초록으로 읽혔고, 자리 점유를
      // 안 거쳐 뒷줄 여섯 그루가 융합했다. 이제 **모든 나무가 `claimSpot`을 지난다** — 소품 필드를 공유하니
      // 그루터기·통나무·바위 위에도 서지 않는다. 자리가 차면 다른 후보를 다시 뽑고(결정적: 시도마다 rng 소비),
      // 끝내 못 놓으면 그 그루는 없다(수가 목표 아래로 조금 내려가는 편이 겹치는 것보다 낫다).
      // 여유(clearance)는 `claimSpot`의 0.62 할인을 상쇄해 정한다(라운드 2 B#3): 최소 거리 = .787·c·(R1+R2)이므로
      // 무리 안 ≥ .6(R1+R2)(겹침 ≤ 40%) → c .76, 그 밖 ≥ .85(≤ 15%) → c 1.08. 옛 .42~.72는 겹침 43~67%를 허용했다.
      const putTree = (pick: () => { x: number; y: number; R: number; pine: boolean }, clearance: number, tries = 10) => {
        for (let t2 = 0; t2 < tries; t2++) {
          const cand = pick();
          if (!claimSpot(cand.x, cand.y, cand.R * clearance, true)) continue; // stand = 서 있는 것끼리 세로 여유(라운드 7)
          trees.push(cand);
          return true;
        }
        return false;
      };
      // 뒷줄은 **무리**로 — 등간격 일렬은 자연림이 아니라 방풍림 열로 읽힌다(검토 라운드2 경계 #9 · 미관 #13).
      // 무리 안에서는 수관이 닿아도 된다(그게 무리다) → 여유 0.42, 무리 사이는 비운다.
      {
        const clumps = 4 + Math.round(w / 600);
        for (let c2 = 0; c2 < clumps; c2++) {
          const cx3 = w * ((c2 + 0.5) / clumps) + (g0() - 0.5) * w * 0.16;
          const n2 = 3 + Math.floor(g0() * 3); // 3~5그루 — 원경 수관이 닫혀야 "숲"(라운드 2 A#2: 뒷줄 점유율 47% → 목표 ≥ 62%)
          for (let i = 0; i < n2; i++) {
            putTree(
              () => ({
                x: cx3 + (g0() - 0.5) * w * 0.16,
                y: groundY(0.02 + g0() * 0.2),
                R: Math.round((SIZE.treeCrownW / 2) * (0.55 + g0() * 0.62)),
                pine: pineMix()
              }),
              0.76
            );
          }
        }
      }
      for (const side of [0.06, 0.94])
        for (let i = 0; i < 2; i++)
          putTree(() => ({ x: w * side + (g0() - 0.5) * 50, y: groundY(0.32 + i * 0.28 + g0() * 0.1), R: Math.round((SIZE.treeCrownW / 2) * (0.8 + g0() * 0.3)), pine: pineMix() }), 1.08);
      // 중간 깊이 — 앞줄과 뒷줄 사이가 텅 비어 "울타리 친 마당"으로 읽혔다. 빈터는 가운데(u 0.36~0.64)만 비운다.
      for (let i = 0; i < 5; i++) {
        putTree(() => {
          const u = g0() < 0.5 ? 0.03 + g0() * 0.34 : 0.63 + g0() * 0.34;
          return { x: w * u, y: groundY(0.26 + g0() * 0.62), R: Math.round((SIZE.treeCrownW / 2) * (0.8 + g0() * 0.4)), pine: pineMix() };
        }, 1.08);
      }
      // 중앙 초점 — 큰 나무 셋이 한 무리로(도넛 구멍이 아니라 '큰 나무 아래 빈터'가 되게, 사이클4 미관 #8).
      {
        const cx4 = w * (0.42 + g0() * 0.16);
        const cy4 = groundY(0.52 + g0() * 0.14);
        for (let i = 0; i < 3; i++) {
          putTree(
            () => ({
              // 등간격 직선 사슬은 식재 열로 읽힌다(사이클4 현실성 #7) — 각도·거리를 흩는다.
              x: cx4 + Math.cos(i * 2.1 + g0()) * (30 + g0() * 70),
              y: cy4 + Math.sin(i * 2.1 + g0()) * (24 + g0() * 50),
              R: Math.round((SIZE.treeCrownW / 2) * (1.0 + g0() * 0.35)),
              pine: i === 1 ? false : pineMix()
            }),
            0.76
          );
        }
      }
      // 빈터 **둘레**를 두르는 중간 나무들 — 한가운데만 비고 그 밖은 채워야 "빈터"로 읽힌다.
      for (let i = 0; i < 5; i++) {
        const a2 = (i / 5) * TAU + g0() * 0.3;
        putTree(() => {
          const rr2 = 0.31 + g0() * 0.08;
          const u = 0.5 + Math.cos(a2) * rr2;
          const v = Math.max(0.19, 0.56 + Math.sin(a2) * rr2 * 0.72);
          return { x: w * u, y: groundY(v), R: Math.round((SIZE.treeCrownW / 2) * (0.8 + g0() * 0.45)), pine: pineMix() };
        }, 1.08);
      }
      // 가운데도 **가까운 쪽**엔 나무가 선다 — 안 그러면 한가운데가 밝은 도넛 구멍이 된다(검토 4차).
      for (let i = 0; i < 2; i++)
        putTree(() => ({ x: w * (0.38 + g0() * 0.24), y: groundY(0.82 + g0() * 0.18), R: Math.round((SIZE.treeCrownW / 2) * (1.05 + g0() * 0.25)), pine: pineMix() }), 0.9);
      // 코앞 두 그루 — 화면 아래에서 잘린다(가까움의 신호, 동물의 숲 카메라). 하나는 소나무로 고정해 실루엣 대비를 준다.
      // 화면 밖으로 반쯤 나가므로 여유는 작게(0.45) — 그래도 서로·앞 나무와는 안 겹친다.
      for (const [i2, side] of [0.1, 0.88].entries())
        putTree(() => ({ x: w * side + (g0() - 0.5) * 40, y: groundY(1.02), R: Math.round((SIZE.treeCrownW / 2) * (1.1 + g0() * 0.25)), pine: i2 === 0 }), 0.76);
      trees.sort((a, b) => a.y - b.y);
    } else if (kind === "valley") {
      // 계곡 사면 = 참나무 극상림(수관 틈 0~20%) — 하늘이 열리는 곳은 물길뿐이다. 물 위에 서지 않게
      // 자리 점유 필드(물길이 이미 등록돼 있다)로 거른다.
      for (let i = 0; i < 30; i++) {
        const x = g0() * w;
        const y = groundY(0.02 + g0() * 0.52);
        const R = Math.round((SIZE.treeCrownW / 2) * (0.5 + g0() * 0.32) * depthScale(y, h));
        if (!claimSpot(x, y, R * 0.7, true)) continue;
        trees.push({ x, y, R, pine: g0() < 0.18 });
      }
      // 양쪽 벽 위 — 계곡을 액자처럼 두르는 두 줄(벽이 넓은 위쪽 절반에만).
      for (const side of [0.03, 0.97]) {
        for (let i = 0; i < 4; i++) {
          const y = groundY(0.08 + i * 0.11 + g0() * 0.06);
          trees.push({ x: w * side + (g0() - 0.5) * 70, y, R: Math.round((SIZE.treeCrownW / 2) * (0.7 + g0() * 0.3) * depthScale(y, h)), pine: g0() < 0.25 });
        }
      }
      trees.sort((a, b) => a.y - b.y);
    }
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
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr || av !== art.version) bake(f.dpr);
    },
    step(f) {
      // 아트 도착 또는 조명 전이 끝(그림자 채널 변화) → 바탕 다시 굽기(라운드 4 AMB-T1-03: scatterProps 소품의 발밑 그림자).
      if (av !== art.version || (f.lightStable && gsh !== shadowKey(f.light))) bake(f.dpr);
      if (kind === "valley") for (const q of foam) q.u = (q.u + q.sp * f.dt * lerp(0.6, 1.4, f.load)) % 1;
    },
    draw(g, f) {
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      // 하늘(라운드 5, world/sky.ts) — 계절 × 날씨 × 띠 판, 지평선 띠(안개·언덕) 아래. 산은 바탕에 구운 ① 능선 **위만** clip(봉우리가 하늘을 가린다).
      {
        const sk = skyKey(season, f.weather.now, f.time.band, f.w, f.h);
        if (!skyC || sk !== skyKeyCur) {
          skyC = bakeSky(season, f.weather.now, f.time.band, f.w, f.h, seed);
          cloudC = bakeClouds(season, f.weather.now, f.time.band, f.w, f.h, seed);
          skyKeyCur = sk;
        }
        g.save();
        if (kind === "mountain") clipAboveRidge1(g);
        drawSky(g, skyC, cloudC, f.w, f.t, f.weather.now);
        g.restore();
      }
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 별·달·해 — 산은 ① 능선 위(clip), 나머지는 먼 언덕 꼭대기 위(hz·.3)까지만(언덕은 반투명이라 뒤에 두지 않는다 — B 규칙 3).
      g.save();
      if (kind === "mountain") clipAboveRidge1(g);
      // 별·달·해의 자리(2026-09-06 하늘 확대) — 상한은 먼 언덕 위까지(aboveHz .085), 달은 하늘 중단, 해는 지평선 가까이.
      drawSkyLive(g, f.w, f, seed, kind === "mountain" ? horizonY(f.h) + (f.h - horizonY(f.h)) * 0.09 : horizonY(f.h) * 0.92, kind === "mountain" ? { moonY: horizonY(f.h) * 0.42, sunY: horizonY(f.h) + f.h * 0.02 } : { moonY: horizonY(f.h) * 0.35, sunY: horizonY(f.h) * 0.8 });
      g.restore();
      if (hillShade) {
        // 언덕 능선 그늘 — 그림자 길이에 비례(점심 0 = 항등 · 노을 1). 방향은 사면 대칭(띠 자체가 접힘의 단서).
        const k = Math.max(0, Math.min(1, (currentLight().shadow.len - 0.5) / 1.3)) * currentLight().shadow.alpha;
        if (k > 0.01) {
          g.save();
          g.globalAlpha = k;
          g.drawImage(hillShade, 0, 0, f.w, f.h);
          g.restore();
        }
      }
      if (ridgeC) {
        // 능선선 되살림(AMB-D1-01): 안개 배율(hazeK)과 어둡기(multiply 평균)에 비례해 능선선 판을 0~1.6배 더 얹는다.
        // 점심·맑음(hazeK 1, multiply 255)은 0 — 옛 그림 그대로. 안개는 대기 안개가 능선을 지우는 만큼, 밤은 multiply가 단차를
        // 비례로 줄이는 만큼 미리 보강한다(엔진 조명 패스가 그 뒤에 온다).
        const L = currentLight();
        const dark = 1 - (L.mul[0] + L.mul[1] + L.mul[2]) / 765;
        // 상한 1(한 번 더) — 선이 면보다 두 배 이상 말하면 와이어프레임이 된다(라운드 3 A#3 (b)). 면 단차는 하늘 지평선 광·
        // multiply 그라데이션(view.ts)이 맡고, 능선선은 그 위에 거드는 정도만.
        // 3차: 상한 1.5(두 번째 패스는 잔여만). 2차 실측 안개 ② 국소 대비 4.3(규칙 10, A 상한 = 면 단차 ×2 ≈ 12) — 계수를 올린다.
        const boost = Math.min(1.5, Math.max(0, (L.hazeK - 1) * 1.2 + dark * 2.2));
        if (boost > 0.02) {
          g.save();
          g.globalAlpha = Math.min(1, boost);
          g.drawImage(ridgeC, 0, 0, f.w, f.h);
          if (boost > 1) {
            g.globalAlpha = boost - 1;
            g.drawImage(ridgeC, 0, 0, f.w, f.h);
          }
          g.restore();
        }
      }
      if (kind === "valley" && stream.length) {
        // 흐르는 거품 점 — 시내를 따라 내려온다(원근: 아래로 갈수록 빠르고 크다).
        for (const q of foam) {
          const i = Math.min(stream.length - 2, Math.floor(q.u * (stream.length - 1)));
          const a = stream[i];
          const b = stream[i + 1];
          const t = q.u * (stream.length - 1) - i;
          const x = a.x + (b.x - a.x) * t + q.lane * (10 + 34 * q.u);
          const y = a.y + (b.y - a.y) * t;
          g.fillStyle = `rgb(255 255 255 / ${0.35 + 0.45 * q.u})`;
          g.beginPath();
          g.ellipse(x, y, 1.6 + 2.4 * q.u, (1.6 + 2.4 * q.u) * GROUND_SQUASH, 0, 0, TAU);
          g.fill();
        }
      }
      // 먼 나무 줄은 거리만큼 옅게 — 지평선 띠의 8px 실루엣과 85px 스프라이트가 맞붙어 "다른 그림"으로 보였다(검토 5차).
      for (const tr of trees) {
        g.save();
        g.globalAlpha *= depthFade(tr.y, f.h);
        drawTree(g, tr.x, tr.y, Math.round((tr.R * depthScale(tr.y, f.h)) / 4) * 4, f.t, tr.pine);
        g.restore();
      }
      void clamp;
    },
    debug() {
      return { biomeKind: kind, trees: trees.length, season };
    }
  };
}
