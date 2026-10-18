import type { CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { getCompanionFoodArtFrame } from "@/lib/ui/viewer-companion/food-art";

/** Shared native collection food art. Existing thirteen licensed vectors and
 * their provenance stay preserved; additive foods use compact food-only atlases. */
export function CompanionFruit({ kind }: { kind: CompanionFoodKind }) {
  const frame = getCompanionFoodArtFrame(kind);
  if (!frame) return null;
  // Keep the existing SVG leaf: the food's one outer span owns nibbling and
  // its measured box. A nested span would inherit that transform a second time.
  return <svg viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} aria-hidden="true" focusable="false" className="vc-fruit" data-collection-art="food" data-collection-art-id={kind}>
    <image href={frame.src} width={frame.atlasWidth} height={frame.atlasHeight} />
  </svg>;
}
