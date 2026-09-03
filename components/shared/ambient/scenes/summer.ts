// 여름 — 물결(.gs-tide, CSS/SVG caustic) 위에 얹는 **마우스 항적** 캔버스(2026-09-04 사용자: "제트스키 지나갈 때
// 물결이 V자로 생기듯"). 포인터가 움직이면 그 자리에서 양옆으로 물살 조각이 떨어져 나가며 뒤로 V자(켈빈 항적)를
// 남기고, 지나간 길엔 하얀 거품 줄이 잠깐 남는다. 원형 잔물결은 **누를 때만**. 위에서 내려다본 얕은 물이라 조각은
// 진행 방향과 직각으로 퍼지는 짧은 빛 줄기(햇빛 반사)다. 캔버스는 투명 — 아래 caustic이 그대로 비친다.
// 가볍게(q≤1): 조각 절반·짧게·옅게, 거품 없음, 누를 때 고리 하나.

import type { Scene } from "../scene-engine";
import { clamp, rng, TAU } from "./util";

type Streak = { x: number; y: number; vx: number; vy: number; life: number; dur: number; len: number; a: number; foam: boolean };
type Ring = { x: number; y: number; life: number; dur: number; maxR: number; a: number };

export function createSummer(seed: number): Scene {
  const rand = rng(seed);
  const streaks: Streak[] = [];
  const rings: Ring[] = [];
  let lastX = -9999;
  let lastY = -9999;
  let spawned = 0;

  function ring(x: number, y: number, maxR: number, a: number, delay = 0, dur = 1.3) {
    rings.push({ x, y, life: -delay, dur, maxR, a });
  }

  return {
    resize() {
      /* 바탕 없음 */
    },
    step(f) {
      const { dt, p } = f;
      const lite = f.q < 2;
      const cap = lite ? 70 : 180;
      if (p.inside && p.moved && p.speed > 60) {
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        const gap = lite ? 22 : 11;
        if (moved > gap && streaks.length < cap) {
          const sp = clamp(p.speed, 60, 2400);
          const dx = p.vx / (p.speed || 1);
          const dy = p.vy / (p.speed || 1);
          // 켈빈 항적: 조각이 진행 방향과 직각으로 일정 속도로 퍼지면 배가 앞으로 가는 동안 뒤에 V자가 남는다.
          // 옆 속도 ≈ 0.35×진행 속도 → 반각 ≈ 19°(실제 항적 19.5°). 뒤로도 살짝 밀려 꼬리가 벌어진다.
          const side = Math.max(48, sp * 0.35);
          for (const s of [-1, 1]) {
            streaks.push({
              x: p.x,
              y: p.y,
              vx: -dy * s * side - dx * sp * 0.05,
              vy: dx * s * side - dy * sp * 0.05,
              life: 1,
              dur: lite ? 0.75 : 1.15 + rand() * 0.25,
              len: (lite ? 8 : 12) + sp * 0.012,
              a: (lite ? 0.32 : 0.55) + Math.min(0.25, sp / 4000),
              foam: false
            });
          }
          // 거품 줄(지나간 자리) — 제자리에서 옅어진다.
          if (!lite) streaks.push({ x: p.x, y: p.y, vx: dx * 6, vy: dy * 6, life: 1, dur: 0.9, len: 5 + sp * 0.006, a: 0.42, foam: true });
          spawned++;
          lastX = p.x;
          lastY = p.y;
        }
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.life -= dt / s.dur;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= Math.pow(0.35, dt); // 물살은 금세 잦아든다
        s.vy *= Math.pow(0.35, dt);
        if (s.life <= 0) streaks.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt / r.dur;
        if (r.life >= 1) rings.splice(i, 1);
      }
    },
    draw(g) {
      g.lineCap = "round";
      for (const s of streaks) {
        const a = s.a * Math.max(0, s.life);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const ux = s.vx / sp;
        const uy = s.vy / sp;
        const len = s.len * (0.6 + 0.4 * s.life);
        if (s.foam) {
          g.fillStyle = `rgb(255 255 252 / ${a})`;
          g.beginPath();
          g.arc(s.x, s.y, len * 0.5, 0, TAU);
          g.fill();
          continue;
        }
        // 바깥 흰 빛줄기 + 안쪽 물빛 그늘(굴절) — 조각은 퍼지는 방향으로 길다.
        g.lineWidth = 2.2;
        g.strokeStyle = `rgb(255 255 250 / ${a})`;
        g.beginPath();
        g.moveTo(s.x - ux * len * 0.5, s.y - uy * len * 0.5);
        g.lineTo(s.x + ux * len * 0.5, s.y + uy * len * 0.5);
        g.stroke();
        g.lineWidth = 3.4;
        g.strokeStyle = `rgb(150 195 225 / ${a * 0.35})`;
        g.beginPath();
        g.moveTo(s.x - ux * len * 0.4 - uy * 2, s.y - uy * len * 0.4 + ux * 2);
        g.lineTo(s.x + ux * len * 0.4 - uy * 2, s.y + uy * len * 0.4 + ux * 2);
        g.stroke();
      }
      for (const r of rings) {
        if (r.life < 0) continue;
        const e = 1 - Math.pow(1 - r.life, 2.2);
        const rad = 4 + r.maxR * e;
        const a = r.a * (1 - r.life);
        const lw = 2.4 * (1 - r.life * 0.7) + 0.6;
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
    },
    pointerDown(f, onBackground) {
      // 누르면 원형 잔물결 — 바탕이 아니어도(칸 위) 물은 튄다: 장난감이라 방해가 아니다.
      const { x, y } = f.p;
      if (f.q < 2) ring(x, y, 110, 0.5, 0, 1.3);
      else {
        ring(x, y, 120, 0.7, 0, 1.4);
        ring(x, y, 150, 0.5, 0.12, 1.6);
        ring(x, y, 175, 0.35, 0.26, 1.8);
      }
      return onBackground;
    },
    debug() {
      return { streaks: streaks.length, rings: rings.length, spawned };
    }
  };
}
