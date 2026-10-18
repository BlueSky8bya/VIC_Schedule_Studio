/** Fixed local identities shared by physics, artwork, tastes and the toy book. */
export const COMPANION_TOY_KINDS = Object.freeze(["ball", "blocks", "paper-plane", "spool", "hoop", "pinwheel", "bell", "feather"] as const);
export type CompanionToyKind = typeof COMPANION_TOY_KINDS[number];
export const COMPANION_TOY_NAMES: Readonly<Record<CompanionToyKind, string>> = Object.freeze({ ball: "통통 공", blocks: "알록 블록", "paper-plane": "종이비행기", spool: "실타래", hoop: "둥근 고리", pinwheel: "바람개비", bell: "딸랑 종", feather: "깃털 장난감" });
export const COMPANION_TOY_HINTS: Readonly<Record<CompanionToyKind, string>> = Object.freeze({ ball: "데굴데굴 굴리며 놀아요.", blocks: "알록달록한 작은 블록이에요.", "paper-plane": "가볍게 날려 보는 종이비행기예요.", spool: "동글동글 실을 감아 둔 실타래예요.", hoop: "굴리고 따라가는 둥근 고리예요.", pinwheel: "바람을 닮은 알록달록 바람개비예요.", bell: "살짝 흔들어 보는 작은 종이에요.", feather: "간질간질 가벼운 깃털 장난감이에요." });
export function isCompanionToyKind(value: unknown): value is CompanionToyKind { return typeof value === "string" && (COMPANION_TOY_KINDS as readonly string[]).includes(value); }
export function getCompanionToyArt(kind: CompanionToyKind): string { return `/companion/home/122/toy-${kind}.webp`; }
