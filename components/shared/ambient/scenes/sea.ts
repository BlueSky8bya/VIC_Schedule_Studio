// 바다(2026-09-04, PLAN-004 §3.6) — 먼바다(open)와 깊은 바다(deep). 뭍이 없다(소유자 ⓪). 3/4 시점: 위 12%는 수평선 + 하늘 한 줄, 그 아래로
// 너울과 거품 선이 관찰자 쪽으로 내려온다. 먼바다 = 큰 너울 2겹·햇빛 반짝임·물고기 떼 그림자(얇은 판)·여름엔 튜브가 떠내려온다(P2).
// 깊은 바다 = "조용한 방": 진남색·느린 물·거품 거의 없음·밤 띠에 별·발광 해파리(P2). 생물은 P2(에이전트)에서 온다.
// 규칙: 바탕 한 번 굽기, 매 프레임 stroke 몇 줄, 필터 없음, 어두운 얼룩 금지(깊은 바다는 팔레트 자체가 어둡되 얼룩이 아니다).

import type { Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { horizonY, GROUND_SQUASH } from "../world/view";
import { bakeWater, drawGlints, drawWaves, waterPalette } from "./water";

type Shadow = { x: number; y: number; hd: number; spd: number; k: number; ph: number };

export function createSea(seed: number, opts: { season: SeasonKey; deep: boolean }): Scene {
  const rand = rng(seed);
  const { season, deep } = opts;
  let w = 0;
  let h = 0;
  let water: HTMLCanvasElement | null = null;
  let sky: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const glints: { x: number; y: number; ph: number; r: number }[] = [];
  const shadows: Shadow[] = [];
  let stars: { x: number; y: number; r: number; ph: number }[] = [];

  const top = () => horizonY(h);
  const pal = waterPalette(season, deep);

  function bake(dpr: number) {
    water = bakeWater(w, h, top(), dpr, pal, seed);
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
    // 수평선 — 아주 옅은 밝은 선(하늘과 물의 경계).
    g.fillStyle = "rgb(255 255 255 / 0.45)";
    g.fillRect(0, top() - 1, w, 1.5);
    sky = c;
    stars = [];
    const r0 = rng(seed * 5 + 1);
    for (let i = 0; i < 40; i++) stars.push({ x: r0() * w, y: r0() * top() * 0.85, r: 0.6 + r0() * 1.1, ph: r0() * TAU });
    gw = w;
    gh = h;
    gdpr = dpr;
  }
  const glintTarget = (load: number) => (deep ? 0 : Math.round(lerp(6, 26, load)));
  const shadowTarget = (load: number) => (deep ? Math.round(lerp(1, 4, load)) : Math.round(lerp(2, 9, load)));
  function newShadow(): Shadow {
    const y = top() + 40 + rand() * (h - top() - 80);
    return { x: rand() * w, y, hd: rand() < 0.5 ? 0 : Math.PI, spd: deep ? 8 + rand() * 6 : 22 + rand() * 18, k: deep ? 1.1 + rand() * 0.7 : 0.5 + rand() * 0.6, ph: rand() * TAU };
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!water || gw !== w || gh !== h || gdpr !== f.dpr) bake(f.dpr);
    },
    step(f) {
      const { dt, load, t } = f;
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
        s.x += Math.cos(s.hd) * s.spd * dt;
        s.y += Math.sin(s.hd) * s.spd * dt * 0.5;
        if (s.x < -80) s.x = w + 60;
        if (s.x > w + 80) s.x = -60;
        s.y = clamp(s.y, top() + 30, h - 30);
      }
    },
    draw(g, f) {
      const t = f.t;
      if (sky) g.drawImage(sky, 0, 0, f.w, sky.height / (gdpr || 1));
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
      // 너울(큰 것 2겹) — 옅은 밝은 띠가 천천히 내려온다.
      drawWaves(g, t, f.w, { top: top(), bottom: f.h, bands: deep ? 2 : 3, speed: deep ? 0.02 : 0.045, amp: deep ? 10 : 16, alpha: deep ? 0.12 : 0.22, foam: pal.foam });
      // 거품 선(잔물결) — 조금 빠르고 가늘게.
      if (!deep) drawWaves(g, t * 1.6, f.w, { top: top(), bottom: f.h, bands: 5, speed: 0.06, amp: 6, alpha: 0.16, foam: pal.foam });
      // 물고기 떼 그림자 — 눌린 타원(3/4 시점), 멀수록 작고 옅게.
      for (const s of shadows) {
        const near = (s.y - top()) / Math.max(1, f.h - top());
        const k = s.k * (0.6 + 0.4 * near);
        g.save();
        g.translate(s.x, s.y);
        g.scale(1, GROUND_SQUASH);
        g.rotate(s.hd);
        // 깊은 바다의 그림자는 아주 옅게(어두운 얼룩 금지 규칙) — 큰 놈이 "지나간 흔적" 정도로만.
        g.fillStyle = `rgb(${deep ? "40 60 84" : "28 58 88"} / ${deep ? 0.06 + 0.08 * near : 0.12 + 0.2 * near})`;
        g.beginPath();
        g.ellipse(0, 0, 22 * k, 7 * k, 0, 0, TAU);
        g.ellipse(-24 * k, 0, 8 * k, 5 * k, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      drawGlints(g, t, glints);
      // 깊은 바다 — 발광 해파리 세 개(P2에서 종으로 승격): 숨쉬듯 밝아지는 옅은 청록 얼룩.
      if (deep && f.load >= 0.3) {
        for (let i = 0; i < 3; i++) {
          const x = f.w * (0.2 + 0.3 * i) + Math.sin(t * 0.3 + i) * 30;
          const y = top() + (f.h - top()) * (0.45 + 0.15 * Math.sin(t * 0.2 + i * 2));
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
