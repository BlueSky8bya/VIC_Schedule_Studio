// 물 공용(2026-09-04, PLAN-004 §3.2·§3.6) — 연못·해안·바다가 같은 문법으로 물을 그린다. 3/4 시점: 수평선(지평선)에서 내려오는 파도,
// 위(멀다)는 옅고 촘촘, 아래(가깝다)는 짙고 성기다. 규칙: 바탕(물빛 그라데이션 + 옅은 caustic 그물)은 한 번 굽고, 매 프레임은 파도
// 거품 선 몇 줄만 stroke(필터·블러 없음). 오행 물빛 #9cc4e0 계열, 어두운 얼룩 금지.

import { makeCanvas, rng, TAU } from "./util";
import type { SeasonKey } from "@/components/shared/ambient/registry";

import type { Light } from "../world/light";
export type WaterPalette = { far: string; near: string; web: string; foam: string };

/** 계절·깊이별 물빛. deep = 깊은 바다(진남색, caustic 거의 없음). */
export function waterPalette(season: SeasonKey): WaterPalette {
  // (깊은 바다 분기는 2026-09-06 삭제 — 심해는 scenes/deep.ts가 자기 고정 팔레트를 쓴다. 수면 장면만 여기.)
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
      const a = (0.02 + 0.055 * t) * (0.6 + r() * 0.7); // 물결무늬는 전반적으로 더 옅게(2026-09-04 소유자)
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
    bg2.addColorStop(0.5, `rgb(${pal.web} / ${0.035 + 0.05 * near})`);
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
      rg.fillStyle = `rgb(${pal.web} / ${0.035 + 0.07 * (y2 / rh)})`;
      rg.fillRect(r2() * rw, y2, len, 1);
    }
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "low";
    g.drawImage(rc, 0, top, w, h - top);
    g.restore();
  }
  // (수평선 반사는 **굽지 않는다** — 2026-09-06 라운드 15, 검토 A #2 · C #1: 구운 흰 자(`softBlob` w·.7, α .16)는 조명을 다시 받지 못해
  //  하늘이 어두워질수록 더 튀었다(peak−sky 맑음 6.2 → 비 17.4 = ×2.8, 안개에도 3~4 잔존, 정점 행 sd .39~1.09 = 490px가 한 행).
  //  이제 `drawHorizonGlow`가 매 프레임 조명(`glint`·`skyAlpha`)을 소비하며 마디로 끊어 그린다.)
  return c;
}

/** 수면의 빗방울 고리(2026-09-06 라운드 14, 우선순위 B — 검토 C #2 "비의 소비자가 민물뿐"). 민물(`summer.ts`)이 갖고 있던 고리를
 * 공용으로 옮긴다: 해안·먼바다·계곡이 같은 모양을 쓴다. 3/4 시점이라 타원(GROUND_SQUASH), 물 폴리곤 안에서만 그린다(호출부가 clip). */
export type RainRing = { x: number; y: number; life: number; dur: number; maxR: number; a: number; w: number };

/** 초당 `rate`개를 `spawn()`이 주는 자리에 낸다. 반환 = 새로 만든 개수(디버그 카운터용). */
export function stepRainRings(
  rings: RainRing[],
  dt: number,
  rain: boolean,
  rnd: () => number,
  spawn: (r: () => number) => { x: number; y: number; u?: number } | null,
  rate: number,
  cap = 160
): number {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life += dt / r.dur;
    if (r.life >= 1) rings.splice(i, 1);
  }
  if (!rain || rings.length >= cap || rnd() >= dt * rate) return 0;
  const at = spawn(rnd);
  if (!at) return 0;
  // 크기도 원근을 탄다(2026-09-06 라운드 15, 검토 B #4): 라운드 14는 **밀도**만 근경으로 몰아 반지름 상위⅓:하위⅓ = 0.98
  // (수용 기준 ≤ 0.6 미달) — 지평선의 고리가 발밑과 같은 크기였다. `u` = 스폰 자리의 원근(0 = 먼 물, 1 = 발밑).
  const u = at.u ?? 0.5;
  const k = 0.45 + 0.75 * u;
  rings.push({ x: at.x, y: at.y, life: 0, dur: 0.9 + rnd() * 0.5, maxR: (8 + rnd() * 12) * k, a: 0.28, w: 0.9 * k });
  return 1;
}

/** 고리를 그린다(호출부가 물 폴리곤으로 clip한 상태여야 한다). `squash` = GROUND_SQUASH. */
export function drawRainRings(g: CanvasRenderingContext2D, rings: RainRing[], squash: number) {
  for (const r of rings) {
    if (r.life < 0) continue;
    const e = 1 - Math.pow(1 - r.life, 2.4);
    const rad = 6 + r.maxR * e;
    const a = r.a * (1 - r.life);
    const lw = r.w * (1 - r.life * 0.6) + 0.8;
    g.lineWidth = lw * 2.6;
    g.strokeStyle = `rgb(120 175 215 / ${a * 0.4})`;
    g.beginPath();
    g.ellipse(r.x, r.y, rad, rad * squash, 0, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = lw;
    g.strokeStyle = `rgb(255 255 250 / ${a})`;
    g.beginPath();
    g.ellipse(r.x, r.y, rad, rad * squash, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

/** 수평선 바로 아래의 하늘빛 반사(2026-09-06 라운드 15) — **마디로 끊긴** 띠. 세기는 `L.glint`(흐림·비·안개 0, 노을 ×1.2, 밤 ×.5)와
 * 하늘 오버레이의 두께(`skyAlpha`)가 정한다: 하늘이 덮일수록 물도 덮인다. 안개면 하늘의 안개색으로 물 상단을 눕혀 수평선을 지운다.
 * 전폭 1px 선 금지(ADR-0017 ⑰) — 40~160px 마디 사이를 20~35% 비우고 α를 x별로 흔든다. */
export function drawHorizonGlow(g: CanvasRenderingContext2D, w: number, top: number, seed: number, L: Light) {
  const k = Math.max(0, Math.min(1, L.glint)) * (1 - Math.min(0.85, L.skyAlpha));
  // 안개: 띠를 끄고 물 상단을 하늘의 안개색으로 눕힌다(GRAMMAR §4 "안개 = 수평선 사라짐").
  if (L.hazeRgb && L.hazeK >= 1.5) {
    const hg = g.createLinearGradient(0, top - 2, 0, top + 26);
    hg.addColorStop(0, `rgb(${L.hazeRgb} / 0.55)`);
    hg.addColorStop(1, `rgb(${L.hazeRgb} / 0)`);
    g.fillStyle = hg;
    g.fillRect(0, top - 2, w, 28);
    return;
  }
  // **물 상단을 하늘에 잇는다**(라운드 15 2차): `bakeWater`가 수평선 아래 22px에 굽는 하늘빛은 **상수**라, 조명 패스가 하늘만 어둡게
  // 덮으면(비·흐림 `skyAlpha` .38/.26) 그 22px만 창백하게 남아 "사각형 둘을 붙인 자리"가 된다(갯벌 점심 비 peak−sky 17.9).
  // 하늘을 덮은 만큼 물 상단도 같은 색으로 덮는다 — 굽기를 다시 하지 않고 조명만으로.
  if (L.skyAlpha > 0.02) {
    // 세기·깊이는 자체 실측 2회전으로 잡았다: ×0.9·25px에서 갯벌 점심 비 peak−sky 16.6이 남아(하늘만 어둡고 물은 창백) ×1.25·60px로.
    // 물은 하늘을 비추므로 하늘을 덮은 색이 물 상단에도 같은 세기로 온다 — 아래로 갈수록 물 자신의 색이 이긴다.
    // 색은 `L.sky`가 아니라 `hazeRgb`(구름·안개의 회색)를 쓴다 — `L.sky`는 **색조만 옮기는 밝은 판**이라(light.ts 주석) 베일로 쓰면
    // 물이 어두워지지 않는다(자체 실측 3회전: 갯벌 점심 비에서 물 상단 79.1 vs 하늘 63.3으로 15.8L 단차가 남았다).
    const veil = L.hazeRgb || L.sky;
    const vg = g.createLinearGradient(0, top - 1, 0, top + 60);
    vg.addColorStop(0, `rgb(${veil} / ${Math.min(0.62, L.skyAlpha * 1.25).toFixed(3)})`);
    vg.addColorStop(0.35, `rgb(${veil} / ${Math.min(0.4, L.skyAlpha * 0.7).toFixed(3)})`);
    vg.addColorStop(1, `rgb(${veil} / 0)`);
    g.fillStyle = vg;
    g.fillRect(0, top - 1, w, 61);
  }
  if (k < 0.05) return;
  const r = rng(seed * 977 + 31);
  let x = -20;
  while (x < w + 20) {
    const seg = 40 + r() * 120;
    const gap = 24 + r() * 60;
    const a = 0.1 * k * (0.7 + r() * 0.6);
    if (a > 0.01) {
      const gg = g.createLinearGradient(0, top + 1, 0, top + 11);
      gg.addColorStop(0, `rgb(252 254 255 / ${a.toFixed(3)})`);
      gg.addColorStop(1, "rgb(252 254 255 / 0)");
      g.fillStyle = gg;
      g.fillRect(Math.round(x / 2) * 2, top + 1, Math.round(seg / 2) * 2, 10);
    }
    x += seg + gap;
  }
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
    // 지수 1.7 → 2.4: 3/4 부감에서 같은 파장의 마루는 지평선 쪽으로 훨씬 급하게 몰려야 한다
    // (사이클5 현실성 #10: "가로 리본을 등간격으로 깐 것으로 읽힌다").
    const y0 = o.top + H * Math.pow(p, 2.4);
    const near = Math.pow(p, 1.2);
    const a = o.alpha * (0.25 + 0.75 * near) * (p > 0.92 ? (1 - p) / 0.08 : 1);
    if (a < 0.01) continue;
    g.lineWidth = 0.8 + near * (o.shore ? 3.2 : 2.2);
    const amp = o.amp * (0.3 + 0.7 * near);
    // 마루는 **끊어져야 한다**: x=0에서 x=w까지 한 획으로 이으면 화면을 가로지르는 1px 흰 선이 되어
    // 파도가 아니라 실수로 남은 선으로 읽힌다(검토 라운드2 #5, 12장에서 지적). 부서지는 자리를 게이트로 뚫고,
    // 조각마다 알파를 흩고, 양 끝은 가늘게 사라진다.
    const yAt = (x: number) => {
      const fk = 1 / (0.45 + 0.55 * near);
      return y0 + Math.sin(x * 0.012 * fk + t * 0.9 + i * 1.7) * amp + Math.sin(x * 0.031 * fk - t * 1.3 + i) * amp * 0.35;
    };
    let seg: number[][] = [];
    const flush = () => {
      if (seg.length > 1) {
        // 조각 중앙이 화면 끝에 가까우면 옅게(끝에서 뚝 끊긴 인상을 지운다).
        const mid = seg[Math.floor(seg.length / 2)][0];
        const edge = Math.min(1, Math.min(mid + 20, w + 20 - mid) / (w * 0.16));
        g.strokeStyle = `rgb(${o.foam} / ${a * (0.55 + 0.45 * Math.sin(seg[0][0] * 0.007 + i)) * edge})`;
        g.beginPath();
        g.moveTo(seg[0][0], seg[0][1]);
        for (let k = 1; k < seg.length; k++) g.lineTo(seg[k][0], seg[k][1]);
        g.stroke();
      }
      seg = [];
    };
    for (let x = -10; x <= w + 10; x += 14) {
      // 주기 ≈ 660px — 화면 폭(1400)에 최소 두 번은 끊긴다. 옛 0.0043은 주기가 화면 폭과 비슷해 한 줄이 통째로 살아남았다.
      const gate = Math.sin(x * 0.0095 + i * 2.3 + t * 0.07) + 0.42 * Math.sin(x * 0.0231 - i * 1.1);
      if (gate < -0.22) {
        flush();
        continue;
      }
      seg.push([x, yAt(x)]);
    }
    flush();
  }
  g.restore();
}

/** 수면 위 빛의 길(QA 라운드 4, AMB-T1-03 — GRAMMAR §2.1 "노을 = 길게 늘어진 반사 띠 · 밤 = 달빛 띠 1 · 새벽 = 반사 옅음"). 해·달 아래로
 *  길게 늘어진 반사 띠 + 그 안에서 깜박이는 잔 글린트. `L.reflect.k`가 0이면(점심·아침·흐림·비·안개) 아무것도 안 그린다 — 점심·맑음 항등.
 *  띠는 지평선(top) 쪽이 좁고 또렷하고 아래로 갈수록 넓고 옅다(원근 + 잔물결 산란), 줄마다 가로로 조금씩 흔들린다. screen 합성이라
 *  밑의 물빛을 **밝히기만** 하고, 뒤이은 엔진 multiply(밤 ×.72)를 같이 받아 주변 물보다 상대적으로 밝게 남는다. 물 구역 clip은 호출 쪽. */
// 빛의 길 스프라이트 — 사다리꼴(위 24% → 아래 100% 폭) × 가로 페이드 × 세로 감쇠(위가 밝다)를 픽셀로 굽는다.
// 색마다 하나만 캐시한다(반경·크기는 그릴 때 늘린다 — LOD 규칙: 부드러운 것은 저해상으로).
let beamC: { c: HTMLCanvasElement; key: string } | null = null;
function bakeBeam(rgb: string): HTMLCanvasElement {
  if (beamC && beamC.key === rgb) return beamC.c;
  const W = 128;
  const H2 = 256;
  const { c, g } = makeCanvas(W, H2);
  const im = g.createImageData(W, H2);
  const d = im.data;
  const [r0, g0, b0] = rgb.split(" ").map(Number);
  for (let y = 0; y < H2; y++) {
    const u = y / (H2 - 1);
    const half = (W / 2) * (0.24 + 0.76 * u);
    const vFade = (1 - u) * (1 - u) * 0.9 + 0.06;
    for (let x2 = 0; x2 < W; x2++) {
      const dx = Math.abs(x2 - W / 2) / Math.max(1, half);
      if (dx >= 1) continue;
      const hFade = Math.cos((dx * Math.PI) / 2) ** 1.4;
      const av = Math.round(255 * hFade * vFade);
      if (av <= 0) continue;
      const i = (y * W + x2) * 4;
      d[i] = r0;
      d[i + 1] = g0;
      d[i + 2] = b0;
      d[i + 3] = av;
    }
  }
  g.putImageData(im, 0, 0);
  beamC = { c, key: rgb };
  return c;
}

export function drawWaterLight(g: CanvasRenderingContext2D, t: number, w: number, top: number, bottom: number, L: Light, opts: { widthK?: number; alpha?: number } = {}) {
  const k = L.reflect.k;
  const H = bottom - top;
  if (k <= 0.01 || H < 20) return;
  const x = w * L.reflect.x;
  // 물 구역이 좁은 해안·민물(높이 < 260px)은 띠가 눌려 보인다(라운드 5 C#5: 노을 2.4~2.9 vs 기준 4) — 세기 ×1.6.
  const a = (opts.alpha ?? 0.95) * k * (H < 260 ? 1.6 : 1);
  const wk = opts.widthK ?? 1;
  const w0 = w * 0.04 * wk;
  const w1 = w * 0.17 * wk;
  g.save();
  g.globalCompositeOperation = "screen";
  // **한 장으로 굽고 한 번 그린다**(2026-09-06 라운드 8, 검토 A: 옛 14행 하드 에지 사각이 물 높이 ÷ 14 =
  // 16.8px 간격(sd 0.5)의 **가로 막대 사다리**가 됐다 — 화면 1/3을 가로지르는 등간격 반복). 스프라이트 안에
  // 사다리꼴 × 가로 페이드 × 세로 감쇠를 모두 담고, 살아 있음은 전단(shear) 한 번으로 낸다.
  const beam = bakeBeam(L.reflect.rgb);
  g.save();
  g.globalAlpha = a;
  // ⚠ 전단 행렬의 e항에 `x`를 넣으면 **이중 평행이동**이다 — 다음 줄 `drawImage`가 이미 절대 x로 그린다.
  // 라운드 8이 그렇게 넣어 띠가 `2x`에 섰고, 노을엔 해와 383px 어긋나고 새벽·밤엔 화면 밖으로 나가
  // **달빛 길이 한 번도 보인 적이 없었다**(2026-09-06 라운드 9, 검토 B P0). e는 전단 보정만 한다.
  const shear = Math.sin(t * 0.7) * 0.05;
  g.transform(1, 0, shear, 1, -shear * top, 0);
  g.drawImage(beam, x - w1, top, w1 * 2, H);
  g.restore();
  // 잔 글린트 — 띠 안의 가로 렌즈 8개, 결정적 위상(시드 무관 — 같은 t면 같은 그림).
  for (let i = 0; i < 8; i++) {
    const u = (i * 0.137 + 0.08) % 1;
    const ph = i * 2.3;
    const b = Math.max(0, Math.sin(t * 1.6 + ph));
    if (b < 0.1) continue;
    const hw = w0 + (w1 - w0) * u;
    const gx = x + Math.sin(ph * 3.1 + t * 0.2) * hw * 0.7;
    const gy = top + u * H;
    g.fillStyle = `rgb(${L.reflect.rgb} / ${(b * a * 0.9).toFixed(3)})`;
    g.beginPath();
    g.ellipse(gx, gy, 3 + 6 * u, 0.8 + 1.2 * u, 0, 0, TAU);
    g.fill();
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

/** 포인터 항적(바다·해안용) — 민물(연못)의 제트스키 항적을 가볍게 옮긴 것. 마디마다 퍼지는 눌린 고리 +
 *  아주 짧은 V자 팔. 소유자 2026-09-04: "V자는 아주 짧게 가고 더 빨리 흩어지며 연하게". */
export type Trail = { pts: { x: number; y: number; nx: number; ny: number; t0: number; sf: number }[]; lx: number; ly: number };
export const newTrail = (): Trail => ({ pts: [], lx: -1e9, ly: -1e9 });

/** 포인터가 물 위(top~bottom)에 있으면 14px마다 마디를 남긴다. 수명 지난 마디는 버린다. */
export function stepTrail(tr: Trail, p: { x: number; y: number; inside: boolean; speed: number }, t: number, top: number, bottom: number) {
  const TTL = 1.1;
  while (tr.pts.length && t - tr.pts[0].t0 > TTL) tr.pts.shift();
  if (!p.inside || p.y < top + 6 || p.y > bottom) return;
  const dx = p.x - tr.lx;
  const dy = p.y - tr.ly;
  const d = Math.hypot(dx, dy);
  if (d < 14) return;
  tr.lx = p.x;
  tr.ly = p.y;
  const nx = -dy / d;
  const ny = dx / d;
  tr.pts.push({ x: p.x, y: p.y, nx, ny, t0: t, sf: Math.min(1, p.speed / 900) });
  if (tr.pts.length > 60) tr.pts.shift();
}

/** 팔은 0.3초 만에 흩어지고 고리는 1.1초 — 둘 다 아주 옅게. squash = 3/4 시점의 바닥 눌림. */
export function drawTrail(g: CanvasRenderingContext2D, tr: Trail, t: number, squash: number, foam: string) {
  if (tr.pts.length < 2) return;
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  const ARM = 0.34;
  const armPt = (n: Trail["pts"][number], sd: number, age: number): [number, number] => {
    const d = Math.min((22 + 60 * n.sf) * Math.pow(age, 0.8) + 3, 26 + 22 * n.sf);
    return [n.x + n.nx * sd * d, n.y + n.ny * sd * d * squash];
  };
  for (const sd of [-1, 1]) {
    for (let i = 1; i < tr.pts.length; i++) {
      const a0 = tr.pts[i - 1];
      const a1 = tr.pts[i];
      const age = t - a1.t0;
      const k = 1 - age / ARM;
      if (k <= 0) continue;
      const fade = Math.pow(k, 2.6);
      g.strokeStyle = `rgb(${foam} / ${0.13 * fade * (0.5 + 0.5 * a1.sf)})`;
      g.lineWidth = 2.2 + 1.6 * (1 - k);
      const [x0, y0] = armPt(a0, sd, t - a0.t0);
      const [x1, y1] = armPt(a1, sd, age);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
  }
  // 퍼지는 고리 — 마디마다 하나, 커지며 옅어진다.
  for (const n of tr.pts) {
    const age = t - n.t0;
    const k = 1 - age / 1.1;
    if (k <= 0) continue;
    const rr = 4 + 26 * (1 - k);
    g.strokeStyle = `rgb(${foam} / ${0.16 * Math.pow(k, 1.8) * (0.4 + 0.6 * n.sf)})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(n.x, n.y, rr, rr * squash, 0, 0, TAU);
    g.stroke();
  }
  g.restore();
}
