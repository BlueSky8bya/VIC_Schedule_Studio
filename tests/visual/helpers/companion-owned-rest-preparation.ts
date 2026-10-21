/** Read-only observer for the149 physical lamp errand inside an authored
 * S03 rest tail. It joins one same-serial owner only; it certifies neither
 * a sleep pose nor elapsed rest. The original pose/duration tests still do. */
export type OwnedRestPreparationFrame = {
  at: number; state: string; scene: string; serial: string; beat: string;
  x: number; y: number; platform: string; visible: boolean; decoded: boolean;
  tv: string; lit: boolean; activity: { source: boolean; manual: boolean };
  homeLife?: { phase: string; scene: string; serial: string; beat: string; reaching: string; lampTouch: boolean };
  homeSofa?: { left: number; right: number; top: number; visible: boolean };
};
const painted = (frame: OwnedRestPreparationFrame) => frame.visible && frame.decoded && frame.activity.source && !frame.activity.manual;
const serial = (value: string) => /^[1-9]\d*$/.test(value);

/** Returned indices may bridge a generic-attempt boundary only. Required
 * S03 return/cozy/sleep and the subsequent real action remain independent. */
export function ownedRestPreparationIndices(trace: readonly OwnedRestPreparationFrame[], recipe: string): ReadonlySet<number> {
  const accepted = new Set<number>();
  if (recipe !== "S03") return accepted;
  for (let first = 1; first < trace.length - 1; first++) {
    const head = trace[first], owner = head.homeLife;
    if (head.scene || owner?.scene !== recipe || !serial(owner.serial) || !["2", "3"].includes(owner.beat)
      || !["awake", "nap", "sleep"].includes(owner.phase)) continue;
    if (first > 0 && trace[first - 1].homeLife?.serial === owner.serial && trace[first - 1].homeLife?.beat === owner.beat) continue;
    const before = trace[first - 1];
    if (before.scene !== recipe || before.serial !== owner.serial || Number(before.beat) !== Number(owner.beat) - 1
      || before.platform !== "companion-home" || !painted(before)) continue;
    let after = first;
    for (; after < trace.length; after++) {
      const frame = trace[after], value = frame.homeLife;
      if (frame.scene || value?.scene !== recipe || value.serial !== owner.serial || value.beat !== owner.beat || value.phase !== owner.phase) break;
    }
    const resumed = trace[after];
    if (!resumed || resumed.scene !== recipe || resumed.serial !== owner.serial || resumed.beat !== owner.beat
      || resumed.platform !== "companion-home" || !painted(resumed)
      || resumed.at - head.at > 30_000 || resumed.at <= head.at
      || Math.hypot(resumed.x-before.x, resumed.y-before.y) > 2) continue;
    const sofa = resumed.homeSofa;
    if (!sofa?.visible || ![sofa.left, sofa.right, sofa.top].every(Number.isFinite) || sofa.right <= sofa.left
      || resumed.x < sofa.left || resumed.x > sofa.right || Math.abs(resumed.y-sofa.top) > 3) continue;
    const segment = trace.slice(first, after);
    if (segment.some((frame, index) => !Number.isFinite(frame.at) || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)
      || frame.activity.manual || frame.tv !== before.tv || index > 0 && (frame.at <= segment[index-1].at || frame.at-segment[index-1].at > 160))) continue;
    const travel = segment.filter(frame => painted(frame) && ["walk", "jump"].includes(frame.state));
    if (!travel.some(frame => travel.some(other => Math.hypot(frame.x-other.x, frame.y-other.y) >= 24))) continue;
    const requiredLight = owner.phase === "awake";
    let changedAt = -1;
    for (let index = 0; index < segment.length; index++) {
      const frame = segment[index], previous = index ? segment[index-1] : before;
      if (frame.lit === previous.lit) continue;
      if (changedAt >= 0 || frame.lit !== requiredLight) { changedAt = -2; break; }
      const contact = segment.slice(Math.max(0, index-3), index+1).some(value => frame.at-value.at <= 200 && painted(value)
        && value.state === "play" && /^companion-home-floor(?:-\d+)?$/.test(value.platform)
        && value.homeLife?.reaching === "light" && value.homeLife.lampTouch);
      if (!contact) { changedAt = -2; break; }
      changedAt = index;
    }
    if (changedAt < 0 || resumed.lit !== requiredLight || segment.at(-1)?.lit !== requiredLight) continue;
    for (let index = first; index < after; index++) accepted.add(index);
    first = after;
  }
  return accepted;
}
