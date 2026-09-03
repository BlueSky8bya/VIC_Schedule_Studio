// 여름 — 물결(.gs-tide, CSS/SVG caustic) 위에 얹는 **마우스 물결** 캔버스(2026-09-04 사용자: "마우스 위치에 따라
// 물결이 일렁이는 이펙트"). 포인터가 움직이면 그 자리에서 잔물결 고리(밝은 테두리 + 안쪽 옅은 물빛)가 퍼져 나가고,
// 빠를수록 크고 자주, 누르면 큰 고리 셋이 연달아 퍼진다. 위에서 내려다본 얕은 물이라 고리는 완전한 원, 퍼질수록
// 얇고 옅어진다. 캔버스는 투명 — 아래 caustic이 그대로 비친다.

import type { Scene } from "../scene-engine";
import { clamp, rng, TAU } from "./util";

type Ring = { x: number; y: number; life: number; dur: number; maxR: number; w: number; a: number };

export function createSummer(seed: number): Scene {
  const rand = rng(seed);
  const rings: Ring[] = [];
  let lastX = -9999;
  let lastY = -9999;
  let lastSpawn = 0;
  let spawned = 0;

  function spawn(x: number, y: number, maxR: number, a: number, delay = 0, dur = 1.25) {
    rings.push({ x, y, life: -delay, dur, maxR, w: 2.4, a });
    spawned++;
  }

  return {
    resize() {
      /* 바탕 없음 */
    },
    step(f) {
      const { dt, p, t } = f;
      const cap = f.q >= 2 ? 40 : f.q === 1 ? 22 : 12;
      if (p.inside && p.moved) {
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        const gap = f.q >= 2 ? 0.075 : 0.14;
        if (moved > 14 && t - lastSpawn > gap && rings.length < cap) {
          const sp = clamp(p.speed, 0, 2200);
          spawn(p.x, p.y, 42 + sp * 0.035 + rand() * 12, 0.5 + sp / 2200 * 0.3, 0, 1.05 + rand() * 0.35);
          lastSpawn = t;
          lastX = p.x;
          lastY = p.y;
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt / r.dur;
        if (r.life >= 1) rings.splice(i, 1);
      }
    },
    draw(g, f) {
      for (const r of rings) {
        if (r.life < 0) continue;
        const e = 1 - Math.pow(1 - r.life, 2.2); // 처음 빠르게, 끝에 느리게
        const rad = 4 + r.maxR * e;
        const a = r.a * (1 - r.life);
        const lw = r.w * (1 - r.life * 0.7) + 0.6;
        // 바깥 밝은 테두리(햇빛 반사) + 안쪽 옅은 물빛(굴절 그늘)
        g.lineWidth = lw;
        g.strokeStyle = `rgb(255 255 250 / ${a})`;
        g.beginPath();
        g.arc(r.x, r.y, rad, 0, TAU);
        g.stroke();
        g.lineWidth = lw * 1.6;
        g.strokeStyle = `rgb(150 195 225 / ${a * 0.42})`;
        g.beginPath();
        g.arc(r.x, r.y, Math.max(1, rad - lw * 1.4), 0, TAU);
        g.stroke();
      }
      void f;
    },
    pointerDown(f, onBackground) {
      // 누르면 큰 고리 셋 — 바탕이 아니어도(칸 위) 물은 튄다: 장난감이라 방해가 아니다.
      const { x, y } = f.p;
      spawn(x, y, 120, 0.7, 0, 1.4);
      spawn(x, y, 150, 0.5, 0.12, 1.6);
      spawn(x, y, 175, 0.35, 0.26, 1.8);
      return onBackground;
    },
    debug() {
      return { rings: rings.length, spawned };
    }
  };
}
