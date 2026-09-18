"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarCheck, ChevronRight, Play, Search, X } from "lucide-react";
import type { BroadcastTag, PublicSearchHit, PublicSearchResult, PublicSearchTrend } from "@/lib/domain/schedule-types";
import {
  SEARCH_SORTS,
  findMatchRange,
  groupSearchHits,
  personalizeHits,
  sortSearchGroups,
  type SearchDayGroup,
  type SearchSort
} from "@/lib/search/group";
import { formatVodDuration } from "@/components/poster/day-vod-window";
import { formatTimecode } from "@/components/poster/vod-chapters";
import { hapticTick } from "@/lib/ui/haptics";

// 시청자 검색 시트(PLAN-20260918-023) — "예전에 이런 게 있었던 것 같은데 언제, 어디 시간대였지?"
//
// 껍데기는 '이 달 기록' 시트와 같은 pi-* 부품. 시청자·편집실 미리보기·비로그인이 한 구현(G-18).
// 순위는 서버(search_public), 묶음은 lib/search/group. 고른 것은 부모가 처리(달 이동·다시보기 열기).
//
// 결과 줄 디자인(2026-09-18 2차, 벤치마킹: 유튜브 검색 결과·'주요 순간', macOS Spotlight, Slack 검색):
//   · 줄마다 글자 버튼("처음부터/이 시각부터/달력으로")을 두지 않는다 — 한 줄 = 한 행동이므로 줄 전체가
//     버튼이고, 오른쪽 끝의 ›(일정) / ▶(다시보기·챕터) 한 글리프가 행동을 말한다(호버에 진해짐).
//   · 종류는 글자 배지 대신 왼쪽 아이콘·썸네일: 일정 = 달력 아이콘, 다시보기 = 썸네일(유튜브식 스캔),
//     챕터 = 타임코드 칩(주요 순간).
//   · 챕터는 다시보기 아래 세로 가이드선으로 소속을 보이고 줄 높이를 낮춘다(밀도 ↑, 소음 ↓).
//   · 정확 적중 다음에 '비슷한 결과' 구분선(유사도만 맞은 것) — 섞이면 "왜 이게 나왔지"가 생긴다.
//   · 입력 전엔 태그 칩 제안(정적, 검색어 저장 없음).

const DEBOUNCE_MS = 300;
const MIN_CHARS = 1; // 정규화(공백·기호 제거) 후 글자 수. 한 글자는 서버가 사전에 있을 때만 결과를 준다(메·롤·숲).

type Props = {
  slug: string;
  myHeartIds: ReadonlySet<string>;
  tags: BroadcastTag[];
  thumbOf: (titleNo: number) => string | undefined; // SnapshotLoad 쿼리(0072) — 없으면 아이콘
  onClose: () => void;
  onPickEvent: (dateKey: string, eventId: string) => void;
  onPickVod: (dateKey: string, titleNo: number, sec?: number) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} ${WEEKDAYS[wd]}`;
}
const normalize = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

// 적중 글자 강조 — 공백·기호를 건너뛰는 정규화 매칭(서버와 같은 규칙). 초성 질의는 강조 없음.
function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  const r = /^[ㄱ-ㅎ]+$/.test(normalize(q)) ? null : findMatchRange(text, q);
  if (!r) return text;
  return (
    <>
      {text.slice(0, r[0])}
      <mark>{text.slice(r[0], r[1])}</mark>
      {text.slice(r[1])}
    </>
  );
}

type Row =
  | { kind: "event"; dateKey: string; hit: PublicSearchHit }
  | { kind: "vod"; dateKey: string; titleNo: number }
  | { kind: "chapter"; dateKey: string; titleNo: number; sec: number };

export function PublicSearch({ slug, myHeartIds, tags, thumbOf, onClose, onPickEvent, onPickVod }: Props) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<PublicSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(-1); // 키보드 ↑↓ 현재 행(-1 = 입력창)
  // 정렬 — 기기별 기억(localStorage, 편의값). 관련도가 기본.
  const [sort, setSort] = useState<SearchSort>(() => {
    try {
      const v = window.localStorage.getItem("vic_search_sort");
      return SEARCH_SORTS.some((s) => s.key === v) ? (v as SearchSort) : "relevance";
    } catch {
      return "relevance";
    }
  });
  const changeSort = (next: SearchSort) => {
    setSort(next);
    setCursor(-1);
    try {
      window.localStorage.setItem("vic_search_sort", next);
    } catch {
      /* 저장 못 해도 동작엔 지장 없음 */
    }
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 입력 전 제안: 요즘 뜨는 말(0079 search_trending) — 시트 열 때 한 번, 실패하면 조용히 없음.
  const [trends, setTrends] = useState<PublicSearchTrend[]>([]);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/public/${slug}/search/trending`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { trends?: PublicSearchTrend[] } | null) => {
        if (j && Array.isArray(j.trends)) setTrends(j.trends.slice(0, 8));
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [slug]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 입력 → 디바운스 → 요청. 새 입력이 오면 이전 요청은 끊는다(늦게 온 옛 결과가 새 결과를 덮지 않게).
  const normalizedLen = normalize(q).length;
  useEffect(() => {
    abortRef.current?.abort();
    if (normalizedLen < MIN_CHARS) {
      setResult(null);
      setBusy(false);
      setFailed(false);
      return;
    }
    const ctl = new AbortController();
    abortRef.current = ctl;
    setBusy(true);
    setFailed(false);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/${slug}/search?q=${encodeURIComponent(q.trim())}&limit=80`, {
          signal: ctl.signal
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as PublicSearchResult;
        if (ctl.signal.aborted) return;
        setResult(json);
        setCursor(-1);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setFailed(true);
      } finally {
        if (!ctl.signal.aborted) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [q, normalizedLen, slug]);

  const groups: SearchDayGroup[] = useMemo(
    () => (result ? sortSearchGroups(groupSearchHits(personalizeHits(result.hits, myHeartIds)), sort) : []),
    [result, myHeartIds, sort]
  );
  const exactGroups = groups.filter((g) => g.exact);
  const similarGroups = groups.filter((g) => !g.exact);

  // 태그 제안(입력 전) — 대분류(부모 없음)·활성만. 누르면 그 이름으로 검색.
  const tagChips = useMemo(
    () => tags.filter((t) => t.isActive && !t.parentId && t.kind !== "modifier").slice(0, 12),
    [tags]
  );

  // 키보드 ↑↓ Enter — 화면에 그려진 순서 그대로 한 줄 목록으로 편다.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of [...exactGroups, ...similarGroups]) {
      for (const e of g.events) out.push({ kind: "event", dateKey: g.dateKey, hit: e });
      for (const v of g.vods) {
        out.push({ kind: "vod", dateKey: g.dateKey, titleNo: v.titleNo });
        for (const c of v.chapters) out.push({ kind: "chapter", dateKey: g.dateKey, titleNo: v.titleNo, sec: c.sec });
      }
    }
    return out;
  }, [exactGroups, similarGroups]);

  const pick = (row: Row) => {
    hapticTick();
    if (row.kind === "event") onPickEvent(row.dateKey, row.hit.eventId ?? "");
    else if (row.kind === "vod") onPickVod(row.dateKey, row.titleNo);
    else onPickVod(row.dateKey, row.titleNo, row.sec);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => {
        const next = e.key === "ArrowDown" ? Math.min(rows.length - 1, c + 1) : Math.max(-1, c - 1);
        listRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter" && cursor >= 0 && rows[cursor]) {
      e.preventDefault();
      pick(rows[cursor]);
    }
  };

  // 행 번호(키보드 커서용) — 그리는 순서와 rows 순서가 같아야 한다.
  let rowNo = -1;
  const rowBtn = (row: Row, className: string, act: string, children: ReactNode, title: string) => {
    rowNo += 1;
    const i = rowNo;
    return (
      <button
        className={`ps-row ${className}${cursor === i ? " is-cursor" : ""}`}
        data-act={act}
        data-row={i}
        key={`${row.kind}:${row.dateKey}:${row.kind === "event" ? row.hit.eventId : row.titleNo}:${row.kind === "chapter" ? row.sec : ""}`}
        onClick={() => pick(row)}
        onMouseEnter={() => setCursor(i)}
        title={title}
        type="button"
      >
        {children}
      </button>
    );
  };

  const renderGroup = (g: SearchDayGroup) => (
    <section className="ps-day" key={g.dateKey}>
      <h3 className="ps-day-head">{formatDayLabel(g.dateKey)}</h3>
      {g.events.map((e) =>
        rowBtn(
          { kind: "event", dateKey: g.dateKey, hit: e },
          "ps-event",
          "search-hit-event",
          <>
            <span className="ps-lead ps-lead-event" aria-hidden="true">
              <CalendarCheck size={16} strokeWidth={2.2} />
            </span>
            <span className="ps-main">
              <span className="ps-title">
                <Highlight text={e.title} q={q} />
              </span>
              <span className="ps-meta">
                {e.startTime ? `${e.startTime} · ` : ""}일정
                {e.snippet ? (
                  <>
                    {" · "}
                    <Highlight text={e.snippet} q={q} />
                  </>
                ) : null}
              </span>
            </span>
            <ChevronRight className="ps-act" size={16} aria-hidden="true" />
          </>,
          "달력에서 이 일정으로"
        )
      )}
      {g.vods.map((v) => {
        const thumb = thumbOf(v.titleNo);
        return (
          <div className="ps-vod" key={v.titleNo}>
            {rowBtn(
              { kind: "vod", dateKey: g.dateKey, titleNo: v.titleNo },
              `ps-vod-row${v.matched ? "" : " via-chapter"}`,
              "search-hit-vod",
              <>
                <span className="ps-lead ps-thumb" aria-hidden="true">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 외부 스냅샷(숲 CDN), 크기 고정
                    <img alt="" loading="lazy" src={`https://videoimg.sooplive.com/php/SnapshotLoad.php?${thumb}`} />
                  ) : (
                    <Play size={14} strokeWidth={2.4} />
                  )}
                </span>
                <span className="ps-main">
                  <span className="ps-title">
                    <Highlight text={v.title} q={q} />
                  </span>
                  <span className="ps-meta">
                    {formatVodDuration(v.durationMs)} · 다시보기
                    {v.hostNick ? ` · 합방 ${v.hostNick}` : ""}
                  </span>
                </span>
                <Play className="ps-act" size={14} aria-hidden="true" />
              </>,
              "이 다시보기 처음부터"
            )}
            {v.chapters.length > 0 ? (
              <div className="ps-chapters">
                {v.chapters.map((c, ci) => {
                  // 코너 소제목: 같은 코너가 이어지면 한 번만(유튜브 챕터 목록·에피소드 그룹 문법).
                  // 코너로 맞은 결과(matched_on=section)는 소제목을 강조해 "왜 나왔는지"를 보인다.
                  const prev = ci > 0 ? v.chapters[ci - 1] : null;
                  const showSection = c.section && (!prev || prev.section !== c.section);
                  return (
                    <div className="ps-chapter-wrap" key={`${c.sec}:${c.label}`}>
                      {showSection ? (
                        <span className={`ps-section${c.matchedOn === "section" ? " is-hit" : ""}`}>
                          <Highlight text={c.section} q={q} />
                        </span>
                      ) : null}
                      {rowBtn(
                        { kind: "chapter", dateKey: g.dateKey, titleNo: v.titleNo, sec: c.sec },
                        "ps-chapter",
                        "search-hit-chapter",
                        <>
                          <b className="ps-tc">{formatTimecode(c.sec)}</b>
                          <span className="ps-main">
                            <span className="ps-title">
                              {c.parent ? (
                                <span className="ps-parent">
                                  <Highlight text={c.parent} q={q} /> ›{" "}
                                </span>
                              ) : null}
                              <Highlight text={c.label} q={q} />
                            </span>
                          </span>
                          <Play className="ps-act" size={12} aria-hidden="true" />
                        </>,
                        `${c.section ? `[${c.section}] ` : ""}${formatTimecode(c.sec)}부터 재생`
                      )}
                    </div>
                  );
                })}
                {v.chapterOverflow > 0 ? <span className="ps-more">+{v.chapterOverflow}개 챕터 더</span> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );

  const empty = normalizedLen >= MIN_CHARS && !busy && result && groups.length === 0;

  // 백드롭 클릭으로는 닫지 않는다('이 달 기록'과 같은 결정 — 조준된 행동만: X · Esc · 뒤로가기).
  return (
    <div className="pi-backdrop" role="presentation">
      <section aria-label="검색" className="pi-sheet ps-sheet" role="dialog" aria-modal="true">
        <header className="pi-head ps-head">
          <label className="ps-field">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="검색어"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="일정 · 다시보기 · 챕터 찾기"
              ref={inputRef}
              spellCheck={false}
              type="search"
              value={q}
            />
            {q ? (
              <button
                aria-label="지우기"
                className="ps-clear"
                data-act="search-clear"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                type="button"
              >
                <X size={14} />
              </button>
            ) : null}
          </label>
          <button
            aria-label="닫기"
            className="pi-close"
            data-act="close-public-search"
            onClick={() => {
              hapticTick();
              onClose();
            }}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {result && groups.length > 0 ? (
          <div className="ps-sortbar" role="group" aria-label="정렬">
            <span className="ps-count">{result.hits.length}건</span>
            <div className="ps-seg">
              {SEARCH_SORTS.map((s) => (
                <button
                  aria-pressed={sort === s.key}
                  className={`ps-seg-btn${sort === s.key ? " on" : ""}`}
                  data-act="search-sort"
                  key={s.key}
                  onClick={() => {
                    if (sort === s.key) return;
                    hapticTick();
                    changeSort(s.key);
                  }}
                  title={s.hint}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {result && ((result.related?.people?.length ?? 0) > 0 || (result.related?.terms?.length ?? 0) > 0) ? (
          <div className="ps-related">
            {result.related?.terms?.length ? (
              <div className="ps-chiprow">
                <span className="ps-chiplbl">관련 검색어</span>
                <div className="ps-chips">
                  {result.related.terms.map((t) => (
                    <button
                      className={`ps-chip${t.kind === "rel" ? " ps-chip-rel" : ""}`}
                      data-act="search-related-term"
                      key={t.term}
                      onClick={() => {
                        hapticTick();
                        setQ(t.term);
                        inputRef.current?.focus();
                      }}
                      title={t.kind === "rel" ? "같은 시리즈·짝" : `같은 방송에 ${t.coDocs}번 함께`}
                      type="button"
                    >
                      {t.term}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {result.related?.people?.length ? (
              <div className="ps-chiprow">
                <span className="ps-chiplbl">함께 자주 나온</span>
                <div className="ps-chips">
                  {result.related.people.map((p) => (
                    <button
                      className="ps-chip ps-chip-person"
                      data-act="search-related-person"
                      key={p.name}
                      onClick={() => {
                        hapticTick();
                        setQ(p.display);
                        inputRef.current?.focus();
                      }}
                      title={`같은 방송 ${p.coDocs}번${p.hapbang ? ` · 합방 ${p.hapbang}번` : ""}`}
                      type="button"
                    >
                      {p.display}
                      {p.hapbang > 0 ? <em>합방 {p.hapbang}</em> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={`pi-body ps-body${busy ? " is-busy" : ""}`} ref={listRef}>
          {normalizedLen < MIN_CHARS ? (
            <div className="ps-start">
              <p className="ps-hint">게임 이름, 방송 제목, 챕터 이름으로. 초성(ㅁㅋ)·줄임말(배그)도 돼요.</p>
              {trends.length > 0 ? (
                <div className="ps-chiprow">
                  <span className="ps-chiplbl">요즘 자주 나온 말</span>
                  <div className="ps-chips" aria-label="요즘 자주 나온 말">
                    {trends.map((t) => (
                      <button
                        className="ps-chip ps-chip-hot"
                        data-act="search-trending-chip"
                        key={t.term}
                        onClick={() => {
                          setQ(t.term);
                          inputRef.current?.focus();
                        }}
                        title={`최근 30일 ${t.recent}번`}
                        type="button"
                      >
                        {t.term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {tagChips.length > 0 ? (
                <div className="ps-chiprow">
                <span className="ps-chiplbl">태그로 찾기</span>
                <div className="ps-chips" aria-label="태그로 찾기">
                  {tagChips.map((t) => (
                    <button
                      className="ps-chip"
                      data-act="search-tag-chip"
                      key={t.id}
                      onClick={() => {
                        setQ(t.displayName);
                        inputRef.current?.focus();
                      }}
                      type="button"
                    >
                      {t.displayName}
                    </button>
                  ))}
                </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {failed ? <p className="ps-hint ps-fail">검색이 잠시 안 돼요. 다시 시도해 주세요.</p> : null}
          {empty ? (
            <p className="ps-hint">
              <strong>&ldquo;{q.trim()}&rdquo;</strong>에 맞는 게 없어요. 다른 말로 찾아보세요.
            </p>
          ) : null}
          {exactGroups.map(renderGroup)}
          {similarGroups.length > 0 ? (
            <div className="ps-similar">
              <span className="ps-divider">
                {exactGroups.length > 0 ? "비슷한 결과" : "정확히 맞는 건 없어요 — 비슷한 결과"}
              </span>
              {similarGroups.map(renderGroup)}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
