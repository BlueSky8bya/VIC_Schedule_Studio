"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PublicVodTimeline } from "@/lib/domain/schedule-types";
import { hapticTick } from "@/lib/ui/haptics";

// 다시보기 챕터(팬 타임라인, 0071) — PC 날짜 팝오버·모바일 아젠다 칩 아래 공용.
//
// 인지 설계(2026-08-31 사용자 논의):
//  · 팬이 적은 [코너] 헤더를 그룹 앵커로 살린다 — "게임 구간 어딘가"까지 텍스트 없이 좁혀진다.
//  · 항목마다 구간 길이(다음 항목까지)를 표기 — 라벨이 암시적이어도 코너의 무게가 보인다.
//  · 항목 탭 = 그 시각으로 숲 플레이어 점프(?change_second= — 실측 확정). 확인 비용을 낮추는 게
//    본질: 후보를 몇 개 찍어 3초씩 확인하는 흐름이 자연스럽게.
// 본문은 무거워서(최대 100+줄) 펼칠 때만 받아온다. 개수·작성자는 공개 번들이 이미 안다.
export type VodChaptersApi = {
  chapter: (dir: 1 | -1) => void; // 이전/다음 항목으로 점프
  group: (dir: 1 | -1) => void; // 이전/다음 코너 첫 항목으로 점프
  toggle: () => void; // 레일 접기/펼치기
};

export function VodChapters({
  slug,
  titleNo,
  durationMs,
  chapters,
  timelineBy,
  onJump,
  defaultOpen,
  subscribeTime,
  stripHost,
  register
}: {
  slug: string;
  titleNo: number;
  durationMs: number;
  chapters: number;
  timelineBy: string;
  // 있으면 챕터 클릭 = 부모의 인라인 플레이어로 그 시점 재생(날짜 창 — 미리보기 영역 활용).
  // 없으면(모바일 아젠다) 기존처럼 숲 플레이어 새 탭.
  onJump?: (sec: number) => void;
  // true면 마운트하자마자 펼친다(날짜 창에서 방송이 하나뿐일 때 — 클릭 한 번 절약).
  defaultOpen?: boolean;
  // 재생 위치 구독(2026-09-03) — 부모 인라인 플레이어의 currentTime(초)을 흘려준다. 있으면
  // 현재 챕터가 재생을 **따라 이동**하고(지나온 챕터는 흐림), 레일이 그 항목을 따라 스크롤한다.
  subscribeTime?: (cb: (sec: number) => void) => () => void;
  // 가로 타임라인 띠(2026-09-17 대개편)를 그릴 자리 — 플레이어 아래 상자. 레일(이 컴포넌트의 뿌리)과 다른 그리드 칸이라
  // 포털로 꽂는다. 없으면(모바일 아젠다) 띠 없음. 띠는 전체 길이 대비 코너 구간·항목 눈금·재생 머리·호버 이름을 보이고,
  // 클릭 = 그 시각으로 점프(플레이어 자체 탐색줄 대용 — iframe이라 우리 탐색줄이 없었다).
  stripHost?: HTMLElement | null;
  // 키보드 조종 API 등록(부모 창의 ↑/↓·[/]·C가 여기로 온다). 언마운트 때 null.
  register?: (api: VodChaptersApi | null) => void;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen) && chapters > 0);
  const [timeline, setTimeline] = useState<PublicVodTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // 현재 챕터(entries 인덱스) — 클릭한 챕터 또는 재생 위치가 속한 챕터. 유튜브 활성 챕터처럼
  // '지금 어디쯤인지'를 목록이 보여준다. 인라인 점프(onJump)에서만 의미 있다.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef(false); // 레일 위에 마우스가 있으면 자동 추적 스크롤을 멈춘다(읽는 중)
  const followRef = useRef(false); // 이번 activeIdx 변경이 재생 추적에서 왔는지(→ 자동 스크롤)
  // 잘린 라벨 전문 툴팁(2026-09-03 사용자 요청) — 말줄임된 항목에만, 120ms 뒤 그 항목 안에 absolute로
  // (아래쪽, 레일 바닥에 닿으면 위쪽). fixed는 창의 등장 애니메이션이 남긴 transform 때문에 기준이
  // 창 박스가 돼 좌표가 어긋났다(실측). 항목 안이면 레일 스크롤과 함께 움직이고 z-index만 챙기면 된다.
  const [tip, setTip] = useState<{ idx: number; text: string; above: boolean } | null>(null);
  const tipTimerRef = useRef(0);
  const showTip = (el: HTMLElement, text: string, idx: number) => {
    const label = el.querySelector<HTMLElement>(".vch-label");
    if (!label || label.scrollWidth <= label.clientWidth + 1) return; // 안 잘렸으면 툴팁 없음
    window.clearTimeout(tipTimerRef.current);
    tipTimerRef.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const rail = scrollRef.current?.getBoundingClientRect();
      setTip({ idx, text, above: rail !== undefined && r.bottom + 76 > rail.bottom });
    }, 120);
  };
  const hideTip = () => {
    window.clearTimeout(tipTimerRef.current);
    setTip(null);
  };
  useEffect(() => () => window.clearTimeout(tipTimerRef.current), []);
  // 코너 접기(2026-09-17) — 헤더 이름을 누르면 그 코너의 항목이 접힌다(긴 방송의 34개 항목 탐색 비용 ↓).
  // 재생·키보드가 접힌 코너의 항목에 닿으면 자동으로 펼친다.
  const [folded, setFolded] = useState<ReadonlySet<number>>(new Set());
  // 가로 띠의 재생 머리·호버선은 프레임마다 React 렌더 없이 style만 쓴다(초당 4회 timeUpdate + 마우스 이동).
  const headRef = useRef<HTMLSpanElement | null>(null);
  const hoverLineRef = useRef<HTMLSpanElement | null>(null);
  const hoverTipRef = useRef<HTMLSpanElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // 재생 위치 → 현재 챕터. 시각이 현재보다 작거나 같은 항목 중 가장 늦은 것(정렬 가정 없이
  // 선형 — 항목 ≤100개, 초당 4회라 무시할 비용). idx가 바뀔 때만 setState → 레일만 다시 그림.
  const secs = useMemo(() => (timeline?.entries ?? []).map((e) => e.sec), [timeline]);
  useEffect(() => {
    if (!subscribeTime || !open || secs.length === 0) return;
    return subscribeTime((sec) => {
      const head = headRef.current;
      if (head && durationMs > 0) head.style.left = `${Math.min(100, Math.max(0, (sec / (durationMs / 1000)) * 100))}%`;
      let found = -1;
      for (let i = 0; i < secs.length; i++) {
        if (secs[i] <= sec && (found < 0 || secs[i] >= secs[found])) found = i;
      }
      const idx = found < 0 ? null : found;
      setActiveIdx((prev) => {
        if (prev === idx) return prev;
        followRef.current = true;
        return idx;
      });
    });
  }, [subscribeTime, open, secs, durationMs]);
  // 재생 추적으로 현재 챕터가 바뀌면 레일이 따라간다 — 마우스가 레일 위면 멈춤(사용자 스크롤과
  // 싸우지 않게). nearest + 스크롤러의 scroll-padding으로 sticky 코너 헤더 밑에 숨지 않는다.
  useEffect(() => {
    if (activeIdx === null) return;
    // 현재 항목이 접힌 코너 안이면 펼친다(어디쯤인지는 항상 보여야 한다).
    const gi = groupsRef.current.findIndex((g) => g.items.some((it) => it.idx === activeIdx));
    if (gi >= 0) {
      setFolded((prev) => {
        if (!prev.has(gi)) return prev;
        const next = new Set(prev);
        next.delete(gi);
        return next;
      });
    }
    if (!followRef.current) return;
    followRef.current = false;
    if (hoverRef.current) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (!el) return;
    const reduce = document.documentElement.hasAttribute("data-reduce-motion");
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [activeIdx]);

  // 펼친 순간에만 본문을 받아온다(자동 펼침 포함) — 접힌 칩마다 미리 받으면 낭비.
  // ⚠ loading을 의존성/가드에 넣지 않는다 — setLoading(true)가 이 effect를 재실행시키면
  // 이전 실행의 cleanup(alive=false)이 돌아 도착한 응답을 버리고 '불러오는 중'에 갇힌다(실측).
  useEffect(() => {
    if (!open || timeline !== null || failed) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/public/${slug}/vod-timeline?titleNo=${titleNo}`);
        const json = (await res.json()) as PublicVodTimeline;
        if (!alive) return;
        if (Array.isArray(json.entries) && json.entries.length > 0) setTimeline(json);
        else setFailed(true);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, timeline, failed, slug, titleNo]);

  // 챕터([코너] 헤더) 단위 그룹 = 카드 하나. 시간순으로 같은 코너가 이어지는 동안 한 카드(코너가 나중에
  // 다시 나오면 그건 다른 시간대의 별개 카드 — 시간순이 우선). 코너 없는 옛 타임라인은 한 덩어리.
  // ⚠ 예전엔 2열 신문식 배치(2026-09-02 폐기) 때문에 8개 단위로 카드를 쪼갰는데, 그 잔재가 "같은 챕터인데
  // 박스가 나뉘고, sticky 헤더가 8개 뒤에서 멈추는" 현상의 원인이었다(2026-09-04 사용자 신고). sticky의
  // 컨테이닝 블록 = 카드이므로 카드를 안 쪼개야 헤더가 그 챕터 끝까지 따라온다.
  const groups = useMemo(() => {
    const list = timeline?.entries ?? [];
    const out: {
      section: string | null;
      items: { sec: number; label: string; idx: number; depth: number }[];
    }[] = [];
    list.forEach((e, idx) => {
      // depth = 팬이 "ㄴ"로 매단 세부 항목(2026-09-06) — 들여쓰기로만 표현한다(별도 카드 아님).
      const item = { sec: e.sec, label: e.label, idx, depth: e.depth ?? 0 };
      const last = out[out.length - 1];
      if (last && last.section === e.section) last.items.push(item);
      else out.push({ section: e.section, items: [item] });
    });
    return out;
  }, [timeline]);
  // 챕터 수 = 코너 헤더가 있는 카드 수(본문을 받은 뒤에만 안다). 번들의 `chapters`는 **타임라인 항목 수**다 —
  // 머리에 "챕터 139개"로 적혀 있어 챕터(코너)와 타임라인(항목)이 뒤바뀌어 읽혔다(2026-09-04 사용자).
  const sectionCount = useMemo(() => groups.filter((g) => g.section).length, [groups]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  // 키보드 조종(2026-09-17): ↑/↓ 항목, [ ] 코너. 최신 상태는 ref로 읽어 한 번만 등록한다.
  const navRef = useRef({ activeIdx, onJump });
  navRef.current = { activeIdx, onJump };
  const jumpTo = (idx: number) => {
    const jump = navRef.current.onJump;
    const item = groupsRef.current.flatMap((g) => g.items).find((it) => it.idx === idx);
    if (!item || !jump) return;
    followRef.current = true; // 키보드는 손이 레일 위에 없다 — 자동 스크롤로 보여 준다
    setActiveIdx(idx);
    jump(item.sec);
  };
  const jumpToRef = useRef(jumpTo);
  jumpToRef.current = jumpTo;
  useEffect(() => {
    if (!register) return;
    register({
      chapter: (dir) => {
        const all = groupsRef.current.flatMap((g) => g.items);
        if (all.length === 0) return;
        const cur = navRef.current.activeIdx;
        const pos = cur === null ? -1 : all.findIndex((it) => it.idx === cur);
        const next = Math.max(0, Math.min(all.length - 1, pos + dir));
        if (next === pos) return;
        jumpToRef.current(all[next].idx);
      },
      group: (dir) => {
        const gs = groupsRef.current;
        if (gs.length === 0) return;
        const cur = navRef.current.activeIdx;
        const gi = cur === null ? -1 : gs.findIndex((g) => g.items.some((it) => it.idx === cur));
        const next = Math.max(0, Math.min(gs.length - 1, gi + dir));
        if (next === gi) return;
        jumpToRef.current(gs[next].items[0].idx);
      },
      toggle: () => setOpen((v) => !v)
    });
    return () => register(null);
  }, [register]);

  if (chapters <= 0) return null;

  const toggle = () => {
    hapticTick();
    setOpen((v) => !v);
  };

  const hhmmss = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };
  // (항목별 구간 길이 표기는 2026-09-01 사용자 결정으로 없음 — 길이는 가로 띠의 구간 폭이 대신 말한다.)

  return (
    <div className="vod-chapters">
      <button
        aria-expanded={open}
        className="vch-toggle"
        data-act="vod-chapters-open"
        onClick={toggle}
        type="button"
      >
        <span aria-hidden="true" className="vch-caret">{open ? "▾" : "▸"}</span>
        {/* 항목 수는 번들이 알고, 챕터(코너) 수는 펼쳐 본문을 받은 뒤 앞에 붙는다. */}
        {open && timeline && sectionCount > 0 ? `챕터 ${sectionCount}개 · ` : ""}
        타임라인 {chapters}개
        {timelineBy ? <em className="vch-by">({timelineBy}님 감사합니다)</em> : null}
      </button>
      {!open ? null : loading ? (
        <p className="vch-note">불러오는 중…</p>
      ) : failed || !timeline ? (
        <p className="vch-note">챕터를 불러오지 못했어요.</p>
      ) : (
        /* 스크롤 래퍼는 목록과 분리 — 날짜 창(단일 방송)에선 이 래퍼만 흐르고 미리보기는 고정.
           columns를 스크롤 요소에 직접 걸면 높이 제한이 열 개수를 불리므로(가로 넘침) 분리 필수. */
        <div
          className="vch-scroll"
          onPointerEnter={() => {
            hoverRef.current = true;
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
            hideTip();
          }}
          onScroll={hideTip}
          ref={scrollRef}
        >
          <div className="vch-list">
            {groups.map((g, gi) => (
              <section className="vch-group" data-folded={folded.has(gi) ? "" : undefined} key={gi}>
                {g.section ? (
                  <div className="vch-sec">
                    {/* 이름 = 접기, ▶ = 이 코너 처음으로 점프(2026-09-17). 항목 수는 접혔을 때 무게를 알린다. */}
                    <button
                      aria-expanded={!folded.has(gi)}
                      className="vch-sec-name"
                      onClick={() => {
                        hapticTick();
                        setFolded((prev) => {
                          const next = new Set(prev);
                          if (next.has(gi)) next.delete(gi);
                          else next.add(gi);
                          return next;
                        });
                      }}
                      type="button"
                    >
                      <span aria-hidden="true" className="vch-caret">{folded.has(gi) ? "▸" : "▾"}</span>
                      {g.section}
                      <em className="vch-sec-n">{g.items.length}</em>
                    </button>
                    {onJump ? (
                      <button
                        aria-label={`${g.section} 처음부터`}
                        className="vch-sec-go"
                        data-act="vod-chapter-jump"
                        onClick={() => {
                          hapticTick();
                          jumpTo(g.items[0].idx);
                        }}
                        title="이 코너 처음부터"
                        type="button"
                      >
                        ▶
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {folded.has(gi) ? null : g.items.map((e) => (
                  <a
                    aria-current={activeIdx === e.idx ? "true" : undefined}
                    className={`vch-item${activeIdx === e.idx ? " is-active" : ""}${
                      activeIdx !== null && e.idx < activeIdx ? " is-past" : ""
                    }`}
                    data-act="vod-chapter-jump"
                    data-depth={e.depth > 0 ? e.depth : undefined}
                    data-idx={e.idx}
                    href={`https://vod.sooplive.co.kr/player/${titleNo}?change_second=${e.sec}`}
                    key={`${e.sec}-${e.idx}`}
                    onBlur={hideTip}
                    onFocus={(ev) => showTip(ev.currentTarget, e.label, e.idx)}
                    onMouseEnter={(ev) => showTip(ev.currentTarget, e.label, e.idx)}
                    onMouseLeave={hideTip}
                    onClick={(ev) => {
                      hapticTick();
                      if (onJump) {
                        ev.preventDefault();
                        followRef.current = false; // 클릭한 항목은 이미 보이는 자리 — 자동 스크롤 불필요
                        setActiveIdx(e.idx);
                        onJump(e.sec);
                      }
                    }}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <time className="vch-t">{hhmmss(e.sec)}</time>
                    <span className="vch-label">{e.label}</span>
                    {tip?.idx === e.idx ? (
                      <span className={`vch-tip${tip.above ? " is-above" : ""}`} role="tooltip">
                        {tip.text}
                      </span>
                    ) : null}
                  </a>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
      {stripHost && open && timeline && onJump && durationMs > 0
        ? createPortal(
            <VodStrip
              activeIdx={activeIdx}
              durationSec={durationMs / 1000}
              groups={groups}
              headRef={headRef}
              hhmmss={hhmmss}
              hoverLineRef={hoverLineRef}
              hoverTipRef={hoverTipRef}
              onPick={(idx, sec) => {
                hapticTick();
                followRef.current = true;
                setActiveIdx(idx < 0 ? null : idx);
                onJump(sec);
              }}
              stripRef={stripRef}
            />,
            stripHost
          )
        : null}
    </div>
  );
}

// 가로 타임라인 띠(2026-09-17 대개편 4번) — 전체 길이 위에 코너 구간(번갈아 옅은 톤, 현재 코너는 진하게)·항목 눈금·
// 재생 머리(금색). 호버 = 그 시각이 속한 항목 이름 + 시각, 클릭 = 정확히 그 시각으로 점프(유튜브 탐색줄 문법).
// 호버선·툴팁은 React 밖에서 style만 바꾼다(마우스 이동마다 레일 100항목을 다시 그리지 않게).
function VodStrip({
  groups,
  durationSec,
  activeIdx,
  headRef,
  hoverLineRef,
  hoverTipRef,
  stripRef,
  hhmmss,
  onPick
}: {
  groups: { section: string | null; items: { sec: number; label: string; idx: number; depth: number }[] }[];
  durationSec: number;
  activeIdx: number | null;
  headRef: RefObject<HTMLSpanElement | null>;
  hoverLineRef: RefObject<HTMLSpanElement | null>;
  hoverTipRef: RefObject<HTMLSpanElement | null>;
  stripRef: RefObject<HTMLDivElement | null>;
  hhmmss: (sec: number) => string;
  onPick: (idx: number, sec: number) => void;
}) {
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / durationSec) * 100))}%`;
  // 마우스 x → 초 → 그 시각 이하 마지막 항목.
  const locate = (clientX: number) => {
    const el = stripRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    const sec = Math.round(ratio * durationSec);
    let found = -1;
    for (let i = 0; i < all.length; i++) if (all[i].sec <= sec && (found < 0 || all[i].sec >= all[found].sec)) found = i;
    return { ratio, sec, item: found < 0 ? null : all[found], width: r.width };
  };
  const activeGi = activeIdx === null ? -1 : groups.findIndex((g) => g.items.some((it) => it.idx === activeIdx));
  return (
    <div
      aria-label="타임라인 탐색"
      className="vch-strip"
      onClick={(e) => {
        const at = locate(e.clientX);
        if (!at) return;
        onPick(at.item ? at.item.idx : -1, at.sec);
      }}
      onPointerLeave={() => {
        if (hoverLineRef.current) hoverLineRef.current.style.opacity = "0";
        if (hoverTipRef.current) hoverTipRef.current.style.opacity = "0";
      }}
      onPointerMove={(e) => {
        const at = locate(e.clientX);
        const line = hoverLineRef.current;
        const tip = hoverTipRef.current;
        if (!at || !line || !tip) return;
        line.style.left = `${at.ratio * 100}%`;
        line.style.opacity = "1";
        tip.textContent = at.item ? `${hhmmss(at.sec)} · ${at.item.label}` : hhmmss(at.sec);
        // 툴팁은 띠 밖으로 잘리지 않게 — 양 끝에서 안쪽으로 민다.
        const x = at.ratio * at.width;
        const half = Math.min(150, at.width / 2);
        tip.style.left = `${Math.max(half, Math.min(at.width - half, x))}px`;
        tip.style.opacity = "1";
      }}
      ref={stripRef}
      role="presentation"
    >
      {groups.map((g, gi) => {
        const start = g.items[0].sec;
        const end = gi + 1 < groups.length ? groups[gi + 1].items[0].sec : durationSec;
        return (
          <span
            className={`vch-seg${gi === activeGi ? " is-active" : ""}`}
            data-i={gi % 3}
            key={gi}
            style={{ left: pct(start), width: pct(Math.max(0, end - start)) }}
            title={g.section ?? undefined}
          />
        );
      })}
      {all.map((it) => (it.depth > 0 ? null : <i className="vch-tick" key={it.idx} style={{ left: pct(it.sec) }} />))}
      <span className="vch-head" ref={headRef} />
      <span className="vch-hover" ref={hoverLineRef} />
      <span className="vch-strip-tip" ref={hoverTipRef} />
    </div>
  );
}
