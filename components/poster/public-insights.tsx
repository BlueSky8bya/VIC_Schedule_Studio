"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent
} from "@/lib/domain/schedule-types";
import type { PublicBroadcastMonth } from "@/lib/schedules/public-loader";
import { hapticTick } from "@/lib/ui/haptics";

// 시청자(비로그인 포함)용 '이 달 기록'.
//
// 공개 경계: 여기 들어오는 데이터는 전부 공개 로더에서 온 것뿐이다 — 공개 일정, 태그, 하트 집계,
// 그리고 집계만 내주는 RPC의 방송 시간(get_public_broadcast_stats, 0049). 방문자 수·동시 접속
// (visit_session/presence_ping)은 운영 지표라 절대 넣지 않는다. 관리자 인사이트의 '하이라이트'는
// 방문 데이터 기반이므로, 공개판 하이라이트는 공개 데이터(인기 일정·요일·방송)로 다시 구성했다.
//
// 숫자 정책: 하트는 '개수'를 절대 노출하지 않는다(1위 대비 비율 막대만). 방송 시간·일수는
// 토리님이 공개하기로 한 값이라 그대로 보여준다.

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  year: number;
  month: number;
  events: PublicScheduleEvent[]; // 공개 일정 전체(모든 달)
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  heartCounts: Record<string, number>;
  broadcast: PublicBroadcastMonth[];
  onClose: () => void;
};

function ym(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}
function monthOf(event: PublicScheduleEvent) {
  return event.startsAt.slice(0, 7); // "YYYY-MM"
}
function hoursText(h: number) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}분`;
  return mm === 0 ? `${hh}시간` : `${hh}시간 ${mm}분`;
}

export function PublicInsights({
  year,
  month,
  events,
  tags,
  palette,
  heartCounts,
  broadcast,
  onClose
}: Props) {
  // ESC로 닫기(웹) — 시트/모달 공통 관례.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = useMemo(() => {
    const thisYm = ym(year, month);
    const prevYm = month === 1 ? ym(year - 1, 12) : ym(year, month - 1);
    // 업 도움(캠페인성)은 '방송 콘텐츠'가 아니므로 일정 통계에서 뺀다.
    const monthEvents = events.filter((e) => monthOf(e) === thisYm && !e.isSupport);
    const prevEvents = events.filter((e) => monthOf(e) === prevYm && !e.isSupport);

    // 일정이 있는 날 / 쉬는 날
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysWith = new Set(monthEvents.map((e) => e.startsAt.slice(0, 10))).size;

    // 요일 분포 → 가장 바쁜 요일
    const byWeekday = new Array(7).fill(0) as number[];
    for (const e of monthEvents) {
      const [y, m, d] = e.startsAt.slice(0, 10).split("-").map(Number);
      byWeekday[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] += 1;
    }
    const busiestWeekday = byWeekday.some((n) => n > 0)
      ? byWeekday.indexOf(Math.max(...byWeekday))
      : null;

    // 대분류(부모) 태그로 롤업 — 세부 태그는 부모 색·이름을 상속한다(2계층 규칙).
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const rootOf = (id: string): BroadcastTag | null => {
      let cur = tagById.get(id) ?? null;
      let guard = 0;
      while (cur?.parentId && guard++ < 5) {
        cur = tagById.get(cur.parentId) ?? null;
      }
      return cur;
    };
    const colorOf = (key: string) => palette.find((p) => p.key === key);
    const tagCount = new Map<string, number>();
    for (const e of monthEvents) {
      const roots = new Set<string>();
      for (const id of e.tagIds) {
        const root = rootOf(id);
        // 방식(modifier) 태그는 '무엇을 했나'가 아니라 '어떻게'라서 콘텐츠 분포에서 뺀다.
        if (root && root.kind !== "modifier") roots.add(root.id);
      }
      for (const id of roots) tagCount.set(id, (tagCount.get(id) ?? 0) + 1);
    }
    const tagTotal = [...tagCount.values()].reduce((a, b) => a + b, 0);
    const distribution = [...tagCount.entries()]
      .map(([id, count]) => {
        const tag = tagById.get(id);
        const color = tag ? colorOf(tag.colorKey) : undefined;
        return {
          id,
          name: tag?.displayName ?? "기타",
          ratio: tagTotal > 0 ? count / tagTotal : 0,
          bg: color?.bgColor ?? "#e5e7eb",
          border: color?.borderColor ?? "#d1d5db"
        };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 6);

    // 인기 일정 TOP 3 — 하트 '개수'는 노출하지 않고, 1위 대비 비율 막대만 보여준다.
    const ranked = monthEvents
      .map((e) => ({ id: e.id, title: e.publicTitle.split("\n")[0], count: heartCounts[e.id] ?? 0 }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const topCount = ranked[0]?.count ?? 0;
    const popular = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      ratio: topCount > 0 ? r.count / topCount : 0
    }));

    // 방송 기록(이 달) + 최근 6개월 트렌드
    const thisMonthBroadcast = broadcast.find((b) => b.ym === thisYm) ?? null;
    const maxHours = broadcast.reduce((m, b) => Math.max(m, b.hours), 0);
    const trend = broadcast.map((b) => ({
      ym: b.ym,
      label: `${Number(b.ym.slice(5, 7))}월`,
      // 트렌드는 '비율'로만 — 정확한 숫자는 이 달 카드에서 한 번만 보여준다(중복 제거).
      ratio: maxHours > 0 ? b.hours / maxHours : 0,
      isCurrent: b.ym === thisYm
    }));

    // 다음 방송(오늘 이후 가장 가까운 공개 일정)
    const todayKey = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const upcoming = events
      .filter((e) => !e.isSupport && e.startsAt.slice(0, 10) >= todayKey)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

    return {
      count: monthEvents.length,
      prevCount: prevEvents.length,
      daysWith,
      restDays: Math.max(0, daysInMonth - daysWith),
      busiestWeekday,
      distribution,
      popular,
      thisMonthBroadcast,
      trend,
      upcoming: upcoming
        ? {
            dateKey: upcoming.startsAt.slice(0, 10),
            title: upcoming.publicTitle.split("\n")[0]
          }
        : null
    };
  }, [year, month, events, tags, palette, heartCounts, broadcast]);

  const bc = data.thisMonthBroadcast;
  const avgPerSession = bc && bc.sessions > 0 ? bc.hours / bc.sessions : 0;
  const delta = data.count - data.prevCount;

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
          <div>
            <strong>
              {year}년 {String(month).padStart(2, "0")}월 기록
            </strong>
            <em>빅토리의 이 달을 숫자로</em>
          </div>
          <button aria-label="닫기" className="pi-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="pi-body">
          {/* 1. 방송 기록 — 팬이 가장 궁금해하는 "얼마나 켰나". 유일하게 정확한 수치를 쓴다. */}
          <div className="pi-card pi-broadcast">
            <span className="pi-label">방송 기록</span>
            {bc && bc.days > 0 ? (
              <div className="pi-stats">
                <div className="pi-stat">
                  <b>{bc.days}일</b>
                  <span>방송한 날</span>
                </div>
                <div className="pi-stat">
                  <b>{hoursText(bc.hours)}</b>
                  <span>총 방송 시간</span>
                </div>
                <div className="pi-stat">
                  <b>{hoursText(avgPerSession)}</b>
                  <span>평균 한 방송</span>
                </div>
              </div>
            ) : (
              <p className="pi-empty">아직 이 달 방송 기록이 없어요 🍃</p>
            )}
          </div>

          {/* 2. 일정 — 개수·쉬는 날·요일 패턴·다음 방송 */}
          <div className="pi-card">
            <span className="pi-label">일정</span>
            <div className="pi-stats">
              <div className="pi-stat">
                <b>{data.count}개</b>
                <span>
                  공개 일정
                  {delta !== 0 ? (
                    <i className={delta > 0 ? "up" : "down"}>
                      {delta > 0 ? "▲" : "▼"} 지난달 대비
                    </i>
                  ) : null}
                </span>
              </div>
              <div className="pi-stat">
                <b>{data.restDays}일</b>
                <span>일정 없는 날</span>
              </div>
              <div className="pi-stat">
                <b>
                  {data.busiestWeekday != null ? `${WEEKDAY_LABEL[data.busiestWeekday]}요일` : "—"}
                </b>
                <span>가장 바쁜 요일</span>
              </div>
            </div>
            {data.upcoming ? (
              <p className="pi-next">
                <span>다음 방송</span>
                <strong>
                  {Number(data.upcoming.dateKey.slice(8, 10))}일 · {data.upcoming.title}
                </strong>
              </p>
            ) : null}
          </div>

          {/* 3. 콘텐츠 분포 — 대분류 비율만(개수 미노출) */}
          {data.distribution.length > 0 ? (
            <div className="pi-card">
              <span className="pi-label">일정 구성</span>
              <div className="pi-dist">
                {data.distribution.map((d) => (
                  <div className="pi-dist-row" key={d.id}>
                    <span className="pi-dist-name">
                      <i style={{ background: d.bg, borderColor: d.border }} />
                      {d.name}
                    </span>
                    <span className="pi-bar">
                      <i style={{ width: `${Math.round(d.ratio * 100)}%`, background: d.bg }} />
                    </span>
                    <b>{Math.round(d.ratio * 100)}%</b>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 4. 인기 일정 — 하트 수는 안 보여준다. 1위 대비 비율 막대만. */}
          {data.popular.length > 0 ? (
            <div className="pi-card">
              <span className="pi-label">팬들이 많이 누른 일정</span>
              <ol className="pi-top">
                {data.popular.map((p, i) => (
                  <li key={p.id}>
                    <span className="pi-rank">{["🥇", "🥈", "🥉"][i]}</span>
                    <span className="pi-top-title">{p.title}</span>
                    <span className="pi-bar heart">
                      <i style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
              <p className="pi-note">♥ 수는 비밀 — 1위 대비 비율만 보여줘요.</p>
            </div>
          ) : null}

          {/* 5. 트렌드 — 최근 6개월 방송량(비율 막대, 숫자 없음) */}
          {data.trend.length > 1 ? (
            <div className="pi-card">
              <span className="pi-label">최근 6개월 방송량</span>
              <div className="pi-trend">
                {data.trend.map((t) => (
                  <div className={`pi-trend-col${t.isCurrent ? " now" : ""}`} key={t.ym}>
                    <span className="pi-trend-bar">
                      <i style={{ height: `${Math.max(6, Math.round(t.ratio * 100))}%` }} />
                    </span>
                    <span className="pi-trend-label">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
