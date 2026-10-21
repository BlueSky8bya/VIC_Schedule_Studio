/** A finite pose's authored clock starts when its first actual texture can
 * be adopted. The old decoded body may stay visible while that packet warms;
 * it must not silently spend the new gesture's onset or earn completion.
 * Call only on the existing foreground tick, never from a decode callback.
 */
export type CompanionPlayPresentation = { started: boolean; waited: number };
export const COMPANION_PLAY_PRESENTATION_WAIT_MS = 1200;

export function advanceCompanionPlayPresentation(input: {
  now: number; began: number; delta: number;
  presentation: CompanionPlayPresentation; usable: boolean;
}): { began: number; presentation: CompanionPlayPresentation; expired: boolean } {
  const { now, began, delta, presentation, usable } = input;
  if (presentation.started) return { began, presentation, expired: false };
  // A delayed preceding tick may launch this action now. Count only elapsed
  // time this action owns, and do not turn suspended wall time into a wait.
  const elapsed = Math.max(0, Math.min(delta, now - began));
  const waited = presentation.waited + elapsed;
  if (usable) return { began: now, presentation: { started: true, waited }, expired: false };
  return { began: began + elapsed, presentation: { started: false, waited }, expired: waited >= COMPANION_PLAY_PRESENTATION_WAIT_MS };
}
