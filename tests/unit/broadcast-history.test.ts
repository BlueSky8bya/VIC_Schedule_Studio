import { describe, expect, it } from "vitest";

import {
  BROADCAST_HISTORY_LIMIT,
  createBroadcastHistory
} from "@/lib/broadcast/history";
import { createStrokeStore, type Stroke } from "@/lib/broadcast/stroke-engine";

describe("broadcast unified history", () => {
  it("획·배치가 섞여도 한 순서로 undo/redo한다", () => {
    const history = createBroadcastHistory<string>();
    history.push("stroke-1");
    history.push("cols");
    history.push("stroke-2");

    expect(history.undo()).toBe("stroke-2");
    expect(history.undo()).toBe("cols");
    expect(history.redo()).toBe("cols");
    expect(history.sizes()).toEqual({ undo: 2, redo: 1 });
  });

  it("상한을 넘긴 오래된 액션만 undo 대상에서 제외한다", () => {
    const history = createBroadcastHistory<number>();
    for (let i = 0; i < BROADCAST_HISTORY_LIMIT + 25; i += 1) history.push(i);

    expect(history.sizes()).toEqual({ undo: BROADCAST_HISTORY_LIMIT, redo: 0 });
    for (let i = BROADCAST_HISTORY_LIMIT + 24; i >= 25; i -= 1) {
      expect(history.undo()).toBe(i);
    }
    expect(history.undo()).toBeNull();
  });

  it("새 액션과 clear가 redo 미래를 폐기한다", () => {
    const history = createBroadcastHistory<string>();
    history.push("a");
    history.undo();
    history.push("b");
    expect(history.canRedo()).toBe(false);
    history.clear();
    expect(history.canUndo()).toBe(false);
  });

  it("장면 편집 사이의 획도 store 내부 redo와 무관하게 다시 실행한다", () => {
    type Action =
      | { type: "stroke"; stroke: Stroke }
      | { type: "scene"; before: Stroke[]; after: Stroke[] };
    const stroke = (x: number): Stroke => ({
      tool: "pen",
      layer: "layer-1",
      color: "#000",
      width: 2,
      points: [{ x, y: 0 }]
    });
    const store = createStrokeStore(Number.POSITIVE_INFINITY);
    const history = createBroadcastHistory<Action>();
    const first = stroke(1);
    const fragment = stroke(2);
    const last = stroke(3);

    store.push(first);
    history.push({ type: "stroke", stroke: first });
    const beforeScene = [...store.strokes()];
    store.setStrokes([fragment]);
    history.push({ type: "scene", before: beforeScene, after: [fragment] });
    store.push(last);
    history.push({ type: "stroke", stroke: last });

    const undoStroke = history.undo();
    expect(undoStroke?.type).toBe("stroke");
    store.setStrokes(store.strokes().filter((item) => item !== last));
    const undoScene = history.undo();
    expect(undoScene?.type).toBe("scene");
    if (undoScene?.type === "scene") store.setStrokes(undoScene.before);

    const redoScene = history.redo();
    if (redoScene?.type === "scene") store.setStrokes(redoScene.after);
    const redoStroke = history.redo();
    if (redoStroke?.type === "stroke") {
      store.setStrokes([...store.strokes(), redoStroke.stroke]);
    }

    expect(store.strokes()).toEqual([fragment, last]);
  });
});
