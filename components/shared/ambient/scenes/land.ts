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
import { claimSpot, drawProp, resetPropField, scatterProps, setPropShadow } from "../art/props";
import { SIZE } from "../world/scale";
import { bakeHorizon, depthFade, depthScale, horizonY, GROUND_SQUASH } from "../world/view";
import { canopyTreeSprite, bareTreeSprite } from "../world/traces-draw";

export type LandKind = "forest" | "hill" | "valley" | "mountain";

// 계절마다 소품·나무 자리를 다르게 — 같은 시드면 네 계절이 "색만 바꾼 한 장"이 된다(2026-09-04 소유자).
const SEASON_SEED: Record<SeasonKey, number> = { spring: 0, summer: 977, autumn: 1861, winter: 2749 };


// 땅 그라데이션 — 위(멀다)는 밝고 아래(가깝다)는 확실히 짙게(≈45 L 폭). 폭이 좁으면 원근을 안개가 혼자 지고
// 열 바이옴이 "같은 뿌연 판"이 된다(2026-09-04 검토 5차: 숲만 σ 30+, 나머지는 9~16).
const GROUND: Record<LandKind, Record<SeasonKey, [string, string]>> = {
  forest: { spring: ["#c6dbaf", "#6f8f61"], summer: ["#b0cc9a", "#5f7f52"], autumn: ["#b6ab86", "#514a34"], winter: ["#f4f8fd", "#a6bcd2"] },
  hill: { spring: ["#dbe8c6", "#93b077"], summer: ["#c6dea8", "#77985c"], autumn: ["#d0c8a8", "#6b6647"], winter: ["#f4f9ff", "#a8c0d8"] },
  valley: { spring: ["#cfe0c8", "#86a583"], summer: ["#bcd6b6", "#6d9068"], autumn: ["#c2c0a2", "#5d5d44"], winter: ["#f0f6fd", "#a4bcd4"] },
  mountain: { spring: ["#d6dbd0", "#94a08f"], summer: ["#cbd4c6", "#869180"], autumn: ["#c8c4b6", "#63604f"], winter: ["#f6faff", "#aec2d6"] }
};

export function createLand(seed: number, opts: { season: SeasonKey; kind: LandKind }): Scene {
  const { season, kind } = opts;
  let w = 0;
  let h = 0;
  let ground: HTMLCanvasElement | null = null;
  let horizon: HTMLCanvasElement | null = null;
  let peaks: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  let av = -1;
  const art = new ArtSet(
    ["tree-oak-spring", "tree-oak-summer", "tree-oak-autumn", "tree-oak-winter", "tree-pine", "tree-pine-winter", "rock", "stump", "log", "mushroom", "grass-dry", "grass-tuft", "daisy", "shrub-spring", "shrub-summer", "shrub-autumn", "shrub-winter"],
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
  const shadow = (g: CanvasRenderingContext2D, x: number, y: number, wd: number, a: number) => {
    g.save();
    g.translate(x, y);
    g.scale(1, 0.34);
    softBlob(g, 0, 0, wd * 0.5, shColor, a, 0);
    g.restore();
  };

  function drawTree(g: CanvasRenderingContext2D, x: number, y: number, R: number, hour: number, pine = false) {
    const dx = hour < 12 ? -8 : 8;
    if (pine) {
      // 소나무 — 폭은 참나무(2R)보다 좁고(1.45R) 키는 조금 크다. 실루엣이 갈려야 "혼효림"으로 읽힌다.
      shadow(g, x + dx * 0.34, y - 2, R * 0.95, 0.16);
      drawProp(g, art, season === "winter" ? "tree-pine-winter" : "tree-pine", x, y, {
        k: (R * 1.78) / 92,
        r: ((x * 7919) % 997) / 997,
        flip: (Math.round(x) & 1) === 1
      });
      return;
    }
    const a = art.get(`tree-oak-${season}`);
    if (a) {
      shadow(g, x + dx * 0.4, y - 2, R * 1.05, 0.16);
      drawArt(g, a, x, y, (2 * R) / a.w);
      return;
    }
    const s = season === "winter" ? bareTreeSprite(R) : canopyTreeSprite(season, R);
    shadow(g, x + dx * 0.4, y - 2, R * 1.0, 0.15);
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
      clumpY = groundY(r());
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
      for (let i = 0; i < 2; i++) {
        const base = groundY(0.18 + i * 0.28);
        const ridge = (x: number) => base + Math.sin(x * 0.003 + i * 2) * 26 + Math.sin(x * 0.009 + i) * 9;
        const bg = g.createLinearGradient(0, base - 30, 0, base + 130);
        const a0 = 0.13 - i * 0.04;
        bg.addColorStop(0, `rgb(255 255 252 / ${a0})`);
        bg.addColorStop(1, "rgb(255 255 252 / 0)");
        // 먼 사면은 **더 밝다**(대기 원근) — 어둡게 칠했더니 원근이 뒤집혀 "계단식 논"으로 읽혔다(검토 3차).
        g.fillStyle = "rgb(255 255 255 / 0.08)";
        g.beginPath();
        g.moveTo(0, gy());
        for (let x = 0; x <= w; x += 20) g.lineTo(x, ridge(x));
        g.lineTo(w, gy());
        g.closePath();
        g.fill();
        // 가림 그늘은 능선 **바로 아래** 좁은 띠에만.
        const og = g.createLinearGradient(0, base - 4, 0, base + 24);
        og.addColorStop(0, `rgb(${RIDGE[season]} / 0.16)`);
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
        g.strokeStyle = `rgb(${RIDGE[season]} / ${season === "winter" ? 0.26 : 0.17 - i * 0.05})`;
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
      const tufts = Math.round((w * h) / (season === "winter" ? 6400 : 3400));
      clumpLeft = 0;
      for (let i = 0; i < tufts; i++) tuftClump(g, g0, 1.1, 0.9);
      if (season === "spring") {
        const nd = Math.round((w * h) / 60000);
        for (let i = 0; i < nd; i++) {
          const x = g0() * w;
          const y = groundY(g0());
          drawProp(g, art, "daisy", x, y + 8, { k: (0.9 + g0() * 0.3) * (SIZE.flower / 18) * depthScale(y, h), r: g0(), flip: g0() < 0.5 });
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
          const ds = depthScale(cy5, h);
          const rr = (16 + g0() * 14) * ds; // 포기 반지름
          // 잎 덩이 — 부채꼴로 벌어진 가닥 여럿(포기 하나가 하나의 덩이로 읽혀야 한다).
          const leaf = season === "winter" ? "rgb(178 164 132" : season === "autumn" ? "rgb(186 158 108" : "rgb(132 149 45";
          for (let k2 = 0; k2 < 7; k2++) {
            const a2 = -Math.PI / 2 + (k2 - 3) * 0.3 + (g0() - 0.5) * 0.22;
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
            const pc2 = season === "winter" ? "rgb(206 196 176" : "rgb(216 210 196";
            for (let k2 = 0; k2 < 3; k2++) {
              const a2 = -Math.PI / 2 + (k2 - 1) * 0.34;
              g.strokeStyle = `${pc2} / ${0.5 + g0() * 0.3})`;
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
        for (let i = 0; i < 6; i++) {
          const x = g0() * w;
          const y = groundY(0.3 + g0() * 0.65);
          const k = (0.8 + g0() * 0.6) * depthScale(y, h);
          drawProp(g, art, "mushroom", x, y, { k, r: g0() });
        }
      }
      scatterProps(g, art, w, h, g0, [{ id: "stump", n: 6, band: "any" }, { id: "log", n: 5, band: "any" }, { id: "rock", n: 12, band: "any" }, { id: `shrub-${season}`, n: 10, band: "any" }]);
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
      const chW = (t: number) => wNear * (0.26 + 0.74 * t); // t: 0 상류(멀다) → 1 하류(가깝다)
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
          const y = groundY(1.14 * t);
          const W2 = chW(t);
          const lam = 5.5 * W2;
          phase += ((y - prevY) / lam) * TAU;
          prevY = y;
          const off = Math.sin(phase) * 1.1 * W2;
          stream.push({ x: cxAxis(t) + off, y });
          if (i2 > 3 && Math.abs(Math.cos(phase)) < 0.16) bends.push({ i: i2, side: Math.sin(phase) > 0 ? 1 : -1 });
        }
      }
      const halfAt = (i2: number) => chW(Math.min(1, i2 / nS)) / 2;
      const normalAt = (i2: number): [number, number] => {
        const a = stream[Math.max(0, i2 - 1)];
        const b = stream[Math.min(stream.length - 1, i2 + 1)];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return [-(b.y - a.y) / len, (b.x - a.x) / len];
      };
      const ribbonPath = (kw: number) => {
        g.beginPath();
        for (let i2 = 0; i2 < stream.length; i2++) {
          const [nx, ny] = normalAt(i2);
          const hw = halfAt(i2) * kw;
          const px = stream[i2].x + nx * hw;
          const py = stream[i2].y + ny * hw;
          if (i2 === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        for (let i2 = stream.length - 1; i2 >= 0; i2--) {
          const [nx, ny] = normalAt(i2);
          const hw = halfAt(i2) * kw;
          g.lineTo(stream[i2].x - nx * hw, stream[i2].y - ny * hw);
        }
        g.closePath();
      };
      // ① 계곡 벽 — 좌우에서 솟아 **먼 땅을 가린다**. 실루엣 가장자리가 있어야 계곡으로 읽힌다.
      const WALL: Record<SeasonKey, [string, string]> = {
        spring: ["#c2d5ac", "#7d9670"],
        summer: ["#a8c48e", "#63805a"],
        autumn: ["#b8b18f", "#7a7458"],
        winter: ["#e4edf6", "#a3b4c4"]
      };
      const [wallLit, wallShade] = WALL[season];
      for (const sd of [-1, 1]) {
        const ridge = (t: number) => {
          const inset = 0.3 - 0.27 * t; // 지평선에서 30% 안쪽 → 발치에서 3%(수렴)
          const wob = Math.sin(t * 5.2 + (sd > 0 ? 2.1 : 0)) * w * 0.018;
          return sd < 0 ? w * inset + wob : w * (1 - inset) + wob;
        };
        const wc2 = sd < 0 ? wallLit : wallShade;
        // 가로 띠로 나눠 칠한다 — 지평선 쪽은 알파 0으로 안개에 스미고, 가장자리로 갈수록 짙다.
        // (destination-out으로 지우면 그 아래 땅까지 지워져 화면에 흰 띠가 남는다.)
        for (let y = gy(); y < h; y += 5) {
          const t = (y - gy()) / Math.max(1, h - gy());
          const a = Math.min(1, Math.max(0, t / 0.34));
          if (a <= 0.01) continue;
          const rx = ridge(Math.min(1, t / 1.06));
          const grad2 = g.createLinearGradient(sd < 0 ? 0 : w, 0, sd < 0 ? rx : rx, 0);
          grad2.addColorStop(0, `${wc2}${Math.round(a * 235).toString(16).padStart(2, "0")}`);
          grad2.addColorStop(1, `${wc2}00`);
          g.fillStyle = grad2;
          if (sd < 0) g.fillRect(0, y, Math.max(0, rx), 6);
          else g.fillRect(rx, y, Math.max(0, w - rx), 6);
        }
        // 능선 — 가린다는 신호 한 줄(아주 옅게, 지평선 쪽은 사라진다).
        g.save();
        g.lineWidth = 1;
        for (let k2 = 1; k2 <= 28; k2++) {
          const t0 = (k2 - 1) / 28;
          const t1 = k2 / 28;
          const a = Math.min(1, t1 / 0.34) * 0.14;
          g.strokeStyle = `rgb(255 255 255 / ${a})`;
          g.beginPath();
          g.moveTo(ridge(t0), groundY(t0 * 1.06));
          g.lineTo(ridge(t1), groundY(t1 * 1.06));
          g.stroke();
        }
        g.restore();
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
      ribbon(1.22, wGravel);
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
        softBlob(g, px, py, hw * 1.5, season === "winter" ? "112 142 168" : "40 88 88", 0.5, 0, GROUND_SQUASH);
        softBlob(g, px, py, hw * 0.85, season === "winter" ? "86 116 144" : "24 58 60", 0.45, 0, GROUND_SQUASH);
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
          // 여울 — 물길을 가로지르는 부서진 흰 물. 규칙적인 점이 아니라 끊어진 선 세 줄.
          for (let row = -1; row <= 1; row++) {
            const ii = Math.min(stream.length - 1, Math.max(0, iA + row * 2));
            const [nx, ny] = normalAt(ii);
            g.strokeStyle = `rgb(238 243 242 / ${0.5 - 0.12 * Math.abs(row)})`;
            g.lineWidth = 2.4 + g0() * 2.4;
            g.lineCap = "round";
            let pen = false;
            g.beginPath();
            for (let m = -10; m <= 10; m++) {
              if (g0() < 0.3) { pen = false; continue; }
              const px = stream[ii].x + nx * (m / 10) * hw * 0.95 + (g0() - 0.5) * 4;
              const py = stream[ii].y + ny * (m / 10) * hw * 0.95 + (g0() - 0.5) * 3;
              if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
            }
            g.stroke();
          }
          g.restore();
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
        for (let i2 = 2; i2 < stream.length - 1; i2 += 2) {
          const [nx, ny] = normalAt(i2);
          const hw = halfAt(i2);
          for (const sd of [-1, 1]) {
            if (g0() < 0.22) continue;
            const px = stream[i2].x + nx * sd * hw * (1.02 + g0() * 0.18);
            const py = stream[i2].y + ny * sd * hw * (1.02 + g0() * 0.18);
            softBlob(g, px, py, hw * (0.3 + g0() * 0.34), "250 253 255", 0.55 + g0() * 0.3, 0, GROUND_SQUASH);
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
        const cx4 = stream[b.i].x + nx * b.side * hw * 1.05;
        const cy4 = stream[b.i].y + ny * b.side * hw * 1.05;
        g.save();
        g.fillStyle = "#9e9d9c";
        g.beginPath();
        g.ellipse(cx4, cy4 - hw * 0.16, hw * 0.72, hw * 0.36, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#857d7b";
        g.beginPath();
        g.ellipse(cx4, cy4, hw * 0.66, hw * 0.22, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#2a2724";
        g.beginPath();
        g.ellipse(cx4, cy4 - hw * 0.04, hw * 0.3, hw * 0.14, 0, Math.PI, TAU);
        g.fill();
        g.fillStyle = "#13120e";
        g.beginPath();
        g.ellipse(cx4, cy4 - hw * 0.07, hw * 0.2, hw * 0.09, 0, Math.PI, TAU);
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
      // 물길을 자리 점유 필드에 먼저 등록 — 안 그러면 관목·바위·나무가 물 위에 선다. 점을 건너뛰면 사이가
      // 뚫려 그 틈에 소품이 앉았다(검토 라운드2 #13) → 모든 점, 자갈 둔치까지 덮는 넓은 반경.
      for (let i2 = 0; i2 < stream.length; i2++) claimSpot(stream[i2].x, stream[i2].y, halfAt(i2) * 2.4);
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 5, band: "any" }, { id: `shrub-${season}`, n: 5, band: "any" }]);
      // ⑪ 상류 끝을 안개에 녹인다 — 물길이 지평선 바로 아래에서 딱 끝나면 "잘린 리본"이 된다.
      {
        const HZC: Record<SeasonKey, string> = { spring: "232 240 226", summer: "226 236 222", autumn: "228 224 214", winter: "240 243 247" };
        const veil = g.createLinearGradient(0, gy(), 0, groundY(0.2));
        veil.addColorStop(0, `rgb(${HZC[season]} / 0.92)`);
        veil.addColorStop(0.45, `rgb(${HZC[season]} / 0.4)`);
        veil.addColorStop(1, `rgb(${HZC[season]} / 0)`);
        g.fillStyle = veil;
        g.fillRect(0, gy(), w, groundY(0.2) - gy());
      }
      foam.length = 0;
      for (let i2 = 0; i2 < 26; i2++) foam.push({ u: g0(), lane: (g0() - 0.5) * 0.6, sp: 0.06 + g0() * 0.05 });
    } else {
      // 산 — 바위·눈 얼룩(겨울·봄엔 눈이 남는다), 위 띠는 봉우리(지평선 굽기가 크게).
      // 봉우리는 **별도 캔버스**에 굽는다 — 바탕에 구우면 그 위에 지평선 띠(먼 언덕·나무 점)가 덮여
      // 봉우리 비탈에 나무가 서 있는 그림이 된다(2026-09-04 검토 4차).
      const pc2 = document.createElement("canvas");
      pc2.width = Math.max(1, Math.ceil(w * dpr));
      pc2.height = Math.max(1, Math.ceil(h * dpr));
      const gp = pc2.getContext("2d")!;
      gp.scale(dpr, dpr);
      peaks = pc2;
      // 봉우리 — 산을 산으로 만드는 유일한 신호. 지평선 띠 바로 아래에 두 겹(뒤가 밝고 옅다), 꼭대기에 만년설.
      const peak = (baseV: number, amp: number, fill: string, alpha: number, ph: number, snowLine: number, cap: boolean) => {
        const g = gp;
        g.save();
        g.globalAlpha = alpha;
        const base = groundY(baseV);
        const foot = base + h * 0.16;
        // 능선은 사인 곡선이 아니라 **각진 걸음**이다(부드러운 혹 두 개 = 회색 벽). 결정적 rng로 걸어 올린다.
        const pr = rng(Math.round(ph * 977) + 41);
        const ridge: number[] = [];
        let yv = base - amp * 0.15;
        let slope = (pr() - 0.5) * 0.6;
        const step = 26;
        for (let x = -step; x <= w + step; x += step) {
          if (pr() < 0.14) slope = (pr() - 0.5) * 2.2; // 봉우리·안부
          yv -= slope * step * 0.5;
          yv += (base - amp * 0.55 - yv) * 0.06; // 평균 고도로 되돌리는 힘
          ridge.push(Math.max(gy() + 4, Math.min(base - amp * 0.05, yv)));
        }
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
        const fg = g.createLinearGradient(0, base - amp, 0, foot);
        fg.addColorStop(0, fill);
        fg.addColorStop(0.55, fill);
        fg.addColorStop(1, `${fill}00`);
        g.fillStyle = fg;
        silhouette();
        g.fill();
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
        // 발치 전 15%에서 덧칠·만년설을 0으로 — 실루엣 클립의 바닥이 직선이라 그대로 끝나면 전폭 가로선이 남는다.
        const cut = g.createLinearGradient(0, foot - h * 0.06, 0, foot);
        cut.addColorStop(0, "rgb(0 0 0 / 0)");
        cut.addColorStop(1, "rgb(0 0 0 / 1)");
        g.save();
        g.globalCompositeOperation = "destination-out";
        g.fillStyle = cut;
        g.fillRect(-step, foot - h * 0.06, w + step * 2, h * 0.06 + 4);
        g.restore();
        if (cap) {
          // 만년설 — 고도선 위, 능선을 따라 굽이친다.
          g.fillStyle = "rgb(250 253 255 / 0.8)";
          g.beginPath();
          g.moveTo(-step, 0);
          for (let x = -step; x <= w + step; x += step / 2) g.lineTo(x, yAt(x) + amp * snowLine * (0.5 + 0.5 * Math.sin(x * 0.006 + ph * 2.3)));
          g.lineTo(w + step, 0);
          g.closePath();
          g.fill();
        }
        g.restore();
        g.restore();
      };
      // 먼 것은 **밝고 옅다**(대기 원근). 옛 값은 앞 땅보다 어두워 "먹구름 벽"으로 읽혔다(검토 4차).
      const PEAK: Record<SeasonKey, [string, string]> = {
        spring: ["#c3ccce", "#a8b3b6"],
        summer: ["#b4c0b8", "#8fa0a6"],
        autumn: ["#c7c0b2", "#a89f92"],
        winter: ["#dde5ec", "#c2ccd6"]
      };
      const snowy = season === "winter" || season === "spring";
      const capSnow = snowy;
      // 뒤 봉우리는 반투명(멀다), 앞 봉우리는 **불투명**이라야 뒤를 가린다 — 둘 다 반투명이면 셀로판 두 장이다.
      peak(0.2, h * 0.34, PEAK[season][0], 0.5, 1.2, 0.3, false);
      peak(0.32, h * 0.26, PEAK[season][1], 0.88, 3.4, 0.42, capSnow);
      // 발치 — 자락이 땅에 닿는 자리(너덜 띠). 알파 0으로 사라지면 "공중에 뜬 구름"이다.
      // 너덜 자락 — 옛 코드는 화면 폭 0.75짜리 **밝은 원 하나**라 "렌즈 얼룩"으로 보였다(검토 라운드2 미관 #12).
      // 봉우리 발치를 따라 낮고 넓게 깔린 어두운(밝지 않은) 애추 띠로 바꾼다.
      for (let i = 0; i < 9; i++) {
        const x = w * (i / 8) + (g0() - 0.5) * w * 0.08;
        const y = groundY(0.4 + Math.sin(i * 1.7) * 0.05);
        softBlob(gp, x, y, w * (0.1 + g0() * 0.07), season === "winter" ? "170 186 202" : "112 112 102", 0.12, 0, GROUND_SQUASH * 0.55);
      }
      // 침엽수 고지 — 두 번째 봉우리 발치에 실루엣 줄(산을 산으로 읽히게 하는 두 번째 신호).
      {
        // 침엽수 줄 — 기준선 둘, 단 셋(사다리꼴), 밑동, 겹침 허용. 하나짜리 이등변삼각형 줄은 "톱니 테두리"였다.
        let cx2 = -60;
        for (let i = 0; i < 46; i++) {
          const row = i % 2;
          cx2 += (w / 14) * (0.35 + g0() * 1.1); // 누적 간격 — 고정 피치면 "빗살"이 된다
          if (cx2 > w + 60) cx2 = -40 + g0() * 60;
          const line = groundY(row ? 0.38 : 0.3) + (g0() - 0.5) * 120;
          const x = cx2 + (g0() - 0.5) * 70;
          if (g0() < 0.14) continue;
          // 아고산 침엽수는 **짧고 굵다**(9~10m에 수관 폭 1:3) — 가느다란 첨탑이 가장 흔한 오류.
          const hh = ((row ? 16 : 12) + g0() * 26) * depthScale(line, h);
          const wr = 0.3 + g0() * 0.16;
          gp.globalAlpha = (row ? 0.42 : 0.3) + g0() * 0.18;
          // 10% 남짓은 죽은 회색 고사목(구상나무 고사 — 실제 풍경의 일부).
          gp.fillStyle = g0() < 0.12 ? "#9aa0a0" : season === "winter" ? "#7f8a92" : season === "autumn" ? "#6a6f5e" : "#5f7060";
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
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 10, band: "any", minV: 0.3 }, { id: "grass-dry", n: 34, band: "any", minV: 0.34 }]);
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
        const pineId = season === "winter" ? "tree-pine-winter" : "tree-pine";
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
        // 중턱의 성긴 몇 그루 — 숲과 나지 사이를 잇는다(경계가 자로 그은 선이 되지 않게).
        for (let i = 0; i < 6; i++) {
          const y = groundY(0.42 + g0() * 0.18);
          belt.push({ x: g0() * w, y, k: (0.4 + g0() * 0.3) * depthScale(y, h) });
        }
        belt.sort((a2, b2) => a2.y - b2.y);
        for (const t2 of belt) {
          if (!claimSpot(t2.x, t2.y, 26 * t2.k)) continue;
          shadow(g, t2.x + 6 * t2.k, t2.y - 2, 40 * t2.k, 0.15);
          drawProp(g, art, pineId, t2.x, t2.y, { k: t2.k, r: g0(), flip: g0() < 0.5 });
        }
      }
    }
    ground = c;
    horizon = bakeHorizon(season, w, h, 1);
    // 숲의 나무 자리(결정적) — 위 줄 + 좌우 기둥, 가운데는 비운다. 45%는 소나무(혼효림).
    trees.length = 0;
    const pineMix = () => g0() < 0.45;
    if (kind === "forest") {
      // 뒷줄은 **무리**로 — 등간격 일렬은 자연림이 아니라 방풍림 열로 읽힌다(검토 라운드2 경계 #9 · 미관 #13).
      {
        const clumps = 3 + Math.round(w / 640);
        for (let c2 = 0; c2 < clumps; c2++) {
          const cx3 = w * ((c2 + 0.5) / clumps) + (g0() - 0.5) * w * 0.16;
          const n2 = 3 + Math.floor(g0() * 3);
          for (let i = 0; i < n2; i++) {
            trees.push({
              x: cx3 + (g0() - 0.5) * w * 0.14,
              y: groundY(0.03 + g0() * 0.16),
              R: Math.round((SIZE.treeCrownW / 2) * (0.55 + g0() * 0.62)),
              pine: pineMix()
            });
          }
        }
      }
      for (const side of [0.06, 0.94]) for (let i = 0; i < 3; i++) trees.push({ x: w * side + (g0() - 0.5) * 50, y: groundY(0.3 + i * 0.22 + g0() * 0.1), R: Math.round(SIZE.treeCrownW / 2 * (0.8 + g0() * 0.3)), pine: pineMix() });
      // 중간 깊이 — 앞줄과 뒷줄 사이가 텅 비어 "울타리 친 마당"으로 읽혔다. 빈터는 가운데(u 0.36~0.64)만 비운다.
      // 혼효림의 수관 틈은 30~40%라 참나무 순림보다 성기다(8 → 6).
      for (let i = 0; i < 6; i++) {
        const u = g0() < 0.5 ? 0.05 + g0() * 0.3 : 0.65 + g0() * 0.3;
        trees.push({ x: w * u, y: groundY(0.26 + g0() * 0.62), R: Math.round((SIZE.treeCrownW / 2) * (0.8 + g0() * 0.4)), pine: pineMix() });
      }
      // 가운데도 **가까운 쪽**엔 나무가 선다 — 안 그러면 한가운데가 밝은 도넛 구멍이 된다(검토 4차).
      for (let i = 0; i < 3; i++) trees.push({ x: w * (0.38 + g0() * 0.24), y: groundY(0.82 + g0() * 0.18), R: Math.round((SIZE.treeCrownW / 2) * (1.05 + g0() * 0.25)), pine: pineMix() });
      // 코앞 두 그루 — 화면 아래에서 잘린다(가까움의 신호, 동물의 숲 카메라). 하나는 소나무로 고정해 실루엣 대비를 준다.
      for (const [i2, side] of [0.1, 0.88].entries()) trees.push({ x: w * side + (g0() - 0.5) * 40, y: groundY(1.02), R: Math.round(SIZE.treeCrownW / 2 * (1.1 + g0() * 0.25)), pine: i2 === 0 });
      trees.sort((a, b) => a.y - b.y);
    } else if (kind === "valley") {
      // 계곡 사면 = 참나무 극상림(수관 틈 0~20%) — 하늘이 열리는 곳은 물길뿐이다. 물 위에 서지 않게
      // 자리 점유 필드(물길이 이미 등록돼 있다)로 거른다.
      for (let i = 0; i < 30; i++) {
        const x = g0() * w;
        const y = groundY(0.02 + g0() * 0.52);
        const R = Math.round((SIZE.treeCrownW / 2) * (0.5 + g0() * 0.32) * depthScale(y, h));
        if (!claimSpot(x, y, R * 0.7)) continue;
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
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!ground || gw !== w || gh !== h || gdpr !== f.dpr || av !== art.version) bake(f.dpr);
    },
    step(f) {
      if (av !== art.version) bake(f.dpr);
      if (kind === "valley") for (const q of foam) q.u = (q.u + q.sp * f.dt * lerp(0.6, 1.4, f.load)) % 1;
    },
    draw(g, f) {
      if (ground) g.drawImage(ground, 0, 0, f.w, f.h);
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      if (peaks) g.drawImage(peaks, 0, 0, f.w, f.h);
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
        drawTree(g, tr.x, tr.y, Math.round((tr.R * depthScale(tr.y, f.h)) / 4) * 4, f.time.hour, tr.pine);
        g.restore();
      }
      void clamp;
    },
    debug() {
      return { biomeKind: kind, trees: trees.length, season };
    }
  };
}
