// 날씨 입자층(2026-09-05, QA 라운드 2 — AMB-W1-02·M3-01). 비·눈·바람 부스러기·안개 뭉치를 **엔진이 한 번** 그린다 —
// 장면마다 짜지 않는다(라운드 1: 눈 오는 겨울 산에 눈송이 0, 숲·암석 바람에 정지). 장면이 스스로 그리는 날씨는
// `Scene.ownsWeather(w)`로 알려 겹치지 않게 한다(초원 겨울의 착지 눈송이).
// 규칙(ADR-0017 ⑧ LOD): 부드러운 것은 저해상 — 빗줄기는 0.5× 오프스크린에 선으로 긋고 확대, 눈·부스러기는 작은 점이라 직접.
// 결정성: 시드 rng, 고정 dt step. 여력(load)·`lite`로 수를 줄이되 0으로는 안 내린다(계절 인식 유지).
// 원근: 아래(가까움)가 굵고 빠르다(GRAMMAR §3.2 비 행).

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { clamp, lerp, rng, TAU, type Rng } from "@/components/shared/ambient/scenes/util";
import { GROUND_SQUASH, horizonY } from "./view";
import type { Light } from "./light";
import type { Weather } from "./weather";

type Drop = { x: number; y: number; d: number; len: number };
type Flake = { x: number; y: number; d: number; ph: number; vy: number };
type Mote = { x: number; y: number; d: number; ph: number; k: number };
type Wisp = { x: number; y: number; rx: number; a: number; sp: number; ph: number };

export type ParticleLayer = {
  step(dt: number, w: number, h: number, weather: Weather, light: Light, load: number, lite: boolean, own: boolean): void;
  draw(g: CanvasRenderingContext2D, w: number, h: number, season: SeasonKey, weather: Weather, light: Light, t: number): void;
  debug(): Record<string, number>;
};

// 계절별 바람 부스러기 색(오행 팔레트 — 붉·주황·노랑 없음).
const MOTE_RGB: Record<SeasonKey, string[]> = {
  spring: ["236 226 232", "220 232 214", "244 240 236"],
  summer: ["176 196 160", "200 212 186", "150 172 140"],
  autumn: ["136 108 78", "122 84 82", "150 130 96"],
  winter: ["236 242 248", "214 224 234", "246 248 252"]
};

/** 바람 방향(±1) — 시드로 한 번 정한다(왼→오 / 오→왼). 입자층과 **장면이 같은 부호를 써야** 한 화면에 바람이 둘이 되지 않는다
 * (2026-09-06 라운드 14, 검토 B #4: 입자는 −1인데 물보라 vx는 늘 +, 거품은 늘 −x, 풀 파는 늘 +x였다). 세기는 `Light.wind`. */
export function windDirOf(seed: number): number {
  return ((seed >>> 3) & 1) === 0 ? 1 : -1;
}

export function createParticles(seed: number): ParticleLayer {
  const r: Rng = rng((seed * 31 + 0x5eed) >>> 0);
  const drops: Drop[] = [];
  const flakes: Flake[] = [];
  const motes: Mote[] = [];
  const wisps: Wisp[] = [];
  let rainC: HTMLCanvasElement | null = null;
  let rainG: CanvasRenderingContext2D | null = null;
  let wind = 0;

  const targetRain = (load: number, lite: boolean, w: number, h: number) => Math.round(lerp(70, 240, load) * (lite ? 0.5 : 1) * clamp((w * h) / 1_200_000, 0.6, 1.5));
  const targetSnow = (load: number, lite: boolean, w: number, h: number) => Math.round(lerp(50, 170, load) * (lite ? 0.5 : 1) * clamp((w * h) / 1_200_000, 0.6, 1.5));
  const targetMote = (load: number, lite: boolean, windK: number) => Math.round(lerp(8, 34, load) * (lite ? 0.5 : 1) * clamp(windK, 0, 1));
  const targetWisp = (fog: number, lite: boolean) => (fog <= 0 ? 0 : Math.round((lite ? 4 : 7) * clamp(fog / 0.55, 0.5, 1.4)));

  // 원근은 **화면 세로 위치의 함수**다(2026-09-06 라운드 8) — 옛 코드는 `d`와 `y`를 독립으로 뽑아
  // 지평선 띠 위에도 근경 굵기의 비가 떨어졌다(주석은 "아래가 굵고 빠르다"라고 적혀 있었는데 코드는 아니었다).
  // 지평선이 .12 → .26으로 오르며 하늘에 떨어지는 비 비율이 배증해 더 눈에 띈다(검토 C).
  const depthOf = (y: number, h: number) => {
    const hz = horizonY(h);
    if (y < hz) return 0.12 + 0.08 * Math.max(0, y / Math.max(1, hz)); // 하늘 구간은 먼 비 = 가늘고 옅은 베일
    return 0.15 + 0.85 * clamp((y - hz) / Math.max(1, h - hz), 0, 1);
  };
  const newDrop = (w: number, h: number, top: boolean): Drop => {
    const y = top ? -20 - r() * 40 : r() * h;
    const d = depthOf(y, h); // 0 = 멀다(가늘고 느림) … 1 = 가깝다
    return { x: r() * (w + 200) - 100, y, d, len: 7 + d * 12 };
  };
  const newFlake = (w: number, h: number, top: boolean): Flake => {
    const y = top ? -10 - r() * 30 : r() * h;
    const d = depthOf(y, h);
    return { x: r() * (w + 120) - 60, y, d, ph: r() * TAU, vy: 16 + d * 26 };
  };
  const newMote = (w: number, h: number, edge: boolean): Mote => {
    const d = 0.3 + r() * 0.7;
    return { x: edge ? (wind >= 0 ? -20 - r() * 60 : w + 20 + r() * 60) : r() * w, y: horizonY(h) + r() * (h - horizonY(h)), d, ph: r() * TAU, k: 0.7 + r() * 0.8 };
  };
  const newWisp = (w: number, h: number): Wisp => {
    const hz = horizonY(h);
    // α .06~.12 — 옛 .03~.075는 8bit 변화 ≤ 6이라 시간 시트 임계 아래(안개 장면이 "정지"로 잡혔다, 라운드 3 C#7). 보이되 옅게.
    // 라운드 11(우선순위 E): 뭉치는 밀도장이 짙은 **원·중경**(v .04~.5)에만 — 옛 .12~.82는 발치까지 떠서 밀도장과 무관한 "떠다니는 덩이"였다.
    // 크기는 멀수록 작게(원근).
    const v = 0.04 + Math.pow(r(), 1.4) * 0.46;
    // α .10~.18 · 속도 12~30px/s(라운드 11, 검토 C #3: 옛 α .06~.12·2~6px/s는 8비트 아래라 안개 날이 맑음보다 덜 움직였다).
    return { x: r() * w, y: hz + v * (h - hz), rx: (120 + r() * 220) * (0.55 + 0.9 * v), a: 0.1 + r() * 0.08, sp: 12 + r() * 18, ph: r() * TAU };
  };

  const fit = <T>(arr: T[], n: number, make: () => T) => {
    while (arr.length < n) arr.push(make());
    if (arr.length > n) arr.length = n;
  };

  return {
    step(dt, w, h, weather, light, load, lite, own) {
      // 바람 방향은 시드로 한 번 정한다(왼→오 또는 오→왼), 세기는 조명에서. 장면도 같은 값을 `f.windDir`로 받는다(라운드 14).
      const dir = windDirOf(seed);
      wind = dir * light.wind;
      const hz = horizonY(h);
      // 비
      fit(drops, weather === "rain" && !own ? targetRain(load, lite, w, h) : 0, () => newDrop(w, h, false));
      for (const q of drops) {
        const sp = (520 + q.d * 620) * dt;
        q.y += sp;
        q.x += sp * wind * 0.55;
        q.d = depthOf(q.y, h); // 내려오며 굵어진다 — 원근이 y를 따라야 3/4 카메라와 층이 맞는다(라운드 8)
        q.len = 7 + q.d * 12;
        if (q.y > h + 20) Object.assign(q, newDrop(w, h, true));
      }
      // 눈
      fit(flakes, weather === "snow" && !own ? targetSnow(load, lite, w, h) : 0, () => newFlake(w, h, false));
      for (const q of flakes) {
        q.ph += dt * (0.8 + q.d * 0.6);
        q.y += q.vy * dt * (1 + Math.abs(wind) * 0.4);
        q.d = depthOf(q.y, h);
        q.vy = 16 + q.d * 26;
        q.x += (Math.sin(q.ph) * 9 + wind * 42 * q.d) * dt;
        if (q.y > h + 10) Object.assign(q, newFlake(w, h, true));
        if (q.x < -70) q.x += w + 130;
        if (q.x > w + 70) q.x -= w + 130;
      }
      // 바람 부스러기 — 바람 .15 미만이면 없다(맑음은 정지 그대로: 회귀 해시).
      fit(motes, Math.abs(light.wind) >= 0.15 ? targetMote(load, lite, Math.abs(light.wind)) : 0, () => newMote(w, h, false));
      for (const q of motes) {
        q.ph += dt * (2.2 + q.d * 1.6);
        q.x += wind * (150 + q.d * 160) * dt;
        q.y += Math.sin(q.ph) * 16 * dt;
        if (q.y < hz) q.y = hz + 4;
        if ((wind >= 0 && q.x > w + 30) || (wind < 0 && q.x < -30)) Object.assign(q, newMote(w, h, true));
      }
      // 안개 뭉치 — 느린 표류
      fit(wisps, targetWisp(light.groundFog, lite), () => newWisp(w, h));
      for (const q of wisps) {
        q.ph += dt * 0.3;
        q.x += (q.sp * (0.4 + wind) + Math.sin(q.ph) * 3) * dt;
        if (q.x > w + q.rx) q.x = -q.rx;
        if (q.x < -q.rx) q.x = w + q.rx;
      }
    },
    draw(g, w, h, season, weather, light, t) {
      // 안개 뭉치 — 지면 위에 낮게, 눌린 타원(3/4 시점).
      if (wisps.length) {
        for (const q of wisps) {
          const a = q.a * (0.7 + 0.3 * Math.sin(q.ph * 2 + t * 0.6)); // 맥동 ±30%(≈ .1Hz)
          const grad = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.rx);
          grad.addColorStop(0, `rgb(${light.hazeRgb || "228 232 234"} / ${a})`);
          grad.addColorStop(1, `rgb(${light.hazeRgb || "228 232 234"} / 0)`);
          g.save();
          g.translate(q.x, q.y);
          g.scale(1, GROUND_SQUASH * 0.55);
          g.translate(-q.x, -q.y);
          g.fillStyle = grad;
          g.fillRect(q.x - q.rx, q.y - q.rx, q.rx * 2, q.rx * 2);
          g.restore();
        }
      }
      // 바람 부스러기 — 작은 점·짧은 줄(계절색).
      if (motes.length) {
        const cols = MOTE_RGB[season];
        for (let i = 0; i < motes.length; i++) {
          const q = motes[i];
          const c = cols[i % cols.length];
          g.fillStyle = `rgb(${c} / ${0.35 + q.d * 0.35})`;
          g.beginPath();
          g.ellipse(q.x, q.y, (1.2 + q.d * 1.6) * q.k, (0.7 + q.d * 0.7) * q.k, Math.atan2(Math.sin(q.ph) * 16, wind * 200), 0, TAU);
          g.fill();
        }
      }
      // 눈송이 — 작은 원(가까운 것이 크고 진하다).
      if (flakes.length) {
        for (const q of flakes) {
          g.fillStyle = `rgb(250 252 255 / ${0.45 + q.d * 0.4})`;
          g.beginPath();
          g.arc(q.x, q.y, 0.9 + q.d * 1.9, 0, TAU);
          g.fill();
        }
      }
      // 빗줄기 — 0.5× 오프스크린에 선으로 긋고 확대(LOD). 바람만큼 사선.
      if (drops.length && weather === "rain") {
        const sw = Math.max(1, Math.ceil(w * 0.5));
        const sh = Math.max(1, Math.ceil(h * 0.5));
        if (!rainC || rainC.width !== sw || rainC.height !== sh) {
          rainC = document.createElement("canvas");
          rainC.width = sw;
          rainC.height = sh;
          rainG = rainC.getContext("2d");
        }
        const rg = rainG!;
        rg.clearRect(0, 0, sw, sh);
        rg.lineCap = "round";
        for (const q of drops) {
          const dx = wind * 0.55 * q.len;
          rg.strokeStyle = `rgb(214 224 236 / ${0.22 + q.d * 0.3})`;
          rg.lineWidth = 0.5 + q.d * 0.9;
          rg.beginPath();
          rg.moveTo(q.x * 0.5, q.y * 0.5);
          rg.lineTo((q.x - dx) * 0.5, (q.y - q.len) * 0.5);
          rg.stroke();
        }
        g.drawImage(rainC, 0, 0, w, h);
      }
    },
    debug() {
      return { drops: drops.length, flakes: flakes.length, motes: motes.length, wisps: wisps.length, wind: Math.round(wind * 100) / 100 };
    }
  };
}
