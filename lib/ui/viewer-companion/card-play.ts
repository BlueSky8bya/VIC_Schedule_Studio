/** Cosmetic card mischief never changes event data or the FLIP transform.
 * One native animation per piece, finite lifetime, no observers or recurring timers.
 * A linked run (chainTiltGroup) tilts as one rigid piece: every piece turns by the same
 * smaller angle about one shared pivot. The pivot is expressed as rotate + translate on
 * each piece (never by overriding transform-origin), so other transforms keep their origin. */
export const COMPANION_CARD_PLAY_EVENT = "vic:companion-card-play";
/** arms[i] = shared pivot minus piece i's own transform-origin, in the piece's local px. */
export type CardTiltGroup = { parts: HTMLElement[]; arms: { x: number; y: number }[]; scale: number };
type Arm = { x: number; y: number };
type Piece = { node: HTMLElement; animation: Animation; arm?: Arm };

/** Translation that turns a rotation about the element's own origin into one about the pivot. */
export function pivotShift(arm: Arm, degrees: number): Arm {
  const t = (degrees * Math.PI) / 180;
  return { x: arm.x - (arm.x * Math.cos(t) - arm.y * Math.sin(t)), y: arm.y - (arm.x * Math.sin(t) + arm.y * Math.cos(t)) };
}

export function createCompanionCardPlay() {
  let active: { node: HTMLElement; pieces: Piece[]; degrees: number; timer?: ReturnType<typeof setTimeout> } | undefined;
  const moved = () => window.dispatchEvent(new Event(COMPANION_CARD_PLAY_EVENT));
  const frame = (degrees: number, arm?: Arm): Keyframe => {
    if (!arm) return { rotate: `${degrees}deg` };
    const d = pivotShift(arm, degrees);
    return { rotate: `${degrees}deg`, translate: `${d.x.toFixed(2)}px ${d.y.toFixed(2)}px` };
  };
  const clear = () => {
    if (!active) return;
    const current = active; active = undefined;
    clearTimeout(current.timer); current.node.removeAttribute("data-vc-ruffled");
    for (const piece of current.pieces) piece.animation.cancel();
  };
  const restore = () => {
    if (!active) return;
    const node = active.node, grouped = active.pieces.some(piece => piece.arm);
    // A single card reads its live angle (as before); a group restores from its held angle.
    const rotation = grouped ? `${active.degrees}deg` : getComputedStyle(node).rotate;
    const held = active.degrees;
    const pieces = active.pieces.map(piece => ({ node: piece.node, arm: piece.arm }));
    clear();
    const next = pieces.map(({ node: el, arm }) => ({
      node: el, arm,
      animation: el.animate(arm ? [frame(held, arm), frame(0, arm)] : [{ rotate: rotation }, { rotate: "0deg" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" })
    }));
    active = { node, pieces: next, degrees: 0 };
    const lead = next[0].animation;
    lead.onfinish = () => { if (active?.pieces[0]?.animation === lead) clear(); };
    moved();
  };
  return {
    /** measure runs after any running tilt is cleared, so the pivot comes from upright rects. */
    bump(node: HTMLElement, direction: number, measure?: () => CardTiltGroup | null) {
      clear();
      const group = measure?.() ?? null;
      const degrees = (direction < 0 ? -2.2 : 2.2) * (group ? group.scale : 1);
      const targets: { el: HTMLElement; arm?: Arm }[] = group
        ? group.parts.map((el, i) => ({ el, arm: group.arms[i] }))
        : [{ el: node }];
      // Individual rotate/translate compose with the calendar's existing transform.
      const pieces = targets.map(({ el, arm }) => ({
        node: el, arm,
        animation: el.animate([frame(0, arm), frame(degrees, arm)], { duration: 220, fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)" })
      }));
      active = { node, pieces, degrees, timer: setTimeout(restore, 6500) }; node.dataset.vcRuffled = "";
      // Only the two220ms motion windows wake existing anchor followers.
      // The intervening held angle needs no geometry polling/extra rAF.
      moved();
    },
    restore(target: EventTarget | null) {
      if (!active || active.node.dataset.vcRuffled === undefined || !(target instanceof Node) || !active.pieces.some(piece => piece.node.contains(target))) return false;
      // The same click still opens/edits the event. Recovery yields its world
      // geometry immediately and only eases the decorative angle to neutral.
      restore();
      return true;
    },
    clear,
  };
}
