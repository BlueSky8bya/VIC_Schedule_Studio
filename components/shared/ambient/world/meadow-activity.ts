import { horizonY } from './view';

/** Shared perspective for meadow life, reaching the foot of the distant ridge. */
export const meadowActivityTop = (h: number) => horizonY(h) + 8;
export const meadowDistance = (y: number, h: number) => Math.max(0, Math.min(1, (y - meadowActivityTop(h)) / Math.max(1, h - meadowActivityTop(h))));
export const meadowSize = (y: number, h: number) => .22 + .78 * Math.pow(meadowDistance(y,h), .7);
export const meadowSpeed = (y: number, h: number) => .12 + .88 * Math.pow(meadowDistance(y,h), 1.15);
export function meadowActivityAlpha(y: number, h: number) {
  const v=meadowDistance(y,h), t=Math.min(1,v/.08);
  return t * t * (3 - 2 * t) * (.35 + .65 * Math.min(1,v/.7));
}
