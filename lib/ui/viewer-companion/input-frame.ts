/** One pending display callback for the latest native input. The caller owns
 * logical coordinates; release may flush, and pause/cancel leaves no tail. */
export function createCompanionInputFrame(
  request: (callback: FrameRequestCallback) => number = callback => requestAnimationFrame(callback),
  cancelRequest: (id: number) => void = id => cancelAnimationFrame(id),
) {
  let frame: number | undefined, latest: (() => void) | undefined;
  const draw = () => { frame = undefined; const callback = latest; latest = undefined; callback?.(); };
  return {
    queue(callback: () => void) { latest = callback; if (frame === undefined) frame = request(draw); },
    flush() { if (frame !== undefined) cancelRequest(frame); draw(); },
    cancel() { if (frame !== undefined) cancelRequest(frame); frame = undefined; latest = undefined; },
  };
}
