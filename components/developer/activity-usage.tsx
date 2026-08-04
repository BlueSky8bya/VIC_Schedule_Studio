"use client";

import { useEffect, useState } from "react";
import { describeTarget } from "@/lib/activity/labels";
import { getActivityUsageAction, type UsageRow } from "@/lib/activity/query";
import { hapticTick } from "@/lib/ui/haptics";

// "적게 쓰인 기능" — 없애도 될 후보를 찾는 화면.
//
// 이 화면을 보는 사람은 대부분 코드를 모른다(관리자·매니저). 그래서:
//  - 항목 이름은 화면에 실제로 쓰인 말로, **어디에 있는지(area)** 를 함께 보여준다.
//  - 기계용 id(`auto:.stf-btn` 같은 값)는 기본으로 숨긴다 — '개발자 정보'를 켤 때만 나온다.
//  - 숫자는 "1번"처럼 단위를 붙인다. 맨 숫자는 무엇의 수인지 알기 어렵다.
//  - 맨 위 한 문장으로 "이걸 어떻게 읽으면 되는지"를 말한다.

const RANGES = [7, 30, 90];

// 종류는 사람 말로. '패널'은 개발 용어라 '창'으로 부른다.
const KIND_CHIP: Record<string, { short: string; tone: string }> = {
  "ui.click": { short: "버튼", tone: "btn" },
  "section.enter": { short: "창", tone: "panel" },
  "route.enter": { short: "화면", tone: "route" }
};
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "ui.click", label: "버튼" },
  { key: "route.enter", label: "화면" },
  { key: "section.enter", label: "창" }
];

export function ActivityUsage({ anchor }: { anchor: string }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [kind, setKind] = useState("all");
  const [dev, setDev] = useState(false); // 개발자 정보(원래 id) 표시
  const [copied, setCopied] = useState(false);
  const [span, setSpan] = useState<{ since: string; until: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    // 기준일은 보고 있는 날 — 8/4 창을 열면 8/4로 끝나는 N일이다(오늘까지가 아니라).
    getActivityUsageAction(days, anchor)
      .then((r) => {
        if (!alive) return;
        if (r.ok) {
          setRows(r.rows);
          setSpan({ since: r.since, until: r.until });
        } else setErr(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [days, anchor]);

  const filtered = rows ? (kind === "all" ? rows : rows.filter((r) => r.kind === kind)) : [];
  const shown = showAll ? filtered : filtered.slice(0, 15);
  const max = filtered.length > 0 ? Math.max(...filtered.map((r) => r.total)) : 1;

  // 붙여넣어 공유·점검할 수 있는 평문. **여기엔 원래 id를 반드시 포함한다** — 화면에선 숨기지만
  // "이 항목 이름이 왜 이래?" 같은 문제를 찾으려면 원본이 있어야 한다.
  const copyText = () => {
    const head = `사용량(적은 순) ${span?.since} ~ ${span?.until} · ${days}일 · 필터=${kind}`;
    const lines = filtered.map((r) => {
      const d = describeTarget(r.kind, r.target);
      return [
        `${r.total}`.padStart(5),
        (KIND_CHIP[r.kind]?.short ?? r.kind).padEnd(3),
        (d.area ?? "-").padEnd(7),
        d.name,
        `| 운영진 ${r.internal} · 시청자 ${r.viewer}`,
        `| kind=${r.kind} target=${r.target}${d.unnamed ? " (이름미등록)" : ""}`
      ].join("  ");
    });
    return [head, `총 ${filtered.length}개`, "", ...lines].join("\n");
  };
  const copy = async () => {
    hapticTick();
    try {
      await navigator.clipboard.writeText(copyText());
      hapticTick();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="vcard">
      <header className="usage-head">
        <h4 className="insight-subhead">
          적게 쓰인 기능
          {span ? (
            <small className="usage-span">
              {span.since} ~ {span.until}
            </small>
          ) : null}
        </h4>
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
        <p className="insight-empty">아직 쌓인 기록이 없어요.</p>
      ) : (
        <>
          {/* 읽는 법을 맨 위 한 문장으로 — 표를 보고 스스로 규칙을 알아내게 두지 않는다. */}
          <p className="usage-lead">
            이 기간에 <b>거의 안 눌린 것부터</b> 나열했어요. 1~2번뿐인 항목은 없애도 될지
            생각해볼 후보예요.
          </p>
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

          <ul className="usage-list">
            {shown.map((r) => {
              const chip = KIND_CHIP[r.kind] ?? { short: "기타", tone: "btn" };
              const d = describeTarget(r.kind, r.target);
              return (
                <li key={`${r.kind}|${r.target}`} data-unnamed={d.unnamed ? "1" : undefined}>
                  <span className="usage-line1">
                    <span className="usage-chip" data-tone={chip.tone}>
                      {chip.short}
                    </span>
                    {d.area ? <span className="usage-area">{d.area}</span> : null}
                    <b className="usage-name">{d.name}</b>
                    <span className="usage-n" title={`운영진 ${r.internal}번 · 시청자 ${r.viewer}번`}>
                      {r.total}번
                    </span>
                  </span>
                  <span className="usage-line2">
                    <span className="usage-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(3, (r.total / max) * 100)}%` }} />
                    </span>
                    <span className="usage-sub">
                      {d.hint ?? ""}
                      {dev ? <code>{r.target}</code> : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="usage-actions">
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
            <button className="act-tool" data-act="usage-copy" onClick={copy} type="button">
              {copied ? "복사됨" : "전체 복사"}
            </button>
            <button
              aria-pressed={dev}
              className={`act-tool${dev ? " is-on" : ""}`}
              data-act="usage-dev"
              onClick={() => {
                hapticTick();
                setDev((v) => !v);
              }}
              type="button"
            >
              개발자 정보
            </button>
          </div>

          <p className="vt-occ-note">
            숫자는 이 기간에 눌린(들어간) 횟수예요. 숫자에 마우스를 올리면 <b>운영진</b>
            (관리자·매니저·작업자·개발자)과 <b>시청자</b>가 각각 몇 번인지 나와요. 시청자 쪽은
            숫자만 세고 누가 눌렀는지는 남기지 않아요.
          </p>
        </>
      )}
    </section>
  );
}
