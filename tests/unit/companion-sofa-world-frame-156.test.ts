import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { auditSofaWorldTransfer156, sofaExpectedWorldRect156, sofaWorldRectError156, type SofaWorldFrame156 } from "../visual/helpers/companion-sofa-world-frame-156";

function frame(): SofaWorldFrame156 {
  const pose = companionSpriteMetadata.rows[4][0];
  return { at: 16996.5, phase: "world-release", native: false, state: "jump", platform: "companion-home",
    sameActor: true, sameInput: true, inputFocused: true, visible: true, positionAnchor: "auto", inlinePositionAnchor: "", position: "fixed",
    homeScroll: 53, pose, decoded: true, cell: null, left: 0, top: 0, width: 92, height: 92, origin: [46, 46, 0],
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 64.578, 245.328, 0, 1],
    rect: { x: 64.578, y: 245.328, width: 92, height: 92 } };
}

function authenticated(sample: SofaWorldFrame156, row: number, column = 0) {
  sample.pose = companionSpriteMetadata.rows[row][column];
  const source = companionSpriteMetadata.frames[sample.pose], atlas = companionSpriteMetadata.atlases[source.atlas];
  const translation = (x: number, y: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
  sample.cell = { currentPath: atlas.src, connectedToSprite: true, naturalWidth: atlas.width, naturalHeight: atlas.height,
    textureWidth: 92 * companionSpriteMetadata.grid, textureHeight: 92 * companionSpriteMetadata.gridRows, spriteWidth: 92, spriteHeight: 92,
    textureLeft: 0, textureTop: 0, textureMatrix: translation(-(source.index % companionSpriteMetadata.grid) * 92, -Math.floor(source.index / companionSpriteMetadata.grid) * 92),
    spriteMatrix: translation(source.x / 80 * 92, source.y / 80 * 92), spriteClipPath: `inset(${source.clip.map(value => `${value / 80 * 100}%`).join(" ")})`, textureClipPath: "none" };
  return sample;
}
function complete() {
  return Array.from({ length: 10 }, (_, i) => {
    const sample = frame(); sample.at += i * 40;
    sample.phase = i < 3 ? "world-input" : "world-release";
    sample.state = i < 3 ? "held" : i < 7 ? "jump" : "idle";
    const x = i < 3 ? i * 24 : 48, y = i < 3 ? -i * 24 : i < 7 ? (i - 3) * 12 - 48 : 0;
    sample.matrix![12] += x; sample.matrix![13] += y; sample.rect!.x += x; sample.rect!.y += y;
    return authenticated(sample, i < 3 ? 8 : i < 7 ? [3, 4, 5, 6][i - 3] : 0);
  });
}

describe("156 sofa world-space observation integrity", () => {
  it("accepts actual world coordinates independent of any decorative landing target", () => {
    const sample = frame(), untouched = structuredClone(sample);
    expect(sofaWorldRectError156(sample)).toBeLessThan(.000001);
    sample.matrix![12] += 143; sample.matrix![13] -= 27; sample.rect!.x += 143; sample.rect!.y -= 27;
    expect(sofaWorldRectError156(sample)).toBeLessThan(.000001);
    expect(untouched.rect!.y).toBe(245.328);
  });
  it("preserves the confirmed53px scroll-compensation failure rather than filtering it", () => {
    const sample = frame(); sample.positionAnchor = "--vc-sofa-_r_2_-seat"; sample.inlinePositionAnchor = sample.positionAnchor;
    sample.rect!.y = 192.3280029296875;
    expect(sofaWorldRectError156(sample)).toBeCloseTo(52.9999970703125, 5);
  });
  it("handles real scale about the computed transform origin", () => {
    const sample = frame(); sample.matrix![0] = .8; sample.matrix![5] = .8;
    sample.rect = { x: 73.778, y: 254.528, width: 73.6, height: 73.6 };
    expect(sofaWorldRectError156(sample)).toBeLessThan(.000001);
  });
  it.each(["missing rect", "NaN matrix", "perspective", "missing origin", "nonfixed"])("refuses an unmeasured%s world frame", reason => {
    const sample = frame();
    if (reason === "missing rect") sample.rect = null;
    if (reason === "NaN matrix") sample.matrix![12] = NaN;
    if (reason === "perspective") sample.matrix![3] = .01;
    if (reason === "missing origin") sample.origin = [];
    if (reason === "nonfixed") sample.position = "absolute";
    expect(sofaWorldRectError156(sample)).toBe(Infinity);
  });
  it("does not mutate the raw failed observation", () => {
    const sample = frame(); sample.rect!.y -= 53; const untouched = structuredClone(sample);
    sofaExpectedWorldRect156(sample); sofaWorldRectError156(sample);
    expect(sample).toEqual(untouched);
  });
  it("admits actual held movement, decoded multi-pose flight and the next grounded action", () => {
    const trace = complete(), untouched = structuredClone(trace), result = auditSofaWorldTransfer156(trace);
    expect(result.issues).toEqual([]); expect(result.flightFrames).toBe(4); expect(result.nextActionAt).not.toBeNull();
    expect(trace).toEqual(untouched);
  });
  const landedFloor = () => {
    const trace = complete();
    for (const sample of trace.slice(7)) {
      sample.platform = "companion-home-floor-1"; sample.positionAnchor = sample.inlinePositionAnchor = "--vc-item-1";
      sample.floorAnchor = { name: "--vc-item-1", native: true, connected: true, visible: true, rect: { x: 100, y: 263.328, width: 200, height: 80 } };
    }
    return trace;
  };
  it("allows a new measured home-floor anchor only after the decoded flight has actually landed", () => {
    const trace = landedFloor(), original = structuredClone(trace);
    expect(auditSofaWorldTransfer156(trace).issues).toEqual([]); expect(trace).toEqual(original);
  });
  it.each(["held", "flight", "wrong source", "wash mat", "hidden source", "detached source", "wrong name", "off floor", "wrong plane"])("rejects an unproved native floor after release: %s", reason => {
    const trace = landedFloor(), sample = trace[7];
    if (reason === "held") sample.state = "held";
    if (reason === "flight") sample.state = "jump";
    if (reason === "wrong source") sample.platform = "date-1-floor";
    if (reason === "wash mat") sample.platform = "companion-home-floor-400";
    if (reason === "hidden source") sample.floorAnchor!.visible = false;
    if (reason === "detached source") sample.floorAnchor!.connected = false;
    if (reason === "wrong name") sample.floorAnchor!.name = "--vc-item-other";
    if (reason === "off floor") sample.floorAnchor!.rect.x = 500;
    if (reason === "wrong plane") sample.floorAnchor!.rect.y += 5;
    expect(auditSofaWorldTransfer156(trace).issues.length).toBeGreaterThan(0);
  });
  const alterations: [string, (trace: SofaWorldFrame156[]) => void][] = [
    ["retained anchor", trace => { trace[4].positionAnchor = "--old-sofa"; }],
    ["inline association", trace => { trace[4].inlinePositionAnchor = "--old-sofa"; }],
    ["remounted body", trace => { trace[4].sameActor = false; }],
    ["replaced input owner", trace => { trace[4].sameInput = false; }],
    ["hidden bad sample", trace => { trace[4].visible = false; }],
    ["world scroll offset", trace => { trace[4].rect!.y -= 53; }],
    ["unscrolled fixture", trace => { trace.forEach(sample => { sample.homeScroll = 0; }); }],
    ["wrong painted sprite cell", trace => { trace.forEach(sample => { sample.cell!.textureMatrix![12] += 92; }); }],
    ["no subsequent action", trace => { trace.splice(7); }],
    ["lost held focus", trace => { trace[1].inputFocused = false; }],
    ["missing frame interval", trace => { trace[4].at += 500; }],
  ];
  it.each(alterations)("withholds evidence for%s without filtering the bad raw sample", (_name, alter) => {
    const trace = complete(); alter(trace); const untouched = structuredClone(trace);
    expect(auditSofaWorldTransfer156(trace).issues.length).toBeGreaterThan(0); expect(trace).toEqual(untouched);
  });
});
