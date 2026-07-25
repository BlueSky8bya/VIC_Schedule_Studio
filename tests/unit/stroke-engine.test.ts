import { describe, expect, it } from "vitest";

import {
  appendPoint,
  backingScale,
  createStrokeStore,
  DPR_CAP,
  drawStroke,
  MAX_BACKING_PIXELS,
  strokeAppliesTo,
  type Stroke
} from "@/lib/broadcast/stroke-engine";

function mkStroke(n: number, layer = "layer-1"): Stroke {
  return {
    tool: "pen",
    layer,
    color: "#111",
    width: 4,
    points: [{ x: n, y: n }]
  };
}

describe("stroke store — push/undo/redo", () => {
  it("push → undo → redo 왕복", () => {
    const s = createStrokeStore();
    s.push(mkStroke(1));
    s.push(mkStroke(2));
    expect(s.strokes()).toHaveLength(2);
    expect(s.undo()).toBe(true);
    expect(s.strokes()).toHaveLength(1);
    expect(s.redo()).toBe(true);
    expect(s.strokes()).toHaveLength(2);
  });

  it("새 stroke가 들어오면 redo 미래는 폐기된다", () => {
    const s = createStrokeStore();
    s.push(mkStroke(1));
    s.undo();
    s.push(mkStroke(2));
    expect(s.canRedo()).toBe(false);
  });

  it("undo 이력 상한: 오래된 stroke는 '장면에 남되' undo 불가로만 전환된다", () => {
    const s = createStrokeStore(3); // limit 3
    for (let i = 0; i < 5; i += 1) s.push(mkStroke(i));
    expect(s.strokes()).toHaveLength(5); // 화면에서 삭제 금지(G0-rr)
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(false); // floor 도달 — 처음 2개는 undo 불가
    expect(s.strokes()).toHaveLength(2);
  });

  it("undo floor 도달 → redo → 새 push 경계가 꼬이지 않는다", () => {
    const s = createStrokeStore(2);
    for (let i = 0; i < 4; i += 1) s.push(mkStroke(i)); // floor=2
    s.undo();
    s.undo();
    expect(s.canUndo()).toBe(false);
    expect(s.strokes()).toHaveLength(2);
    s.redo(); // 3개
    s.push(mkStroke(9)); // redo 미래 폐기 + 4개, floor 재계산(4-2=2)
    expect(s.canRedo()).toBe(false);
    expect(s.strokes()).toHaveLength(4);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(false); // floor=2 유지
  });

  it("재생 순서: pen → eraser → 나중 pen — 나중 stroke는 지워지지 않는다(전역 순서 보존)", () => {
    const s = createStrokeStore();
    const early = mkStroke(1);
    const eraser: Stroke = {
      tool: "eraser",
      layer: "layer-1",
      color: "#000",
      width: 20,
      points: [{ x: 1, y: 1 }]
    };
    const late = mkStroke(2);
    s.push(early);
    s.push(eraser);
    s.push(late);
    // 렌더는 strokes() 순서 그대로 재생 — eraser가 배열에서 late보다 앞이므로
    // destination-out은 early에만 영향을 주고 late는 위에 그려진다.
    const order = s.strokes().filter((st) => strokeAppliesTo(st, "layer-1"));
    expect(order).toEqual([early, eraser, late]);
    expect(order.indexOf(eraser)).toBeLessThan(order.indexOf(late));
  });

  it("clearAll·dispose는 전부 비운다", () => {
    const s = createStrokeStore();
    s.push(mkStroke(1));
    s.undo();
    s.clearAll();
    expect(s.strokes()).toHaveLength(0);
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
    s.push(mkStroke(2));
    s.dispose();
    expect(s.strokes()).toHaveLength(0);
  });
});

describe("point 단순화", () => {
  it("마지막 점에서 2px 미만 이동은 버린다", () => {
    const pts = [{ x: 0, y: 0 }];
    expect(appendPoint(pts, { x: 1, y: 0.5 })).toBe(false);
    expect(pts).toHaveLength(1);
    expect(appendPoint(pts, { x: 3, y: 0 })).toBe(true);
    expect(pts).toHaveLength(2);
  });
});

describe("backing scale — DPR cap + 총 픽셀 cap", () => {
  it("일반 화면: DPR 그대로(상한 2)", () => {
    expect(backingScale(1200, 700, 1)).toBe(1);
    expect(backingScale(1200, 700, 2)).toBe(2);
    expect(backingScale(1200, 700, 3)).toBe(DPR_CAP);
  });

  it("4K 전체화면 + DPR2: 총 픽셀 상한이 scale을 낮춘다", () => {
    const scale = backingScale(3840, 2000, 2);
    expect(scale).toBeLessThan(2);
    expect(3840 * scale * (2000 * scale)).toBeLessThanOrEqual(MAX_BACKING_PIXELS * 1.001);
    expect(scale).toBeGreaterThanOrEqual(1);
  });

  it("5K/8K급 초대형 보드: scale이 1 미만으로 내려가 픽셀 상한을 지킨다(G3b)", () => {
    for (const [w, h] of [
      [5120, 2880],
      [7680, 4320],
      [12000, 3000] // 날짜 컬럼이 아주 많은 가로 스크롤 보드
    ]) {
      const scale = backingScale(w, h, 2);
      expect(scale).toBeLessThan(1);
      expect(w * scale * (h * scale)).toBeLessThanOrEqual(MAX_BACKING_PIXELS * 1.001);
    }
  });
});

describe("레이어 적용·렌더", () => {
  it("stroke는 자기 레이어에만 적용된다(지우개 포함 — 활성 레이어 문법)", () => {
    const pen = mkStroke(1, "layer-1");
    const eraser: Stroke = { tool: "eraser", layer: "layer-2", color: "#000", width: 20, points: [{ x: 0, y: 0 }] };
    expect(strokeAppliesTo(pen, "layer-1")).toBe(true);
    expect(strokeAppliesTo(pen, "layer-2")).toBe(false);
    expect(strokeAppliesTo(eraser, "layer-2")).toBe(true);
    expect(strokeAppliesTo(eraser, "layer-1")).toBe(false);
  });

  it("removeLayer는 그 레이어의 획을 장면·redo에서 지우고 다른 레이어는 보존한다", () => {
    const s = createStrokeStore();
    s.push(mkStroke(1, "A"));
    s.push(mkStroke(2, "B"));
    s.push(mkStroke(3, "A"));
    s.undo(); // A(3) → redo 스택
    s.removeLayer("A");
    expect(s.strokes().map((st) => st.layer)).toEqual(["B"]);
    expect(s.canRedo()).toBe(false); // redo에 있던 A(3)도 제거
    expect(s.undo()).toBe(true); // B는 여전히 undo 가능
    expect(s.strokes()).toHaveLength(0);
  });

  it("drawStroke: eraser=destination-out, 형광펜=반투명, 종료 후 상태 복원", () => {
    const calls: string[] = [];
    const ctx = {
      lineCap: "",
      lineJoin: "",
      lineWidth: 0,
      strokeStyle: "",
      globalCompositeOperation: "source-over",
      globalAlpha: 1,
      opsDuringStroke: [] as Array<{ op: string; alpha: number }>,
      beginPath() {
        calls.push("begin");
      },
      moveTo() {
        calls.push("move");
      },
      lineTo() {
        calls.push("line");
      },
      quadraticCurveTo() {
        calls.push("quad");
      },
      stroke() {
        this.opsDuringStroke.push({ op: this.globalCompositeOperation, alpha: this.globalAlpha });
        calls.push("stroke");
      }
    };
    drawStroke(ctx, { tool: "eraser", layer: "layer-1", color: "#000", width: 20, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] });
    expect(ctx.opsDuringStroke[0].op).toBe("destination-out");
    drawStroke(ctx, { tool: "hl", layer: "layer-1", color: "#ff0", width: 14, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    expect(ctx.opsDuringStroke[1].op).toBe("source-over");
    expect(ctx.opsDuringStroke[1].alpha).toBeCloseTo(0.45);
    // 그리기 끝나면 합성 상태 복원
    expect(ctx.globalCompositeOperation).toBe("source-over");
    expect(ctx.globalAlpha).toBe(1);
    // 점 하나(탭)도 선으로 찍힌다
    drawStroke(ctx, mkStroke(5));
    expect(calls.filter((c) => c === "stroke")).toHaveLength(3);
  });

  it("펜 3점+: 중점 이차베지어 + 조각별 가변 굵기(필압 p 반영)", () => {
    const widths: number[] = [];
    const quads: number[] = [];
    const ctx = {
      lineCap: "",
      lineJoin: "",
      lineWidth: 0,
      strokeStyle: "",
      globalCompositeOperation: "source-over",
      globalAlpha: 1,
      beginPath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {
        quads.push(1);
      },
      stroke() {
        widths.push(this.lineWidth);
      }
    };
    drawStroke(ctx, {
      tool: "pen",
      layer: "layer-1",
      color: "#111",
      width: 10,
      points: [
        { x: 0, y: 0, p: 0.2 },
        { x: 10, y: 4, p: 0.6 },
        { x: 20, y: 0, p: 1 }
      ]
    });
    // 머리(line)+몸통(quad)+꼬리(line) = 3조각, 몸통만 곡선.
    expect(widths).toHaveLength(3);
    expect(quads).toHaveLength(1);
    // 필압이 굵기로 이어진다: p 0.2 < 0.6 < 1 → 조각 굵기도 단조 증가.
    expect(widths[0]).toBeLessThan(widths[1]);
    expect(widths[1]).toBeLessThan(widths[2]);
  });

  it("형광펜 3점+: 곡선 보간을 쓰되 stroke는 1번(반투명 겹침 진해짐 방지)", () => {
    let strokes = 0;
    let quads = 0;
    const ctx = {
      lineCap: "",
      lineJoin: "",
      lineWidth: 0,
      strokeStyle: "",
      globalCompositeOperation: "source-over",
      globalAlpha: 1,
      beginPath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {
        quads += 1;
      },
      stroke() {
        strokes += 1;
      }
    };
    drawStroke(ctx, {
      tool: "hl",
      layer: "layer-1",
      color: "#ff0",
      width: 14,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 4 },
        { x: 20, y: 0 },
        { x: 30, y: 4 }
      ]
    });
    expect(strokes).toBe(1);
    expect(quads).toBe(2); // 내부 점 2개가 컨트롤로
  });
});
