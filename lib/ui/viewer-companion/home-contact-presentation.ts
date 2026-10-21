/** Calibrated furniture contacts keep their finite authored duration, but
 * suspended wall time cannot spend a cord's whole visible touch phase. */
export const COMPANION_HOME_CONTACT_FRAME_MS = 80;
export const COMPANION_HOME_CONTACT_OVERRUN_MS = 2500;
export const COMPANION_HOME_CONTACT_RECEIPT_MS = 650;

export function advanceCompanionHomeContactPresentation(input: {
  now: number; began: number; startedAt: number; delta: number; duration: number; active: boolean;
}) {
  const { now, began, startedAt, delta, duration, active } = input;
  if (!active) return { began, expired: false, cancelled: true };
  if (![now,began,startedAt,delta,duration].every(Number.isFinite) || duration <= 0 || delta < 0
    || now < startedAt || now < began || now-startedAt > duration+COMPANION_HOME_CONTACT_OVERRUN_MS)
    return { began, expired: true, cancelled: false };
  const owned = Math.max(0,Math.min(delta,now-began));
  return { began: began+owned-Math.min(COMPANION_HOME_CONTACT_FRAME_MS,owned), expired: false, cancelled: false };
}

export type CompanionLampPaintSample = {
  at: number; serial: number; active: boolean; bodyTouch: boolean;
  visible: boolean; sourceMatches: boolean; samePlane: boolean;
  requestedPull: number; height: number; width: number; cssWidth: number; buttonHeight: number;
  feedbackVisible: boolean; feedbackOpacity: number;
};
type Neutral = Pick<CompanionLampPaintSample,"at"|"height"|"width"|"cssWidth"|"buttonHeight">;
export type CompanionLampPresentation = { serial: number; lastAt?: number; neutral?: Neutral; baseline?: Neutral; receiptAt?: number };
const close = (a: number,b: number) => Math.abs(a-b) <= .05;
const normalizedHeight = (sample: Neutral) => sample.height*sample.cssWidth/sample.width;
const normalizedButton = (sample: Neutral) => sample.buttonHeight*sample.cssWidth/sample.width;
const sameSize = (a: Neutral,b: Neutral) => close(a.cssWidth,b.cssWidth) && close(normalizedButton(a),normalizedButton(b));

/** A requested attribute is not a visible tug. The caller supplies measured
 * paint from its existing foreground paint; no callback or timer earns ACK. */
export function observeCompanionLampPresentation(previous: CompanionLampPresentation | undefined, sample: CompanionLampPaintSample): CompanionLampPresentation {
  const empty: CompanionLampPresentation = { serial: sample.serial, lastAt: sample.at };
  if (!sample.active || !sample.visible || !sample.sourceMatches || !sample.samePlane
    || ![sample.at,sample.serial,sample.height,sample.width,sample.cssWidth,sample.buttonHeight,sample.requestedPull,sample.feedbackOpacity].every(Number.isFinite)
    || Math.min(sample.height,sample.width,sample.cssWidth,sample.buttonHeight) <= 0) return empty;
  const state = previous?.serial === sample.serial ? previous : empty;
  if (previous?.serial === sample.serial && state.lastAt !== undefined && sample.at <= state.lastAt) return empty;
  if (!sample.bodyTouch && sample.requestedPull === 0) {
    const baseline = state.neutral && sample.at-state.neutral.at >= 8 && sample.at-state.neutral.at <= 250
      && sameSize(state.neutral,sample) && close(normalizedHeight(state.neutral),normalizedHeight(sample)) ? sample : undefined;
    const compatible = !state.baseline || sameSize(state.baseline,sample);
    return { serial: sample.serial, lastAt: sample.at, neutral: sample, baseline: baseline ?? (compatible ? state.baseline : undefined),
      receiptAt: compatible ? state.receiptAt : undefined };
  }
  if (!state.baseline || !sameSize(state.baseline,sample)) return { serial: sample.serial, lastAt: sample.at, neutral: state.neutral };
  const pull = normalizedHeight(sample)-normalizedHeight(state.baseline);
  const actual = sample.bodyTouch && Math.abs(sample.requestedPull-3) <= .01 && sample.feedbackVisible && sample.feedbackOpacity > .05 && pull >= 1 && pull <= 3.25;
  return { ...state, lastAt: sample.at, receiptAt: actual ? sample.at : state.receiptAt };
}

export function companionLampPresentationReady(state: CompanionLampPresentation | undefined, serial: number, at: number, active: boolean) {
  return Boolean(active && state?.serial === serial && state.receiptAt !== undefined && Number.isFinite(at)
    && at > state.receiptAt && at-state.receiptAt <= COMPANION_HOME_CONTACT_RECEIPT_MS);
}
