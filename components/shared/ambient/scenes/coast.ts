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
import { drawProp, resetPropField } from "../art/props";
import { horizonY, depthScale, GROUND_SQUASH, bakeHorizon } from "../world/view";
import { bakeWater, drawGlints, drawTrail, drawWaves, newTrail, stepTrail, waterPalette } from "./water";

export type CoastMode = "tidal" | "sandy" | "rocky";

// 계절마다 다른 배치(2026-09-04 소유자) — 같은 시드면 네 계절이 색만 다른 한 장이다.
const SEASON_SEED: Record<SeasonKey, number> = { spring: 0, summer: 977, autumn: 1861, winter: 2749 };


const LAND_V = 0.64; // 물가 선(정규화) — 그 아래가 뭍
// 뭍 캔버스 여분 — 물가 선이 조석·숨·만곡으로 최대 ±(0.06h + 34)px 움직인다. 정적 shoreY()로 높이를 잡으면
// 화면 맨 아래에 물이 새어 나온다(2026-09-04 검토 1차: "해안마다 바닥에 파란 실선").
const PAD = 140;
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
    winter: ["#eef0ea", "#dae0dc"]
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
  let sky: HTMLCanvasElement | null = null;
  let horizon: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const glints: { x: number; y: number; ph: number; r: number }[] = [];
  const spray: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const trail = newTrail();
  const art = new ArtSet(["rock", "log", "reed", "pebble", "shell-clam", "starfish", "driftwood"]);
  let av = -1;
  const pal = waterPalette(season);
  const top = () => horizonY(h);
  const shoreY = () => h * LAND_V;
  // 조석(갯벌) — 새벽·저녁 썰물(뻘 넓음), 점심 밀물. 물가 선이 ±6% 움직인다.
  const tide = (f: Frame) => {
    const b = f.time.band;
    const k = 1; // 셋이 같은 바다를 본다 — 모드별로 다르면 이웃 화면과 수면 높이가 어긋난다
    return (b === "dawn" || b === "evening" || b === "night" ? 1 : b === "noon" ? -1 : 0) * k;
  };

  function bake(dpr: number) {
    water = bakeWater(w, h, top(), dpr, pal, seed, true, season === "winter" ? "#e8eef4" : "#eef5fa");
    // 뭍 — 모드별 바탕(아래 36%).
    const lc = document.createElement("canvas");
    lc.width = Math.max(1, Math.ceil(w * dpr));
    lc.height = Math.max(1, Math.ceil((h - shoreY() + 60 + PAD) * dpr));
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
      /** 물골 하나 — (sx,sy) 육지 끝에서 (ex,ey) 바다/합류점까지. 굽이는 양 끝에서 0으로 죽어 합류가 확실하다. */
      const chan = (sx: number, sy: number, ex: number, ey: number, order: number, ph: number) => {
        const pts: { x: number; y: number; hw: number }[] = [];
        const n2 = 24;
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const amp = order === 3 ? 26 : order === 2 ? 18 : 11; // 작은 가지일수록 사행이 심하다(1.0 → 1.42)
        const waves = order === 3 ? 1.5 : order === 2 ? 2.4 : 3.2;
        for (let k2 = 0; k2 <= n2; k2++) {
          const t2 = k2 / n2; // 0 = 육지, 1 = 바다·합류점
          const taper = Math.sin(Math.PI * t2); // 양 끝 0
          const wob = Math.sin(t2 * Math.PI * waves + ph) * amp * taper;
          const x = sx + dx * t2 + nx * wob;
          const y = sy + dy * t2 + ny * wob;
          // 세계 폭은 바다 쪽으로 3~4배(실제 배수망), 화면 폭 = 세계 폭 × 원근.
          const world = order === 3 ? 14 + 70 * t2 * t2 : order === 2 ? 8 + 26 * t2 * t2 : 4 + 11 * t2 * t2;
          pts.push({ x, y, hw: Math.max(0.6, world * landK(y)) });
        }
        chanPts.push(pts);
        return pts;
      };
      // 본류 둘 — 화면 아래(육지) 밖에서 물가까지. 각 본류에 지류 셋, 지류마다 잔가지 둘(가지치기 ≈ 3.5, 3단).
      for (let i = 0; i < 2; i++) {
        const bx = w * (0.3 + 0.4 * i) + (r() - 0.5) * w * 0.08;
        const main = chan(bx + (r() - 0.5) * 70, VIS + 50, bx + (r() - 0.5) * 40, 54, 3, i * 2.1);
        for (let b2 = 0; b2 < 3; b2++) {
          const at = Math.round(main.length * (0.22 + 0.24 * b2 + r() * 0.08));
          const node = main[Math.min(main.length - 1, at)];
          if (!node) continue;
          const side = b2 % 2 === 0 ? -1 : 1;
          const run = 90 + r() * 90;
          const sub = chan(node.x + side * run, node.y + run * 0.85, node.x, node.y, 2, i + b2);
          for (let c2 = 0; c2 < 2; c2++) {
            const at2 = Math.round(sub.length * (0.3 + 0.3 * c2 + r() * 0.1));
            const n3 = sub[Math.min(sub.length - 1, at2)];
            if (!n3) continue;
            const s3 = c2 % 2 === 0 ? -1 : 1;
            const run2 = 46 + r() * 44;
            chan(n3.x + s3 * run2, n3.y + run2 * 0.8, n3.x, n3.y, 1, b2 + c2 * 1.3);
          }
        }
      }
      const drawChan = (kw: number, col: string) => {
        for (const pts of chanPts) {
          if (pts.length < 2) continue;
          g.beginPath();
          for (let jj = 0; jj < pts.length; jj++) {
            const a2 = pts[Math.max(0, jj - 1)];
            const b2 = pts[Math.min(pts.length - 1, jj + 1)];
            const len = Math.hypot(b2.x - a2.x, b2.y - a2.y) || 1;
            const nx = -(b2.y - a2.y) / len;
            const ny = (b2.x - a2.x) / len;
            const hw = pts[jj].hw * kw;
            if (jj === 0) g.moveTo(pts[jj].x + nx * hw, pts[jj].y + ny * hw);
            else g.lineTo(pts[jj].x + nx * hw, pts[jj].y + ny * hw);
          }
          for (let jj = pts.length - 1; jj >= 0; jj--) {
            const a2 = pts[Math.max(0, jj - 1)];
            const b2 = pts[Math.min(pts.length - 1, jj + 1)];
            const len = Math.hypot(b2.x - a2.x, b2.y - a2.y) || 1;
            const nx = -(b2.y - a2.y) / len;
            const ny = (b2.x - a2.x) / len;
            const hw = pts[jj].hw * kw;
            g.lineTo(pts[jj].x - nx * hw, pts[jj].y - ny * hw);
          }
          g.closePath();
          g.fillStyle = col;
          g.fill();
        }
      };
      // 젖은 뻘 둔치 → 물(하늘을 비춘다) → 안쪽 가장자리 반짝. 굽이 바깥이 공격사면이라 조금 더 넓게 잡는다.
      drawChan(1.55, "rgb(104 96 82 / 0.32)");
      drawChan(1, "rgb(126 146 158 / 0.5)");
      drawChan(0.3, "rgb(210 226 234 / 0.16)");
      // 갈라진 뻘(펄) — 순수 펄에는 잔물결이 아니라 **건열 다각형**(장축 평균 37cm). 위(바다) 쪽 모래질엔 없다.
      {
        const cell = 30;
        g.strokeStyle = "rgb(120 110 92 / 0.1)";
        g.lineWidth = 1;
        for (let gy2 = VIS * 0.5; gy2 < VIS - 10; gy2 += cell) {
          for (let gx = 0; gx < w; gx += cell) {
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
          if (hy < VIS * 0.3 || hy > VIS - 6) continue; // 위(모래질)·화면 밖 제외
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
        drawProp(g, art, "pebble", r() * w, 70 + r() * (VIS - 100), { k: 0.9 * landK(70 + r() * (VIS - 100)), r: r(), sy: GROUND_SQUASH, rot: r() * TAU });
      }
      for (let i = 0; i < 7; i++) {
        const x = 40 + r() * (w - 80);
        const y = 90 + r() * (VIS - 130);
        drawProp(g, art, "rock", x, y, { k: (0.6 + r() * 0.5) * depthScale(shoreY() - 60 + y, h), r: r(), flip: r() < 0.5 });
      }
      // 해조 — 젖은 뻘에 붙은 짙은 초록 얼룩 무리(가장자리가 갈라진 느낌으로 여러 겹).
      for (let i = 0; i < 16; i++) {
        const cx3 = r() * w;
        const cy3 = 80 + r() * (VIS - 110);
        for (let k = 0; k < 4; k++) {
          softBlob(g, cx3 + (r() - 0.5) * 46, cy3 + (r() - 0.5) * 22, 10 + r() * 18, r() < 0.5 ? "78 96 70" : "96 106 74", 0.2, 0, GROUND_SQUASH);
        }
      }
      for (let i = 0; i < 10; i++) {
        const x = r() * w;
        const y = 80 + r() * (VIS - 110);
        const k = (0.85 + r() * 0.35) * landK(y);
        softBlob(g, x + 1.5 * k, y + 1.5 * k, 7 * k, "110 98 74", 0.16, 0, GROUND_SQUASH);
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
      // 젖은 모래 → 마른 모래(위가 젖어 어둡고 아래로 갈수록 마르고 밝다) — 평평한 크림 슬래브가 아니라 두 톤.
      const dg = g.createLinearGradient(0, 40, 0, H * 0.62);
      dg.addColorStop(0, "rgb(150 138 112 / 0.34)");
      dg.addColorStop(1, "rgb(150 138 112 / 0)");
      g.fillStyle = dg;
      g.fillRect(0, 40, w, H * 0.62);
      // 물결 자국 — 젖은 띠에 남은 잔물결 능선 몇 줄(가로로 길고 아주 옅게).
      for (let i = 0; i < 7; i++) {
        const y0 = 74 + i * (13 + r() * 10);
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
      // 모래 알갱이.
      for (let i = 0; i < Math.round(w / 3); i++) {
        g.fillStyle = r() < 0.5 ? "rgb(255 250 235 / 0.5)" : "rgb(190 175 140 / 0.35)";
        g.beginPath();
        g.arc(r() * w, r() * H, 0.8 + r() * 1.2, 0, TAU);
        g.fill();
      }
      // 조개·조약돌·유목 — 아래(가까움)로 갈수록 크게.
      for (let i = 0; i < 30; i++) {
        const x = r() * w;
        const y = 100 + r() * (VIS - 130);
        const k = (0.85 + r() * 0.35) * landK(y);
        if (!drawProp(g, art, "shell-clam", x, y, { k, r: r(), sy: GROUND_SQUASH, rot: r() * TAU })) {
          softBlob(g, x + 1.5 * k, y + 1.5 * k, 7 * k, "120 106 78", 0.18, 0, GROUND_SQUASH);
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
        softBlob(g, x + 3 * k, y + 2 * k, 16 * k, "112 98 72", 0.13, 0, GROUND_SQUASH);
        drawProp(g, art, "log", x, y, { k, r: r(), flip: r() < 0.5 });
      }
      // 모래언덕 풀 — 화면 아래(가까움) 가장자리에만.
      for (let i = 0; i < 26; i++) {
        const x = r() * w;
        const y = VH * (0.7 + r() * 0.26);
        drawProp(g, art, "grass-dry", x, y, { k: 1 + r() * 0.6, r: r(), flip: r() < 0.5, alpha: 0.8 });
      }
    } else {
      // 바위 선반의 결 — 평평한 회색 판이 되지 않게 밝고 어두운 층 + 젖은 광택 + 해조 얼룩.
      for (let i = 0; i < 22; i++) softBlob(g, r() * w, 40 + r() * (VIS - 60), 40 + r() * 70, "228 232 236", 0.06, 0, GROUND_SQUASH);
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
      for (let i = 0; i < 12; i++) softBlob(g, r() * w, 60 + r() * (VIS - 100), 26 + r() * 44, "96 112 84", 0.2, 0);
      // 물웅덩이 먼저(바위 밑에 깔린다 — 옛 순서는 웅덩이가 바위 **위**에 얹혀 "바위 꼭대기의 물"이었다).
      const pools: [number, number, number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const x = 40 + r() * (w - 80);
        const y = 110 + r() * (VIS - 160);
        const rx = 20 + r() * 16;
        const ry = rx * (0.4 + r() * 0.12);
        pools.push([x, y, rx, ry]);
        const k = depthScale(shoreY() - 60 + y, h);
        // 웅덩이는 "칠한 구멍"이 아니라 하늘을 비추는 물 — 옅게 깔고 안에 하늘빛 줄 두 개.
        g.fillStyle = season === "winter" ? "rgb(178 196 208 / 0.7)" : "rgb(120 145 160 / 0.55)";
        g.beginPath();
        g.ellipse(x, y, rx * k, ry * k, 0, 0, TAU);
        g.fill();
        g.save();
        g.beginPath();
        g.ellipse(x, y, rx * k, ry * k, 0, 0, TAU);
        g.clip();
        softBlob(g, x - rx * 0.15 * k, y - ry * 0.5 * k, rx * 0.9 * k, "226 238 246", 0.22, 0, 0.5);
        softBlob(g, x + rx * 0.3 * k, y + ry * 0.35 * k, rx * 0.7 * k, "88 110 124", 0.3, 0, 0.5);
        g.restore();
        // 바위 턱 — 웅덩이 위쪽 테두리는 어둡고 아래는 밝다(깊이).
        g.strokeStyle = "rgb(70 78 82 / 0.22)";
        g.lineWidth = 1.6;
        g.beginPath();
        g.ellipse(x, y, rx * k, ry * k, 0, Math.PI, TAU);
        g.stroke();
        g.strokeStyle = "rgb(236 244 248 / 0.5)";
        g.beginPath();
        g.ellipse(x, y, rx * k * 0.94, ry * k * 0.94, 0, 0, Math.PI);
        g.stroke();
      }
      // 바위 무리 — 클립 경계(위 40px)와 웅덩이를 피해서 놓는다.
      for (let i = 0; i < Math.round(w / 55); i++) {
        const x = r() * w;
        const y = 110 + r() * (VIS - 160);
        if (pools.some(([px, py, prx, pry]) => Math.abs(x - px) < prx + 14 && Math.abs(y - py) < pry + 12)) continue;
        const k = (0.85 + r() * 0.5) * landK(y) * 1.5;
        drawProp(g, art, "rock", x, y, { k, r: r(), flip: r() < 0.5 });
      }
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
    land = lc;
    // 하늘 + 수평선 — 뭍 장면과 **같은 문법**의 지평선 띠(sea 프로파일: 먼 언덕·나무 줄 없이 안개만).
    // 옛 코드는 자체 그라데이션 + 1.5px 흰 선이라 초원 ↔ 해안 이동에서 지평선 처리가 통째로 바뀌었다.
    const sc = document.createElement("canvas");
    sc.width = Math.max(1, Math.ceil(w * dpr));
    sc.height = Math.max(1, Math.ceil(top() * dpr) + 2);
    const sg = sc.getContext("2d")!;
    sg.scale(dpr, dpr);
    const sgrad = sg.createLinearGradient(0, 0, 0, top());
    sgrad.addColorStop(0, season === "winter" ? "#cfdae4" : "#dbe8f1");
    sgrad.addColorStop(1, season === "winter" ? "#e8eef4" : "#eef5fa");
    sg.fillStyle = sgrad;
    sg.fillRect(0, 0, w, top() + 2);
    sky = sc;
    horizon = bakeHorizon(season, w, h, 1, "sea");
    gw = w;
    gh = h;
    gdpr = dpr;
    av = art.version;
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!water || gw !== w || gh !== h || gdpr !== f.dpr || av !== art.version) bake(f.dpr);
    },
    step(f) {
      const { dt, load } = f;
      // 포인터 물결 — 물가 선 위쪽(바다)에서만.
      stepTrail(trail, f.p, f.t, top(), shoreY() - 34);
      if (av !== art.version) bake(f.dpr);
      const gt = Math.round(lerp(4, 16, load));
      while (glints.length < gt) glints.push({ x: rand() * w, y: top() + 20 + rand() * (shoreY() - top() - 40), ph: rand() * TAU, r: 1.2 + rand() * 1.4 });
      if (glints.length > gt) glints.length = gt;
      // 물보라(암석해안) — 파도 주기마다 바위 근처에서 흰 점 몇 개.
      if (mode === "rocky" && load >= 0.4 && rand() < dt * 2.2) {
        const x = rand() * w;
        for (let i = 0; i < 5; i++) spray.push({ x: x + (rand() - 0.5) * 20, y: shoreY() - 4, vx: (rand() - 0.5) * 60, vy: -60 - rand() * 90, life: 1 });
      }
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
      if (sky) g.drawImage(sky, 0, 0, f.w, sky.height / (gdpr || 1));
      if (water) g.drawImage(water, 0, 0, f.w, f.h);
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 물가 선이 숨쉰다. 조석 진폭은 세 해안이 함께 움직이도록 작게(옛 0.06h는 갯벌만 바다 높이가 52px 달랐다).
      const sy = shoreY() - tide(f) * f.h * 0.02 - Math.sin(t * 0.5) * 3;
      // 파도 — 수평선에서 물가까지, 마지막 선은 물가에서 거품이 된다.
      // 파도는 물가 곡선의 가장 높은 지점보다 위에서 끝난다(곡선이 파도 선을 덮어 잘라내지 않게).
      drawWaves(g, t, f.w, { top: top(), bottom: sy - 30, bands: 4, speed: 0.05, amp: 12, alpha: 0.15, foam: pal.foam, shore: true });
      drawTrail(g, trail, t, GROUND_SQUASH, pal.foam);
      drawGlints(g, t, glints);
      // 뭍 — 물가 선 아래. 젖은 띠(어두운 반투명)가 물가 위로 살짝.
      if (land) {
        // 물가 선은 자로 그은 가로선이 아니다 — 완만하게 굽이치는 곡선(만·곶). 뭍 클립·젖은 띠·거품이 같은 곡선을 쓴다.
        const mp = mode === "tidal" ? 0 : mode === "sandy" ? 2.1 : 4.2; // 해안별 위상
        const lineY = (x: number) => sy + Math.sin(x * 0.0021 + 0.7 + mp) * 22 + Math.sin(x * 0.0067 + 2.1 + mp * 1.3) * 9 + Math.sin(x * 0.02 + t * 1.1) * 2.5;
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
        // 목적지 높이를 화면 아래까지 명시 — 정적 shoreY()로 잰 이미지 높이를 쓰면 물가가 올라간 순간 바닥에 물이 샜다.
        g.drawImage(land, 0, sy - 60, f.w, Math.max(land.height / (gdpr || 1), f.h - (sy - 60) + 8));
        // 젖은 모래/뻘 띠 — 물가 곡선 아래 12~22px, 파도 주기로 넓어졌다 좁아진다(클립 안이라 뭍에만 얹힌다).
        const wet2 = 12 + 10 * (0.5 + 0.5 * Math.sin(t * 0.5));
        const wg = g.createLinearGradient(0, sy - 24, 0, sy + wet2 + 26);
        wg.addColorStop(0, mode === "rocky" ? "rgb(40 50 60 / 0.4)" : "rgb(88 78 58 / 0.3)");
        wg.addColorStop(1, "rgb(88 78 58 / 0)");
        g.fillStyle = wg;
        g.fillRect(0, sy - 24, f.w, wet2 + 50);
        g.restore();
        // 물가 거품 — 두 줄(짙은 안쪽 선 + 옅은 바깥 여운).
        for (const [off, a, lw] of [[0, 0.6, 1.4], [-5, 0.24, 1] ] as const) {
          g.strokeStyle = `rgb(${pal.foam} / ${a})`;
          g.lineWidth = lw;
          g.beginPath();
          for (let x = -10; x <= f.w + 10; x += 10) g.lineTo(x, lineY(x) + off);
          g.stroke();
        }
      }
      for (const s of spray) {
        g.fillStyle = `rgb(255 255 255 / ${clamp(s.life, 0, 1) * 0.9})`;
        g.beginPath();
        g.arc(s.x, s.y, 1.6, 0, TAU);
        g.fill();
      }
      void depthScale;
    },
    debug() {
      return { biomeKind: mode, glints: glints.length, spray: spray.length, season };
    }
  };
}
