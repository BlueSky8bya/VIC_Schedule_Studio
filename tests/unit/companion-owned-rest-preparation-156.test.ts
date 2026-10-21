import { describe, expect, it } from "vitest";
import { ownedRestPreparationIndices, type OwnedRestPreparationFrame as Frame } from "@/tests/visual/helpers/companion-owned-rest-preparation";

const frame = (at: number, patch: Partial<Frame> = {}): Frame => ({ at, state: "idle", scene: "", serial: "", beat: "", x: 80, y: 540,
  platform: "companion-home", visible: true, decoded: true, tv: "off", lit: true, activity: { source: true, manual: false },
  homeSofa: { left: 30, right: 140, top: 540, visible: true }, ...patch });
function fixture(): Frame[] {
  const life = { phase: "nap", scene: "S03", serial: "7", beat: "3", reaching: "", lampTouch: false };
  return [frame(0, { scene: "S03", serial: "7", beat: "2", state: "play" }),
    frame(50, { homeLife: life, state: "jump" }),
    frame(100, { homeLife: life, state: "walk", x: 150, y: 580, platform: "companion-home-floor" }),
    frame(150, { homeLife: { ...life, reaching: "light", lampTouch: true }, state: "play", x: 180, y: 580, platform: "companion-home-floor" }),
    frame(200, { homeLife: { ...life, reaching: "light", lampTouch: true }, state: "play", x: 180, y: 580, platform: "companion-home-floor", lit: false }),
    frame(250, { homeLife: life, state: "walk", x: 140, y: 580, platform: "companion-home-floor", lit: false }),
    frame(300, { homeLife: life, state: "jump", lit: false }),
    frame(350, { scene: "S03", serial: "7", beat: "3", state: "sleep", lit: false }),
    frame(400, { scene: "routine-outing", serial: "8", beat: "0", state: "walk", lit: false })];
}
describe("156 same-owner physical rest preparation observer", () => {
  it("bridges only the actual lamp errand and leaves actual required-rest/following frames outside the credit", () => {
    expect([...ownedRestPreparationIndices(fixture(), "S03")]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...ownedRestPreparationIndices(fixture(), "S05")]).toEqual([]);
  });
  it.each(["serial", "scene", "beat", "missing-owner", "manual", "undecoded", "no-contact", "no-change", "wrong-light", "tv-change", "no-movement", "wrong-return", "hidden-sofa", "new-attempt", "long-gap", "over-budget"] as const)("rejects %s without borrowing an unowned ordinary action", failure => {
    const trace = fixture();
    if (failure === "serial") trace[4].homeLife!.serial = "99";
    if (failure === "scene") trace[4].homeLife!.scene = "S10";
    if (failure === "beat") trace[4].homeLife!.beat = "4";
    if (failure === "missing-owner") delete trace[4].homeLife;
    if (failure === "manual") trace[2].activity = { source: true, manual: true };
    if (failure === "undecoded") for (const value of trace.slice(1, 7)) value.decoded = false;
    if (failure === "no-contact") for (const value of trace.slice(1, 7)) value.homeLife!.lampTouch = false;
    if (failure === "no-change") for (const value of trace) value.lit = true;
    if (failure === "wrong-light") for (const value of trace) { if (value.homeLife) value.homeLife.phase = "awake"; }
    if (failure === "tv-change") trace[4].tv = "tori";
    if (failure === "no-movement") for (const value of trace.slice(1, 7)) { value.x = 80; value.y = 540; }
    if (failure === "wrong-return") trace[7].x = 220;
    if (failure === "hidden-sofa") trace[7].homeSofa!.visible = false;
    if (failure === "new-attempt") trace[7].serial = "8";
    if (failure === "long-gap") trace[4].at += 200;
    if (failure === "over-budget") for (let index = 0; index < trace.length; index++) trace[index].at *= 101;
    expect([...ownedRestPreparationIndices(trace, "S03")]).toEqual([]);
  });
});
