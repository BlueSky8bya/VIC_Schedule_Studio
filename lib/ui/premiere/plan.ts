import type { TeaserStateEntry } from "@/lib/schedules/teaser-state";

export const PREMIERE_TIMING = { prelude: 180_000, quake: 76_000, screen: 68_000, chain: 15_000, read: 6000, wait: 5000, limit: 90_000, rest: 30_000 } as const;
export type PremiereCandidate = TeaserStateEntry & { confirmedAt?: number };
export type PremierePhase = "idle" | "prelude" | "filters" | "chrome" | "curtain" | "quake" | "screen" | "build" | "eye" | "reveal" | "waiting" | "return";
export type PremiereFrame = { phase: PremierePhase; target: number; remainMs: number; items: PremiereCandidate[]; focused: boolean };
export const idleFrame = (): PremiereFrame => ({ phase: "idle", target: 0, remainMs: Infinity, items: [], focused: false });
export const premiereKey = (entry: TeaserStateEntry) => `${entry.id}:${entry.revealAt ?? "released"}`;
export const presentationTime = (entry: PremiereCandidate) => Math.min(Date.parse(entry.revealAt ?? ""), entry.confirmedAt ?? Infinity);

export function planPremiere(entries: PremiereCandidate[], now: number, month: string, skipped: ReadonlySet<string> = new Set(), current?: PremiereFrame): PremiereFrame {
  const activeKeys = new Set(current?.focused ? current.items.map(premiereKey) : []);
  const readingIds = current?.focused && current.phase === "reveal" && current.items.every(item => item.state === "released") ? new Set(current.items.map(item => item.id)) : null;
  const candidates = entries.filter(entry => {
    const target = presentationTime(entry);
    return (!readingIds || readingIds.has(entry.id)) && entry.dateKey.startsWith(month) && Number.isFinite(target) && !skipped.has(premiereKey(entry)) &&
      target - now <= PREMIERE_TIMING.prelude &&
      (entry.state === "released" ? entry.confirmedAt !== undefined && (activeKeys.has(premiereKey(entry)) || now - entry.confirmedAt <= PREMIERE_TIMING.read) : now - target <= PREMIERE_TIMING.wait);
  }).sort((a, b) => presentationTime(a) - presentationTime(b) || a.event.sortOrder - b.event.sortOrder || a.id.localeCompare(b.id));
  if (!candidates.length) return idleFrame();
  const items = [candidates[0]];
  for (const item of candidates.slice(1)) {
    if (presentationTime(item) - presentationTime(items[items.length - 1]) > PREMIERE_TIMING.chain && !activeKeys.has(premiereKey(item))) break;
    items.push(item);
  }
  const next = items.find(item => item.state === "masked") ?? items[items.length - 1];
  const target = presentationTime(next);
  const remainMs = target - now;
  const first = presentationTime(items[0]);
  const focused = first - now <= PREMIERE_TIMING.screen;
  const phase: PremierePhase = remainMs <= 0 ? (next.state === "released" ? "reveal" : "waiting") :
    first <= now && remainMs <= PREMIERE_TIMING.chain ? "eye" :
    remainMs <= 11_800 ? "eye" : remainMs <= 60_000 ? "build" : remainMs <= PREMIERE_TIMING.screen ? "screen" :
    remainMs <= PREMIERE_TIMING.quake ? "quake" : remainMs <= 90_000 ? "curtain" : remainMs <= 120_000 ? "chrome" : remainMs <= 150_000 ? "filters" : "prelude";
  return { phase, target, remainMs, items, focused };
}
