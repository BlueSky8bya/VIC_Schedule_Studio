// 이어진 일정 잇기(buildChainJoins)를 화면에 옮기는 공용 조각 — 편집실·시청자·미리보기가 같은 것을 쓴다(G-18).
import type { ChainJoin } from "@/lib/calendar/month";
import { getEventDateKey } from "@/lib/calendar/month";
import type { PublicScheduleEvent, StudioScheduleEvent } from "@/lib/domain/schedule-types";

type AnyEvent = PublicScheduleEvent | StudioScheduleEvent;

export function chainStepKey(fromId: string, toId: string) {
  return `${fromId}>${toId}`;
}

// 이어짐은 글자 없이 **모양으로만** 말한다(2026-11-18 소유자: "중복 안내 없이, 제목 자리 줄이지 말고").
// 같은 줄 = 띠, 앞에 다른 방송 = 꺾인 띠, 토→일 줄바뀜 = 평평한 변이 칸 끝까지.
// 며칠부터 며칠까지·며칠째인지는 누르면 뜨는 창의 날짜 줄이 한 번만 말한다(chainRangeOf).
//
// 줄바뀜(토→일)은 글자·아이콘 없이 **색으로만** 말한다(2026-11-19 소유자: 물결 "~"은 제목 속 진짜 "~"와 헷갈렸다) — wrapFadeOf.
// 앞 카드와 떨어져 받은 카드(꺾인 띠·줄바뀜)가 앞날과 글까지 같으면 세부 줄을 되풀이하지 않고 제목 한 줄로 줄인다.
export function chainSlim(join: ChainJoin | undefined): boolean {
  const left = join?.left;
  return Boolean(left && left.kind !== "band" && left.sameContent);
}
// 토→일 줄바뀜으로 맞닿은 끝 — 그 끝은 칠이 옅어진다(month.ts wrapFadeStyle, 편집실·시청자 같은 판정).
export function wrapFadeOf(join: ChainJoin | undefined): { left: boolean; right: boolean } {
  // 엇갈려 밑으로 지나가는 끝(under)은 카드 전체 끝을 CSS 마스크로 옅게 한다(.under-in/.under-out) — 여기서는 뺀다.
  return {
    left: join?.left?.kind === "wrap" && !join.left.under,
    right: join?.right?.kind === "wrap" && !join.right.under
  };
}
export function chainWrapClasses(join: ChainJoin | undefined): string {
  const cls = (side: ChainJoin["left"], wrap: string, under: string) =>
    side?.kind === "wrap" ? (side.under ? under : wrap) : "";
  return [cls(join?.left, "wrap-in", "under-in"), cls(join?.right, "wrap-out", "under-out")]
    .filter(Boolean)
    .join(" ");
}

// 카드에 다는 data-* — 높이 맞춤 묶음(data-chain), 같은 글 띠 머리(data-band-head), 꺾인 띠 양끝(data-step-from·to).
// 자체 멀티데이 일정(end_date_key)은 예전처럼 같은 id끼리 높이를 맞춘다.
export function chainDataAttrs(
  event: AnyEvent,
  join: ChainJoin | undefined,
  chainKeys: Map<string, string>
): Record<string, string | undefined> {
  const start = getEventDateKey(event);
  const ownMulti = Boolean(event.endDateKey && event.endDateKey > start);
  return {
    "data-chain": ownMulti ? chainKeys.get(event.id) : join?.bandKey,
    "data-band-head": join?.bandSpan ? event.id : undefined,
    "data-step-from":
      join?.right?.kind === "step" ? chainStepKey(event.id, join.right.otherId) : undefined,
    "data-step-to":
      join?.left?.kind === "step" ? chainStepKey(join.left.otherId, event.id) : undefined,
    // 같은 틈을 여러 꺾인 띠가 지날 때 이 이음의 자리("자리/전체") — 기둥을 그리는 쪽(use-equal-chain-heights)이 읽는다.
    "data-step-lane":
      join?.right?.kind === "step" && join.right.lanes ? `${join.right.lane}/${join.right.lanes}` : undefined,
    // 줄바뀜(토→일)으로 이어진 짝 — 고른 일정의 테두리가 다음 줄 블록까지 따라간다(drawRings).
    "data-wrap-to":
      join?.right?.kind === "wrap" ? chainStepKey(event.id, join.right.otherId) : undefined,
    "data-wrap-from":
      join?.left?.kind === "wrap" ? chainStepKey(join.left.otherId, event.id) : undefined
  };
}

// 이 칸에서 출발하는 꺾인 띠을 담는 층. 좌표는 useEqualChainHeights가 레이아웃이 바뀔 때마다 채운다.
export function ChainStepLayer({
  events,
  joins
}: {
  events: AnyEvent[];
  joins: Map<string, ChainJoin>;
}) {
  const keys: string[] = [];
  for (const e of events) {
    const right = joins.get(e.id)?.right;
    if (right?.kind === "step") keys.push(chainStepKey(e.id, right.otherId));
  }
  if (keys.length === 0) return null;
  // 카드 밑 층 — 띠 몸통. 고른 묶음의 테두리는 격자 전체 층 하나(svg.chain-ring-layer, drawRings)가 맡는다.
  return <svg aria-hidden="true" className="chain-steps" data-step-svg={keys.join(" ")} />;
}
