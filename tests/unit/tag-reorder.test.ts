// 태그 순서 변경 순수 모델 — 감사 문서(docs/tags/tag-editor-reorder-ux-audit.md) §8의
// 재현 표를 그대로 고정한다. 특히 "마지막 둘을 앞→뒤 방향으로 못 바꾸던" P0 결함.
import { describe, expect, it } from "vitest";
import { edgeForPointer, reorderAtEdge } from "@/lib/tags/reorder";

describe("reorderAtEdge", () => {
  it("P0 재현: [A,B,C]에서 B를 C의 아래(after)로 — 맨 끝으로 이동한다", () => {
    expect(reorderAtEdge(["A", "B", "C"], "B", "C", "after")).toEqual(["A", "C", "B"]);
  });

  it("첫 항목을 마지막 행 after로 → 맨 끝", () => {
    expect(reorderAtEdge(["A", "B", "C", "D"], "A", "D", "after")).toEqual(["B", "C", "D", "A"]);
  });

  it("마지막 항목을 첫 행 before로 → 맨 앞", () => {
    expect(reorderAtEdge(["A", "B", "C", "D"], "D", "A", "before")).toEqual(["D", "A", "B", "C"]);
  });

  it("마지막 둘 교환을 양방향으로 반복해 원복할 수 있다", () => {
    const step1 = reorderAtEdge(["A", "B", "C"], "B", "C", "after"); // [A,C,B]
    const step2 = reorderAtEdge(step1, "B", "C", "before"); // 원복
    expect(step2).toEqual(["A", "B", "C"]);
  });

  it("[A,B,C,D]에서 A를 C의 after로 → C 바로 뒤", () => {
    expect(reorderAtEdge(["A", "B", "C", "D"], "A", "C", "after")).toEqual(["B", "C", "A", "D"]);
  });

  it("동일 목적지는 같은 배열 참조를 돌려준다(no-op — 렌더 없음)", () => {
    const ids = ["A", "B", "C"];
    // B의 바로 앞(= 현재 자리) — 불변
    expect(reorderAtEdge(ids, "B", "C", "before")).toBe(ids);
    // A의 after(= B의 현재 자리 앞) — B에게는 제자리
    expect(reorderAtEdge(ids, "B", "A", "after")).toBe(ids);
    // 자기 자신 위 — 불변
    expect(reorderAtEdge(ids, "B", "B", "after")).toBe(ids);
  });

  it("무효 입력(목록에 없는 id)은 같은 참조를 돌려준다", () => {
    const ids = ["A", "B"];
    expect(reorderAtEdge(ids, "X", "A", "before")).toBe(ids);
    expect(reorderAtEdge(ids, "A", "X", "before")).toBe(ids);
  });

  it("고정 머리(휴뱅) 앞 드롭은 고정 구간 바로 뒤로 클램프된다", () => {
    // [dayoff, A, B]에서 B를 dayoff 앞(before)으로 → dayoff는 그대로, B는 1번으로
    expect(reorderAtEdge(["dayoff", "A", "B"], "B", "dayoff", "before", 1)).toEqual([
      "dayoff",
      "B",
      "A"
    ]);
    // 이미 고정 구간 바로 뒤인 항목을 다시 그 앞으로 — 순서 불변(같은 참조)
    const ids = ["dayoff", "A", "B"];
    expect(reorderAtEdge(ids, "A", "dayoff", "before", 1)).toBe(ids);
  });

  it("임시(new:) id가 섞여도 유실·중복이 없다", () => {
    const ids = ["dayoff", "t1", "new:1", "t2"];
    const next = reorderAtEdge(ids, "new:1", "t2", "after", 1);
    expect(next).toEqual(["dayoff", "t1", "t2", "new:1"]);
    expect(new Set(next).size).toBe(4);
  });
});

describe("edgeForPointer", () => {
  // 행: top=100, height=40 → mid=120, 데드존=±8
  it("중앙선 위/아래를 명확히 벗어나면 before/after", () => {
    expect(edgeForPointer(105, 100, 40, null)).toBe("before");
    expect(edgeForPointer(135, 100, 40, null)).toBe("after");
  });

  it("데드존 안에서는 직전 edge를 유지한다(왕복 떨림 방지)", () => {
    expect(edgeForPointer(122, 100, 40, "before")).toBe("before");
    expect(edgeForPointer(118, 100, 40, "after")).toBe("after");
  });

  it("직전 edge가 없으면 중앙선 기준으로 정한다", () => {
    expect(edgeForPointer(118, 100, 40, null)).toBe("before");
    expect(edgeForPointer(122, 100, 40, null)).toBe("after");
  });
});
