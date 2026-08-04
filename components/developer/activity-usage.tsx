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

// 한 줄에 넣으려고 종류 라벨을 줄인다(칩). 색으로도 구분해 글자를 더 줄일 수 있게.
const KIND_CHIP: Record<string, { short: string; tone: string }> = {
  "ui.click": { short: "버튼", tone: "btn" },
  "section.enter": { short: "패널", tone: "panel" },
  "route.enter": { short: "화면", tone: "route" }
};
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "ui.click", label: "버튼" },
  { key: "route.enter", label: "화면" },
  { key: "section.enter", label: "패널" }
];

export function ActivityUsage() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [kind, setKind] = useState("all"); // 종류 필터 — 한 종류만 보면 비교가 쉬워진다

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

  const filtered = rows ? (kind === "all" ? rows : rows.filter((r) => r.kind === kind)) : [];
  const shown = showAll ? filtered : filtered.slice(0, 15);
  const max = filtered.length > 0 ? Math.max(...filtered.map((r) => r.total)) : 1;

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
          <div className="usage-filters" role="group" aria-label="종류">
            {FILTERS.map((f) => (
              <button
                aria-pressed={kind === f.key}
                className={kind === f.key ? "is-on" : ""}
                data-act={`usage-kind-${f.key}`}
                key={f.key}
                onClick={() => {
                  hapticTick();
                  setKind(f.key);
                  setShowAll(false);
                }}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* 한 줄 = 한 항목. 종류는 칩으로 줄이고, 운영진/시청자 내역은 숫자에 hover(title)로
              숨긴다 — 목록의 목적은 '어느 게 바닥인가'라 총합만 보이면 된다. */}
          <ul className="usage-list">
            {shown.map((r) => {
              const chip = KIND_CHIP[r.kind] ?? { short: r.label, tone: "btn" };
              return (
                <li key={`${r.kind}|${r.target}`}>
                  <span className="usage-chip" data-tone={chip.tone}>
                    {chip.short}
                  </span>
                  <span className="usage-target" title={r.target}>
                    {r.target.replace(/^auto:/, "") || "(이름 없음)"}
                    {r.auto ? <em className="usage-auto" title="마크업에서 유추한 이름" /> : null}
                  </span>
                  <span className="usage-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
                  </span>
                  <b className="usage-n" title={`운영진 ${r.internal} · 시청자 ${r.viewer}`}>
                    {r.total}
                    {r.viewer > 0 ? <em>시{r.viewer}</em> : null}
                  </b>
                </li>
              );
            })}
          </ul>
          {filtered.length > 15 ? (
            <button
              className="usage-more"
              data-act="usage-show-all"
              onClick={() => {
                hapticTick();
                setShowAll((v) => !v);
              }}
              type="button"
            >
              {showAll ? "접기" : `전체 ${filtered.length}개 보기`}
            </button>
          ) : null}
          <p className="vt-occ-note">
            0에 가까운 항목이 없앨 후보예요. 숫자는 총합(운영진+시청자) — 숫자에 마우스를 올리면
            내역이 나와요. <b>운영진</b>=관리자·매니저·작업자·개발자, <b>시청자</b>=시청자·비로그인
            (개수만 세고 개인 기록은 안 남겨요). 점(·)이 붙은 이름은 마크업에서 유추한 것이라
            마크업이 바뀌면 통계가 갈라져요 — 계속 볼 항목은 버튼에 <code>data-act</code>로 고정하세요.
          </p>
        </>
      )}
    </section>
  );
}
