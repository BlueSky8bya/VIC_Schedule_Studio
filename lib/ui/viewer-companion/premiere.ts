import type { PremierePhase } from "@/lib/ui/premiere/plan";

/** A local presentation contract. Never carry the event DTO or gated content. */
export type CompanionPremiereItem = Readonly<{ id: string; revealAt: string | null; state: "masked" | "released" }>;
export type CompanionPremiereExit = Readonly<{ token: number; generation: string; id: string }>;
export type CompanionPremiereCue = Readonly<{
  owner: string;
  generation: string;
  phase: PremierePhase;
  target: number;
  items: readonly CompanionPremiereItem[];
  exit?: CompanionPremiereExit;
}>;
export type CompanionPremiereMoment = Readonly<{
  mode: "idle" | "prelude" | "enter" | "join" | "joined" | "return";
  progress: number;
  late: boolean;
}>;

export const COMPANION_PREMIERE_ENTER_MS = 73_000;
export const COMPANION_PREMIERE_JOIN_MS = 69_000;
const MAX_ITEMS = 200;
const idle = (): CompanionPremiereMoment => ({ mode: "idle", progress: 0, late: false });

export function isCompanionPremiereId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);
}

/** Explicit projection also makes accidental caller DTO spreads harmless. */
export function companionPremiereItems(items: readonly CompanionPremiereItem[]): CompanionPremiereItem[] {
  const seen = new Set<string>();
  return items.slice(0, MAX_ITEMS).flatMap(item => {
    if (!isCompanionPremiereId(item.id) || seen.has(item.id) || !["masked", "released"].includes(item.state)
      || item.revealAt !== null && (typeof item.revealAt !== "string" || !Number.isFinite(Date.parse(item.revealAt)))) return [];
    seen.add(item.id);
    return [{ id: item.id, revealAt: item.revealAt, state: item.state }];
  });
}

/** Publication changes state, not identity. A new deadline/cohort/opening is
 * a different performance, so an old dive/join/exit cannot follow it. */
export function companionPremiereGeneration(items: readonly CompanionPremiereItem[], opening: number): string {
  if (!Number.isSafeInteger(opening) || opening <= 0) return "";
  const keys = companionPremiereItems(items).map(item => [item.id, item.revealAt] as const).sort((a, b) => a[0].localeCompare(b[0]));
  return keys.length ? `${opening}:${JSON.stringify(keys)}` : "";
}

/** Other cohort members may arrive or finish without restarting the entered
 * creature. Only its actual public source/deadline decides invalidation. */
export function companionPremiereSourceStatus(source: Pick<CompanionPremiereItem, "id" | "revealAt">, items: readonly CompanionPremiereItem[]): "same" | "missing" | "rescheduled" {
  const current = items.find(item => item.id === source.id);
  return !current ? "missing" : current.revealAt === source.revealAt ? "same" : "rescheduled";
}

/** The renderer consumes a matching exit token once, after real calendar
 * geometry returns. No target or nearest-card fallback is invented here. */
export function companionPremiereReturn(cue: CompanionPremiereCue | null, consumedToken?: number): CompanionPremiereExit | null {
  const exit = cue?.exit;
  if (!cue || !exit || !Number.isSafeInteger(exit.token) || exit.token <= 0 || exit.token === consumedToken
    || exit.generation !== cue.generation || !isCompanionPremiereId(exit.id)
    || !cue.items.some(item => item.id === exit.id && item.state === "released")) return null;
  return exit;
}

/** One shared-clock sample, with no timer, DOM read or autonomous work. An
 * already joined creature stays joined across clock corrections; a late
 * arrival may join quietly or be skipped by the existing renderer policy. */
export function companionPremiereMoment(cue: CompanionPremiereCue | null, now: number, joined = false): CompanionPremiereMoment {
  if (!cue || !cue.generation || !Number.isFinite(now) || !Number.isFinite(cue.target) || !cue.items.length) return idle();
  if (cue.phase === "idle" || cue.phase === "return") return companionPremiereReturn(cue) ? { mode: "return", progress: 1, late: false } : idle();
  if (joined) return { mode: "joined", progress: 1, late: false };
  const remain = cue.target - now;
  if (remain > COMPANION_PREMIERE_ENTER_MS) return { mode: "prelude", progress: 0, late: false };
  if (remain <= COMPANION_PREMIERE_JOIN_MS) return { mode: "join", progress: 1, late: true };
  return { mode: "enter", progress: (COMPANION_PREMIERE_ENTER_MS - remain) / (COMPANION_PREMIERE_ENTER_MS - COMPANION_PREMIERE_JOIN_MS), late: false };
}
