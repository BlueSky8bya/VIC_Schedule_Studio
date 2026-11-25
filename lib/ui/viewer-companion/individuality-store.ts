import { COMPANION_PERSONALITIES, type CompanionPersonality } from "./preferences";
import { normalizeCompanionIndividuality, type CompanionIndividuality } from "./individuality";
export const COMPANION_INDIVIDUAL_KEY = "vic.companionIndividual.v1";

type StoragePort = Pick<Storage, "getItem" | "setItem">;
type Envelope = { version: 1; personality?: CompanionPersonality; learning?: CompanionIndividuality };
const validPersonality = (value: unknown): value is CompanionPersonality => COMPANION_PERSONALITIES.includes(value as CompanionPersonality);
export function createCompanionIndividualityStore(storage?: StoragePort) {
  let rawSeen: string | null | undefined, memory: Envelope = { version: 1 }, unwritten = false;
  let learningBaseline: string | undefined;
  const learningStamp = (value: CompanionIndividuality | undefined) => JSON.stringify(value) ?? "empty";
  const read = (): Envelope => {
    let raw: string | null;
    try { raw = storage?.getItem(COMPANION_INDIVIDUAL_KEY) ?? null; } catch { return memory; }
    if (raw === rawSeen) return memory;
    rawSeen = raw; unwritten = false; memory = { version: 1 };
    if (!raw || raw.length > 8192) return memory;
    try {
      const source = JSON.parse(raw);
      if (!source || source.version !== 1) return memory;
      if (validPersonality(source.personality)) memory.personality = source.personality;
      const generation = source.learning?.generation;
      if (Number.isSafeInteger(generation) && generation >= 0) memory.learning = normalizeCompanionIndividuality(source.learning, generation);
    } catch { /* Malformed optional memory never changes ordinary settings. */ }
    return memory;
  };
  const write = (next: Envelope) => {
    memory = next;
    const raw = JSON.stringify(next);
    if (raw === rawSeen && !unwritten) return;
    try { if (storage) { storage.setItem(COMPANION_INDIVIDUAL_KEY, raw); rawSeen = raw; unwritten = false; } }
    catch { unwritten = true; }
  };
  return {
    personality: () => read().personality,
    settle(personality: CompanionPersonality, replace = false): CompanionPersonality {
      const current = read(), chosen = !replace && current.personality ? current.personality : personality;
      if (validPersonality(chosen)) write({ ...current, personality: chosen });
      return chosen;
    },
    load(generation: number) {
      const current = read(); learningBaseline = learningStamp(current.learning);
      return normalizeCompanionIndividuality(current.learning, generation);
    },
    save(learning: CompanionIndividuality) {
      const current = read();
      if ((current.learning?.generation ?? 0) > learning.generation) return false;
      // A delayed same-generation tab must reload before writing over newer
      // evidence. Identity-only writes do not invalidate this learning stamp.
      if (learningBaseline !== undefined && learningBaseline !== learningStamp(current.learning)) return false;
      const next = normalizeCompanionIndividuality(learning, learning.generation);
      write({ ...current, learning: next }); learningBaseline = learningStamp(next); return true;
    },
    reset(generation: number) {
      const current = read();
      if ((current.learning?.generation ?? 0) > generation) return;
      const next = normalizeCompanionIndividuality(undefined, generation);
      write({ ...current, learning: next }); learningBaseline = learningStamp(next);
    },
    synchronize() { rawSeen = undefined; unwritten = false; learningBaseline = undefined; memory = { version: 1 }; return read(); },
  };
}
let owner: Window | undefined, device: ReturnType<typeof createCompanionIndividualityStore> | undefined;
export function companionIndividualityStore() {
  if (typeof window === "undefined") return undefined;
  if (owner !== window || !device) {
    owner = window;
    let storage: StoragePort | undefined; try { storage = window.localStorage; } catch { /* Optional local storage. */ }
    device = createCompanionIndividualityStore(storage);
  }
  return device;
}
