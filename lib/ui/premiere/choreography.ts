// Public timing only. Never derives layout, progress or placeholders from hidden content.
export const REGION_WINDOWS: Record<string, readonly [number, number]> = {
  "1": [180, 168], // debut
  "6": [174, 162], // live card
  "5": [166, 154], // season controls
  "2": [154, 138], // filters
  "3": [122, 112], // navigation/chrome
  "4": [96, 84] // ambient
};
export function passage(seconds: number, from: number, to: number): number {
  const t = Math.max(0, Math.min(1, (from - seconds) / (from - to)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export function calendarPassage(seconds: number, distance: number) {
  const offset = Math.min(8, Math.max(0, distance)) * .8;
  return { dim: passage(seconds, 126 + offset, 83 + offset), leave: passage(seconds, 81 + offset, 69 + offset) };
}
