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
  function newShadow(): Shadow {
    const y = top() + 40 + Math.pow(rand(), 0.6) * (h - top() - 80);
    // 크기는 축척표의 세 등급에서 고른다 — 전부 같은 크기면 바다에 깊이가 없다.
    const cls = rand();
    const px = deep ? (cls < 0.5 ? SIZE.fishMid : SIZE.fishBig) : cls < 0.55 ? SIZE.fishSmall : cls < 0.9 ? SIZE.fishMid : SIZE.fishBig;
    return { x: rand() * w, y, hd: rand() < 0.5 ? 0 : Math.PI, spd: deep ? 8 + rand() * 6 : 22 + rand() * 18, k: px / 46, ph: rand() * TAU };
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
      // 너울(큰 것 2겹) — 옅은 밝은 띠가 천천히 내려온다.
      if (!deep) drawWaves(g, t, f.w, { top: top(), bottom: f.h, bands: 3, speed: 0.045, amp: 16, alpha: 0.22, foam: pal.foam });
      // 거품 선(잔물결) — 조금 빠르고 가늘게.
      if (!deep) drawWaves(g, t * 1.6, f.w, { top: top(), bottom: f.h, bands: 9, speed: 0.07, amp: 5, alpha: 0.1, foam: pal.foam });
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
        const k = s.k * (0.45 + 0.55 * near);
        // 부채꼬리 실루엣은 작게 그리면 지느러미가 별 모양으로 깨진다 — 큰 놈에만.
        // 부채꼬리는 **그려지는 크기**가 40px 넘을 때만(작게 그리면 지느러미가 별 모양으로 깨진다).
        const spr = s.k * 46 >= SIZE.fishBig ? fishSpr[1] || fishSpr[0] : fishSpr[0];
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
      // 깊은 바다 — 발광 해파리 세 개(P2에서 종으로 승격): 숨쉬듯 밝아지는 옅은 청록 얼룩.
      if (deep && f.load >= 0.1) {
        for (let i = 0; i < 7; i++) {
          const x = f.w * (0.08 + 0.13 * i + 0.05 * Math.sin(i * 2.3)) + Math.sin(t * 0.3 + i) * 30;
          const y = top() + (f.h - top()) * (0.2 + 0.62 * ((i * 0.37) % 1) + 0.08 * Math.sin(t * 0.2 + i * 2));
          const a = 0.18 + 0.14 * Math.sin(t * 1.3 + i * 1.9);
          softBlob(g, x, y, 22 + 6 * Math.sin(t * 1.3 + i), "150 220 210", a, 0);
        }
      }
    },
    debug() {
      return { biomeKind: deep ? "deep" : "sea", glints: glints.length, shadows: shadows.length, season };
    }
  };
}
