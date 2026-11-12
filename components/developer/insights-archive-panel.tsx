"use client";

import { Archive, CalendarRange } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { RowLabel, SettingsSegment } from "@/components/shared/settings-controls";
import type { ArchiveMonth } from "@/lib/insights/archive";
// archive.ts는 서버 전용 모듈을 끌어오므로 값은 여기서만 따로 둔다(lib/insights/archive.ts STATS_START_YEAR와 같다).
const STATS_START_YEAR = 2026;
import { announceIfStaleDeployment } from "@/lib/net/stale-deploy";
import {
  buildInsightsArchiveAction,
  getInsightsArchiveAction,
  listInsightsArchiveYearsAction
} from "@/lib/insights/archive-actions";

// 연간 인사이트 보관함(설정 창 '개발자' 탭, 개발자 전용, 0160·0164). 보관된 **숫자**를 같은 인사이트 화면으로 다시 그린다.
// 한 해 통째로만 만든다(2026-11-13 소유자) — 1월 1일(KST) 자동으로 지난해가 채워지고, 버튼은 12월 31일이 지난 해에만 켜진다.
// 연도는 첫 일정이 있는 해부터 올해까지. 이 묶음이 그려질 때만 서버를 부른다. 인사이트 화면 코드는 고를 때만 불러온다.
const InsightsDashboard = dynamic(
  () => import("@/components/developer/insights-dashboard").then((m) => m.InsightsDashboard),
  { ssr: false, loading: () => <p className="rhh-val">불러오는 중…</p> }
);

export function InsightsArchivePanel() {
  const [years, setYears] = useState<number[] | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [months, setMonths] = useState<ArchiveMonth[] | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [canBuild, setCanBuild] = useState(false);

  useEffect(() => {
    let alive = true;
    listInsightsArchiveYearsAction()
      .then((r) => {
        if (!alive) return;
        if (!r.ok) return setError(r.error);
        setYears(r.years);
        setCurrentYear(r.currentYear);
        // 처음엔 가장 최근에 끝난 해 — 올해는 아직 만들 수 없다.
        setYear((y) => y ?? r.years.find((x) => x < r.currentYear) ?? r.years[0] ?? null);
      })
      .catch((error) => {
        announceIfStaleDeployment(error);
        if (alive) setError("아카이브 목록을 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (year === null) return;
    let alive = true;
    setMonths(null);
    setCanBuild(false);
    getInsightsArchiveAction(year)
      .then((r) => {
        if (!alive) return;
        if (!r.ok) return setError(r.error);
        setError(null);
        setMonths(r.months);
        setCanBuild(r.canBuild);
        setMonth((m) => (m !== null && r.months.some((x) => x.month === m) ? m : (r.months.at(-1)?.month ?? null)));
      })
      .catch((error) => {
        announceIfStaleDeployment(error);
        if (alive) setError("아카이브를 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [year, reload]);

  async function build() {
    if (year === null || building) return;
    setBuilding("계산하는 중…");
    setError(null);
    let only: number[] | undefined;
    let total = 0;
    try {
      // 한 번에 약 20초 — 남은 달이 있으면 이어서. 한 달도 못 만들면 멈춘다(무한 반복 방지).
      for (let guard = 0; guard < 12; guard++) {
        const r = await buildInsightsArchiveAction(year, only);
        if (!r.ok) {
          setError(r.error);
          break;
        }
        total += r.report.built.length;
        setBuilding(`${total}달 만들었어요…`);
        if (r.report.failed.length) setError(`${r.report.failed.join("·")}월은 계산하지 못했어요. 다시 눌러 주세요.`);
        if (!r.report.remaining.length || !r.report.built.length) break;
        only = r.report.remaining;
      }
    } catch (error) {
      announceIfStaleDeployment(error);
      setError("아카이브를 만들지 못했어요.");
    }
    setBuilding(null);
    setReload((n) => n + 1);
  }

  const picked = months?.find((m) => m.month === month) ?? null;
  const yearOpen = year !== null && currentYear !== null && year >= currentYear;
  const footnote =
    error ??
    (yearOpen
      ? "12월 31일이 지나야 만들 수 있어요."
      : months && months.length === 0
        ? year !== null && year < STATS_START_YEAR
          ? "아직 보관된 기록이 없어요. 이 해는 방문 통계 전이라 일정 숫자만 담겨요."
          : "아직 보관된 기록이 없어요. 1월 1일에 지난해가 자동으로 보관돼요."
        : months && months.length > 0 && !canBuild
          ? "원본 기록을 정리한 해라 다시 만들 수 없어요."
          : "매년 1월 1일 지난해를 통째로 보관하고, 2월 1일 뒤(보관 30일 후) 그 해 원본 기록을 지워요.");

  return (
    <>
      <h3 className="rhh-group-title rhh-subgroup-title">연간 인사이트 보관함</h3>
      <div className="rhh-group-card">
        <div className="role-help-haptics">
          <RowLabel icon={<CalendarRange size={15} />} tone="metal">
            연도
          </RowLabel>
          {years && year !== null ? (
            <SettingsSegment<number>
              ariaLabel="아카이브 연도"
              dataAct="insights-archive-year"
              onChange={(y) => {
                setYear(y);
                setMonth(null);
              }}
              options={years.map((y) => ({ value: y, label: `${y}`, opt: String(y) }))}
              value={year}
            />
          ) : (
            <span className="rhh-val">{error ?? "불러오는 중…"}</span>
          )}
        </div>
        <div className="role-help-haptics">
          <RowLabel icon={<Archive size={15} />} tone="metal">
            아카이브
          </RowLabel>
          <button
            className="rhh-link"
            data-act="insights-archive-build"
            disabled={year === null || building !== null || !canBuild}
            onClick={build}
            type="button"
          >
            {building ?? (months?.length ? "다시 만들기" : "지금 만들기")}
          </button>
        </div>
        {months && months.length > 0 ? (
          <div className="role-help-haptics rhh-archive-months">
            <SettingsSegment<number>
              ariaLabel="아카이브 달"
              columns={6}
              dataAct="insights-archive-month"
              onChange={setMonth}
              options={months.map((m) => ({ value: m.month, label: `${m.month}월`, opt: String(m.month) }))}
              value={month ?? months[0].month}
            />
          </div>
        ) : null}
      </div>
      <p className="rhh-group-foot">{footnote}</p>
      {picked && year !== null ? (
        <div className="rhh-archive-view">
          <InsightsDashboard archived={picked.payload} key={`${year}-${picked.month}`} month={picked.month} year={year} />
        </div>
      ) : null}
    </>
  );
}
