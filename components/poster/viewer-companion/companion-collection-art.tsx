import type { CSSProperties, ReactNode } from "react";
import { getCompanionCollectionArtFrame, type CompanionCollectionArtKind } from "@/lib/ui/viewer-companion/collection-art";
import { getCompanionAccessoryArtFrame } from "@/lib/ui/viewer-companion/accessory-art";

const sealPath = Array.from({ length: 24 }, (_, index) => {
  const angle = index * Math.PI / 12, next = angle + Math.PI / 12, middle = angle + Math.PI / 24;
  return `${index ? "" : `M${64 + Math.cos(angle) * 56},${64 + Math.sin(angle) * 56}`}Q${64 + Math.cos(middle) * 64},${64 + Math.sin(middle) * 64} ${64 + Math.cos(next) * 56},${64 + Math.sin(next) * 56}`;
}).join("") + "Z";

/** The same paper seal as the food archive, around an unchanged local toy.
 * Only an actually discovered item receives this decorative archive framing. */
export function CompanionCollectionSeal({ children }: { children: ReactNode }) {
  return <span className="vc-collection-art vc-collection-seal" data-collection-art="toy-stamp" aria-hidden="true">
    <svg viewBox="0 0 128 128" focusable="false"><path d={sealPath} fill="#fff6db" stroke="#c4985c" strokeWidth="1.5" /><circle cx="64" cy="64" r="51" fill="#fff9e9" stroke="#eedbb4" strokeWidth="1" /></svg>
    <span className="vc-collection-seal-picture">{children}</span>
  </span>;
}

/** One decorative local atlas cell. Its actual button/label supplies meaning;
 * callers own size, and runtime foods never request the collection stamps. */
export function CompanionCollectionArt({ kind, id, className }: { kind: CompanionCollectionArtKind; id?: string; className?: string }) {
  // A food stamp is a paper seal behind the exact live food pixels. Keeping
  // the whole square food cell and a square viewport preserves its silhouette,
  // including future explicitly registered food replacements.
  const frame = kind === "accessory" ? getCompanionAccessoryArtFrame(id) : getCompanionCollectionArtFrame(kind === "food-stamp" ? "food" : kind, id);
  if (!frame) return null;
  const classes = ["vc-collection-art", className].filter(Boolean).join(" ");
  if (kind === "food-stamp") return <svg aria-hidden="true" focusable="false" className={classes} data-collection-art={kind} data-collection-art-id={frame.id} viewBox="0 0 128 128">
    <path d={sealPath} fill="#fff6db" stroke="#c4985c" strokeWidth="1.5" />
    <circle cx="64" cy="64" r="51" fill="#fff9e9" stroke="#eedbb4" strokeWidth="1" />
    <svg x="16" y="16" width="96" height="96" viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} preserveAspectRatio="xMidYMid meet">
      <image href={frame.src} width={frame.atlasWidth} height={frame.atlasHeight} />
    </svg>
  </svg>;
  const style: CSSProperties = {
    backgroundImage: `url("${frame.src}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${frame.atlasWidth / frame.width * 100}% ${frame.atlasHeight / frame.height * 100}%`,
    backgroundPosition: `${frame.atlasWidth === frame.width ? 0 : frame.x / (frame.atlasWidth - frame.width) * 100}% ${frame.atlasHeight === frame.height ? 0 : frame.y / (frame.atlasHeight - frame.height) * 100}%`,
  };
  return <span aria-hidden="true" className={classes} data-collection-art={kind} data-collection-art-id={frame.id} style={style} />;
}
