import type { PublicVodTimeline } from "@/lib/domain/schedule-types";

/** Explicit allowlist for public projection; no source identity or moderation escapes. */
export function sanitizeTimelineEntries(raw: unknown): PublicVodTimeline["entries"] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is Record<string, unknown> => !!e && typeof e === "object").map((e) => ({
    sec: Number(e.sec),
    label: typeof e.label === "string" ? e.label : "",
    section: typeof e.section === "string" ? e.section : null,
    depth: Number(e.depth) >= 1 && Number(e.depth) <= 3 ? Math.floor(Number(e.depth)) : 0
  })).filter((e) => Number.isFinite(e.sec) && e.sec >= 0 && e.label.length > 0);
}

export function publicTimelineProjection(data: Record<string, unknown>): PublicVodTimeline | null {
  const entries = sanitizeTimelineEntries(data.entries);
  if (!entries.length) return null;
  const variants = (Array.isArray(data.variants) ? data.variants : [])
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({ id: typeof v.id === "string" ? v.id : "", authorNick: typeof v.authorNick === "string" ? v.authorNick : "", entries: sanitizeTimelineEntries(v.entries) }))
    .filter((v) => v.id && v.entries.length > 0);
  return { authorNick: typeof data.author_nick === "string" ? data.author_nick : "", entries, variants };
}
