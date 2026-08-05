import { describe, expect, it } from "vitest";
import { applyErase, eraseStroke, imageHit, pointErased } from "@/lib/broadcast/erase";
import type { Stroke } from "@/lib/broadcast/stroke-engine";

// 2026-08-05 사용자 지적: "지운 게 왜 선택되냐 — 지운 건 아예 없는 걸로 해야지."
// 예전 지우개는 캔버스에만 destination-out으로 칠해서, 장면 배열에는 획이 그대로 남았다.
// 러버밴드가 안 보이는 획을 잡았고, 옮기면 지운 부분이 되살아났다. 이제 기하를 덜어낸다.

const pen = (pts: Array<[number, number]>, over: Partial<Stroke> = {}): Stroke => ({
  tool: "pen",
  layer: "L1",
  color: "#000000",
  width: 4,
  points: pts.map(([x, y]) => ({ x, y })),
  ...over
});
const eraser = { points: [{ x: 50, y: 0 }, { x: 50, y: 100 }], width: 10 };

describe("pointErased", () => {
  it("지우개 자국 안이면 지워진다", () => {
    expect(pointErased({ x: 50, y: 50 }, eraser)).toBe(true);
    expect(pointErased({ x: 54, y: 50 }, eraser)).toBe(true); // 반지름 5
  });
  it("자국 밖은 남는다", () => {
    expect(pointErased({ x: 70, y: 50 }, eraser)).toBe(false);
    expect(pointErased({ x: 50, y: 200 }, eraser)).toBe(false);
  });
  it("점 하나짜리 지우개(탭)는 원으로 판정", () => {
    const dot = { points: [{ x: 10, y: 10 }], width: 20 };
    expect(pointErased({ x: 15, y: 10 }, dot)).toBe(true);
    expect(pointErased({ x: 30, y: 10 }, dot)).toBe(false);
  });
});

describe("eraseStroke — 남은 구간으로 쪼갠다", () => {
  it("가운데를 지우면 두 조각", () => {
    const s = pen([
      [0, 50],
      [20, 50],
      [50, 50],
      [80, 50],
      [100, 50]
    ]);
    const out = eraseStroke(s, eraser);
    expect(out).toHaveLength(2);
    expect(out[0].points.map((p) => p.x)).toEqual([0, 20]);
    expect(out[1].points.map((p) => p.x)).toEqual([80, 100]);
  });

  it("전부 지워지면 아무것도 안 남는다 — '보이지 않는 획'을 남기지 않는다", () => {
    expect(eraseStroke(pen([[50, 10], [50, 40]]), eraser)).toEqual([]);
  });

  it("점 하나만 남는 조각은 버린다(또 다른 유령 방지)", () => {
    // 0번 점만 자국 밖 → 한 점짜리 조각
    const out = eraseStroke(pen([[0, 50], [48, 50], [50, 50]]), eraser);
    expect(out).toEqual([]);
  });

  it("안 닿으면 원본 그대로(참조까지 동일 — 불필요한 재생 방지)", () => {
    const s = pen([[0, 0], [10, 0]]);
    const out = eraseStroke(s, eraser);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(s);
  });

  it("도형은 윤곽에 닿으면 통째로 지운다(반쪽 유령 금지)", () => {
    const rect = pen(
      [
        [0, 0],
        [100, 100]
      ],
      { tool: "rect" }
    );
    expect(eraseStroke(rect, eraser)).toEqual([]); // 윗변(y=0)이 x=50에서 자국과 만난다
    const far = pen(
      [
        [200, 200],
        [300, 300]
      ],
      { tool: "rect" }
    );
    expect(eraseStroke(far, eraser)).toHaveLength(1);
  });
});

describe("imageHit — 비트맵은 패널이 픽셀에 구워 넣는다", () => {
  it("사각형과 겹치면 표시된다", () => {
    const img = pen([[40, 40], [80, 80]], { tool: "image", src: "data:," });
    expect(imageHit(img, eraser)).toBe(true);
  });
  it("안 겹치면 아니다", () => {
    const img = pen([[200, 200], [240, 240]], { tool: "image", src: "data:," });
    expect(imageHit(img, eraser)).toBe(false);
  });
});

describe("applyErase — 활성 레이어만, 바뀐 게 있을 때만", () => {
  it("다른 레이어는 손대지 않는다(그림판 문법)", () => {
    const other = pen([[50, 10], [50, 40]], { layer: "L2" });
    const mine = pen([[50, 10], [50, 40]]);
    const { next } = applyErase([other, mine], eraser, "L1");
    expect(next).toEqual([other]);
  });

  it("아무것도 안 지웠으면 changed=false — 히스토리를 더럽히지 않는다", () => {
    const far = pen([[0, 0], [10, 0]]);
    const r = applyErase([far], eraser, "L1");
    expect(r.changed).toBe(false);
    expect(r.next).toEqual([far]);
  });

  it("그림은 배열에 남기고 '구워야 할 목록'으로 알려준다", () => {
    const img = pen([[40, 40], [80, 80]], { tool: "image", src: "data:," });
    const r = applyErase([img], eraser, "L1");
    expect(r.images).toEqual([img]);
    expect(r.next).toEqual([img]);
    expect(r.changed).toBe(true);
  });

  it("쪼개진 조각이 원래 자리(순서)에 들어간다 — z순서가 안 흔들린다", () => {
    const under = pen([[0, 0], [10, 0]]);
    const cut = pen([
      [0, 50],
      [20, 50],
      [50, 50],
      [80, 50],
      [100, 50]
    ]);
    const over = pen([[0, 90], [10, 90]]);
    const { next } = applyErase([under, cut, over], eraser, "L1");
    expect(next[0]).toBe(under);
    expect(next[next.length - 1]).toBe(over);
    expect(next).toHaveLength(4); // under + 조각 2 + over
  });
});
