import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_WEIGHTS } from "./snacks";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, COMPANION_TOY_WEIGHTS } from "./toy-catalog";
import { COMPANION_FOOD_BOOK_METADATA, COMPANION_TOY_BOOK_METADATA, type CompanionCollectionFamiliarity } from "./collection-book-metadata";

export type CompanionBookEntry = Readonly<{
  name: string;
  /** Unconditional integer draw mass: larger means easier within one book. */
  mass: number;
  requiresPreparation: boolean;
  familiarity: CompanionCollectionFamiliarity;
}>;
const korean = new Intl.Collator("ko-KR");
/** A display-only copy. Never sort the append-only identity/draw registries.
 * The final ID tie-break keeps identical labels deterministic for new entries. */
export function orderCompanionBook<K extends string>(ids: readonly K[], entry: (id: K) => CompanionBookEntry): readonly K[] {
  return Object.freeze([...ids].sort((a, b) => {
    const left = entry(a), right = entry(b);
    return right.mass - left.mass
      || Number(left.requiresPreparation) - Number(right.requiresPreparation)
      || Number(left.familiarity === "other") - Number(right.familiarity === "other")
      || korean.compare(left.name, right.name)
      || korean.compare(a, b);
  }));
}
export const COMPANION_FOOD_BOOK_ORDER = orderCompanionBook(COMPANION_FOOD_KINDS, id => ({
  name: COMPANION_FOOD_NAMES[id], mass: COMPANION_FOOD_WEIGHTS[id],
  requiresPreparation: COMPANION_FOOD_BOOK_METADATA[id].prepared,
  familiarity: COMPANION_FOOD_BOOK_METADATA[id].familiarity,
}));
export const COMPANION_TOY_BOOK_ORDER = orderCompanionBook(COMPANION_TOY_KINDS, id => ({
  name: COMPANION_TOY_NAMES[id], mass: COMPANION_TOY_WEIGHTS[id],
  requiresPreparation: COMPANION_TOY_BOOK_METADATA[id].assembly,
  familiarity: COMPANION_TOY_BOOK_METADATA[id].familiarity,
}));
