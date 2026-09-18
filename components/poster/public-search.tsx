"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import type { PublicSearchHit, PublicSearchResult } from "@/lib/domain/schedule-types";
import { findMatchRange, groupSearchHits, personalizeHits, type SearchDayGroup } from "@/lib/search/group";
import { formatVodDuration } from "@/components/poster/day-vod-window";
import { formatTimecode } from "@/components/poster/vod-chapters";
import { hapticTick } from "@/lib/ui/haptics";

// 시청자 검색 시트(PLAN-20260918-023 P1) — "예전에 이런 게 있었던 것 같은데 언제, 어디 시간대였지?"
//
// 껍데기는 '이 달 기록' 시트와 같은 pi-* 부품(백드롭·시트·머리·X). 시청자·편집실 미리보기·비로그인이
// 한 구현을 쓴다(G-18). 결과의 순위는 서버(search_public RPC)가 내고, 여기서는 날짜별로 묶어
// (lib/search/group.ts) 보여주고 고른 것을 부모에게 넘긴다 — 달력 이동·다시보기 열기는 부모의 몫.
//
// 열림 동안 검색어를 어디에도 남기지 않는다(소유자 결정 2026-09-18). 개인화(내 ♥ 일정 +0.3)는
// 클라이언트에서만 더한다 — 서버 응답은 익명 동일해야 CDN 캐시가 안전하다.

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2; // 정규화(공백·기호 제거) 후 글자 수 — 서버와 같은 기준

type Props = {
  slug: string;
  myHeartIds: ReadonlySet<string>;
  onClose: () => void;
  onPickEvent: (dateKey: string, eventId: string) => void;
  onPickVod: (dateKey: string, titleNo: number, sec?: number) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${WEEKDAYS[wd]})`;
}

// 적중 글자 강조 — 공백·기호를 건너뛰는 정규화 매칭(서버와 같은 규칙). 첫 구간만.
function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  const r = findMatchRange(text, q);
  if (!r) return text;
  return (
    <>
      {text.slice(0, r[0])}
      <mark>{text.slice(r[0], r[1])}</mark>
      {text.slice(r[1])}
    </>
  );
}

export function PublicSearch({ slug, myHeartIds, onClose, onPickEvent, onPickVod }: Props) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<PublicSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(-1); // 키보드 ↑↓ 현재 항목(-1 = 입력창)
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
  const normalizedLen = q.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").length;
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
    () => (result ? groupSearchHits(personalizeHits(result.hits, myHeartIds)) : []),
    [result, myHeartIds]
  );

  // 키보드 ↑↓ Enter — 화면에 그려진 순서 그대로 한 줄 목록으로 편다(일정 → 다시보기 → 챕터).
  type Row =
    | { kind: "event"; dateKey: string; hit: PublicSearchHit }
    | { kind: "vod"; dateKey: string; titleNo: number }
    | { kind: "chapter"; dateKey: string; titleNo: number; sec: number };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups) {
      for (const e of g.events) out.push({ kind: "event", dateKey: g.dateKey, hit: e });
      for (const v of g.vods) {
        out.push({ kind: "vod", dateKey: g.dateKey, titleNo: v.titleNo });
        for (const c of v.chapters) out.push({ kind: "chapter", dateKey: g.dateKey, titleNo: v.titleNo, sec: c.sec });
      }
    }
    return out;
  }, [groups]);

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
        const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`);
        el?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter" && cursor >= 0 && rows[cursor]) {
      e.preventDefault();
      pick(rows[cursor]);
    }
  };

  // 행 번호(키보드 커서용) — 그리는 순서와 rows 순서가 같아야 한다.
  let rowNo = -1;
  const rowBtn = (row: Row, className: string, act: string, children: ReactNode, title?: string) => {
    rowNo += 1;
    const i = rowNo;
    return (
      <button
        className={`${className}${cursor === i ? " is-cursor" : ""}`}
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
              placeholder="일정 · 다시보기 · 챕터에서 찾기"
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

        <div className={`pi-body ps-body${busy ? " is-busy" : ""}`} ref={listRef}>
          {normalizedLen < MIN_CHARS ? (
            <p className="ps-hint">
              게임 이름, 방송 제목, 챕터 이름으로 찾아보세요. 예: <em>젤다</em>, <em>엔딩</em>, <em>노래</em>
            </p>
          ) : null}
          {failed ? <p className="ps-hint ps-fail">검색이 잠시 안 돼요. 다시 시도해 주세요.</p> : null}
          {empty ? (
            <p className="ps-hint">
              <strong>&ldquo;{q.trim()}&rdquo;</strong>에 맞는 일정·다시보기가 없어요. 다른 말로 찾아보세요.
            </p>
          ) : null}
          {groups.map((g) => (
            <section className="ps-day" key={g.dateKey}>
              <h3 className="ps-day-head">{formatDayLabel(g.dateKey)}</h3>
              {g.events.map((e) =>
                rowBtn(
                  { kind: "event", dateKey: g.dateKey, hit: e },
                  "ps-row ps-event",
                  "search-hit-event",
                  <>
                    <span className="ps-kind">일정</span>
                    <span className="ps-main">
                      <span className="ps-title">
                        {e.startTime ? <b className="ps-time">{e.startTime}</b> : null}
                        <Highlight text={e.title} q={q} />
                      </span>
                      {e.snippet ? (
                        <span className="ps-snippet">
                          <Highlight text={e.snippet} q={q} />
                        </span>
                      ) : null}
                    </span>
                    <span className="ps-go">달력으로</span>
                  </>,
                  "달력에서 이 일정으로"
                )
              )}
              {g.vods.map((v) => (
                <div className={`ps-vod${v.matched ? "" : " via-chapter"}`} key={v.titleNo}>
                  {rowBtn(
                    { kind: "vod", dateKey: g.dateKey, titleNo: v.titleNo },
                    "ps-row ps-vod-row",
                    "search-hit-vod",
                    <>
                      <span className="ps-kind">다시보기</span>
                      <span className="ps-main">
                        <span className="ps-title">
                          <Highlight text={v.title} q={q} />
                        </span>
                        <span className="ps-snippet">
                          {formatVodDuration(v.durationMs)}
                          {v.hostNick ? ` · 합방 · ${v.hostNick}` : ""}
                        </span>
                      </span>
                      <span className="ps-go">▶ 처음부터</span>
                    </>,
                    "이 다시보기 열기"
                  )}
                  {v.chapters.map((c) =>
                    rowBtn(
                      { kind: "chapter", dateKey: g.dateKey, titleNo: v.titleNo, sec: c.sec },
                      "ps-row ps-chapter",
                      "search-hit-chapter",
                      <>
                        <b className="ps-tc">{formatTimecode(c.sec)}</b>
                        <span className="ps-main">
                          <span className="ps-title">
                            <Highlight text={c.label} q={q} />
                          </span>
                        </span>
                        <span className="ps-go">▶ 이 시각부터</span>
                      </>,
                      "이 시각부터 재생"
                    )
                  )}
                  {v.chapterOverflow > 0 ? (
                    <span className="ps-more">챕터 {v.chapterOverflow}개 더 — 다시보기에서 전부 볼 수 있어요</span>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
