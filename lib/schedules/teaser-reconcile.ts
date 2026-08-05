import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

// 떡밥(최초공개) 카드의 '지금 진실' 대조 결과.
//
// ok=false는 "서버가 확인해 주지 못했다"(DB 미설정·캘린더 없음·쿼리 실패)이고, ok=true + 빈
// events는 "물어본 일정이 실제로 없다"이다. 이 둘을 한 배열([])로 뭉치면 오프라인/샘플 모드에서
// 멀쩡한 떡밥 카드를 유령으로 오해해 지워버린다.
export type TeaserRevealResult = {
  ok: boolean;
  events: PublicScheduleEvent[];
};

export type TeaserReconcile = {
  // 상태에 덮어쓸 최신 DTO(공개됐으면 실제 내용, 아직이면 최신 stub).
  events: PublicScheduleEvent[];
  // 물어봤는데 서버에 없던 id — 지워졌거나 공개가 아니게 된 일정. 카드에서 치운다.
  goneIds: string[];
};

// 물어본 id 목록과 서버 응답을 대조한다.
//
// 왜 필요한가(2026-08-05 실측): 공개 캐시가 낡아 이미 **지워진** 떡밥이 스냅샷에 남아 있으면,
// 카드는 '공개시각이 지난 가림 stub' 모양이라 중립 placeholder(빈 흰 카드)를 그리고 2초마다
// 서버에 실제 내용을 조른다. 서버는 지워진 일정을 못 찾아 계속 빈 응답 → 카드가 영원히 빈 채로
// 남는다(새로고침·강력 새로고침도 같은 캐시라 그대로). 캐시 무효화를 고쳐 원인은 없앴지만,
// 캐시가 어떤 이유로든 낡으면 같은 화면이 다시 나오므로 클라도 스스로 빠져나올 수 있어야 한다.
export function reconcileTeaserReveal(
  askedIds: string[],
  result: TeaserRevealResult | null | undefined
): TeaserReconcile {
  if (!result || !result.ok) {
    // 확인 실패 — 아무것도 지우지 않는다(모르는 것과 없는 것은 다르다).
    return { events: result?.events ?? [], goneIds: [] };
  }
  const got = new Set(result.events.map((ev) => ev.id));
  return {
    events: result.events,
    goneIds: askedIds.filter((id) => !got.has(id))
  };
}
