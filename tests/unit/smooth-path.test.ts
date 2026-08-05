import { describe, expect, it } from "vitest";
import { smoothPathSamples } from "@/lib/broadcast/stroke-engine";

// 지우개는 화면에 **중점 이차베지어 곡선**으로 그려진다. 그런데 장면에서 덜어낼 때는 원래 점을
// 잇는 직선으로 판정했다 — 방향이 꺾이는 곳에서 곡선과 현이 어긋나, 손을 떼는 순간 지운 자리가
// 각지거나 안쪽으로 더 파여 보였다(2026-08-06 사용자 지적).
// 이 함수는 '실제로 그려지는 곡선'을 점열로 뽑아, 판정과 렌더가 같은 기하를 보게 한다.

const pt = (x: number, y: number) => ({ x, y });

describe("smoothPathSamples", () => {
  it("점 2개 이하는 그대로(곡선이 아니다)", () => {
    expect(smoothPathSamples([pt(0, 0)])).toEqual([pt(0, 0)]);
    expect(smoothPathSamples([pt(0, 0), pt(10, 0)])).toEqual([pt(0, 0), pt(10, 0)]);
  });

  it("시작·끝은 원래 점 그대로", () => {
    const out = smoothPathSamples([pt(0, 0), pt(50, 0), pt(50, 50)]);
    expect(out[0]).toMatchObject({ x: 0, y: 0 });
    expect(out[out.length - 1]).toMatchObject({ x: 50, y: 50 });
  });

  it("첫 구간은 시작점 → 첫 중점(렌더와 같은 순서)", () => {
    const out = smoothPathSamples([pt(0, 0), pt(50, 0), pt(50, 50)]);
    expect(out[1]).toMatchObject({ x: 25, y: 0 });
  });

  it("꺾이는 점을 통과하지 않는다 — 곡선이 안쪽으로 지난다", () => {
    const corner = pt(50, 0);
    const out = smoothPathSamples([pt(0, 0), corner, pt(50, 50)]);
    const nearest = Math.min(...out.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)));
    // 이차베지어의 정점은 중점 25,0 → 50,25 사이를 지난다(모서리에서 약 8.8px 떨어짐).
    expect(nearest).toBeGreaterThan(4);
    // 그 자리는 대각선 안쪽이다(모서리 바깥으로 튀지 않는다).
    const apex = out.reduce((a, b) =>
      Math.hypot(a.x - corner.x, a.y - corner.y) < Math.hypot(b.x - corner.x, b.y - corner.y) ? a : b
    );
    expect(apex.x).toBeLessThan(corner.x);
    expect(apex.y).toBeGreaterThan(corner.y);
  });

  it("곡선 구간은 촘촘하다 — 이웃 표본 간격이 step 이하", () => {
    // 첫 구간(시작점→첫 중점)과 끝 구간(마지막 중점→끝점)은 렌더도 직선이라 나눌 필요가 없다.
    const out = smoothPathSamples([pt(0, 0), pt(80, 0), pt(80, 80), pt(0, 80)], 1.5);
    for (let i = 2; i < out.length - 1; i += 1) {
      expect(Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y)).toBeLessThanOrEqual(1.6);
    }
  });

  it("일직선은 그대로 일직선(없는 곡률을 만들지 않는다)", () => {
    const out = smoothPathSamples([pt(0, 0), pt(40, 0), pt(80, 0)]);
    expect(Math.max(...out.map((p) => Math.abs(p.y)))).toBeLessThan(1e-6);
  });

  it("원본을 건드리지 않는다", () => {
    const pts = [pt(0, 0), pt(50, 0), pt(50, 50)];
    smoothPathSamples(pts);
    expect(pts).toEqual([pt(0, 0), pt(50, 0), pt(50, 50)]);
  });
});
