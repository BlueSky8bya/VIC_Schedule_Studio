import type { CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

/** One local vector family, independent of OS emoji fonts. Eight Noto Emoji
 * originals and five explicitly labelled derivatives; Apache-2.0 source,
 * upstream notice and exact hashes live in public/companion/food/SOURCES.md.
 * SVG image isolation also prevents upstream gradient IDs from colliding. */
export function CompanionFruit({ kind }: { kind: CompanionFoodKind }) {
  return <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="vc-fruit">
    <image href={`/companion/food/${kind}.svg`} width="40" height="40" />
  </svg>;
}
