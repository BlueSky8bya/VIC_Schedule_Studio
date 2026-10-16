/** Cosmetic card mischief never changes event data or the FLIP transform.
 * One native animation, finite lifetime, no observers or recurring timers. */
export const COMPANION_CARD_PLAY_EVENT = "vic:companion-card-play";
export function createCompanionCardPlay() {
  let active: { node: HTMLElement; animation: Animation; timer?: ReturnType<typeof setTimeout> } | undefined;
  const moved = () => window.dispatchEvent(new Event(COMPANION_CARD_PLAY_EVENT));
  const clear = () => {
    if (!active) return;
    const current = active; active = undefined;
    clearTimeout(current.timer); current.node.removeAttribute("data-vc-ruffled"); current.animation.cancel();
  };
  const restore = () => {
    if (!active) return;
    const node = active.node, rotation = getComputedStyle(node).rotate;
    clear();
    const animation = node.animate([{ rotate: rotation }, { rotate: "0deg" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
    active = { node, animation };
    animation.onfinish = () => { if (active?.animation === animation) clear(); };
    moved();
  };
  return {
    bump(node: HTMLElement, direction: number) {
      clear();
      const rotation = `${direction < 0 ? -2.2 : 2.2}deg`;
      // Individual rotate composes with the calendar's existing transform.
      const animation = node.animate([{ rotate: "0deg" }, { rotate: rotation }], { duration: 220, fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)" });
      active = { node, animation, timer: setTimeout(restore, 6500) }; node.dataset.vcRuffled = "";
      // Only the two220ms motion windows wake existing anchor followers.
      // The intervening held angle needs no geometry polling/extra rAF.
      moved();
    },
    restore(target: EventTarget | null) {
      if (!active || active.node.dataset.vcRuffled === undefined || !(target instanceof Node) || !active.node.contains(target)) return false;
      // The same click still opens/edits the event. Recovery yields its world
      // geometry immediately and only eases the decorative angle to neutral.
      restore();
      return true;
    },
    clear,
  };
}
