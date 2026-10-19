/* eslint-disable @next/next/no-img-element -- Bounded local game sprites already have optimized derivatives. */
import type { CSSProperties } from "react";
import { COMPANION_TOY_VISUALS, getCompanionToyArt, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import "./companion-toy-art.css";

export type CompanionToyArtKind = CompanionToyKind;

/** One generated picture is shared by the live toy, taste card and toy book. */
export function CompanionToyArt({ kind, className = "" }: { kind: CompanionToyKind; className?: string }) {
  const { width, height } = COMPANION_TOY_VISUALS[kind];
  return <img className={`vc-toy-art ${className}`} src={getCompanionToyArt(kind)} width={width} height={height} style={{ "--vc-toy-art-width": `${width}px`, "--vc-toy-art-height": `${height}px` } as CSSProperties} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}
