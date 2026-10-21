import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import { getCompanionCollectionArtFrame, type CompanionCollectionArtKind } from "@/lib/ui/viewer-companion/collection-art";
import { getCompanionAccessoryArtFrame } from "@/lib/ui/viewer-companion/accessory-art";
import { COMPANION_FOOD_RARITY, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import type { CompanionCollectionRarity } from "@/lib/ui/viewer-companion/collection-rarity";

const sealPath = Array.from({ length: 24 }, (_, index) => {
  const angle = index * Math.PI / 12, next = angle + Math.PI / 12, middle = angle + Math.PI / 24;
  return `${index ? "" : `M${64 + Math.cos(angle) * 56},${64 + Math.sin(angle) * 56}`}Q${64 + Math.cos(middle) * 64},${64 + Math.sin(middle) * 64} ${64 + Math.cos(next) * 56},${64 + Math.sin(next) * 56}`;
}).join("") + "Z";

const sealTiers = {
  common: { paper: "#fff8e8", rim: "#b89161", light: "#e7d6b8", dark: "#9a754a", rank: 0 },
  uncommon: { paper: "#f1f8ee", rim: "#709575", light: "#d0e4c3", dark: "#51765b", rank: 1 },
  rare: { paper: "#f1f7ff", rim: "#748fae", light: "#e5f2ff", dark: "#547193", rank: 2 },
  "ultra-rare": { paper: "#fff8df", rim: "#b58a32", light: "#fff0ab", dark: "#8a631f", rank: 3 },
  mythic: { paper: "#fff3e1", rim: "#9b709a", light: "#f7d985", dark: "#805582", rank: 4 },
} as const;
/** Rarity belongs to the actual catalogue tier. The entire unchanged specimen
 * sits inside its seal, including wide/diagonal toys. Unknowns get no seal. */
export function CompanionCollectionSeal({ children, rarity = "common", kind = "toy-stamp", artId }: { children: ReactNode; rarity?: CompanionCollectionRarity; kind?: "toy-stamp" | "food-stamp"; artId?: string }) {
  const gradient = useId().replace(/:/g, ""), tier = sealTiers[rarity];
  return <span className="vc-collection-art vc-collection-seal" data-collection-art={kind} data-collection-art-id={artId} data-seal-rarity={rarity} aria-hidden="true">
    <svg viewBox="0 0 128 128" focusable="false">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor={tier.light} /><stop offset=".4" stopColor={tier.rim} /><stop offset=".62" stopColor={tier.light} /><stop offset="1" stopColor={tier.dark} /></linearGradient></defs>
      <path d={sealPath} fill={tier.paper} stroke={tier.rank >= 2 ? `url(#${gradient})` : tier.rim} strokeWidth={tier.rank >= 3 ? 3 : 1.5} />
      <circle cx="64" cy="64" r="51" fill={tier.paper} stroke={tier.rim} strokeWidth=".9" strokeDasharray={tier.rank === 1 ? "2 3" : undefined} />
      {tier.rank >= 2 && <circle cx="64" cy="64" r="47" fill="none" stroke={tier.light} strokeWidth="1.5" />}
      {tier.rank >= 3 && Array.from({ length: 12 }, (_, i) => <path key={i} d="M64 9l1.6 3.8L64 16l-1.6-3.2z" transform={`rotate(${i * 30} 64 64)`} fill={tier.dark} />)}
      {tier.rank === 4 && <><path d="M18 92l-7 22 14-4 7 10 7-20M110 92l7 22-14-4-7 10-7-20" fill="#c59b4c" stroke="#936c2e" strokeWidth="1" /><path d="M55 12l3 7 6-10 6 10 3-7-1 13H56z" fill="#f3cf70" stroke="#936c2e" strokeWidth="1" /></>}
    </svg>
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
  if (kind === "food-stamp") return <CompanionCollectionSeal kind="food-stamp" artId={frame.id} rarity={isCompanionFoodKind(id) ? COMPANION_FOOD_RARITY[id] : "common"}>
    <svg aria-hidden="true" focusable="false" width="100%" height="100%" viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} preserveAspectRatio="xMidYMid meet">
      <image href={frame.src} width={frame.atlasWidth} height={frame.atlasHeight} />
    </svg>
  </CompanionCollectionSeal>;
  const style: CSSProperties = {
    backgroundImage: `url("${frame.src}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${frame.atlasWidth / frame.width * 100}% ${frame.atlasHeight / frame.height * 100}%`,
    backgroundPosition: `${frame.atlasWidth === frame.width ? 0 : frame.x / (frame.atlasWidth - frame.width) * 100}% ${frame.atlasHeight === frame.height ? 0 : frame.y / (frame.atlasHeight - frame.height) * 100}%`,
  };
  return <span aria-hidden="true" className={classes} data-collection-art={kind} data-collection-art-id={frame.id} style={style} />;
}
