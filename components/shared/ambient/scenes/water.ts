// 물 공용(2026-09-04, PLAN-004 §3.2·§3.6) — 연못·해안·바다가 같은 문법으로 물을 그린다. 3/4 시점: 수평선(지평선)에서 내려오는 파도,
// 위(멀다)는 옅고 촘촘, 아래(가깝다)는 짙고 성기다. 규칙: 바탕(물빛 그라데이션 + 옅은 caustic 그물)은 한 번 굽고, 매 프레임은 파도
// 거품 선 몇 줄만 stroke(필터·블러 없음). 오행 물빛 #9cc4e0 계열, 어두운 얼룩 금지.

import { makeCanvas, rng, softBlob, TAU } from "./util";
import type { SeasonKey } from "@/components/shared/ambient/registry";

export type WaterPalette = { far: string; near: string; web: string; foam: string };

/** 계절·깊이별 물빛. deep = 깊은 바다(진남색, caustic 거의 없음). */
export function waterPalette(season: SeasonKey, deep = false): WaterPalette {
  // 깊은 바다도 계절을 탄다(상수였던 탓에 네 계절의 깊은 바다가 한 장이었다) — 겨울은 더 차고 여름은 살짝 초록빛.
  if (deep) {
    const DEEP: Record<SeasonKey, [string, string]> = {
      winter: ["#809ab4", "#5a7692"],
      spring: ["#829bab", "#5c748c"],
      summer: ["#7b96ab", "#56728c"],
      autumn: ["#849aa9", "#5e7386"]
    };
    const [far, near] = DEEP[season];
    return { far, near, web: "120 150 180", foam: "220 232 242" };
  }
  switch (season) {
    case "winter":
      return { far: "#c9d8e4", near: "#9fb8cc", web: "230 240 248", foam: "255 255 255" };
    case "autumn":
      return { far: "#b8cbd6", near: "#86a6bc", web: "220 232 240", foam: "250 252 254" };
    case "spring":
      return { far: "#bcd6e6", near: "#8fbcd6", web: "225 240 250", foam: "255 255 255" };
    default:
      return { far: "#b5d3e6", near: "#7fb0cc", web: "220 238 250", foam: "255 255 252" };
  }
}

/** 물 바탕을 굽는다: top(수평선·물가 선)부터 h까지 — 멀수록 옅은 물빛, 가까울수록 짙게; 얕은 물 caustic 그물(옅은 원 고리)은 아래쪽에만. */
export function bakeWater(w: number, h: number, top: number, dpr: number, pal: WaterPalette, seed = 3, caustics = true, sky?: string): HTMLCanvasElement {
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w * dpr)), Math.max(1, Math.ceil(h * dpr)));
  g.scale(dpr, dpr);
  const r = rng(seed * 31 + Math.round(w));
  const grad = g.createLinearGradient(0, top, 0, h);
  // 수평선에서 하늘빛 → 물빛으로 20px 안에 섞는다. 없으면 하늘과 물이 한 줄에서 맞붙어 "붙여 놓은 사각형 둘"이 된다
  // (깊은 바다는 한 행에 ΔRGB 96, 2026-09-04 검토 2차).
  if (sky) {
    grad.addColorStop(0, sky);
    grad.addColorStop(Math.min(0.2, 22 / Math.max(1, h - top)), pal.far);
  } else grad.addColorStop(0, pal.far);
  grad.addColorStop(1, pal.near);
  g.fillStyle = grad;
  g.fillRect(0, top, w, h - top);
  // caustic 그물 — **얕은 물에만**(먼바다·깊은 바다는 바닥이 안 보이니 없다). 닫힌 고리는 "낙서한 동그라미"로 읽혀서
  // 열린 호(arc) 두어 개로 끊고, 아래(가까움)로 갈수록만 보이게 알파를 깎는다(2026-09-04 검토 1차).
  if (caustics) {
    const n = Math.round((w * (h - top)) / 24000);
    for (let i = 0; i < n; i++) {
      const t = Math.pow(r(), 0.5);
      const y = top + t * (h - top);
      const x = r() * w;
      const rad = (16 + t * 44 + r() * 20) * (0.7 + r() * 0.6);
      const a = (0.03 + 0.08 * t) * (0.6 + r() * 0.7);
      const rg = g.createRadialGradient(x, y, 1, x, y, rad);
      rg.addColorStop(0, `rgb(${pal.web} / ${a})`);
      rg.addColorStop(0.55, `rgb(${pal.web} / ${a * 0.55})`);
      rg.addColorStop(1, `rgb(${pal.web} / 0)`);
      g.save();
      g.translate(x, y);
      g.scale(1, 0.55);
      g.translate(-x, -y);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  // 너울 골 — 값 단계 3~5개(1px 획이 아니라 **띠**). 물이 통짜 그라데이션이면 화면 절반이 빈 판이다(검토 5차).
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const p0 = Math.pow((i + 0.35) / bands, 1.5);
    const y = top + p0 * (h - top);
    const bh = (h - top) * (0.05 + 0.09 * p0);
    const near = 0.3 + 0.7 * p0;
    const bg2 = g.createLinearGradient(0, y - bh * 0.5, 0, y + bh * 0.5);
    bg2.addColorStop(0, `rgb(${pal.web} / 0)`);
    bg2.addColorStop(0.5, `rgb(${pal.web} / ${0.05 + 0.07 * near})`);
    bg2.addColorStop(1, `rgb(${pal.web} / 0)`);
    g.fillStyle = bg2;
    g.beginPath();
    g.moveTo(-10, y - bh);
    for (let x = -10; x <= w + 10; x += 22) g.lineTo(x, y + Math.sin(x * 0.004 + i * 1.7) * bh * 0.5 + Math.sin(x * 0.011 + i) * bh * 0.2 - bh * 0.5);
    for (let x = w + 10; x >= -10; x -= 22) g.lineTo(x, y + Math.sin(x * 0.004 + i * 1.7) * bh * 0.5 + Math.sin(x * 0.011 + i) * bh * 0.2 + bh * 0.5);
    g.closePath();
    g.fill();
  }
  // 바람결 — 저해상 잔결(가까울수록 굵게). 매끈한 면에 질감 한 겹.
  {
    const rw = Math.max(1, Math.round(w * 0.35));
    const rh = Math.max(1, Math.round((h - top) * 0.35));
    const { c: rc, g: rg } = makeCanvas(rw, rh);
    const r2 = rng(seed * 131 + 7);
    for (let i = 0; i < Math.round(rw * rh / 90); i++) {
      const y2 = Math.pow(r2(), 0.7) * rh;
      const len = 2 + (y2 / rh) * 9;
      rg.fillStyle = `rgb(${pal.web} / ${0.05 + 0.1 * (y2 / rh)})`;
      rg.fillRect(r2() * rw, y2, len, 1);
    }
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "low";
    g.drawImage(rc, 0, top, w, h - top);
    g.restore();
  }
  // 수평선 바로 아래 — 하늘빛 반사 한 줄.
  softBlob(g, w / 2, top + 6, w * 0.7, "255 255 255", 0.16, 0);
  return c;
}

export type WaveOpts = {
  top: number; // 수평선/물가 선
  bottom: number;
  bands: number; // 거품 선 수
  speed: number; // 화면 아래로 내려오는 속도(주기/초)
  amp: number; // 옆으로 굽이치는 진폭(px)
  alpha: number;
  foam: string; // "r g b"
  shore?: boolean; // 물가에 닿는 마지막 선을 더 밝고 넓게
};

/** 파도 — 수평선에서 시작해 관찰자 쪽으로 내려오는 거품 선. 위쪽은 간격이 좁고 옅다(원근). transform/alpha·stroke만. */
export function drawWaves(g: CanvasRenderingContext2D, t: number, w: number, o: WaveOpts) {
  const H = o.bottom - o.top;
  g.save();
  g.lineCap = "round";
  for (let i = 0; i < o.bands; i++) {
    // 각 선의 위상: 0(수평선) → 1(물가/아래). 원근: 위치 = top + H · p^1.7
    const p = ((t * o.speed + i / o.bands) % 1 + 1) % 1;
    const y0 = o.top + H * Math.pow(p, 1.7);
    const near = Math.pow(p, 1.2);
    const a = o.alpha * (0.25 + 0.75 * near) * (p > 0.92 ? (1 - p) / 0.08 : 1);
    if (a < 0.01) continue;
    g.strokeStyle = `rgb(${o.foam} / ${a})`;
    g.lineWidth = 0.8 + near * (o.shore ? 3.2 : 2.2);
    g.beginPath();
    const amp = o.amp * (0.3 + 0.7 * near);
    for (let x = -10; x <= w + 10; x += 14) {
      // 파장도 원근을 탄다 — 먼 선이 가까운 선과 같은 파장이면 바다가 "나뭇결 판"이 된다(검토 3차).
      const fk = 1 / (0.45 + 0.55 * near);
      const y = y0 + Math.sin(x * 0.012 * fk + t * 0.9 + i * 1.7) * amp + Math.sin(x * 0.031 * fk - t * 1.3 + i) * amp * 0.35;
      if (x === -10) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

/** 햇빛 반짝임 — 물 위의 작은 별(숨쉬듯). 위치 배열은 장면이 갖는다. */
export function drawGlints(g: CanvasRenderingContext2D, t: number, glints: { x: number; y: number; ph: number; r: number }[]) {
  for (const gl of glints) {
    const a = Math.max(0, Math.sin(t * 1.4 + gl.ph));
    if (a < 0.05) continue;
    g.save();
    g.translate(gl.x, gl.y);
    // 십자 4획은 화면에서 × · + 글리프(UI 닫기 버튼)로 읽혔다 — 물 위의 햇빛은 가로로 누운 렌즈다(검토 2차).
    g.fillStyle = `rgb(255 255 255 / ${a * 0.55})`;
    g.beginPath();
    g.ellipse(0, 0, gl.r * 3.2 * a, gl.r * 0.5 * a, 0, 0, TAU);
    g.fill();
    g.fillStyle = `rgb(255 255 255 / ${a * 0.75})`;
    g.beginPath();
    g.ellipse(0, 0, gl.r * 1.2 * a, gl.r * 0.32 * a, 0, 0, TAU);
    g.fill();
    g.restore();
  }
}
