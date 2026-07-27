import { describe, expect, it } from "vitest";

import {
  resolveDrawingLayerAfterRemoval,
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

  it("prefers current, then remembered, then first writable drawing layer", () => {
    const layers = [
      { id: "top", vis: true, lock: false },
      { id: "remembered", vis: true, lock: false },
      { id: "locked", vis: true, lock: true }
    ];

    expect(resolveWritableDrawingLayerId(layers, "top", "remembered")).toBe("top");
    expect(resolveWritableDrawingLayerId(layers, "__schedule__", "remembered")).toBe("remembered");
    expect(resolveWritableDrawingLayerId(layers, "locked", "missing")).toBe("top");
  });

  it("never unlocks, unhides, or invents a drawing layer", () => {
    const layers = [
      { id: "hidden", vis: false, lock: false },
      { id: "locked", vis: true, lock: true }
    ];

    expect(resolveWritableDrawingLayerId(layers, "__schedule__", "hidden")).toBeNull();
  });

  it("falls back to a writable layer when the active drawing layer disappears", () => {
    const layers = [
      { id: "locked", vis: true, lock: true },
      { id: "remembered", vis: true, lock: false },
      { id: "visible", vis: true, lock: false }
    ];

    expect(resolveDrawingLayerAfterRemoval(layers, "remembered")).toBe("remembered");
    expect(resolveDrawingLayerAfterRemoval(layers, "missing")).toBe("remembered");
  });

  it("keeps the first layer inspectable when no layer is writable, or returns none", () => {
    const blocked = [
      { id: "hidden", vis: false, lock: false },
      { id: "locked", vis: true, lock: true }
    ];

    expect(resolveDrawingLayerAfterRemoval(blocked, "missing")).toBe("hidden");
    expect(resolveDrawingLayerAfterRemoval([], "missing")).toBeNull();
  });

  it("enters schedule arrange mode only for the session's first successful direct send", () => {
    expect(shouldEnterScheduleArrangeMode(false, 1)).toBe(true);
    expect(shouldEnterScheduleArrangeMode(false, 3)).toBe(true);
    expect(shouldEnterScheduleArrangeMode(false, 0)).toBe(false);
    expect(shouldEnterScheduleArrangeMode(true, 1)).toBe(false);
    expect(shouldEnterScheduleArrangeMode(true, 3)).toBe(false);
  });
});
