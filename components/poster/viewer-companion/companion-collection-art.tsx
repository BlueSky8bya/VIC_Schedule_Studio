import type { CSSProperties, ReactNode } from "react";
import { getCompanionCollectionArtFrame, type CompanionCollectionArtKind } from "@/lib/ui/viewer-companion/collection-art";
import { getCompanionAccessoryArtFrame } from "@/lib/ui/viewer-companion/accessory-art";
import { COMPANION_FOOD_RARITY, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import type { CompanionCollectionRarity } from "@/lib/ui/viewer-companion/collection-rarity";
import { companionNewMemory } from "@/lib/ui/viewer-companion/memory-catalog";
import type { CompanionExpressionId } from "@/lib/ui/viewer-companion/expressions";
import { CompanionMemoryPortrait } from "./companion-memory-portrait";
import { companionCatalogDisplay } from "@/lib/ui/viewer-companion/catalog-display";

/** Owner-selected watercolor backings; live specimens remain separate and contained. */
const sealTiers = {
  common: { shape: "watercolor-open-cancellation", src: "/companion/collection/seals/watercolor-v3/common.webp" },
  uncommon: { shape: "watercolor-sprout-bookplate", src: "/companion/collection/seals/watercolor-v3/uncommon.webp" },
  rare: { shape: "watercolor-scalloped-stars", src: "/companion/collection/seals/watercolor-v3/rare.webp" },
  "ultra-rare": { shape: "watercolor-botanical-bow", src: "/companion/collection/seals/watercolor-v3/ultra-rare.webp" },
  mythic: { shape: "watercolor-wheat-sun-ribbon", src: "/companion/collection/seals/watercolor-v3/mythic.webp" },
} as const;
export function CompanionCollectionSeal({ children, rarity = "common", kind = "toy-stamp", artId }: { children: ReactNode; rarity?: CompanionCollectionRarity; kind?: "toy-stamp" | "food-stamp"; artId?: string }) {
  const tier = sealTiers[rarity];
  return <span className="vc-collection-art vc-collection-seal" data-collection-art={kind} data-collection-art-id={artId} data-seal-rarity={rarity} data-seal-shape={tier.shape} data-seal-style="watercolor" aria-hidden="true">
    <svg viewBox="0 0 128 128" focusable="false">
      <image href={tier.src} width="128" height="128" preserveAspectRatio="xMidYMid meet" />
    </svg>
    <span className="vc-collection-seal-picture">{children}</span>
  </span>;
}

/** One decorative local atlas cell. Its actual button/label supplies meaning;
 * callers own size, and runtime foods never request the collection stamps. */
export function CompanionCollectionArt({ kind, id, className }: { kind: CompanionCollectionArtKind; id?: string; className?: string }) {
  const memory = kind === "behavior-stamp" ? companionNewMemory(id) : undefined;
  if (memory?.family === "expression") return <CompanionMemoryPortrait id={memory.id.slice("expression:".length) as CompanionExpressionId} className={className} />;
  // Center actual alpha bounds, not the transparent atlas cell. The nested
  // viewport clips neighbours before translating the complete original cell.
  const frame = kind === "accessory" ? getCompanionAccessoryArtFrame(id) : getCompanionCollectionArtFrame(kind === "food-stamp" ? "food" : kind, id);
  if (!frame) return null;
  const classes = ["vc-collection-art", className].filter(Boolean).join(" ");
  if (kind === "food-stamp") {
    const { dx, dy } = companionCatalogDisplay("food", frame.id);
    return <CompanionCollectionSeal kind="food-stamp" artId={frame.id} rarity={isCompanionFoodKind(id) ? COMPANION_FOOD_RARITY[id] : "common"}>
      <svg aria-hidden="true" focusable="false" width="100%" height="100%" viewBox={`0 0 ${frame.width} ${frame.height}`} preserveAspectRatio="xMidYMid meet" overflow="visible">
        <svg x={dx} y={dy} width={frame.width} height={frame.height} viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} overflow="hidden">
          <image href={frame.src} width={frame.atlasWidth} height={frame.atlasHeight} />
        </svg>
      </svg>
    </CompanionCollectionSeal>;
  }
  const style: CSSProperties = {
    backgroundImage: `url("${frame.src}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${frame.atlasWidth / frame.width * 100}% ${frame.atlasHeight / frame.height * 100}%`,
    backgroundPosition: `${frame.atlasWidth === frame.width ? 0 : frame.x / (frame.atlasWidth - frame.width) * 100}% ${frame.atlasHeight === frame.height ? 0 : frame.y / (frame.atlasHeight - frame.height) * 100}%`,
  };
  return <span aria-hidden="true" className={classes} data-collection-art={kind} data-collection-art-id={frame.id} style={style} />;
}
