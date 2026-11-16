// 이어진 일정 잇기(buildChainJoins)를 화면에 옮기는 공용 조각 — 편집실·시청자·미리보기가 같은 것을 쓴다(G-18).
import type { ChainJoin } from "@/lib/calendar/month";
import { getEventDateKey } from "@/lib/calendar/month";
import type { PublicScheduleEvent, StudioScheduleEvent } from "@/lib/domain/schedule-types";

type AnyEvent = PublicScheduleEvent | StudioScheduleEvent;

export function chainCurveKey(fromId: string, toId: string) {
  return `${fromId}>${toId}`;
}

// 곡선·줄바뀜으로 이어 받은 카드의 작은 꼬리표. 띠(같은 줄)는 붙어 보이니 꼬리표가 없다.
// 줄바뀜(토→일)은 앞 카드가 윗줄에 있어 "N일부터"로 어디서 왔는지 알려 준다.
export function chainContLabel(join: ChainJoin | undefined, isoDate: string): string | null {
  const left = join?.left;
  if (!left || left.kind === "band") return null;
  if (left.kind === "curve") return "이어서";
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCDate()}일부터`;
}

// 카드에 다는 data-* — 높이 맞춤 묶음(data-chain), 같은 글 띠 머리(data-band-head), 곡선 양끝(data-curve-*).
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
    "data-curve-from":
      join?.right?.kind === "curve" ? chainCurveKey(event.id, join.right.otherId) : undefined,
    "data-curve-to":
      join?.left?.kind === "curve" ? chainCurveKey(join.left.otherId, event.id) : undefined
  };
}

// 이 칸에서 출발하는 곡선을 담는 층. 좌표는 useEqualChainHeights가 레이아웃이 바뀔 때마다 채운다.
export function ChainCurveLayer({
  events,
  joins
}: {
  events: AnyEvent[];
  joins: Map<string, ChainJoin>;
}) {
  const keys: string[] = [];
  for (const e of events) {
    const right = joins.get(e.id)?.right;
    if (right?.kind === "curve") keys.push(chainCurveKey(e.id, right.otherId));
  }
  if (keys.length === 0) return null;
  return <svg aria-hidden="true" className="chain-curves" data-curve-svg={keys.join(" ")} />;
}
