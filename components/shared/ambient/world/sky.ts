// 하늘(QA 라운드 5, 2026-09-06 소유자: "밤이면 밤하늘, 가을 낮이면 천고마비 높은 푸른 하늘, 비 올 땐 구름 많이 낀 것 — 그런 변화를 보고 싶다").
// 지금까지 지평선 위는 계절 안개색 한 겹(view.ts bakeHorizon)이었고 밤 별은 바다만 있었다. 여기서 **계절 × 날씨의 하늘 판**을 한 번 굽고
// (그라데이션 + 픽셀 구름), 띠에 따라 별·달·해를 프레임마다 얹는다. 3/4 카메라라 하늘은 지평선 위 12%(+ 산·바다는 능선/수평선 위)뿐이지만,
// 그 띠가 "지금 어떤 날인가"를 말한다. 팔레트는 오행 규칙(선명한 주황·노랑 금지 — 파랑은 저채도 청, 노을은 회장미).
// 순서(장면): ground → **sky** → horizon(안개·언덕) → (산: peaks) → **skyLive(별·달·해)** — 별은 언덕·봉우리에 가려야 하므로 y 상한을 받는다.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Weather } from "./weather";
import type { DayBand } from "./time";
import type { Light } from "./light";
import { hillCrestY, horizonY } from "./view";
import { makeCanvas, softBlob, TAU } from "@/components/shared/ambient/scenes/util";
import { drawArt } from "@/components/shared/ambient/art/load";
import { SkyAtlas } from "../art/sky-atlas";
import { moonPhase, moonLit, moonPixelLit, moonPosition } from "./moon";
export { moonPhase, moonLit } from "./moon";
import { aimSprite, ART_HEADING, skyEventAt, type SkyEventKind } from "./sky-events";
import { withDepthLayer } from "./depth-render";
import { makeCloudField, drawCloudField, cloudArtVersion } from "./cloud-field";
import { drawStarfield, moonSkyWash } from "./starfield";
import { DEFAULT_SKY_BEARING, projectSky, type SkyBearing } from "./celestial";

// 하늘의 그림 자리(2026-09-08) — 해·달 여덟 위상·구름 네 갈래. 파일이 있으면 그림을, 없으면 아래의 코드 도형을 쓴다
// (다른 자리와 같은 규칙, ADR-0017 ⑮). 하늘은 장면마다 굽히므로 **모듈 하나에 ArtSet 하나**를 두고 공유한다.
const skyArt = new SkyAtlas();
/** 굽기 키에 섞을 아트 판(늦게 도착하면 값이 올라 하늘·구름이 한 번 다시 구워진다). */
export const skyArtVersion = () => skyArt.version;

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
  // 라운드 10(검토 A #1): 여섯 띠 천정 L이 세 쌍으로 접혔다(새벽 59.9 ≈ 노을 62.4 · 저녁 46.6 ≈ 밤 44.6). 새벽은 노을보다
  // **낮게**(해 뜨기 전 차가움), 밤은 **깊게**(규칙 L* ≈ 28~35 — 옛 "84 100 140"은 저녁보다 밝은 "흐린 저녁"이었다),
  // 밤 지평선은 흰색이 아니라 L* ≤ 80(하늘 > ① 순서는 지평선 24px 림 광만으로 지킨다 — ROUND-05 열린 결정 유지),
  // 저녁 지평선에는 노을 잔광(회장미 저채도)을 남겨 색상으로도 밤과 갈라놓는다.
  dawn: ["96 114 150", "226 224 228"],
  // 노을 — 천정을 **회장미**(hue 330° · 채도 .17)로(2026-09-06 라운드 8, 검토 A #10·C): 렌더된 천정 채도가
  // .06~.09로 규칙 상한(.3)의 1/4만 써 "하늘이 가장 색을 갖는 시간"이 오히려 가장 무채색이었다.
  // 오행 규칙은 **선명한 주황·노랑**을 금하고 회장미는 노을의 지정색이다(CLAUDE.md). A는 .18~.30을,
  // B·C는 절제를 권했으므로 중간값 .17로 잡았다. 지평선은 밝고 옥게 두어
  // 세로 채도 기울기를 만든다(라운드 6 결정 3).
  dusk: ["158 118 138", "214 198 202"],
  evening: ["53 71 116", "214 200 204"],
  night: ["25 35 65", "126 145 176"]
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
      // 어두운 띠는 더 많이 내린다(2026-09-06 라운드 8 실측: 상수 −7로는 저녁 −1.1 · 밤 **+3.5**로 부호가 남았다).
      // L*은 바탕이 어두울수록 같은 RGB 차이가 작아 보이므로, 어두운 띠일수록 큰 오프셋이 필요하다.
      // **노을은 '낮'이 아니다**(2026-09-06 라운드 9, 검토 C): 맑은 노을 천정 L 54.09는 새벽(54.92)과 같은 어둡기인데
      // 낮 오프셋을 받아 안개·흐림 판 Δ가 혼자 초과했다. 어두운 버킷에 넣는다.
      const dk = band === "night" ? -40 : band === "evening" ? -22 : band === "dawn" || band === "dusk" ? -13 : -12;
      const dz = band === "night" ? -20 : band === "evening" ? -16 : band === "dawn" || band === "dusk" ? -11 : -8;
      const t = add(grey(top, 0.8), dk);
      const z = add(grey(hz, 0.8), dz);
      return done(t, z, [add(z, 8), add(z, -22)], 0.85, false);
    }
    case "rain": {
      // 비도 같은 이유로 띠별(라운드 9, 검토 C: 저녁·밤 비 하늘 Δ가 −0.77 / −1.48, 목표 −14).
      const rk = band === "night" ? 0.2 : band === "evening" || band === "dawn" || band === "dusk" ? 0.42 : 0.75;
      const ro = band === "night" ? -26 : band === "evening" || band === "dawn" || band === "dusk" ? -18 : -8;
      const t = add(mix(top, [112, 120, 134], rk), ro);
      const z = add(mix(hz, [150, 158, 170], rk), ro + 2);
      return done(t, z, [add(t, 6), add(t, -22)], 0.95, false);
    }
    case "snow": {
      // 눈구름은 밝지만 맑은 하늘보다는 **어둡다** — 옛 혼합은 하늘을 +0.8L 밝히고 있었다
      // (2026-09-06 라운드 8, 검토 C: 눈이 5 날씨 중 유일하게 3열 미달). GRAMMAR §3.2 눈 행 "하늘 L −6".
      // 혼합비가 상수 .7이면 어두운 띠의 천정을 밝은 회색으로 **70%나** 끌어올린 뒤 −7을 빼는 셈이라
      // 그 −7이 반올림 오차가 된다(2026-09-06 라운드 9, 검토 C: 눈 하늘이 5/6 띠에서 맑음보다 최대 +16.5L 밝았다).
      // 흐림·안개와 같은 어법으로 — 어두운 띠일수록 적게 섞고 오프셋은 크게.
      const sk = band === "night" ? 0.16 : band === "evening" || band === "dawn" || band === "dusk" ? 0.28 : 0.48;
      const so = band === "night" ? -22 : band === "evening" ? -19 : band === "dawn" || band === "dusk" ? -14 : -13;
      const t = add(mix(top, [200, 206, 214], sk), so);
      const z = add(mix(hz, [222, 226, 232], sk), so + 1);
      return done(t, z, [add(t, 7), add(t, -12)], 0.8, false);
    }
    case "fog": {
      // 안개 — 하늘이 보이지 않는 날이지만 완전한 무지 판은 아니다. 아주 옥은 저층운 한 겹으로
      // 세로 결을 남긴다(검토 A: s10은 하늘 224행 전체 최대 편차가 1.3L였다).
      // 안개 — 세로 폭을 준다(2026-09-06 라운드 7 C: 하늘 224px 전체의 세로 변화가 0.3~1.9L인 "흰 벽").
      // 안개도 위가 어둡고 지평선이 밝다 — 대기는 아래가 두꺼우니까.
      // 혼합비는 **띠에 따라**(2026-09-06 라운드 8, 검토 C: 밤 안개 하늘 L 65가 맑은 저녁 L 46보다 밝았다 —
      // 상수 .8이 어두운 띠의 하늘을 흰 판으로 끌어올렸다). 어두운 띠일수록 안개도 어둡다.
      const fk = band === "night" ? 0.34 : band === "evening" || band === "dawn" || band === "dusk" ? 0.56 : 0.8;
      const z = mix(hz, [224, 228, 232], fk);
      // **천정은 지평선이 아니라 천정에서 만든다**(2026-09-06 라운드 8 실측: 지평선에서 파생하니 밤 안개 하늘이
      // 맑은 밤보다 +19.9L 밝았다 — 밤의 맑은 천정은 어둡고 지평선은 밝게 설계돼 있기 때문). 규칙 §3.2 "안개 = L +4".
      const fkTop = band === "night" ? 0.04 : band === "evening" || band === "dawn" || band === "dusk" ? 0.1 : 0.18;
      // 덩이 색도 **천정에서** 만든다(라운드 9, 검토 C: 밤 안개 덩이가 그 띠 천정보다 +52.6L 밝아 하늘에
      // 또렷한 흰 뭉게구름이 떴다 — "하늘이 보이지 않는 날"이 "맑은 날 + 안개 필터"로 읽혔다). cover도 .3 → .12.
      const ft = mix(top, [200, 206, 212], fkTop);
      // cover .12는 유지(규칙 "하늘은 어느 날씨에도 완전히 비지 않는다") — 대신 `bakeClouds`가 **안개에선 낱개 원반을 그리지 않고**
      // 저주파 밝기 얼룩 한 장만 깐다(2026-09-06 라운드 11, 검토 A #2: 새벽·저녁·밤 안개 하늘에 하늘보다 어두운 원반 = "맑은 날 + 회색 필터").
      return done(ft, z, [add(ft, 6), add(ft, -5)], 0.12, false);
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


/** Individual cloud forms above the terrain. Fog retains an unshaped veil. */
export function bakeClouds(season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number, seed: number, floorY?: number): {far:HTMLCanvasElement;near:HTMLCanvasElement}|null {
  const floor=floorY??hillCrestY(h);
  if(weather!=="fog") return makeCloudField(season,weather,w,floor,seed);
  const pal=skyPalette(season,weather,band);
  if(!pal.cloud)return null;
  const lw=Math.ceil(w/3),lh=Math.ceil(floor/3);
  const mk=()=>{
    const {c,g}=makeCanvas(lw*2,lh);
    for(let x=0;x<lw*2;x+=4)for(let y=0;y<lh;y+=4){
      const u=(x%lw)/lw*Math.PI*2;
      const n=.5+.22*Math.sin(u*2+y*.05)+.2*Math.sin(u*5+1.3+y*.11)+.12*Math.sin(u*9+2.7+y*.19);
      g.fillStyle=`rgb(${pal.cloud![0]} / ${(.13*Math.max(0,n-.35)).toFixed(3)})`;g.fillRect(x,y,4,4);
    }
    g.globalCompositeOperation='destination-out';
    const fade=g.createLinearGradient(0,lh*.72,0,lh);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=fade;g.fillRect(0,lh*.72,lw*2,lh*.28);
    const up=makeCanvas(Math.ceil(w*2),Math.ceil(floor));up.g.imageSmoothingEnabled=false;up.g.drawImage(c,0,0,up.c.width,up.c.height);return up.c;
  };
  return {far:mk(),near:mk()};
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
  weather: Weather,
  beforeClouds?: () => void
) {
  // Sky stays fixed in panel coordinates; cancel the ground translation before filling its full width.
  withDepthLayer(g, "sky", () => drawSkyContent(g, sky, clouds, w, t, weather, beforeClouds));
}

function drawSkyContent(
  g: CanvasRenderingContext2D,
  sky: HTMLCanvasElement,
  clouds: { far: HTMLCanvasElement; near: HTMLCanvasElement } | null,
  w: number,
  t: number,
  weather: Weather,
  beforeClouds?: () => void
) {
  g.drawImage(sky, 0, 0, w, sky.height);
  beforeClouds?.();
  if (!clouds) return;
  if (drawCloudField(g, clouds.far, t)) return;
  const v = cloudSpeed(weather);
  for (const [layer, mul] of [[clouds.far, 0.45], [clouds.near, 1]] as const) {
    const off = -(((t * v * mul) % w) + w) % w;
    g.drawImage(layer, off, 0, w * 2, layer.height);
  }
}

export const skyKey = (season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number): string =>
  `${season}|${weather}|${band}|${w}x${h}|hz${horizonY(h)}|a${skyArt.version}|c${cloudArtVersion()}`;

/** 하늘 판 굽기 — 지평선까지 불투명, 그 아래 4%h는 사라진다(땅의 먼 띠를 덮지 않게). 구름은 1/3 해상도에 그려 보간 없이 키운다(픽셀 계단, AA 없음 — ADR-0017 ⑱). */
export function bakeSky(season: SeasonKey, weather: Weather, band: DayBand, w: number, h: number, seed: number, topY = 0, daylight?: readonly [string, string]): HTMLCanvasElement {
  const hz = horizonY(h);
  const H = Math.ceil(hz + (h - hz) * 0.05); // 지평선 아래로 새는 여유도 땅 비례(검토 B)
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w)), H);
  const pal = skyPalette(season, weather, band);
  if (daylight) { pal.top = daylight[0]; pal.hz = daylight[1]; }
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

// Round silhouette and continuously lit sphere, baked at display-pixel scale.
// Phase quantization is below one visible pixel and avoids work every frame.
let moonC: { c: HTMLCanvasElement; key: string } | null = null;
function moonSprite(r: number, phase: number): HTMLCanvasElement {
  const phaseStep = Math.round(phase * 2048);
  const key = r + ":" + phaseStep + ":" + skyArt.version;
  if (moonC?.key === key) return moonC.c;
  const size = r * 2 + 4, { c, g } = makeCanvas(size, size);
  const art = skyArt.get("moon-phase");
  g.imageSmoothingEnabled = false;
  if (art) g.drawImage(art.c, 2, 2, r * 2, r * 2);
  else { g.fillStyle = "#ecf0f8"; g.fillRect(0, 0, size, size); }
  const im = g.getImageData(0, 0, size, size), data = im.data;
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const nx=(x+.5-size/2)/r,ny=(y+.5-size/2)/r,i=(y*size+x)*4;
    if(nx*nx+ny*ny>1 || !moonPixelLit(nx,ny,phaseStep / 2048)) data[i+3]=0;
  }
  g.putImageData(im,0,0);
  moonC={c,key};return c;
}

// Fade the thinnest crescent and its halo together instead of switching at 4%.
function moonVisibility(lit: number): number {
  const u = Math.max(0, Math.min(1, (lit - .005) / .035));
  return u * u * (3 - 2 * u);
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

export type SkyFrame = {
  t: number;
  /** sun = 그 순간의 해(고도·방위, 도). 있으면 해의 높이를 **실제 고도**로 놓는다(2026-09-07, PLAN-006) — 겨울 노을 해가 더 낮게 걸린다. */
  time: { band: DayBand; hour?: number; sun?: { alt: number; az: number } };
  weather: { now: Weather };
  light: Light;
  date: { y: number; m: number; d: number };
  /** 여력 0~1 — 드문 하늘 사건(별똥별·혜성)이 약한 기기에서 먼저 접히게. 없으면 1로 본다. */
  load?: number;
  /** 개발자 강제 — 이 종류의 하늘 사건을 쉬지 않고 되풀이한다(설정·감상 톱니의 '하늘 사건'). */
  skyEvent?: SkyEventKind | null;
  skyBearing?: SkyBearing;
};

/** 해의 화면 y — 고도 0°면 지평선(maxY) 바로 위, 18° 이상이면 하늘의 위쪽 40% 지점. */
export function sunYOf(alt: number | undefined, maxY: number): number {
  const base = Math.max(maxY * 0.55, maxY - 14);
  if (alt === undefined) return base;
  const k = Math.max(0, Math.min(1, alt / 18));
  return Math.round(maxY - 14 - k * (maxY - 14) * 0.62);
}

/** A common 0–90° scale, rather than normalizing each season to its own noon.
 * This keeps winter's noon visibly lower than summer's on the same canvas. */
export function solarSunYOf(alt: number, maxY: number): number {
  const bottom = Math.max(14, maxY - 14);
  return Math.round(bottom - Math.max(0, Math.min(1, alt / 90)) * (bottom - Math.min(20, bottom)));
}

type SkyOptions = { moonY?: number; sunY?: number; solarPath?: boolean; solarHorizon?: number };

/** 프레임마다: 별(밤·맑음/바람) · 달(밤, 음력 위상) · 해(새벽·노을, 맑음/바람) — 픽셀 사각 별, 옅은 달·해 원반 + 글로우. `maxY` = 언덕·능선에 가리지 않을 상한. */
/** 밤하늘의 드문 사건 — 별똥별과 혜성. 일정은 `sky-events.ts`가 (시드, t)의 순수 함수로 정한다(결정성).
 *  둘 다 **하늘 띠 안**에서만 움직이고 지평선을 넘지 않는다 — 땅 위를 지나가면 반딧불이가 된다. */
function drawSkyEvents(g: CanvasRenderingContext2D, w: number, f: SkyFrame, seed: number, maxY: number) {
  const t = f.t;
  const load = f.load ?? 1;
  // ── 혜성 — 아주 느리게 **비스듬히** 건너간다. 오래 떠 있어 "지나가는 중"을 알아볼 시간이 있다.
  const cm = skyEventAt(seed, "comet", t, load, f.skyEvent);
  const cSpr = cm ? skyArt.pick("comet", cm.r[2]) : null;
  if (cm && cSpr) {
    const dir = cm.r[0] < 0.5 ? 1 : -1; // 오른쪽으로 가나 왼쪽으로 가나
    // **수평 금지**(2026-09-07 라운드 17, 소유자 + 검토 C 실측: 진행각이 정확히 180.0°였다 — y가 상수라
    // 하늘을 자로 그은 듯 미끄러졌고, 자연물이 아니라 UI 티커로 읽혔다). 별똥별처럼 기울여 내려오되 훨씬 얕게:
    // 더 멀리 있는 천체는 각속도도 각도도 작다. 하늘 띠가 좁아(maxY ≈ 153px) 별똥별의 0.42를 그대로 쓰면 화면을
    // 다 건너기 전에 지평선을 뚫으므로 **가로 폭을 줄여 기울기를 산다** — span 1.25w → 0.50w.
    // 26초 지속은 그대로다: 혜성이 혜성인 것은 크기가 아니라 그 시간이고, span만 줄여도 속도가 67 → 27px/s로 내려간다.
    const COMET_SLOPE = 0.1;
    const span = w * 0.5;
    const y0 = maxY * (0.1 + cm.r[1] * 0.24); // 끝점이 maxY×0.8을 넘지 않는 시작 띠
    const x = dir > 0 ? -w * 0.08 + span * cm.u : w * 1.08 - span * cm.u;
    const y = y0 + span * COMET_SLOPE * cm.u;
    // 크기는 별똥별과 같은 급(2026-09-08 소유자: "혜성은 크기가 왜 이리 커"). 하늘의 3분의 1을 차지하면 그림이 아니라 배너가 된다.
    const k = Math.min(7,maxY*(.03+cm.r[3]*.009)) / cSpr.h;
    // 나타나고 사라지는 것도 천천히 — 양 끝 18%에서 페이드.
    const a = Math.min(1, Math.min(cm.u, 1 - cm.u) / 0.18);
    const flip = dir < 0;
    g.save();
    g.globalAlpha *= 0.34 * a;
    g.filter="blur(0.6px)";
    // 꼬리가 **가는 쪽**을 따른다 — 별똥별과 같은 처리(`aimSprite`가 rotate → flip 합성을 감춘다).
    drawArt(g, cSpr, Math.round(x), Math.round(y), k, aimSprite(Math.atan2(COMET_SLOPE, dir), ART_HEADING.comet, flip), flip);
    g.restore();
  }
  // ── 별똥별 — 1초 남짓, 대각으로 떨어지며 꼬리가 늦게 사라진다.
  const st = skyEventAt(seed, "shooting-star", t, load, f.skyEvent);
  const sSpr = st ? skyArt.pick("shooting-star", st.r[2]) : null;
  if (st && sSpr) {
    const dir = st.r[0] < 0.5 ? 1 : -1;
    const x0 = w * (0.08 + st.r[1] * 0.84);
    const y0 = maxY * (0.06 + st.r[3] * 0.3);
    const len = w * 0.16;
    const slope = 0.42; // 내려가는 기울기 — 꼬리 각도가 여기서 나온다
    // 감속하며 흐른다(ease-out) — 등속으로 그으면 선 하나가 미끄러지는 것으로 보인다.
    const e = 1 - Math.pow(1 - st.u, 2.2);
    const x = x0 + dir * len * e;
    const y = y0 + len * slope * e;
    const k = Math.min(5,maxY*.027) / sSpr.h;
    // 앞머리에서 밝고 끝에서 빠르게 스러진다.
    const a = st.u < 0.18 ? st.u / 0.18 : Math.pow(1 - (st.u - 0.18) / 0.82, 1.6);
    const flip = dir < 0;
    g.save();
    g.globalAlpha *= .44*a;
    g.filter="blur(0.45px)";
    drawArt(g, sSpr, Math.round(x), Math.round(y), k, aimSprite(Math.atan2(slope, dir), ART_HEADING["shooting-star"], flip), flip);
    g.restore();
  }
}

export function drawSkyLive(g: CanvasRenderingContext2D, w: number, f: SkyFrame, seed: number, maxY: number, opts: SkyOptions = {}) {
  withDepthLayer(g, "sky", () => {
    g.save();
    if (opts.solarPath) { g.beginPath(); g.rect(0, 0, w, opts.solarHorizon ?? maxY); g.clip(); }
    drawSkyLiveContent(g, w, f, seed, maxY, opts);
    g.restore();
  });
}

function drawSkyLiveContent(g: CanvasRenderingContext2D, w: number, f: SkyFrame, seed: number, maxY: number, opts: SkyOptions) {
  const t = f.t;
  const band = f.time.band;
  const weather = f.weather.now;
  const L = f.light;
  const clearish = weather === "clear" || weather === "wind";
  const sunAlt = f.time.sun?.alt ?? -90;
  const bearing=f.skyBearing??DEFAULT_SKY_BEARING;
  const projectionHeight=opts.solarHorizon??maxY;
  const sunPoint=projectSky(f.time.sun?.az??180,sunAlt,w,projectionHeight,bearing);
  const moonHor=moonPosition({...f.date,hour:f.time.hour??21});
  const moonPoint=projectSky(moonHor.az,moonHor.alt,w,projectionHeight,bearing);
  const showSun = opts.solarPath ? sunPoint!==null : band === "dawn" || band === "dusk";
  const riseFade = Math.max(0, Math.min(1, (sunAlt + .833) / 2.833));
  const sunOpacity = opts.solarPath ? riseFade * riseFade * (3 - 2 * riseFade) : 1;
  const sunY = opts.solarPath ? sunPoint?.y??maxY : opts.sunY ?? sunYOf(f.time.sun?.alt, maxY);
  if (weather === "fog") {
    // 안개(2026-09-06 라운드 11, 검토 A #2): 해·달을 지우지 않고 **큰 저채도 halo만** — "빛은 있는데 방향이 없다"가 안개의 정서.
    // 원반·별·글로우 없음. 반지름은 맑음 글로우의 ×3, α .12~.2.
    if (showSun) {
      const sx = opts.solarPath?sunPoint!.x:w*L.reflect.x;
      const sy = sunY;
      const R = Math.max(9, Math.min(16, Math.round(maxY * 0.05)));
      softBlob(g, sx, sy, R * 9, band === "dusk" ? "240 228 224" : "236 238 240", 0.35 * sunOpacity, 0); // .16 → .35(라운드 12 A: 해 자리 L +0.8 = "빛이 없다")
    } else if (band === "night") {
      const lit = moonLit(moonPhase(f.date.y, f.date.m, f.date.d, f.time.hour));
      const visibility = moonVisibility(lit);
      if (visibility > 0 && moonPoint) {
        const mx = moonPoint.x;
        const my = moonPoint.y;
        const R = Math.max(7, Math.min(14, Math.round(maxY * 0.045)));
        softBlob(g, mx, my, R * 7.5, "226 232 244", (0.18 + 0.16 * lit) * visibility, 0);
      }
    }
    return;
  }
  if (!clearish && weather !== 'cloud') return;
  // Broken overcast leaves faint celestial light in the gaps; individual
  // clouds are composited after this layer and cover the stars beneath them.
  if(weather==='cloud')g.globalAlpha*=.35;
  if (band === "night") {
    // 별 — 1~2px 사각, 개체마다 위상이 다른 느린 깜박임. 밤 multiply(×.72)를 같이 받으므로 굽기 전 값은 밝게. 보름에 가까울수록 옅다(달빛).
    const lit = moonLit(moonPhase(f.date.y, f.date.m, f.date.d, f.time.hour));
    drawStarfield(g, {...f.date, hour:f.time.hour??21}, w, projectionHeight, bearing, t, moonSkyWash(lit,moonHor.alt), f.load??1);
    // Round moon and matching halo fade smoothly near the new moon.
    const visibility = moonVisibility(lit);
    if (visibility > 0 && moonPoint) {
      g.save();
      g.globalAlpha *= visibility;
      const mx = moonPoint.x;
      const my = moonPoint.y;
      // 지름은 하늘 높이에 비례(상한 56px, 검토 A ④-2) — 40px 하늘 시절 값(지름 14)은 넓은 하늘에서 콩알이다.
      // 지름은 하늘 높이의 4.5%만(검토 C: "커진 달은 만화가 된다" — 시간은 크기가 아니라 **고도**로 말한다).
      const R = Math.max(7, Math.min(14, Math.round(maxY * 0.045)));
      // 글로우 반경 R·3.6 → R·2.6에 α 두 배(면적당 밝기 유지) — 넓게 퍼지면 8bit에서 1L 이하가 된다(검토 C).
      softBlob(g, mx, my, R * 2.6, "226 232 244", 0.16 + 0.3 * lit, 0);
      const ph = moonPhase(f.date.y, f.date.m, f.date.d, f.time.hour);
      const spr = moonSprite(R, ph);
      g.drawImage(spr, Math.round(mx - spr.width / 2), Math.round(my - spr.height / 2));
      g.restore();
    }
    drawSkyEvents(g, w, f, seed, maxY);
    return;
  }
  if (showSun) {
    g.save(); g.globalAlpha *= sunOpacity;
    // 해 — 지평선 가까이 낮게, 회백(새벽)·회장미(노을) 원반 + 넓고 옅은 글로우. 선명한 주황은 없다(오행).
    const sx = opts.solarPath?sunPoint!.x:w*L.reflect.x;
    const sy = sunY;
    const col = band === "dusk" ? "244 226 220" : "236 238 240";
    const R = Math.max(9, Math.min(16, Math.round(maxY * 0.05)));
    softBlob(g, sx, sy, R * 3, col, band === "dusk" ? 0.5 : 0.34, 0);
    // Borderless cream sun from the new atlas; procedural disc while loading.
    const sunA = skyArt.pick("sun-disc", band === "dusk" ? 0.9 : 0.1);
    if (sunA) {
      g.save();
      g.globalAlpha *= band === "dusk" ? 0.92 : 0.8; // 원반이 하늘에서 튀지 않게 — 옛 픽셀 원반의 알파와 같은 뜻
      drawArt(g, sunA, Math.round(sx), Math.round(sy), (R * 2) / sunA.w);
      g.restore();
    } else {
      const disc = pixelDisc(R, col, band === "dusk" ? 0.6 : 0.45);
      g.drawImage(disc, Math.round(sx - disc.width / 2), Math.round(sy - disc.height / 2));
    }
    g.restore();
  }
  // A gibbous/quarter moon can also be above the daytime horizon. Keep it pale
  // and omit the halo; never invent a moon in the selected direction.
  if (moonPoint) {
    const ph=moonPhase(f.date.y,f.date.m,f.date.d,f.time.hour),lit=moonLit(ph);
    if(lit>.08){
      const r=Math.max(7,Math.min(14,Math.round(maxY*.045))),spr=moonSprite(r,ph);
      g.save();g.globalAlpha*=.28*moonVisibility(lit);g.drawImage(spr,Math.round(moonPoint.x-spr.width/2),Math.round(moonPoint.y-spr.height/2));g.restore();
    }
  }
}
