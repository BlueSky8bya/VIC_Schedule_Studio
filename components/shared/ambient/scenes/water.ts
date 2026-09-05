// 물 공용(2026-09-04, PLAN-004 §3.2·§3.6) — 연못·해안·바다가 같은 문법으로 물을 그린다. 3/4 시점: 수평선(지평선)에서 내려오는 파도,
// 위(멀다)는 옅고 촘촘, 아래(가깝다)는 짙고 성기다. 규칙: 바탕(물빛 그라데이션 + 옅은 caustic 그물)은 한 번 굽고, 매 프레임은 파도
// 거품 선 몇 줄만 stroke(필터·블러 없음). 오행 물빛 #9cc4e0 계열, 어두운 얼룩 금지.

import { makeCanvas, rng, softBlob, TAU } from "./util";
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
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    const u = i / rows;
    const y0 = top + u * H;
    const y1 = top + ((i + 1) / rows) * H + 1;
    const hw = w0 + (w1 - w0) * u;
    const ar = a * ((1 - u) * (1 - u) * 0.9 + 0.06);
    const jx = Math.sin(t * 0.7 + i * 1.9) * hw * 0.16;
    const gr = g.createLinearGradient(x - hw + jx, 0, x + hw + jx, 0);
    gr.addColorStop(0, `rgb(${L.reflect.rgb} / 0)`);
    gr.addColorStop(0.5, `rgb(${L.reflect.rgb} / ${ar.toFixed(3)})`);
    gr.addColorStop(1, `rgb(${L.reflect.rgb} / 0)`);
    g.fillStyle = gr;
    g.fillRect(x - hw + jx - 1, y0, hw * 2 + 2, y1 - y0);
  }
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
