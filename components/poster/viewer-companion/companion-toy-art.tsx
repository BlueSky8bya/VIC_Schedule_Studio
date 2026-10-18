/* eslint-disable @next/next/no-img-element -- Bounded local game sprites already have optimized derivatives. */
import { getCompanionToyArt, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import "./companion-toy-art.css";

export type CompanionToyArtKind = CompanionToyKind;

/** One generated picture is shared by the live toy, taste card and toy book. */
export function CompanionToyArt({ kind, className = "" }: { kind: CompanionToyKind; className?: string }) {
  return <img className={`vc-toy-art ${className}`} src={getCompanionToyArt(kind)} width="28" height="28" alt="" aria-hidden="true" draggable={false} decoding="async" />;
}
