"use client";

import { Archive, CalendarRange } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { RowLabel, SettingsSegment } from "@/components/shared/settings-controls";
import type { ArchiveMonth } from "@/lib/insights/archive";
import { announceIfStaleDeployment } from "@/lib/net/stale-deploy";
import {
  buildInsightsArchiveAction,
  getInsightsArchiveAction,
  listInsightsArchiveYearsAction
} from "@/lib/insights/archive-actions";

// 지난 해 인사이트(설정 창 '개발자' 탭, 개발자 전용, 0160). 연간 아카이브의 **숫자**를 같은 인사이트 화면으로 다시 그린다.
// 1월 1일(KST) 자동으로 지난해가 채워지고, '지금 만들기'는 올해(지난달까지)·지난해를 시험으로 계산한다.
// 이 묶음이 그려질 때만 서버를 부른다. 인사이트 화면 코드는 고를 때만 불러온다.
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

  useEffect(() => {
    let alive = true;
    listInsightsArchiveYearsAction()
      .then((r) => {
        if (!alive) return;
        if (!r.ok) return setError(r.error);
        setYears(r.years);
        setYear((y) => y ?? r.years[0] ?? null);
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
    getInsightsArchiveAction(year)
      .then((r) => {
        if (!alive) return;
        if (!r.ok) return setError(r.error);
        setError(null);
        setMonths(r.months);
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

  return (
    <>
      <h3 className="rhh-group-title rhh-subgroup-title">지난 해 인사이트</h3>
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
            disabled={year === null || building !== null}
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
      <p className="rhh-group-foot">
        {error ??
          (months && months.length === 0
            ? "이 해는 아직 아카이브가 없어요. 1월 1일에 지난해가 자동으로 저장돼요."
            : "매년 1월 1일 지난해 달별 숫자를 저장하고, 2월 1일부터 그 해 원본 기록을 지워요.")}
      </p>
      {picked && year !== null ? (
        <div className="rhh-archive-view">
          <InsightsDashboard archived={picked.payload} key={`${year}-${picked.month}`} month={picked.month} year={year} />
        </div>
      ) : null}
    </>
  );
}
