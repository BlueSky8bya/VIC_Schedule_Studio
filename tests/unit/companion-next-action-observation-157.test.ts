import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { nextActionProgress157 } from "../visual/helpers/companion-next-action-157";

const previous = { scene: "S03", serial: "first-rest" };
const frame = (at: number, changes: Partial<{ state: string; scene: string; serial: string; beat: string; pose: number; x: number; y: number }> = {}) =>
  ({ at, state: "jump", scene: "routine-outing", serial: "next-action", beat: "0", pose: companionSpriteMetadata.rows[3][0], x: 100, y: 200, ...changes });
const observe = (frames: ReturnType<typeof frame>[]) => nextActionProgress157(frames, 0, previous);
describe("157 native subsequent-action progress evidence", () => {
  it("rejects a single correct jump drawing with no later observation", () => expect(observe([frame(250)])).toBeUndefined());
  it("rejects multiple jump-state drawings without actual displacement", () => expect(observe([frame(250), frame(400, { pose: companionSpriteMetadata.rows[4][1] })])).toBeUndefined());
  it("accepts continuous correct jump drawings after real movement", () => {
    const actual = frame(400, { y: 170, pose: companionSpriteMetadata.rows[4][1] });
    expect(observe([frame(250), actual])).toBe(actual);
  });
  it("rejects a moving state with an idle source drawing", () => expect(observe([frame(250, { pose: 0 }), frame(400, { pose: 0, y: 170 })])).toBeUndefined());
  it("cannot combine two different next serials", () => expect(observe([frame(250), frame(400, { serial: "different-action", y: 170 })])).toBeUndefined());
  it("cannot bridge a missing observation interval", () => expect(observe([frame(250), frame(550, { y: 170 })])).toBeUndefined());
  it("rejects the completed rest owner even if its state changes", () => expect(observe([frame(250, previous), frame(400, { ...previous, y: 170 })])).toBeUndefined());
  it("keeps the original ten-second next-action deadline", () => expect(observe([frame(9950), frame(10070, { y: 170 })])).toBeUndefined());
  it("accepts an actual stationary stretch clip advancing to another drawing", () => {
    const start = frame(250, { state: "stretch", pose: companionSpriteMetadata.rows[16][0] });
    const end = frame(400, { state: "stretch", pose: companionSpriteMetadata.rows[16][1] });
    expect(observe([start, end])).toBe(end);
  });
  it("accepts a genuine sprint row and rejects backwards timestamps", () => {
    const start = frame(250, { state: "walk", pose: companionSpriteMetadata.rows[20][0] });
    const end = frame(400, { state: "walk", pose: companionSpriteMetadata.rows[20][1], x: 126 });
    expect(observe([start, end])).toBe(end);
    expect(observe([end, start])).toBeUndefined();
  });
  it.each([NaN, Infinity, -Infinity])("rejects a non-finite completed-action time %s", endedAt => {
    expect(nextActionProgress157([frame(250), frame(400, { y: 170 })], endedAt, previous)).toBeUndefined();
  });
  it("rejects backwards time even if later frames could otherwise form a new bout", () => {
    expect(observe([frame(250), frame(200), frame(350, { y: 170 })])).toBeUndefined();
  });
  it("rejects duplicate time even if another frame later moves", () => {
    expect(observe([frame(250), frame(250), frame(400, { y: 170 })])).toBeUndefined();
  });
  it("rejects a non-finite trusted position instead of silently dropping it", () => {
    expect(observe([frame(200, { x: NaN }), frame(250), frame(400, { y: 170 })])).toBeUndefined();
  });
});
