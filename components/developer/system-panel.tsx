"use client";

import { CircleAlert, Code2, Gauge, GitCommitHorizontal, ShieldCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { RowLabel, SettingsSegment } from "@/components/shared/settings-controls";
import { PlainEmail } from "@/components/ui/plain-email";
import { getSystemInfoAction, type SystemInfo } from "@/lib/insights/actions";
import { getPerfStatsAction, type PerfStatRow } from "@/lib/insights/perf-actions";
import { announceIfStaleDeployment } from "@/lib/net/stale-deploy";
import { LoadingState } from "@/components/shared/loading-state";

// 시스템 묶음(설정 창 '개발자' 탭, 개발자 전용) — 계정 연결·배포 버전·서버 성능.
// 2026-11-13 인사이트 '시스템' 탭에서 옮겼다. 이 묶음이 화면에 그려질 때만 서버를 부른다.

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCMonth() + 1}.${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

function EmailList({ emails }: { emails: string[] }) {
  if (emails.length === 0) return <span className="rhh-val">없음</span>;
  return (
    <span className="rhh-val rhh-val-list">
      {emails.map((e) => (
        <PlainEmail key={e} value={e} />
      ))}
    </span>
  );
}

export function SystemPanel() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [infoError, setInfoError] = useState(false);
  const [perf, setPerf] = useState<PerfStatRow[] | null>(null);
  const [perfHours, setPerfHours] = useState(24);
  const [perfLoading, setPerfLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getSystemInfoAction()
      .then((r) => {
        if (!alive) return;
        if (r.ok) setInfo(r.data);
        else setInfoError(true);
      })
      .catch((error) => {
        announceIfStaleDeployment(error);
        if (alive) setInfoError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 서버 성능 통계 — 시간창 변경 시 다시 부른다.
  useEffect(() => {
    let alive = true;
    setPerfLoading(true);
    getPerfStatsAction(perfHours)
      .then((r) => {
        if (!alive) return;
        setPerf(r.ok ? r.rows : null);
        setPerfLoading(false);
      })
      .catch((error) => {
        announceIfStaleDeployment(error);
        if (alive) {
          setPerf(null);
          setPerfLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [perfHours]);

  // 받는 중엔 공용 기다림 표시(고리+문구), 실패하면 그 자리에 문구.
  const pending = infoError ? "불러오지 못했어요" : <LoadingState variant="inline" />;

  return (
    <>
      <h3 className="rhh-group-title rhh-subgroup-title">시스템</h3>
      <div className="rhh-group-card">
        {info && !info.bindingOk ? (
          <div className="role-help-haptics">
            <RowLabel icon={<CircleAlert size={15} />} tone="rose">
              관리자 연결 불일치
            </RowLabel>
            <span className="rhh-val">{info.dbOwnerEmail ? <PlainEmail value={info.dbOwnerEmail} /> : "DB 관리자 없음"}</span>
          </div>
        ) : null}
        <div className="role-help-haptics">
          <RowLabel icon={<ShieldCheck size={15} />} tone="metal">
            관리자 계정
          </RowLabel>
          {info ? <EmailList emails={info.ownerEmails} /> : <span className="rhh-val">{pending}</span>}
        </div>
        <div className="role-help-haptics">
          <RowLabel icon={<Code2 size={15} />} tone="metal">
            개발자 계정
          </RowLabel>
          {info ? <EmailList emails={info.developerEmails} /> : <span className="rhh-val">{pending}</span>}
        </div>
        <div className="role-help-haptics">
          <RowLabel icon={<GitCommitHorizontal size={15} />} tone="metal">
            버전(커밋)
          </RowLabel>
          {/* 고정폭 글꼴은 커밋 해시에만 — 안내 문구("불러오지 못했어요"·"로컬")는 옆 줄들과 같은 글꼴. */}
          <span className={info?.commit ? "rhh-val rhh-val-mono" : "rhh-val"}>{info ? (info.commit ?? "로컬") : pending}</span>
        </div>
        <div className="role-help-haptics">
          <RowLabel icon={<Clock3 size={15} />} tone="metal">
            배포 시각
          </RowLabel>
          <span className="rhh-val">{info ? fmtDateTime(info.deployedAt) : pending}</span>
        </div>
      </div>
      {info && !info.bindingOk ? (
        <p className="rhh-group-foot">등록된 관리자와 실제 DB 관리자가 달라요 — 관리자 저장이 실패할 수 있어요.</p>
      ) : null}

      {/* 서버 성능 — 구간별 응답시간(p95 느린 순). "여기가 평소보다 느리다"를 본다. */}
      <div className="rhh-group-card">
        <div className="role-help-haptics">
          <RowLabel icon={<Gauge size={15} />} tone="metal">
            서버 성능
          </RowLabel>
          <SettingsSegment<number>
            ariaLabel="서버 성능 시간 범위"
            dataAct="perf-hours"
            onChange={setPerfHours}
            options={[
              { value: 24, label: "24시간", opt: "day" },
              { value: 168, label: "7일", opt: "week" }
            ]}
            value={perfHours}
          />
        </div>
        <div className="rhh-perf" aria-busy={perfLoading}>
          {perf === null ? (
            perfLoading ? (
              <LoadingState className="rhh-val" variant="inline" />
            ) : (
              <p className="rhh-val">성능 정보를 불러오지 못했어요.</p>
            )
          ) : perf.length === 0 ? (
            <p className="rhh-val">아직 표본이 없어요 — 요청이 쌓이면 채워져요.</p>
          ) : (
            <div className={`perf-table${perfLoading ? " is-loading" : ""}`}>
              <div className="perf-row perf-thead">
                <span>구간</span>
                <span title="전체 요청 중 균등 추출한 표본 수">표본</span>
                <span>평균</span>
                <span>p95</span>
                <span>최대</span>
              </div>
              {perf.map((r) => (
                <div className="perf-row" key={r.label}>
                  <span className="perf-label" title={r.label}>
                    {r.label}
                  </span>
                  <span className="perf-num">{r.n}</span>
                  <span className="perf-num">{r.avgMs}</span>
                  <span
                    className="perf-num perf-p95"
                    data-slow={r.p95Ms >= 300 ? "" : undefined}
                    data-warn={r.p95Ms >= 120 && r.p95Ms < 300 ? "" : undefined}
                  >
                    {r.p95Ms}
                  </span>
                  <span className="perf-num">{r.maxMs}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="rhh-group-foot">단위 ms · p95 = 느린 5% 기준선(빨강 ≥300, 주황 ≥120)</p>
    </>
  );
}
