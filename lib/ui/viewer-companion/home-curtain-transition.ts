import type { CompanionHomeCurtain } from "./home-curtain";

export const COMPANION_CURTAIN_STAGES = [0, 1, 2, 3, 4] as const;
export type CompanionCurtainStage = typeof COMPANION_CURTAIN_STAGES[number];
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(4, value)) : 0;

/** The actual rest/sun reducer still owns meaning; artwork only quantizes its
 * existing open, personality shade and fully closed presentation. */
export function companionCurtainStage(curtain: Pick<CompanionHomeCurtain, "phase" | "panelScale">): CompanionCurtainStage {
  if (curtain.phase === "closed") return 4;
  if (curtain.phase !== "shade") return 0;
  return !Number.isFinite(curtain.panelScale) || curtain.panelScale <= .22 ? 1 : curtain.panelScale < .35 ? 2 : 3;
}

export function companionCurtainWeights(position: number): number[] {
  const at = clamp(position);
  return COMPANION_CURTAIN_STAGES.map(stage => Math.max(0, 1 - Math.abs(stage - at)));
}

/** At most five finite stops. Every intermediate picture is an adjacent
 * generated stage, including a fractional blend left by an interrupted move. */
export function companionCurtainStops(from: number, to: CompanionCurtainStage) {
  const start = clamp(from), end = clamp(to), distance = Math.abs(end - start), direction = Math.sign(end - start);
  const positions = [start];
  if (direction) {
    for (let at = direction > 0 ? Math.floor(start) + 1 : Math.ceil(start) - 1; direction > 0 ? at < end : at > end; at += direction) positions.push(at);
    positions.push(end);
  }
  return { distance, stops: positions.map(position => ({ position, offset: distance ? Math.abs(position - start) / distance : 0, weights: companionCurtainWeights(position) })) };
}

type CurtainAnimation = Pick<Animation, "onfinish" | "cancel">;
export type CompanionCurtainLayer = {
  opacity: (value: number) => void;
  readOpacity: () => number;
  animate?: (frames: Keyframe[], options: KeyframeAnimationOptions) => CurtainAnimation;
};

/** Event/semantic-boundary controller, never an animation loop. On reversal
 * the browser's current five opacities supply the exact visible blend. */
export function createCompanionCurtainTransition(layers: readonly CompanionCurtainLayer[], initialStage: CompanionCurtainStage = 0) {
  let position: number = initialStage, disposed = false;
  let flight: { target: CompanionCurtainStage; animations: CurtainAnimation[] } | undefined;
  const paint = (at: number) => companionCurtainWeights(at).forEach((opacity, index) => layers[index]?.opacity(opacity));
  const current = () => {
    if (!flight) return position;
    const weights = layers.map(layer => { const value = layer.readOpacity(); return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; });
    const total = weights.reduce((sum, value) => sum + value, 0);
    return total > 0 ? clamp(weights.reduce((sum, value, index) => sum + value * index, 0) / total) : position;
  };
  const cancel = () => {
    const previous = flight; flight = undefined;
    for (const animation of previous?.animations ?? []) { animation.onfinish = null; animation.cancel(); }
  };
  paint(position);
  return {
    update(target: CompanionCurtainStage, animate: boolean, options: { stepMs: number; easing: string }) {
      if (disposed) return;
      if (!animate) { cancel(); position = target; paint(target); return; }
      if (flight?.target === target || !flight && position === target) return;
      const from = current(); cancel(); position = from;
      const plan = companionCurtainStops(from, target);
      // The final inline picture survives completion/cancellation; WAAPI owns
      // only this finite blend, with no retained fill animation afterwards.
      paint(target);
      if (plan.distance < .001 || layers.length !== 5 || layers.some(layer => !layer.animate)) { position = target; return; }
      const next = { target, animations: [] as CurtainAnimation[] }; flight = next;
      try {
        const step = Number.isFinite(options.stepMs) ? Math.max(80, Math.min(500, options.stepMs)) : 180;
        layers.forEach((layer, index) => next.animations.push(layer.animate!(plan.stops.map(stop => ({ offset: stop.offset, opacity: stop.weights[index], easing: options.easing })), { duration: plan.distance * step, easing: "linear", fill: "both", iterations: 1 })));
        next.animations[0].onfinish = () => { if (flight !== next) return; position = target; cancel(); paint(target); };
      } catch { cancel(); position = target; paint(target); }
    },
    dispose() { disposed = true; cancel(); },
  };
}
