import type { CompanionToyKind } from "./toy-catalog";

/** The object keeps its real identity and carry owner throughout this finite
 * performance. These are drawing offsets, never a spawn, pickup or reward. */
export type CompanionToyUse = "ball-toss" | "wheel-push" | "cube-turn" | "spin" | "peek" | "jingle" | "music" | "cuddle" | "stack" | "flutter" | "string-bounce" | "fish" | "tap" | "groom" | "foam-shot";
export const COMPANION_TOY_USES = Object.freeze({
  ball: "ball-toss", blocks: "stack", "paper-plane": "flutter", spool: "string-bounce", hoop: "ball-toss", pinwheel: "spin", bell: "jingle", feather: "flutter",
  duck: "cuddle", "spinning-top": "spin", "toy-car": "wheel-push", train: "wheel-push", dice: "ball-toss", "rocking-horse": "cuddle", "squeaky-carrot": "cuddle", "star-wand": "jingle",
  kaleidoscope: "peek", tambourine: "music", maraca: "jingle", "yo-yo": "string-bounce", "plush-fish": "cuddle", "ribbon-ball": "ball-toss", "stacking-rings": "stack", "toy-rocket": "flutter",
  "bubble-wand": "flutter", kite: "flutter", boomerang: "flutter", "flying-disc": "flutter", "mini-skateboard": "wheel-push", "jump-rope": "string-bounce", "toy-drum": "music", xylophone: "music",
  harmonica: "music", "toy-trumpet": "music", "hand-puppet": "cuddle", "cup-and-ball": "string-bounce", "paddle-ball": "string-bounce", "slinky-spring": "string-bounce", "toy-camera": "peek", "toy-telescope": "peek",
  "magnetic-fishing": "fish", "windup-crab": "wheel-push", "balancing-bird": "flutter", "jigsaw-puzzle": "stack", "shape-sorter": "stack", "gear-board": "cube-turn", "wooden-bowling": "ball-toss", "mini-tuho": "fish",
  "foam-dart-blaster": "foam-shot", "mini-dollhouse": "stack", "battle-top-launcher": "spin", "puzzle-cube": "cube-turn", "modeling-clay-tub": "stack", "heart-compact": "peek", "virtual-pet-keyring": "peek", "transforming-robot": "cube-turn",
  "loop-race-track": "wheel-push", "mini-game-console": "tap", "capsule-machine": "cube-turn", "stud-brick-castle": "stack",
  "pangtteok-cushion": "cuddle", "tori-keycap-clicker": "tap", "tori-photocard": "peek", otamatone: "music", "tail-comb": "groom", "card-mirror": "peek", "airy-velvet-tint": "tap", "half-wallet": "tap",
  "power-bank": "tap", "wireless-earbuds": "peek", "sewing-kit": "tap", "matte-turbo-lighter": "tap", "herbal-lip-balm": "tap", "ceramic-safety-cutter": "tap", "tori-blanket": "cuddle", "tori-tumbler": "cuddle",
  "tori-acrylic-stand": "peek", "practice-baseball-bat": "jingle", "practice-baseball-glove": "cuddle", "cheer-pompom": "jingle", "broadcast-microphone": "music", "vr-headset": "peek", "vr-fishing-rod": "fish", "drawing-tablet": "tap",
} satisfies Readonly<Record<CompanionToyKind, CompanionToyUse>>);

const durations: Readonly<Record<CompanionToyUse, number>> = Object.freeze({ "ball-toss": 2600, "wheel-push": 2800, "cube-turn": 3100, spin: 2700, peek: 2700, jingle: 2500, music: 2900, cuddle: 2500, stack: 2900, flutter: 2800, "string-bounce": 2800, fish: 2900, tap: 2400, groom: 2700, "foam-shot": 2900 });
export const companionToyPlayDuration = (kind: CompanionToyKind) => durations[COMPANION_TOY_USES[kind]];
export type CompanionToyPlayPose = {
  use: CompanionToyUse; row: number; phase: number; lift: number; lean: number; shift: number; compression: number;
  /** CSS offsets in an80px body plane. First interpolate the existing carry
   * anchor toward {x: feet.x + facing*26/80*size, y: feet.y} by floorMix,
   * then add {x: facing*x/80*size, y: y/80*size}. Keep safe support bounds. */
  toy: { x: number; y: number; rotation: number; scale: number; floorMix: number };
  /** A local drawing only. A foam dart never becomes another physics object,
   * collection or projectile target; everyday closed props cannot ignite. */
  effect: { kind: "none" | "dart" | "bubble" | "ping"; opacity: number; x: number; y: number; rotation: number };
};
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const window = (p: number, start: number, end: number) => smooth((p - start) / .1) * smooth((end - p) / .12);

/** One bounded bout: approach, recognizable use, return to the same grip.
 * No independent RAF/timer and no writes to the object/care/collection store.
 * Facing is applied once by the caller, outside this local coordinate plane. */
export function sampleCompanionToyPlay(kind: CompanionToyKind, progress: number, reduced = false): CompanionToyPlayPose {
  const p = clamp(progress), use = COMPANION_TOY_USES[kind];
  const pose: CompanionToyPlayPose = { use, row: 9, phase: reduced ? 0 : p, lift: 0, lean: 0, shift: 0, compression: 0, toy: { x: 0, y: 0, rotation: 0, scale: 1, floorMix: 0 }, effect: { kind: "none", opacity: 0, x: 0, y: 0, rotation: 0 } };
  if (reduced || p <= 0 || p >= 1) return pose;
  const envelope = Math.sin(Math.PI * p) ** 2, active = window(p, .12, .9), wave = Math.sin(p * Math.PI * 6), toy = pose.toy;
  pose.row = p < .13 || use === "peek" && p < .76 ? 1 : 9;
  pose.lift = -envelope * 1.4; pose.lean = wave * envelope * 2;
  if (use === "ball-toss") {
    // A short throw and catch of this same carried object. Its visible path
    // peaks once, rather than resetting or silently creating another ball.
    const flight = clamp((p - .22) / .5), arc = Math.sin(flight * Math.PI);
    toy.x = arc * 22; toy.y = -arc * 28; toy.rotation = Math.sin(flight * Math.PI * 2) * 80;
    pose.lean = -arc * 6; pose.lift -= Math.max(0, Math.sin(p * Math.PI * 4)) * envelope * 3;
  } else if (use === "wheel-push") {
    toy.floorMix = active; toy.x = Math.sin(clamp((p - .18) / .65) * Math.PI) * 22 * active; toy.rotation = Math.sin(p * Math.PI * 4) * active * 4;
    pose.lean = active * 8; pose.compression = active * .035;
  } else if (use === "cube-turn") {
    // Two deliberate quarter-turns, separated by an inspecting pause.
    const first = window(p, .18, .48), second = window(p, .56, .86);
    toy.x = -2 * active; toy.y = -5 * active; toy.rotation = 90 * first - 90 * second;
    pose.lean = -4 * first + 5 * second; pose.compression = (first + second) * .018;
  } else if (use === "spin") {
    toy.floorMix = kind === "pinwheel" ? 0 : active;
    toy.rotation = 720 * smooth(p); toy.y = kind === "pinwheel" ? -7 * active : 0;
    pose.lean = -4 * envelope;
  } else if (use === "peek") {
    toy.x = 11 * active; toy.y = -18 * active; toy.rotation = -18 * active;
    pose.lean = 4 * active; pose.lift = -active * .8;
    if (kind === "toy-camera") { const flash = window(p, .53, .68); pose.effect = { kind: "ping", opacity: flash, x: 8, y: -7, rotation: 0 }; }
  } else if (use === "jingle" || use === "music") {
    const rhythm = Math.sin(p * Math.PI * (use === "music" ? 10 : 8));
    toy.x = rhythm * active * 4; toy.y = -Math.abs(rhythm) * active * 6;
    toy.rotation = rhythm * active * (use === "music" ? 12 : 25);
    pose.lift -= Math.abs(rhythm) * envelope * 2.8; pose.lean = -rhythm * envelope * 5; pose.compression = Math.max(0, rhythm) * envelope * .025;
    if (use === "music" && ["harmonica", "toy-trumpet", "broadcast-microphone", "otamatone"].includes(kind)) { toy.x += active * 8; toy.y -= active * 9; }
  } else if (use === "cuddle") {
    toy.x = -4 * active; toy.y = -3 * active; toy.scale = 1 - Math.sin(p * Math.PI * 4) ** 2 * active * .06;
    toy.rotation = Math.sin(p * Math.PI * 2) * active * 8; pose.lean = -Math.sin(p * Math.PI * 2) * envelope * 7;
  } else if (use === "stack") {
    toy.floorMix = active * .85; toy.y = -(Math.sin(p * Math.PI * 4) ** 2) * active * 6;
    toy.rotation = Math.sin(p * Math.PI * 4) * active * 9; pose.lean = active * 6; pose.compression = active * .025;
  } else if (use === "flutter") {
    toy.x = Math.sin(p * Math.PI * 2) * active * 18; toy.y = -Math.sin(p * Math.PI) * active * 18;
    toy.rotation = Math.sin(p * Math.PI * 4) * active * 22; pose.lean = -toy.x * .3;
    if (kind === "bubble-wand") { const drift = clamp((p - .35) / .45); pose.effect = { kind: "bubble", opacity: Math.sin(drift * Math.PI) ** 2, x: 7 + drift * 20, y: -7 - drift * 25, rotation: 0 }; }
  } else if (use === "string-bounce") {
    toy.y = Math.sin(p * Math.PI * 6) ** 2 * active * 14; toy.rotation = Math.sin(p * Math.PI * 6) * active * 10; pose.lean = wave * envelope * 4;
  } else if (use === "fish") {
    const cast = Math.sin(clamp((p - .17) / .65) * Math.PI);
    toy.x = cast * 9; toy.y = -cast * 10; toy.rotation = -cast * 34 + wave * active * 5; pose.lean = cast * 6;
  } else if (use === "groom") {
    toy.x = -8 * active; toy.y = -18 * active + Math.sin(p * Math.PI * 6) * active * 4;
    toy.rotation = 32 * active + wave * active * 8; pose.lean = -5 * active;
  } else if (use === "foam-shot") {
    const shot = clamp((p - .4) / .24), recoil = window(p, .4, .55);
    toy.x = -4 * recoil; toy.y = -5 * active; toy.rotation = -4 * recoil; pose.lean = -6 * recoil;
    pose.effect = { kind: "dart", opacity: Math.sin(shot * Math.PI) ** 2, x: 18 + shot * 42, y: -6 - Math.sin(shot * Math.PI) * 3, rotation: 0 };
  } else { // Closed pocket props and controls receive little taps only.
    const tap = Math.sin(p * Math.PI * 6) ** 2 * active;
    toy.y = tap * 3; toy.rotation = wave * active * 5; pose.lean = tap * 4; pose.compression = tap * .018;
  }
  return pose;
}
