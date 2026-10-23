import { CompanionToyArt } from "./companion-toy-art";
import { COMPANION_AXIS_TOYS } from "@/lib/ui/viewer-companion/toy-motion-paint";
import { COMPANION_TOY_VISUALS, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";

/** The original catalog raster stays the decode source and fallback. Only
 * these three toys need a separately painted, mechanically correct rotor. */
export function CompanionToyLiveArt({ kind }: { kind: CompanionToyKind }) {
  const size = COMPANION_TOY_VISUALS[kind];
  return <><CompanionToyArt kind={kind} />{COMPANION_AXIS_TOYS.has(kind) && <canvas className="vc-toy-axis-art" width={size.width * 2} height={size.height * 2} style={{ width: size.width, height: size.height }} aria-hidden="true" />}</>;
}
