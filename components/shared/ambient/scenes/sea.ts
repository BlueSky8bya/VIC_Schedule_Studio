// 바다(2026-09-04, PLAN-004 §3.6) — 먼바다(open)와 깊은 바다(deep). 뭍이 없다(소유자 ⓪). 3/4 시점: 위 12%는 수평선 + 하늘 한 줄, 그 아래로
// 너울과 거품 선이 관찰자 쪽으로 내려온다. 먼바다 = 큰 너울 2겹·햇빛 반짝임·물고기 떼 그림자(얇은 판)·여름엔 튜브가 떠내려온다(P2).
// 깊은 바다 = "조용한 방": 진남색·느린 물·거품 거의 없음·밤 띠에 별·발광 해파리(P2). 생물은 P2(에이전트)에서 온다.
// 규칙: 바탕 한 번 굽기, 매 프레임 stroke 몇 줄, 필터 없음, 어두운 얼룩 금지(깊은 바다는 팔레트 자체가 어둡되 얼룩이 아니다).

import type { Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { SIZE } from "../world/scale";
import { GROUND_SQUASH, bakeHorizon, horizonY, moveScale, ySort } from "../world/view";
import { ASSET, loadSprite, type Sprite } from "../assets";
import { bakeWater, drawGlints, drawTrail, drawWaves, newTrail, stepTrail, waterPalette } from "./water";

type Shadow = { x: number; y: number; hd: number; spd: number; k: number; ph: number };

export function createSea(seed: number, opts: { season: SeasonKey; deep: boolean }): Scene {
  const rand = rng(seed);
  const { season, deep } = opts;
  let w = 0;
  let h = 0;
  let water: HTMLCanvasElement | null = null;
  let sky: HTMLCanvasElement | null = null;
  let horizon: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const glints: { x: number; y: number; ph: number; r: number }[] = [];
  const shadows: Shadow[] = [];
  let stars: { x: number; y: number; r: number; ph: number }[] = [];
  const trail = newTrail();
  // 물고기 = **물 밑 실루엣**(연못과 같은 PD top-view 도안). 옛 코드의 타원 두 개는 "얼룩"으로 읽혔다(검토 2차).
  const FISH_SPR = 80;
  const fishSpr: (Sprite | null)[] = [null, null];
  let fishAsked = false;

  const top = () => horizonY(h);
  const pal = waterPalette(season, deep);

  function bake(dpr: number) {
    // 바다는 바닥이 안 보인다 — caustic 없음(얕은 물 문법을 그대로 쓰면 "물 위의 낙서"가 된다).
    // 깊은 바다는 **물속**이라 위쪽에도 물이 차 있어야 한다(top=0). 옛 코드는 수평선 위가 비어 페이지 크림색이 비쳤다.
    const skyLo = deep ? undefined : "#eef5fa";
    water = bakeWater(w, h, deep ? 0 : top(), dpr, pal, seed, false, skyLo);
    // 하늘 한 줄 — 수평선 위 12%: 옅은 하늘빛(밤·노을 톤은 엔진 tint가 얹는다). 깊은 바다는 더 어둑한 하늘.
    const { c, g } = (() => {
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.ceil(w * dpr));
      cv.height = Math.max(1, Math.ceil(top() * dpr) + 2);
      const ctx = cv.getContext("2d")!;
      ctx.scale(dpr, dpr);
      return { c: cv, g: ctx };
    })();
    const grad = g.createLinearGradient(0, 0, 0, top());
    grad.addColorStop(0, deep ? "#aebfcf" : "#dbe8f1");
    grad.addColorStop(1, deep ? "#c9d6e2" : "#eef5fa");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, top() + 2);
    sky = c;
    // 수평선 — 뭍 장면과 같은 지평선 띠(sea 프로파일: 안개만). 1.5px 흰 자를 대신한다.
    horizon = bakeHorizon(season, w, h, 1, "sea");
    stars = [];
    const r0 = rng(seed * 5 + 1);
    for (let i = 0; i < 40; i++) stars.push({ x: r0() * w, y: r0() * top() * 0.85, r: 0.6 + r0() * 1.1, ph: r0() * TAU });
    gw = w;
    gh = h;
    gdpr = dpr;
  }
  const glintTarget = (load: number) => (deep ? 0 : Math.round(lerp(6, 26, load)));
  const shadowTarget = (load: number) => (deep ? Math.round(lerp(3, 8, load)) : Math.round(lerp(6, 20, load)));
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
    return { x, y, hd: rand() < 0.5 ? 0 : Math.PI, spd: deep ? 8 + rand() * 6 : 22 + rand() * 18, k: px / 46, ph: rand() * TAU };
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
      const gt = glintTarget(load);
      while (glints.length < gt) glints.push({ x: rand() * w, y: top() + 20 + rand() * (h - top() - 40), ph: rand() * TAU, r: 1.4 + rand() * 1.6 });
      if (glints.length > gt) glints.length = gt;
      const st = shadowTarget(load);
      while (shadows.length < st) shadows.push(newShadow());
      if (shadows.length > st) shadows.length = st;
      // 물고기 떼 그림자(얇은 판) — 천천히 가로지르며 포인터를 피한다. 깊은 바다는 큰 놈이 아주 느리게.
      for (const s of shadows) {
        const p = f.p;
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (p.inside && d < 120 && !deep) {
          const away = Math.atan2(s.y - p.y, s.x - p.x);
          s.hd += (((away - s.hd + Math.PI) % TAU) - Math.PI) * 0.15;
          s.spd = Math.min(90, s.spd + 60 * dt);
        } else s.spd += ((deep ? 10 : 30) - s.spd) * dt * 0.8;
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
      if (sky && !deep) g.drawImage(sky, 0, 0, f.w, sky.height / (gdpr || 1));
      if (f.time.night && stars.length) {
        for (const s of stars) {
          const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.1 + s.ph));
          g.fillStyle = `rgb(255 255 255 / ${a})`;
          g.beginPath();
          g.arc(s.x, s.y, s.r, 0, TAU);
          g.fill();
        }
      }
      if (water) g.drawImage(water, 0, 0, f.w, f.h);
      if (horizon && !deep) g.drawImage(horizon, 0, 0, f.w, horizon.height);
      // 먼바다 = 파장 14~100m → 한 화면에 마루 여럿. 깊은 바다 = 225~624m → **큰 너울 한 번**.
      // (2026-09-04 조사. 옛 코드는 깊은 바다에 수면 문법을 아예 안 그려 두 화면이 '불투명도만 다른 같은 그림'이었다 —
      //  검토 라운드2 미관 #4.)
      drawWaves(g, t, f.w, {
        top: deep ? 0 : top(),
        bottom: f.h,
        bands: deep ? 1 : 7,
        speed: deep ? 0.014 : 0.05,
        amp: deep ? 52 : 15,
        alpha: deep ? 0.07 : 0.2,
        foam: pal.foam
      });
      // 거품 선(잔물결) — 조금 빠르고 가늘게. 깊은 바다엔 없다(수면이 아니다).
      if (!deep) drawWaves(g, t * 1.6, f.w, { top: top(), bottom: f.h, bands: 9, speed: 0.07, amp: 5, alpha: 0.1, foam: pal.foam });
      // 너울의 명암 — 파장 100~200m짜리 완만한 기복. 선이 아니라 **넓은 면**이라야 물이 덩어리로 읽힌다
      // (검토 라운드2: 바다 4장이 "빈 판").
      {
        const bands = deep ? 2 : 4;
        for (let i = 0; i < bands; i++) {
          const ph = i * 2.1 + t * (deep ? 0.012 : 0.028);
          const y0 = top() + ((i + 0.5) / bands) * (f.h - top());
          const amp = deep ? 70 : 46;
          g.fillStyle = `rgb(${deep ? "10 26 44" : "42 74 104"} / ${deep ? 0.06 : 0.05})`;
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
      if (!deep) {
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
        const tint = deep ? "rgb(40 60 84)" : "rgb(28 58 88)";
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
        const a = deep ? 0.1 + 0.12 * near : 0.16 + 0.24 * near;
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
          g.fillStyle = deep ? "rgb(40 60 84)" : "rgb(28 58 88)";
          g.beginPath();
          g.ellipse(0, 0, 24 * k, 11 * k, 0, 0, TAU);
          g.fill();
        }
        g.restore();
      }
      drawTrail(g, trail, t, GROUND_SQUASH, pal.foam);
      drawGlints(g, t, glints);
      if (deep) {
        // 수면 빛줄기 — 위쪽 1/3에 비스듬히 내려오는 옅은 빛기둥 넷. "위가 수면"이라는 유일한 단서다.
        // 빛기둥은 좌우 모서리가 **없어야** 한다 — 수직 직선 경계는 "반투명 사각형"으로 읽힌다(사이클5 경계 #8).
        // 폭이 다른 세 겹을 겹쳐 가장자리를 흩고, 위·아래 모두 0으로 사라진다.
        // 빛줄기는 해가 있어야 생긴다(QA 라운드 2, BIOME_GRAMMAR 깊은 바다 "밤 빛줄기 0"): 밤 0 · 새벽/저녁 .4 · 흐림·비 .5.
        const shaftK =
          (f.time.band === "night" ? 0 : f.time.band === "dawn" || f.time.band === "evening" ? 0.4 : 1) *
          (f.weather.now === "cloud" || f.weather.now === "rain" ? 0.5 : 1);
        for (let i = 0; i < (shaftK > 0 ? 4 : 0); i++) {
          const x0 = f.w * (0.1 + 0.24 * i) + Math.sin(t * 0.16 + i) * 30;
          const wtop = 26 + 14 * Math.sin(t * 0.21 + i * 2);
          for (const [ww, aa] of [[2.2, 0.05], [1.4, 0.07], [0.7, 0.09]] as const) {
            const lg = g.createLinearGradient(0, 0, 0, f.h * 0.56);
            lg.addColorStop(0, `rgb(214 236 246 / 0)`);
            lg.addColorStop(0.16, `rgb(214 236 246 / ${aa * shaftK})`);
            lg.addColorStop(1, "rgb(214 236 246 / 0)");
            g.fillStyle = lg;
            g.beginPath();
            g.moveTo(x0 - (wtop * ww) / 2, -10);
            g.lineTo(x0 + (wtop * ww) / 2, -10);
            g.lineTo(x0 + wtop * ww * 1.5, f.h * 0.56);
            g.lineTo(x0 + wtop * ww * 0.4, f.h * 0.56);
            g.closePath();
            g.fill();
          }
        }
        // 바다눈 — 천천히 내려오는 흰 알갱이(깊은 바다의 유일한 질감).
        const nSnow = Math.round(lerp(120, 360, f.load));
        const rs = rng(seed * 3 + 7);
        for (let i = 0; i < nSnow; i++) {
          const sx = rs() * f.w;
          const sp = 6 + rs() * 14;
          const sy2 = top() + ((rs() * (f.h - top()) + t * sp) % (f.h - top()));
          g.fillStyle = `rgb(226 238 244 / ${0.1 + rs() * 0.14})`;
          g.fillRect(sx, sy2, 1.4, 1.4);
        }
      }
      // 큰 그림자 하나 — 화면을 가로지르는 거대한 무언가(깊은 바다의 크기를 말하는 유일한 장치).
      if (deep) {
        const gx = ((t * 7) % (f.w + 1800)) - 900;
        const gy2 = top() + (f.h - top()) * 0.62;
        g.save();
        g.globalAlpha = 0.14;
        g.fillStyle = "rgb(6 16 30)";
        g.beginPath();
        g.ellipse(gx, gy2, 300, 46, 0.06, 0, TAU);
        g.fill();
        g.beginPath();
        g.moveTo(gx - 300, gy2);
        g.lineTo(gx - 400, gy2 - 44);
        g.lineTo(gx - 392, gy2 + 40);
        g.closePath();
        g.fill();
        g.restore();
      }
      // 깊은 바다의 어둠 — 위는 옅고 아래로 갈수록 확실히 어둡다. 값 폭이 좁으면 먼바다와 구분되지 않는다
      // (검토 라운드2 사이클3 미관 #6).
      if (deep) {
        const dg = g.createLinearGradient(0, top(), 0, f.h);
        dg.addColorStop(0, "rgb(8 20 38 / 0)");
        dg.addColorStop(0.45, "rgb(8 20 38 / 0.18)");
        dg.addColorStop(1, "rgb(6 14 28 / 0.46)");
        g.fillStyle = dg;
        g.fillRect(0, top(), f.w, f.h - top());
      }
      // 발광 해파리 — 크기·깊이가 제각각이라야 깊이가 읽힌다(전부 지름 40px면 종이에 찍은 점). 갓 아래로
      // 촉수가 늘어져 "무엇인지" 알아볼 수 있게 한다.
      if (deep && f.load >= 0.1) {
        for (let i = 0; i < 7; i++) {
          const dv = (i * 0.37) % 1;
          const x = f.w * (0.08 + 0.13 * i + 0.05 * Math.sin(i * 2.3)) + Math.sin(t * 0.3 + i) * 30;
          const y = top() + (f.h - top()) * (0.2 + 0.62 * dv + 0.08 * Math.sin(t * 0.2 + i * 2));
          const near = 0.45 + 0.85 * dv; // 아래(가까움)일수록 크다
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.9);
          const R = (10 + 22 * near) * (0.9 + 0.14 * pulse);
          const a = (0.14 + 0.16 * pulse) * (0.6 + 0.5 * near);
          // 촉수 — 갓 아래로 흔들리며 늘어진다.
          g.strokeStyle = `rgb(150 220 210 / ${a * 0.7})`;
          g.lineWidth = Math.max(0.8, R * 0.07);
          for (let q = -2; q <= 2; q++) {
            g.beginPath();
            g.moveTo(x + q * R * 0.22, y + R * 0.2);
            g.quadraticCurveTo(
              x + q * R * 0.28 + Math.sin(t * 1.1 + q + i) * R * 0.2,
              y + R * 1.0,
              x + q * R * 0.2 + Math.sin(t * 0.8 + q * 1.7 + i) * R * 0.34,
              y + R * 1.9
            );
            g.stroke();
          }
          // 갓 — 위가 둥근 종.
          softBlob(g, x, y, R, "150 220 210", a, 0);
          g.fillStyle = `rgb(196 240 232 / ${a * 1.2})`;
          g.beginPath();
          g.ellipse(x, y, R * 0.6, R * 0.42, 0, Math.PI, TAU);
          g.fill();
        }
      }
    },
    debug() {
      return { biomeKind: deep ? "deep" : "sea", glints: glints.length, shadows: shadows.length, season };
    }
  };
}
