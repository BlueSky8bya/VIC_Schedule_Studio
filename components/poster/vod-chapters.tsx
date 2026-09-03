"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
export function VodChapters({
  slug,
  titleNo,
  durationMs,
  chapters,
  timelineBy,
  onJump,
  defaultOpen,
  subscribeTime
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

  // 재생 위치 → 현재 챕터. 시각이 현재보다 작거나 같은 항목 중 가장 늦은 것(정렬 가정 없이
  // 선형 — 항목 ≤100개, 초당 4회라 무시할 비용). idx가 바뀔 때만 setState → 레일만 다시 그림.
  const secs = useMemo(() => (timeline?.entries ?? []).map((e) => e.sec), [timeline]);
  useEffect(() => {
    if (!subscribeTime || !open || secs.length === 0) return;
    return subscribeTime((sec) => {
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
  }, [subscribeTime, open, secs]);
  // 재생 추적으로 현재 챕터가 바뀌면 레일이 따라간다 — 마우스가 레일 위면 멈춤(사용자 스크롤과
  // 싸우지 않게). nearest + 스크롤러의 scroll-padding으로 sticky 코너 헤더 밑에 숨지 않는다.
  useEffect(() => {
    if (activeIdx === null || !followRef.current) return;
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

  // 코너(section) 단위 그룹 — 날짜 창에선 이 그룹이 2열 신문식 배치의 단위가 된다
  // (헤더와 항목이 열 경계에서 찢어지지 않게). 코너 없는 옛 타임라인은 한 덩어리.
  const groups = useMemo(() => {
    const list = timeline?.entries ?? [];
    const raw: { section: string | null; items: { sec: number; label: string; idx: number }[] }[] = [];
    list.forEach((e, idx) => {
      const last = raw[raw.length - 1];
      if (last && last.section === e.section) last.items.push({ sec: e.sec, label: e.label, idx });
      else raw.push({ section: e.section, items: [{ sec: e.sec, label: e.label, idx }] });
    });
    // 그룹이 열 배치 단위(break-inside: avoid)라, 거대한 그룹(코너 없는 옛 타임라인)이 통짜면
    // 2열이 1열로 퇴화한다 — 8개 단위로 분절(헤더는 첫 조각만, 이후 조각은 이어지는 무헤더).
    const out: typeof raw = [];
    for (const g of raw) {
      for (let i = 0; i < g.items.length; i += 8) {
        out.push({ section: i === 0 ? g.section : null, items: g.items.slice(i, i + 8) });
      }
    }
    return out;
  }, [timeline]);

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
  void durationMs; // (구간 길이 표기는 2026-09-01 사용자 결정으로 제거 — 시각·라벨만 남긴다)

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
        챕터 {chapters}개
        {timelineBy ? <em className="vch-by">타임라인 ({timelineBy}님 감사합니다)</em> : null}
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
              <section className="vch-group" key={gi}>
                {g.section ? <div className="vch-sec">{g.section}</div> : null}
                {g.items.map((e) => (
                  <a
                    aria-current={activeIdx === e.idx ? "true" : undefined}
                    className={`vch-item${activeIdx === e.idx ? " is-active" : ""}${
                      activeIdx !== null && e.idx < activeIdx ? " is-past" : ""
                    }`}
                    data-act="vod-chapter-jump"
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
    </div>
  );
}
