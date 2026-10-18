import type { CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { getCompanionCollectionArtFrame } from "@/lib/ui/viewer-companion/collection-art";

/** Shared native106 food art. Existing thirteen licensed vectors and their
 * provenance stay preserved; new foods use the same compact food-only atlas. */
export function CompanionFruit({ kind }: { kind: CompanionFoodKind }) {
  const frame = getCompanionCollectionArtFrame("food", kind);
  if (!frame) return null;
  // Keep the existing SVG leaf: the food's one outer span owns nibbling and
  // its measured box. A nested span would inherit that transform a second time.
  return <svg viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} aria-hidden="true" focusable="false" className="vc-fruit" data-collection-art="food" data-collection-art-id={kind}>
    <image href={frame.src} width={frame.atlasWidth} height={frame.atlasHeight} />
  </svg>;
}
