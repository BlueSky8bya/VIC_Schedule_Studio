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
      // 흐림 — 규칙은 "흰빛 → 회색(L −8)"인데, 옛 혼합은 밝은 회색 판으로 끌어올려 저녁·노을에서
      // 하늘이 맑음보다 **+19L 밝아졌다**(2026-09-06 라운드 7 C: 15 중 12가 부호 반대).
      // 채도만 죽이고(무채색 쪽으로) 명도는 그 자리에서 내린다 — 어둠은 띄가 어둠을 유지한다.
      const grey = (c: Rgb, k: number): Rgb => {
        const l = (c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722);
        return [c[0] + (l - c[0]) * k, c[1] + (l - c[1]) * k, c[2] + (l - c[2]) * k];
      };
      const t = add(grey(top, 0.8), -7);
      const z = add(grey(hz, 0.8), -8);
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
      // 안개 — 하늘이 보이지 않는 날이지만 완전한 무지 판은 아니다. 아주 옥은 저층운 한 겹으로
      // 세로 결을 남긴다(검토 A: s10은 하늘 224행 전체 최대 편차가 1.3L였다).
      // 안개 — 세로 폭을 준다(2026-09-06 라운드 7 C: 하늘 224px 전체의 세로 변화가 0.3~1.9L인 "흰 벽").
      // 안개도 위가 어둡고 지평선이 밝다 — 대기는 아래가 두꺼우니까.
      const z = mix(hz, [224, 228, 232], 0.8);
      return done(add(z, -13), z, [add(z, 5), add(z, -7)], 0.3, false);
    }
    case "wind":
      return done(top, hz, [add(hz, 10), add(hz, -8)], 0.18, true);
    default: {
      // 맑음 — 여름은 낮은 뭉게구름이 많고, 다른 계절은 높고 성김다. 하지만 **0은 아니다**
      // (2026-09-06 라운드 7, 검토 A: 하늘을 26%로 넓혔는데 맑음·안개 6장은 구름 0개·고주파 0.0%의
      // 무지 판이 됐다). 가을은 가장 성기게(천고마비), 봄·결울은 그 중간.
      const cover = season === "summer" ? 0.14 : season === "autumn" ? 0.05 : 0.08;
      return done(top, hz, [add(hz, season === "summer" ? 12 : 9), add(hz, -12)], cover, false);
    }
  }
}


/** 구름 띠 굽기(2026-09-06 라운드 6 결정 4 "구름 흐름") — **폭 2w의 타일**을 층 둘로 나눠 굽는다.
 *  같은 뭉치를 x와 x+w 두 번 그려 주기 w로 만들면 `x % w` 오프셋으로 흘려도 이음매가 없다.
 *  먼 층은 느리고(×0.45) 작고 옅게, 가까운 층은 빠르고 크고 진하게 — 한 판이 통째로 미끄러지면 M-1(같은 위상)이다. */
export function bakeClouds(
  season: SeasonKey,
  weather: Weather,
  band: DayBand,
  w: number,
  h: number,
  seed: number
): { far: HTMLCanvasElement; near: HTMLCanvasElement } | null {
  const pal = skyPalette(season, weather, band);
  if (!pal.cloud || pal.cover <= 0) return null;
  const hz = horizonY(h);
  const H = Math.ceil(hz + (h - hz) * 0.05);
  const SC = 3;
  const lw = Math.ceil(w / SC);
  const lh = Math.ceil(H / SC);
  const bandTop = 2;
  const bandBot = Math.max(6, Math.round((hz / SC) * (pal.cirrus ? 0.7 : 0.95)));
  const [lit, under] = pal.cloud;
  const mk = (tiers: { y0: number; y1: number; sz: number; a: number }[], share: number, sd: number) => {
    const lo = makeCanvas(lw * 2, lh);
    const r = rng(sd);
    // 덮개 — 아래 층(가까운 층)에만. 두 층에 다 깔면 두 겹이 돼 하늘이 회색 판이 된다.
    if (pal.cover >= 0.8 && share > 0.5) {
      lo.g.fillStyle = `rgb(${lit} / ${(0.35 + 0.4 * (pal.cover - 0.8) * 5).toFixed(3)})`;
      lo.g.fillRect(0, 0, lw * 2, lh * 0.9);
    }
    const twice = (fn: (dx: number) => void) => {
      fn(0);
      fn(lw);
    };
    if (pal.cirrus && share < 0.5) {
      // 새털구름은 먼 층에만 — 끝이 가늘어지는 갈고리 획(가로 막대·줄 정렬 금지).
      // 새털구름(2026-09-06 라운드 7 재설계) — 라운드 6판은 "바코드 → 비행운"이 됐을 뿐이었다(검토 A: 6~7줄,
      // 종횡비 40:1~84:1, 두께가 길이 내내 일정, 기울기가 3~10°의 좁은 띠). 줄 수를 3~4로 줄이고 길이를 화면
      // 폭의 25% 안으로, 가운데를 두껍게(끝은 절반 이하) 하고 축을 두 마디 곡선으로 꺾는다.
      const n = 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const y = bandTop + r() * (bandBot - bandTop) * 0.86;
        const x0 = r() * lw * 0.8;
        const len = lw * (0.1 + r() * 0.15);
        const tilt0 = (r() < 0.5 ? -1 : 1) * (0.04 + r() * 0.16);
        const tilt1 = tilt0 * (0.25 + r() * 0.5) * (r() < 0.35 ? -1 : 1); // 두 마디: 접선각이 꺾인다
        const th0 = 3 + Math.round(r() * 3);
        lo.g.fillStyle = `rgb(${lit} / ${(0.3 + r() * 0.26).toFixed(2)})`;
        twice((dx) => {
          let yy = y;
          for (let x = 0; x < len; x += 1) {
            const u = x / len;
            const taper = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.7);
            const th = Math.max(0, Math.round(th0 * taper));
            yy += u < 0.5 ? tilt0 : tilt1;
            if (th <= 0) continue;
            lo.g.fillRect(Math.round(x0 + dx + x), Math.round(yy), 1, th);
          }
        });
      }
    } else if (!pal.cirrus) {
      // 개수 하한 — 맑은 날에도 층당 2덩이는 둔다(검토 A: 60px 이상 덩이 0개인 시나리오가 6장).
      const n = Math.max(share > 0.5 ? 3 : 2, Math.round(((lw * (bandBot - bandTop)) / 1000) * pal.cover * 1.3 * share));
      const hzL = bandBot;
      for (let i = 0; i < n; i++) {
        const tier = tiers[Math.floor(r() * tiers.length)];
        const cx = r() * lw;
        const cy = Math.max(bandTop, hzL * (tier.y0 + r() * (tier.y1 - tier.y0)));
        const ch = Math.max(2, hzL * tier.sz * (0.7 + r() * 0.6));
        const cw = ch * (2.6 + r() * 1.4) * (0.7 + 0.5 * pal.cover);
        const blobs = 3 + Math.floor(r() * 4);
        const seedA = r();
        const seedB = r();
        twice((dx) => {
          const r2 = rng(Math.round((seedA + i) * 9973) + Math.round(seedB * 131));
          lo.g.fillStyle = `rgb(${lit} / ${((0.7 + r2() * 0.3) * tier.a).toFixed(2)})`;
          for (let b = 0; b < blobs; b++) {
            const bx = cx + dx + (r2() - 0.5) * cw;
            const by = cy + (r2() - 0.5) * ch * 0.6;
            const br = 2 + r2() * (cw * 0.28);
            lo.g.beginPath();
            lo.g.ellipse(bx, by, br, br * 0.55, 0, 0, TAU);
            lo.g.fill();
          }
          lo.g.fillStyle = `rgb(${under} / ${((0.5 + r2() * 0.3) * tier.a).toFixed(2)})`;
          for (let b = 0; b < Math.max(2, blobs - 1); b++) {
            const bx = cx + dx + (r2() - 0.5) * cw * 0.9;
            const by = cy + ch * 0.3 + r2() * ch * 0.3;
            const br = 2 + r2() * (cw * 0.24);
            lo.g.beginPath();
            lo.g.ellipse(bx, by, br, br * 0.4, 0, 0, TAU);
            lo.g.fill();
          }
        });
      }
    }
    // 가장자리를 픽셀로(알파 3단 양자화) — 저해상 타원의 AA 테두리가 3배로 커지면 "소프트 타원"이 된다(검토 A#1).
    const im = lo.g.getImageData(0, 0, lw * 2, lh);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      d[i + 3] = a < 42 ? 0 : a < 168 ? 140 : 255;
      // 색도 12 단위로 스냅 — 알파만 계단으로 만들면 **덩이 안쪽**이 겹친 타원들의 연속 램프로 남는다
      // (검토 A #4: "밝은 윗면은 톱니, 그 아래 회색은 번진 타원 — 한 덩이 안에 두 어법").
      d[i] = Math.round(d[i] / 12) * 12;
      d[i + 1] = Math.round(d[i + 1] / 12) * 12;
      d[i + 2] = Math.round(d[i + 2] / 12) * 12;
    }
    lo.g.putImageData(im, 0, 0);
    const { c, g } = makeCanvas(Math.ceil(w * 2), H);
    g.imageSmoothingEnabled = false;
    g.drawImage(lo.c, 0, 0, lw * 2, lh, 0, 0, lw * 2 * SC, lh * SC);
    return c;
  };
  const FAR = [{ y0: 0.1, y1: 0.35, sz: 0.07, a: 0.55 }];
  const NEAR = [
    { y0: 0.35, y1: 0.65, sz: 0.1, a: 0.78 },
    { y0: 0.6, y1: 0.95, sz: 0.13, a: 1 }
  ];
  return { far: mk(FAR, 0.45, seed * 3 + 71 + weather.length), near: mk(NEAR, 0.55, seed * 3 + 401 + weather.length) };
}

/** 날씨별 구름 흐름 속도(px/s, 가까운 층 기준). 검토 A(고도별)·B(상한 40~44)·C(층별) 종합. */
export function cloudSpeed(weather: Weather): number {
  return weather === "wind" ? 44 : weather === "rain" ? 14 : weather === "cloud" ? 10 : weather === "snow" ? 8 : weather === "fog" ? 6 : 4;
}

/** 하늘 판 + 흐르는 구름 두 층. 장면은 `drawImage(skyC…)` 대신 이걸 부른다(오프셋은 t의 순수 함수 — 캡처 결정성 유지). */
export function drawSky(
  g: CanvasRenderingContext2D,
  sky: HTMLCanvasElement,
  clouds: { far: HTMLCanvasElement; near: HTMLCanvasElement } | null,
  w: number,
  t: number,
  weather: Weather
) {
  g.drawImage(sky, 0, 0, w, sky.height);
  if (!clouds) return;
  const v = cloudSpeed(weather);
  for (const [layer, mul] of [[clouds.far, 0.45], [clouds.near, 1]] as const) {
    const off = -(((t * v * mul) % w) + w) % w;
    g.drawImage(layer, off, 0, w * 2, layer.height);
  }
}

export const skyKey = (season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number): string => `${season}|${weather}|${band}|${w}x${h}`;

/** 하늘 판 굽기 — 지평선까지 불투명, 그 아래 4%h는 사라진다(땅의 먼 띠를 덮지 않게). 구름은 1/3 해상도에 그려 보간 없이 키운다(픽셀 계단, AA 없음 — ADR-0017 ⑱). */
export function bakeSky(season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number, seed: number, topY = 0): HTMLCanvasElement {
  const hz = horizonY(h);
  const H = Math.ceil(hz + (h - hz) * 0.05); // 지평선 아래로 새는 여유도 땅 비례(검토 B)
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w)), H);
  const pal = skyPalette(season, weather, band);
  const grad = g.createLinearGradient(0, topY, 0, hz);
  grad.addColorStop(0, `rgb(${pal.top})`);
  grad.addColorStop(1, `rgb(${pal.hz})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, H);
  g.fillStyle = `rgb(${pal.hz})`;
  g.fillRect(0, hz, w, H - hz);
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
    // 별도 면적 비례 — 옛 식은 폭만 보고 세서, 하늘을 넓히면 같은 수가 넘게 흔어졌다(2026-09-06).
    // 밀도 0.35개/1000px²(검토 C) — 면적에 그대로 비례시키면 380개가 돼 "가루"로 보인다. 대신 밝기 3등급.
    const n = Math.max(40, Math.min(140, Math.round(w * maxY * 0.00035)));
    // 밝기 3등급 — 1px 잔별 다수 · 2px · 2px + 미광(r 3, 상위 8%). 같은 크기가 흔어지면 먼지로 보인다(검토 A).
    for (let i = 0; i < n; i++) {
      const q = r();
      s.push({ x: r() * w, y: 2 + r() * Math.max(2, maxY - 4), r: q < 0.08 ? 3 : q < 0.3 ? 2 : 1, ph: r() * TAU });
    }
    starCache.set(key, s);
  }
  return s;
}

// 은하수 — 대각 띠 하나(저해상 굽기 후 확대, α ≤ .08). 하늘이 넓어지면 별만으로는 "뿌려 놓은 가루"가 된다(검토 A ③).
let milkyC: { c: HTMLCanvasElement; key: string } | null = null;
function milkyWay(seed: number, w: number, maxY: number): HTMLCanvasElement | null {
  if (maxY < 90) return null; // 하늘이 좀으면 띠가 화면을 가로지르는 선으로 보인다
  const key = `${seed}:${Math.round(w)}:${Math.round(maxY)}`;
  if (milkyC && milkyC.key === key) return milkyC.c;
  const SC = 4;
  const lw = Math.max(2, Math.ceil(w / SC));
  const lh = Math.max(2, Math.ceil(maxY / SC));
  const { c, g } = makeCanvas(lw, lh);
  const r = rng(seed * 11 + 97);
  // 대각선(왼쁔 위 → 오른쁔 아래) 주변에 점을 뿌린다 — 가운데가 짙고 가장자리가 옥다.
  const n = Math.round(lw * lh * 0.06);
  for (let i = 0; i < n; i++) {
    const u = r();
    const bandY = lh * (0.12 + 0.62 * u);
    const d = (r() + r() + r() - 1.5) * lh * 0.16; // 삼각 분포 = 가운데 집중
    const x = u * lw;
    const y = bandY + d;
    if (y < 0 || y >= lh) continue;
    g.fillStyle = `rgb(226 232 244 / ${(0.05 + r() * 0.06).toFixed(3)})`;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  const up = makeCanvas(Math.ceil(w), Math.ceil(maxY));
  up.g.imageSmoothingEnabled = false;
  up.g.drawImage(c, 0, 0, up.c.width, up.c.height);
  milkyC = { c: up.c, key };
  return up.c;
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
  // **절반 해상도에 그리고 2배로 키운다**(nearest) — 그대로 그리면 안티에일리어싱된 정원이 되어
  // 픽셀 나무 옆에 벡터 원이 뜼다(검토 A#1). 계단진 가장자리가 픽셀 어법이다.
  const SC = 2;
  const rr = Math.max(2, Math.round(r / SC));
  const S0 = rr * 2 + 3;
  const S = S0 * SC;
  const lo = makeCanvas(S0, S0);
  const { c, g: gOut } = makeCanvas(S, S);
  const g = lo.g;
  const cx = S0 / 2;
  const cy = S0 / 2;
  r = rr;
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
  gOut.imageSmoothingEnabled = false;
  gOut.drawImage(lo.c, 0, 0, S0, S0, 0, 0, S, S);
  moonC = { c, g: gOut, key };
  return c;
}

// 픽셀 원반 — 절반 해상도에 그려 2배로 키운다(가장자리가 계단). 반경·색·알파별로 하나만 캐시.
let discC: { c: HTMLCanvasElement; key: string } | null = null;
function pixelDisc(R: number, rgbStr: string, alpha: number): HTMLCanvasElement {
  const key = `${R}:${rgbStr}:${alpha.toFixed(2)}`;
  if (discC && discC.key === key) return discC.c;
  const SC = 2;
  const rr = Math.max(2, Math.round(R / SC));
  const S0 = rr * 2 + 2;
  const lo = makeCanvas(S0, S0);
  lo.g.fillStyle = `rgb(${rgbStr} / ${alpha.toFixed(3)})`;
  lo.g.beginPath();
  lo.g.arc(S0 / 2, S0 / 2, rr, 0, TAU);
  lo.g.fill();
  const im = lo.g.getImageData(0, 0, S0, S0);
  const d = im.data;
  const aFull = Math.round(alpha * 255);
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < aFull * 0.45 ? 0 : aFull;
  lo.g.putImageData(im, 0, 0);
  const { c, g } = makeCanvas(S0 * SC, S0 * SC);
  g.imageSmoothingEnabled = false;
  g.drawImage(lo.c, 0, 0, S0, S0, 0, 0, S0 * SC, S0 * SC);
  discC = { c, key };
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
    // 은하수는 달빛이 약할 때만 보인다(검토 C) — 보름 근처엔 별과 함께 씻긴다.
    const mw = lit < 0.55 ? milkyWay(seed, w, maxY) : null; // .35 → .55(라운드 7, A: 16장 중 0장이었다)
    if (mw) {
      g.save();
      g.globalAlpha *= starK;
      g.drawImage(mw, 0, 0);
      g.restore();
    }
    for (const s of stars(seed, w, maxY)) {
      const a = (0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.7 + s.r * 0.3) + s.ph))) * starK;
      g.fillStyle = `rgb(240 244 250 / ${a.toFixed(2)})`;
      g.fillRect(Math.round(s.x), Math.round(s.y), s.r, s.r);
    }
    // 달 — 빛의 길(reflect.x) 위, 음력 위상 원반 + 글로우(비친 비율만큼). 삭(lit < .04)엔 달이 없다.
    if (lit >= 0.04) {
      const mx = w * L.reflect.x;
      const my = opts.moonY ?? Math.min(maxY * 0.5, 34);
      // 지름은 하늘 높이에 비례(상한 56px, 검토 A ④-2) — 40px 하늘 시절 값(지름 14)은 넓은 하늘에서 콩알이다.
      // 지름은 하늘 높이의 4.5%만(검토 C: "커진 달은 만화가 된다" — 시간은 크기가 아니라 **고도**로 말한다).
      const R = Math.max(7, Math.min(14, Math.round(maxY * 0.045)));
      // 글로우 반경 R·3.6 → R·2.6에 α 두 배(면적당 밝기 유지) — 넓게 퍼지면 8bit에서 1L 이하가 된다(검토 C).
      softBlob(g, mx, my, R * 2.6, "226 232 244", 0.16 + 0.3 * lit, 0);
      const spr = moonSprite(R, moonPhase(f.date.y, f.date.m, f.date.d));
      g.drawImage(spr, Math.round(mx - spr.width / 2), Math.round(my - spr.height / 2));
    }
    return;
  }
  if (band === "dawn" || band === "dusk") {
    // 해 — 지평선 가까이 낮게, 회백(새벽)·회장미(노을) 원반 + 넓고 옅은 글로우. 선명한 주황은 없다(오행).
    const sx = w * L.reflect.x;
    const sy = opts.sunY ?? Math.max(maxY * 0.55, maxY - 14);
    const col = band === "dusk" ? "244 226 220" : "236 238 240";
    const R = Math.max(9, Math.min(16, Math.round(maxY * 0.05)));
    softBlob(g, sx, sy, R * 3, col, band === "dusk" ? 0.5 : 0.34, 0);
    // 원반도 픽셀 계단으로(달과 같은 이유) — 저해상 원을 굽고 nearest로 키운다.
    const disc = pixelDisc(R, col, band === "dusk" ? 0.6 : 0.45);
    g.drawImage(disc, Math.round(sx - disc.width / 2), Math.round(sy - disc.height / 2));
  }
}
