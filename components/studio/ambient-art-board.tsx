"use client";

// 앰비언트 아트 보드 — 하늘·천체 그림 자리(매니페스트)를 한 화면에서 관리한다: 지금 화면이 쓰는
// 대체물(코드 도형·이모지·실루엣) ↔ 납품된 PNG(`public/ambient/art/<id>.png`), 자리 규격(계절·카메라·크기·변형·도트 격자),
// 코덱스 프롬프트 복사(파일럿·보이는 것만·전체·자리별). 파일을 폴더에 넣고 새로고침하면 상태가 바뀐다(서버가 폴더를 읽는다).
// 개발자 전용(라우트가 막는다).

import type React from "react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Check, ClipboardCopy, Search } from "lucide-react";
import "./ambient-art-board.css";
import {
  ART_DIR,
  ART_SLOTS,
  batchPrompt,
  CATEGORY_KO,
  dotBlock,
  pilotFiles,
  pilotPrompt,
  pilotSlots,
  SEASON_KO,
  slotFiles,
  targetEdge,
  type ArtCategory,
  type ArtFileInfo,
  type ArtSlot,
  type PresentArt
} from "@/components/shared/ambient/art/manifest";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { previewOf } from "@/components/shared/ambient/art/preview";
import { localizeArtPromptPaths } from "@/components/shared/ambient/art/prompt-paths";
import { hapticTick } from "@/lib/ui/haptics";

type Props = {
  /** id → 폴더에 실제로 있는 파일들(서버가 읽음: 이름·바이트·픽셀) */
  present: PresentArt;
  /** 파일 갱신 시각(캐시 무효화용) */
  stamp: number;
};


const SEASONS: SeasonKey[] = ["spring", "summer", "autumn", "winter"];
const CATS: ArtCategory[] = ["sky"];

/** 지금 화면 필터 — "대기"를 다시 둘로 가른다: 대체물이라도 있는 자리 ↔ 아무것도 안 그려지는 자리. */
type NowFilter = "all" | "sub" | "none";
const NOW_FILTERS: { k: NowFilter; ko: string }[] = [
  { k: "all", ko: "지금 전부" },
  { k: "sub", ko: "대체물 있음" },
  { k: "none", ko: "빈 자리" }
];

type SortKey = "declared" | "empty" | "big";
const SORTS: { k: SortKey; ko: string }[] = [
  { k: "declared", ko: "선언 순" },
  { k: "empty", ko: "빈 자리 먼저" },
  { k: "big", ko: "큰 것 먼저" }
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 카드 하나가 화면에 들어왔는가 — 모든 자리가 한꺼번에 대체물을 굽지 않게 한다(굽기는 캔버스 합성이라 카드당 수 ms).
 *  **관찰 대상은 카드 자체다.** 미리보기 칸은 `display: contents`라 상자가 없어서, 거기에 옵서버를 걸면 영영 교차하지 않는다. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

function NowPreview({ slot, seen }: { slot: ArtSlot; seen: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [none, setNone] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const p = previewOf(slot.id);
    if (!p) {
      setNone(true);
      return;
    }
    if (p.kind === "url") {
      setUrl(p.src);
      return;
    }
    const host = ref.current;
    if (!host) return;
    host.replaceChildren(p.c);
    const [w, h] = slot.px;
    const k = Math.min(3, 96 / Math.max(w, h));
    p.c.style.width = `${Math.round(w * k)}px`;
    p.c.style.height = `${Math.round(h * k)}px`;
    return () => host.replaceChildren();
  }, [slot, seen, ref]);
  if (none) return <span className="art-empty">아무것도 안 그려짐</span>;
  if (url) return <Image alt="" loading="lazy" src={url} width={96} height={96} unoptimized />;
  return <div ref={ref} style={{ display: "contents" }} />;
}

type CardProps = { slot: ArtSlot; files: ArtFileInfo[]; stamp: number; i: number };

const Card = memo(function Card({ slot, files, stamp, i }: CardProps) {
  const { ref, seen } = useInView<HTMLAnchorElement>();
  const want = slotFiles(slot);
  const done = files.length >= want.length;
  const partial = files.length > 0 && !done;
  const empty = !done && slot.now === "none";
  const ground = slot.seasons.length === 1 ? `ground-${slot.seasons[0]}` : "";
  // 저장 규격 — 1024의 정수 약수(128·256·512)만 쓴다. `npm run art:normalize`가 같은 수로 줄인다.
  const edge = targetEdge(slot.px);
  const heavy = files.some((f) => Math.max(f.w, f.h) > edge * 1.3 || f.bytes > 160 * 1024);
  // 옛 규격(lanczos3 시절)으로 줄여 둔 파일 — 변이 블록 배수가 아니면 도트가 이미 뭉개졌다는 신호다.
  const block = dotBlock(slot.px, slot.grid);
  const stale = files.some((f) => f.w % block !== 0 && f.h % block !== 0);
  // 카드는 **"무엇이 남았나"만** 답한다(2026-09-08 PLAN-010, 소유자: "너무 어수선해").
  // 규격 칩·브리프·도감 줄·동숲 참고는 전부 상세(/studio/ambient-art/<자리>)로 갔다 — 목록에 브리프를 통째로 실으니
  // 카드 하나가 화면 절반이 됐고 프롬프트용 마크다운의 별표까지 그대로 보였다.
  // 남긴 넷: 미리보기 한 장 · 이름 · 진행 **칸** · 규격을 어긴 파일 경고.
  return (
    <Link
      className={`art-card${done ? " done" : ""}`}
      data-slot={slot.id}
      data-act="art-slot-open"
      href={`/studio/ambient-art/${slot.id}` as Route}
      prefetch={false}
      ref={ref}
      data-state={done ? "done" : partial ? "partial" : empty ? "empty" : "todo"}
      style={{ "--i": Math.min(i, 24) } as React.CSSProperties}
    >
      <div className={`art-cell ${ground}`}>
        {files.length ? (
          <Image alt={slot.nameKo} loading="lazy" src={`${ART_DIR}/${files[0].file}?v=${stamp}`} width={96} height={96} unoptimized />
        ) : (
          <NowPreview seen={seen} slot={slot} />
        )}
      </div>
      <div className="art-card-main">
        <div className="art-card-name" title={slot.id}>
          <strong>{slot.nameKo}</strong>
        </div>
        {/* 진행은 숫자가 아니라 칸이다 — 빈 칸 다섯 개가 "3/8"보다 빠르다(상세에서 검증된 방식). */}
        <span className="art-pips" title={`${files.length}/${want.length}장`} aria-label={`${want.length}장 중 ${files.length}장 납품`}>
          {want.map((f, n) => (
            <i data-on={files.some((x) => x.file === f) ? "1" : "0"} key={f}>
              <span className="sr-only">{n + 1}</span>
            </i>
          ))}
        </span>
        {heavy ? (
          <span className="art-flag" data-art-heavy>
            원본이 크다 — art:normalize
          </span>
        ) : stale ? (
          <span className="art-flag" data-art-stale>
            옛 규격({block}px 배수 아님)
          </span>
        ) : empty ? (
          <span className="art-flag" data-art-empty>
            대체물 없음
          </span>
        ) : null}
      </div>
    </Link>
  );
});

export function AmbientArtBoard({ present, stamp }: Props) {
  const [season, setSeason] = useState<SeasonKey | "all">("all");
  const [cat, setCat] = useState<ArtCategory | "all">("all");
  const [state, setState] = useState<"all" | "todo" | "done">("all");
  const [nowF, setNowF] = useState<NowFilter>("all");
  const [pilotOnly, setPilotOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("declared");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q); // 타이핑마다 모든 자리를 다시 거르지 않는다
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // 스티키 도구 줄 — 붙는 순간에만 배경·그림자를 켠다(늘 켜 두면 머리글이 답답하다).
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const onScroll = () => el.setAttribute("data-stuck", el.getBoundingClientRect().top <= 0.5 ? "1" : "0");
    onScroll();
    // 갈래 머리(.art-section h2)가 **도구 줄 바로 아래**에 붙어야 한다 — 상수로 박으면 필터가 한 줄 늘 때마다
    // 머리가 도구 줄 뒤로 숨는다(실제로 58px로 박아 두고 숨었다). 높이를 재서 변수로 넘긴다.
    // 변수는 **보드 뿌리**에 심는다 — 갈래 머리는 도구 줄의 자식이 아니라 형제라, 줄 자신에게 심으면 닿지 않는다.
    const root = el.closest<HTMLElement>("[data-art-board]");
    const setH = () => root?.style.setProperty("--ab-bar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  // "/"로 이름·id 검색으로 뛴다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isDone = useCallback((s: ArtSlot) => (present[s.id]?.length ?? 0) >= slotFiles(s).length, [present]);

  const stats = useMemo(() => {
    let done = 0;
    let empty = 0;
    let pilotWant = 0;
    let pilotDone = 0;
    for (const s of ART_SLOTS) {
      const ok = isDone(s);
      if (ok) done++;
      if (!ok && s.now === "none") empty++;
      if (s.pilot) {
        const want = pilotFiles(s);
        pilotWant += want.length;
        pilotDone += want.filter((n) => (present[s.id] ?? []).some((f) => f.file === n)).length;
      }
    }
    return { total: ART_SLOTS.length, done, empty, pilotWant, pilotDone };
  }, [present, isDone]);

  const visible = useMemo(() => {
    const n = dq.trim().toLowerCase();
    const list = ART_SLOTS.filter((s) => {
      if (pilotOnly && !s.pilot) return false;
      if (season !== "all" && !s.seasons.includes(season)) return false;
      if (cat !== "all" && s.category !== cat) return false;
      const ok = isDone(s);
      if (state === "done" && !ok) return false;
      if (state === "todo" && ok) return false;
      if (nowF === "none" && s.now !== "none") return false;
      if (nowF === "sub" && s.now === "none") return false;
      if (n && !s.id.includes(n) && !s.nameKo.includes(dq.trim()) && !s.nameEn.toLowerCase().includes(n)) return false;
      return true;
    });
    if (sort === "big") return [...list].sort((a, b) => Math.max(b.px[0], b.px[1]) - Math.max(a.px[0], a.px[1]));
    if (sort === "empty") return [...list].sort((a, b) => Number(b.now === "none") - Number(a.now === "none"));
    return list;
  }, [season, cat, state, nowF, pilotOnly, sort, dq, isDone]);

  // 모든 복사 동작은 같은 경로 현지화·클립보드·알림을 쓴다.
  const copy = useCallback(async (text: string, label: string) => {
    hapticTick();
    const currentPrompt = localizeArtPromptPaths(text);
    const ok = await copyText(currentPrompt);
    setToast(ok ? `${label} 복사됨 (${currentPrompt.length.toLocaleString()}자)` : "복사 실패 — 브라우저가 막았습니다");
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
    if (ok) hapticTick();
  }, []);

  // 아직 안 온 파일들(보이는 자리 기준) — 변형별 납품 상태를 보존하며 파일 단위로 부탁한다.
  const missingFiles = useMemo(() => {
    const out: string[] = [];
    for (const s of visible) {
      const have = present[s.id] ?? [];
      for (const f of slotFiles(s)) if (!have.some((p2) => p2.file === f)) out.push(f);
    }
    return out;
  }, [visible, present]);

  // 하늘·천체 자리의 진행과 납품 상태를 같은 카드 격자로 보여 준다.
  const groups = useMemo(() => {
    return CATS.map((k) => {
      const list = visible.filter((s2) => s2.category === k);
      const all = ART_SLOTS.filter((s2) => s2.category === k);
      return { key: k, list, done: all.filter((s2) => isDone(s2)).length, total: all.length };
    }).filter((g) => g.list.length > 0);
  }, [visible, isDone]);
  const visibleFiles = visible.reduce((n, s) => n + slotFiles(s).length, 0);
  const pilotCount = pilotSlots().reduce((n, s) => n + pilotFiles(s).length, 0);

  return (
    <main className="art-board" data-art-board>
      <header className="art-board-head">
        <div className="art-head-left">
          <a className="art-back" data-act="art-back" href="/studio">
            <ArrowLeft aria-hidden="true" size={12} /> 편집실
          </a>
          <h1>하늘·천체 아트 보드</h1>
          <p className="art-lede">
            하늘·천체 자리의 그림을 관리한다. PNG를 <code>public/ambient/art/</code>에 자리의 id 이름으로 넣으면 장면이 바로 쓴다.
          </p>
          {/* 파이프라인 설명은 한 번 알면 필요 없다 — 매번 첫 화면을 먹지 않게 접는다(2026-09-08 PLAN-010). */}
          <details className="art-help">
            <summary>규격이 어떻게 도는지</summary>
            <p>
              생성기 원본은 <b>1024 정사각</b>(그 아래를 못 준다). 저장은 <code>npm run art:normalize</code>가 <b>1024의 정수 약수</b>
              (128·256·512)로 <b>nearest 정수배</b> 축소한다 — 자리의 <b>격자</b>가 코덱스가 지킬 도트 크기다. 자리를 누르면 그 자리의
              변형·규격·프롬프트가 한 화면에 모인다. (<code>next dev</code>는 새로고침으로 즉시, 운영은 커밋·배포 — 프로덕션 서버는 시작
              때의 <code>public/</code> 목록만 낸다.)
            </p>
          </details>
        </div>
        {/* 통계는 한 줄로 보여 준다 — 자리 진행 · 파일럿 · 빈 자리. */}
        <div className="art-summary">
          <span className="art-sum-main">
            <b>{stats.done}</b>
            <i>/{stats.total}</i> 자리 납품
          </span>
          <span className="art-bar wide">
            <i style={{ width: `${Math.round((stats.done / Math.max(1, stats.total)) * 100)}%` }} />
          </span>
          <span className="art-sum-side">
            파일럿 {stats.pilotDone}/{stats.pilotWant}
          </span>
          <span className="art-sum-side warn">빈 자리 {stats.empty}</span>
        </div>
      </header>
      <div className="art-board-bar" ref={barRef}>
        <div className="art-board-bar-inner">
          {/* 자주 쓰는 "남은 파일만"을 앞에 두고 다른 프롬프트는 서랍으로 접는다. */}
          <div className="art-board-actions">
            <button
              className="art-btn primary"
              data-act="art-prompt-copy-missing"
              disabled={!missingFiles.length}
              onClick={() =>
                void copy(
                  batchPrompt(visible, `아직 안 온 파일 ${missingFiles.length}장`, {
                    files: missingFiles,
                    note: `**이미 배달돼 합격한 파일은 표에 없다.** 화풍의 기준선은 \`public/ambient/art/\` 의 합격본이다 — 새 그림은 그것들과 나란히 놓아 한 세트로 보여야 한다.`
                  }),
                  "남은 파일 프롬프트"
                )
              }
              type="button"
            >
              <ClipboardCopy aria-hidden="true" size={14} /> 남은 파일만 — {missingFiles.length}장
            </button>
            <details className="art-more">
              <summary>다른 프롬프트</summary>
              <div className="art-more-body">
                <button className="art-btn small" data-act="art-prompt-copy-pilot" onClick={() => void copy(pilotPrompt(), "파일럿 프롬프트")} type="button">
                  파일럿 {pilotCount}장
                </button>
                <button
                  className="art-btn small"
                  data-act="art-prompt-copy-visible"
                  disabled={!visible.length}
                  onClick={() => void copy(batchPrompt(visible, `보이는 자리 ${visible.length}개`), "보이는 자리 프롬프트")}
                  type="button"
                >
                  보이는 것 {visible.length}자리 · {visibleFiles}장
                </button>
                <button className="art-btn small" data-act="art-prompt-copy-all" onClick={() => void copy(batchPrompt(ART_SLOTS, "하늘·천체 전체"), "전체 프롬프트")} type="button">
                  전체
                </button>
              </div>
            </details>
          </div>
          {/* 검색 · 범주 · 상태 · 정렬은 바로 보여 주고 계절·"지금"·파일럿은 서랍으로 접는다. */}
          <div className="art-board-filters" role="group" aria-label="필터">
            <label className="art-search">
              <Search aria-hidden="true" size={13} />
              <input onChange={(e) => setQ(e.target.value)} placeholder="이름·id 찾기 (/)" ref={searchRef} type="search" value={q} />
            </label>
            <select aria-label="갈래" className="art-select" onChange={(e) => setCat(e.target.value as ArtCategory | "all")} value={cat}>
              <option value="all">갈래 전부</option>
              {CATS.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_KO[k]}
                </option>
              ))}
            </select>
            <div className="art-seg strong" role="group" aria-label="납품 상태">
              <button aria-pressed={state === "all"} className="art-chip" data-act="art-filter" onClick={() => setState("all")} type="button">
                전체
              </button>
              <button aria-pressed={state === "todo"} className="art-chip" data-act="art-filter" onClick={() => setState("todo")} type="button">
                남음
              </button>
              <button aria-pressed={state === "done"} className="art-chip" data-act="art-filter" onClick={() => setState("done")} type="button">
                납품됨
              </button>
            </div>
            <select aria-label="정렬" className="art-select" onChange={(e) => setSort(e.target.value as SortKey)} value={sort}>
              {SORTS.map(({ k, ko }) => (
                <option key={k} value={k}>
                  {ko}
                </option>
              ))}
            </select>
            <details className="art-more">
              <summary>필터 더</summary>
              <div className="art-more-body">
                <div className="art-seg" role="group" aria-label="계절">
                  <button aria-pressed={season === "all"} className="art-chip" data-act="art-filter" onClick={() => setSeason("all")} type="button">
                    사철
                  </button>
                  {SEASONS.map((k) => (
                    <button aria-pressed={season === k} className="art-chip" data-act="art-filter" key={k} onClick={() => setSeason(k)} type="button">
                      {SEASON_KO[k]}
                    </button>
                  ))}
                </div>
                <div className="art-seg" role="group" aria-label="지금 화면">
                  {NOW_FILTERS.map(({ k, ko }) => (
                    <button aria-pressed={nowF === k} className="art-chip" data-act="art-filter" key={k} onClick={() => setNowF(k)} type="button">
                      {ko}
                    </button>
                  ))}
                </div>
                <div className="art-seg" role="group" aria-label="파일럿">
                  <button aria-pressed={pilotOnly} className="art-chip" data-act="art-filter" onClick={() => setPilotOnly((v) => !v)} type="button">
                    파일럿만
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
      {groups.map((g) => (
        <section className="art-section" key={g.key}>
          <h2>
            {CATEGORY_KO[g.key]}
            <small>
              {g.list.length}자리{g.list.length !== g.total ? ` / ${g.total}` : ""}
            </small>
            <span className="art-sec-bar" title={`${g.done} / ${g.total} 납품됨`}>
              <i style={{ width: `${Math.round((g.done / Math.max(1, g.total)) * 100)}%` }} />
            </span>
            <em>
              {g.done}/{g.total}
            </em>
          </h2>
          <div className="art-grid">
            {g.list.map((s, i) => (
              <Card files={present[s.id] ?? []} i={i} key={s.id} slot={s} stamp={stamp} />
            ))}
          </div>
        </section>
      ))}
      {!groups.length ? <p className="art-none">조건에 맞는 자리가 없다. 필터를 풀어 보라.</p> : null}
      {toast ? (
        <div className="art-toast" role="status">
          <Check aria-hidden="true" size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}
