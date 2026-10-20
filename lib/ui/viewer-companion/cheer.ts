/** The limbless pompom body is the cheer: finite little hops, no held props.
 * Fourth-power pulses meet each landing at zero speed and acceleration.
 * World support, original face/wardrobe and clock keep their existing owner. */
export type CompanionCheerPose = Readonly<{
  lift: number;
  lean: number;
  compression: number;
  hop: number;
  airborne: boolean;
}>;

const unit = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = unit(value); return p * p * p * (p * (p * 6 - 15) + 10); };
const pulse = (p: number, from: number, to: number) => p > from && p < to ? Math.sin((p - from) / (to - from) * Math.PI) ** 4 : 0;
const hops = [[.12, .25, 15], [.27, .40, 18], [.42, .55, 16], [.57, .70, 20], [.72, .89, 24]] as const;

export function sampleCompanionCheer(progress: number): CompanionCheerPose {
  if (!Number.isFinite(progress) || progress <= 0 || progress >= 1) return { lift: 0, lean: 0, compression: 0, hop: 0, airborne: false };
  const p = progress;
  let lift = 0, lean = 0, compression = .055 * pulse(p, .015, .12), hop = 0;
  for (let index = 0; index < hops.length; index++) {
    const [start, end, height] = hops[index], amount = pulse(p, start, end), phase = (p - start) / (end - start);
    lift -= height * amount;
    lean += (index % 2 ? -1 : 1) * 6 * amount * Math.cos(phase * Math.PI);
    compression -= .025 * amount;
    compression += .055 * pulse(p, end - .012, Math.min(.995, end + .045));
    if (amount > .12) hop = index + 1;
  }
  const settle = ease((p - .90) / .085);
  lean += .9 * Math.sin(settle * Math.PI * 2) * Math.sin(settle * Math.PI) ** 2;
  return { lift, lean, compression, hop, airborne: lift < -3 };
}
