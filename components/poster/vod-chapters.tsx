"use client";

import { RhhSelect } from "@/components/studio/rhh-select";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronRight, Clock3, Heart, Laugh } from "lucide-react";
import { createPortal } from "react-dom";
import type { PublicVodChatProfile, PublicVodTimeline } from "@/lib/domain/schedule-types";
import { hapticTick } from "@/lib/ui/haptics";

// 다시보기 챕터(팬 타임라인, 0071) — PC 날짜 팝오버·모바일 아젠다 칩 아래 공용.
//
// 인지 설계(2026-08-31 사용자 논의):
//  · 팬이 적은 [코너] 헤더를 그룹 앵커로 살린다 — "게임 구간 어딘가"까지 텍스트 없이 좁혀진다.
//  · 항목마다 구간 길이(다음 항목까지)를 표기 — 라벨이 암시적이어도 코너의 무게가 보인다.
//  · 항목 탭 = 그 시각으로 숲 플레이어 점프(?change_second= — 실측 확정). 확인 비용을 낮추는 게
//    본질: 후보를 몇 개 찍어 3초씩 확인하는 흐름이 자연스럽게.
// 본문은 무거워서(최대 100+줄) 펼칠 때만 받아온다. 개수·작성자는 공개 번들이 이미 안다.
// 방송 내 초 → "h:mm:ss" / "m:ss". 챕터 레일·가로 띠·검색 결과가 같은 표기를 쓴다.
export function formatTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export type VodChaptersApi = {
  chapter: (dir: 1 | -1) => void; // 이전/다음 항목으로 점프
  group: (dir: 1 | -1) => void; // 이전/다음 코너 첫 항목으로 점프
  toggle: () => void; // 레일 접기/펼치기
};

// 점들을 지나는 부드러운 곡선(Catmull-Rom → 3차 베지에). 막대 그래프의 각진 느낌을 없애려고 쓴다(2026-09-18 소유자).
function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// 방송 시작 시각 + 경과 초 → 벽시계 시각(KST). **오전/오후 12시간제**로 낸다 — 24시간제 "17:40"은 경과 "10:34"(분:초)와
// 생김새가 같아 헷갈린다(2026-09-18 소유자 지적). "오후 5:40"이면 형태만으로 시각임이 읽힌다. 자정을 넘기면 "오전 1:07".
export function wallClock(startedAt: string | undefined, sec: number): string | null {
  if (!startedAt) return null;
  const base = Date.parse(startedAt);
  if (!Number.isFinite(base)) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(base + sec * 1000));
}

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
  startedAt,
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
  // 방송 시작 시각(ISO) — 있으면 타임라인 시각을 '경과 ↔ 실제 시각'으로 토글할 수 있다(2026-09-18 소유자).
  startedAt?: string;
  // 키보드 조종 API 등록(부모 창의 ↑/↓·[/]·C가 여기로 온다). 언마운트 때 null.
  register?: (api: VodChaptersApi | null) => void;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen) && chapters > 0);
  // 시각 표기: 경과(0:12:34) ↔ 실제 시각(19:32). 방송 시작 시각을 알 때만 토글이 뜬다. 선택은 기기에 기억.
  const [clockMode, setClockMode] = useState(false);
  useEffect(() => {
    try {
      setClockMode(window.localStorage.getItem("vic.vod.clock") === "1");
    } catch {
      /* 저장소 불가 — 기본 경과 */
    }
  }, []);
  const toggleClock = () => {
    hapticTick();
    setClockMode((v) => {
      try {
        window.localStorage.setItem("vic.vod.clock", v ? "0" : "1");
      } catch {
        /* 무시 */
      }
      return !v;
    });
  };
  const [bundle, setTimeline] = useState<PublicVodTimeline | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState("");
  const timeline = useMemo(() => {
    const variant = bundle?.variants?.find((v) => v.id === selectedTimeline);
    return variant ? { authorNick: variant.authorNick, entries: variant.entries } : bundle;
  }, [bundle, selectedTimeline]);
  const creditedAuthor = timeline?.authorNick ?? timelineBy;
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
  // idx ≥ 0 = 챕터 항목(.vch-label 측정), 음수 = 코너 헤더(-(gi+1), 버튼 자체 측정) — 둘 다 잘렸을 때만.
  const showTip = (el: HTMLElement, text: string, idx: number) => {
    const label = idx >= 0 ? el.querySelector<HTMLElement>(".vch-label") : el;
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
  const playedRef = useRef<HTMLSpanElement | null>(null); // 지나온 구간 채움(재생 머리와 같은 신호로 갱신)
  // '지금 장면' 줄의 시각(2026-09-18 소유자: "오후 8:47 배지도 재생하면서 같이 변해야") — 챕터 시작 시각이
  // 아니라 **재생 머리의 시각**이다. 초당 4회 오는 신호라 React 렌더 없이 textContent만 쓴다(머리·채움과 같은 길).
  const nowTimeRef = useRef<HTMLSpanElement | null>(null);
  const lastSecRef = useRef(0);
  const fmtNowRef = useRef<(sec: number) => string>(formatTimecode);
  fmtNowRef.current = (sec: number) =>
    (clockMode && startedAt ? wallClock(startedAt, sec) : null) ?? formatTimecode(sec);
  // 경과 ↔ 실제 시각을 토글하면 다음 신호를 기다리지 않고 바로 고쳐 쓴다(정지 중에도).
  useEffect(() => {
    if (nowTimeRef.current) nowTimeRef.current.textContent = fmtNowRef.current(lastSecRef.current);
  }, [clockMode, startedAt]);
  // 채팅 구간 프로필(0090) — 가로 띠가 있는 창에서만 받는다(모바일 아젠다는 띠 없음). 비율만 온다(숫자 없음).
  const [profile, setProfile] = useState<PublicVodChatProfile | null>(null);
  useEffect(() => {
    setProfile(null);
    if (!stripHost || durationMs <= 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;
    const refresh = async () => {
      if (!alive || document.visibilityState !== "visible") return;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/public/${slug}/vod-chat?titleNo=${titleNo}`, {
          cache: "no-cache", signal: controller.signal
        });
        if (!res.ok) return;
        const json = await res.json() as PublicVodChatProfile;
        if (alive && request === controller && Array.isArray(json.bins)) {
          setProfile(json.bins.length >= 4 ? json : null);
        }
      } catch { /* keep the last valid profile; retry late/failed analysis */ }
      finally {
        clearTimeout(timeout);
        if (alive && request === controller) {
          request = null;
          timer = setTimeout(() => void refresh(), 30_000);
        }
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      request?.abort(); request = null;
      void refresh();
    };
    document.addEventListener("visibilitychange", visibility);
    void refresh();
    return () => {
      alive = false; clearTimeout(timer); request?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [stripHost, durationMs, slug, titleNo]);

  // 재생 위치 → 현재 챕터. 시각이 현재보다 작거나 같은 항목 중 가장 늦은 것(정렬 가정 없이
  // 선형 — 항목 ≤100개, 초당 4회라 무시할 비용). idx가 바뀔 때만 setState → 레일만 다시 그림.
  const secs = useMemo(() => (timeline?.entries ?? []).map((e) => e.sec), [timeline]);
  useEffect(() => {
    // 챕터가 없는 방송도 구독한다 — 머리·채움·시각 배지는 타임라인 항목과 무관하다(옛 코드는 여기서 빠졌다).
    if (!subscribeTime) return;
    return subscribeTime((sec) => {
      const head = headRef.current;
      const pctPlayed = durationMs > 0 ? Math.min(100, Math.max(0, (sec / (durationMs / 1000)) * 100)) : 0;
      if (head && durationMs > 0) head.style.left = `${pctPlayed}%`;
      if (playedRef.current && durationMs > 0) playedRef.current.style.width = `${pctPlayed}%`;
      lastSecRef.current = sec;
      if (nowTimeRef.current) nowTimeRef.current.textContent = fmtNowRef.current(sec);
      if (secs.length === 0) return;
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

  const hasStrip = Boolean(stripHost && onJump && durationMs > 0 && (timeline || profile));
  if (chapters <= 0 && !hasStrip) return null;

  const toggle = () => {
    hapticTick();
    setOpen((v) => !v);
  };

  const hhmmss = formatTimecode;
  // (항목별 구간 길이 표기는 2026-09-01 사용자 결정으로 없음 — 길이는 가로 띠의 구간 폭이 대신 말한다.)

  // 지금 보고 있는 장면(2026-09-18) — 띠 위 한 줄로 '어느 코너의 무엇'을 계속 알려 준다(애플 '재생 중' 문법).
  const nowItem = activeIdx !== null ? (timeline?.entries ?? [])[activeIdx] : undefined;
  const nowSection = activeIdx !== null ? groups.find((g) => g.items.some((it) => it.idx === activeIdx))?.section : null;
  const strip = hasStrip
    ? createPortal(
        <>
          {/* '지금 장면' 줄 — 띠가 있으면 **항상** 있다(2026-09-18 소유자: 첫 타임라인 전에는 시각 배지가 아예 안 떴다).
              첫 항목 전에는 왼쪽을 비우고 시각만 둔다(빈 자리를 설명으로 채우지 않는다). */}
          <div className="vch-nowbar" data-empty={nowItem ? undefined : ""}>
            {nowItem ? (
              <>
                <span aria-hidden="true" className="vch-now-dot" />
                <span className="vch-now-main">
                  {nowSection ? <em className="vch-now-sec">{nowSection}</em> : null}
                  <b className="vch-now-label">{nowItem.label}</b>
                </span>
              </>
            ) : null}
            <span className="vch-now-time" ref={nowTimeRef}>
              {fmtNowRef.current(lastSecRef.current || nowItem?.sec || 0)}
            </span>
          </div>
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
            onJump!(sec);
          }}
          clockMode={clockMode && Boolean(startedAt)}
          playedRef={playedRef}
          profile={profile}
          stripRef={stripRef}
          wall={startedAt ? (sec: number) => wallClock(startedAt, sec) : undefined}
        />
        </>,
        stripHost!
      )
    : null;
  // 챕터 없는 방송 — 레일은 없고 띠(채팅 반응)만.
  if (chapters <= 0) return <div className="vod-chapters vch-strip-only">{strip}</div>;

  return (
    <div className="vod-chapters" data-clock={clockMode && startedAt ? "" : undefined} data-open={open ? "" : undefined}>
      {/* 머리줄(2026-09-18 대개편) — 제목 한 줄 + 알약 한 줄. 알약(감사·시각 토글·웃음 배지)은 모두 같은 높이·모서리·글자로
          한 언어를 쓴다(소유자: "배지들도 주변과 어울리게"). 줄바꿈으로 세 줄이 되던 옛 배치를 대체. */}
      <div className="vch-topbar">
        <button
          aria-expanded={open}
          className="vch-toggle"
          data-act="vod-chapters-open"
          onClick={toggle}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="vch-caret-ic" size={15} strokeWidth={2.6} />
          <span className="vch-toggle-main">
            타임라인 <b>{timeline?.entries.length ?? chapters}</b>
            {open && timeline && sectionCount > 0 ? (
              <>
                <i aria-hidden="true">·</i> 챕터 <b>{sectionCount}</b>
              </>
            ) : null}
          </span>
        </button>
        {open && (bundle?.variants?.length ?? 0) > 1 ? (
          <div className="vch-variants">
            <RhhSelect ariaLabel="타임라인 선택" dataAct="vod-timeline-select"
              value={selectedTimeline || bundle!.variants![0].id}
              options={bundle!.variants!.map((v, i) => ({ value: v.id, label: `${i === 0 ? "대표" : `다른 타임라인 ${i}`} · ${v.authorNick || "팬"} · ${v.entries.length}개` }))}
              onChange={(id) => {
                setSelectedTimeline(id);
                setFolded(new Set());
                setTip(null);
                const next = bundle?.variants?.find((v) => v.id === id);
                let idx: number | null = null;
                next?.entries.forEach((e, i) => { if (e.sec <= lastSecRef.current) idx = i; });
                setActiveIdx(idx);
              }} />
          </div>
        ) : null}
        {(creditedAuthor || (open && startedAt) || profile?.laughTier === "high") && open ? (
          <div className="vch-pills">
            {startedAt ? (
              <button
                aria-pressed={clockMode}
                className={`ui-pill is-tap${clockMode ? " is-on" : ""}`}
                data-act="vod-clock-toggle"
                onClick={toggleClock}
                title={clockMode ? "방송 시작부터의 경과 시간으로 보기" : "그 장면의 실제 시각(KST)으로 보기"}
                type="button"
              >
                <Clock3 aria-hidden="true" size={12} strokeWidth={2.4} />
                {clockMode ? "실제 시각" : "경과"}
              </button>
            ) : null}
            {profile?.laughTier === "high" ? (
              <span className="ui-pill is-gold" title="채팅에 웃음(ㅋㅋ)이 유난히 많았던 방송">
                <Laugh aria-hidden="true" size={12} strokeWidth={2.4} />
                많이 웃은 방송
              </span>
            ) : null}
            {creditedAuthor ? (
              <span className="ui-pill is-quiet" title={`팬 타임라인을 적어 주신 ${creditedAuthor}님`}>
                <Heart aria-hidden="true" size={11} strokeWidth={2.6} />
                {creditedAuthor}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
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
                      onBlur={hideTip}
                      onFocus={(ev) => showTip(ev.currentTarget, g.section ?? "", -(gi + 1))}
                      onMouseEnter={(ev) => showTip(ev.currentTarget, g.section ?? "", -(gi + 1))}
                      onMouseLeave={hideTip}
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
                    {tip?.idx === -(gi + 1) ? (
                      <span className={`vch-tip${tip.above ? " is-above" : ""}`} role="tooltip">
                        {tip.text}
                      </span>
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
                    <time className="vch-t" title={clockMode ? `경과 ${hhmmss(e.sec)}` : (wallClock(startedAt, e.sec) ?? undefined)}>
                      {(clockMode && wallClock(startedAt, e.sec)) || hhmmss(e.sec)}
                    </time>
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
      {strip}
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
  onPick,
  profile,
  wall,
  clockMode,
  playedRef
}: {
  groups: { section: string | null; items: { sec: number; label: string; idx: number; depth: number }[] }[];
  profile: PublicVodChatProfile | null;
  wall?: (sec: number) => string | null; // 경과 초 → 실제 시각(KST), 모르면 undefined
  clockMode?: boolean; // 눈금 라벨을 실제 시각으로
  playedRef?: RefObject<HTMLSpanElement | null>;
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
  // 채팅 반응(0090) — 구간 비율을 부드러운 산 모양(면)으로, 발화 밀도는 가는 선으로. 봉우리엔 상위 단어 알약.
  // 좌표는 0~1000 × 0~100 viewBox(preserveAspectRatio none) — 폭이 바뀌어도 다시 계산 없음. 숫자는 어디에도 안 찍는다.
  // 시간 눈금(2026-09-18 대개편): 길이에 맞춰 1·2·3시간 간격. 라벨은 실제 시각 모드면 "오후 6시", 아니면 "1시간".
  const ruler = useMemo(() => {
    if (durationSec <= 0) return [];
    const hours = durationSec / 3600;
    const stepH = hours > 10 ? 3 : hours > 5 ? 2 : hours > 2 ? 1 : 0.5;
    const out: { sec: number; label: string }[] = [];
    for (let t = stepH * 3600; t < durationSec - 120; t += stepH * 3600) {
      const w = clockMode && wall ? wall(t) : null;
      out.push({ sec: t, label: w ? w.replace(/:00$/, "시").replace(/^(오전|오후) /, "") : `${Math.round(t / 3600)}시간` });
    }
    return out;
  }, [durationSec, clockMode, wall]);

  const heat = useMemo(() => {
    if (!profile || durationSec <= 0) return null;
    const binSec = profile.binSec;
    const n = Math.max(1, Math.ceil(durationSec / binSec));
    const h = new Array<number>(n).fill(0);
    const d = new Array<number>(n).fill(0);
    const l = new Array<number>(n).fill(0);
    const t = new Array<string[]>(n).fill([]);
    for (const b of profile.bins) {
      if (b.i < n) {
        h[b.i] = b.h;
        d[b.i] = b.d;
        l[b.i] = b.l;
        t[b.i] = b.t;
      }
    }
    // 3점 이동평균으로 들쭉날쭉을 죽인다(면은 눈으로 '흐름'을 읽는 용도).
    const sm = (a: number[]) => a.map((_, i) => (a[Math.max(0, i - 1)] + a[i] + a[Math.min(n - 1, i + 1)]) / 3);
    const hs = sm(h);
    const ds = sm(d);
    const x = (i: number) => ((i + 0.5) / n) * 1000;
    const area = `M 0 100 ${hs.map((v, i) => `L ${x(i).toFixed(1)} ${(100 - v * 92).toFixed(1)}`).join(" ")} L 1000 100 Z`;
    const line = ds.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${(100 - v * 80).toFixed(1)}`).join(" ");
    // 반응 리본(2026-09-18 2차, 소유자 "부드럽게"): 막대를 버리고 가운데선 기준 **대칭 곡선**으로 그린다
    // (애플 미디어 스크러버·유튜브 '많이 본 구간'의 결). 90개 안팎으로 묶고 한 번 더 평활화해 각을 없앤다.
    const SAMP = Math.max(16, Math.min(90, n));
    const per = n / SAMP;
    const samp: number[] = [];
    for (let bi = 0; bi < SAMP; bi += 1) {
      const from = Math.floor(bi * per);
      const to = Math.max(from + 1, Math.floor((bi + 1) * per));
      let mh = 0;
      for (let i = from; i < to && i < n; i += 1) mh = Math.max(mh, hs[i]);
      samp.push(mh);
    }
    const smooth2 = samp.map((_, i) => {
      const a = samp[Math.max(0, i - 1)];
      const b2 = samp[i];
      const c = samp[Math.min(samp.length - 1, i + 1)];
      return (a + b2 * 2 + c) / 4;
    });
    const xAt = (i: number) => (i / Math.max(1, SAMP - 1)) * 1000;
    // 감마(1.6)로 대비를 준다 — 평평한 관처럼 보이지 않고 봉우리가 도드라진다.
    const peakV = Math.max(0.15, ...smooth2); // 그 방송 안에서의 상대 대비(조용한 방송도 봉우리가 보이게)
    const thick = (v: number) => 0.04 + Math.pow(Math.max(0, Math.min(1, v / peakV)), 1.9) * 0.96;
    const top = smooth2.map((v, i) => ({ x: xAt(i), y: 50 - thick(v) * 46 }));
    const bottom = [...smooth2].map((v, i) => ({ x: xAt(i), y: 50 + thick(v) * 46 })).reverse();
    const ribbon = `${smoothLine(top)} L ${bottom[0].x.toFixed(1)} ${bottom[0].y.toFixed(1)} ${smoothLine(bottom).slice(1)} Z`;
    const crest = smoothLine(top);
    // 봉우리: 원본 값 기준 국소 최대(±3구간)이면서 0.55 이상, 봉우리끼리 최소 8% 간격, 최대 5개. 단어 있는 구간 우선.
    const cand = h
      .map((v, i) => ({ i, v }))
      .filter(({ i, v }) => v >= 0.55 && h.slice(Math.max(0, i - 3), i + 4).every((o) => o <= v))
      .sort((a, b) => b.v - a.v || (t[b.i].length ? 1 : 0) - (t[a.i].length ? 1 : 0));
    const peaks: { i: number; v: number; terms: string[]; sec: number }[] = [];
    for (const c of cand) {
      if (peaks.length >= 5) break;
      if (peaks.some((p) => Math.abs(p.i - c.i) / n < 0.08)) continue;
      peaks.push({ i: c.i, v: c.v, terms: t[c.i], sec: c.i * binSec });
    }
    return { n, binSec, h, d, l, t, area, line, peaks, ribbon, crest };
  }, [profile, durationSec]);
  // 마우스 x → 초 → 그 시각 이하 마지막 항목.
  const locate = (clientX: number) => {
    const el = stripRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    const sec = Math.round(ratio * durationSec);
    let found = -1;
    for (let i = 0; i < all.length; i++) if (all[i].sec <= sec && (found < 0 || all[i].sec >= all[found].sec)) found = i;
    // 채팅 구간 정보(숫자 없이): 반응이 높으면 "반응 ↑", 웃음이 높으면 "웃음", 상위 단어.
    let chat = "";
    if (heat) {
      const bi = Math.min(heat.n - 1, Math.floor(sec / heat.binSec));
      const parts: string[] = [];
      if (heat.h[bi] >= 0.6) parts.push("반응 ↑");
      if (heat.l[bi] >= 0.6) parts.push("웃음 ㅋㅋ");
      if (heat.t[bi].length) parts.push(heat.t[bi].join(" · "));
      chat = parts.join(" · ");
    }
    return { ratio, sec, item: found < 0 ? null : all[found], width: r.width, chat };
  };
  const activeGi = activeIdx === null ? -1 : groups.findIndex((g) => g.items.some((it) => it.idx === activeIdx));
  return (
    <div
      aria-label="타임라인 탐색"
      className={`vch-strip${heat ? " has-chat" : ""}`}
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
        const clock = wall ? wall(at.sec) : null;
        tip.textContent = `${at.item ? `${hhmmss(at.sec)} · ${at.item.label}` : hhmmss(at.sec)}${clock ? ` · ${clock}` : ""}${at.chat ? `\n${at.chat}` : ""}`;
        // 툴팁은 띠 밖으로 잘리지 않게 — 양 끝에서 안쪽으로 민다.
        const x = at.ratio * at.width;
        const half = Math.min(150, at.width / 2);
        tip.style.left = `${Math.max(half, Math.min(at.width - half, x))}px`;
        tip.style.opacity = "1";
      }}
      ref={stripRef}
      role="presentation"
    >
      {/* ① 시간 눈금 — 긴 방송에서 '지금 몇 시쯤'을 바로. 실제 시각 모드면 벽시계로 읽힌다. */}
      {ruler.length > 0 ? (
        <span aria-hidden="true" className="vch-ruler">
          {ruler.map((r) => (
            <i className="vch-ruler-tick" key={r.sec} style={{ left: pct(r.sec) }}>
              <em>{r.label}</em>
            </i>
          ))}
        </span>
      ) : null}

      {/* ② 코너 캡슐 — 사이를 띄운 알약으로 끊어 '어디서 어디까지가 한 코너'가 보인다(유튜브 챕터 문법). */}
      <span aria-hidden="true" className="vch-caps">
        {groups.map((g, gi) => {
          const start = g.items[0].sec;
          const end = gi + 1 < groups.length ? groups[gi + 1].items[0].sec : durationSec;
          return (
            <i
              className={`vch-cap${gi === activeGi ? " is-active" : ""}`}
              data-i={gi % 3}
              key={gi}
              style={{ left: pct(start), width: pct(Math.max(0, end - start)) }}
            />
          );
        })}
      </span>

      {/* ③ 반응 리본 — 가운데선 기준 대칭 곡선(두께 = 채팅 반응). 채팅이 없는 방송은 잔잔한 실선만. */}
      <span className="vch-wave">
        {heat ? (
          <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 1000 100">
            <defs>
              <linearGradient id="vchRibbon" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#7aa2ff" />
                <stop offset="55%" stopColor="#8f8cf5" />
                <stop offset="100%" stopColor="#c59bf0" />
              </linearGradient>
              <filter height="200%" id="vchGlow" width="130%" x="-15%" y="-50%">
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>
            <path className="vch-ribbon-glow" d={heat.ribbon} filter="url(#vchGlow)" />
            <path className="vch-ribbon" d={heat.ribbon} />
            <path className="vch-crest" d={heat.crest} />
          </svg>
        ) : null}
        <i aria-hidden="true" className="vch-base" />
      </span>

      {/* ④ 지나온 구간 — 재생 머리 왼쪽이 따뜻하게 채워진다. */}
      <span aria-hidden="true" className="vch-played" ref={playedRef} />

      {/* ⑤ 반응 봉우리 표식 (항목 눈금은 2026-09-18에 뺐다 — 98개면 울타리처럼 보여 리본을 가렸다) */}
      {heat && heat.peaks.length > 0
        ? heat.peaks.map((p) => (
            <button
              aria-label={`${hhmmss(p.sec)} 반응이 몰린 구간`}
              className="vch-spark"
              data-act="vod-strip-peak"
              key={p.i}
              onClick={(e) => {
                e.stopPropagation();
                hapticTick();
                onPick(-1, p.sec);
              }}
              style={{ left: pct(p.sec + heat.binSec / 2) }}
              title={`${hhmmss(p.sec)} · 반응이 몰린 구간${p.terms.length ? ` · ${p.terms.join(" · ")}` : ""}`}
              type="button"
            />
          ))
        : null}

      <span className="vch-head" ref={headRef} />
      <span className="vch-hover" ref={hoverLineRef} />
      <span className="vch-strip-tip" ref={hoverTipRef} />
    </div>
  );
}
