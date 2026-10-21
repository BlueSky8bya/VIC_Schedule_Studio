import { COMPANION_LEGACY_BEHAVIOR_IDS, COMPANION_BEHAVIOR_NAMES, COMPANION_BEHAVIOR_HINTS } from "./collection";
import { COMPANION_SITUATION_IDS, COMPANION_SITUATION_NAMES, COMPANION_SITUATION_HINTS } from "./moments";
import { COMPANION_NEW_MEMORIES } from "./memory-catalog";

/** Keep the original25 display positions as well as their storage IDs. */
export const COMPANION_MEMORY_BOOK = [
  ...COMPANION_LEGACY_BEHAVIOR_IDS.map(id => ({ id, kind: "behavior" as const, family: "behavior" as const, name: COMPANION_BEHAVIOR_NAMES[id], hint: COMPANION_BEHAVIOR_HINTS[id] })),
  ...COMPANION_SITUATION_IDS.map(id => ({ id, kind: "moment" as const, family: "moment" as const, name: COMPANION_SITUATION_NAMES[id], hint: COMPANION_SITUATION_HINTS[id] })),
  ...COMPANION_NEW_MEMORIES.map(memory => ({ ...memory, kind: "behavior" as const })),
];
