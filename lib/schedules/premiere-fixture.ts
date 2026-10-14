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
      isAllDay: masked, isTentative: false, publicTitle: masked ? "" : scenario === "sparse" ? "새로운 시작" : scenario === "outline" ? "별빛 우체국에서 처음 만나는 아주 긴 이야기 — 우리들의 오래 기다린 새로운 시작을 함께해요\n  첫 번째 편지와 새로운 소식\n    함께 만드는 이야기\n      더 깊은 세부 내용\n  두 번째 편지\n    아주 긴 부제도 오른쪽 화면 밖으로 넘치지 않고 자연스럽게 줄을 바꿔 읽을 수 있어야 해요\n  세 번째 편지\n  마지막으로 전하는 인사" : scenario === "long" ? "별빛 우체국에서 보내는 첫 번째 편지 — 오래 기다린 우리들의 새로운 이야기와 아주 특별한 하루" : `${PREMIERE_CANARY} ${i + 1}`,
      publicDescription: masked || scenario === "sparse" ? undefined : scenario === "long" ? Array.from({ length: 12 }, (_, n) => `${n + 1}. 오랫동안 기다린 만남을 준비했어요. 함께 새로운 이야기를 시작해요.`).join("\n") : "기다려 준 마음에 새로운 이야기가 도착했어요.",
      status: "scheduled", visibilityScope: "public", category: "stream", sortOrder: i,
      tagIds: [], primaryTagIds: [], teaser: masked || undefined,
      teaserRevealAt: masked ? new Date(target).toISOString() : undefined
    };
    return [{ id, dateKey: "2026-06-18", revealAt: new Date(target).toISOString(), state: masked ? "masked" as const : "released" as const, event }];
  });
  return { ok: true, schemaVersion: 1, sampledAtDbMs: now, entries };
}
