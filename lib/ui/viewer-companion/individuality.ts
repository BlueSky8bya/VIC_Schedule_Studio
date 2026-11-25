/** Bounded device-local tendencies. No identities, event IDs, dates or raw input. */
export const COMPANION_INDIVIDUAL_AXES = ["contact", "company", "sharing", "novelty"] as const;
export type CompanionIndividualAxis = typeof COMPANION_INDIVIDUAL_AXES[number];
export type CompanionIndividualContext = "home" | "outside";
type Tendency = { value: number; evidence: number };
export type CompanionIndividuality = {
  generation: number;
  credit: number;
  contexts: Record<CompanionIndividualContext, Record<CompanionIndividualAxis, Tendency>>;
  places: Record<"home" | "card" | "floor", Tendency>;
};
export type CompanionIndividualExperience = "short-contact" | "long-contact" | "shared-play" | "shared-discovery" | "home-called";
const bound = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const tendency = (value?: unknown): Tendency => {
  const source = record(value);
  return { value: typeof source.value === "number" && Number.isFinite(source.value) ? bound(source.value, -1, 1) : 0,
    evidence: typeof source.evidence === "number" && Number.isFinite(source.evidence) ? bound(Math.floor(source.evidence), 0, 64) : 0 };
};
const context = (value?: unknown) => Object.fromEntries(COMPANION_INDIVIDUAL_AXES.map(axis => [axis, tendency(record(value)[axis])])) as CompanionIndividuality["contexts"]["home"];
export function normalizeCompanionIndividuality(value: unknown, generation = 0): CompanionIndividuality {
  const source = record(value), contexts = record(source.contexts), places = record(source.places);
  const matches = source.generation === generation;
  return { generation, credit: matches && typeof source.credit === "number" && Number.isFinite(source.credit) ? bound(source.credit, 0, 1) : 1,
    contexts: { home: context(matches ? contexts.home : undefined), outside: context(matches ? contexts.outside : undefined) },
    places: { home: tendency(matches ? places.home : undefined), card: tendency(matches ? places.card : undefined), floor: tendency(matches ? places.floor : undefined) } };
}
export function advanceCompanionIndividuality(value: CompanionIndividuality, elapsedMs: number, enabled: boolean): CompanionIndividuality {
  if (!enabled || !Number.isFinite(elapsedMs) || elapsedMs <= 0 || value.credit >= 1) return value;
  return { ...value, credit: Math.min(1, value.credit + Math.min(30000, elapsedMs) / 18000) };
}
/** Called only for confirmed human interaction. No-op/absence has no signal. */
export function learnCompanionIndividuality(value: CompanionIndividuality, event: CompanionIndividualExperience, where: CompanionIndividualContext, place: "home" | "card" | "floor", enabled: boolean): CompanionIndividuality {
  if (!enabled || value.credit < 1 - 1e-9 || !["home", "outside"].includes(where)
    || !["short-contact", "long-contact", "shared-play", "shared-discovery", "home-called"].includes(event)) return value;
  const next = normalizeCompanionIndividuality(value, value.generation);
  const toward = (axis: CompanionIndividualAxis, target: number) => {
    const current = next.contexts[where][axis]; current.value += .065 * (target - current.value); current.evidence = Math.min(64, current.evidence + 1);
  };
  if (event === "short-contact" || event === "long-contact") toward("contact", event === "long-contact" ? 1 : -1);
  if (event === "shared-play") toward("sharing", .65);
  if (event === "shared-discovery") { toward("sharing", 1); toward("novelty", .85); }
  if (event === "home-called") { toward("company", 1); toward("novelty", -.4); }
  if (Object.hasOwn(next.places, place)) {
    const preferred = next.places[place]; preferred.value += .05 * (1 - preferred.value); preferred.evidence = Math.min(64, preferred.evidence + 1);
  }
  next.credit = 0;
  return next;
}
/** Evidence ramps gradually; an isolated gesture never establishes a habit. */
export function companionIndividualEffects(value?: CompanionIndividuality, where: CompanionIndividualContext = "outside") {
  const read = (axis: CompanionIndividualAxis) => {
    const t = value?.contexts[where][axis]; return t ? t.value * Math.max(0, Math.min(1, (t.evidence - 2) / 6)) : 0;
  };
  return { contact: read("contact"), company: read("company"), sharing: read("sharing"), novelty: read("novelty") };
}

/** Only coarse current support families; stored IDs/coordinates cannot target a ledge. */
export function companionPlaceAffinity(value: CompanionIndividuality | undefined, place: "home" | "card" | "floor"): number {
  const tendency = value?.places[place];
  return tendency ? tendency.value * Math.max(0, Math.min(1, (tendency.evidence - 2) / 6)) : 0;
}
