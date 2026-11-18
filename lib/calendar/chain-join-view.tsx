// 이어진 일정 잇기(buildChainJoins)를 화면에 옮기는 공용 조각 — 편집실·시청자·미리보기가 같은 것을 쓴다(G-18).
import type { ChainJoin } from "@/lib/calendar/month";
import { getEventDateKey } from "@/lib/calendar/month";
import type { PublicScheduleEvent, StudioScheduleEvent } from "@/lib/domain/schedule-types";

type AnyEvent = PublicScheduleEvent | StudioScheduleEvent;

export function chainStepKey(fromId: string, toId: string) {
  return `${fromId}>${toId}`;
}

// 꺾인 띠·줄바뀜으로 이어 받은 카드의 작은 꼬리표. 띠(같은 줄)는 붙어 보이니 꼬리표가 없다.
// 줄바뀜(토→일)은 앞 카드가 윗줄에 있어 "N일부터"로 이어짐이 **시작한 날**을 알려 준다(바로 앞날이 아니다 —
// 20~22 이어짐의 22일에 "21일부터"는 21일 시작으로 읽힌다). 다른 달에서 시작했으면 달도 쓴다.
export function chainContLabel(join: ChainJoin | undefined, isoDate: string): string | null {
  const left = join?.left;
  if (!left || left.kind === "band") return null;
  if (left.kind === "step") return "이어서";
  const start = join.startKey ?? isoDate;
  const [, sm, sd] = start.split("-").map(Number);
  const month = Number(isoDate.split("-")[1]);
  return sm === month ? `${sd}일부터` : `${sm}월 ${sd}일부터`;
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
      join?.left?.kind === "step" ? chainStepKey(join.left.otherId, event.id) : undefined
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
  // 뒤 층(카드 밑 — 띠 몸통) + 앞 층(카드 위 — 고른 묶음을 한 덩어리로 두르는 테두리)
  return (
    <>
      <svg aria-hidden="true" className="chain-steps" data-step-svg={keys.join(" ")} />
      <svg aria-hidden="true" className="chain-rings" data-step-ring="" />
    </>
  );
}
