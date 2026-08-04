"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { describeTarget, roleBreakdown } from "@/lib/activity/labels";
import { getActivityUsageAction, type UsageRow } from "@/lib/activity/query";
import { hapticTick } from "@/lib/ui/haptics";

// "적게 쓰인 기능" — 없애도 될 후보를 찾는 화면.
//
// 이 화면을 보는 사람은 대부분 코드를 모른다(관리자·매니저). 그래서:
//  - 이름은 화면에 실제로 쓰인 말로, **어디에 있는지(area)** 를 함께.
//  - 기계용 id는 '개발자 정보'를 켤 때만.
//  - 부연은 오해할 수 있는 줄(합쳐진 값·이름 미등록)에만 — 다 붙이면 목록만 길어진다.
//  - 막대는 따로 두지 않고 **행 배경**으로 흡수한다(줄 수 절반, 시선이 한 줄에서 끝남).

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
  // 옆 카드(행동 타임라인)와 같은 기본 상태로 둔다 — 한쪽만 접혀 있으면 그 칸이
  // 통째로 비어 보여 어색하다(2단 배치라 세로가 짧아지지도 않는다).
  const [open, setOpen] = useState(true);
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
        `| ${roleBreakdown(r.roles)}`,
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

  const lowCount = rows ? rows.filter((r) => r.total <= 2).length : 0;

  return (
    <section className="vcard">
      {/* 옆 카드와 같은 머리 형식: [접기] 제목 … 요약. 접힌 상태에도 요약이 남는다. */}
      <header className="act-head">
        <button
          aria-expanded={open}
          className="act-fold"
          data-act="usage-open"
          onClick={() => {
            hapticTick();
            setOpen((v) => !v);
          }}
          type="button"
        >
          <span className="act-caret" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          <span className="insight-subhead">적게 쓰인 기능</span>
        </button>
        {rows ? (
          <span className="usage-gist">
            {lowCount}/{rows.length} 저사용
          </span>
        ) : null}
      </header>

      {!open ? null : (
        <>
          <header className="usage-head">
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
            {span ? (
              <small className="usage-span">
                {span.since} ~ {span.until}
              </small>
            ) : null}
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
                  const tip = [d.hint, `id: ${r.target}`].filter(Boolean).join(" · ");
                  // 부연은 오해할 수 있는 줄에만 — 이름이 분명한 줄에 설명을 덧대면 목록만 길어진다.
                  const needHint = Boolean(d.unnamed || d.name.includes("여러 개"));
                  return (
                    <li
                      key={`${r.kind}|${r.target}`}
                      data-unnamed={d.unnamed ? "1" : undefined}
                      style={{ "--fill": `${Math.max(3, (r.total / max) * 100)}%` } as CSSProperties}
                      title={tip}
                    >
                      <span className="usage-chip" data-tone={chip.tone}>
                        {chip.short}
                      </span>
                      <span className="usage-name">
                        {d.area ? <em className="usage-area">{d.area}</em> : null}
                        {d.name}
                        {needHint && d.hint ? <small>{d.hint}</small> : null}
                        {dev ? <code>{r.target}</code> : null}
                      </span>
                      <b className="usage-n" title={roleBreakdown(r.roles)}>
                        {r.total}
                      </b>
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
                    {showAll ? "접기" : `전체 ${filtered.length}개`}
                  </button>
                ) : null}
                <button className="act-tool" data-act="usage-copy" onClick={copy} type="button">
                  {copied ? "복사됨" : "복사"}
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
                  id 보기
                </button>
              </div>

              <p className="vt-occ-note">
                숫자 = 눌린 횟수 · 올리면 역할별 내역 · 시청자는 개수만
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
