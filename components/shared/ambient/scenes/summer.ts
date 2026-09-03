// 여름 — 물결(.gs-tide, CSS/SVG caustic) 위에 얹는 **마우스 항적** 캔버스. 2026-09-04 사용자: "송사리 튀는 것 같다 —
// 제트스키처럼 묵직하고 중엄하게". 조각(입자) 대신 **포인터가 지나간 길**을 기억해 항적을 통째로 그린다:
//  · 켈빈 항적의 두 팔 — 길의 각 점에서 진행 직각으로 나이에 비례해 벌어진 점들을 이어 **긴 연속 선** 둘(반각 ≈19°).
//    바깥은 밝은 빛줄기, 안쪽은 물빛 그늘, 나이 들수록 넓고 옅게. 두 겹(글로우 + 심)으로 무게감.
//  · 두 팔 사이의 **가로 마루**(transverse wave) — 몇 점마다 뒤로 볼록한 곡선, 팔과 함께 옅어진다.
//  · 길 위의 **거품 자국**(wash) — 부드럽게 넓어지며 천천히 가라앉는 흰 띠.
//  느리게 움직이면 좁고 짧게, 빠르면 넓고 길게. 기억은 3.2초(가볍게 1.6초). 원형 잔물결은 **누를 때만**(묵직한 고리
//  셋, 2초). 캔버스는 투명 — 아래 caustic이 그대로 비친다.

import type { Scene } from "../scene-engine";
import { clamp, TAU } from "./util";

type Node = { x: number; y: number; t0: number; nx: number; ny: number; sf: number }; // n = 진행 직각 단위벡터
type Ring = { x: number; y: number; life: number; dur: number; maxR: number; a: number; w: number };

export function createSummer(seed: number): Scene {
  void seed; // 항적은 결정적(경로만) — 난수 불필요
  const path: Node[] = [];
  const rings: Ring[] = [];
  let lastX = -9999;
  let lastY = -9999;
  let spawned = 0;

  function ring(x: number, y: number, maxR: number, a: number, delay: number, dur: number, w: number) {
    rings.push({ x, y, life: -delay, dur, maxR, a, w });
  }

  return {
    resize() {
      /* 바탕 없음 */
    },
    step(f) {
      const { dt, p, t } = f;
      const lite = f.q < 2;
      const ttl = lite ? 1.6 : 3.2;
      if (p.inside && p.moved && p.speed > 40) {
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        if (moved > (lite ? 12 : 7)) {
          const sp = clamp(p.speed, 40, 2400);
          const dx = p.vx / (p.speed || 1);
          const dy = p.vy / (p.speed || 1);
          path.push({ x: p.x, y: p.y, t0: t, nx: -dy, ny: dx, sf: clamp((sp - 40) / 1400, 0.12, 1) });
          spawned++;
          lastX = p.x;
          lastY = p.y;
          if (path.length > (lite ? 160 : 360)) path.shift();
        }
      }
      while (path.length && t - path[0].t0 > ttl) path.shift();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt / r.dur;
        if (r.life >= 1) rings.splice(i, 1);
      }
    },
    draw(g, f) {
      const t = f.t;
      const lite = f.q < 2;
      const ttl = lite ? 1.6 : 3.2;
      g.lineCap = "round";
      g.lineJoin = "round";
      if (path.length > 1) {
        // 각 점의 벌어진 정도 d = (옆으로 퍼지는 속도 ≈ 0.34×진행속도 상당) × 나이. 나이 0.85승 — 처음 빠르게 벌어지고
        // 뒤로 갈수록 느려진다(에너지가 흩어짐).
        const armPt = (n: Node, s: number, age: number): [number, number] => {
          const d = (36 + 150 * n.sf) * Math.pow(age, 0.85) + 3;
          return [n.x + n.nx * s * d, n.y + n.ny * s * d];
        };
        // 거품 자국(길 위) — 넓어지며 가라앉는 흰 띠.
        if (!lite) {
          for (let i = 1; i < path.length; i++) {
            const n = path[i];
            const age = t - n.t0;
            const k = 1 - age / ttl;
            if (k <= 0) continue;
            const a = 0.3 * k * k * (0.4 + 0.6 * n.sf);
            const w = 6 + 24 * n.sf * Math.pow(age, 0.5);
            g.strokeStyle = `rgb(255 255 252 / ${a})`;
            g.lineWidth = w;
            g.beginPath();
            g.moveTo(path[i - 1].x, path[i - 1].y);
            g.lineTo(n.x, n.y);
            g.stroke();
          }
        }
        // 두 팔 — 글로우(물빛, 넓게) 뒤에 심(흰빛, 가늘게). 세그먼트마다 나이로 알파·굵기.
        for (const s of [-1, 1]) {
          for (const pass of lite ? [1] : [0, 1]) {
            for (let i = 1; i < path.length; i++) {
              const a0 = path[i - 1];
              const a1 = path[i];
              const age = t - a1.t0;
              const k = 1 - age / ttl;
              if (k <= 0) continue;
              const [x0, y0] = armPt(a0, s, t - a0.t0);
              const [x1, y1] = armPt(a1, s, age);
              const weight = 0.5 + 0.5 * a1.sf;
              if (pass === 0) {
                g.strokeStyle = `rgb(140 190 225 / ${0.34 * k * weight})`;
                g.lineWidth = 10 + 8 * (1 - k);
              } else {
                g.strokeStyle = `rgb(255 255 250 / ${(lite ? 0.45 : 0.78) * Math.pow(k, 1.1) * weight})`;
                g.lineWidth = 3.4 - 1.4 * (1 - k);
              }
              g.beginPath();
              g.moveTo(x0, y0);
              g.lineTo(x1, y1);
              g.stroke();
            }
          }
        }
        // 가로 마루 — 몇 점마다 두 팔 사이를 뒤로 볼록하게 잇는다(항적 안쪽의 층층 물결).
        if (!lite) {
          for (let i = 2; i < path.length; i += 5) {
            const n = path[i];
            const age = t - n.t0;
            const k = 1 - age / ttl;
            if (k <= 0.05) continue;
            const [lx, ly] = armPt(n, -1, age);
            const [rx, ry] = armPt(n, 1, age);
            const back = path[i - 2];
            const bx = back.x - n.x;
            const by = back.y - n.y;
            const bl = Math.hypot(bx, by) || 1;
            const bulge = (14 + 40 * n.sf) * Math.pow(age, 0.6);
            const cx = n.x + (bx / bl) * bulge;
            const cy = n.y + (by / bl) * bulge;
            g.strokeStyle = `rgb(255 255 250 / ${0.2 * k * (0.5 + 0.5 * n.sf)})`;
            g.lineWidth = 1.4;
            g.beginPath();
            g.moveTo(lx, ly);
            g.quadraticCurveTo(cx, cy, rx, ry);
            g.stroke();
          }
        }
      }
      for (const r of rings) {
        if (r.life < 0) continue;
        const e = 1 - Math.pow(1 - r.life, 2.4);
        const rad = 6 + r.maxR * e;
        const a = r.a * (1 - r.life);
        const lw = r.w * (1 - r.life * 0.6) + 0.8;
        g.lineWidth = lw * 2.2;
        g.strokeStyle = `rgb(140 190 225 / ${a * 0.35})`;
        g.beginPath();
        g.arc(r.x, r.y, rad, 0, TAU);
        g.stroke();
        g.lineWidth = lw;
        g.strokeStyle = `rgb(255 255 250 / ${a})`;
        g.beginPath();
        g.arc(r.x, r.y, rad, 0, TAU);
        g.stroke();
      }
    },
    pointerDown(f, onBackground) {
      // 누르면 묵직한 원형 잔물결 — 바탕이 아니어도(칸 위) 물은 튄다: 장난감이라 방해가 아니다.
      const { x, y } = f.p;
      if (f.q < 2) ring(x, y, 130, 0.5, 0, 1.8, 2.4);
      else {
        ring(x, y, 150, 0.7, 0, 2.0, 3.2);
        ring(x, y, 190, 0.5, 0.18, 2.3, 2.6);
        ring(x, y, 230, 0.32, 0.4, 2.6, 2);
      }
      return onBackground;
    },
    debug() {
      return { path: path.length, rings: rings.length, spawned };
    }
  };
}
