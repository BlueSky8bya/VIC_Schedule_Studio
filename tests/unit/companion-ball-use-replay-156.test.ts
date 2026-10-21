import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { completedNativeBallUseReplay, type NativeBallUseFrame } from "../visual/helpers/companion-ball-use-replay";

const target = "same-real-ball", after = 1000;
function positive(): NativeBallUseFrame[] {
  const frames: NativeBallUseFrame[] = [];
  for (let at = 1000; at <= 4400; at += 40) {
    const elapsed = at - 1200, playing = elapsed >= 0 && elapsed < 2600;
    const fraction = Math.max(0, Math.min(1, elapsed / 2600));
    const flight = Math.max(0, Math.min(1, (fraction - .22) / .5));
    const row = fraction < .13 ? 1 : 9, poses = companionSpriteMetadata.rows[row];
    const falling = at >= 3800 && at < 4200, carried = at >= 1120 && at < 3800;
    const arc = Math.sin(flight * Math.PI), x = falling ? 130 + (at - 3800) / 10 : at < 4200 ? 130 + arc * 22 : 170;
    const y = falling ? 450 - Math.sin((at - 3800) / 400 * Math.PI) * 20 : at < 4200 ? 450 - arc * 28 : 450;
    frames.push({ at, state: playing || at === 3800 ? "play" : at < 1200 ? "sniff" : "idle", pose: playing ? poses[Math.floor(elapsed / 80) % poses.length] : 0,
      decoded: true, toyAction: at < 3880 ? "play" : "", actor: { x: 100, y: 500 },
      toys: [{ id: target, kind: "ball", use: playing ? "ball-toss" : "", carried, held: false, falling, visible: true, decoded: true,
        x, y, rotation: playing ? Math.sin(flight * Math.PI * 2) * 80 : 0 }] });
  }
  return frames;
}
const observe = (frames: NativeBallUseFrame[], id = target, cutoff = after) => completedNativeBallUseReplay(frames, id, cutoff);

describe("156 current149 same-ball replay observes its actual functional use", () => {
  it("requires a fresh physical pickup, full2600ms use, visible arc/rotation, late release, flight, rest and idle end", () => {
    expect(observe(positive())).toMatchObject({ pickedAt: 1120, playedAt: 1200, releasedAt: 3800, settledAt: 4200, endedAt: 3840, paintedMs: 2560 });
  });
  it("can observe the physical rest after the planner has continued to another ordinary action", () => {
    const frames = positive(); for (const frame of frames) if (frame.at >= 3880) { frame.state = "walk"; frame.toyAction = ""; }
    expect(observe(frames)).toBeDefined();
  });
  it("allows one p=0 neutral row before actual first-row playback without granting that frame progress", () => {
    const frames = positive(), first = frames.find(frame => frame.at === 1200)!;
    first.pose = companionSpriteMetadata.rows[9][0];
    //40ms endpoint loss still requires the unchanged2520ms total measured use.
    expect(observe(frames)).toMatchObject({ playedAt: 1240, paintedMs: 2520 });
  });
  it("cannot reuse a completed use or a pickup before the discovery boundary", () => {
    expect(observe(positive(), target, 4400)).toBeUndefined();
    expect(observe(positive(), target, 1600)).toBeUndefined();
  });
  it.each([
    "no-pickup", "different-id", "other-kind", "missing-use", "wrong-use", "transient-use-loss", "no-arc", "no-lateral", "no-rotation", "scroll-only",
    "missing-body", "invalid-body", "duplicate-id", "hidden-body", "hidden-toy", "undecoded-toy", "held", "wrong-pose", "frozen-poses", "no-first-row", "short-first-row", "reverse-rows",
    "short-use", "overlong-use", "use-while-falling", "retained-use", "no-release", "early-release", "no-flight", "one-flight-frame", "frozen-flight", "never-rested", "moving-rest", "missing-after-release", "recarried", "no-idle-end",
    "tidy-owner", "observation-gap", "invalid-time", "duplicate-time", "invalid-rotation", "out-of-range-rotation", "reverse-sequence"
  ] as const)("rejects %s rather than manufacturing a completed replay", defect => {
    let frames = positive();
    const during = frames.find(frame => frame.at === 2400)!;
    if (defect === "no-pickup") for (const frame of frames) if (frame.at < 1120) frame.toys[0].carried = true;
    if (defect === "different-id") for (const frame of frames) frame.toys[0].id = "another-real-ball";
    if (defect === "other-kind") for (const frame of frames) frame.toys[0].kind = "hoop";
    if (defect === "missing-use") for (const frame of frames) delete (frame.toys[0] as Partial<NativeBallUseFrame["toys"][number]>).use;
    if (defect === "wrong-use") for (const frame of frames) if (frame.toys[0].use) frame.toys[0].use = "music";
    if (defect === "transient-use-loss") during.toys[0].use = "";
    if (defect === "no-arc") for (const frame of frames) if (frame.toys[0].use) frame.toys[0].y = 450;
    if (defect === "no-lateral") for (const frame of frames) if (frame.toys[0].use) frame.toys[0].x = 130;
    if (defect === "no-rotation") for (const frame of frames) frame.toys[0].rotation = 0;
    if (defect === "scroll-only") for (const frame of frames) if (frame.toys[0].use) { const scroll = Math.sin(frame.at / 300) * 120; frame.actor.y = 500 + scroll; frame.toys[0].x = 130; frame.toys[0].y = 450 + scroll; }
    if (defect === "missing-body") delete (during as Partial<NativeBallUseFrame>).actor;
    if (defect === "invalid-body") during.actor.y = Number.NaN;
    if (defect === "duplicate-id") during.toys = [...during.toys, { ...during.toys[0] }];
    if (defect === "hidden-body") during.decoded = false;
    if (defect === "hidden-toy") during.toys[0].visible = false;
    if (defect === "undecoded-toy") during.toys[0].decoded = false;
    if (defect === "held") during.toys[0].held = true;
    if (defect === "wrong-pose") during.pose = companionSpriteMetadata.rows[31][0];
    if (defect === "frozen-poses") for (const frame of frames) if (frame.toys[0].use) frame.pose = companionSpriteMetadata.rows[(frame.at - 1200) / 2600 < .13 ? 1 : 9][0];
    if (defect === "no-first-row") for (const frame of frames) if (frame.toys[0].use) frame.pose = companionSpriteMetadata.rows[9][0];
    if (defect === "short-first-row") for (const frame of frames) if (frame.at >= 1240 && frame.toys[0].use) frame.pose = companionSpriteMetadata.rows[9][0];
    if (defect === "reverse-rows") during.pose = companionSpriteMetadata.rows[1][0];
    if (defect === "short-use") for (const frame of frames) if (frame.at > 3000 && frame.at < 3800) { frame.toys[0].use = ""; frame.state = "idle"; }
    if (defect === "overlong-use") for (const frame of frames) if (frame.at >= 1200) frame.at = 1200 + (frame.at - 1200) * 2;
    if (defect === "use-while-falling") during.toys[0].falling = true;
    if (defect === "retained-use") for (const frame of frames) if (frame.at >= 3800) frame.toys[0].use = "ball-toss";
    if (defect === "no-release") for (const frame of frames) if (frame.at >= 3800) { frame.toys[0].carried = true; frame.toys[0].falling = false; }
    if (defect === "early-release") for (const frame of frames) if (frame.at >= 3000 && frame.at < 3800) { frame.toys[0].use = ""; frame.toys[0].carried = false; frame.toys[0].falling = true; }
    if (defect === "no-flight") for (const frame of frames) frame.toys[0].falling = false;
    if (defect === "one-flight-frame") for (const frame of frames) if (frame.at > 3800) frame.toys[0].falling = false;
    if (defect === "frozen-flight") for (const frame of frames) if (frame.toys[0].falling) { frame.toys[0].x = 130; frame.toys[0].y = 450; }
    if (defect === "never-rested") for (const frame of frames) if (frame.at >= 3800) frame.toys[0].falling = true;
    if (defect === "moving-rest") for (const frame of frames) if (frame.at >= 4200) frame.toys[0].x = 170 + (frame.at - 4200) / 10;
    if (defect === "missing-after-release") for (const frame of frames) if (frame.at >= 3800) frame.toys = [];
    if (defect === "recarried") frames.find(frame => frame.at === 4000)!.toys[0].carried = true;
    if (defect === "no-idle-end") for (const frame of frames) if (frame.at >= 3800) frame.state = "play";
    if (defect === "tidy-owner") for (const frame of frames) frame.toyAction = "tidy";
    if (defect === "observation-gap") frames = frames.filter(frame => frame.at < 2200 || frame.at > 2480);
    if (defect === "invalid-time") frames[8].at = Number.NaN;
    if (defect === "duplicate-time") frames[8].at = frames[7].at;
    if (defect === "invalid-rotation") during.toys[0].rotation = Number.POSITIVE_INFINITY;
    if (defect === "out-of-range-rotation") during.toys[0].rotation = 100000;
    if (defect === "reverse-sequence") frames = frames.map((frame, index, all) => ({ ...all[all.length - 1 - index], at: frame.at }));
    expect(observe(frames)).toBeUndefined();
  });
});
