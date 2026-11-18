const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const ease = (value: number) => { const p = clamp(value, 0, 1); return p * p * (3 - 2 * p); };

/** Height-relative response also admits tiny authored hops. The quiet apex
 * and contact envelope affect material only, never the actual flight clock. */
export function sampleCompanionPompom(velocityY: number, height: number, peakHeight: number): number {
  if (![velocityY, height, peakHeight].every(Number.isFinite) || height <= 0 || peakHeight <= 0) return 0;
  const speedScale = clamp(Math.sqrt(3200 * peakHeight) * .65, 30, 350);
  const speed = ease((Math.abs(velocityY) / speedScale - .18) / .82);
  const edge = ease(height / Math.min(3, peakHeight * .3));
  if (!speed || !edge) return 0;
  return (velocityY < 0 ? -.22 : .20) * speed * edge;
}

/** A finite observer on the caller's existing display clock. Explicit airborne
 * eligibility excludes held/grounded gestures and camera/layout motion. */
export function createCompanionPompomFlight() {
  let previous: { now: number; y: number; token: string | number } | undefined, peak = 0;
  let shown: number | undefined;
  const reset = () => { previous = undefined; peak = 0; shown = undefined; };
  return {
    reset,
    sample(input: { now: number; y: number; height: number; token: string | number; active: boolean; quiet?: boolean }) {
      if (!input.active || input.quiet || ![input.now, input.y, input.height].every(Number.isFinite)) { reset(); return undefined; }
      if (previous?.token !== input.token) reset();
      const elapsed = previous ? input.now - previous.now : 0;
      if (elapsed < 0 || elapsed > 150) reset();
      if (input.height <= .0001) { peak = 0; shown = undefined; }
      else if (!previous || elapsed > 0) {
        peak = Math.max(peak, input.height);
        const velocity = previous && elapsed > 0 ? (input.y - previous.y) * 1000 / elapsed : 0;
        shown = sampleCompanionPompom(velocity, input.height, peak);
      }
      previous = { now: input.now, y: input.y, token: input.token };
      return shown;
    },
  };
}

/** Grounded breath/nuzzle/retch are not hops. These authored play and impact
 * lifts really detach the body; toy/music bounces are explicitly selected. */
export function companionPompomPlayHeight(kind: string | undefined, pose?: { lift: number; beat: string }, toyUse?: string): number {
  if (!pose || !Number.isFinite(pose.lift) || !["play", "impact"].includes(pose.beat)) return 0;
  if (toyUse ? !["ball-toss", "jingle", "music"].includes(toyUse)
    : !kind || pose.beat !== "impact" && ["ask-petting", "lean-nuzzle", "cozy-nest", "doze-curl", "bonk-tears", "bonk-sad", "odd-food-reaction"].includes(kind)) return 0;
  return Math.max(0, -pose.lift);
}

/** Remap only below the protected mouth. x'=cx+(x-cx)*s(y),
 * y'=start+integral(1/s(y)) gives determinant1. Premultiplied interpolation
 * prevents dark transparent fringes. The source and upper RGBA stay intact.
 * This is fixed-depth2D area preservation, not a3D aerodynamic simulation. */
export function warpCompanionPompom(
  source: Uint8ClampedArray, width: number, height: number,
  protectedY: number, bottom: number, centerX: number, amount: number,
): Uint8ClampedArray {
  if (![width, height, protectedY, bottom, centerX, amount].every(Number.isFinite)
    || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || source.length !== width * height * 4 || Math.abs(amount) < .0001) return source;
  const start = clamp(Math.ceil(protectedY), 0, height), end = clamp(bottom, start + 1, height);
  if (start >= height || bottom <= start) return source;
  const gain = clamp(amount, -.22, .20);
  const scale = (y: number) => 1 + gain * ease((y - start) / (end - start));
  // Eight integration samples/pixel keep inverse mapping smooth at the hem.
  const step = .125, mapped = [start];
  for (let y = start; y < height; y += step)
    mapped.push(mapped[mapped.length - 1] + step * .5 * (1 / scale(y) + 1 / scale(y + step)));
  const output = new Uint8ClampedArray(source.length);
  output.set(source.subarray(0, start * width * 4));
  let interval = 0;
  for (let y = start; y < height; y++) {
    const targetY = y + .5;
    while (interval + 1 < mapped.length && mapped[interval + 1] <= targetY) interval++;
    if (interval + 1 >= mapped.length) break;
    const sy = start + (interval + (targetY - mapped[interval]) / (mapped[interval + 1] - mapped[interval])) * step - .5;
    const factor = scale(sy + .5), y0 = Math.floor(sy), fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = centerX + (x + .5 - centerX) / factor - .5, x0 = Math.floor(sx), fx = sx - x0;
      let alpha = 0, red = 0, green = 0, blue = 0;
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
        const px = x0 + ox, py = y0 + oy;
        if (px < 0 || px >= width || py < start || py >= height) continue;
        const at = (py * width + px) * 4, weight = (ox ? fx : 1 - fx) * (oy ? fy : 1 - fy), a = source[at + 3] * weight;
        alpha += a; red += source[at] * a; green += source[at + 1] * a; blue += source[at + 2] * a;
      }
      const at = (y * width + x) * 4;
      if (alpha > 0) { output[at] = red / alpha; output[at + 1] = green / alpha; output[at + 2] = blue / alpha; output[at + 3] = alpha; }
    }
  }
  return output;
}
