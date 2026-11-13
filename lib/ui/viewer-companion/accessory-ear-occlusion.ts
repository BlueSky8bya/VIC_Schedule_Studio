/** Foreground ear contours traced in the corresponding 80-unit sprite cell.
 * Ears can fold over a brim while the hat still covers their roots. */
const drooped = [
  [[39, 34], [34, 34], [29, 35], [23, 38], [18, 42], [15, 47], [13, 51], [13, 54], [15, 56], [19, 56], [23, 54], [27, 50], [30, 45], [33, 40], [36, 36]],
  [[47, 34], [51, 34], [57, 37], [62, 41], [66, 46], [67, 51], [67, 55], [65, 57], [61, 56], [57, 53], [54, 49], [52, 44], [50, 39]],
] as const;
const glance = [
  [[39, 34], [36, 32], [34, 31], [31, 32], [27, 35], [24, 39], [22, 43], [21, 48], [21, 52], [23, 55], [26, 55], [29, 53], [32, 49], [34, 44], [36, 39]],
  [[43, 34], [46, 32], [48, 31], [52, 32], [56, 35], [59, 40], [61, 45], [61, 50], [59, 54], [56, 55], [53, 53], [50, 49], [48, 44], [46, 39]],
] as const;
const curled = [
  [[31, 36], [27, 36], [23, 38], [20, 42], [18, 47], [19, 51], [22, 52], [25, 51], [29, 48], [34, 45]],
  [[51, 38], [55, 38], [59, 40], [62, 43], [63, 46], [63, 50], [61, 52], [57, 51], [53, 49], [49, 46]],
] as const;

const hiding = [
  [[39, 43], [38, 38], [35, 34], [32, 33], [28, 34], [24, 36], [21, 40], [20, 44], [20, 48], [24, 49], [28, 48], [32, 45], [36, 44]],
  [[43, 43], [42, 38], [42, 34], [44, 31], [47, 31], [51, 33], [54, 37], [56, 41], [57, 46], [55, 48], [51, 47], [47, 45]],
] as const;
const disappointed = [
  [[40, 35], [39, 30], [36, 26], [33, 24], [29, 25], [25, 28], [22, 31], [19, 36], [19, 39], [21, 41], [25, 40], [29, 38], [33, 36], [36, 34]],
  [[45, 36], [46, 31], [49, 26], [53, 25], [57, 26], [62, 29], [66, 34], [67, 38], [65, 41], [61, 40], [56, 38], [52, 36], [49, 34]],
] as const;
const slipped = [
  [[48, 47], [45, 42], [40, 39], [35, 37], [31, 37], [28, 39], [28, 42], [30, 44], [35, 46], [41, 47]],
  [[58, 52], [56, 46], [53, 42], [49, 40], [46, 41], [48, 45], [51, 48], [55, 50]],
] as const;
const asleep = [
  [[44, 40], [40, 35], [35, 33], [30, 32], [26, 33], [22, 35], [20, 39], [20, 42], [23, 44], [28, 44], [33, 43], [38, 42]],
] as const;
const rollBack = [
  [[30, 57], [25, 56], [21, 56], [17, 58], [15, 61], [15, 64], [17, 66], [22, 66], [27, 64], [32, 61]],
  [[31, 64], [28, 64], [26, 66], [25, 69], [26, 71], [29, 72], [33, 70], [36, 68]],
] as const;
const rollInverted = [
  [[50, 69], [54, 69], [57, 68], [60, 66.5], [61, 69], [58, 72], [54, 73], [50, 72]],
] as const;
const rollRise = [
  [[35, 38], [31, 37], [27, 37], [22, 38], [18, 40], [15, 44], [13, 48], [14, 51], [17, 52], [22, 50], [26, 47], [30, 44]],
] as const;
const throwLaunch = [
  [[35, 34], [30, 34], [25, 35], [21, 37], [17, 40], [14, 45], [13, 48], [16, 49], [21, 48], [26, 46], [30, 43], [34, 41]],
] as const;

export function companionForegroundEars(frame: number) {
  if (frame >= 224 && frame <= 239) return hiding;
  if (frame >= 272 && frame <= 287) return disappointed;
  if (frame >= 376 && frame <= 383) return slipped;
  if (frame >= 326 && frame <= 327) return rollBack;
  if (frame >= 328 && frame <= 330) return rollInverted;
  if (frame >= 331 && frame <= 333) return rollRise;
  if (frame >= 496 && frame <= 499) return throwLaunch;
  if (frame === 267) return asleep;
  if (frame >= 408 && frame <= 411) return glance;
  if (frame >= 288 && frame <= 303 || frame >= 432 && frame <= 447) return drooped;
  if (frame === 519) return curled;
}

// In these compressed drawings the detected roots follow the folded ear
// itself. Seat the brim on the forehead between the roots instead.
const hidingSeat = { x: 42, y: 44, roll: 4, scale: 1 };
const slippedSeat = { x: 46, y: 50, roll: 13, scale: 1 };
const curledSeat = { x: 41, y: 44.5, roll: 2, scale: .98 };
const rollBackSeat = { x: 36, y: 59, roll: -132, scale: 1 };
const rollInvertedSeat = { x: 45, y: 62.5, roll: 171, scale: 1 };
const throwLaunchSeat = { x: 43.5, y: 38, roll: -10, scale: 1 };

export function companionFoldedHatSeat(frame: number) {
  if (frame >= 224 && frame <= 239) return hidingSeat;
  if (frame >= 376 && frame <= 383) return slippedSeat;
  if (frame >= 326 && frame <= 327) return rollBackSeat;
  if (frame >= 328 && frame <= 330) return rollInvertedSeat;
  if (frame >= 496 && frame <= 499) return throwLaunchSeat;
  if (frame === 519) return curledSeat;
}
