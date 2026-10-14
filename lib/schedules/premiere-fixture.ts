import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";
import type { TeaserStateSnapshot } from "./teaser-state";

// Server/fixture-only synthetic content. Never import this module into the viewer.
export const PREMIERE_CANARY = "합성 공개 제목 — 별빛 우체국";
export function buildPremiereFixture(startedAt: number, offsets: number[], now: number, scenario = "normal", eventId?: string): TeaserStateSnapshot {
  const entries = offsets.flatMap((offset, i) => {
    const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    if (eventId && eventId !== id) return [];
    const original = startedAt + offset * 1000;
    if ((scenario === "delete" && now >= original - 1800) || (scenario === "remove-after" && now >= original + 2000)) return [];
    const target = scenario === "postpone" && now >= original - 1800 ? original + 30_000 :
      scenario === "advance" && now >= startedAt + 5000 ? startedAt + 10_000 :
      scenario === "regate" && now >= original + 2000 ? original + 6000 : original;
    const delay = scenario === "delay" ? 7000 : scenario === "partial" && i > 0 ? 2500 : 0;
    const masked = scenario === "immediate" && now >= original - 1800 ? false : now < target + delay;
    const event: PublicScheduleEvent = {
      id, startsAt: masked ? "2026-06-18T00:00:00+09:00" : "2026-06-18T20:30:00+09:00",
      isAllDay: masked, isTentative: false, publicTitle: masked ? "" : `${PREMIERE_CANARY} ${i + 1}`,
      publicDescription: masked ? undefined : "기다려 준 마음에 새로운 이야기가 도착했어요.",
      status: "scheduled", visibilityScope: "public", category: "stream", sortOrder: i,
      tagIds: [], primaryTagIds: [], teaser: masked || undefined,
      teaserRevealAt: masked ? new Date(target).toISOString() : undefined
    };
    return [{ id, dateKey: "2026-06-18", revealAt: new Date(target).toISOString(), state: masked ? "masked" as const : "released" as const, event }];
  });
  return { ok: true, schemaVersion: 1, sampledAtDbMs: now, entries };
}
