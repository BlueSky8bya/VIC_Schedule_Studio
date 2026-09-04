// 육지 바이옴 얇은 판(2026-09-04, PLAN-004 §3.3~3.5) — 숲(forest)·들판·언덕(hill)·계곡(valley)·산(mountain). P1에서는 바탕·지평선·소품만
// (생물은 P2 에이전트, 소나무·억새·고사리·절벽 아트는 P3 자리). 3/4 시점·축척·안개는 엔진과 view.ts가 준다.
//  · forest: 참나무(아트 tree-oak-*)가 위·좌우를 두르고 가운데는 그늘진 빈터, 그루터기·통나무·바위·버섯(가을)·마른 풀.
//  · hill: 완만한 언덕 띠 두 겹(밝기 차로 원근), 풀포기 빽빽, 바위 무리, 봄엔 꽃, 가을엔 마른 풀(억새 자리는 P3).
//  · valley: 바위 사이를 굽이치는 시내(밝은 물 띠 + 흐르는 거품 점), 이끼 바위.
//  · mountain: 위 띠에 큰 봉우리 실루엣, 바위·눈 얼룩(겨울·초봄엔 눈이 초원보다 오래).

import type { Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { ArtSet, drawArt } from "../art/load";
import { drawProp, scatterProps, setPropShadow } from "../art/props";
import { SIZE } from "../world/scale";
import { bakeHorizon, depthFade, depthScale, horizonY, GROUND_SQUASH } from "../world/view";
import { canopyTreeSprite, bareTreeSprite } from "../world/traces-draw";

export type LandKind = "forest" | "hill" | "valley" | "mountain";

// 땅 그라데이션 — 위(멀다)는 밝고 아래(가깝다)는 확실히 짙게(≈45 L 폭). 폭이 좁으면 원근을 안개가 혼자 지고
// 열 바이옴이 "같은 뿌연 판"이 된다(2026-09-04 검토 5차: 숲만 σ 30+, 나머지는 9~16).
const GROUND: Record<LandKind, Record<SeasonKey, [string, string]>> = {
  forest: { spring: ["#c6dbaf", "#6f8f61"], summer: ["#b0cc9a", "#5f7f52"], autumn: ["#b6ab86", "#6b6244"], winter: ["#f4f8fd", "#a6bcd2"] },
  hill: { spring: ["#dbe8c6", "#93b077"], summer: ["#c6dea8", "#77985c"], autumn: ["#d0c8a8", "#8a8462"], winter: ["#f4f9ff", "#a8c0d8"] },
  valley: { spring: ["#cfe0c8", "#86a583"], summer: ["#bcd6b6", "#6d9068"], autumn: ["#c2c0a2", "#79795e"], winter: ["#f0f6fd", "#a4bcd4"] },
  mountain: { spring: ["#d6dbd0", "#94a08f"], summer: ["#cbd4c6", "#869180"], autumn: ["#c8c4b6", "#807d6e"], winter: ["#f6faff", "#aec2d6"] }
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
    ["tree-oak-spring", "tree-oak-summer", "tree-oak-autumn", "tree-oak-winter", "rock", "stump", "log", "mushroom", "grass-dry", "grass-tuft", "daisy", "shrub-spring", "shrub-summer", "shrub-autumn", "shrub-winter"],
    { scaleOf: { "tree-oak-spring": 3, "tree-oak-summer": 3, "tree-oak-autumn": 3, "tree-oak-winter": 3 } }
  );
  const trees: { x: number; y: number; R: number }[] = [];
  const stream: { x: number; y: number }[] = [];
  const foam: { u: number; lane: number; sp: number }[] = [];
  const gy = () => horizonY(h);
  const groundY = (r: number) => gy() + r * (h - gy());
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

  function drawTree(g: CanvasRenderingContext2D, x: number, y: number, R: number, hour: number) {
    const dx = hour < 12 ? -8 : 8;
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
    tuftAt(g, x, y, k0 * (0.55 + r() * 1.0) * depthScale(y, h), r(), r() < 0.5, alpha * (0.75 + r() * 0.25));
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
    const g0 = rng((seed * 7 + 13) >>> 0);
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
      const tufts = Math.round((w * h) / (season === "winter" ? 3200 : 1400));
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
      // 억새 — 언덕 능선의 표지(가을·겨울). reed 자리를 대체물로 빌려 쓴다(아트가 오면 억새 자리로 승격).
      if (season === "autumn" || season === "winter") {
        for (let i = 0; i < 14; i++) {
          const x = g0() * w;
          const y = groundY(0.2 + g0() * 0.75);
          drawProp(g, art, "reed", x, y, { k: (0.34 + g0() * 0.2) * depthScale(y, h), r: 0.5 + g0() * 0.49, flip: g0() < 0.5, alpha: 0.75 });
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
      const litter = Math.round((w * h) / (season === "autumn" ? 900 : 2600));
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
      // 시내 — 왼쪽 위에서 오른쪽 아래로 굽이치는 밝은 물 띠(원근: 위는 좁고 아래는 넓다).
      // 계곡 벽 — 좌우가 지평선 쪽으로 모이는 어두운 사면 두 겹(없으면 그냥 평지에 리본을 얹은 그림이다).
      // 좌우로 갈수록 어두워지는 그늘 — 다각형으로 그리면 대각선 자국이 남아 "삼각형 색종이"가 된다(검토 2차).
      // 가로 그라데이션 한 겹만: 가장자리가 어둡고 가운데는 투명 = 사면이 카메라 쪽으로 열린 계곡.
      const WALL: Record<SeasonKey, string> = { spring: "72 88 66", summer: "72 88 66", autumn: "96 84 60", winter: "124 138 154" };
      const wc = WALL[season];
      const vg = g.createLinearGradient(0, 0, w, 0);
      vg.addColorStop(0, `rgb(${wc} / 0.18)`);
      vg.addColorStop(0.3, `rgb(${wc} / 0.04)`);
      vg.addColorStop(0.5, `rgb(${wc} / 0)`);
      vg.addColorStop(0.7, `rgb(${wc} / 0.04)`);
      vg.addColorStop(1, `rgb(${wc} / 0.18)`);
      g.fillStyle = vg;
      g.fillRect(0, gy(), w, h - gy());
      // 위(멀다)로 갈수록 사면이 좁혀 든다 — 지평선 쪽에 한 겹 더.
      const vg2 = g.createLinearGradient(0, gy(), 0, groundY(0.55));
      vg2.addColorStop(0, `rgb(${wc} / 0.14)`);
      vg2.addColorStop(1, `rgb(${wc} / 0)`);
      g.fillStyle = vg2;
      g.fillRect(0, gy(), w, groundY(0.55) - gy());
      // 시내 — 발원은 화면 밖(지평선 위)에서 시작해 둥근 마개가 안 보이게, 폭은 p²로 벌어진다.
      stream.length = 0;
      for (let i = 0; i <= 24; i++) {
        const p = i / 24;
        stream.push({ x: w * (0.25 + 0.45 * p) + Math.sin(p * 9 + 1) * w * 0.08, y: groundY(0.001 + 1.06 * p) });
      }
      const streamW = (p: number) => 5 + 46 * p * p;
      // 풀포기 먼저 — 옛 순서는 시내 **위**에 풀이 자라 있었다. 물길 폭 안쪽은 비운다.
      const nearStream = (x: number, y: number) => {
        for (let i = 0; i < stream.length - 1; i++) {
          const a = stream[i];
          const b = stream[i + 1];
          if (y < a.y || y > b.y) continue;
          const tt = (y - a.y) / Math.max(1, b.y - a.y);
          const cx = a.x + (b.x - a.x) * tt;
          return Math.abs(x - cx) < streamW((i + tt) / 24) * 0.5 + 8;
        }
        return false;
      };
      const tufts = Math.round((w * h) / 2400);
      clumpLeft = 0;
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
        if (nearStream(x, y)) continue;
        tuftAt(g, x, y, (0.55 + g0() * 1.0) * depthScale(y, h), g0(), g0() < 0.5, 0.85);
      }
      // 자갈 둔치 → 물 → 물빛 하이라이트. 획을 24개로 쪼개 그리면 굽이마다 바깥쪽에 톱니가 남는다(검토 2차) →
      // 각 층을 **채워진 리본 하나**로: 왼쪽 가장자리를 따라 내려가고 오른쪽 가장자리를 거슬러 올라와 닫는다.
      const ribbon = (kw: number, col: string) => {
        g.beginPath();
        for (let i = 0; i < stream.length; i++) {
          const p = i / 24;
          const hw = Math.max(0.6, (streamW(p) * kw) / 2);
          const a = stream[Math.max(0, i - 1)];
          const b = stream[Math.min(stream.length - 1, i + 1)];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = -(b.y - a.y) / len;
          const ny = (b.x - a.x) / len;
          const px = stream[i].x + nx * hw;
          const py = stream[i].y + ny * hw;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        for (let i = stream.length - 1; i >= 0; i--) {
          const p = i / 24;
          const hw = Math.max(0.6, (streamW(p) * kw) / 2);
          const a = stream[Math.max(0, i - 1)];
          const b = stream[Math.min(stream.length - 1, i + 1)];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = -(b.y - a.y) / len;
          const ny = (b.x - a.x) / len;
          g.lineTo(stream[i].x - nx * hw, stream[i].y - ny * hw);
        }
        g.closePath();
        g.fillStyle = col;
        g.fill();
      };
      // 겨울 시내는 언다 — 젖빛 얼음 + 흰 테두리(파란 물이 흐르면 눈밭 옆에서 계절이 어긋난다, 검토 3차).
      const WATER: Record<SeasonKey, [string, string, string]> = {
        spring: ["rgb(154 146 120 / 0.45)", "rgb(168 200 220 / 0.92)", "rgb(220 238 246 / 0.5)"],
        summer: ["rgb(154 146 120 / 0.45)", "rgb(160 196 218 / 0.92)", "rgb(220 238 246 / 0.5)"],
        autumn: ["rgb(150 138 108 / 0.45)", "rgb(158 184 200 / 0.9)", "rgb(214 230 238 / 0.45)"],
        winter: ["rgb(196 206 214 / 0.5)", "rgb(224 234 242 / 0.94)", "rgb(248 252 255 / 0.6)"]
      };
      const [wb, wm, wl] = WATER[season];
      ribbon(1.45, wb);
      ribbon(1, wm);
      ribbon(0.42, wl);
      // 물가 바위 — 시내를 따라 양옆에(계곡 = "바위 사이 시내"인데 바위가 아무 데나 있으면 그냥 초원이다).
      for (let i = 2; i < stream.length - 1; i += 2) {
        const s = stream[i];
        const p = i / 24;
        const halfW = (streamW(p) * 1.45) / 2; // 자갈 둔치 바깥(옛 선형 폭이라 바위가 물 위에 섰다, 검토 3차)
        for (const sd of [-1, 1]) {
          if (g0() < 0.35) continue;
          const x = s.x + sd * (halfW + 8 + g0() * 26);
          const k = (0.7 + p * 0.8 + g0() * 0.4) * depthScale(s.y, h);
          shadow(g, x + 2, s.y - 1, 34 * k, 0.16);
          drawProp(g, art, "rock", x, s.y + (g0() - 0.5) * 10, { k, r: g0(), flip: sd < 0 });
        }
      }
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 5, band: "any" }, { id: `shrub-${season}`, n: 3, band: "any" }]);
      foam.length = 0;
      for (let i = 0; i < 26; i++) foam.push({ u: g0(), lane: (g0() - 0.5) * 0.6, sp: 0.06 + g0() * 0.05 });
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
      softBlob(gp, w * 0.5, groundY(0.48), w * 0.75, season === "winter" ? "196 208 220" : "150 150 138", 0.1, 0, GROUND_SQUASH);
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
          const hh = ((row ? 20 : 14) + g0() * 40) * depthScale(line, h);
          const wr = 0.22 + g0() * 0.2;
          gp.globalAlpha = (row ? 0.42 : 0.3) + g0() * 0.18;
          gp.fillStyle = season === "winter" ? "#7f8a92" : season === "autumn" ? "#6a6f5e" : "#5f7060";
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
      scatterProps(g, art, w, h, g0, [{ id: "rock", n: 16, band: "any", minV: 0.46 }, { id: "grass-dry", n: 40, band: "any", minV: 0.46 }]);
      for (let i = 0; i < 7; i++) {
        const x = 40 + g0() * (w - 80);
        const y = groundY(0.5 + g0() * 0.46);
        const k = (1.3 + g0() * 1.1) * depthScale(y, h);
        shadow(g, x + 2 * k, y + 1.5 * k, Math.min(36, 22 * k), 0.14);
        drawProp(g, art, "rock", x, y, { k, r: g0(), flip: g0() < 0.5 });
      }
    }
    ground = c;
    horizon = bakeHorizon(season, w, h, 1);
    // 숲의 나무 자리(결정적) — 위 줄 + 좌우 기둥, 가운데는 비운다.
    trees.length = 0;
    if (kind === "forest") {
      const n = 6 + Math.round(w / 260);
      for (let i = 0; i < n; i++) trees.push({ x: (i + 0.5) * (w / n) + (g0() - 0.5) * 40, y: groundY(0.06 + g0() * 0.1), R: Math.round(SIZE.treeCrownW / 2 * (0.75 + g0() * 0.35)) });
      for (const side of [0.06, 0.94]) for (let i = 0; i < 3; i++) trees.push({ x: w * side + (g0() - 0.5) * 50, y: groundY(0.3 + i * 0.22 + g0() * 0.1), R: Math.round(SIZE.treeCrownW / 2 * (0.8 + g0() * 0.3)) });
      // 중간 깊이 — 앞줄과 뒷줄 사이가 텅 비어 "울타리 친 마당"으로 읽혔다. 빈터는 가운데(u 0.36~0.64)만 비운다.
      for (let i = 0; i < 8; i++) {
        const u = g0() < 0.5 ? 0.05 + g0() * 0.3 : 0.65 + g0() * 0.3;
        trees.push({ x: w * u, y: groundY(0.26 + g0() * 0.62), R: Math.round((SIZE.treeCrownW / 2) * (0.8 + g0() * 0.4)) });
      }
      // 가운데도 **가까운 쪽**엔 나무가 선다 — 안 그러면 한가운데가 밝은 도넛 구멍이 된다(검토 4차).
      for (let i = 0; i < 3; i++) trees.push({ x: w * (0.38 + g0() * 0.24), y: groundY(0.82 + g0() * 0.18), R: Math.round((SIZE.treeCrownW / 2) * (1.05 + g0() * 0.25)) });
      // 코앞 두 그루 — 화면 아래에서 잘린다(가까움의 신호, 동물의 숲 카메라).
      for (const side of [0.1, 0.88]) trees.push({ x: w * side + (g0() - 0.5) * 40, y: groundY(1.02), R: Math.round(SIZE.treeCrownW / 2 * (1.1 + g0() * 0.25)) });
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
        drawTree(g, tr.x, tr.y, Math.round((tr.R * depthScale(tr.y, f.h)) / 4) * 4, f.time.hour);
        g.restore();
      }
      void clamp;
    },
    debug() {
      return { biomeKind: kind, trees: trees.length, season };
    }
  };
}
