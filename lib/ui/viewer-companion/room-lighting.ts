import type { CompanionHomeEnvironment } from "./home-environment";
import type { CompanionCurtainPhase } from "./home-curtain-control";

/** One material sample for the painted room, resident, loose objects and both
 * sofa surfaces. Outside scenery stays emissive. This is layered illustration
 * lighting, not a second graphics engine or an autonomous light switch. */
export function companionRoomLighting(environment: CompanionHomeEnvironment | undefined, curtain: CompanionCurtainPhase, lamp: boolean) {
  const night = Boolean(environment?.night || environment?.band === "night" || environment?.band === "evening");
  const transmission = { open: 1, shade: .42, closed: .06 }[curtain];
  const cloudy = environment?.weather === "rain" ? .88 : environment?.weather === "cloud" ? .94 : 1;
  const grade = lamp ? night ? .96 : 1 : night ? .4 + transmission * .1 : .56 + transmission * .4 * cloudy;
  const shade = lamp ? .025 : night ? .64 - transmission * .12 : .43 - transmission * .4 * cloudy;
  const cloth = (r: number, g: number, b: number) => `rgb(${Math.round(r * grade)} ${Math.round(g * grade)} ${Math.round(b * grade)})`;
  return {
    "--vc-room-art-grade": grade,
    "--vc-room-grade": lamp ? `rgb(186 125 45 / ${shade})` : `rgb(40 34 53 / ${shade})`,
    "--vc-room-daylight": night || curtain === "closed" || environment?.weather !== "clear" ? 0 : transmission,
    "--vc-bed-cloth": cloth(lamp ? 199 : 196, lamp ? 186 : 188, lamp ? 164 : 174),
    "--vc-bed-light": cloth(lamp ? 231 : 225, lamp ? 214 : 217, lamp ? 187 : 202),
    "--vc-bed-shade": cloth(lamp ? 160 : 170, lamp ? 145 : 162, lamp ? 126 : 146),
    "--vc-soft-shadow": night && !lamp ? "#21181060" : "#795b3930",
  } as const;
}
