import { describe, expect, it } from "vitest";
import { matchCompanionExplorationWitness, type ExplorationInputAttempt, type ExplorationWitnessFrame } from "../visual/helpers/companion-exploration-witness";

function fixture() {
  const frame = (at: number, patch: Partial<ExplorationWitnessFrame> = {}): ExplorationWitnessFrame => ({ at, x: 200, y: 500,
    scene: "C10", serial: "8", beat: "2", platform: "real-calendar-date", command: "go", state: "jump", visible: true, decoded: true,
    paintedSource: { passed: true }, jumpSource: true, sceneGoal: { x: 500, y: 620, platformId: "unfinished-original-goal" }, ...patch });
  const attempts: ExplorationInputAttempt[] = [
    { attempt: 0, toyId: "toy-1", ownerAtRelease: { id: "D157-C", serial: "4", beat: "3" }, releasedAfterAt: 10 },
    { attempt: 1, toyId: "toy-2", ownerAtRelease: { id: "C10", serial: "8", beat: "2" }, releasedAfterAt: 45 },
  ];
  const interest = { scene: "curious-interest", serial: "9", beat: "0", command: "toy", sceneItemId: "toy-1", jumpSource: false };
  const frames = [frame(10, { scene: "D157-C", serial: "4", beat: "3" }), frame(40), frame(49, { state: "idle", jumpSource: false }),
    frame(50, { ...interest, state: "walk", walkSource: true }),
    ...Array.from({ length: 5 }, (_, index) => frame(51 + index, { ...interest, state: "sniff",
      toyPlay: { toys: [{ id: "toy-1", visible: true, decoded: true, held: false, falling: false, carried: false, rect: { x: 190, y: 483, width: 20, height: 20 } }] } })), frame(56)];
  return { frames, attempts };
}

describe("actual exploration interest belongs to its original native object input", () => {
  it("matches toy-1 during attempt2 and resumes the actual interrupted owner instead of its older release owner", () => {
    const { frames, attempts } = fixture(), result = matchCompanionExplorationWitness(frames, attempts)!;
    expect(result).toMatchObject({ toyId: "toy-1", inputAttempt: 0, ownerAtRelease: attempts[0].ownerAtRelease,
      owner: { id: "C10", serial: "8", beat: "2" }, interestSerial: "9", inspectFrames: 5, firstInspectAt: 51, lastInspectAt: 55, resumedAt: 56 });
    expect(JSON.stringify({ frames, attempts })).toBe(JSON.stringify(fixture()));
  });

  it.each(["wrong-object", "wrong-source", "hidden", "undecoded", "held", "falling", "carried", "toy-undecoded", "distant-object", "four-only", "wrong-resume-owner", "wrong-resume-beat", "planned-resume", "no-prior-motion", "late-resume", "pre-release", "ambiguous-input", "already-arrived", "missing-reserved-goal", "nonfinite-reserved-goal", "changed-goal", "changed-goal-platform"] as const)("rejects%s without weakening inspection or resume gates", defect => {
    const { frames, attempts } = fixture();
    const inspect = frames.filter(frame => frame.state === "sniff"), resumed = frames.at(-1)!;
    if (defect === "wrong-object") for (const frame of inspect) frame.sceneItemId = "toy-2";
    if (defect === "wrong-source") for (const frame of inspect) frame.paintedSource!.passed = false;
    if (defect === "hidden") for (const frame of inspect) frame.visible = false;
    if (defect === "undecoded") for (const frame of inspect) frame.decoded = false;
    if (defect === "held" || defect === "falling" || defect === "carried") for (const frame of inspect) frame.toyPlay!.toys[0][defect] = true;
    if (defect === "toy-undecoded") for (const frame of inspect) frame.toyPlay!.toys[0].decoded = false;
    if (defect === "distant-object") for (const frame of inspect) frame.toyPlay!.toys[0].rect!.x += 100;
    if (defect === "four-only") frames.splice(frames.indexOf(inspect[0]), 1);
    if (defect === "wrong-resume-owner") Object.assign(resumed, { scene: "D157-C", serial: "4", beat: "3" });
    if (defect === "wrong-resume-beat") resumed.beat = "3";
    if (defect === "planned-resume") resumed.jumpSource = false;
    if (defect === "no-prior-motion") frames[1].jumpSource = false;
    if (defect === "late-resume") resumed.at = 18051;
    if (defect === "pre-release") attempts[0].releasedAfterAt = 50;
    if (defect === "ambiguous-input") attempts.push({ ...attempts[0], attempt: 2 });
    if (defect === "already-arrived") frames[2].sceneGoal = { x: frames[2].x, y: frames[2].y, platformId: frames[2].platform };
    if (defect === "missing-reserved-goal") frames[2].sceneGoal = undefined;
    if (defect === "nonfinite-reserved-goal") frames[2].sceneGoal!.x = NaN;
    if (defect === "changed-goal") resumed.sceneGoal!.x += 40;
    if (defect === "changed-goal-platform") resumed.sceneGoal!.platformId = "different-place";
    expect(matchCompanionExplorationWitness(frames, attempts)).toBeUndefined();
  });
});
