"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent
} from "@/lib/domain/schedule-types";
import type { TrendStack } from "@/lib/insights/actions";
import type { PublicBroadcastMonth } from "@/lib/schedules/public-loader";
import { BroadcastHours } from "@/components/studio/broadcast-hours";
import { HighlightCards, type HighlightCard } from "@/components/studio/highlight-cards";
import { StackTrendChart } from "@/components/studio/stack-trend-chart";
import { hapticTick } from "@/lib/ui/haptics";

// 시청자(비로그인 포함)용 '이 달 기록'.
//
// 관리자 인사이트와 '같은 차트 컴포넌트'를 그대로 쓴다(BroadcastHours / StackTrendChart /
// HighlightCards) — 디자인이 두 갈래로 갈라지지 않게. 다른 건 데이터 출처와 노출 수위뿐이다.
//
// 공개 경계: 여기 오는 데이터는 전부 공개 로더에서 온 것뿐이다 — 공개 일정, 태그, 하트 집계,
// 그리고 집계만 내주는 RPC의 방송 시간(0049 월별 / 0050 일별). 방문자 수·동시 접속
// (visit_session·presence_ping)은 운영 지표라 절대 넣지 않는다 → 관리자 '하이라이트'의 방문
// 최다일/최고 방문 시간대는 공개판에 없고, 공개 데이터(인기 일정·요일·방송)로 대체했다.
//
// 숫자 정책: 하트 '개수'는 노출하지 않는다(1위 대비 비율 막대 · 하트 태그 차트도 showNumbers=false).
// 방송 시간·일수·컨텐츠 수는 토리님이 공개하기로 한 값이라 그대로 보여준다.

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
// "휴뱅"(방송 안 하는 날) 태그가 붙은 일정은 컨텐츠·다음 방송 집계에서 뺀다 — 관리자 인사이트의
// REST_TAG 규칙과 동일(lib/insights/actions.ts). 휴뱅은 '휴뱅 날' 수로만 센다.
const REST_TAG = "휴뱅";

type Props = {
  year: number;
  month: number;
  events: PublicScheduleEvent[]; // 공개 일정 전체(모든 달)
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  heartCounts: Record<string, number>;
  onClose: () => void;
};

function ymOf(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}
function monthsBack(year: number, month: number, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function weekdayOf(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function PublicInsights({
  year,
  month,
  events,
  tags,
  palette,
  heartCounts,
  onClose
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 방송 기록(집계)은 시트를 열 때 공개 API에서 가져온다 — 어느 화면(공개 포스터·꾸미기·편집실
  // 미리보기)에서 열어도 같은 값이 뜬다(예전엔 페이지가 prop으로 넘겨줘야 해서, 미리보기·꾸미기에선
  // "방송 기록 없음"으로 비어 보였다). 시청자 첫 페인트엔 아무 비용도 없다.
  const [broadcast, setBroadcast] = useState<PublicBroadcastMonth[]>([]);
  const [broadcastDaily, setBroadcastDaily] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/public/vic/broadcast?year=${year}&month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json) return;
        setBroadcast(Array.isArray(json.months) ? json.months : []);
        setBroadcastDaily(Array.isArray(json.daily) ? json.daily : []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, month]);

  const d = useMemo(() => {
    const months = monthsBack(year, month, 6);
    const thisYm = ymOf(year, month);

    // 태그 롤업(세부 → 최상위 대분류). 색은 팔레트에서.
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const rootOf = (id: string): BroadcastTag | null => {
      let cur = tagById.get(id) ?? null;
      let guard = 0;
      while (cur?.parentId && guard++ < 5) cur = tagById.get(cur.parentId) ?? null;
      return cur;
    };
    const colorOf = (key: string) =>
      palette.find((p) => p.key === key)?.bgColor ?? "#e5e7eb";

    // 휴뱅 일정(= 방송 안 함) 판별 — 컨텐츠·다음 방송에서 제외.
    const isRest = (e: PublicScheduleEvent) =>
      e.tagIds.some((id) => rootOf(id)?.displayName === REST_TAG);

    const inMonth = (e: PublicScheduleEvent, ym: string) => e.startsAt.slice(0, 7) === ym;
    const contentEvents = events.filter((e) => !e.isSupport && !isRest(e));
    const monthContent = contentEvents.filter((e) => inMonth(e, thisYm));
    const monthRest = events.filter((e) => !e.isSupport && isRest(e) && inMonth(e, thisYm));

    // 요일 분포(컨텐츠 기준) → 바쁜 요일 / 한가한 요일
    const byWeekday = new Array(7).fill(0) as number[];
    for (const e of monthContent) byWeekday[weekdayOf(e.startsAt.slice(0, 10))] += 1;
    const anyContent = byWeekday.some((n) => n > 0);
    const busiestWeekday = anyContent ? byWeekday.indexOf(Math.max(...byWeekday)) : null;
    const quietestWeekday = anyContent ? byWeekday.indexOf(Math.min(...byWeekday)) : null;

    // 6개월 시리즈(컨텐츠 수 / 하트 합계)
    const contentSeries = months.map(
      (ym) => contentEvents.filter((e) => inMonth(e, ym)).length
    );
    const heartSeries = months.map((ym) =>
      events
        .filter((e) => !e.isSupport && inMonth(e, ym))
        .reduce((sum, e) => sum + (heartCounts[e.id] ?? 0), 0)
    );

    // 누적 막대(관리자와 같은 StackTrendChart) — 콘텐츠별 / 형식별 / 하트 받은 태그
    const buildStack = (
      pick: (e: PublicScheduleEvent) => string[],
      weight: (e: PublicScheduleEvent) => number,
      kind: "content" | "modifier"
    ): TrendStack => {
      const catMap = new Map<string, { key: string; label: string; color: string }>();
      const monthRows = months.map((ym) => {
        const counts: Record<string, number> = {};
        let total = 0;
        for (const e of events.filter((ev) => !ev.isSupport && inMonth(ev, ym))) {
          const w = weight(e);
          if (w <= 0) continue;
          for (const rootId of new Set(pick(e))) {
            const tag = tagById.get(rootId);
            if (!tag) continue;
            const isModifier = tag.kind === "modifier";
            if ((kind === "modifier") !== isModifier) continue;
            if (!catMap.has(rootId)) {
              catMap.set(rootId, {
                key: rootId,
                label: tag.displayName,
                color: colorOf(tag.colorKey)
              });
            }
            counts[rootId] = (counts[rootId] ?? 0) + w;
            total += w;
          }
        }
        return { ym, counts, total };
      });
      return { cats: [...catMap.values()], months: monthRows };
    };
    const rootsOf = (e: PublicScheduleEvent) =>
      e.tagIds.map((id) => rootOf(id)?.id).filter((id): id is string => Boolean(id));

    const contentByTag = buildStack(rootsOf, () => 1, "content");
    const modifierByTag = buildStack(rootsOf, () => 1, "modifier");
    const heartsByTag = buildStack(rootsOf, (e) => heartCounts[e.id] ?? 0, "content");

    // 방송 시간(6개월) — 없는 달은 0으로 채워 months와 길이를 맞춘다.
    const hoursByYm = new Map(broadcast.map((b) => [b.ym, b.hours]));
    const broadcastHours = months.map((ym) => hoursByYm.get(ym) ?? 0);
    const broadcastDays = broadcastDaily.filter((h) => h > 0).length;

    // 인기 일정 TOP 3 — 하트 개수는 숨기고 1위 대비 비율만.
    const ranked = monthContent
      .map((e) => ({
        id: e.id,
        title: e.publicTitle.split("\n")[0],
        count: heartCounts[e.id] ?? 0
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const topCount = ranked[0]?.count ?? 0;
    const popular = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      ratio: topCount > 0 ? r.count / topCount : 0
    }));

    // 다음 방송 — 휴뱅·업도움 제외, 오늘(KST) 이후 가장 가까운 공개 일정.
    const todayKey = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const next = contentEvents
      .filter((e) => e.startsAt.slice(0, 10) >= todayKey)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

    return {
      months,
      contentCount: monthContent.length,
      contentDays: new Set(monthContent.map((e) => e.startsAt.slice(0, 10))).size,
      restDays: new Set(monthRest.map((e) => e.startsAt.slice(0, 10))).size,
      busiestWeekday,
      quietestWeekday,
      contentSeries,
      heartSeries,
      contentByTag,
      modifierByTag,
      heartsByTag,
      broadcastHours,
      broadcastDays,
      popular,
      next: next
        ? { dateKey: next.startsAt.slice(0, 10), title: next.publicTitle.split("\n")[0] }
        : null
    };
  }, [year, month, events, tags, palette, heartCounts, broadcast, broadcastDaily]);

  // 하이라이트 — 공개 데이터만(방문 기반 카드는 뺀다).
  const highlights: HighlightCard[] = [
    {
      key: "top",
      emoji: "💗",
      tone: "top",
      label: ["인기", "컨텐츠"],
      main: d.popular[0]?.title ?? "—"
    },
    {
      key: "wd",
      emoji: "🔥",
      tone: "wd",
      label: ["컨텐츠", "최다요일"],
      main: "",
      sub: d.busiestWeekday !== null ? WEEKDAY[d.busiestWeekday] : "—"
    },
    {
      key: "days",
      emoji: "📺",
      tone: "day",
      label: ["이 달", "방송일"],
      main: `${d.broadcastDays}일`
    },
    {
      key: "next",
      emoji: "🗓️",
      tone: "hour",
      label: ["다음", "방송"],
      main: d.next ? `${Number(d.next.dateKey.slice(8, 10))}일` : "—",
      sub: d.next ? d.next.title : undefined
    }
  ];

  return (
    <div
      className="pi-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          hapticTick();
          onClose();
        }
      }}
      role="presentation"
    >
      <section aria-label={`${month}월 기록`} className="pi-sheet" role="dialog" aria-modal="true">
        <header className="pi-head">
          <strong>
            {year}년 {String(month).padStart(2, "0")}월 기록
          </strong>
          <button aria-label="닫기" className="pi-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="pi-body insights">
          {/* 일정 요약 — 관리자 '일정' 패널과 같은 타일 구성(휴뱅은 컨텐츠에서 빠지고 따로 센다). */}
          <div className="pi-card">
            <span className="pi-label">일정</span>
            <div className="pi-stats">
              <div className="pi-stat">
                <b>{d.contentCount}개</b>
                <span>이번 달 컨텐츠</span>
              </div>
              <div className="pi-stat">
                <b>{d.contentDays}일</b>
                <span>컨텐츠 있는 날</span>
              </div>
              <div className="pi-stat">
                <b>{d.restDays}일</b>
                <span>휴뱅 날</span>
              </div>
              <div className="pi-stat">
                <b>{d.busiestWeekday !== null ? `${WEEKDAY[d.busiestWeekday]}요일` : "—"}</b>
                <span>바쁜 요일</span>
              </div>
              <div className="pi-stat">
                <b>{d.quietestWeekday !== null ? `${WEEKDAY[d.quietestWeekday]}요일` : "—"}</b>
                <span>한가한 요일</span>
              </div>
            </div>
            <p className="pi-next">
              <span>다음 방송</span>
              <strong>
                {d.next
                  ? `${Number(d.next.dateKey.slice(8, 10))}일 · ${d.next.title}`
                  : "예정된 방송 없음"}
              </strong>
            </p>
          </div>

          {/* 방송 시간 — 관리자와 같은 BroadcastHours(6개월 막대 + 이 달 일별 막대 + 일평균). */}
          <div className="pi-card pi-broadcast">
            <span className="pi-label">방송 시간</span>
            {loading ? (
              <p className="pi-empty">방송 기록 불러오는 중…</p>
            ) : (
              <BroadcastHours
                broadcastDaily={broadcastDaily}
                broadcastDays={d.broadcastDays}
                broadcastHours={d.broadcastHours}
                months={d.months}
              />
            )}
          </div>

          {/* 인기 일정 — 하트 개수 비공개, 1위 대비 비율 막대만. */}
          {d.popular.length > 0 ? (
            <div className="pi-card">
              <span className="pi-label">빅타민들이 많이 누른 일정</span>
              <ol className="pi-top">
                {d.popular.map((p, i) => (
                  <li key={p.id}>
                    <span className="pi-rank">{["🥇", "🥈", "🥉"][i]}</span>
                    <span className="pi-top-title">{p.title}</span>
                    <span className="pi-bar heart">
                      <i style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* 6개월 추이 — 관리자와 같은 누적 막대 차트. 하트는 숫자 없이 비율만. */}
          <div className="pi-card">
            <span className="pi-label">최근 6개월</span>
            <StackTrendChart data={d.contentByTag} showLegend={false} title="🗓️ 콘텐츠별" />
            <StackTrendChart data={d.modifierByTag} showLegend={false} title="🎛️ 형식별" />
            <StackTrendChart
              data={d.heartsByTag}
              rankLabel="인기 높은 순"
              showLegend={false}
              showNumbers={false}
              title="💗 하트 받은 태그"
            />
          </div>

          {/* 하이라이트 — 관리자와 같은 카드. 방문 기반(최다 방문일·시간대)은 공개판에서 제외. */}
          <div className="pi-card">
            <span className="pi-label">하이라이트</span>
            <HighlightCards cards={highlights} />
          </div>
        </div>
      </section>
    </div>
  );
}
