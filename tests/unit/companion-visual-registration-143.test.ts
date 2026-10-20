import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelSection } from "@/components/shared/panel-section";
import { companionEyeAccessorySpan, companionEyeViewScale } from "@/lib/ui/viewer-companion/accessory-eye-fit";
import { companionAccessoryPlacement } from "@/lib/ui/viewer-companion/accessory";
import { companionRoomItemLight } from "@/lib/ui/viewer-companion/room-light";
import { companionRoomBodyLight } from "@/lib/ui/viewer-companion/home-interaction";
import { selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
const renderPanel = (props: React.ComponentProps<typeof PanelSection>) => renderToStaticMarkup(React.createElement(PanelSection, props));

describe("143 room item paint grade", () => {
  const room = { left: 12, right: 444, top: 80, bottom: 399.68 };
  it.each(["settled", "held", "carried", "falling", "eating"])("uses physical position for %s, with no platform/state lookup", () => {
    for (const grade of [.6, .65, 1]) {
      expect(companionRoomItemLight({ x: 220, y: 240 }, room, grade)).toBe(grade);
      expect(companionRoomItemLight({ x: 445, y: 240 }, room, grade)).toBe(1);
      expect(companionRoomItemLight({ x: 220, y: 400 }, room, grade)).toBe(1);
    }
  });
  it("matches the existing body rule at all edges and immediately restores the outside", () => {
    for (const x of [11.99, 12, 220, 444, 444.01]) for (const y of [79.99, 80, 240, 399.68, 399.69]) {
      expect(companionRoomItemLight({ x, y }, room, .65)).toBe(companionRoomBodyLight({ x, y }, room, .65));
    }
  });
  it("uses a neutral grade for absent/invalid samples, preserving the existing bounded light contract", () => {
    expect(companionRoomItemLight({ x: 20, y: 100 }, undefined, .6)).toBe(1);
    expect(companionRoomItemLight({ x: NaN, y: 100 }, room, .6)).toBe(1);
    expect(companionRoomItemLight({ x: 20, y: 100 }, room, Infinity)).toBe(1);
    expect(companionRoomItemLight({ x: 20, y: 100 }, room, -20)).toBe(.35);
    expect(companionRoomItemLight({ x: 20, y: 100 }, room, 20)).toBe(1);
  });
});

describe("143 standing eyewear scale with actual adopted registration", () => {
  it("keeps the existing source camera projections and rejects invalid reference spans", () => {
    expect(["front", "quarter", "side", "back"].map(view => companionEyeViewScale(view as "front"))).toEqual([1, .83, .56, 1]);
    for (const span of [NaN, Infinity, 0, -1]) expect(companionEyeAccessorySpan(span, "front")).toBeUndefined();
  });
  it("does not let the petting/recovery expression shrink any of the five paired glasses", () => {
    // Both actual packets differ from standing in eye span. They retain their
    // own adopted image/position/roll while the same worn object keeps its size.
    const indices = [0, 144, 159, 376, 383];
    const eyeSpan = (index: number) => { const eyes = anchors.frames[index].eyes; return Math.hypot(eyes[1].center[0] - eyes[0].center[0], eyes[1].center[1] - eyes[0].center[1]); };
    expect(eyeSpan(144)).not.toBeCloseTo(eyeSpan(0)); expect(eyeSpan(376)).not.toBeCloseTo(eyeSpan(0));
    for (const id of ["round-glasses", "wire-glasses", "browline-glasses", "heart-glasses", "square-glasses"] as const) {
      const standing = companionAccessoryPlacement(selectCompanionSprite(0), id)!;
      for (const index of indices) {
        const pose = anchors.frames[index], placed = companionAccessoryPlacement(selectCompanionSprite(index), id)!;
        expect(pose.orientation).toBe("front"); expect(placed.width).toBeCloseTo(standing.width);
        expect([placed.x, placed.y, placed.rotation]).toEqual([pose.face.x, pose.face.y, pose.face.roll]);
      }
    }
  });
  it("keeps source-local pivots/yaw/roll on every visible pose rather than borrowing standing anchors", () => {
    const standing = companionAccessoryPlacement(selectCompanionSprite(0), "wire-glasses")!;
    for (const pose of anchors.frames) {
      const selected = selectCompanionSprite(pose.physicalIndex), placed = companionAccessoryPlacement(selected, "wire-glasses")!;
      if (pose.orientation === "back") continue;
      const view = pose.orientation === "quarter" ? "quarter" : pose.orientation === "side" ? "side" : "front";
      expect(placed.width).toBeCloseTo(standing.width * companionEyeViewScale(view));
      expect([placed.x, placed.y, placed.rotation]).toEqual([pose.face.x, pose.face.y, pose.face.roll]);
      expect(companionAccessoryPlacement({ ...selected, src: "/not-decoded.webp" }, "wire-glasses")).toBeNull();
    }
  });
  it("also stabilizes legacy front eyewear without changing its standing size", () => {
    for (const id of ["sunglasses", "pixel-sunglasses"] as const) {
      const standing = companionAccessoryPlacement(selectCompanionSprite(0), id)!;
      expect(standing.width).toBeCloseTo(anchors.frames[0].face.width * (id === "sunglasses" ? 1.32 : 1.3));
      for (const index of [144, 159, 376, 383]) expect(companionAccessoryPlacement(selectCompanionSprite(index), id)!.width).toBeCloseTo(standing.width);
    }
  });
});

describe("143 shared disclosure structure", () => {
  it.each([["tag-filter", "태그 필터", "tag-filter-fold"], ["season", "계절 배경", "season-panel-fold"], ["companion-home", "빅타민 집", "companion-home-fold"]] as const)("preserves %s fixed action, current state and body identity", (sectionKey, title, action) => {
    const html = renderPanel({ sectionKey, title, collapsible: true, children: "actual body", actions: React.createElement("button", { type: "button", "data-act": "companion-personality-open" }, "성격") });
    expect(html).toContain(`data-act="${action}" data-act-opt="close"`);
    expect(html).toContain('aria-expanded="true"'); expect(html).toMatch(/aria-controls="[^"]+"/);
    expect(html).toContain('class="panel-section-disclosure" aria-hidden="true"'); expect(html).not.toContain('panel-section-chevron');
    expect(html).toContain('class="panel-section-actions"'); expect(html).toContain('actual body');
    expect(html.match(/<button\b/g)).toHaveLength(2);
    expect(html.indexOf('</h2>')).toBeLessThan(html.indexOf('class="panel-section-actions"'));
  });
  it("does not add a fake disclosure to a compact room's plain heading", () => {
    const html = renderPanel({ sectionKey: "companion-home", title: "빅타민 집", children: "actual body" });
    expect(html).not.toContain('data-panel-section-toggle'); expect(html).not.toContain('panel-section-disclosure');
    expect(html).not.toContain('<button');
  });
});
