"use client";

import { useEffect, useState } from "react";
import { getActivityUsageAction, type UsageRow } from "@/lib/activity/query";
import { hapticTick } from "@/lib/ui/haptics";

// 사용량(0062/0063) — "어떤 버튼·화면이 안 쓰이나". 적은 순으로 세운다: 많이 쓰이는 건 이미
// 알고 있고, 판단(없앨까?)이 필요한 건 바닥 쪽이다.
//
// 두 소스를 합친 값이다 — 내부자는 이벤트 행, 시청자·비로그인은 날짜별 카운트.
// `auto:` 표시가 붙은 항목은 마크업에서 유추한 id라 마크업이 바뀌면 통계가 갈라진다.
// 자주 보는 항목은 버튼에 `data-act="..."`를 붙여 굳히면 된다.

const RANGES = [7, 30, 90];

export function ActivityUsage() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    getActivityUsageAction(days)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setRows(r.rows);
        else setErr(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [days]);

  const shown = rows ? (showAll ? rows : rows.slice(0, 20)) : [];
  const max = rows && rows.length > 0 ? Math.max(...rows.map((r) => r.total)) : 1;

  return (
    <section className="vcard">
      <header className="usage-head">
        <h4 className="insight-subhead">사용량 — 적은 순</h4>
        <div className="usage-range" role="group" aria-label="기간">
          {RANGES.map((d) => (
            <button
              aria-pressed={days === d}
              className={days === d ? "is-on" : ""}
              data-act={`usage-range-${d}`}
              key={d}
              onClick={() => {
                hapticTick();
                setDays(d);
              }}
              type="button"
            >
              {d}일
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="act-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : err ? (
        <p className="insight-empty">{err}</p>
      ) : !rows || rows.length === 0 ? (
        <p className="insight-empty">아직 쌓인 사용 기록이 없어요.</p>
      ) : (
        <>
          <ul className="usage-list">
            {shown.map((r) => (
              <li key={`${r.kind}|${r.target}`}>
                <span className="usage-kind">{r.label}</span>
                <span className="usage-target" title={r.target}>
                  {r.target.replace(/^auto:/, "")}
                  {r.auto ? <em className="usage-auto">auto</em> : null}
                </span>
                <span className="usage-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
                </span>
                <span className="usage-n">
                  <b>{r.total}</b>
                  <em>
                    내부 {r.internal} · 시청자 {r.viewer}
                  </em>
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 20 ? (
            <button
              className="usage-more"
              data-act="usage-show-all"
              onClick={() => {
                hapticTick();
                setShowAll((v) => !v);
              }}
              type="button"
            >
              {showAll ? "접기" : `전체 ${rows.length}개 보기`}
            </button>
          ) : null}
          <p className="vt-occ-note">
            0에 가까운 항목이 후보예요. `auto` 표시는 마크업에서 유추한 이름이라 마크업이 바뀌면
            통계가 갈라져요 — 계속 볼 항목은 버튼에 <code>data-act</code>를 붙여 고정하세요.
            시청자·비로그인은 개수만 세고 개인 기록은 남기지 않아요.
          </p>
        </>
      )}
    </section>
  );
}
