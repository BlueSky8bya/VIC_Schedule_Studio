export type ExplorationOwner = { id: string; serial: string; beat: string };
export type ExplorationInputAttempt = {
  attempt: number; toyId: string; ownerAtRelease: ExplorationOwner; releasedAfterAt: number;
};
export type ExplorationWitnessFrame = {
  at: number; x: number; y: number; scene: string; serial: string; beat: string; platform: string; command?: string; state: string;
  visible: boolean; decoded: boolean; walkSource?: boolean; jumpSource?: boolean; sceneItemId?: string;
  paintedSource?: { passed: boolean }; toyPlay?: { toys: readonly { id: string; visible: boolean; decoded: boolean; held: boolean; falling: boolean; carried: boolean; rect?: { x: number; y: number; width: number; height: number } | null }[] };
  sceneGoal?: { x: number; y: number; platformId: string };
};
const publicExplorations = new Set(["D143-C", "C05", "C10", "D157-C"]);
const sameOwner = (frame: ExplorationWitnessFrame, owner: ExplorationOwner) => frame.scene === owner.id && frame.serial === owner.serial && frame.beat === owner.beat;
const painted = (frame: ExplorationWitnessFrame) => frame.visible && frame.decoded && frame.paintedSource?.passed;
export function companionInterestInspection(frame: ExplorationWitnessFrame, toyId: string, interestSerial: string) {
  const toy = frame.toyPlay?.toys.find(toy => toy.id === toyId), rect = toy?.rect;
  return frame.scene === "curious-interest" && frame.serial === interestSerial && frame.sceneItemId === toyId && painted(frame)
    && frame.command === "toy" && frame.state === "sniff" && toy?.visible && toy.decoded
    && toy.held === false && toy.falling === false && toy.carried === false && rect
    && Math.hypot(rect.x + rect.width / 2 - frame.x, rect.y + rect.height - frame.y) <= 56;
}

/** Attribute an observed detour to its actual introduced object, even when a
 * later native input attempt is in progress. The interrupted owner is the
 * immediately preceding live exploration, not the owner at object release. */
export function matchCompanionExplorationWitness(frames: readonly ExplorationWitnessFrame[], attempts: readonly ExplorationInputAttempt[]) {
  for (let index = 1; index < frames.length; index++) {
    const first = frames[index], previous = frames[index - 1];
    if (first.scene !== "curious-interest" || previous.scene === "curious-interest" || !first.sceneItemId || !first.serial || first.command !== "toy") continue;
    const matches = attempts.filter(attempt => attempt.toyId === first.sceneItemId && Number.isFinite(attempt.releasedAfterAt) && first.at > attempt.releasedAfterAt);
    if (matches.length !== 1 || !publicExplorations.has(previous.scene) || previous.command !== "go" || !previous.serial || !previous.beat
      || !previous.platform || /^companion-home/.test(previous.platform)) continue;
    const goal = previous.sceneGoal;
    if (!goal || ![goal.x, goal.y].every(Number.isFinite) || !goal.platformId
      || previous.platform === goal.platformId && Math.hypot(previous.x-goal.x, previous.y-goal.y) < 24) continue;
    const owner = { id: previous.scene, serial: previous.serial, beat: previous.beat }, input = matches[0];
    if (!frames.slice(0, index).some(frame => sameOwner(frame, owner) && painted(frame) && (frame.walkSource || frame.jumpSource))) continue;
    const inspect = frames.slice(index).filter(frame => companionInterestInspection(frame, input.toyId, first.serial));
    if (inspect.length <= 4) continue;
    const last = inspect.at(-1)!;
    const resumed = frames.find(frame => frame.at > last.at && frame.at - first.at <= 18000 && sameOwner(frame, owner) && painted(frame) && (frame.walkSource || frame.jumpSource)
      && frame.sceneGoal?.platformId === goal.platformId && Math.abs(frame.sceneGoal.x-goal.x) < .01 && Math.abs(frame.sceneGoal.y-goal.y) < .01);
    if (!resumed) continue;
    return { owner, toyId: input.toyId, inputAttempt: input.attempt, ownerAtRelease: input.ownerAtRelease,
      releasedAfterAt: input.releasedAfterAt, interestSerial: first.serial, firstInterestAt: first.at, goal,
      firstInspectAt: inspect[0].at, lastInspectAt: last.at, inspectFrames: inspect.length, resumedAt: resumed.at };
  }
}
