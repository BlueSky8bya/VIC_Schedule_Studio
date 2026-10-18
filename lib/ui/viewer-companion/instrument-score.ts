/** Local notation timing. The numbers are score facts, not a recorded
 * performance or an inferred regular-click rhythm. Unverified transitions
 * explicitly break grading; they never acquire an equal-interval fallback. */
export type CompanionInstrumentScore = Readonly<{ bpm: number; gaps: readonly (number | null)[] }>;
import { COMPANION_INSTRUMENT_SCORES } from "./instrument-score-data";

export function companionInstrumentScorePosition(title: string, index: number): { segment: number; onsetMs: number; gapMs: number; bpm: number } | undefined {
  const score: CompanionInstrumentScore | undefined = COMPANION_INSTRUMENT_SCORES[title];
  if (!score || !Number.isSafeInteger(index) || index < 0) return;
  const length = score.gaps.length, cycle = Math.floor(index / length), local = index % length;
  let segment = cycle * (length + 1), onset = 0;
  // Repeated complete verses share the same clock. In a partially verified
  // arrangement, each unknown transition starts a fresh finite segment.
  const complete = score.gaps.every(value => value !== null);
  if (complete) { segment = 0; onset = cycle * score.gaps.reduce<number>((sum, gap) => sum + gap!, 0); }
  for (let i = 0; i < local; i++) {
    const gap = score.gaps[i];
    if (gap === null) { segment++; onset = 0; } else onset += gap;
  }
  const gap = score.gaps[local];
  if (gap === null || !Number.isFinite(gap) || gap <= 0) return;
  return { segment, onsetMs: onset * 60000 / score.bpm, gapMs: gap * 60000 / score.bpm, bpm: score.bpm };
}
