import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { completedNativeToyReplay, type NativeToyReplayFrame } from "../visual/helpers/companion-toy-replay";

const target = "actual-ball", after = 1000;
function positive(): NativeToyReplayFrame[] {
  const frames: NativeToyReplayFrame[] = [], timing = COMPANION_PLAY_TIMING.pounce;
  for (let at = 1000; at <= 2400; at += 50) {
    const elapsed = at - 1200, played = elapsed >= 0 && elapsed <= 1100;
    const row = played && elapsed / 1100 * timing.duration < timing.beats[0].duration ? 31 : 23;
    const poses = companionSpriteMetadata.rows[row], pose = played ? poses[Math.min(poses.length - 1, Math.floor(Math.max(0, elapsed) / 100))] : 0;
    const carried = at >= 1100 && at < 1750, falling = at >= 1750 && at < 2150;
    frames.push({ at, state: played ? "play" : at < 1200 ? "sniff" : "idle", pose, decoded: true, toyAction: "play",
      toys: [{ id: target, kind: "ball", carried, held: false, falling, visible: true, decoded: true, x: falling ? 200 + (at - 1750) / 20 : at < 1750 ? 200 : 220, y: falling ? 550 - Math.sin((at - 1750) / 400 * Math.PI) * 20 : 550 }] });
  }
  return frames;
}
const observe = (frames: NativeToyReplayFrame[], id = target, cutoff = after) => completedNativeToyReplay(frames, id, cutoff, "pounce");

describe("142 second native toy play uses physical order and actual playback", () => {
  it("accepts a new same-ID pickup, changing mapped1100ms play, mid-play release, flight, settled rest and real action end", () => {
    expect(observe(positive())).toMatchObject({ pickedAt: 1100, playedAt: 1200, releasedAt: 1750, settledAt: 2150, endedAt: 2350, paintedMs: 1100 });
  });
  it("does not count the single play which already finished before the discovery boundary", () => {
    expect(observe(positive(), target, 2400)).toBeUndefined();
  });
  it("does not call a play already carried before the first discovery a new same-ID pickup", () => {
    expect(observe(positive(), target, 1650)).toBeUndefined();
  });
  it.each(["no-release", "no-flight", "no-motion", "never-settled", "held", "missing", "different-ID", "hidden", "toy-hidden", "toy-undecoded", "short-play", "short-mapped-play", "short-first-beat", "short-recover-beat", "interrupted-play", "reverse-order", "reverse-poses", "tidy-carry", "wrong-pose", "frozen-pose", "observation-gap", "invalid-time"] as const)("rejects %s instead of manufacturing a completed repeat", defect => {
    let frames = positive();
    if (defect === "no-release") for (const frame of frames) if (frame.at >= 1100) Object.assign(frame.toys[0], { carried: true, falling: false });
    if (defect === "no-flight") for (const frame of frames) frame.toys[0].falling = false;
    if (defect === "no-motion") for (const frame of frames) Object.assign(frame.toys[0], { x: 200, y: 550 });
    if (defect === "never-settled") for (const frame of frames) if (frame.at >= 1750) frame.toys[0].falling = true;
    if (defect === "held") for (const frame of frames) frame.toys[0].held = true;
    if (defect === "missing") for (const frame of frames) if (frame.at >= 1750) frame.toys = [];
    if (defect === "different-ID") for (const frame of frames) frame.toys[0].id = "another-real-ball";
    if (defect === "hidden") frames.find(frame => frame.at === 1600)!.decoded = false;
    if (defect === "toy-hidden") frames.find(frame => frame.at === 1600)!.toys[0].visible = false;
    if (defect === "toy-undecoded") frames.find(frame => frame.at === 1600)!.toys[0].decoded = false;
    if (defect === "short-play") for (const frame of frames) if (frame.at > 1600) { frame.state = "idle"; frame.pose = 0; }
    if (defect === "short-mapped-play") for (const frame of frames) if (frame.at >= 1200 && frame.at < 1350) { frame.state = "idle"; frame.pose = 0; }
    if (defect === "short-first-beat") for (const frame of frames) if (frame.state === "play" && frame.at >= 1250) frame.pose = companionSpriteMetadata.rows[23][0];
    if (defect === "short-recover-beat") for (const frame of frames) if (frame.state === "play") frame.pose = companionSpriteMetadata.rows[frame.at < 2300 ? 31 : 23][0];
    if (defect === "interrupted-play") { const frame = frames.find(frame => frame.at === 1600)!; frame.state = "idle"; frame.pose = 0; }
    if (defect === "reverse-order") frames = frames.map((frame, i, all) => ({ ...all[all.length - 1 - i], at: frame.at }));
    if (defect === "reverse-poses") frames.find(frame => frame.at === 1600)!.pose = companionSpriteMetadata.rows[23][0];
    if (defect === "tidy-carry") for (const frame of frames) frame.toyAction = "tidy";
    if (defect === "wrong-pose") for (const frame of frames) frame.pose = companionSpriteMetadata.rows[16][0];
    if (defect === "frozen-pose") for (const frame of frames) frame.pose = companionSpriteMetadata.rows[31][0];
    if (defect === "observation-gap") frames = frames.filter(frame => frame.at < 1500 || frame.at > 2000);
    if (defect === "invalid-time") frames[8].at = Number.NaN;
    expect(observe(frames)).toBeUndefined();
  });
});
