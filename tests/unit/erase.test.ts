import { describe, expect, it } from "vitest";
import {
  applyErase,
  eraseStroke,
  eraseVerdict,
  imageHit,
  pointErased,
  refineNearEraser,
  shapeOutlines,
  REFINE_STEP
} from "@/lib/broadcast/erase";
import type { Stroke, StrokePoint } from "@/lib/broadcast/stroke-engine";

// 2026-08-05 ①: "지운 게 왜 선택되냐 — 지운 건 아예 없는 걸로 해야지."
//   예전 지우개는 캔버스에만 destination-out으로 칠해서 장면 배열에는 획이 그대로 남았다.
// 2026-08-05 ②: "내가 지운 부분 말고 주위까지 같이 지워진다."
//   획은 포인터가 움직인 만큼만 점을 남긴다(빠르면 20~60px 간격). 점 하나를 통째로 버리면
//   양옆 구간이 다 사라졌다. 이제 지우개 근처만 잘게 다시 샘플링해 **닿은 만큼만** 덜어낸다.
//   도형도 마찬가지 — 귀퉁이를 지웠다고 사각형이 통째로 사라지면 안 된다.

const pen = (pts: Array<[number, number]>, over: Partial<Stroke> = {}): Stroke => ({
  tool: "pen",
  layer: "L1",
  color: "#000000",
  width: 4,
  points: pts.map(([x, y]) => ({ x, y })),
  ...over
});
const eraser = { points: [{ x: 50, y: 0 }, { x: 50, y: 100 }], width: 10 };

/** 조각들에 남은 x 구간(정렬) — '얼마나 지워졌나'를 재는 데 쓴다. */
function spans(out: Stroke[]): Array<[number, number]> {
  return out
    .map((s) => {
      const xs = s.points.map((p) => p.x);
      return [Math.min(...xs), Math.max(...xs)] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
}

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

describe("refineNearEraser — 지우개 근처만 잘게(과잉 삭제 방지의 핵심)", () => {
  it("가까운 구간은 REFINE_STEP 이하 간격으로 잘게 나뉜다", () => {
    const out = refineNearEraser([{ x: 0, y: 50 }, { x: 100, y: 50 }], eraser, 2);
    for (let i = 1; i < out.length; i += 1) {
      expect(Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y)).toBeLessThanOrEqual(
        REFINE_STEP + 1e-9
      );
    }
  });
  it("먼 구간은 원래 점 그대로 — 긴 낙서가 점 수천 개로 붇지 않는다", () => {
    const pts: StrokePoint[] = [
      { x: 500, y: 500 },
      { x: 900, y: 500 },
      { x: 1200, y: 700 }
    ];
    expect(refineNearEraser(pts, eraser, 2)).toEqual(pts);
  });
  it("필압(p)도 함께 보간한다 — 잘린 자리에서 굵기가 튀지 않게", () => {
    const out = refineNearEraser([{ x: 0, y: 50, p: 0 }, { x: 100, y: 50, p: 1 }], eraser, 2);
    const mid = out.find((p) => Math.abs(p.x - 50) < REFINE_STEP)!;
    expect(mid.p).toBeGreaterThan(0.4);
    expect(mid.p).toBeLessThan(0.6);
  });
});

describe("eraseStroke — 닿은 만큼만 덜어낸다", () => {
  it("점이 드문 획(빠른 낙서)이어도 지우개 크기만큼만 사라진다", () => {
    // 기록된 점은 양 끝 2개뿐 — 예전 구현은 이 중 하나를 버려 100px 넘게 날렸다.
    const s = pen([
      [0, 50],
      [200, 50]
    ]);
    const out = eraseStroke(s, eraser);
    expect(out).toHaveLength(2);
    const [left, right] = spans(out);
    const gap = right[0] - left[1];
    // 지워지는 폭 = 지우개 지름(10) + 획 굵기(4) + 샘플 간격 여유.
    expect(gap).toBeGreaterThan(10);
    expect(gap).toBeLessThanOrEqual(10 + 4 + 2 * REFINE_STEP);
    expect(left[0]).toBe(0);
    expect(right[1]).toBe(200);
  });

  it("가운데를 지우면 두 조각(양 끝은 그대로 남는다)", () => {
    const out = eraseStroke(
      pen([
        [0, 50],
        [20, 50],
        [50, 50],
        [80, 50],
        [100, 50]
      ]),
      eraser
    );
    expect(out).toHaveLength(2);
    const [left, right] = spans(out);
    expect(left[0]).toBe(0);
    expect(right[1]).toBe(100);
    expect(right[0] - left[1]).toBeLessThanOrEqual(10 + 4 + 2 * REFINE_STEP);
  });

  it("전부 지워지면 아무것도 안 남는다 — '보이지 않는 획'을 남기지 않는다", () => {
    expect(eraseStroke(pen([[50, 10], [50, 40]]), eraser)).toEqual([]);
  });

  it("살아남은 점은 하나도 자국 안에 있지 않다", () => {
    const out = eraseStroke(
      pen([
        [0, 50],
        [200, 50]
      ]),
      eraser
    );
    for (const piece of out) {
      for (const p of piece.points) expect(pointErased(p, eraser, 2)).toBe(false);
    }
  });

  it("안 닿으면 원본 그대로(참조까지 동일 — 불필요한 재생 방지)", () => {
    const s = pen([[0, 0], [10, 0]]);
    const out = eraseStroke(s, eraser);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(s);
  });

  it("점 하나만 남는 조각은 버린다(또 다른 유령 방지)", () => {
    // 자국 바로 옆에서 시작해 자국으로 들어가는 아주 짧은 획 — 남는 건 점 하나뿐.
    const out = eraseStroke(pen([[42.6, 50], [50, 50]]), eraser);
    expect(out).toEqual([]);
  });
});

describe("도형은 닿은 만큼만 — 귀퉁이를 지웠다고 통째로 사라지지 않는다", () => {
  const rect = pen(
    [
      [0, 0],
      [100, 100]
    ],
    { tool: "rect", width: 4 }
  );

  it("사각형 윗변을 지나가면 나머지 변이 남는다", () => {
    const out = eraseStroke(rect, eraser); // 세로 자국이 윗변(y=0)·아랫변(y=100)을 지난다
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => s.tool === "poly")).toBe(true);
    expect(out.every((s) => s.width === rect.width && s.color === rect.color)).toBe(true);
    // 네 귀퉁이는 자국에서 멀다 — 전부 살아 있어야 한다.
    const alive = out.flatMap((s) => s.points);
    for (const corner of [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]) {
      expect(alive.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 1.6)).toBe(true);
    }
    // 지운 자리에는 아무 점도 없다.
    for (const p of alive) expect(pointErased(p, eraser, rect.width / 2)).toBe(false);
  });

  it("닫힌 윤곽은 한 곳만 지우면 조각도 하나다(시작점에서 괜히 갈라지지 않는다)", () => {
    const tap = { points: [{ x: 50, y: 0 }], width: 12 }; // 윗변 한가운데만 톡
    const out = eraseStroke(rect, tap);
    expect(out).toHaveLength(1);
  });

  it("도형에 안 닿으면 원본 그대로(참조 동일)", () => {
    const far = pen([[200, 200], [300, 300]], { tool: "rect" });
    const out = eraseStroke(far, eraser);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(far);
  });

  it("원도 닿은 호만 사라진다", () => {
    const circle = pen([[0, 0], [100, 100]], { tool: "ellipse", width: 4 });
    const out = eraseStroke(circle, { points: [{ x: 100, y: 50 }], width: 20 });
    expect(out.length).toBeGreaterThan(0);
    const alive = out.flatMap((s) => s.points);
    expect(alive.some((p) => p.x < 5)).toBe(true); // 반대쪽(왼쪽 끝)은 남는다
  });

  it("화살촉도 기하다 — 촉만 지워도 몸통은 남고, 촉을 안 지우면 촉이 살아 있다", () => {
    const arrow = pen([[0, 50], [100, 50]], { tool: "arrow", width: 4 });
    const heads = shapeOutlines(arrow);
    expect(heads).toHaveLength(3); // 몸통 + 날개 2
    const out = eraseStroke(arrow, { points: [{ x: 100, y: 50 }], width: 24 });
    expect(out.length).toBeGreaterThan(0);
    const alive = out.flatMap((s) => s.points);
    expect(alive.some((p) => p.x < 20)).toBe(true); // 몸통 시작은 남는다
    expect(alive.every((p) => p.x < 95)).toBe(true); // 끝(촉 부근)은 사라졌다
  });

  it("직선은 닿은 구간만 끊긴다", () => {
    const line = pen([[0, 50], [200, 50]], { tool: "line", width: 4 });
    const out = eraseStroke(line, eraser);
    expect(out).toHaveLength(2);
    const [left, right] = spans(out);
    expect(right[0] - left[1]).toBeLessThanOrEqual(10 + 4 + 2 * REFINE_STEP + 2);
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
  it("양 끝이 밖이어도 가로지르면 잡는다", () => {
    const img = pen([[40, 40], [80, 80]], { tool: "image", src: "data:," });
    const across = { points: [{ x: 0, y: 60 }, { x: 200, y: 60 }], width: 4 };
    expect(imageHit(img, across)).toBe(true);
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

  it("픽셀 판정이 '안 닿았다'고 하면 그림은 건드리지 않는다(투명한 여백을 스친 경우)", () => {
    // 채우기 조각의 상자는 화면 절반만 하다 — 상자만 보면 여백을 스쳐도 다시 인코딩하고
    // 되돌리기 기록이 생겼다(화면은 그대로인데).
    const img = pen([[0, 0], [400, 400]], { tool: "image", src: "data:," });
    const r = applyErase([img], eraser, "L1", () => false);
    expect(r.images).toEqual([]);
    expect(r.changed).toBe(false);
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

describe("eraseVerdict — 벡터로 자를지, 픽셀로 깎을지", () => {
  // 2026-08-06 사용자 지적: "내가 의도한 대로 못 지운다 — 후처리로 정리되는 것 같다."
  // 벡터로 자르면 획이 '굵기 단위'로 끊긴다. 지우개 원이 획 폭을 통째로 덮은 적이 있을 때만
  // 자르고(그때는 픽셀과 결과가 같다), 스치기만 했으면 픽셀 그대로 깎는다.
  it("가로질러 지나가면 벡터로 자른다(선명함 유지)", () => {
    expect(eraseVerdict(pen([[0, 50], [200, 50]]), eraser)).toBe("cut");
  });

  it("가장자리를 나란히 스치면 픽셀로 깎는다", () => {
    // 굵은 획(20) 옆을 지우개(10)가 평행하게 지나간다 — 폭을 덮은 적이 없다.
    const thick = pen([[0, 50], [200, 50]], { width: 20 });
    const along = { points: [{ x: 0, y: 62 }, { x: 200, y: 62 }], width: 10 };
    expect(eraseVerdict(thick, along)).toBe("raster");
  });

  it("지우개가 획보다 가늘면 언제나 픽셀 — 구멍을 뚫을 수 있어야 한다", () => {
    const fat = pen([[0, 50], [200, 50]], { width: 40 });
    expect(eraseVerdict(fat, { points: [{ x: 100, y: 50 }], width: 10 })).toBe("raster");
  });

  it("안 닿으면 none", () => {
    expect(eraseVerdict(pen([[0, 0], [10, 0]]), eraser)).toBe("none");
  });

  it("한 군데라도 스치기만 한 구간이 있으면 그 획은 픽셀로 깎는다", () => {
    const thick = pen(
      [
        [0, 50],
        [200, 50]
      ],
      { width: 20 }
    );
    // 첫 구간은 가로지르고(덮음), 두 번째 구간은 가장자리만 스친다.
    const mixed = {
      points: [
        { x: 40, y: 0 },
        { x: 40, y: 100 },
        { x: 150, y: 100 },
        { x: 150, y: 63 },
        { x: 190, y: 63 }
      ],
      width: 10
    };
    expect(eraseVerdict(thick, mixed)).toBe("raster");
  });

  it("그림·옛 채우기 기록은 여기서 판정하지 않는다", () => {
    expect(eraseVerdict(pen([[0, 0], [80, 80]], { tool: "image", src: "data:," }), eraser)).toBe("none");
    expect(eraseVerdict(pen([[50, 50]], { tool: "fill" }), eraser)).toBe("none");
  });

  it("applyErase는 픽셀로 깎을 획을 따로 알려주고 자르지 않는다", () => {
    const thick = pen([[0, 50], [200, 50]], { width: 20 });
    const along = { points: [{ x: 0, y: 62 }, { x: 200, y: 62 }], width: 10 };
    const r = applyErase([thick], along, "L1");
    expect(r.raster).toEqual([thick]);
    expect(r.next).toEqual([thick]); // 기하는 그대로 — 패널이 픽셀로 바꾼다
    expect(r.changed).toBe(true);
  });
});
