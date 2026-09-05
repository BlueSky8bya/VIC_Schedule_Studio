// 하늘(QA 라운드 5, 2026-09-06 소유자: "밤이면 밤하늘, 가을 낮이면 천고마비 높은 푸른 하늘, 비 올 땐 구름 많이 낀 것 — 그런 변화를 보고 싶다").
// 지금까지 지평선 위는 계절 안개색 한 겹(view.ts bakeHorizon)이었고 밤 별은 바다만 있었다. 여기서 **계절 × 날씨의 하늘 판**을 한 번 굽고
// (그라데이션 + 픽셀 구름), 띠에 따라 별·달·해를 프레임마다 얹는다. 3/4 카메라라 하늘은 지평선 위 12%(+ 산·바다는 능선/수평선 위)뿐이지만,
// 그 띠가 "지금 어떤 날인가"를 말한다. 팔레트는 오행 규칙(선명한 주황·노랑 금지 — 파랑은 저채도 청, 노을은 회장미).
// 순서(장면): ground → **sky** → horizon(안개·언덕) → (산: peaks) → **skyLive(별·달·해)** — 별은 언덕·봉우리에 가려야 하므로 y 상한을 받는다.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Weather } from "./weather";
import type { DayBand } from "./time";
import type { Light } from "./light";
import { horizonY } from "./view";
import { makeCanvas, rng, softBlob, TAU } from "@/components/shared/ambient/scenes/util";

export type SkyPalette = {
  /** 꼭대기(y 0) → 지평선 색. */
  top: string;
  hz: string;
  /** 구름 두 톤(윗면·밑면). null = 구름 없음. */
  cloud: [string, string] | null;
  /** 구름 덮개 0~1(흐림 .85 · 비 .95 · 눈 .8 · 맑음 0). */
  cover: number;
  /** 새털구름(바람) — 길고 얇은 띠. */
  cirrus: boolean;
};

type Rgb = [number, number, number];
const P = (s: string): Rgb => s.split(" ").map(Number) as Rgb;
const S = (c: Rgb): string => c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(" ");
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add = (a: Rgb, d: number): Rgb => [a[0] + d, a[1] + d, a[2] + d];
const scale = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];

// 값은 **조명 패스 전**(엔진이 뒤에서 띠 오버레이·multiply를 한 번 더 곱한다). 점심은 항등이라 그대로 화면색.
// 점심(맑음) — 계절마다 하늘의 높이가 다르다: 봄 옅은 청, 여름 밝고 습한 청, **가을 = 천고마비**(가장 깊고 맑은 청, 위가 짙다), 겨울 차고 옅은 청.
// 지평선이 천정보다 밝다(대기 산란 — 라운드 5 A 원칙 (a)).
const NOON: Record<SeasonKey, [string, string]> = {
  spring: ["172 198 216", "220 230 226"],
  summer: ["146 182 212", "208 226 230"],
  autumn: ["134 170 208", "200 218 226"],
  winter: ["178 190 204", "226 230 232"]
};
const MORNING: Record<SeasonKey, [string, string]> = {
  spring: ["180 205 221", "242 244 238"],
  summer: ["155 188 214", "236 242 240"],
  autumn: ["140 172 208", "230 238 238"],
  winter: ["185 196 208", "242 244 244"]
};
// 새벽·노을·저녁·밤은 계절 공통 + 계절 보정(가을 밤 −6 깊게 · 겨울 +4 눈 알베도). 밤 지평선은 밝게 두어 ① 봉우리보다 하늘이 밝은 순서를 지킨다
// (A는 "밤엔 산이 하늘보다 어둡다"는 역전을 정답으로 봤다 — 열린 결정, ROUND-05 Open Decisions).
const BAND_SKY: Record<Exclude<DayBand, "noon" | "morning">, [string, string]> = {
  dawn: ["112 132 170", "236 230 230"],
  dusk: ["116 133 171", "196 200 212"],
  evening: ["53 71 116", "212 220 232"],
  night: ["84 100 140", "246 248 252"]
};
const SEASON_SHIFT: Record<SeasonKey, number> = { spring: 0, summer: 0, autumn: -6, winter: 4 };

/** (계절, 날씨, 띠) → 하늘 팔레트(조명 패스 전 값). 순수 함수. */
export function skyPalette(season: SeasonKey, weather: Weather, band: DayBand = "noon"): SkyPalette {
  let top: Rgb;
  let hz: Rgb;
  if (band === "noon") [top, hz] = NOON[season].map(P) as [Rgb, Rgb];
  else if (band === "morning") [top, hz] = MORNING[season].map(P) as [Rgb, Rgb];
  else {
    const [t0, h0] = BAND_SKY[band].map(P) as [Rgb, Rgb];
    top = add(t0, SEASON_SHIFT[season]);
    hz = add(h0, SEASON_SHIFT[season] * 0.5);
  }
  const done = (t: Rgb, hzc: Rgb, cloud: [Rgb, Rgb] | null, cover: number, cirrus: boolean): SkyPalette => ({
    top: S(t),
    hz: S(hzc),
    cloud: cloud ? [S(cloud[0]), S(cloud[1])] : null,
    cover,
    cirrus
  });
  switch (weather) {
    case "cloud": {
      const t = scale(mix(top, [176, 182, 192], 0.7), 0.95);
      const z = mix(hz, [204, 210, 216], 0.7);
      return done(t, z, [add(z, 8), add(z, -22)], 0.85, false);
    }
    case "rain": {
      const t = scale(mix(top, [112, 120, 134], 0.75), 0.9);
      const z = mix(hz, [150, 158, 170], 0.75);
      return done(t, z, [add(z, 4), add(z, -26)], 0.95, false);
    }
    case "snow": {
      const t = mix(top, [200, 206, 214], 0.7);
      const z = mix(hz, [222, 226, 232], 0.7);
      return done(t, z, [add(z, 6), add(z, -14)], 0.8, false);
    }
    case "fog": {
      const z = mix(hz, [224, 228, 232], 0.8);
      return done(add(z, -4), z, null, 0, false);
    }
    case "wind":
      return done(top, hz, [add(hz, 10), add(hz, -8)], 0.18, true);
    default:
      // 맑음 — 여름만 낮은 뭉게구름 한둘(습한 하늘), 가을은 구름 없이 높다.
      return done(top, hz, season === "summer" ? [add(hz, 12), add(hz, -12)] : null, season === "summer" ? 0.14 : 0, false);
  }
}

export const skyKey = (season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number): string => `${season}|${weather}|${band}|${w}x${h}`;

/** 하늘 판 굽기 — 지평선까지 불투명, 그 아래 4%h는 사라진다(땅의 먼 띠를 덮지 않게). 구름은 1/3 해상도에 그려 보간 없이 키운다(픽셀 계단, AA 없음 — ADR-0017 ⑱). */
export function bakeSky(season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number, seed: number, topY = 0): HTMLCanvasElement {
  const hz = horizonY(h);
  const H = Math.ceil(hz + h * 0.05);
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w)), H);
  const pal = skyPalette(season, weather, band);
  const grad = g.createLinearGradient(0, topY, 0, hz);
  grad.addColorStop(0, `rgb(${pal.top})`);
  grad.addColorStop(1, `rgb(${pal.hz})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, H);
  g.fillStyle = `rgb(${pal.hz})`;
  g.fillRect(0, hz, w, H - hz);
  if (pal.cloud && pal.cover > 0) {
    // 구름 — 저해상 판(1/3)에 타원 뭉치로 그리고 nearest로 키운다. 윗면 밝은 톤, 밑면(아래 40%) 어두운 톤.
    const SC = 3;
    const lw = Math.ceil(w / SC);
    const lh = Math.ceil(H / SC);
    const lo = makeCanvas(lw, lh);
    const r = rng(seed * 3 + 71 + weather.length);
    const [lit, under] = pal.cloud;
    if (pal.cover >= 0.8) {
      // 덮개 — 판 전체를 밝은 톤으로 반쯤 덮고(하늘 그라데이션이 비친다), 그 위에 뭉치.
      lo.g.fillStyle = `rgb(${lit} / ${(0.35 + 0.4 * (pal.cover - 0.8) * 5).toFixed(3)})`;
      lo.g.fillRect(0, 0, lw, lh * 0.9);
    }
    const bandTop = 2;
    const bandBot = Math.max(6, Math.round((hz / SC) * (pal.cirrus ? 0.7 : 0.95)));
    if (pal.cirrus) {
      // 새털구름 — 길고 얇은 띠 5~7, 바람에 빗겨 눕는다.
      const n = 5 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const y = bandTop + r() * (bandBot - bandTop) * 0.7;
        const x0 = r() * lw;
        const len = lw * (0.18 + r() * 0.3);
        const th = 1 + Math.floor(r() * 2);
        lo.g.fillStyle = `rgb(${lit} / ${(0.4 + r() * 0.3).toFixed(2)})`;
        for (let x = 0; x < len; x += 3) {
          const yy = y + Math.sin(x * 0.05 + i) * 1.2 - x * 0.02;
          lo.g.fillRect(Math.round(x0 + x), Math.round(yy), 3, th);
        }
      }
    } else {
      const n = Math.max(1, Math.round((lw / 30) * pal.cover * 1.3));
      for (let i = 0; i < n; i++) {
        const cx = r() * lw;
        const cy = bandTop + r() * (bandBot - bandTop);
        const cw = 8 + r() * 22 * (0.6 + pal.cover);
        const ch = 3 + r() * 5;
        const blobs = 3 + Math.floor(r() * 4);
        // 윗면
        lo.g.fillStyle = `rgb(${lit} / ${(0.7 + r() * 0.3).toFixed(2)})`;
        for (let b = 0; b < blobs; b++) {
          const bx = cx + (r() - 0.5) * cw;
          const by = cy + (r() - 0.5) * ch * 0.6;
          const br = 2 + r() * (cw * 0.28);
          lo.g.beginPath();
          lo.g.ellipse(bx, by, br, br * 0.55, 0, 0, TAU);
          lo.g.fill();
        }
        // 밑면 — 어두운 톤이 아래 40%에 깔린다(빛은 위에서).
        lo.g.fillStyle = `rgb(${under} / ${(0.5 + r() * 0.3).toFixed(2)})`;
        for (let b = 0; b < Math.max(2, blobs - 1); b++) {
          const bx = cx + (r() - 0.5) * cw * 0.9;
          const by = cy + ch * 0.3 + r() * ch * 0.3;
          const br = 2 + r() * (cw * 0.24);
          lo.g.beginPath();
          lo.g.ellipse(bx, by, br, br * 0.4, 0, 0, TAU);
          lo.g.fill();
        }
      }
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(lo.c, 0, 0, lw, lh, 0, 0, lw * SC, lh * SC);
  }
  // 지평선 아래로는 사라진다 — 땅의 먼 띠(v 0~.05)를 하늘색으로 덮지 않게(A 판정 E "지평선 아래 픽셀은 하늘 입구가 건드리지 않는다").
  g.globalCompositeOperation = "destination-out";
  const fade = g.createLinearGradient(0, hz, 0, H);
  fade.addColorStop(0, "rgb(0 0 0 / 0)");
  fade.addColorStop(1, "rgb(0 0 0 / 1)");
  g.fillStyle = fade;
  g.fillRect(0, hz, w, H - hz);
  g.globalCompositeOperation = "source-over";
  return c;
}

type Star = { x: number; y: number; r: number; ph: number };
const starCache = new Map<string, Star[]>();
function stars(seed: number, w: number, maxY: number): Star[] {
  const key = `${seed}:${w}:${Math.round(maxY)}`;
  let s = starCache.get(key);
  if (!s) {
    const r = rng(seed * 5 + 1);
    s = [];
    const n = Math.round(Math.max(12, (w / 1400) * 46));
    for (let i = 0; i < n; i++) s.push({ x: r() * w, y: 2 + r() * Math.max(2, maxY - 4), r: r() < 0.25 ? 2 : 1, ph: r() * TAU });
    starCache.set(key, s);
  }
  return s;
}

/** 달의 위상 0~1(0 = 삭, .5 = 보름, 다시 1 = 삭) — 실제 음력(삭망월 29.530588853일, 기준 삭 2000-01-06 18:14 UTC = JD 2451550.26).
 *  날짜는 KST 달력 날(정오 기준). 2026-09-06 소유자: "달이 실제 음력 날짜대로 삭부터 보름까지 위상이 바뀌면 좋겠다". 순수 함수(테스트). */
export function moonPhase(y: number, m: number, d: number): number {
  // 그레고리력 → 율리우스일(정오 + KST 오프셋 무시 — 하루 안 오차는 위상 .034 이하).
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jd = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045 + 0.125; // KST 정오 ≈ UTC 03:00
  const p = ((jd - 2451550.26) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

/** 조명 비친 비율 0~1(삭 0 · 보름 1). */
export const moonLit = (phase: number) => (1 - Math.cos(phase * TAU)) / 2;

// 달 원반(위상 포함)은 작은 오프스크린에 그린 뒤 찍는다 — 본 캔버스에 destination-out을 쓰면 뒤 하늘까지 뚫린다.
let moonC: { c: HTMLCanvasElement; g: CanvasRenderingContext2D; key: string } | null = null;
function moonSprite(r: number, phase: number): HTMLCanvasElement {
  const key = `${r}:${phase.toFixed(3)}`;
  if (moonC && moonC.key === key) return moonC.c;
  const S = r * 2 + 6;
  const { c, g } = makeCanvas(S, S);
  const cx = S / 2;
  const cy = S / 2;
  g.fillStyle = "rgb(236 240 248 / 0.94)";
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
  // 그림자 — 북반구에서 상현(0~.5)은 오른쪽이 밝고 왼쪽이 어둡다. 터미네이터 = 반원 + x 반지름 r·cos(2πp)인 반타원.
  const lit = moonLit(phase);
  if (lit < 0.985) {
    g.globalCompositeOperation = "destination-out";
    const waxing = phase < 0.5;
    const k = Math.cos(phase * TAU); // +1 삭 … 0 반달 … −1 보름
    g.beginPath();
    // 어두운 쪽 반원: 상현이면 왼쪽(−x), 하현이면 오른쪽(+x).
    g.arc(cx, cy, r + 0.5, Math.PI / 2, (3 * Math.PI) / 2, !waxing);
    // 터미네이터 반타원 — k > 0(삭에 가까움)이면 밝은 쪽으로 볼록, k < 0(보름에 가까움)이면 어두운 쪽으로 오목.
    g.ellipse(cx, cy, Math.abs(k) * (r + 0.5), r + 0.5, 0, (3 * Math.PI) / 2, Math.PI / 2, (k < 0) === !waxing ? false : true);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  moonC = { c, g, key };
  return c;
}

export type SkyFrame = { t: number; time: { band: DayBand }; weather: { now: Weather }; light: Light; date: { y: number; m: number; d: number } };

/** 프레임마다: 별(밤·맑음/바람) · 달(밤, 음력 위상) · 해(새벽·노을, 맑음/바람) — 픽셀 사각 별, 옅은 달·해 원반 + 글로우. `maxY` = 언덕·능선에 가리지 않을 상한. */
export function drawSkyLive(g: CanvasRenderingContext2D, w: number, f: SkyFrame, seed: number, maxY: number, opts: { moonY?: number; sunY?: number } = {}) {
  const t = f.t;
  const band = f.time.band;
  const weather = f.weather.now;
  const L = f.light;
  const clearish = weather === "clear" || weather === "wind";
  if (!clearish) return;
  if (band === "night") {
    // 별 — 1~2px 사각, 개체마다 위상이 다른 느린 깜박임. 밤 multiply(×.72)를 같이 받으므로 굽기 전 값은 밝게. 보름에 가까울수록 옅다(달빛).
    const lit = moonLit(moonPhase(f.date.y, f.date.m, f.date.d));
    const starK = 1 - 0.35 * lit;
    for (const s of stars(seed, w, maxY)) {
      const a = (0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.7 + s.r * 0.3) + s.ph))) * starK;
      g.fillStyle = `rgb(240 244 250 / ${a.toFixed(2)})`;
      g.fillRect(Math.round(s.x), Math.round(s.y), s.r, s.r);
    }
    // 달 — 빛의 길(reflect.x) 위, 음력 위상 원반 + 글로우(비친 비율만큼). 삭(lit < .04)엔 달이 없다.
    if (lit >= 0.04) {
      const mx = w * L.reflect.x;
      const my = opts.moonY ?? Math.min(maxY * 0.5, 34);
      softBlob(g, mx, my, 26, "226 232 244", 0.08 + 0.18 * lit, 0);
      const spr = moonSprite(7, moonPhase(f.date.y, f.date.m, f.date.d));
      g.drawImage(spr, Math.round(mx - spr.width / 2), Math.round(my - spr.height / 2));
    }
    return;
  }
  if (band === "dawn" || band === "dusk") {
    // 해 — 지평선 가까이 낮게, 회백(새벽)·회장미(노을) 원반 + 넓고 옅은 글로우. 선명한 주황은 없다(오행).
    const sx = w * L.reflect.x;
    const sy = opts.sunY ?? Math.max(maxY * 0.55, maxY - 14);
    const col = band === "dusk" ? "244 226 220" : "236 238 240";
    softBlob(g, sx, sy, 54, col, band === "dusk" ? 0.28 : 0.18, 0);
    g.fillStyle = `rgb(${col} / ${band === "dusk" ? 0.6 : 0.45})`;
    g.beginPath();
    g.arc(sx, sy, 9, 0, TAU);
    g.fill();
  }
}
