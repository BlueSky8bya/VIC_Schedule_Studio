import type { CompanionPlay } from "./brain";
import type { CompanionBehaviorId } from "./collection";
import { sampleCompanionPlay, type CompanionPlayPose } from "./play";
import { canDecodeCompanionSprite, companionSpriteSources, decodeCompanionSprite, peekDecodedCompanionSprite, type CompanionSpriteSelection } from "./sprite-quality";
import { COMPANION_CLIP_TIMING, COMPANION_PLAY_TIMING } from "./timing";
import { companionFoodAftertasteDuration, sampleCompanionFoodAftertaste } from "./food-aftertaste";

type PreviewClip = Readonly<{ row: number; play?: CompanionPlay; aftertaste?: true }>;
/** A discovered gesture exposes only its own row, never the other gestures
 * that happen to share its authored world sequence or texture packet. */
const clips: Readonly<Partial<Record<CompanionBehaviorId, PreviewClip>>> = Object.freeze({
  "ask-petting": { row: 33, play: "ask-petting" },
  "lean-nuzzle": { row: 34, play: "lean-nuzzle" },
  "paper-knead": { row: 35, play: "cozy-nest" },
  "paper-nest": { row: 36, play: "cozy-nest" },
  "cheer-rehearsal": { row: 9, play: "cheer-rehearsal" },
  "doze-curl": { row: 40, play: "doze-curl" },
  groom: { row: 30, play: "groom" }, bow: { row: 29, play: "bow" },
  pounce: { row: 31, play: "pounce" }, tumble: { row: 21, play: "tumble" },
  dizzy: { row: 22, play: "dizzy" }, stretch: { row: 16 },
  "odd-food-reaction": { row: 23, aftertaste: true },
});
const neutral = (): CompanionPlayPose => ({ row: 0, phase: 0, beat: "checking", lift: 0, lean: 0, shift: 0, compression: 0 });

/** Cache eviction is normal, not a failed decode. Only actual failures consume
 * this mount's retry cap; a successful revisit renews the packet's budget. */
export function createCompanionPreviewPreparation() {
  const failures = new Map<string, number>();
  return async (row: number, current: () => boolean): Promise<boolean> => {
    for (const src of companionSpriteSources(row)) {
      if (!current()) return false;
      if (peekDecodedCompanionSprite(src)) { failures.delete(src); continue; }
      if (!canDecodeCompanionSprite(src)) return false;
      const count = failures.get(src) ?? 0;
      if (count >= 2) return false;
      if (!await decodeCompanionSprite(src)) {
        // A connected world can claim the last slot while decoding waits.
        // Busy yields are not failed files and keep their later retry budget.
        if (canDecodeCompanionSprite(src)) failures.set(src, count + 1);
        return false;
      }
      failures.delete(src);
    }
    return current();
  };
}

export function chooseCompanionPreviewBehavior(found: readonly string[], previous: CompanionBehaviorId | null = null, random: () => number = Math.random): CompanionBehaviorId | null {
  const pool = [...new Set(found)].filter((id): id is CompanionBehaviorId => Object.hasOwn(clips, id));
  const choices = pool.length > 1 ? pool.filter(id => id !== previous) : pool;
  if (!choices.length) return null;
  const value = random(), unit = Number.isFinite(value) ? Math.max(0, Math.min(.999999, value)) : 0;
  return choices[Math.floor(unit * choices.length)];
}

export function companionPreviewDuration(id: CompanionBehaviorId): number {
  const clip = clips[id];
  if (!clip) return 0;
  if (clip.aftertaste) return companionFoodAftertasteDuration("retch");
  return clip.play ? COMPANION_PLAY_TIMING[clip.play].beats.find(beat => beat.row === clip.row)!.duration : COMPANION_CLIP_TIMING.find(timing => timing.row === clip.row)!.duration!;
}

export function sampleCompanionPreview(id: CompanionBehaviorId | null, elapsed: number): CompanionPlayPose {
  if (!id || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= companionPreviewDuration(id)) return neutral();
  const clip = clips[id];
  if (!clip) return neutral();
  if (clip.aftertaste) return { ...sampleCompanionFoodAftertaste("retch", elapsed / companionPreviewDuration(id)), row: clip.row, beat: "play" };
  if (!clip.play) return { ...neutral(), row: clip.row, phase: elapsed / companionPreviewDuration(id), beat: "play" };
  const timing = COMPANION_PLAY_TIMING[clip.play];
  let offset = 0;
  for (const beat of timing.beats) { if (beat.row === clip.row) break; offset += beat.duration; }
  return sampleCompanionPlay(clip.play, (offset + elapsed) / timing.duration);
}

/** Crop the actual packet cell; registration belongs to the surrounding shared
 * sprite plane exactly once, just as it does for the live Image renderer. */
export function companionPreviewDrawing(selection: CompanionSpriteSelection, imageWidth: number, imageHeight: number) {
  return {
    sourceX: selection.index % selection.grid * imageWidth / selection.grid,
    sourceY: Math.floor(selection.index / selection.grid) * imageHeight / selection.gridRows,
    sourceWidth: imageWidth / selection.grid, sourceHeight: imageHeight / selection.gridRows,
    x: selection.frame.x / 80 * 100, y: selection.frame.y / 80 * 100,
    clip: selection.frame.clip.map(value => value / 80 * 100),
  };
}
