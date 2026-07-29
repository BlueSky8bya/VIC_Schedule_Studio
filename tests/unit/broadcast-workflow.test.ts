import { describe, expect, it } from "vitest";

import {
  reorderDrawingLayer,
  reorderDrawingLayerBefore,
  resolveDrawingLayerAfterRemoval,
  resolveLayerDropBeforeId,
  resolveWritableDrawingLayerId,
  shouldEnterScheduleArrangeMode,
  toolAfterEmptyLayerAdded,
  toolAfterInkColorPick,
  toolAfterInkWidthPick
} from "@/lib/broadcast/workflow";
import type { BroadcastTool } from "@/lib/broadcast/stroke-engine";

describe("broadcast panel workflow", () => {
  it.each([
    ["select", "pen"],
    ["eraser", "pen"],
    ["pen", "pen"],
    ["hl", "hl"],
    ["line", "line"],
    ["arrow", "arrow"],
    ["rect", "rect"],
    ["ellipse", "ellipse"]
  ] satisfies [BroadcastTool, BroadcastTool][])(
    "keeps color-capable tool context when picking ink color: %s → %s",
    (before, after) => {
      expect(toolAfterInkColorPick(before)).toBe(after);
    }
  );

  it.each([
    ["select", "pen"],
    ["eraser", "eraser"],
    ["pen", "pen"],
    ["hl", "hl"],
    ["line", "line"],
    ["arrow", "arrow"],
    ["rect", "rect"],
    ["ellipse", "ellipse"]
  ] satisfies [BroadcastTool, BroadcastTool][])(
    "keeps width-capable tool context when picking ink width: %s → %s",
    (before, after) => {
      expect(toolAfterInkWidthPick(before)).toBe(after);
    }
  );

  it.each([
    ["select", "pen"],
    ["eraser", "pen"],
    ["hl", "hl"],
    ["rect", "rect"]
  ] satisfies [BroadcastTool, BroadcastTool][])(
    "opens an empty layer with a useful marking tool: %s → %s",
    (before, after) => {
      expect(toolAfterEmptyLayerAdded(before)).toBe(after);
    }
  );

  // (잠금 기능은 2026-07-31 사용자 결정으로 제거 — writable = 보이는 레이어.)
  it("prefers current, then remembered, then first writable drawing layer", () => {
    const layers = [
      { id: "top", vis: true },
      { id: "remembered", vis: true },
      { id: "hidden", vis: false }
    ];

    expect(resolveWritableDrawingLayerId(layers, "top", "remembered")).toBe("top");
    expect(resolveWritableDrawingLayerId(layers, "__schedule__", "remembered")).toBe("remembered");
    expect(resolveWritableDrawingLayerId(layers, "hidden", "missing")).toBe("top");
  });

  it("never unhides or invents a drawing layer", () => {
    const layers = [{ id: "hidden", vis: false }];

    expect(resolveWritableDrawingLayerId(layers, "__schedule__", "hidden")).toBeNull();
  });

  it("falls back to a writable layer when the active drawing layer disappears", () => {
    const layers = [
      { id: "hidden", vis: false },
      { id: "remembered", vis: true },
      { id: "visible", vis: true }
    ];

    expect(resolveDrawingLayerAfterRemoval(layers, "remembered")).toBe("remembered");
    expect(resolveDrawingLayerAfterRemoval(layers, "missing")).toBe("remembered");
  });

  it("keeps the first layer inspectable when no layer is writable, or returns none", () => {
    const blocked = [{ id: "hidden", vis: false }];

    expect(resolveDrawingLayerAfterRemoval(blocked, "missing")).toBe("hidden");
    expect(resolveDrawingLayerAfterRemoval([], "missing")).toBeNull();
  });

  it("reorders drawing layers without mutating input or crossing list boundaries", () => {
    const layers = [{ id: "top" }, { id: "middle" }, { id: "bottom" }];

    expect(reorderDrawingLayer(layers, "middle", "up")?.map((layer) => layer.id)).toEqual([
      "middle",
      "top",
      "bottom"
    ]);
    expect(reorderDrawingLayer(layers, "middle", "down")?.map((layer) => layer.id)).toEqual([
      "top",
      "bottom",
      "middle"
    ]);
    expect(reorderDrawingLayer(layers, "top", "up")).toBeNull();
    expect(reorderDrawingLayer(layers, "bottom", "down")).toBeNull();
    expect(reorderDrawingLayer(layers, "missing", "up")).toBeNull();
    expect(layers.map((layer) => layer.id)).toEqual(["top", "middle", "bottom"]);
  });

  it("inserts a dragged layer before a card or at the drawing-stack end", () => {
    const layers = [{ id: "top" }, { id: "middle" }, { id: "bottom" }];

    expect(reorderDrawingLayerBefore(layers, "bottom", "top")?.map((layer) => layer.id)).toEqual([
      "bottom",
      "top",
      "middle"
    ]);
    expect(reorderDrawingLayerBefore(layers, "top", "bottom")?.map((layer) => layer.id)).toEqual([
      "middle",
      "top",
      "bottom"
    ]);
    expect(reorderDrawingLayerBefore(layers, "top", null)?.map((layer) => layer.id)).toEqual([
      "middle",
      "bottom",
      "top"
    ]);
    expect(reorderDrawingLayerBefore(layers, "middle", "bottom")).toBeNull();
    expect(reorderDrawingLayerBefore(layers, "missing", null)).toBeNull();
    expect(reorderDrawingLayerBefore(layers, "top", "missing")).toBeNull();
    expect(layers.map((layer) => layer.id)).toEqual(["top", "middle", "bottom"]);
  });

  it("distinguishes a valid layer drop, stack end, and outside cancellation", () => {
    const bounds = { left: 100, right: 340, top: 50, bottom: 450 };
    const slots = [
      { id: "top", midpoint: 80 },
      { id: "middle", midpoint: 160 }
    ];

    expect(resolveLayerDropBeforeId(180, 90, bounds, 0, slots)).toBe("top");
    expect(resolveLayerDropBeforeId(180, 230, bounds, 0, slots)).toBeNull();
    expect(resolveLayerDropBeforeId(180, 90, bounds, 100, slots)).toBe("middle");
    expect(resolveLayerDropBeforeId(20, 90, bounds, 0, slots)).toBeUndefined();
    expect(resolveLayerDropBeforeId(180, 520, bounds, 0, slots)).toBeUndefined();
  });

  it("enters schedule arrange mode only for the session's first successful direct send", () => {
    expect(shouldEnterScheduleArrangeMode(false, 1)).toBe(true);
    expect(shouldEnterScheduleArrangeMode(false, 3)).toBe(true);
    expect(shouldEnterScheduleArrangeMode(false, 0)).toBe(false);
    expect(shouldEnterScheduleArrangeMode(true, 1)).toBe(false);
    expect(shouldEnterScheduleArrangeMode(true, 3)).toBe(false);
  });
});
