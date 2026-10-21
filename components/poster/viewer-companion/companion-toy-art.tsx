/* eslint-disable @next/next/no-img-element -- Bounded local game sprites already have optimized derivatives. */
import type { CSSProperties } from "react";
import { COMPANION_TOY_VISUALS, getCompanionToyArt, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import "./companion-toy-art.css";
import { companionCatalogDisplay } from "@/lib/ui/viewer-companion/catalog-display";

export type CompanionToyArtKind = CompanionToyKind;

/** One generated picture is shared by the live toy, taste card and toy book. */
export function CompanionToyArt({ kind, className = "" }: { kind: CompanionToyKind; className?: string }) {
  const { width, height } = COMPANION_TOY_VISUALS[kind];
  return <img className={`vc-toy-art ${className}`} src={getCompanionToyArt(kind)} width={width} height={height} style={{ "--vc-toy-art-width": `${width}px`, "--vc-toy-art-height": `${height}px` } as CSSProperties} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}

/** Catalog-only placement; world physics and the live toy keep their anchors. */
export function CompanionCatalogToyArt({ kind }: { kind: CompanionToyKind }) {
  const { src, width, height, dx, dy } = companionCatalogDisplay("toy", kind);
  return <svg className="vc-toy-art" aria-hidden="true" focusable="false" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" overflow="visible">
    <image href={src} x={dx} y={dy} width={width} height={height} />
  </svg>;
}
