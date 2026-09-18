"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, AudioLines, CalendarCheck, ChevronDown, ChevronRight, Footprints, Headphones, MessageCircle, Music, Play, Search, X } from "lucide-react";
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
// 3차 개편(2026-09-18 소유자: 통통 튀고 부드럽고 중후하게, 컴팩트, 내가 뭘 하는지 바로 알게):
//   · 위치 감각(숫자 없이): 오른쪽 **날짜 레일** — 결과 날짜 묶음마다 점 하나, 지나온 점은 채워지고
//     현재 묶음 점은 커지며 날짜 말풍선이 뜬다(iOS 사진·연락처 인덱스). 위 얇은 진행선(Medium),
//     날짜 머리는 스티키(Apple Music·Notion). 레일 점을 누르면 그 날짜로.
//   · 줄: 왼쪽 썸네일/아이콘, 가운데 제목+한 줄 메타, 오른쪽 보조 정보(길이·시각)가 호버 시 ▶로
//     교차 페이드 — 오른쪽이 비지 않고, 누르면 무엇이 일어나는지 호버 순간에 보인다(Apple Music 검색).
//   · 동작: 시트 스프링 등장, 행 스태거(≤12), 세그먼트 슬라이딩 썸, 칩 줄은 가로 스크롤(세로 절약),
//     로딩은 머리 아래 얇은 흐름선(본문은 흐리지 않음). reduce-motion이면 전부 정지.
//   · 정확 적중 뒤 '비슷한 결과' 구분선, 입력 전 요즘 뜨는 말·태그 칩, 곡은 ♪, "N개 더 보기".

const DEBOUNCE_MS = 300;
const MIN_CHARS = 1; // 정규화 후 글자 수. 한 글자는 서버가 사전에 있을 때만 결과를 준다(메·롤·숲).

type Props = {
  slug: string;
  myHeartIds: ReadonlySet<string>;
  tags: BroadcastTag[];
  thumbOf: (titleNo: number) => string | undefined; // SnapshotLoad 쿼리(0072) — 없으면 아이콘
  onClose: () => void;
  onPickEvent: (dateKey: string, eventId: string) => void;
  onPickVod: (dateKey: string, titleNo: number, sec?: number) => void;
  // 편집실(2026-09-18): 행 클릭 = 달력 이동(onPickVod), 옆의 ▶ = 시청자와 같은 다시보기 **창**(새 탭 아님 — 소유자: 탭 복제·재로딩 무거움).
  onReplay?: (dateKey: string, titleNo: number, sec?: number) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} ${WEEKDAYS[wd]}`;
}
function formatMonthLabel(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  return `${String(y).slice(2)}.${String(m).padStart(2, "0")}`;
}
const normalize = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
// 팬이 라벨 앞에 붙인 표식 이모지 중 **우리 종류 아이콘과 뜻이 겹치는 것만**(🎵🎶🎤🎧🎼♪♫🕺💃) 표시에서 뗀다.
// ✨👗🐸 같은 다른 표식은 팬의 표기라 그대로 둔다(소유자 2026-09-18). 원문은 title 툴팁에.
const stripLeadMark = (s: string) =>
  s.replace(/^(?:[🎵🎶🎤🎧🎼♪♫🕺💃]\u{FE0F}?[\s:：]*)+/u, "").trim() || s;
const KIND_ICON: Record<string, { Icon: typeof Music; label: string; cls: string }> = {
  song: { Icon: Music, label: "부른 곡", cls: "" },
  listen: { Icon: Headphones, label: "틀어준 곡", cls: " is-listen" },
  dance: { Icon: Footprints, label: "춤·챌린지", cls: " is-dance" },
  hum: { Icon: AudioLines, label: "허밍", cls: " is-hum" }
};

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

export function PublicSearch({ slug, myHeartIds, tags, thumbOf, onClose, onPickEvent, onPickVod, onReplay }: Props) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<PublicSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(-1); // 키보드 ↑↓ 현재 행(-1 = 입력창)
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
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 입력 전 제안: 요즘 뜨는 말(0079) — 시트 열 때 한 번, 실패하면 조용히 없음.
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
  // 결과가 어느 검색어의 것인지(resultForRef)와 대기 중 요청(flushRef)을 기억한다 — Enter가 옛 결과 행을 고르지 않게(아래 onInputKey).
  const normalizedLen = normalize(q).length;
  const resultForRef = useRef<string | null>(null);
  const flushRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    abortRef.current?.abort();
    setCursor(-1); // 검색어가 바뀌면 옛 결과 위의 커서(호버·↑↓)는 무효
    flushRef.current = null;
    if (normalizedLen < MIN_CHARS) {
      resultForRef.current = null;
      setResult(null);
      setBusy(false);
      setFailed(false);
      return;
    }
    const ctl = new AbortController();
    abortRef.current = ctl;
    setBusy(true);
    setFailed(false);
    const run = async () => {
      flushRef.current = null;
      try {
        const res = await fetch(`/api/public/${slug}/search?q=${encodeURIComponent(q.trim())}&limit=200`, {
          signal: ctl.signal
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as PublicSearchResult;
        if (ctl.signal.aborted) return;
        resultForRef.current = q;
        setResult(json);
        setCursor(-1);
        setExpanded(new Set());
        listRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setFailed(true);
      } finally {
        if (!ctl.signal.aborted) setBusy(false);
      }
    };
    const timer = window.setTimeout(run, DEBOUNCE_MS);
    flushRef.current = () => {
      window.clearTimeout(timer);
      void run();
    };
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [q, normalizedLen, slug]);

  const groups: SearchDayGroup[] = useMemo(
    () => (result ? sortSearchGroups(groupSearchHits(personalizeHits(result.hits, myHeartIds)), sort) : []),
    [result, myHeartIds, sort]
  );
  const exactGroups = useMemo(() => groups.filter((g) => g.exact), [groups]);
  const similarGroups = useMemo(() => groups.filter((g) => !g.exact), [groups]);
  // 편집실(2026-09-18 소유자): 토리님이 직접 쓴 것(일정 제목·설명·태그)이 **직접** 결과로 먼저, 타임라인·채팅에서 온
  // 다시보기·챕터는 **간접** 결과(누르면 그 날로). 시청자 화면은 날짜별 섞어 보이는 기존 그대로.
  const studio = Boolean(onReplay);
  const directGroups = useMemo(
    () => (studio ? [...exactGroups, ...similarGroups].map((g) => ({ ...g, vods: [] })).filter((g) => g.events.length > 0) : []),
    [studio, exactGroups, similarGroups]
  );
  const indirectGroups = useMemo(
    () => (studio ? [...exactGroups, ...similarGroups].map((g) => ({ ...g, events: [] })).filter((g) => g.vods.length > 0) : []),
    [studio, exactGroups, similarGroups]
  );
  const ordered = useMemo(
    () => (studio ? [...directGroups, ...indirectGroups] : [...exactGroups, ...similarGroups]),
    [studio, directGroups, indirectGroups, exactGroups, similarGroups]
  );

  const tagChips = useMemo(
    () => tags.filter((t) => t.isActive && !t.parentId && t.kind !== "modifier").slice(0, 12),
    [tags]
  );

  // 키보드 ↑↓ Enter — 화면에 그려진 순서 그대로 한 줄 목록으로 편다.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of ordered) {
      for (const e of g.events) out.push({ kind: "event", dateKey: g.dateKey, hit: e });
      for (const v of g.vods) {
        out.push({ kind: "vod", dateKey: g.dateKey, titleNo: v.titleNo });
        for (const c of expanded.has(v.titleNo) ? v.allChapters : v.chapters)
          out.push({ kind: "chapter", dateKey: g.dateKey, titleNo: v.titleNo, sec: c.sec });
      }
    }
    return out;
  }, [ordered, expanded]);

  const pick = (row: Row) => {
    hapticTick();
    if (row.kind === "event") onPickEvent(row.dateKey, row.hit.eventId ?? "");
    else if (row.kind === "vod") onPickVod(row.dateKey, row.titleNo);
    else onPickVod(row.dateKey, row.titleNo, row.sec);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0 && e.key !== "Enter") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => {
        const next = e.key === "ArrowDown" ? Math.min(rows.length - 1, c + 1) : Math.max(-1, c - 1);
        listRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      // 2026-09-18 소유자 신고: 결과가 떠 있는 채 다른 말을 치고 Enter → 옛 결과의 행(호버로 잡힌 커서)이 열려 다시보기 창으로
      // 튀었다. 커서는 **지금 결과가 이 검색어의 것일 때만** 유효하고, 아니면 Enter = 디바운스 건너뛰고 바로 검색.
      e.preventDefault();
      if (cursor >= 0 && rows[cursor] && resultForRef.current === q) pick(rows[cursor]);
      else flushRef.current?.();
    }
  };

  // ── 위치 감각: 진행선 + 날짜 레일 + 현재 날짜 말풍선 ─────────────────────────
  const [progress, setProgress] = useState(0); // 0~1
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const scrollIdleRef = useRef<number | null>(null);
  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    setShowTop(el.scrollTop > 480);
    // 현재 묶음 = 스크롤 상단선(+머리 높이)을 지난 마지막 날짜 섹션
    const secs = el.querySelectorAll<HTMLElement>("[data-day]");
    let cur: string | null = null;
    const line = el.scrollTop + 40;
    for (const s of secs) {
      if (s.offsetTop <= line) cur = s.dataset.day ?? null;
      else break;
    }
    setActiveDay(cur ?? secs[0]?.dataset.day ?? null);
  }, []);
  const onScroll = () => {
    measure();
    setScrolling(true);
    if (scrollIdleRef.current) window.clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = window.setTimeout(() => setScrolling(false), 900);
  };
  useLayoutEffect(() => {
    measure();
  }, [measure, ordered, expanded]);
  const jumpToDay = (dateKey: string) => {
    const el = listRef.current;
    const sec = el?.querySelector<HTMLElement>(`[data-day="${dateKey}"]`);
    if (!el || !sec) return;
    hapticTick();
    el.scrollTo({ top: Math.max(0, sec.offsetTop - 6), behavior: "smooth" });
  };
  const railDays = ordered.map((g) => g.dateKey);
  const activeIdx = activeDay ? railDays.indexOf(activeDay) : -1;

  // ── 세그먼트 슬라이딩 썸 ──────────────────────────────────────────────────
  const segRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const btn = seg.querySelector<HTMLElement>(`[data-sort="${sort}"]`);
    if (btn) setThumbPos({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [sort, result]);

  // 행 번호(키보드 커서·스태거용) — 그리는 순서와 rows 순서가 같아야 한다.
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
        onMouseMove={() => {
          if (cursor !== i) setCursor(i);
        }}
        style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
        title={title}
        type="button"
      >
        {children}
      </button>
    );
  };

  // 편집실: 행 옆에 ▶(다시보기 창). 시청자 화면(onReplay 없음)은 행 자체가 재생이라 그대로.
  const withExt = (dateKey: string, titleNo: number, sec: number | undefined, node: ReactNode) =>
    onReplay ? (
      <div className="ps-rowline" key={`${titleNo}:${sec ?? "v"}`}>
        {node}
        <button
          aria-label="다시보기 창 열기"
          className="ps-ext"
          data-act="search-replay-ext"
          onClick={() => {
            hapticTick();
            onReplay(dateKey, titleNo, sec);
          }}
          title={sec !== undefined ? `${formatTimecode(sec)}부터 다시보기` : "다시보기"}
          type="button"
        >
          <Play size={13} strokeWidth={2.6} />
        </button>
      </div>
    ) : (
      node
    );

  const renderGroup = (g: SearchDayGroup) => (
    <section className="ps-day" data-day={g.dateKey} key={g.dateKey}>
      <h3 className="ps-day-head">
        <span>{formatDayLabel(g.dateKey)}</span>
      </h3>
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
              {e.snippet ? (
                <span className="ps-meta">
                  <Highlight text={e.snippet} q={q} />
                </span>
              ) : null}
            </span>
            <span className="ps-side">
              <span className="ps-side-text">{e.startTime ? e.startTime : "일정"}</span>
              <ChevronRight className="ps-act" size={15} aria-hidden="true" />
            </span>
          </>,
          "달력에서 이 일정으로"
        )
      )}
      {g.vods.map((v) => {
        const thumb = thumbOf(v.titleNo) ?? v.thumb;
        const visible = expanded.has(v.titleNo) ? v.allChapters : v.chapters;
        return (
          <div className="ps-vod" key={v.titleNo}>
            {withExt(g.dateKey, v.titleNo, undefined, rowBtn(
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
                    다시보기{v.hostNick ? ` · 합방 ${v.hostNick}` : ""}
                    {v.allChapters.length > 0 ? ` · 챕터 ${v.allChapters.length}` : ""}
                  </span>
                </span>
                <span className="ps-side">
                  <span className="ps-side-text">{formatVodDuration(v.durationMs)}</span>
                  <Play className="ps-act" size={14} aria-hidden="true" />
                </span>
              </>,
              onReplay ? "달력에서 이 날로" : "이 다시보기 처음부터"
            ))}
            {visible.length > 0 ? (
              <div className="ps-chapters">
                {visible.map((c, ci, arr) => {
                  const prev = ci > 0 ? arr[ci - 1] : null;
                  const showSection = c.section && (!prev || prev.section !== c.section);
                  // 같은 상위 항목("✨토리님 굿즈 소개 PPT 시작✨")을 공유하는 세부 항목들은 상위를 한 번만
                  // 소제목으로 쓰고 아래에 묶는다 — 줄마다 되풀이하지 않는다(소유자 2026-09-18).
                  // 상위 항목 줄 자체가 바로 위에 있으면(2:10:55 "PPT 시작" → 세부들) 그 줄이 곧 소제목이라 생략.
                  const showParent =
                    Boolean(c.parent) && (!prev || prev.parent !== c.parent || showSection) && prev?.label !== c.parent;
                  return (
                    <div className={`ps-chapter-wrap${c.parent ? " is-child" : ""}`} key={`${c.sec}:${c.label}`}>
                      {showSection ? (
                        <span className={`ps-section${c.matchedOn === "section" ? " is-hit" : ""}`}>
                          <Highlight text={c.section} q={q} />
                        </span>
                      ) : null}
                      {showParent ? (
                        <span className="ps-parent-head">
                          <Highlight text={c.parent} q={q} />
                        </span>
                      ) : null}
                      {withExt(g.dateKey, v.titleNo, c.sec, rowBtn(
                        { kind: "chapter", dateKey: g.dateKey, titleNo: v.titleNo, sec: c.sec },
                        "ps-chapter",
                        "search-hit-chapter",
                        <>
                          <b className="ps-tc">{formatTimecode(c.sec)}</b>
                          <span className="ps-main">
                            <span className="ps-title">
                              {KIND_ICON[c.matchedOn] ? (() => {
                                const k = KIND_ICON[c.matchedOn];
                                return <k.Icon aria-label={k.label} className={`ps-note${k.cls}`} size={12} />;
                              })() : null}
                              <Highlight text={KIND_ICON[c.matchedOn] ? stripLeadMark(c.label) : c.label} q={q} />
                            </span>
                          </span>
                          <span className="ps-side">
                            <Play className="ps-act" size={12} aria-hidden="true" />
                          </span>
                        </>,
                        `${c.section ? `[${c.section}] ` : ""}${c.label} · ${formatTimecode(c.sec)}${onReplay ? "" : "부터 재생"}`
                      ))}
                    </div>
                  );
                })}
                {v.chapterOverflow > 0 && !expanded.has(v.titleNo) ? (
                  <button
                    className="ps-more-btn"
                    data-act="search-expand-vod"
                    onClick={() => {
                      hapticTick();
                      setExpanded((prev) => new Set(prev).add(v.titleNo));
                    }}
                    type="button"
                  >
                    <ChevronDown size={13} aria-hidden="true" /> {v.chapterOverflow}개 더 보기
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );

  const empty = normalizedLen >= MIN_CHARS && !busy && result && groups.length === 0;
  const hasResults = Boolean(result && groups.length > 0);
  const related = result?.related;
  const hasRelated = Boolean((related?.people?.length ?? 0) > 0 || (related?.terms?.length ?? 0) > 0);
  const hitCount = result?.hits.length ?? 0;

  // 백드롭 클릭으로는 닫지 않는다('이 달 기록'과 같은 결정 — 조준된 행동만: X · Esc · 뒤로가기).
  return (
    <div className="pi-backdrop ps-backdrop" role="presentation">
      <section aria-label="검색" className={`pi-sheet ps-sheet${studio ? " is-studio" : ""}`} role="dialog" aria-modal="true">
        <header className="pi-head ps-head">
          <label className="ps-field">
            <Search aria-hidden="true" size={17} strokeWidth={2.4} />
            <input
              aria-label="검색어"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="일정 · 다시보기 · 챕터"
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
                <X size={13} strokeWidth={2.6} />
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
          {/* 로딩 흐름선(머리 아래) + 스크롤 진행선 — 같은 자리, 다른 상태 */}
          <span
            aria-hidden="true"
            className={`ps-line${busy ? " is-busy" : ""}`}
            style={{ "--p": progress } as React.CSSProperties}
          />
        </header>

        {hasResults ? (
          <div className="ps-toolbar">
            <div className="ps-seg" ref={segRef} role="group" aria-label="정렬">
              {thumbPos ? (
                <span
                  aria-hidden="true"
                  className="ps-seg-thumb"
                  style={{ transform: `translateX(${thumbPos.left}px)`, width: thumbPos.width }}
                />
              ) : null}
              {SEARCH_SORTS.map((s) => (
                <button
                  aria-pressed={sort === s.key}
                  className={`ps-seg-btn${sort === s.key ? " on" : ""}`}
                  data-act="search-sort"
                  data-sort={s.key}
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
            <span className="ps-count">{hitCount >= 200 ? "200+" : hitCount}</span>
          </div>
        ) : null}
        {result?.corrected ? (
          <p className="ps-corrected">
            <strong>{result.corrected}</strong>(으)로 찾았어요
          </p>
        ) : null}

        {hasResults && hasRelated ? (
          <div className="ps-related">
            {related?.terms?.length ? (
              <div className="ps-chiprow">
                <span className="ps-chiplbl">관련</span>
                <div className="ps-chips">
                  {related.terms.map((t) => (
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
            {related?.people?.length ? (
              <div className="ps-chiprow">
                <span className="ps-chiplbl">함께</span>
                <div className="ps-chips">
                  {related.people.map((p) => (
                    <button
                      className="ps-chip ps-chip-person"
                      data-act="search-related-person"
                      key={p.name}
                      onClick={() => {
                        hapticTick();
                        setQ(p.display);
                        inputRef.current?.focus();
                      }}
                      title={`같은 방송 ${p.coDocs}번${p.hapbang ? ` · 합방 ${p.hapbang}번` : ""}${
                        p.visits > 0 ? " · 채팅에 놀러온 적 있음" : ""
                      }`}
                      type="button"
                    >
                      {p.display}
                      {p.hapbang > 0 ? <em>{p.hapbang}</em> : null}
                      {p.hapbang === 0 && p.visits > 0 ? (
                        <MessageCircle aria-label="채팅에 놀러옴" className="ps-chip-visit" size={10} strokeWidth={2.4} />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={`ps-scroll${railDays.length >= 4 ? " has-rail" : ""}`}>
          <div className="pi-body ps-body" onScroll={onScroll} ref={listRef}>
            {normalizedLen < MIN_CHARS ? (
              <div className="ps-start">
                <p className="ps-hint">
                  {studio
                    ? "일정 제목·설명·태그를 먼저 찾고, 타임라인·채팅에서 나온 건 간접 결과로 그 날짜에 갑니다."
                    : "게임·방송 제목·챕터·가수. 초성(ㅁㅋ)과 줄임말(배그)도."}
                </p>
                {!studio && trends.length > 0 ? (
                  <div className="ps-chiprow">
                    <span className="ps-chiplbl">화제</span>
                    <div className="ps-chips">
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
                    <span className="ps-chiplbl">태그</span>
                    <div className="ps-chips">
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
                <strong>&ldquo;{q.trim()}&rdquo;</strong> 없음. 다른 말로 찾아보세요.
              </p>
            ) : null}
            <div className="ps-results" key={`${result?.query ?? ""}|${sort}`}>
              {studio ? (
                <>
                  {directGroups.length > 0 ? (
                    <span className="ps-divider ps-divider-direct">직접 · 일정 제목·설명·태그</span>
                  ) : null}
                  {directGroups.map(renderGroup)}
                  {indirectGroups.length > 0 ? (
                    <div className="ps-similar">
                      <span className="ps-divider">
                        {directGroups.length > 0 ? "간접 · 타임라인·채팅에서 — 누르면 그 날로" : "일정엔 없어요 — 타임라인·채팅에서 (누르면 그 날로)"}
                      </span>
                      {indirectGroups.map(renderGroup)}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {exactGroups.map(renderGroup)}
                  {similarGroups.length > 0 ? (
                    <div className="ps-similar">
                      <span className="ps-divider">
                        {exactGroups.length > 0 ? "비슷한 결과" : "정확히 맞는 건 없어요 — 비슷한 결과"}
                      </span>
                      {similarGroups.map(renderGroup)}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* 날짜 레일 — 결과 묶음마다 점. 지나온 점은 채워지고 현재 점은 커진다. 스크롤 중엔 날짜 말풍선. */}
          {railDays.length >= 4 ? (
            <nav aria-label="날짜 이동" className={`ps-rail${scrolling ? " is-scrolling" : ""}`}>
              {railDays.map((d, i) => {
                const state = i < activeIdx ? "past" : i === activeIdx ? "now" : "next";
                return (
                  <button
                    aria-label={formatDayLabel(d)}
                    className={`ps-rail-dot is-${state}`}
                    data-act="search-rail-jump"
                    key={d}
                    onClick={() => jumpToDay(d)}
                    type="button"
                  >
                    {state === "now" ? <span className="ps-rail-tip">{formatMonthLabel(d)}</span> : null}
                  </button>
                );
              })}
            </nav>
          ) : null}

          {showTop ? (
            <button
              aria-label="맨 위로"
              className="ps-top"
              data-act="search-scroll-top"
              onClick={() => {
                hapticTick();
                listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              type="button"
            >
              <ArrowUp size={15} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
