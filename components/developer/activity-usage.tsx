"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { ROLE_NAME, ROLE_ORDER, describeTarget, roleBreakdown } from "@/lib/activity/labels";
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
  const [area, setArea] = useState("all"); // 위치 필터 — 묶어 접는 대신 골라 본다
  const [role, setRole] = useState("all"); // 역할 필터 — "이건 매니저만 쓰나?"를 바로 본다
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

  // 위치 칩은 **데이터에 실제로 있는 것만** 만든다(죽은 칩은 "없는 게 아니라 안 쓴 것"으로 오해된다).
  const areasIn = rows
    ? [...new Set(rows.map((r) => describeTarget(r.kind, r.target).area ?? "기타"))].sort()
    : [];
  // 역할 칩도 데이터에 실제로 있는 역할만.
  const rolesIn = rows
    ? ROLE_ORDER.filter((rr) => rows.some((r) => (r.roles[rr] ?? 0) > 0))
    : [];
  const filtered = rows
    ? rows.filter(
        (r) =>
          (kind === "all" || r.kind === kind) &&
          (area === "all" || (describeTarget(r.kind, r.target).area ?? "기타") === area) &&
          (role === "all" || (r.roles[role] ?? 0) > 0)
      )
    : [];
  const sorted =
    role === "all"
      ? filtered
      : [...filtered].sort((a, b) => (a.roles[role] ?? 0) - (b.roles[role] ?? 0));
  const shown = showAll ? sorted : sorted.slice(0, 15);
  // 역할을 고르면 그 역할의 횟수로 센다 — 전체 합으로 두면 "매니저는 1번인데 54로 보이는" 착시.
  const countOf = (r: UsageRow) => (role === "all" ? r.total : (r.roles[role] ?? 0));
  const max = filtered.length > 0 ? Math.max(...filtered.map(countOf)) : 1;

  // 붙여넣어 공유·점검할 수 있는 평문. **여기엔 원래 id를 반드시 포함한다** — 화면에선 숨기지만
  // "이 항목 이름이 왜 이래?" 같은 문제를 찾으려면 원본이 있어야 한다.
  const copyText = () => {
    const head = `사용량(적은 순) ${span?.since} ~ ${span?.until} · ${days}일 · 종류=${kind} · 위치=${area} · 역할=${role}`;
    const lines = sorted.map((r) => {
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
              {/* 칩을 종류·위치·역할 세 줄로 늘어놓으면 목록보다 필터가 길어진다(실측).
                  고르는 값이 늘어날수록(위치는 계속 는다) 더 나빠지므로 드롭다운 한 줄로 묶는다. */}
              <div className="usage-picks">
                <label>
                  <span>종류</span>
                  <select
                    data-act="usage-kind"
                    onChange={(e) => {
                      hapticTick();
                      setKind(e.target.value);
                      setShowAll(false);
                    }}
                    value={kind}
                  >
                    {FILTERS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>위치</span>
                  <select
                    data-act="usage-area"
                    onChange={(e) => {
                      hapticTick();
                      setArea(e.target.value);
                      setShowAll(false);
                    }}
                    value={area}
                  >
                    <option value="all">전체</option>
                    {areasIn.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>역할</span>
                  <select
                    data-act="usage-role"
                    onChange={(e) => {
                      hapticTick();
                      setRole(e.target.value);
                      setShowAll(false);
                    }}
                    value={role}
                  >
                    <option value="all">전체</option>
                    {rolesIn.map((rr) => (
                      <option key={rr} value={rr}>
                        {ROLE_NAME[rr]}
                      </option>
                    ))}
                  </select>
                </label>
                {kind !== "all" || area !== "all" || role !== "all" ? (
                  <button
                    className="usage-reset"
                    data-act="usage-filter-reset"
                    onClick={() => {
                      hapticTick();
                      setKind("all");
                      setArea("all");
                      setRole("all");
                      setShowAll(false);
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                ) : null}
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
                      style={{ "--fill": `${Math.max(3, (countOf(r) / max) * 100)}%` } as CSSProperties}
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
                        {countOf(r)}
                      </b>
                    </li>
                  );
                })}
              </ul>

              <div className="usage-actions">
                {sorted.length > 15 ? (
                  <button
                    className="usage-more"
                    data-act="usage-show-all"
                    onClick={() => {
                      hapticTick();
                      setShowAll((v) => !v);
                    }}
                    type="button"
                  >
                    {showAll ? "접기" : `전체 ${sorted.length}개`}
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
