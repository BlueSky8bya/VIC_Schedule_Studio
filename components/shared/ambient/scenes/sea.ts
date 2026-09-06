// 먼바다(2026-09-04, PLAN-004 §3.6). 뭍이 없다(소유자 ⓪). 3/4 시점: 지평선 띠는 수평선 + 하늘, 그 아래로
// 너울과 거품 선이 관찰자 쪽으로 내려온다. 큰 너울 2겹·햇빛 반짝임·물고기 떼 그림자(얇은 판).
// **깊은 바다는 여기 없다** — 2026-09-06부터 `scenes/deep.ts`로 갈라졌다(소유자: 물속에 들어간 옆모습 시점 +
// 계절·날씨·시간대 무영향). 수면 문법(수평선·하늘·파도·글린트)을 물속에 쓰면 카메라가 둘이 된다.
// 규칙: 바탕 한 번 굽기, 매 프레임 stroke 몇 줄, 필터 없음, 어두운 얼룩 금지.

import type { Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, TAU } from "./util";
import { SIZE } from "../world/scale";
import { GROUND_SQUASH, bakeHorizon, horizonY, moveScale, ySort } from "../world/view";
import { ASSET, loadSprite, type Sprite } from "../assets";
import { bakeWater, drawGlints, drawRainRings, drawTrail, drawWaterLight, drawWaves, newTrail, stepRainRings, stepTrail, waterPalette, type RainRing } from "./water";
import { currentLight } from "../world/light";
import { bakeClouds, bakeSky, drawSky, drawSkyLive, skyKey } from "../world/sky";

type Shadow = { x: number; y: number; hd: number; spd: number; k: number; ph: number };

export function createSea(seed: number, opts: { season: SeasonKey }): Scene {
  const rand = rng(seed);
  const { season } = opts;
  let w = 0;
  let h = 0;
  let water: HTMLCanvasElement | null = null;
  let skyC: HTMLCanvasElement | null = null; // 하늘 판(라운드 5) — 계절 × 날씨
  let skyKeyCur = "";
  // 흐르는 구름 두 층(라운드 6 결정 4) — 폭 2w 타일, 오프셋은 t의 순수 함수라 캡처는 여전히 결정적이다.
  let cloudC: { far: HTMLCanvasElement; near: HTMLCanvasElement } | null = null;
  let horizon: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const glints: { x: number; y: number; ph: number; r: number }[] = [];
  const shadows: Shadow[] = [];
  const trail = newTrail();
  // 물고기 = **물 밑 실루엣**(연못과 같은 PD top-view 도안). 옛 코드의 타원 두 개는 "얼룩"으로 읽혔다(검토 2차).
  const FISH_SPR = 80;
  const fishSpr: (Sprite | null)[] = [null, null];
  let fishAsked = false;

  // 먼바다만 수평선을 지평선보다 .06h 내린다(검토 A: "가릴 것이 없는 진짜 수평선 — 하늘이 넓을수록 산다",
  // 권고 hz .36). 세계 좌표(toScreen)는 전역 값을 그대로 쓰고 **이 장면의 물 윗선**만 내린다.
  const top = () => horizonY(h) + h * 0.06;
  const pal = waterPalette(season);

  function bake(dpr: number) {
    // 바다는 바닥이 안 보인다 — caustic 없음(얕은 물 문법을 그대로 쓰면 "물 위의 낙서"가 된다).
    // 깊은 바다는 **물속**이라 위쪽에도 물이 차 있어야 한다(top=0). 옛 코드는 수평선 위가 비어 페이지 크림색이 비쳤다.
    water = bakeWater(w, h, top(), dpr, pal, seed, false, "#eef5fa");
    // 하늘 한 줄 — 수평선 위 12%: 옅은 하늘빛(밤·노을 톤은 엔진 tint가 얹는다). 깊은 바다는 더 어둑한 하늘.
    // 수평선 — 뭍 장면과 같은 지평선 띠(sea 프로파일: 안개만). 1.5px 흰 자를 대신한다.
    horizon = bakeHorizon(season, w, h, 1, "sea");
    gw = w;
    gh = h;
    gdpr = dpr;
  }
  // 빗방울 고리(라운드 14, 우선순위 B) — 먼바다도 비의 소비자다(전에는 빗줄기만 하늘에서 떨어졌다).
  const rings: RainRing[] = [];
  let rainRings = 0;
  const glintTarget = (load: number) => Math.round(lerp(6, 26, load));
  const shadowTarget = (load: number) => Math.round(lerp(6, 20, load));
  // 무리의 중심 두 곳 — 바다 물고기는 흩어져 다니지 않는다. 균등 산포는 "크기 위계 없는 스프라이트 뿌리기"로
  // 읽혔다(검토 라운드2 미관 #10).
  const schools = [
    { x: 0.28, y: 0.42 },
    { x: 0.72, y: 0.68 }
  ];
  function newShadow(): Shadow {
    // 8할은 두 무리 중 하나에 붙고, 2할은 홀로 다니는 큰 놈.
    const solo = rand() < 0.2;
    const sc = schools[rand() < 0.5 ? 0 : 1];
    const y = solo
      ? top() + 40 + Math.pow(rand(), 0.6) * (h - top() - 80)
      : Math.max(top() + 30, Math.min(h - 30, top() + sc.y * (h - top()) + (rand() - 0.5) * (h - top()) * 0.34));
    const x = solo ? rand() * w : Math.max(-40, Math.min(w + 40, sc.x * w + (rand() - 0.5) * w * 0.42));
    // 크기 등급 — 무리는 작은 놈, 홀로는 큰 놈(깊이와 위계가 같이 읽힌다).
    const cls = rand();
    // 큰 놈은 **가까운 쪽**에만 — 원경에 큰 놈이 섞이면 원근이 무너진다(사이클4 현실성 #3).
    const vv = (y - top()) / Math.max(1, h - top());
    const px = solo && vv > 0.45 ? SIZE.fishBig * (1.1 + rand() * 0.3) : vv < 0.35 ? SIZE.fishSmall : cls < 0.6 ? SIZE.fishSmall : SIZE.fishMid;
    return { x, y, hd: rand() < 0.5 ? 0 : Math.PI, spd: 22 + rand() * 18, k: px / 46, ph: rand() * TAU };
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!water || gw !== w || gh !== h || gdpr !== f.dpr) bake(f.dpr);
    },
    step(f) {
      const { dt, load, t } = f;
      // 포인터 물결 — 민물과 같은 문법(2026-09-04 소유자: "바다들도 민물에서 그러는 것처럼").
      stepTrail(trail, f.p, t, top(), f.h);
      // 빗방울 고리(2026-09-06 라운드 14) — 수평선 아래 전면. 원근: 아래일수록 잦고 크다(고른 산포 금지).
      rainRings += stepRainRings(
        rings,
        dt,
        f.weather.now === "rain",
        rand,
        (r) => {
          const t0 = top() + 10;
          const u = Math.pow(r(), 0.55);
          return { x: r() * w, y: t0 + u * (h - t0 - 4) };
        },
        lerp(6, 18, load),
        140
      );
      // 글린트 수 × 조명 글린트(라운드 4 C#2 — 저녁 0·노을 ×1.2·밤 ×.5). 점심·맑음 1 = 항등.
      const gt = Math.round(glintTarget(load) * currentLight().glint);
      while (glints.length < gt) glints.push({ x: rand() * w, y: top() + 20 + rand() * (h - top() - 40), ph: rand() * TAU, r: 1.4 + rand() * 1.6 });
      if (glints.length > gt) glints.length = gt;
      const st = shadowTarget(load);
      while (shadows.length < st) shadows.push(newShadow());
      if (shadows.length > st) shadows.length = st;
      // 물고기 떼 그림자(얇은 판) — 천천히 가로지르며 포인터를 피한다. 깊은 바다는 큰 놈이 아주 느리게.
      for (const s of shadows) {
        const p = f.p;
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (p.inside && d < 120) {
          const away = Math.atan2(s.y - p.y, s.x - p.x);
          s.hd += (((away - s.hd + Math.PI) % TAU) - Math.PI) * 0.15;
          s.spd = Math.min(90, s.spd + 60 * dt);
        } else s.spd += (30 - s.spd) * dt * 0.8;
        s.hd += Math.sin(t * 0.6 + s.ph) * 0.4 * dt;
        const mk = moveScale(s.y, h);
        s.x += Math.cos(s.hd) * s.spd * dt * mk;
        s.y += Math.sin(s.hd) * s.spd * dt * 0.5 * mk;
        if (s.x < -80) s.x = w + 60;
        if (s.x > w + 80) s.x = -60;
        s.y = clamp(s.y, top() + 30, h - 30);
      }
    },
    draw(g, f) {
      const t = f.t;
      // 하늘(라운드 5, world/sky.ts) — 계절 × 날씨 판 + 별·달·해(옛 자체 별 40개는 공용으로). 깊은 바다는 수평선이 없어 없다.
      {
        const sk = skyKey(season, f.weather.now, f.time.band, f.w, f.h);
        if (!skyC || sk !== skyKeyCur) {
          skyC = bakeSky(season, f.weather.now, f.time.band, f.w, f.h, seed);
          cloudC = bakeClouds(season, f.weather.now, f.time.band, f.w, f.h, seed);
          skyKeyCur = sk;
        }
        drawSky(g, skyC, cloudC, f.w, f.t, f.weather.now);
      }
      if (water) g.drawImage(water, 0, 0, f.w, f.h);
      if (horizon) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      drawSkyLive(g, f.w, f, seed, top() * 0.9, { moonY: top() * 0.38, sunY: top() * 0.8 });
      // 먼바다 = 파장 14~100m → 한 화면에 마루 여럿. 깊은 바다 = 225~624m → **큰 너울 한 번**.
      // (2026-09-04 조사. 옛 코드는 깊은 바다에 수면 문법을 아예 안 그려 두 화면이 '불투명도만 다른 같은 그림'이었다 —
      //  검토 라운드2 미관 #4.)
      drawWaves(g, t, f.w, {
        top: top(),
        bottom: f.h,
        bands: 7,
        speed: 0.05,
        // 너울·잔물결 진폭 × (1 + .5·바람) — GRAMMAR §3.2 "너울 ×1.4·흰 마루 ×1.6"(라운드 3 C#3: 바다의 바람이 점 34개뿐). 맑음(.08) ≈ 항등.
        amp: 15 * (1 + 0.5 * currentLight().wind),
        alpha: 0.2,
        foam: pal.foam
      });
      // 거품 선(잔물결) — 조금 빠르고 가늘게. 깊은 바다엔 없다(수면이 아니다).
      drawWaves(g, t * 1.6, f.w, { top: top(), bottom: f.h, bands: 9, speed: 0.07, amp: 5 * (1 + 0.5 * currentLight().wind), alpha: 0.1, foam: pal.foam });
      // 빛의 길(라운드 4 AMB-T1-03) — 노을 반사 띠·밤 달빛 띠. 깊은 바다는 수평선이 없어 위에서부터, 조금 넓게. 점심 0.
      drawWaterLight(g, t, f.w, top() + 4, f.h, currentLight());
      // 빗방울 고리(라운드 14) — 수평선 아래에만.
      if (rings.length) {
        g.save();
        g.beginPath();
        g.rect(0, top() + 8, f.w, f.h - top() - 8);
        g.clip();
        drawRainRings(g, rings, GROUND_SQUASH);
        g.restore();
      }
      // 너울의 명암 — 파장 100~200m짜리 완만한 기복. 선이 아니라 **넓은 면**이라야 물이 덩어리로 읽힌다
      // (검토 라운드2: 바다 4장이 "빈 판").
      {
        const bands = 4;
        for (let i = 0; i < bands; i++) {
          const ph = i * 2.1 + t * 0.028;
          const y0 = top() + ((i + 0.5) / bands) * (f.h - top());
          const amp = (f.h - top()) * 0.061;
          g.fillStyle = "rgb(42 74 104 / 0.05)";
          g.beginPath();
          for (let x = -10; x <= f.w + 10; x += 20) {
            const y = y0 + Math.sin(x * 0.0022 + ph) * amp + Math.sin(x * 0.0051 + ph * 1.4) * amp * 0.4;
            if (x === -10) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          for (let x = f.w + 10; x >= -10; x -= 20) {
            const y = y0 + 44 + Math.sin(x * 0.0022 + ph) * amp + Math.sin(x * 0.0051 + ph * 1.4) * amp * 0.4;
            g.lineTo(x, y);
          }
          g.closePath();
          g.fill();
        }
      }
      // 계절 신호 — 넷이 같은 청회색 판이면 계절이 안 읽힌다(검토 라운드2 미관 #4). 표면에 계절의 표류물을 띄운다.
      {
        const drift = Math.round(lerp(6, 20, f.load));
        for (let i = 0; i < drift; i++) {
          const ph = i * 2.399;
          const u = (ph * 0.137 + t * (0.004 + 0.002 * (i % 3))) % 1;
          const v = (ph * 0.0731 + t * 0.006 + i * 0.041) % 1;
          const y = top() + 24 + v * (f.h - top() - 30);
          const x = ((u * 1.6 - 0.3) * f.w + Math.sin(t * 0.5 + ph) * 12 + f.w) % f.w;
          const k = 0.5 + 0.9 * ((y - top()) / Math.max(1, f.h - top()));
          g.save();
          g.translate(x, y);
          g.scale(1, GROUND_SQUASH);
          g.rotate(ph);
          if (season === "autumn") {
            // 원양에 낙엽은 뜨지 않는다(사이클5 현실성 #10) — 떠다니는 **해조 조각**(모자반 뭉치)으로.
            g.fillStyle = `rgb(96 92 62 / ${0.26 + 0.16 * k})`;
            for (let q = 0; q < 3; q++) {
              g.beginPath();
              g.ellipse((q - 1) * 4 * k, (q % 2) * 2 * k, 3.4 * k, 1.6 * k, q * 0.7, 0, TAU);
              g.fill();
            }
          } else if (season === "winter") {
            // 성에 조각 — 각진 흰 판.
            g.fillStyle = `rgb(240 248 255 / ${0.4 + 0.24 * k})`;
            g.beginPath();
            g.moveTo(-6 * k, -2 * k);
            g.lineTo(3 * k, -4 * k);
            g.lineTo(7 * k, 1 * k);
            g.lineTo(-2 * k, 4 * k);
            g.closePath();
            g.fill();
          } else if (season === "spring") {
            // 꽃가루·거품 띠 — 가늘고 긴 크림색 선.
            g.strokeStyle = `rgb(238 236 214 / ${0.2 + 0.16 * k})`;
            g.lineWidth = 1.6 * k;
            g.beginPath();
            g.moveTo(-14 * k, 0);
            g.quadraticCurveTo(0, -3 * k, 14 * k, 0);
            g.stroke();
          } else {
            // 여름 — 잔거품 알갱이.
            g.fillStyle = `rgb(255 255 255 / ${0.22 + 0.2 * k})`;
            g.beginPath();
            g.arc(0, 0, 1.6 * k, 0, TAU);
            g.fill();
          }
          g.restore();
        }
      }
      // (깊은 바다엔 수면 문법을 그리지 않는다 — 물속인데 파도가 가로지르면 카메라가 둘이다.)
      // 물고기 떼 그림자 — 실루엣을 눌러서(3/4 시점) 찍는다. 멀수록 작고 옅게.
      if (!fishAsked) {
        fishAsked = true;
        const tint = "rgb(28 58 88)";
        void loadSprite(ASSET.fishShadowSlim, FISH_SPR, FISH_SPR, 2, tint).then((sp) => (fishSpr[0] = sp)).catch(() => {});
        void loadSprite(ASSET.fishShadowFantail, FISH_SPR, FISH_SPR, 2, tint).then((sp) => (fishSpr[1] = sp)).catch(() => {});
      }
      ySort(shadows);
      for (let i = 0; i < shadows.length; i++) {
        const s = shadows[i];
        const near = (s.y - top()) / Math.max(1, f.h - top());
        // 원근 축척을 세게(0.45 → 0.3): 크기 등급의 무작위가 원근을 덮어 "바다면이 수직 벽지"로 읽혔다
        // (사이클4 현실성 #3).
        const k = s.k * (0.3 + 0.7 * near);
        // 부채꼬리 실루엣은 작게 그리면 지느러미가 별 모양으로 깨진다 — 큰 놈에만.
        // 부채꼬리는 **그려지는 크기**가 40px 넘을 때만(작게 그리면 지느러미가 별 모양으로 깨진다).
        // 큰 놈은 몸통 축이 뚜렷한 slim 실루엣으로 — fantail은 크게 그리면 방사형 덩어리(불가사리)로 읽힌다
        // (검토 라운드2 사이클3 현실성 #11). fantail은 중간 크기에만.
        const px2 = 46 * k;
        const spr = px2 >= SIZE.fishBig * 0.9 ? fishSpr[0] : px2 >= SIZE.fishMid ? fishSpr[1] || fishSpr[0] : fishSpr[0];
        const a = 0.16 + 0.24 * near;
        g.save();
        g.translate(s.x, s.y);
        g.scale(1, GROUND_SQUASH);
        g.rotate(s.hd + Math.PI); // 실루엣의 머리 = 왼쪽(−x)
        g.globalAlpha *= a;
        if (spr) {
          const size = (46 * k) / FISH_SPR;
          g.scale(size, size);
          g.drawImage(spr.c, -FISH_SPR / 2, -FISH_SPR / 2, FISH_SPR, FISH_SPR);
        } else {
          g.fillStyle = "rgb(28 58 88)";
          g.beginPath();
          g.ellipse(0, 0, 24 * k, 11 * k, 0, 0, TAU);
          g.fill();
        }
        g.restore();
      }
      drawTrail(g, trail, t, GROUND_SQUASH, pal.foam);
      drawGlints(g, t, glints);
      // 큰 그림자 하나 — 화면을 가로지르는 거대한 무언가(깊은 바다의 크기를 말하는 유일한 장치).
      // 깊은 바다의 어둠 — 위는 옅고 아래로 갈수록 확실히 어둡다. 값 폭이 좁으면 먼바다와 구분되지 않는다
      // (검토 라운드2 사이클3 미관 #6).
      // 발광 해파리 — 크기·깊이가 제각각이라야 깊이가 읽힌다(전부 지름 40px면 종이에 찍은 점). 갓 아래로
      // 촉수가 늘어져 "무엇인지" 알아볼 수 있게 한다.
    },
    debug() {
      return { biomeKind: "sea", glints: glints.length, shadows: shadows.length, season, rings: rings.length, rainRings };
    }
  };
}
