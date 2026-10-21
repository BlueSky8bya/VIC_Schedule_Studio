import { companionPoseMemory } from "./memory-catalog";
import { companionSpriteMetadata } from "./sprite-quality";
import type { CompanionBehaviorObservation } from "./collection";

export function companionMemoryPainted(observation: CompanionBehaviorObservation) {
  const frame = companionSpriteMetadata.frames[observation.requestedIndex];
  return Boolean(observation.visible && observation.decoded && frame
    && companionSpriteMetadata.rows[observation.requestedRow]?.includes(observation.requestedIndex)
    && observation.adoptedIndex === observation.requestedIndex && observation.adoptedSrc === observation.requestedSrc
    && companionSpriteMetadata.atlases[frame.atlas].src === observation.requestedSrc);
}

/** Existing active clock only. A fallback, hidden frame or long clock gap
 * breaks the witness; a single flashed transition cannot earn a pose. */
export function createCompanionPoseWitness() {
  let previous = -Infinity, candidate: ReturnType<typeof companionPoseMemory>, elapsed = 0;
  const reset = () => { previous = -Infinity; candidate = undefined; elapsed = 0; };
  const observe = (observation: CompanionBehaviorObservation, now: number) => {
    const id = companionMemoryPainted(observation) ? companionPoseMemory(observation.requestedRow) : undefined;
    const delta = now - previous;
    elapsed = id && id === candidate && delta >= 0 && delta <= 100 ? elapsed + delta : 0;
    candidate = id; previous = now;
    return id && elapsed >= 80 ? id : undefined;
  };
  return Object.assign(observe, { reset });
}
