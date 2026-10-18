import type { CSSProperties } from "react";
import { getCompanionCollectionArtFrame, type CompanionCollectionArtKind } from "@/lib/ui/viewer-companion/collection-art";

/** One decorative local atlas cell. Its actual button/label supplies meaning;
 * callers own size, and runtime foods never request the collection stamps. */
export function CompanionCollectionArt({ kind, id, className }: { kind: CompanionCollectionArtKind; id?: string; className?: string }) {
  const frame = getCompanionCollectionArtFrame(kind, id);
  if (!frame) return null;
  const style: CSSProperties = {
    backgroundImage: `url("${frame.src}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${frame.atlasWidth / frame.width * 100}% ${frame.atlasHeight / frame.height * 100}%`,
    backgroundPosition: `${frame.atlasWidth === frame.width ? 0 : frame.x / (frame.atlasWidth - frame.width) * 100}% ${frame.atlasHeight === frame.height ? 0 : frame.y / (frame.atlasHeight - frame.height) * 100}%`,
  };
  return <span aria-hidden="true" className={["vc-collection-art", className].filter(Boolean).join(" ")} data-collection-art={kind} data-collection-art-id={frame.id} style={style} />;
}
