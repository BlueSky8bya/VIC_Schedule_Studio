"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  ROLE_NAME,
  USAGE_ROLE_ORDER,
  describeTarget,
  sortAreas,
  usageRoleBreakdown,
  usageRoleCount
} from "@/lib/activity/labels";
import { getActivityUsageAction, type UsageRow } from "@/lib/activity/query";
import { UsagePick } from "@/components/developer/usage-pick";
import { ScrollPosition } from "@/components/developer/scroll-position";
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
// 줄이 무엇인지 한 눈에 — 버튼 줄은 이름이 곧 한 일이지만, 화면·창 줄은 이름만 보면
// "공개 포스터가 무슨 기능이지?"가 된다(2026-09-11 소유자). 그래서 화면·창은 '열기'를 붙여
// **들어간 횟수**임을 말한다. 위치(area)는 화면 줄에선 그 화면 자신이라 빼고(같은 말 두 번),
// 창·버튼 줄에만 남긴다.
function rowName(kind: string, name: string): string {
  if (kind === "route.enter") return `${name} 열기`;
  if (kind === "section.enter") return name.endsWith("창") ? `${name} 열기` : `${name} 창 열기`;
  return name;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "ui.click", label: "버튼" },
  { key: "route.enter", label: "화면" },
  { key: "section.enter", label: "창" }
];

export function ActivityUsage({
  anchor,
  reloadKey = 0
}: {
  anchor: string;
  reloadKey?: number;
}) {
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
  const [showRetired, setShowRetired] = useState(false); // 지운 기능 묶음 — 기본은 접힘
  const [dev, setDev] = useState(false); // 개발자 정보(원래 id) 표시
  const [copied, setCopied] = useState(false);
  const [span, setSpan] = useState<{ since: string; until: string } | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  // 30초 자동 갱신(reloadKey)에서는 스켈레톤을 띄우지 않는다 — 목록을 읽는 중에 통째로
  // 지웠다 다시 그리면 보던 자리가 맨 위로 튄다(2026-09-11 소유자: "갑자기 새로고침").
  const hardKey = `${days}|${anchor}`;
  const lastHardRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (lastHardRef.current !== hardKey) {
      lastHardRef.current = hardKey;
      setLoading(true);
    }
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
  }, [days, anchor, hardKey, reloadKey]);

  // 이미 철수한 기능(꾸미기·월드컵·비공개 레이어 UI·작업자 — 사전에 retired 표식)은 후보 목록에서
  // 갈라낸다. 이 화면의 질문은 "무엇을 없앨까"인데, 이미 없앤 것이 바닥에 깔려 있으면 진짜 후보가
  // 그 위에 묻힌다. 기록 자체는 버리지 않고 아래 접힌 묶음으로 남긴다(보존 90일이 지나면 자연 소멸).
  const isRetired = (r: UsageRow) => Boolean(describeTarget(r.kind, r.target).retired);
  const activeAll = rows ? rows.filter((r) => !isRetired(r)) : [];
  const retiredAll = rows ? rows.filter(isRetired) : [];
  const roleCount = (r: UsageRow, key: string): number => usageRoleCount(r.roles, key);
  const areaOf = (r: UsageRow) => describeTarget(r.kind, r.target).area ?? "기타";
  // 세 고르개(종류·위치·역할)는 **서로 걸러준다**(2026-09-11 소유자: "역할이 시청자면 시청자가
  // 할 수 있는 것만, 위치가 편집실이면 역할은 관리자·개발자만"). 한 고르개의 목록은 **나머지
  // 둘을 적용한 기록**에서 뽑는다 — 고를 수 있는데 결과가 0인 조합이 사라져, 목록이 곧 "이
  // 조건에서 존재하는 것 전부"가 된다.
  const matches = (r: UsageRow, k: string, a: string, rr: string) =>
    (k === "all" || r.kind === k) &&
    (a === "all" || areaOf(r) === a) &&
    (rr === "all" || roleCount(r, rr) > 0);
  // 후보 뽑기는 살아있는 줄만 본다 — 지운 기능만 남은 위치(꾸미기·시즌)는 죽은 칩이라
  // "없는 게 아니라 안 쓴 것"으로 오해된다.
  const anyRow = (k: string, a: string, rr: string) => activeAll.some((r) => matches(r, k, a, rr));
  const passes = (r: UsageRow) => matches(r, kind, area, role);
  const kindOptions = FILTERS.filter((f) => f.key === "all" || anyRow(f.key, area, role));
  // 순서는 가나다순이 아니라 **자주 가는 곳부터**(labels.ts AREA_ORDER) — 가나다순은 '계정' 옆에
  // '그림판'을 세우는 식이라 목록이 지도처럼 안 읽힌다(2026-09-05 소유자).
  const areaOptions = sortAreas([
    ...new Set(activeAll.filter((r) => matches(r, kind, "all", role)).map(areaOf))
  ]);
  // 종류·위치를 안 걸었을 때는 역할을 **전부** 보여준다 — 기록이 0인 역할을 늘 빼버리면
  // "이 역할은 한 번도 안 썼다"를 확인할 방법이 사라진다(그게 이 화면의 질문이다).
  // 조건을 걸면 그 조건에서 실제로 기록이 있는 역할만 남긴다.
  // (시청자와 비로그인은 합치지 않는다 — labels.ts usageRoleCount 주석의 실사고.)
  const roleOptions =
    kind === "all" && area === "all"
      ? [...USAGE_ROLE_ORDER]
      : USAGE_ROLE_ORDER.filter((rr) => anyRow(kind, area, rr));
  // 한 칸을 바꿔 다른 칸의 값이 더는 성립하지 않으면, **방금 고른 것을 지키고** 나머지를
  // 전체로 되돌린다. 안 그러면 0건 화면만 남아 "왜 비었지"가 된다.
  const applyPick = (next: { kind?: string; area?: string; role?: string }) => {
    let k = next.kind ?? kind;
    let a = next.area ?? area;
    let rr = next.role ?? role;
    if (!anyRow(k, a, rr)) {
      if (next.kind !== undefined) {
        if (!anyRow(k, a, "all")) rr = "all";
        if (!anyRow(k, a, rr)) a = "all";
      } else if (next.area !== undefined) {
        if (!anyRow("all", a, rr)) rr = "all";
        if (!anyRow(k, a, rr)) k = "all";
      } else {
        if (!anyRow(k, "all", rr)) a = "all";
        if (!anyRow(k, a, rr)) k = "all";
      }
    }
    setKind(k);
    setArea(a);
    setRole(rr);
    setShowAll(false);
  };
  const filtered = activeAll.filter(passes);
  // 지운 기능에도 같은 필터를 건다 — 종류=버튼을 골랐는데 묶음에 화면이 섞이면 필터가 거짓말이 된다.
  const retiredFiltered = retiredAll.filter(passes);
  const sorted =
    role === "all"
      ? filtered
      : [...filtered].sort((a, b) => roleCount(a, role) - roleCount(b, role));
  const shown = showAll ? sorted : sorted.slice(0, 15);
  // 역할을 고르면 그 역할의 횟수로 센다 — 전체 합으로 두면 "매니저는 1번인데 54로 보이는" 착시.
  const countOf = (r: UsageRow) => (role === "all" ? r.total : roleCount(r, role));
  const max = filtered.length > 0 ? Math.max(...filtered.map(countOf)) : 1;
  const retiredTotal = retiredFiltered.reduce((n, r) => n + countOf(r), 0);

  // 붙여넣어 공유·점검할 수 있는 평문. **여기엔 원래 id를 반드시 포함한다** — 화면에선 숨기지만
  // "이 항목 이름이 왜 이래?" 같은 문제를 찾으려면 원본이 있어야 한다.
  const copyText = () => {
    const head = `사용량(적은 순) ${span?.since} ~ ${span?.until} · ${days}일 · 종류=${kind} · 위치=${area} · 역할=${role}`;
    const line = (r: UsageRow) => {
      const d = describeTarget(r.kind, r.target);
      return [
        `${r.total}`.padStart(5),
        (KIND_CHIP[r.kind]?.short ?? r.kind).padEnd(3),
        (d.area ?? "-").padEnd(7),
        d.name,
        `| ${usageRoleBreakdown(r.roles)}`,
        `| kind=${r.kind} target=${r.target}${d.unnamed ? " (이름미등록)" : ""}${d.retired ? " (지운 기능)" : ""}`
      ].join("  ");
    };
    const out = [head, `총 ${filtered.length}개 · 지운 기능 ${retiredFiltered.length}개`, "", ...sorted.map(line)];
    // 지운 기능도 복사본엔 넣는다 — 화면에선 접어두지만, 점검용 평문에서 빠지면 "기록이 사라졌나"가 된다.
    if (retiredFiltered.length > 0) {
      out.push("", "— 이미 지웠거나 이름이 바뀐 기능(기록만 남음) —", ...retiredFiltered.map(line));
    }
    return out.join("\n");
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

  // 저사용 요약은 살아있는 기능만 — 지운 기능이 끼면 저사용 개수가 늘 부풀어 보인다.
  const lowCount = activeAll.filter((r) => r.total <= 2).length;

  return (
    // data-hold-refresh: 이 카드 안을 만지는 동안은 부모의 30초 자동 갱신을 멈춘다.
    <section className="vcard" data-hold-refresh="">
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
            {lowCount}/{activeAll.length} 저사용
            {retiredAll.length > 0 ? ` · 지움 ${retiredAll.length}` : ""}
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
                <UsagePick
                  act="usage-kind"
                  label="종류"
                  onChange={(v) => applyPick({ kind: v })}
                  options={kindOptions.map((f) => ({ value: f.key, label: f.label }))}
                  value={kind}
                />
                <UsagePick
                  act="usage-area"
                  label="위치"
                  onChange={(v) => applyPick({ area: v })}
                  options={[
                    { value: "all", label: "전체" },
                    ...areaOptions.map((a) => ({ value: a, label: a }))
                  ]}
                  value={area}
                />
                <UsagePick
                  act="usage-role"
                  label="역할"
                  onChange={(v) => applyPick({ role: v })}
                  options={[
                    { value: "all", label: "전체" },
                    ...roleOptions.map((rr) => ({ value: rr, label: ROLE_NAME[rr] }))
                  ]}
                  value={role}
                />
                {kind !== "all" || area !== "all" || role !== "all" ? (
                  <button
                    className="usage-reset"
                    data-act="usage-filter-reset"
                    onClick={() => {
                      hapticTick();
                      applyPick({ kind: "all", area: "all", role: "all" });
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                ) : null}
              </div>

              {/* 필터가 0건이면 왜 비었는지 그 자리에서 말한다 — 빈 목록만 두면 "집계가
                  안 되는 건가?"로 읽힌다(실측: 역할=시청자가 늘 0이었다). */}
              {filtered.length === 0 ? (
                <p className="insight-empty">
                  이 조건에 맞는 기록이 이 기간에 없어요 (전체 {activeAll.length}개 중 0개).
                </p>
              ) : null}
              <ScrollPosition
                listRef={listRef}
                unit="개"
                watch={`${shown.length}|${kind}|${area}|${role}|${showAll ? 1 : 0}`}
              />
              <ul className="usage-list" ref={listRef}>
                {shown.map((r) => {
                  const chip = KIND_CHIP[r.kind] ?? { short: "기타", tone: "btn" };
                  const d = describeTarget(r.kind, r.target);
                  const tip = [d.hint, `id: ${r.target}`].filter(Boolean).join(" · ");
                  // 부연은 오해할 수 있는 줄에만 — 이름이 분명한 줄에 설명을 덧대면 목록만 길어진다.
                  const needHint = Boolean(d.unnamed || d.name.includes("여러 개"));
                  return (
                    <li
                      key={`${r.kind}|${r.target}`}
                      data-pos={d.area ?? "기타"}
                      data-unnamed={d.unnamed ? "1" : undefined}
                      style={{ "--fill": `${Math.max(3, (countOf(r) / max) * 100)}%` } as CSSProperties}
                      title={tip}
                    >
                      {/* 종류는 상자 대신 색 점으로 — 왼쪽에 덩어리(버섯)가 앉아 줄이 이름부터
                          시작하지 못했다. 점은 폭을 거의 안 먹고 색만으로 구분된다. */}
                      <span className="usage-dot" data-tone={chip.tone} title={chip.short} />
                      <span className="usage-name">
                        {d.area && r.kind !== "route.enter" ? (
                          <em className="usage-area">{d.area}</em>
                        ) : null}
                        {rowName(r.kind, d.name)}
                        {needHint && d.hint ? <small>{d.hint}</small> : null}
                        {dev ? <code>{r.target}</code> : null}
                      </span>
                      {/* 역할을 고르면 숫자는 '그 역할의 횟수'다. 안 적으면 전체 합으로 읽혀
                          "편집실 1인데 왜 개발자 30이야?"가 된다(실측). */}
                      <b
                        className="usage-n"
                        title={
                          role === "all"
                            ? usageRoleBreakdown(r.roles)
                            : `${ROLE_NAME[role]} ${countOf(r)}번 · 전체 ${r.total}번(${usageRoleBreakdown(r.roles)})`
                        }
                      >
                        {countOf(r)}
                        {role === "all" ? null : <em>{ROLE_NAME[role]}</em>}
                      </b>
                    </li>
                  );
                })}
              </ul>

              {/* 이미 지운 기능(꾸미기·월드컵·비공개 레이어 UI·작업자) — 후보가 아니라 옛 기록이다.
                  목록에 섞으면 "없앨 후보"가 이미 없앤 것 밑에 묻히므로 접힌 묶음으로 갈라둔다. */}
              {retiredFiltered.length > 0 ? (
                <div className="usage-retired">
                  <button
                    aria-expanded={showRetired}
                    className="usage-retired-head"
                    data-act="usage-retired-open"
                    onClick={() => {
                      hapticTick();
                      setShowRetired((v) => !v);
                    }}
                    type="button"
                  >
                    <span className="act-caret" aria-hidden="true">
                      {showRetired ? "▾" : "▸"}
                    </span>
                    이미 지웠거나 이름이 바뀐 기능 {retiredFiltered.length}개
                    <em>{retiredTotal}번 · 기록만 남음</em>
                  </button>
                  {showRetired ? (
                    <ul className="usage-list" data-retired="1">
                      {retiredFiltered.map((r) => {
                        const chip = KIND_CHIP[r.kind] ?? { short: "기타", tone: "btn" };
                        const d = describeTarget(r.kind, r.target);
                        const tip = [
                          "이미 지운 기능 — 기록만 남음(보존 90일이 지나면 사라져요)",
                          d.hint,
                          `id: ${r.target}`
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <li key={`${r.kind}|${r.target}`} title={tip}>
                            <span className="usage-dot" data-tone={chip.tone} title={chip.short} />
                            <span className="usage-name">
                              {d.area && r.kind !== "route.enter" ? (
                                <em className="usage-area">{d.area}</em>
                              ) : null}
                              {rowName(r.kind, d.name)}
                              <small className="usage-gone">지움</small>
                              {dev ? <code>{r.target}</code> : null}
                            </span>
                            <b
                              className="usage-n"
                              title={
                                role === "all"
                                  ? usageRoleBreakdown(r.roles)
                                  : `${ROLE_NAME[role]} ${countOf(r)}번 · 전체 ${r.total}번(${usageRoleBreakdown(r.roles)})`
                              }
                            >
                              {countOf(r)}
                              {role === "all" ? null : <em>{ROLE_NAME[role]}</em>}
                            </b>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}

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
                {role === "all"
                  ? "숫자 = 눌린 횟수 · 올리면 역할별 내역 · 시청자는 개수만"
                  : `숫자 = ${ROLE_NAME[role]}가 누른 횟수 · 올리면 전체 내역`}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
