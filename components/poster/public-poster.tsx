"use client";

import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  LogIn,
  LogOut,
  Play,
  X
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import dynamic from "next/dynamic";
import { logActivity } from "@/lib/activity/client";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만 존중
// '이 달 기록' 시트 — 열 때만 로드(시청자 첫 페인트 번들에서 제외).
const PublicInsights = dynamic(
  () => import("@/components/poster/public-insights").then((m) => m.PublicInsights),
  { ssr: false }
);
import {
  type PublicSchedule,
  type PublicScheduleEvent
} from "@/lib/domain/schedule-types";
import { getAnonHeartIdsAction, type HeartResult } from "@/lib/schedules/heart-actions";
import { revealTeaserAction } from "@/lib/schedules/teaser-actions";
import { reconcileTeaserReveal } from "@/lib/schedules/teaser-reconcile";
import { getTeaserHopeIdsAction, toggleTeaserHopeAction } from "@/lib/schedules/hope-actions";
import {
  HYPE_EMERGE_S,
  HYPE_WINDOW_S,
  STATIC_MOTION_FRAME,
  hypeEmerge,
  hypeFinale,
  hypeChannels,
  hypeCalm,
  hypeCssVars,
  hypeIntensity,
  hypeMotionCssVars,
  hypeMotionFrame,
  quantizeStaticIntensity
} from "@/lib/ui/hype-curve";
import { heartTier, type HeartTier } from "@/lib/schedules/heart-tiers";
import { debutDPlus, getDayMark } from "@/lib/calendar/holidays";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { useEqualChainHeights } from "@/lib/calendar/use-equal-chain-heights";
import {
  assignSupportLanes,
  buildCalendarMonth,
  buildChainKeys,
  buildPaintGroups,
  classifyDay,
  eventColorStyle,
  getAdjacentMonth,
  getEventDateKey,
  getEventsForDate,
  eventMatchesTagFilter,
  getEventSpan,
  getSpanRunRange,
  getTodayKst,
  mixedEventStyle,
  splitEventTitle,
  type MonthCell
} from "@/lib/calendar/month";
import { isTaxonomyV3, legacyTagView } from "@/lib/tags/taxonomy";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { markContentReady } from "@/lib/presence/content-ready";
import { detectInAppBrowser } from "@/lib/auth/in-app-browser";
import { PlainEmail } from "@/components/ui/plain-email";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { hapticSuccess, hapticTick, hapticWarn } from "@/lib/ui/haptics";
import { useSheetDragClose } from "@/lib/ui/use-sheet-drag-close";
import { captureFlip, playFlip } from "@/lib/ui/list-flip";
import { popInnerOverlay, pushInnerOverlay } from "@/lib/ui/overlay-pop";
import { writeLoadingToneCookie, writeViewCookie } from "@/lib/ui/view-cookie";
import { SoopLiveBeacon } from "@/components/poster/soop-live-beacon";
import { useSoopLive } from "@/components/poster/use-soop-live";
import { VodChapters } from "@/components/poster/vod-chapters";
import { createWheelStepper, normalizeWheelDelta, stepCalZoom } from "@/lib/ui/calendar-zoom";
// 포스터 CSS는 이 컴포넌트와 함께 로드(루트 레이아웃 전역 import 제거에 대응). PublicPoster가 쓰이는
// 곳(공개 /, 꾸미기, 스튜디오 시청자 미리보기)에서만 실린다.
import "./public-poster.css";

// (일정표 캡쳐(클립보드/PNG 다운로드) 기능 삭제 — 2026-07-31 사용자 결정: 토리님이 안 씀.
//  PosterExportActions 컴포넌트·html2canvas 경로 제거. 필요해지면 git 이력에 구현이 있다.)

type PublicPosterProps = {
  schedule: PublicSchedule;
  initialYear?: number;
  initialMonth?: number;
  // 월을 바꿀 때 부모(편집실)에 알린다 — 시청자 미리보기에서 본 달을 편집실로 돌아갈 때 잇기 위함.
  onViewChange?: (year: number, month: number) => void;
  // (canExport 삭제 — 일정표 캡쳐 기능 제거, 2026-07-31. decorate·스티커 액션 props 삭제 — 꾸미기 기능 제거, 2026-08-27.)
  // 서버 UA 판정 휴대폰 여부 — 모바일 아젠다를 처음부터 그려 깜빡임을 없앤다(클라가 보정).
  initialNarrow?: boolean;
  // A: 일정 관심(하트) 토글. 주어지면 서버 집계 연동, 없으면 기기별 localStorage로만 동작.
  toggleHeartAction?: (eventId: string, token?: string) => Promise<HeartResult>;
  // 시청자 화면에서 계정 변경(로그아웃) 버튼을 보일지. 실제 시청자 페이지에서만 true.
  accountSwitch?: boolean;
  // 공개 후 "🔮 n명이 기다렸어요" 배지 노출 — 당분간 개발자 확인용으로만(사용자 결정:
  // 카운팅은 계속 쌓되 관리자·시청자에겐 아직 안 보여준다). 기대돼요 버튼/카운트는 공통.
  showHopeBadge?: boolean;
  // 현재 로그인한 구글 이메일 — "계정변경" 옆에 표시해 어떤 계정으로 들어와 있는지 보여준다.
  accountEmail?: string | null;
  // 비로그인(익명) 시청자 — 공개 포스터만 본다. 하트(서버 1인1하트)는 숨기고, 계정 칸은
  // "계정변경"(로그아웃) 대신 Google 로그인 버튼으로 바꾼다.
  anonymous?: boolean;
  // 시청자 미리보기(편집실 진입)일 때 제목 헤더(.agenda-header) 안에 띄우는 안내·이동 버튼.
  // 왼쪽 여백 칸에 안내, 오른쪽 칸에 이동 버튼 → 제목과 같은 자리에서 함께 sticky로 따라온다.
  previewNote?: ReactNode;
  previewNav?: ReactNode;
  // 관리자(owner) 전용: 달력 왼쪽 ~1/3을 버츄얼 스트리머 아바타용 빈 공간으로 비워둔다.
  // export 표면(data-export-surface) 바깥이라 PNG 캡처엔 안 들어가고, 화면 송출 시 그 자리에
  // 아바타를 올리는 용도. 시청자/익명에겐 절대 안 보인다(owner일 때만 true로 넘긴다).
  avatarSlot?: boolean;
  // 편집실에서 아바타 상태를 controlled로 공유(편집실↔미리보기 동기화). 주어지면 내부 상태 대신 사용.
  avatarOn?: boolean;
  avatarSide?: "left" | "right";
  onAvatarToggle?: () => void;
  onAvatarSide?: (side: "left" | "right") => void;
  // 뱅송 미리보기(/onair) 전용: 아바타 scene을 지정한 쪽으로 '항상 켜짐'에 고정하고 관리자 토글은
  // 그리지 않는다(OBS 브라우저 소스는 로그인이 없으므로 URL만으로 scene이 나와야 한다). 공개 데이터만
  // 그리는 레이아웃 옵션 — 권한과 무관, 비공개 데이터는 애초에 이 컴포넌트에 없다.
  avatarFixed?: "left" | "right";
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 업도움/기간 안내 띠의 레인 세로 스텝(px) — 띠 높이 17(globals.css .support-bar) + 틈 1.
// 띠 top과 일정 목록 paddingTop이 함께 쓴다(어긋나면 카드가 띠를 덮는다).
const SUPPORT_LANE_STEP = 18;

// 관심 단계 표식(2026-08-27) — 카드 '테두리'에 얹는 링(+1위는 👑 모서리 배지). 예전 불꽃 알약은
// 카드 바닥에 한 줄(≈18px)을 먹어 행마다 쌓이면 달력 비율을 무너뜨렸다(사용자 지적). 링·배지는
// absolute라 높이 0 — 내용은 그대로. 단계 라벨은 role=img aria-label·title로 남긴다.
function TierMark({ tier }: { tier: HeartTier }) {
  return (
    <>
      {/* halo는 링과 형제(링의 마스크가 자기 그림자를 잘라서). 관심(warm)은 halo 없음 — 조용한 단계. */}
      {tier.key !== "warm" ? <span aria-hidden="true" className={`tier-halo tier-${tier.key}`} /> : null}
      <span
        aria-label={`관심 단계: ${tier.label}`}
        className={`tier-ring tier-${tier.key}`}
        role="img"
        title={tier.label}
      />
      {tier.key === "top" ? (
        <span aria-hidden="true" className="tier-crown">
          👑
        </span>
      ) : null}
    </>
  );
}

// 포스터 고정 캔버스 설계 크기(16:9). 화면에선 이 크기를 통째로 축소해 보여주고,
// export는 이 원본 크기로 캡쳐한다. 작은 화면에서도 내부 비율·스티커 위치가 절대 안 바뀐다.
// PC 상세 팝오버 리더 선의 카드 쪽 끝점 — '팝오버 중심 → 앵커' 방향 선이 팝오버 테두리를
// 뚫는 지점. 앵커가 움직이면 끝점이 테두리를 따라 '연속으로' 미끄러진다(변 전환에서 툭
// 튀지 않음 — 사용자 요청). 정면(위/아래/좌/우)일 땐 자연히 그 변의 정중앙에 온다.
// 앵커가 카드에 덮이면 앵커 그대로(=선 생략 판정).
function detailEdgePoint(
  pos: { left: number; top: number },
  size: { w: number; h: number },
  anchor: { x: number; y: number }
) {
  const cx = pos.left + size.w / 2;
  const cy = pos.top + size.h / 2;
  const dx = anchor.x - cx;
  const dy = anchor.y - cy;
  const hw = size.w / 2;
  const hh = size.h / 2;
  if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return { x: anchor.x, y: anchor.y }; // 덮임
  const t = Math.min(
    dx !== 0 ? hw / Math.abs(dx) : Infinity,
    dy !== 0 ? hh / Math.abs(dy) : Infinity
  );
  return { x: Math.round(cx + dx * t), y: Math.round(cy + dy * t) };
}
// 토스트 한 줄에 들어가게 제목을 줄인다(긴 제목이 화면을 가로지르지 않게).
// 숲 임베드 iframe API의 Pload 명령 — PonReady를 받은 플레이어에게 재생 설정을 통째로 넘긴다.
// autoPlay:false = 초기화만(지정 포스터+▶ 대기 — 실측: 이 상태의 ▶ 클릭은 엄격 차단 브라우저에서도
// 소리 켠 재생). autoPlay:true + mutePlay:false = 음소거로 시동 걸고 스스로 소리를 켜는 공식 경로.
// (채팅·추천·광고성 부가 UI는 전부 끔 — 미리보기 띠는 영상만.)
function buildDayVodPload(titleNo: number, sec: number, autoPlay: boolean): Record<string, unknown> {
  return {
    cmd: "Pload",
    id: titleNo,
    autoPlay,
    mutePlay: false,
    showChat: false,
    isViewCnt: true,
    isRecommendShow: false,
    isEndRecommendShow: false,
    startVideoSeconds: sec,
    endVideoSeconds: 0
  };
}

function trimTitle(title: string, max = 14) {
  const line = title.split("\n")[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
const POSTER_DESIGN_W = 1840;
const POSTER_DESIGN_H = Math.round((POSTER_DESIGN_W * 9) / 16); // 1035 (16:9)

// 관심 단계 순위(높을수록 인기). 한 칸의 "대표 인기 단계"를 고를 때 쓴다.
const POP_RANK: Record<string, number> = { warm: 1, hot: 2, blaze: 3, top: 4 };

// (P2-KST-1: nowKstHm은 lib/calendar/month.ts 단일 출처에서 import — 편집실과 동일 모양.)


// (구) 전역·영구 북마크 키 — 서버 진실을 통째로 덮어써 DB와 desync(채워졌는데 DB엔 없음 →
// 다시 눌러도 토글 OFF만 돼 카운트가 안 늘던 버그)를 냈다. 이제 쓰지 않고, 마운트 때 청소한다.
const LEGACY_BOOKMARK_KEY = "vic:bookmarks:v1";
// 비로그인 하트용 기기 식별자 — localStorage에 1번 만들어 두고 재사용(기기당 1하트 dedup 키).
// 신뢰 못 하는 값(시크릿창마다 새로 생김)이지만 '관심 신호'엔 충분. 로그인 시엔 안 쓴다(계정 기준).
const ANON_ID_KEY = "vic:anonId:v1";
function getOrCreateDeviceToken(): string {
  try {
    let t = window.localStorage.getItem(ANON_ID_KEY);
    if (!t || t.length < 8) {
      t =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_ID_KEY, t);
    }
    return t;
  } catch {
    return ""; // 사생활 모드 등 — 익명 하트만 비활성(로그인 하트엔 영향 없음).
  }
}
// 하트의 진실은 항상 서버(myHeartIds). 아래 델타는 '이번 브라우저 세션에 사용자가 직접 토글한
// 일정'만 담아(sessionStorage, 탭 닫으면 소멸) 시청자 미리보기 재마운트 동안 변경을 보존한다.
// 매 로드 신선한 서버값에 이 델타(on/off)를 덮어 적용하므로, 손대지 않은 일정에 가짜 하트가
// 생기지 않는다(자가 보정). 페이지 새로고침 후엔 서버값이 이미 최신이라 델타는 무해한 멱등 합집합.
const HEART_DELTA_KEY = "vic:heartDelta:v1";
// 델타는 '누가' 만든 건지 owner(계정 이메일, 비로그인은 "anon")를 함께 박는다. 같은 브라우저(같은 탭,
// sessionStorage 공유)에서 계정을 바꾸면 이전 계정의 낙관적 하트가 다음 계정 화면에 가짜로 비치던
// 버그가 있었다 — owner가 다르면 델타를 통째로 버려(빈 델타) 계정 간 누수를 막는다.
type HeartDelta = { owner: string; on: string[]; off: string[] };
function loadHeartDelta(owner: string): HeartDelta {
  try {
    const raw = window.sessionStorage.getItem(HEART_DELTA_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<HeartDelta>;
      // 다른 계정(또는 owner 없는 옛 형식)의 델타는 내 것이 아니므로 무시한다.
      if (p && p.owner === owner && Array.isArray(p.on) && Array.isArray(p.off)) {
        return {
          owner,
          on: p.on.filter((x) => typeof x === "string"),
          off: p.off.filter((x) => typeof x === "string")
        };
      }
    }
  } catch {
    // 손상·사생활 모드 등은 무시 — 델타는 보조 기능.
  }
  return { owner, on: [], off: [] };
}
function saveHeartDelta(d: HeartDelta) {
  try {
    window.sessionStorage.setItem(HEART_DELTA_KEY, JSON.stringify(d));
  } catch {
    // 저장 실패 무시.
  }
}
// 사용자가 한 일정을 토글했음을 델타에 기록한다(on=켬, off=끔). 반대편 목록에선 제거.
function recordHeartDelta(owner: string, id: string, on: boolean) {
  const d = loadHeartDelta(owner);
  if (on) {
    d.on = [...new Set([...d.on, id])];
    d.off = d.off.filter((x) => x !== id);
  } else {
    d.off = [...new Set([...d.off, id])];
    d.on = d.on.filter((x) => x !== id);
  }
  saveHeartDelta(d);
}

// #3: 관심 하트 단계(불꽃 게이지) — 임계값·판정은 lib/schedules/heart-tiers의 단일 출처를 쓴다
// (개발자 인사이트의 '배지 기준' 설명과 드리프트 없이 일치시키려고 분리).

// 떡밥 카드의 "공개까지" 카운트다운. 매초 갱신, 0이 되면 onReveal()로 서버 데이터를 새로 받아
// 가려진 제목이 드러나게 한다. SSR/CSR 시간차 hydration 경고를 피하려 마운트 전엔 ⏳만 보인다.
function TeaserCountdown({
  revealAt,
  onReveal,
  onWatch,
  motionEnabled = true
}: {
  revealAt: string;
  onReveal: () => void;
  // 마운트 즉시 '이 화면이 이 떡밥을 라이브로 지켜보고 있다'고 알린다. 0초에 알리면 늦다 —
  // 그 순간 부모가 리렌더되면 이 컴포넌트가 먼저 언마운트돼 effect가 아예 안 돌고,
  // 축하 연출이 통째로 사라진다(사용자 지적: 0초에 애니메이션이 안 나온다).
  onWatch?: () => void;
  // 꾸미기(스티커 편집) 중에는 하이프 연출을 돌리지 않는다 — 편집실은 편집에 도움되는
  // 것만 한다. 숫자는 그대로 흐르되 10Hz 시각 루프와 박동은 아예 시작하지 않는다.
  motionEnabled?: boolean;
}) {
  const target = useMemo(() => Date.parse(revealAt), [revealAt]);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;
  const onWatchRef = useRef(onWatch);
  onWatchRef.current = onWatch;
  useEffect(() => {
    onWatchRef.current?.();
  }, []);
  // 팝오버와 같은 공용 시계 — 초 경계에 맞춰 함께 넘어간다(각자 interval을 돌리면 어긋난다).
  const s0 = useRemainSeconds(Number.isNaN(target) ? null : target);
  // 시각 채널은 10Hz로 '요소에 직접' 기록한다 — 리렌더는 1Hz(숫자)만. 하이프 창(60초) 밖이거나
  // 동작 줄이기면 루프를 아예 돌리지 않는다(배터리·CPU).
  const hostRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (Number.isNaN(target) || !motionEnabled) return;
    // 동작 줄이기(앱 토글이 최종 권한): 모션은 CSS가 끄고, 값은 3단계로 양자화해 1Hz만 쓴다
    // → 임박 상태는 보이되 캡처 시각에 따라 픽셀이 흔들리지 않는다(export 결정성).
    const staticOnly =
      typeof document !== "undefined" &&
      document.documentElement.hasAttribute("data-reduce-motion");
    let raf = 0;
    const write = () => {
      const el = hostRef.current;
      if (!el) return;
      const card = el.closest<HTMLElement>(".public-event, .agenda-item");
      const remainMs = target - Date.now();
      const raw = hypeIntensity(remainMs);
      const i = staticOnly ? quantizeStaticIntensity(raw) : raw;
      // 폭풍의 눈 — 정적 모드에선 0/1로 양자화해 캡처가 결정적이게 한다.
      const rawCalm = hypeCalm(remainMs);
      const calm = staticOnly ? (rawCalm > 0.5 ? 1 : 0) : rawCalm;
      // 등장 — 하이프 창(60초) 바깥에서도 써야 하므로 강도와 별개로 계산한다.
      const rawEmerge = hypeEmerge(remainMs);
      const rawFinale = hypeFinale(remainMs);
      const emerge = staticOnly ? (rawEmerge > 0.5 ? 1 : 0) : rawEmerge;
      const finale = staticOnly ? quantizeStaticIntensity(rawFinale) : rawFinale;
      const vars = {
        ...hypeCssVars(hypeChannels(i, calm)),
        // 박동 위상 — 정지 모드에선 진폭 0 프레임이라 파형이 곱해져도 안 움직인다.
        ...hypeMotionCssVars(staticOnly ? STATIC_MOTION_FRAME : hypeMotionFrame(remainMs, i)),
        "--hy-emerge": emerge.toFixed(3),
        "--hy-final": finale.toFixed(3)
      };
      for (const [k, v] of Object.entries(vars)) {
        el.style.setProperty(k, v);
        card?.style.setProperty(k, v);
      }
      card?.classList.toggle("hype-live", raw > 0);
    };
    const tick = () => {
      if (document.hidden) return; // 안 보이는 탭에선 쉰다
      if (staticOnly) {
        write();
        return;
      }
      raf = window.requestAnimationFrame(write);
    };
    tick();
    // 10Hz 커밋(60fps rAF의 1/6 비용). 동작 줄이기면 1Hz면 충분.
    const id = window.setInterval(tick, staticOnly ? 1000 : 100);
    return () => {
      window.clearInterval(id);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [target, motionEnabled]);
  const revealed = s0 !== null && s0 <= 0;
  // 공개 시각이 지나면 즉시 실제 내용을 받아온다(캐시 우회 액션). 서버 시계가 reveal에 아직 안
  // 닿았으면(미세한 시계차) 빈 결과 → 카드가 그대로라 짧게 재시도, 풀리면 카드가 사라져 멈춘다.
  useEffect(() => {
    if (!revealed) return;
    onRevealRef.current();
    const id = window.setInterval(() => onRevealRef.current(), 2000);
    return () => window.clearInterval(id);
  }, [revealed]);
  if (Number.isNaN(target)) return null;
  if (s0 === null) return <span className="teaser-count" ref={hostRef}>⏳</span>;
  const s = s0;
  // 긴장 곡선: 하루 이상 남으면 초를 세지 않고 D-n만(조용히), 24시간 안쪽부터 실시간 시계.
  // 1시간 안쪽(soon)은 카드가 은은히 달아오르고, 10초 안쪽(final)은 초가 심장박동처럼 뛴다.
  if (s > 86400) {
    return (
      <span className="teaser-count" ref={hostRef}>
        D-{Math.ceil(s / 86400)}
      </span>
    );
  }
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  // 1분 안쪽 = 최초공개 직전. 예전엔 h1~h4 이산 단계라 경계에서 툭 바뀌었다(사용자 지적) →
  // 이제 강도 I가 연속으로 오르고 시각 채널은 위 10Hz 루프가 CSS 변수로 흘려보낸다.
  // 여기 클래스는 '무엇을 그릴지'(의미)만 정한다.
  // hype 표기는 등장 구간부터 붙인다 — 그래야 큰 숫자가 스며드는 동안에도 같은 문법으로
  // 그려진다(60초에 클래스가 바뀌면 그 순간 스타일이 통째로 갈린다).
  const inHype = s <= HYPE_EMERGE_S;
  const cls = `teaser-count is-live${s <= 3600 ? " soon" : ""}${inHype ? " hype" : ""}`;
  // 66~58초는 시계와 큰 숫자가 함께 존재하는 구간이다. 같은 격자 칸에 겹쳐 두고
  // --hy-emerge로 서로 넘겨준다 → 알약 폭이 큰 쪽에 맞춰져 있어 자리도 안 튄다.
  if (s <= HYPE_EMERGE_S) {
    return (
      <span className={cls} ref={hostRef}>
        <span className="tc-stack">
          {s > HYPE_WINDOW_S - 2 ? <i className="tc-clock">{`${hh}:${mm}:${ss}`}</i> : null}
          {/* 초만 크게(분/시는 0이라 잡음) — key로 매 초 리마운트해 숫자가 쿵 떨어지는 연출. */}
          <b key={s}>{s}</b>
        </span>
      </span>
    );
  }
  return (
    <span className={cls} ref={hostRef}>
      {s <= 0 ? "✨ 공개!" : `${hh}:${mm}:${ss}`}
    </span>
  );
}

// 공개 순간 제목 해독 연출 — 해커 영화식 디코딩. 두 국면으로 나뉜다:
//  ① 0~0.75s: 제목 전체가 난수 문자(23436t#$@ 같은)로 미친 듯이 교체된다(60ms마다).
//  ② 이후: 왼쪽부터 한 글자씩 '확정'되고 남은 자리는 계속 난동친다(글자당 90ms).
// 예전(글자만 슥 채워짐)은 짧은 제목이면 0.3초에 끝나 아무도 못 봤다 → 최소 1.5초는 논다.
// reduce-motion이면 그냥 완성된 제목.
const SCRAMBLE_POOL = "!@#$%&*?/\\<>[]{}=+~0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SCRAMBLE_QM_MS = 260; // ???를 잠깐 붙들고 있는 구간
const SCRAMBLE_CHAOS_MS = 750; // 전부 난수인 구간
const SCRAMBLE_STEP_MS = 90; // 글자당 확정 간격
function ScrambleText({ text }: { text: string }) {
  const [tick, setTick] = useState(0);
  const [locked, setLocked] = useState(0);
  const [done, setDone] = useState(false);
  // ??? → 난수 → 평문. 공개 직전까지 카드가 보여주던 ???를 잠깐 그대로 붙들었다가
  // 무너뜨린다 — 바로 난수로 갈아치우면 '무엇이 풀리는 중인지'의 연결이 끊긴다.
  const [phase, setPhase] = useState<"qm" | "chaos">("qm");
  useEffect(() => {
    setTick(0);
    setLocked(0);
    setDone(false);
    setPhase("qm");
    if (document.documentElement.hasAttribute("data-reduce-motion")) {
      setDone(true);
      return;
    }
    const started = Date.now();
    const toChaos = window.setTimeout(() => setPhase("chaos"), SCRAMBLE_QM_MS);
    // 난수 자리를 새로 뽑는 간격. 60ms(초당 16회)는 너무 빨라 글자가 뭉개진 노이즈로만
    // 보였다 — 개별 글자가 인지되는 90ms로 늦춰 '난수가 돌아가는 중'이 읽히게 한다.
    const chaos = window.setInterval(() => setTick((t) => t + 1), 90);
    let lockTimer = 0;
    const startLocking = window.setTimeout(() => {
      let i = 0;
      lockTimer = window.setInterval(() => {
        i += 1;
        setLocked(i);
        if (i >= text.length) {
          window.clearInterval(lockTimer);
          window.clearInterval(chaos);
          setDone(true);
        }
      }, SCRAMBLE_STEP_MS);
    }, SCRAMBLE_QM_MS + SCRAMBLE_CHAOS_MS);
    return () => {
      window.clearInterval(chaos);
      window.clearTimeout(toChaos);
      window.clearTimeout(startLocking);
      if (lockTimer) window.clearInterval(lockTimer);
      void started;
    };
  }, [text]);
  if (done) return <>{text}</>;
  if (phase === "qm") {
    return (
      <span aria-hidden="true" className="scramble-rest scramble-qm">
        ???
      </span>
    );
  }
  const rest = text.length - locked;
  return (
    <>
      {locked > 0 ? <span className="scramble-locked">{text.slice(0, locked)}</span> : null}
      <span aria-hidden="true" className="scramble-rest">
        {Array.from(
          { length: Math.max(0, rest) },
          (_, k) => SCRAMBLE_POOL[(tick * 13 + k * 7 + locked * 3) % SCRAMBLE_POOL.length]
        ).join("")}
      </span>
    </>
  );
}
// 스크램블 총 길이(연출 상태를 언제 풀지 계산) — 카오스 + 글자당 확정 + 여유.
function scrambleDurationMs(text: string): number {
  return SCRAMBLE_QM_MS + SCRAMBLE_CHAOS_MS + Math.max(1, text.length) * SCRAMBLE_STEP_MS + 400;
}

// 리더선 기하 — 앵커점에 원점을 두고 대상점 방향으로 회전시킨 뒤, 선은 그 로컬 x축 위에
// 눕힌다. 클립은 실제 구간(0~길이)만 남겨 흐름 애니메이션이 끝을 넘어가도 안 보이게 한다.
// (선 좌표를 직접 고치던 예전 방식은 점선 흐름을 stroke-dashoffset으로만 굴릴 수 있었다.)
function leaderGeom(
  a: { x: number; y: number },
  e: { x: number; y: number }
): { len: number; deg: number } {
  const dx = e.x - a.x;
  const dy = e.y - a.y;
  return { len: Math.hypot(dx, dy), deg: (Math.atan2(dy, dx) * 180) / Math.PI };
}
function applyLeaderGeom(
  group: SVGGElement | null,
  clip: SVGRectElement | null,
  a: { x: number; y: number },
  e: { x: number; y: number }
): void {
  if (!group) return;
  const { len, deg } = leaderGeom(a, e);
  group.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${deg})`);
  clip?.setAttribute("width", String(Math.max(0, len)));
}

// 공개 보상 스태거 — 제목이 먼저 정체를 얻고, 그 다음 부제목·메타·태그가 차례로 따라온다.
// (예전엔 제목만 해독되고 하위 정보는 이미 완성돼 보여 시선 순서가 뒤집혔다.)
// 시작 시각은 '제목의 앞 3글자가 확정되는' 750+3×90=1,020ms가 기본이다 — 한국어 제목을
// 알아보기 시작하는 최소 단서이자 기존 상수에서 그대로 나오는 값이라 새 매직 넘버가 아니다.
// 다만 제목이 길면 해독이 2.5초까지 가서 부제목이 '제목보다 먼저' 끝나 위계가 뒤집힌다
// → 제목 60%가 확정되는 시점까지 민다(짧은 제목은 1,020ms 그대로).
const SECONDARY_BASE_MS = SCRAMBLE_QM_MS + 1_020;
const SECONDARY_STEP_MS = 70; // 60Hz 약 4.2프레임 — 순서는 읽히되 끊긴 목록으로 안 느껴지는 간격
const SECONDARY_MAX_STEPS = 4; // 줄이 많아도 총 지연은 280ms에서 멈춘다
function secondaryStartMs(title: string): number {
  const n = Math.max(1, title.length);
  return Math.max(
    SECONDARY_BASE_MS,
    SCRAMBLE_QM_MS + SCRAMBLE_CHAOS_MS + Math.ceil(n * 0.6) * SCRAMBLE_STEP_MS
  );
}
// order: 부제목 0..n-1 → 메타 → 태그. 지연만 다르고 연출은 같다(디자인 통일).
function secondaryDelayMs(title: string, order: number): number {
  return secondaryStartMs(title) + Math.min(Math.max(0, order), SECONDARY_MAX_STEPS) * SECONDARY_STEP_MS;
}
// 공개 직후에만 붙는 스태거 props. transform/opacity만 쓰므로 레이아웃은 전혀 안 건드린다
// (계획서의 inner wrapper + overflow:clip은 4px 이동에선 체감이 없고 pill-sub-last의 flex
// 행 구조를 갈라야 해서 채택하지 않았다 — 기하 불변이라는 목적은 이쪽이 더 안전하게 달성한다).
function revealStagger(
  active: boolean,
  title: string,
  order: number
): { className: string; style?: CSSProperties } {
  if (!active) return { className: "" };
  return {
    className: " reveal-secondary",
    style: { "--reveal-delay": `${secondaryDelayMs(title, order)}ms` } as CSSProperties
  };
}

// 남은 초 — 카드와 팝오버가 '같은 숫자를 같은 순간에' 보여주기 위한 공용 시계.
// 예전엔 두 곳이 각자 setInterval(1000)을 돌려서, 시작 시각이 다르면 최대 1초까지 서로 다른
// 숫자를 보여줬다(사용자 지적: 살짝 어긋난다). interval은 시작 시점 기준으로 세기 때문에
// 아무리 정확해도 위상이 안 맞는다 → 매번 '다음 초 경계'를 직접 계산해 그때 깨어난다.
// 그러면 어느 컴포넌트가 언제 마운트됐든 넘어가는 순간이 같다(+8ms는 경계를 확실히 넘기려는 여유).
function useRemainSeconds(targetMs: number | null): number | null {
  const [s, setS] = useState<number | null>(null);
  useEffect(() => {
    if (targetMs === null || !Number.isFinite(targetMs)) {
      setS(null);
      return;
    }
    let timer = 0;
    const tick = () => {
      const diff = targetMs - Date.now();
      // ceil — 남은 시간이 0.2초여도 '1'이다. round면 0.5초 남았을 때 0을 띄워 반 박자 빠르다.
      setS(Math.max(0, Math.ceil(diff / 1000)));
      timer = window.setTimeout(tick, (((diff % 1000) + 1000) % 1000) + 8);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [targetMs]);
  return s;
}

// 서버가 '아직 안 풀린 떡밥'이라고 말하는가. 로컬 공개 캐시(revealedEvents)는 화면이 직접
// 본 공개만 담는데, 일정을 다시 떡밥으로 되돌리면 그 캐시가 새 떡밥까지 영구히 덮어버려
// 카운트다운이 다시는 안 나왔다 — 서버 쪽이 미래를 가리키면 캐시를 무시한다.
function teaserStillAhead(ev: PublicScheduleEvent): boolean {
  return Boolean(ev.teaser && ev.teaserRevealAt && Date.parse(ev.teaserRevealAt) > Date.now());
}

// 링 아래 캡션용 — 시각만. 날짜는 팝오버 머리글이 이미 말하고 있어 다시 쓰면 중복이다.
function formatRevealClockKst(iso: string): string {
  const t = new Date(Date.parse(iso) + 9 * 3_600_000);
  const hh = t.getUTCHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const mm = t.getUTCMinutes();
  // '공개'는 바로 위 라벨("최초공개까지")이 이미 말한다 — 캡션은 시각만 말한다.
  return `${hh < 12 ? "오전" : "오후"} ${h12}시${mm ? ` ${String(mm).padStart(2, "0")}분` : ""}`;
}

// 공개 시각을 사람이 읽는 KST로 — 팝오버 전용 정보(카드에는 카운트다운만 → 중복 없음).
function formatRevealKst(iso: string): string {
  const t = new Date(Date.parse(iso) + 9 * 3_600_000);
  const wd = "일월화수목금토"[t.getUTCDay()];
  const hh = t.getUTCHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const mm = t.getUTCMinutes();
  return `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일 (${wd}) ${hh < 12 ? "오전" : "오후"} ${h12}시${
    mm ? ` ${String(mm).padStart(2, "0")}분` : ""
  }`;
}

// 공개 시각이 이미 지난 떡밥(캐시 지연으로 서버가 아직 가린 stub을 보낸 경우) — 보라 ??? 하이프
// 카드를 깜빡 띄우지 않고, 자리만 잡는 중립 placeholder를 두고 즉시 실제 내용을 받아 갈아끼운다.
function TeaserRevealing({
  onReveal,
  className,
  eventId,
  revealAt
}: {
  onReveal: () => void;
  className: string;
  eventId: string;
  revealAt?: string;
}) {
  const fired = useRef(false);
  const ref = useRef(onReveal);
  ref.current = onReveal;
  // 진단 로그에 쓸 값도 ref로 — 이 effect는 마운트 1회만 돌아야 한다(재시도 interval 재설치 금지).
  const diag = useRef({ eventId, revealAt });
  diag.current = { eventId, revealAt };
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      // 진단(3일): 이 자리는 '비어 있는 카드'다. 여기서 못 빠져나오면 시청자에게 빈 칸이 보인다 —
      // 실제로 그랬고, 그때 로그가 없어 코드를 읽어서야 원인을 알았다.
      const d = diag.current;
      logActivity("diag.teaser", {
        target: d.eventId,
        meta: {
          phase: "placeholder",
          revealAt: d.revealAt ?? "",
          pastSec: d.revealAt ? Math.round((Date.now() - Date.parse(d.revealAt)) / 1000) : 0
        }
      });
      ref.current();
    }
    const id = window.setInterval(() => ref.current(), 2000);
    return () => window.clearInterval(id);
  }, []);
  return <div className={className} aria-hidden="true" />;
}

const REST_TAG_NAME = "휴뱅";

// "내 관심" 어항 하트 — 이 달 (휴뱅 제외) 일정 중 내가 하트 누른 비율(0~1)만큼 붉은 물이 차고
// 표면이 출렁인다. SVG로 물결 곡선 "아래쪽을 바닥까지" 채워(채움의 윗변 자체가 물결) 평평한
// 직선이 원천적으로 안 생긴다. 물결 두 겹이 서로 다른 속도·방향으로 흘러 출렁임을 만든다.
function LiquidHeart({ ratio }: { ratio: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = Math.max(0, Math.min(1, ratio));
  // 물 표면 y(viewBox 0~120). r=0이면 바닥 아래(물 안 보임), r=1이면 거의 꼭대기.
  const surface = 116 - r * 112;
  const heart =
    "M60 104 C 22 76 8 56 8 36 C 8 18 21 8 35 8 C 47 8 55 16 60 26 C 65 16 73 8 85 8 C 99 8 112 18 112 36 C 112 56 98 76 60 104 Z";
  // 폭 240(=뷰박스 2배), 파장 60 → -60 이동하면 한 파장이라 매끈하게 반복. 윗변은 물결, 아래는 바닥까지 채움.
  const wave =
    "M0 8 q 15 -9 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 L240 230 L0 230 Z";
  return (
    <svg className="liquid-heart" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id={`lhc-${uid}`}>
          <path d={heart} />
        </clipPath>
        <linearGradient id={`lhg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5d7e" />
          <stop offset="1" stopColor="#e30b34" />
        </linearGradient>
      </defs>
      {/* 비어있는 하트 바탕(연분홍) */}
      <path d={heart} fill="#f3dde2" />
      <g clipPath={`url(#lhc-${uid})`}>
        <g transform={`translate(0 ${surface})`}>
          <path d={wave} fill={`url(#lhg-${uid})`}>
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              dur="2.4s"
              from="0 0"
              repeatCount="indefinite"
              to="-60 0"
              type="translate"
            />
          </path>
          <path d={wave} fill="#ff6f8d" opacity="0.45">
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              dur="3.7s"
              from="-60 0"
              repeatCount="indefinite"
              to="0 0"
              type="translate"
            />
          </path>
        </g>
      </g>
    </svg>
  );
}

// 하트를 누를 때 떠오르는 ♥ 입자 하나. 화면 좌표(fixed)와 약간의 무작위성으로 자연스럽게 흩어진다.
type HeartFloater = {
  id: string;
  x: number; // 시작 좌표(clientX)
  y: number; // 시작 좌표(clientY)
  dx: number; // 떠오르며 좌우로 흘러가는 양(px)
  dur: number; // 지속 시간(ms)
  size: number; // 글자 크기(px)
  delay: number; // 시작 지연(ms) — 한 번에 여러 개가 살짝 시차를 두고 오른다
};

// 특별한 날 탭 → 그 자리에서 방사형으로 흩어지는 색종이 한 조각(빵빠레 폭죽).
type BurstBit = {
  dx: number; // 터지는 방향 x(px)
  dy: number; // 터지는 방향 y(px, 위로 살짝 솟구침)
  rot: number; // 회전(deg)
  color: string; // 색종이 색(이모지면 무시)
  emoji: string | null; // 가끔은 색종이 대신 🎉/⚽ 같은 이모지
  dur: number; // 지속(ms)
};

export function PublicPoster({
  initialMonth,
  initialYear,
  onViewChange,
  schedule,
  initialNarrow = false,
  toggleHeartAction,
  accountSwitch = false,
  showHopeBadge = false,
  accountEmail = null,
  anonymous = false,
  previewNote,
  previewNav,
  avatarSlot = false,
  avatarOn: avatarOnProp,
  avatarSide: avatarSideProp,
  avatarFixed,
  onAvatarToggle,
  onAvatarSide
}: PublicPosterProps) {
  // 다음 콜드 엔트리의 로딩 스켈레톤 톤 힌트 — 독립 포스터 화면(`/`)일 때만 "포스터"로.
  // accountSwitch=false인 편집실/꾸미기 미리보기는 편집 맥락이라 힌트를 건드리지 않는다.
  useEffect(() => {
    if (accountSwitch) writeLoadingToneCookie("p");
  }, [accountSwitch]);
  // 시청자 화면엔 빌드 표시 UI가 없어(포스터 청결 원칙) "이 탭이 옛 빌드인지"를 확인할 길이 없었다.
  // 콘솔에만 커밋 해시를 남긴다 — 편집실 좌상단 빌드 태그와 같은 값이면 두 탭이 같은 배포본.
  useEffect(() => {
    console.info(`VIC build ${process.env.APP_COMMIT?.slice(0, 7) ?? "dev"}`);
  }, []);
  // 토리님 SOOP 라이브 상태 — 꾸미기 아니면 폴링(편집실 '시청자 미리보기'에서도 켜서 개발자/오너가
  // 시청자가 볼 LIVE를 그대로 확인). 데스크탑 플로팅 비콘은 편집실 chrome과 겹쳐 미리보기에선 숨기고
  // (아래 마운트의 !previewNav), 모바일은 겹침 없는 하단 '오늘'→LIVE 버튼이라 미리보기에서도 보인다.
  const soopLiveRaw = useSoopLive();
  // 새 배포 자동 반영(시청자 전용) — 시청자 탭은 며칠씩 떠 있어 폴링 데이터는 최신인데 코드/CSS는
  // 옛 빌드로 남는다(2026-09-01 '카드 폭이 화면마다 다르다' 재신고의 실체 = 옛 빌드로 떠 있던 탭).
  // 60초 라이브 폴링에 실린 서버 빌드 해시가 내 번들 해시와 다르면, 탭이 화면에서 사라진 순간
  // (숨김)에만 조용히 새로고침한다 — 보는 중엔 절대 안 끊는다(스크롤·필터 유지). 편집실/미리보기는
  // 제외(accountSwitch=false): 편집 중 새로고침은 최적화 큐·팝오버를 죽인다. 롤백·CDN 캐시로
  // 해시가 왔다갔다해도 같은 값으론 한 번만 시도(sessionStorage)해 새로고침 루프를 막는다.
  const serverBuild = soopLiveRaw?.build ?? null;
  useEffect(() => {
    if (!accountSwitch || !serverBuild || serverBuild === "dev") return;
    const mine = process.env.APP_COMMIT ?? "dev";
    if (mine === "dev" || serverBuild === mine) return;
    try {
      if (window.sessionStorage.getItem("vic:reloadedFor") === serverBuild) return;
    } catch {
      /* sessionStorage 불가 — 루프 가드 없이 새로고침은 위험하므로 포기 */
      return;
    }
    const doReload = () => {
      try {
        window.sessionStorage.setItem("vic:reloadedFor", serverBuild);
      } catch {
        return;
      }
      window.location.reload();
    };
    if (document.visibilityState === "hidden") {
      doReload();
      return;
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") doReload();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [accountSwitch, serverBuild]);
  // 테스트 전용: URL에 ?live-preview=1 을 붙이면 라이브 카드를 강제로 띄워 렌더를 확인한다
  // (임베드는 실제 채널 플레이어 — 방송 중이 아니면 오프라인 화면). 공개-안전: 가짜 UI일 뿐
  // 데이터 접근 없음. 확인 끝나면 파라미터만 지우면 된다.
  const [livePreviewOn, setLivePreviewOn] = useState(false);
  useEffect(() => {
    try {
      setLivePreviewOn(new URLSearchParams(window.location.search).has("live-preview"));
    } catch {
      /* 무시 */
    }
  }, []);
  const soopLive =
    livePreviewOn && !soopLiveRaw?.isLive
      ? {
          isLive: true,
          bjId: "toryvac",
          bjNick: "빅토리",
          title: "라이브 카드 미리보기 (테스트)",
          category: null,
          bno: null,
          watchUrl: "https://play.sooplive.co.kr/toryvac"
        }
      : soopLiveRaw;
  // 모바일 '오늘' 버튼은 평소엔 오늘로 이동하는 본래 기능. 오늘 행이 실제로 화면에 보이는 동안만
  // (이미 도착) 방송 중이면 그 자리를 LIVE(보러가기)로 바꾼다. 스크롤로 벗어나거나 다른 달이면 다시
  // '오늘'(이동)로 복귀 — 아래 IntersectionObserver가 가시성을 추적한다.
  const [todayVisible, setTodayVisible] = useState(false);
  // 처음 화면에 들어왔을 때만 잠깐, 인기(관심) 단계별로 날짜 칸을 부각하는 애니메이션을 켠다.
  // 이후(월 이동 등)엔 꺼서 산만하지 않게 한다.
  const [popIntro, setPopIntro] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setPopIntro(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);
  const [view, setView] = useState({
    year: initialYear ?? schedule.calendar.defaultYear,
    month: initialMonth ?? schedule.calendar.defaultMonth
  });
  const cells = useMemo(() => buildCalendarMonth(view.year, view.month), [view]);
  const today = getTodayKst();
  // 업 도움은 기간(종료일, KST)이 지나면 전부 자동으로 내린다 — 달력 띠·줄 칸·우측 안내 카드
  // 어디서도 끝난 업 도움은 그리지 않는다. 종료일이 오늘 이전이면 이벤트 집합에서 제외해, 모든
  // 업 도움 시각화(레인 배정·주별 줄 수·띠·카드)가 한 소스에서 일관되게 사라지게 한다.
  // 단순 기간 안내(supportKind 'period')는 예외 — 정보성 기록이라 지나도 남긴다(2026-09-01).
  const liveEvents = useMemo(
    () =>
      schedule.events.filter(
        (e) =>
          !e.isSupport ||
          e.supportKind === "period" ||
          (e.endDateKey ?? getEventDateKey(e)) >= today
      ),
    [schedule.events, today]
  );
  const supportLanes = useMemo(() => assignSupportLanes(liveEvents), [liveEvents]);
  // (띠 줄 수 "주별" 계산은 칸별 계산으로 대체 — 2026-09-02. 띠가 안 지나가는 칸까지 주 최대값
  //  만큼 내려앉아 빈 줄이 생겼다. 이제 각 칸이 자기를 지나는 띠의 최고 레인만큼만 비운다.)
  // (레일 업도움 카드 삭제로 activeSupportEvents 목록은 불필요 — 업도움 접근은 띠 클릭 팝오버.)
  // 이어진 일정 묶음 키 — 같은 묶음 칸들의 높이를 맞추는 데 쓴다(아래 useEqualChainHeights).
  const chainKeys = useMemo(() => buildChainKeys(schedule.events), [schedule.events]);
  // 같은 태그 구성으로 이어진 묶음은 하나의 그라데이션으로(경계 가운데). 묶음별 날짜 범위.
  const paintGroups = useMemo(() => buildPaintGroups(schedule.events), [schedule.events]);
  // 이어진 일정(link_next로 묶인 '별개' 일정들)은 같은 묶음 칸끼리 높이를 맞춰 이음새가 어긋나지
  // 않게 한다. 묶음의 '가장 큰 내용' 높이에만 맞추므로(과확장 없음) 짧은 쪽만 그만큼 채워진다.
  // callback ref라 그리드가 (재)마운트되는 어떤 경로에서도 자동 재설정된다. deps는 보강용.
  const monthGridRef = useEqualChainHeights<HTMLDivElement>([schedule.events, view]);
  // 구글 시트식 날짜 칸 범위 선택(마우스 전용, 시각 강조) + 텍스트 긁힘 방지.
  // (P1-MULTI-0로 제거했다가 사용자 요청으로 복원 — 방송 중 기간을 짚어주는 실사용 도구.)
  const { setRef: rangeSelectRef, selected: rangeSelected } = useCellRangeSelect<HTMLDivElement>();
  const setMonthGridRef = useCallback(
    (el: HTMLDivElement | null) => {
      monthGridRef(el);
      rangeSelectRef(el);
    },
    [monthGridRef, rangeSelectRef]
  );
  // 실제 달력 콘텐츠가 떴음을 방문 비콘에 알린다(로딩 스켈레톤이 아니라 진짜 화면을 봤을 때만 방문 1).
  useEffect(() => {
    markContentReady();
  }, []);
  // 시청자(공개 포스터) 태그 뷰 — 단계 배포 제어. TAXONOMY_V3_ROLES에 viewer가 있으면 v3(세부·
  // modifier·신설 그룹), 없으면 레거시(세부 나누기 이전). 현재 viewer 포함 = v3.
  const viewTags = useMemo(
    () => (isTaxonomyV3("viewer") ? schedule.tags : legacyTagView(schedule.tags)),
    [schedule.tags]
  );
  // 0A: 태그 색 계산의 단일 진입점. 칸 색/점 줄은 resolver를 통해 푼다(내부는 기존 로직과 동일 →
  // 픽셀 불변, 비주얼 스냅샷으로 확인). 커스텀 색(bg_hex)은 나중에 이 resolver 안에서만 얹는다.
  const tagVisual = useMemo(
    () => createTagVisualResolver(viewTags, schedule.palette),
    [viewTags, schedule.palette]
  );
  // #1: 색상 안내에서 "기타"는 항상 맨 마지막으로(나머지는 기존 정렬 유지).
  // 색상 안내 순서 = 태그 sort_order(편집실에서 드래그로 정한 순서). 단일 진실 소스.
  // 2계층: 색상 안내/필터는 '대분류'만(한 색 = 한 칩). 대분류를 고르면 그 하위 세부 일정까지 매칭된다.
  const legendTags = useMemo(
    () =>
      [...viewTags]
        .filter((t) => (t.parentId ?? null) === null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [viewTags]
  );

  // B1: 오늘이 데뷔 기념일·D+·생일이면 축하 연출(컨페티)을 1회 띄운다.
  const todayCelebration = useMemo(() => {
    const mark = getDayMark(today);
    return mark && /🎉|🎂|🎈/.test(mark.name) ? mark.name : null;
  }, [today]);
  const [celebrate, setCelebrate] = useState(false);
  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 900),
        dur: 2600 + Math.round(Math.random() * 1600),
        color: ["#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f87171"][i % 6]
      })),
    []
  );
  useEffect(() => {
    if (!todayCelebration) {
      return;
    }
    if (reduceMotionEnabled()) {
      return;
    }
    setCelebrate(true);
    const timer = setTimeout(() => setCelebrate(false), 4800);
    return () => clearTimeout(timer);
  }, [todayCelebration]);

  // C9/C10: 포스터 테마(계절/배경) — 서버 값 그대로(테마 변경 UI는 꾸미기와 함께 철수, 2026-08-27).
  const posterTheme = schedule.calendar.posterTheme;
  const effectivePosterTheme = posterTheme;

  // 관리자 아바타 자리(스트리머 scene). 꾸미기(decorate)에서도 허용 — 현재 방식은 surface를 통째로
  // uniform scale(축소)만 하므로 스티커 좌표(1840 design 기준)가 안 틀어진다(시청자=avatar OFF와도
  // 동일 좌표). 캡처(PNG)는 export 표면 밖이라 아바타가 안 들어간다. localStorage는 owner 로컬.
  const avatarCapable = avatarSlot || !!avatarFixed;
  // 편집실(studio-shell)에서 controlled로 내려주면(onAvatarToggle 존재) 그 상태/세터를 그대로 쓴다 →
  // 편집실↔미리보기가 같은 상태를 공유(켠 채 넘어가도 켜져 있음). 그 외(미설정)엔 내부 상태+localStorage.
  const avatarControlled = typeof onAvatarToggle === "function";
  const [avatarOnState, setAvatarOnState] = useState(true);
  const [avatarSideState, setAvatarSideState] = useState<"left" | "right">("left"); // 최초 디폴트 왼쪽
  useEffect(() => {
    if (avatarControlled || !avatarCapable || typeof window === "undefined") {
      return;
    }
    try {
      if (window.localStorage.getItem("vic_avatar_on") === "0") setAvatarOnState(false);
      if (window.localStorage.getItem("vic_avatar_side") === "right") setAvatarSideState("right");
    } catch {
      /* 저장소 불가 환경 무시 */
    }
  }, [avatarControlled, avatarCapable]);
  function toggleAvatarOnInternal() {
    hapticTick();
    setAvatarOnState((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("vic_avatar_on", next ? "1" : "0");
      } catch {
        /* 무시 */
      }
      return next;
    });
  }
  function pickAvatarSideInternal(side: "left" | "right") {
    hapticTick();
    setAvatarSideState(side);
    try {
      window.localStorage.setItem("vic_avatar_side", side);
    } catch {
      /* 무시 */
    }
  }
  const avatarOn = avatarFixed ? true : avatarControlled ? avatarOnProp ?? true : avatarOnState;
  const avatarSide = avatarFixed ?? (avatarControlled ? avatarSideProp ?? "left" : avatarSideState);
  const toggleAvatarOn = avatarControlled ? onAvatarToggle! : toggleAvatarOnInternal;
  const pickAvatarSide = avatarControlled ? onAvatarSide! : pickAvatarSideInternal;

  // 모바일 아젠다에서 사용자가 펼친 '빈 날 구간'(접기는 숨김이 아니라 접힘 — 탭하면 그대로 보인다).
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(() => new Set());
  // 하트 등급 승급 토스트(시청자) — 내 하트가 등급을 올렸을 때만 잠깐 뜬다.
  const [heartToast, setHeartToast] = useState<string | null>(null);
  const heartToastTimerRef = useRef<number | null>(null);
  // 시청자 '이 달 기록' 시트 열림.
  const [insightsOpen, setInsightsOpen] = useState(false);
  // A2 고도화: 여러 태그를 동시에 고르고, "관심만 보기"까지 더해 보고 싶은 일정만 추려 본다.
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  // A: 관심(하트). toggleHeartAction이 있으면 서버 집계(1인 1하트)와 연동되고,
  //    없으면(샘플/오프라인) 기기별 localStorage로만 동작한다. 둘 다 "내가 누른 일정" 집합으로 관리.
  // 떡밥 즉시 공개 — 카운트다운이 0이 되면 캐시 우회 액션으로 실제 내용을 받아 이 맵에 덮는다.
  // (이게 있으면 렌더에서 가린 stub 대신 실제 일정을 쓴다 → 캐시 30초 안 기다리고 그 순간 풀림.)
  const [revealedEvents, setRevealedEvents] = useState<Record<string, PublicScheduleEvent>>({});
  // 서버가 "그런 일정 없다"고 확인해 준 떡밥 id — 지워졌거나 공개가 아니게 된 것들.
  // 낡은 공개 캐시가 준 유령 카드(빈 흰 카드)를 여기서 걷어낸다(reconcileTeaserReveal 주석 참조).
  const [goneTeaserIds, setGoneTeaserIds] = useState<Set<string>>(() => new Set());
  const markTeaserGone = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setGoneTeaserIds((prev) => {
      if (ids.every((id) => prev.has(id))) return prev; // 참조 유지 — 무한 리렌더 방지
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    logActivity("diag.teaser", { target: ids[0], meta: { phase: "gone", count: ids.length } });
  }, []);

  // ⚠ 마운트할 때마다 떡밥의 '지금 진실'을 캐시를 우회해 한 번 받아온다.
  //
  // 왜 필요한가: 편집실 미리보기가 쓰는 viewerModePreview는 **페이지가 서버에서 그려진 시점의
  // 스냅샷**이다(공개 스케줄은 5분 캐시). 저장은 /api/studio-write 라우트로 나가므로 RSC가 다시
  // 그려지지 않는다 → 미리보기를 껐다 켤 때마다 옛 공개시각이 되살아난다.
  // 실측(2026-08-04 진단 로그): 저장 직후엔 자가복구로 04:48이 됐다가, 미리보기를 다시 켜니
  // revealAt이 04:21(26분 전 값)로 되돌아가 ???가 아니라 빈 칸이 보였다.
  // loadRevealedEvents는 캐시를 타지 않고 서버가 공개시각을 다시 판정하므로, 한 번의 왕복으로
  // '아직 미공개면 새 공개시각이 담긴 stub, 공개됐으면 실제 내용'을 받아 상태를 바로잡는다.
  const teaserIdsKey = useMemo(
    () =>
      schedule.events
        .filter((e) => e.teaser)
        .map((e) => e.id)
        .sort()
        .join(","),
    [schedule.events]
  );
  useEffect(() => {
    if (!teaserIdsKey) return;
    const ids = teaserIdsKey.split(",");
    let alive = true;
    revealTeaserAction(ids)
      .then((result) => {
        if (!alive) return;
        const { events: list, goneIds } = reconcileTeaserReveal(ids, result);
        // 서버가 '없다'고 확인해 준 id는 카드에서 치운다 — 낡은 스냅샷이 준 유령(지운 일정)이
        // 빈 흰 카드로 남던 경로(2026-08-05 실측). 캐시 무효화 복구가 1차, 이건 2차 방어.
        markTeaserGone(goneIds);
        if (list.length > 0) {
          setRevealedEvents((prev) => {
            const next = { ...prev };
            for (const ev of list) next[ev.id] = ev;
            return next;
          });
        }
        logActivity("diag.reveal", {
          meta: {
            phase: "mount-sync",
            asked: ids.length,
            got: list.length,
            gone: goneIds.length,
            revealed: list.filter((ev) => !ev.teaser).length
          }
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // markTeaserGone은 useCallback([]) — 정체성이 고정이라 이 동기화가 매번 다시 돌지 않는다.
  }, [teaserIdsKey, markTeaserGone]);
  // 다시보기(VOD) — 날짜(방송 시작일)별 매핑(0068). 하루에 여러 번 방송하면 여러 개.
  // 등록 순서(=방송 순서)대로 보이게 titleNo 오름차순으로 정렬해 둔다.
  const vodsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        titleNo: number;
        title: string;
        durationMs: number;
        chapters?: number;
        timelineBy?: string;
        thumbQuery?: string;
      }[]
    >();
    for (const v of schedule.vods ?? []) {
      const list = map.get(v.dateKey);
      if (list) list.push(v);
      else map.set(v.dateKey, [v]);
    }
    for (const list of map.values()) list.sort((a, b) => a.titleNo - b.titleNo);
    return map;
  }, [schedule.vods]);
  // 날짜 칸 다시보기 '창'(PC) — 일정 카드가 없는 날(특히 2024~25, 일정 시스템 이전)도
  // 칸 배경 클릭으로 그 날 다시보기에 들어가는 유일한 통로다(2026-08-31 사용자 요청).
  // 팝오버가 아니라 화면 중앙의 작은 창: 썸네일 미리보기 + 제목 + 챕터를 한 자리에서.
  // 모바일 아젠다는 일정 없는 날 줄에 칩·챕터를 인라인으로 그려 창이 필요 없다.
  const [dayVodPop, setDayVodPop] = useState<{ dateKey: string } | null>(null);
  // 창 안 인라인 플레이어 — 숲 임베드 iframe API(?fromApi=1, 2026-09-01 번들 분석+실측 확정):
  //  · 창이 열리면 모든 VOD의 iframe을 바로 깔고, PonReady가 오면 Pload{autoPlay:false}로
  //    초기화만 해둔다(무음·무재생, 지정 포스터+▶ 상태). 시청자의 첫 클릭이 곧 플레이어 안
  //    ▶ 클릭 = 프레임 안 제스처라 어떤 브라우저에서도 클릭 1번에 소리 켠 재생이 된다.
  //    (URL 파라미터 mutePlay=false만으론 재생 시도조차 안 하고, 프레임 밖 클릭으로 소리 켠
  //    시작은 브라우저가 원천 차단 — 둘 다 실측. 이 배치가 유일한 1클릭 경로.)
  //  · 챕터 점프: 미디어가 굴러간 적 있으면 PseekTo — iframe 리로드가 없어 광고도 다시 안 돈다.
  //    ⚠ seconds는 반드시 {time, seekType} 객체 — 숫자를 주면 플레이어 내부 리듀서가
  //    payload.time=undefined로 읽어 0초로 튄다(2026-09-01 사용자 신고 재현+수정).
  //    아직이면 Pload{autoPlay:true,startVideoSeconds} — 허용 브라우저는 그 초부터 즉시 소리 켠
  //    재생, 차단 브라우저는 그 지점 포스터+▶ 하나.
  const [dayVodJump, setDayVodJump] = useState<{ titleNo: number; sec: number } | null>(null);
  // 재생이 실제로 시작된 방송들 — 이때에야 스냅샷 커버를 걷는다. 그 전까지는 토리님이 지정한
  // 썸네일이 계속 보인다(클릭은 통과라 1클릭 재생은 그대로 — 2026-09-01 사용자 절충).
  const [dayVodLive, setDayVodLive] = useState<ReadonlySet<number>>(new Set());
  const dayVodApisRef = useRef(new Map<number, (msg: Record<string, unknown>) => void>());
  const dayVodAliveRef = useRef(new Set<number>());
  const dayVodPausedRef = useRef(new Set<number>());
  const dayVodPendingRef = useRef(new Map<number, number>());
  useEffect(() => {
    // 창이 닫히거나 다른 날짜로 바뀌면 플레이어 상태를 전부 비운다.
    setDayVodJump(null);
    setDayVodLive(new Set());
    dayVodApisRef.current.clear();
    dayVodAliveRef.current.clear();
    dayVodPausedRef.current.clear();
    dayVodPendingRef.current.clear();
  }, [dayVodPop]);
  useEffect(() => {
    if (!dayVodPop) return;
    // 임베드는 vod.sooplive.co.kr → vod.sooplive.com으로 넘어갈 수 있다 — 정확 일치 허용 목록.
    const SOOP_ORIGINS = new Set(["https://vod.sooplive.com", "https://vod.sooplive.co.kr"]);
    const onMsg = (e: MessageEvent) => {
      if (!SOOP_ORIGINS.has(e.origin) || !e.source) return;
      const data = e.data as { cmd?: unknown; id?: unknown; event?: { type?: unknown } } | null;
      if (!data || typeof data.cmd !== "string" || typeof data.id !== "string") return;
      const titleNo = Number(data.id);
      if (!Number.isFinite(titleNo) || titleNo <= 0) return;
      if (data.cmd === "PonReady") {
        const player = e.source as Window;
        const origin = e.origin;
        const post = (msg: Record<string, unknown>) => {
          try {
            player.postMessage(msg, origin);
          } catch {
            /* iframe이 이미 내려간 뒤의 지연 전송 — 조용히 무시 */
          }
        };
        dayVodApisRef.current.set(titleNo, post);
        // 로딩 중에 챕터를 먼저 눌렀다면 그 지점부터 재생 시도, 아니면 초기화만(자동재생 금지).
        const pending = dayVodPendingRef.current.get(titleNo);
        dayVodPendingRef.current.delete(titleNo);
        post(buildDayVodPload(titleNo, pending ?? 0, pending !== undefined));
      } else if (data.cmd === "PupdateMediaEvent") {
        // buffer/timeUpdate/play 무엇이든 = 미디어 엔진이 굴러갔다 → 이후 점프는 PseekTo로,
        // 지정 썸네일 커버도 이때 걷는다. (재생 전엔 아무 이벤트도 오지 않는다 — 실측.)
        dayVodAliveRef.current.add(titleNo);
        setDayVodLive((prev) => {
          if (prev.has(titleNo)) return prev;
          const next = new Set(prev);
          next.add(titleNo);
          return next;
        });
        // 일시정지 추적 — 정지 중 챕터 점프는 seek 후 지연 Pplay로 재개해야 해서(아래 참조).
        const evType = data.event?.type;
        if (evType === "pause") dayVodPausedRef.current.add(titleNo);
        else if (evType === "play" || evType === "timeUpdate") dayVodPausedRef.current.delete(titleNo);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [dayVodPop]);
  // 챕터 클릭의 단일 진입점 — iframe은 이미 떠 있으니 postMessage로만 움직인다
  // (리로드 없음 = 광고 재시작 없음, 소리 상태 유지).
  const jumpDayVod = (titleNo: number, sec: number) => {
    setDayVodJump({ titleNo, sec }); // ↗ 새 탭 링크의 초 표기 동기화
    const post = dayVodApisRef.current.get(titleNo);
    if (!post) {
      dayVodPendingRef.current.set(titleNo, sec); // 플레이어 로딩 중 — 준비되는 즉시 그 지점으로
      return;
    }
    if (dayVodAliveRef.current.has(titleNo)) {
      post({ cmd: "PseekTo", seconds: { time: sec, seekType: "timelink" } });
      // ⚠ Pplay를 seek 직후 연달아 보내면 진행 중인 시킹이 끊겨 0초로 리셋된다(실측 재현).
      // 재생 중엔 seek만으로 이어지므로 불필요하고, 정지 중일 때만 시킹이 자리잡은 뒤 재개한다.
      if (dayVodPausedRef.current.has(titleNo)) {
        window.setTimeout(() => post({ cmd: "Pplay" }), 1_200);
      }
    } else {
      post(buildDayVodPload(titleNo, sec, true));
    }
  };
  useEffect(() => {
    if (!dayVodPop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDayVodPop(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayVodPop]);
  // 창이 열려 있는 동안 바깥 달력 스크롤 잠금 — 창 안 목록을 굴리다 끝에 닿으면 달력이
  // 따라 흐르던 문제(사용자 지적). CSS overscroll-behavior와 이중 방어.
  useEffect(() => {
    if (!dayVodPop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dayVodPop]);
  // 히스토리 스택 — '이 달 기록' 시트와 같은 규약(아래 1619~ 참조): 열 때 pushState+
  // pushInnerOverlay(편집실 미리보기 조정), X/백드롭/Esc 닫기는 우리가 history.back()으로
  // 정리(메아리 pop 무시), 뒤로가기 닫기는 브라우저가 정리. popstate 처리는 한 곳(onPop).
  const dayVodDepthRef = useRef(0);
  const dayVodBackClosing = useRef(false);
  const ignoreDayVodPop = useRef(false);
  const dayVodOpenRef = useRef(false);
  dayVodOpenRef.current = dayVodPop !== null;
  useEffect(() => {
    const depth = dayVodPop ? 1 : 0;
    const prev = dayVodDepthRef.current;
    if (depth > prev) {
      window.history.pushState({ vicDayVod: true }, "");
      pushInnerOverlay();
    } else if (depth < prev) {
      if (dayVodBackClosing.current) {
        dayVodBackClosing.current = false;
        popInnerOverlay();
      } else {
        ignoreDayVodPop.current = true;
        window.history.back();
      }
    }
    dayVodDepthRef.current = depth;
  }, [dayVodPop]);
  // 창이 열린 채 포스터가 통째로 사라지면(미리보기 닫힘) 카운터를 반드시 내린다 — 인사이트와 동일.
  useEffect(
    () => () => {
      if (dayVodDepthRef.current > 0) {
        popInnerOverlay();
        dayVodDepthRef.current = 0;
      }
    },
    []
  );
  // 일정 상세 — 모바일 아젠다는 하단 시트, PC 달력은 카드 옆 앵커 팝오버(anchor 있으면 팝오버).
  // 공개 DTO(PublicScheduleEvent + 공개 태그)만 사용 — 비공개 필드 자체가 없다.
  const [agendaDetail, setAgendaDetail] = useState<{
    event: PublicScheduleEvent;
    support: boolean;
    dateKey: string;
    // PC: 클릭한 카드의 뷰포트 좌표(팝오버 앵커). 포스터는 transform 축소라 gBCR=화면 좌표 그대로.
    anchor?: { x: number; y: number; w: number; h: number };
  } | null>(null);
  useEffect(() => {
    if (!agendaDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgendaDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agendaDetail]);
  // 어떤 일정을 얼마나 열어 봤는지(0062). 여는 경로가 여러 곳(카드 탭·키보드·떡밥)이라 상태
  // 하나를 지켜본다 — 열림/닫힘이 항상 짝을 이룬다. 제목은 보내지 않는다(id만, 권한은 읽을 때).
  const detailEventId = agendaDetail?.event.id ?? null;
  const detailIsTeaser = Boolean(agendaDetail?.event.teaser);
  useEffect(() => {
    if (!detailEventId) return;
    const openedAt = Date.now();
    logActivity(detailIsTeaser ? "teaser.open" : "event.open", { target: detailEventId });
    return () => {
      logActivity("event.close", { target: detailEventId, durMs: Date.now() - openedAt });
    };
  }, [detailEventId, detailIsTeaser]);
  // ── PC 상세 팝오버 배치 — 편집실 편집 팝오버와 같은 문법: 카드 옆 자동 배치(오른쪽 우선/
  // 왼쪽 flip/화면 클램프), 카드→팝오버 리더 점선+도트, 헤더/그립을 잡아 드래그 이동.
  // 열려 있는 동안 rAF로 매 프레임 카드 위치를 실측(스크롤·리사이즈에 선·자동 배치가 따라온다).
  // 모두 뷰포트(fixed) 좌표 — 포스터 표면 transform 축소와 무관하게 gBCR 그대로 유효하다.
  const detailAnchorElRef = useRef<HTMLElement | null>(null);
  const detailSheetRef = useRef<HTMLDivElement | null>(null);
  // B1(시청자 모바일 시트, 2026-08-27): 손잡이·헤더를 잡고 끌어 닫기 — 편집실 모바일 편집 시트와 같은 훅
  // (1:1 추적·위로 러버밴딩·릴리스 속도 스프링·닫힘 임계 햅틱). PC 팝오버(anchor)는 이동 드래그가
  // 따로 있어 바인딩하지 않는다. 같은 요소에 ref 둘 → 콜백 ref로 합친다.
  const { sheetRef: detailDragSheetRef, dragBind: detailDragBind } = useSheetDragClose({
    onClose: () => setAgendaDetail(null)
  });
  // B2(시청자 모바일, 2026-08-27): 시트가 무관한 위치에서 올라오지 않고 **탭한 카드 자리에서 자라난다**
  // (matched geometry — 편집실 모바일 편집 시트와 같은 문법). 탭 순간의 카드 rect를 기억했다가 시트
  // 마운트 직후 FLIP으로 재생. 손잡이 탭·배경 탭 닫기는 정확한 역방향(카드 자리로 줄어듦), 드래그
  // 닫기는 물리 그대로 아래로(훅), Esc는 즉시. PC 팝오버(anchor)·동작 줄이기는 제외.
  const agendaDetailOriginRef = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!agendaDetail || agendaDetail.anchor) return;
    const el = detailSheetRef.current;
    const origin = agendaDetailOriginRef.current;
    if (!el || !origin || reduceMotionEnabled()) return;
    el.style.animation = "none"; // 기본 슬라이드업 대신 카드-morph
    el.style.transformOrigin = "top left";
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const spring = getComputedStyle(document.documentElement).getPropertyValue("--spring-smooth").trim();
    const frames: Keyframe[] = [
      {
        transform: `translate(${origin.left - r.left}px, ${origin.top - r.top}px) scale(${origin.width / r.width}, ${Math.max(0.04, origin.height / r.height)})`,
        borderRadius: "12px",
        opacity: 0.6
      },
      { transform: "none", borderRadius: "20px 20px 0 0", opacity: 1 }
    ];
    try {
      el.animate(frames, { duration: 440, easing: spring || "cubic-bezier(0.22, 0.61, 0.36, 1)" });
      // 내용은 컨테이너가 자리를 잡은 뒤 떠오른다(찌그러진 글자가 안 보이게).
      for (const child of Array.from(el.children) as HTMLElement[]) {
        child.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], { duration: 440, easing: "ease-out" });
      }
    } catch {
      /* WAAPI 미지원 — 즉시 등장, 기능 영향 없음 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaDetail?.event.id, agendaDetail?.anchor]);
  const closeAgendaDetailAnimated = () => {
    const el = detailSheetRef.current;
    const origin = agendaDetailOriginRef.current;
    if (!el || !origin || agendaDetail?.anchor || reduceMotionEnabled()) {
      setAgendaDetail(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      setAgendaDetail(null);
      return;
    }
    el.style.transformOrigin = "top left";
    let anim: Animation;
    try {
      anim = el.animate(
        [
          { transform: "none", borderRadius: "20px 20px 0 0", opacity: 1 },
          {
            transform: `translate(${origin.left - r.left}px, ${origin.top - r.top}px) scale(${origin.width / r.width}, ${Math.max(0.04, origin.height / r.height)})`,
            borderRadius: "12px",
            opacity: 0.3
          }
        ],
        { duration: 300, easing: "cubic-bezier(0.3, 0, 0.8, 0.15)", fill: "forwards" }
      );
    } catch {
      setAgendaDetail(null);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setAgendaDetail(null);
    };
    anim.onfinish = finish;
    anim.oncancel = finish;
    window.setTimeout(finish, 380); // 안전망
  };
  // 리더선은 '선 로컬 좌표계'로 그린다 — 바깥 <g>가 (앵커점 → 각도)로 옮겨 놓고, 안쪽은
  // x축 위의 수평선일 뿐이다. 그래야 점선 흐름을 stroke-dashoffset(매 프레임 SVG paint)
  // 대신 translateX(컴포지터)로 굴릴 수 있다. 드래그 중에는 x2/y2 대신 이 변환을 갱신한다.
  const detailLineGroupRef = useRef<SVGGElement | null>(null);
  const detailClipRectRef = useRef<SVGRectElement | null>(null);
  const [detailPos, setDetailPos] = useState<{ left: number; top: number } | null>(null);
  const [detailManual, setDetailManual] = useState<{ left: number; top: number } | null>(null);
  const [detailAnchorPt, setDetailAnchorPt] = useState<{ x: number; y: number } | null>(null);
  const [detailPopSize, setDetailPopSize] = useState<{ w: number; h: number } | null>(null);
  // 화면 밖에서 놓은 직후 스프링 복귀 중 — className은 React 소유라 상태로(classList는 리렌더에 지워짐).
  const [detailSnapback, setDetailSnapback] = useState(false);
  // 드래그 중 표시도 상태로 — classList로 붙이면 리렌더(카운트다운·하이프)에 지워진다.
  const [detailDragging, setDetailDragging] = useState(false);
  // 연속 튕김 보장 — 이전 해제 타이머가 새 스냅백 중 발화해 스프링을 끊지 않게 리셋.
  const detailSnapTimerRef = useRef<number | null>(null);
  const detailManualRef = useRef<typeof detailManual>(null);
  detailManualRef.current = detailManual;
  const detailAnchorPtRef = useRef<typeof detailAnchorPt>(null);
  detailAnchorPtRef.current = detailAnchorPt;
  const detailDragActiveRef = useRef(false);
  const hasDetailPop = Boolean(agendaDetail?.anchor);
  // PC 팝오버가 떠 있는 동안 달력은 그대로 살아 있다(배경 pointer-events:none) — 다른 일정을
  // 누르면 '한 번에' 그 일정의 상세로 교체된다. 바깥 닫기는 여기(문서 레벨)서: 시트 안도,
  // 새 상세로 교체될 일정 카드도 아닌 곳을 누르면 닫는다. 여는 클릭이 바로 닫지 않게 다음 틱부터.
  useEffect(() => {
    if (!hasDetailPop) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".agenda-detail-sheet")) return;
      if (t?.closest(".public-event.is-clickable")) return; // 카드 클릭 → 상세 교체가 처리
      if (t?.closest(".support-bar.is-clickable")) return; // 업도움 띠 클릭 → 상세 교체가 처리
      setAgendaDetail(null);
    };
    const id = window.setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [hasDetailPop]);
  const placeDetailPopover = useCallback(() => {
    const el = detailAnchorElRef.current;
    const sheet = detailSheetRef.current;
    if (!sheet) return;
    // 카드가 DOM에서 사라지면(월 이동 등) 상세도 닫는다 — 허공을 가리키는 선을 안 남긴다.
    if (!el || !el.isConnected) {
      setAgendaDetail(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const anchor = {
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + Math.min(r.height / 2, 26))
    };
    setDetailAnchorPt((p) => (p && p.x === anchor.x && p.y === anchor.y ? p : anchor));
    const size = { w: sheet.offsetWidth || 340, h: sheet.offsetHeight || 300 };
    setDetailPopSize((s) => (s && s.w === size.w && s.h === size.h ? s : size));
    if (detailManualRef.current || detailDragActiveRef.current) return;
    const PAD = 12;
    let left = r.right + 12;
    if (left + size.w > window.innerWidth - PAD) left = r.left - size.w - 12;
    left = Math.max(PAD, Math.min(left, window.innerWidth - size.w - PAD));
    const top = Math.max(PAD, Math.min(r.top - 6, window.innerHeight - size.h - PAD));
    const next = { left: Math.round(left), top: Math.round(top) };
    setDetailPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  }, []);
  useLayoutEffect(() => {
    if (!hasDetailPop) {
      setDetailPos(null);
      setDetailManual(null);
      setDetailAnchorPt(null);
      setDetailPopSize(null);
      return;
    }
    placeDetailPopover();
    let raf = 0;
    const tick = () => {
      placeDetailPopover();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasDetailPop, agendaDetail, placeDetailPopover]);
  // 헤더/그립 드래그 — 이동 중엔 DOM(style·선 좌표) 직접 갱신, 손 뗄 때만 상태 확정(부드러움).
  function onDetailDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const sheet = detailSheetRef.current;
    if (!sheet) return;
    e.preventDefault();
    // 창 밖에서 놓아도 pointerup을 받도록 캡처(유실되면 드래그 상태가 살아남아 파묻힌 채 고정).
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* 미지원 무시 — blur 안전망 */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const baseRect = sheet.getBoundingClientRect();
    const base = { left: baseRect.left, top: baseRect.top };
    let moved = false;
    let last = base;
    // 리렌더가 끼어들어도 선이 옛 자리로 돌아가지 않게, 이동 중에도 상태를 따라 올린다.
    // (이 팝오버는 떡밥 카운트다운·하이프가 초·100ms마다 리렌더를 일으킨다. 렌더는 선을
    //  detailManual/detailPos로 다시 그리므로, 상태가 그대로면 매 프레임 옛 좌표로 덮여
    //  '끌 때는 안 따라오고 놓으면 맞는' 증상이 된다 — 2026-08-04 실측.)
    // 프레임당 1회로 묶어 포인터 이벤트마다 렌더가 도는 건 막는다.
    let syncRaf = 0;
    const syncState = () => {
      if (syncRaf) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0;
        detailManualRef.current = last;
        setDetailManual(last);
      });
    };
    const onMove = (ev: PointerEvent) => {
      // up 유실 자가 치유 — 버튼이 안 눌린 move가 오면(창 밖 릴리즈 등) 즉시 종료 처리.
      if (ev.buttons === 0) {
        onUp();
        return;
      }
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!moved) {
        moved = true;
        detailDragActiveRef.current = true;
        setDetailDragging(true);
      }
      const w = sheet.offsetWidth;
      last = {
        left: Math.round(Math.max(140 - w, Math.min(base.left + dx, window.innerWidth - 140))),
        top: Math.round(Math.max(8, Math.min(base.top + dy, window.innerHeight - 48)))
      };
      sheet.style.left = `${last.left}px`;
      sheet.style.top = `${last.top}px`;
      const a = detailAnchorPtRef.current;
      if (a) {
        const edge = detailEdgePoint(last, { w, h: sheet.offsetHeight }, a);
        applyLeaderGeom(detailLineGroupRef.current, detailClipRectRef.current, a, edge);
      }
      syncState();
    };
    const onUp = () => {
      if (syncRaf) {
        cancelAnimationFrame(syncRaf);
        syncRaf = 0;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (moved) {
        hapticTick();
        // 화면 밖에서 놓으면 스프링으로 팅 튕겨 '전부 보이는' 자리로 복귀(편집실과 동일 문법).
        const w = sheet.offsetWidth;
        const h = sheet.offsetHeight;
        const snapped = {
          left: Math.round(Math.max(12, Math.min(last.left, window.innerWidth - w - 12))),
          top: Math.round(Math.max(12, Math.min(last.top, window.innerHeight - h - 12)))
        };
        if (snapped.left !== last.left || snapped.top !== last.top) {
          if (detailSnapTimerRef.current) window.clearTimeout(detailSnapTimerRef.current);
          setDetailSnapback(true);
          detailSnapTimerRef.current = window.setTimeout(() => setDetailSnapback(false), 650);
        }
        setDetailManual(snapped);
        detailManualRef.current = snapped;
        // DOM 직접 동기화 — 드래그 직접 쓰기와 React 가상 스타일 어긋남으로 새 상태가 이전
        // 상태와 같으면 React가 DOM을 안 고치는 함정 방지(편집실과 동일 수정).
        sheet.style.left = `${snapped.left}px`;
        sheet.style.top = `${snapped.top}px`;
        const a2 = detailAnchorPtRef.current;
        if (a2) {
          const e2 = detailEdgePoint(snapped, { w: sheet.offsetWidth, h: sheet.offsetHeight }, a2);
          applyLeaderGeom(detailLineGroupRef.current, detailClipRectRef.current, a2, e2);
        }
      }
      detailDragActiveRef.current = false;
      setDetailDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp); // 캡처 실패 환경 안전망
  }
  // 방금 공개된 떡밥 id — 잠깐 '짠!' 등장 애니메이션을 입힌다(보상감). 1.8초 뒤 해제.
  // celebrate: '카운트다운이 0이 되는 순간을 이 화면에서 지켜본' 경우에만 true —
  // 공개가 지난 뒤 새로고침으로 들어온 캐시-지연 교체(TeaserRevealing)는 조용히 갈아끼운다
  // (매 새로고침마다 팡 터지던 문제, 사용자 지적).
  const [justRevealed, setJustRevealed] = useState<Set<string>>(() => new Set());
  // 공개 순간 폭죽을 쏘려면 popBurst가 필요한데 정의가 아래쪽이라 ref로 잡아 쓴다
  // (revealTeaser는 deps [] 콜백 — 직접 참조하면 stale).
  const popBurstRef = useRef<
    ((x: number, y: number, mood: "win" | "cheer" | "console") => void) | null
  >(null);
  // 축하 연출의 주인은 '누가 공개를 호출했는지'가 아니라 '이 화면이 0초를 라이브로 봤는지'다.
  // 예전엔 호출자가 넘긴 celebrate 인자로 정했는데, 카운트다운이 0에 닿은 뒤 서버 응답이
  // 오기까지 그 사이에 부모가 한 번이라도 리렌더되면 카드가 조용한 교체 경로
  // (TeaserRevealing, celebrate=false)로 넘어가 축포가 통째로 사라졌다 — 첫 공개는 부모가
  // 조용해서 안 걸리고, 그 뒤부터는 상태가 늘어 리렌더 요인이 생겨 걸렸다(사용자 지적:
  // "처음만 된다"). 라이브로 봤다는 표시를 여기에 남기면 어느 경로가 이기든 결과가 같다.
  const liveWatchedRef = useRef<Set<string>>(new Set());
  // 이미 연출을 시작한 떡밥 — 2초 재시도가 축포를 두 번 쏘지 않게 한다(세션 동안 유지).
  const celebratedRef = useRef<Set<string>>(new Set());
  // 카운트다운이 화면에 뜬 순간 기록한다(0초가 아니라 마운트 시점). 0초에 기록하면,
  // 그 찰나에 부모가 리렌더돼 카드가 조용한 교체 경로로 넘어가면 기록 자체를 못 남긴다.
  const markTeaserWatched = useCallback((id: string) => {
    liveWatchedRef.current.add(id);
  }, []);
  const revealTeaser = useCallback((id: string, celebrate: boolean) => {
    if (celebrate) liveWatchedRef.current.add(id);
    revealTeaserAction([id])
      .then((result) => {
        const { events: list, goneIds } = reconcileTeaserReveal([id], result);
        // 진단(3일): 저장과 렌더 사이가 비어 있어 원인을 코드로만 찾을 수 있었다 — 그 구간을 남긴다.
        logActivity("diag.reveal", {
          target: id,
          meta: {
            asked: 1,
            got: list.length,
            gone: goneIds.length,
            revealed: list.filter((ev) => !ev.teaser).length,
            stillMasked: list.filter((ev) => ev.teaser).length
          }
        });
        // 서버가 '그런 일정 없다'고 확인 → 유령 카드를 걷어내고 재시도를 끝낸다.
        markTeaserGone(goneIds);
        if (list.length > 0) {
          // 서버는 '아직 미공개'인 것도 최신 stub으로 돌려준다(공개시각이 미래로 다시 잡힌 경우).
          // 그건 공개가 아니므로 축하 연출 대상에서 빼고, 상태만 갈아끼워 카운트다운으로 복귀시킨다.
          const ids = list.filter((ev) => !ev.teaser).map((ev) => ev.id);
          setRevealedEvents((prev) => {
            const next = { ...prev };
            for (const ev of list) next[ev.id] = ev;
            return next;
          });
          if (ids.length === 0) return;
          // 팝오버가 그 떡밥을 열고 있으면 닫지 않는다 — 그 자리에서 ???가 실제 일정으로
          // '변신'하는 게 훨씬 좋은 구경거리다(예전엔 닫아버려 클라이맥스를 놓쳤다).
          // 내용 교체는 렌더에서 revealedEvents로 자동 반영된다.
          // 라이브로 지켜본 것만 연출. 캐시-지연 교체(새로고침으로 들어온 경우)는 조용히.
          const targets = ids.filter(
            (x) => liveWatchedRef.current.has(x) && !celebratedRef.current.has(x)
          );
          if (targets.length === 0) return;
          for (const x of targets) celebratedRef.current.add(x);
          // 공개 순간 폭죽(월드컵 승리와 같은 큰 연출) — 카드에서 한 번, 팝오버가 열려 있으면
          // 거기서도 한 번 더. 다음 프레임에 실제 요소가 그려진 뒤 좌표를 잰다.
          window.setTimeout(() => {
            for (const id of targets) {
              const el = document.querySelector<HTMLElement>(`[data-eventid="${id}"]`);
              if (el) {
                const r = el.getBoundingClientRect();
                popBurstRef.current?.(r.left + r.width / 2, r.top + r.height / 2, "win");
              }
            }
            const sheet = document.querySelector<HTMLElement>(".agenda-detail-sheet.reveal-burst");
            if (sheet) {
              const r = sheet.getBoundingClientRect();
              popBurstRef.current?.(r.left + r.width / 2, r.top + r.height / 2, "win");
            }
          }, 90);
          // 연출 유지 시간은 스크램블 해독이 끝날 때까지(제목이 길면 더 오래) — 예전엔 연출이
          // 중간에 잘려 글자 난동을 끝까지 못 봤다. 타이머 예약은 상태 갱신 함수 밖에서 한다
          // (updater는 순수해야 하고, StrictMode에서 두 번 불려 중복 예약될 수 있다).
          const holdMs = Math.max(
            2400,
            ...list
              .filter((ev) => targets.includes(ev.id))
              .map((ev) => scrambleDurationMs(ev.publicTitle || ""))
          );
          setJustRevealed((prev) => {
            const next = new Set(prev);
            for (const x of targets) next.add(x);
            return next;
          });
          window.setTimeout(() => {
            setJustRevealed((cur) => {
              const n = new Set(cur);
              for (const x of targets) n.delete(x);
              return n;
            });
          }, holdMs);
        }
      })
      .catch(() => {});
    // 이제 상태를 직접 읽지 않는다(전부 ref·함수형 갱신) → 콜백 정체성이 안정적이다.
    // markTeaserGone도 useCallback([])이라 정체성이 고정 — 2초 재시도가 재설치되지 않는다.
  }, [markTeaserGone]);
  const serverHearts = Boolean(toggleHeartAction);
  // 비로그인 하트용 기기 토큰(로그인 시엔 빈 값, 계정 기준으로 동작). 마운트 후 채워진다.
  const [deviceToken, setDeviceToken] = useState("");
  // 하트 세션 델타의 소유 — 로그인은 이메일, 비로그인은 기기 토큰. 계정/기기 바뀌면 델타 안 섞임.
  const heartOwner = accountEmail ?? (deviceToken || "anon");
  const [bookmarks, setBookmarks] = useState<string[]>(() =>
    serverHearts ? (schedule.myHeartIds ?? []) : []
  );
  // A: 일정별 관심 집계 수(서버에서 받아 낙관적으로 갱신). "관심 높음" 배지 판정에 쓴다.
  const [heartCounts, setHeartCounts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const event of schedule.events) {
      if (typeof event.heartCount === "number") {
        map[event.id] = event.heartCount;
      }
    }
    return map;
  });
  // 최초공개 '기대돼요' — 로그인 여부와 무관하게 기기 토큰 1기기 1표(익명 하트 토큰 재사용).
  // 서버 집계가 정본이고 여기엔 낙관적 오버라이드만 둔다(없으면 이벤트의 hopeCount).
  const [hopeCounts, setHopeCounts] = useState<Record<string, number>>({});
  const [myHopeIds, setMyHopeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!interactive) return;
    if (!schedule.events.some((e) => e.teaser)) return; // 떡밥이 없으면 복원 왕복 생략
    const token = getOrCreateDeviceToken();
    if (!token) return;
    let alive = true;
    getTeaserHopeIdsAction(token)
      .then((ids) => {
        if (alive) setMyHopeIds(new Set(ids));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 열려 있는 상세가 '아직 안 풀린 떡밥'이면 남은 초를 매초 센다 — 팝오버도 카드와 같은
  // 하이프 리듬을 타게 하려는 용도(카운트다운 숫자는 카드가 담당, 여긴 분위기만).
  const detailRevealAt =
    agendaDetail?.event.teaser && agendaDetail.event.teaserRevealAt
      ? agendaDetail.event.teaserRevealAt
      : null;
  // 숫자(1Hz)와 시각 채널(10Hz)을 분리. 숫자는 카드와 '같은 공용 시계'를 써서 초 경계에
  // 함께 넘어간다 — 각자 interval을 돌리면 마운트 시각 차이만큼 어긋난다(사용자 지적).
  const detailRemainS = useRemainSeconds(
    detailRevealAt ? Date.parse(detailRevealAt) : null
  );
  useEffect(() => {
    if (!detailRevealAt) return;
    const staticOnly =
      typeof document !== "undefined" &&
      document.documentElement.hasAttribute("data-reduce-motion");
    const target = Date.parse(detailRevealAt);
    let raf = 0;
    const write = () => {
      const el = detailSheetRef.current;
      if (!el) return;
      const remainMs = target - Date.now();
      const raw = hypeIntensity(remainMs);
      const i = staticOnly ? quantizeStaticIntensity(raw) : raw;
      // 폭풍의 눈 — 정적 모드에선 0/1로 양자화해 캡처가 결정적이게 한다.
      const rawCalm = hypeCalm(remainMs);
      const calm = staticOnly ? (rawCalm > 0.5 ? 1 : 0) : rawCalm;
      // 등장 — 하이프 창(60초) 바깥에서도 써야 하므로 강도와 별개로 계산한다.
      const rawEmerge = hypeEmerge(remainMs);
      const rawFinale = hypeFinale(remainMs);
      const emerge = staticOnly ? (rawEmerge > 0.5 ? 1 : 0) : rawEmerge;
      const finale = staticOnly ? quantizeStaticIntensity(rawFinale) : rawFinale;
      const vars = {
        ...hypeCssVars(hypeChannels(i, calm)),
        ...hypeMotionCssVars(staticOnly ? STATIC_MOTION_FRAME : hypeMotionFrame(remainMs, i)),
        "--hy-emerge": emerge.toFixed(3),
        "--hy-final": finale.toFixed(3)
      };
      for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
      el.classList.toggle("hype-live", raw > 0);
      // 리더선(팝오버 밖 SVG)도 같은 값을 받는다 — 선만 멈춰 있으면 끊겨 보인다.
      const link = document.querySelector<SVGElement>(".detail-anchor-link");
      if (link) {
        for (const [k, v] of Object.entries(vars)) link.style.setProperty(k, v);
        link.classList.toggle("hype-live", raw > 0);
      }
    };
    const tick = () => {
      if (document.hidden) return;
      if (staticOnly) {
        write();
        return;
      }
      raf = window.requestAnimationFrame(write);
    };
    tick();
    const id = window.setInterval(tick, staticOnly ? 1000 : 100);
    return () => {
      window.clearInterval(id);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [detailRevealAt]);
  const hopeCountOf = (ev: PublicScheduleEvent): number =>
    hopeCounts[ev.id] ?? ev.hopeCount ?? 0;
  function toggleHope(ev: PublicScheduleEvent) {
    const token = getOrCreateDeviceToken();
    if (!token) return; // 사생활 모드 등 — 조용히 무시(집계 신호일 뿐)
    hapticTick(); // ① 눌림
    const on = myHopeIds.has(ev.id);
    const before = hopeCountOf(ev);
    setMyHopeIds((prev) => {
      const next = new Set(prev);
      if (on) next.delete(ev.id);
      else next.add(ev.id);
      return next;
    });
    setHopeCounts((prev) => ({ ...prev, [ev.id]: Math.max(0, before + (on ? -1 : 1)) }));
    void toggleTeaserHopeAction(ev.id, token).then((res) => {
      if (res.ok) {
        hapticTick(); // ② 서버 확정
        setHopeCounts((prev) => ({ ...prev, [ev.id]: res.count }));
      } else {
        // 실패 → 되돌림(공개가 막 지난 경우 등 — 서버가 거절).
        setMyHopeIds((prev) => {
          const next = new Set(prev);
          if (on) next.add(ev.id);
          else next.delete(ev.id);
          return next;
        });
        setHopeCounts((prev) => ({ ...prev, [ev.id]: before }));
      }
    });
  }
  // 하트 서버 반영을 '일정별 직렬 큐'로 — 빠르게 껐다 켜도 서버가 클릭 순서대로 처리하고(토글
  // RPC라 순서가 곧 결과), 가장 마지막 응답만 집계에 반영해 옛 응답이 방금 켠 배지를 덮지 않게 한다.
  // done=false인 동안(서버 응답 대기)은 새 schedule prop이 와도 그 일정의 집계·내 하트를 덮지 않는다.
  const heartOpRef = useRef<Map<string, { chain: Promise<void>; seq: number; done: boolean }>>(
    new Map()
  );
  // 하트를 누를 때 화면에 떠오르는 ♥ 입자들(틱톡식 좋아요 연출). 잠깐 떴다 사라진다.
  const [floaters, setFloaters] = useState<HeartFloater[]>([]);
  // 특별한 날(공휴일·기념일·월드컵·한국 승) 탭 시 그 자리에서 터지는 점(point) 폭죽들.
  const [bursts, setBursts] = useState<
    { id: number; x: number; y: number; big: boolean; bits: BurstBit[] }[]
  >([]);
  const burstId = useRef(0);
  // 시청자 상호작용(필터·북마크) 가능 모드 — 꾸미기 중에는 끈다(스티커 조작과 충돌·포스터 청결).
  const interactive = true;
  // 업도움 띠 그룹 호버 — 띠는 칸마다 별도 조각이라 CSS :hover만으로는 한 조각만 밝아져
  // 마디가 다시 보인다. 같은 일정의 모든 조각이 함께 반응하게 호버 중인 띠 id를 들고 있는다.
  const [hoverSupportId, setHoverSupportId] = useState<string | null>(null);
  // 하트(관심)는 로그인 시청자만 — 익명 시청자에겐 ♥ 토글/모아보기를 숨긴다(서버 1인1하트 불가).
  // 색상 필터 등 다른 상호작용은 익명에게도 그대로 둔다.
  // 하트 가능 = 상호작용 화면이고 하트 액션이 연결돼 있으면(로그인이든 비로그인이든). 비로그인도
  // 기기 토큰으로 누를 수 있게 해 로그인 장벽을 없앤다(참여 ↑). 토큰은 마운트 효과를 기다리지 않고
  // 토글 시점에 즉석 확보한다 — 토큰 준비 여부로 UI를 가르면 비로그인 첫 페인트에서 하트/관심
  // UI가 통째로 빠져 로그인 화면과 레이아웃이 달라진다(사생활 모드 실패는 토글 때 토스트로 안내).
  const canHeart = interactive && serverHearts;

  // '이 달 기록' 시트도 같은 방식으로 히스토리 한 칸을 쌓는다 — 폰에서 뒤로가기를 누르면 시트만
  // 닫혀야 하는데, 안 쌓아두면 페이지를 통째로 떠나(이전 화면으로) 버린다.
  const insightsDepthRef = useRef(0);
  const ignoreInsightsPop = useRef(false);
  const insightsBackClosing = useRef(false);
  const insightsOpenRef = useRef(insightsOpen);
  insightsOpenRef.current = insightsOpen;
  useEffect(() => {
    const depth = insightsOpen ? 1 : 0;
    const prev = insightsDepthRef.current;
    if (depth > prev) {
      window.history.pushState({ vicInsights: true }, "");
      // 이 포스터가 편집실의 '시청자 미리보기' 안에 있을 수도 있다. 편집실도 자기 오버레이용으로
      // popstate를 듣기 때문에, 우리 칸이 남아 있는 동안엔 손대지 말라고 알린다.
      pushInnerOverlay();
    } else if (depth < prev) {
      if (insightsBackClosing.current) {
        insightsBackClosing.current = false; // 뒤로가기로 닫힘 → 브라우저가 이미 정리함
        popInnerOverlay(); // 우리 칸이 사라졌다 → 다음 뒤로가기는 바깥(편집실) 차례
      } else {
        // X/백드롭으로 닫힘 → 쌓은 항목을 우리가 정리한다(그 popstate는 아래에서 무시).
        // 주의: 카운터는 **그 메아리 pop을 삼킨 뒤에** 내린다. 여기서 먼저 내리면 편집실이
        // "안쪽 오버레이 없음"으로 보고 이 메아리를 진짜 뒤로가기로 처리해 미리보기까지 닫는다.
        ignoreInsightsPop.current = true;
        window.history.back();
      }
    }
    insightsDepthRef.current = depth;
  }, [insightsOpen]);
  // 시트가 열린 채 이 포스터가 통째로 사라지는 경우(예: 편집실이 미리보기를 닫음) 카운터가 1로
  // 남으면 편집실의 뒤로가기가 영영 막힌다 → 언마운트 때 반드시 내린다.
  useEffect(
    () => () => {
      if (insightsDepthRef.current > 0) {
        popInnerOverlay();
        insightsDepthRef.current = 0;
      }
    },
    []
  );
  // popstate 처리는 **한 곳**에서 — 미리보기와 시트가 각자 리스너를 달면 뒤로가기 한 번에 둘 다
  // 닫힌다. 위에 뜬 것부터(시트 → 미리보기) 하나씩 닫는다.
  // (편집실 안에서 열렸을 때의 조정은 위 pushInnerOverlay/popInnerOverlay가 맡는다.)
  useEffect(() => {
    function onPop() {
      // 날짜 다시보기 창의 메아리(X/백드롭 닫기 후 우리가 부른 history.back()) — 무시하고
      // 카운터만 디스패치 뒤에 내린다(인사이트와 같은 microtask 이유).
      if (ignoreDayVodPop.current) {
        ignoreDayVodPop.current = false;
        queueMicrotask(popInnerOverlay);
        return;
      }
      if (ignoreInsightsPop.current) {
        // 우리가 시트를 닫으며 부른 history.back()의 메아리 — 이제야 카운터를 내린다(위 주석 참고).
        // 단, 카운터 내림은 이 popstate '한 번의 동기 디스패치'가 끝난 뒤로 미룬다(microtask).
        // 편집실(바깥) 리스너와 이 리스너 중 누가 먼저 불릴지는 마운트 타이밍에 따라 뒤집힌다
        // (미리보기 안에서 이 포스터는 새로 마운트된 자식이라 바깥보다 먼저 불리는 경우가 있다).
        // 여기서 동기적으로 내리면, 이 디스패치에서 바깥이 뒤늦게 hasInnerOverlay()를 봤을 때
        // 이미 0이라 '이 pop은 내 것'이라 오인해 미리보기까지 닫아 편집실로 튕긴다(실측 증상).
        // 디스패치가 끝난 뒤 내리면 순서와 무관하게 바깥은 이번 pop을 안쪽 것으로 본다.
        ignoreInsightsPop.current = false;
        queueMicrotask(popInnerOverlay);
        return;
      }
      // 위에 뜬 것부터: 날짜 다시보기 창(백드롭이 다른 조작을 막아 인사이트와 동시에 못 뜬다).
      if (dayVodOpenRef.current) {
        dayVodBackClosing.current = true;
        setDayVodPop(null);
        return;
      }
      if (insightsOpenRef.current) {
        insightsBackClosing.current = true;
        setInsightsOpen(false);
        return;
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // 좁은 화면(모바일 + 태블릿/좁은 창 ≤1040px) 시청자는 세로 아젠다(목록) 전용 — 월간 그리드/캡쳐는
  // PC로 유도. 표면은 1840 고정 캔버스라 좁을수록 통째로 축소돼(900px면 0.49배 → 본문 6px) 읽을 수
  // 없다. 표면 내부를 화면 폭에 맞춰 재배치하는 건 금지(스티커 좌표가 어긋남 — ADR-0004)라, 대신
  // 읽히는 목록으로 보낸다. (꾸미기 모드엔 적용 안 함: 편집은 시청자와 같은 표면 기하 위에서.)
  const [isNarrow, setIsNarrow] = useState(initialNarrow);
  useEffect(() => {
    const mq = window.matchMedia(POSTER_AGENDA_QUERY);
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const showAgenda = isNarrow;

  // 포스터(시청자/꾸미기/export 표면)는 화면마다 reflow되면 안 된다 — 소유자가 찍은
  // 스티커·텍스트 위치가 틀어지고 글자가 가려질 수 있다. 그래서 내부는 고정 16:9 캔버스
  // (POSTER_DESIGN_W×H)로 설계하고, 화면 폭에 맞춰 통째로 축소(transform: scale)만 한다.
  // export는 변형 없는 .poster-surface를 원본 해상도로 캡쳐하므로 화질에 영향 없다.
  // 태그 필터 카드가 세로 스크롤을 따라온다 — 표면이 transform: scale 안이라 position:sticky가
  // 뷰포트에 안 붙는다(변환 조상이 containing block). 대신 rAF로 스크롤만큼 translateY(레일
  // 남은 높이로 클램프). transform이라 레이아웃·표면 기하 불변(스티커 안전). 시청자 전용.
  const legendFollowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (showAgenda) return;
    const el = legendFollowRef.current;
    if (!el) return;
    let raf = 0;
    let cur = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const parent = el.parentElement; // .public-right
      if (!parent || !el.offsetWidth) return;
      const rect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const scale = rect.width / el.offsetWidth || 1; // 포스터 배율(transform 포함 실측)
      const baseTopV = rect.top - cur * scale; // 변환 전(원래 자리) 뷰포트 top
      const baseBottomV = rect.bottom - cur * scale;
      const wantV = Math.max(0, 14 - baseTopV); // 화면 위로 사라진 만큼 따라 내려온다
      // 레일(.public-right) 바닥을 넘지 않게 — 남은 아래 공간(뷰포트 px)을 로컬로 환산해 클램프.
      const maxLocal = Math.max(0, (parentRect.bottom - baseBottomV) / scale - 4);
      const next = Math.min(wantV / scale, maxLocal);
      if (Math.abs(next - cur) > 0.5) {
        cur = next;
        el.style.transform = next > 0 ? `translateY(${next}px)` : "";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [showAgenda]);

  const posterStageRef = useRef<HTMLDivElement | null>(null);
  const posterFitRef = useRef<HTMLDivElement | null>(null);
  const posterScalerRef = useRef<HTMLDivElement | null>(null);
  const [posterScale, setPosterScale] = useState(1);
  // 표면(달력)이 일정 양에 따라 세로로 자라므로, 축소 전 '자연 높이'를 재서 stage 높이/배율 계산에 쓴다.
  const [posterNaturalH, setPosterNaturalH] = useState(POSTER_DESIGN_H);
  // (아바타 scene '높이 fit'은 2026-08-27 당일 철회 — 8월처럼 6주·고밀도 달에서 배율이 0.6까지
  //  떨어져 방송 화면 글씨가 너무 작아졌다. scene도 평소처럼 '폭 기준' fit만 한다.)
  useEffect(() => {
    if (showAgenda) {
      return; // 모바일 아젠다(목록)는 고정 캔버스를 쓰지 않는다.
    }
    const scaler = posterScalerRef.current;
    const stage = posterStageRef.current;
    if (!scaler || !stage) {
      return;
    }
    // 표면이 일정 양에 따라 세로로 자란다. '폭'에만 맞춰 축소하고(글자 크기 유지), 화면보다 길면
    // 페이지를 세로 스크롤한다 — 일정이 많아도 작아지지 않고 그대로 보고 내려서 본다. 자연 크기는
    // transform에 영향 없는 offset*로 재 배율 바꿔도 피드백이 없다(폭만 보므로 더더욱).
    // 큰 화면에서 1배 캡 때문에 좌우가 텅 비던 낭비 제거(2026-07-31 사용자 요청) — 공개
    // 시청자도 1.6배까지 화면 폭에 맞춰 키운다. 확대는 transform scale 통째라 표면 내부
    // 기하·스티커 좌표는 불변(ADR-0004 안전). 폭 기준 fit이라 가로 넘침은 없다.
    const maxScale = 1.6;
    const measure = () => {
      const natW = scaler.offsetWidth || POSTER_DESIGN_W;
      const natH = scaler.offsetHeight || POSTER_DESIGN_H;
      const w = stage.clientWidth;
      if (w <= 0) {
        return;
      }
      const next = Math.max(0.12, Math.min(maxScale, w / natW));
      // 값이 그대로면 set을 부르지 않는다 — ResizeObserver는 창을 끄는 동안 프레임마다 불리는데,
      // 그때마다 포스터 트리 전체(달력 42칸)를 다시 그릴 이유가 없다.
      setPosterScale((prev) => (Math.abs(prev - next) < 0.0005 ? prev : next));
      setPosterNaturalH((prev) => (Math.abs(prev - natH) < 0.5 ? prev : natH));
    };
    measure();
    // 창 크기 조절 중엔 콜백이 프레임보다 자주 올 수 있다. 프레임당 한 번으로 모아서 잰다
    // (읽기=layout flush + 두 번의 setState가 한 프레임에 여러 번 겹치던 것을 없앤다).
    let raf = 0;
    const onResize = () => {
      if (raf) {
        return;
      }
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(scaler); // 달 변경 등으로 자연 높이가 바뀌면 stage 높이 갱신
    ro.observe(stage); // 뷰포트 폭 변하면 배율 갱신
    return () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
      ro.disconnect();
    };
  }, [showAgenda, avatarSlot]);




  // 하트 상태 = 서버 myHeartIds(진실) + 이번 세션 델타. 시청자 미리보기를 닫았다 열면 컴포넌트가
  // 리마운트되며 bookmarks가 schedule.myHeartIds(페이지 로드 스냅샷)로 초기화되는데, 그러면 이 세션에
  // 누른/뺀 하트가 사라져 보였다. 세션 델타(sessionStorage)를 신선한 서버값에 덮어 적용해 그 변경을
  // 보존한다. 손대지 않은 일정엔 절대 가짜 하트가 안 생긴다 → 서버와 desync 없이 정확.
  useEffect(() => {
    // 과거 전역·영구 북마크 캐시는 서버를 덮어써 desync를 냈다 — 발견 즉시 청소한다.
    try {
      window.localStorage.removeItem(LEGACY_BOOKMARK_KEY);
    } catch {
      // 무시.
    }
    let alive = true;
    // 비로그인(anonymous)이면 기기 토큰을 만들고, 서버에서 이 기기가 누른 하트 id를 받아 복원한다.
    // 로그인(시청자/스튜디오 미리보기)이면 서버 렌더된 myHeartIds(계정 기준)를 그대로 쓴다.
    const isAnon = anonymous;
    const token = isAnon ? getOrCreateDeviceToken() : "";
    if (token) setDeviceToken(token);
    const owner = accountEmail ?? (token || "anon");

    const apply = (serverIds: string[]) => {
      if (!alive) return;
      const delta = loadHeartDelta(owner);
      const set = new Set(serverIds);
      for (const id of delta.off) set.delete(id);
      for (const id of delta.on) set.add(id);
      setBookmarks([...set]);
    };

    if (serverHearts && isAnon && token) {
      getAnonHeartIdsAction(token)
        .then((ids) => apply(ids))
        .catch(() => apply([]));
    } else {
      apply(serverHearts ? (schedule.myHeartIds ?? []) : []);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마운트 뒤 schedule prop이 바뀌면(편집실 미리보기의 신선한 스냅샷 도착·router.refresh·계정 전환
  // 후 재렌더) 하트 집계와 내 하트를 서버값으로 다시 맞춘다. 예전엔 둘 다 마운트 시점 useState
  // 초기값에 갇혀 있어, 미리보기가 새 스냅샷을 받아도 페이지 로드 때 수가 그대로 보였다.
  // 규칙: 서버 응답을 기다리는 일정(heartOpRef done=false)은 건드리지 않는다 — 낙관적 상태가
  // 진실이고, 그 서버 응답이 곧 권위값을 준다. 세션 델타는 내 하트 목록에 그대로 덮는다.
  const scheduleHeartSyncRef = useRef(schedule);
  useEffect(() => {
    if (scheduleHeartSyncRef.current === schedule) return; // 첫 마운트는 위 효과가 담당
    scheduleHeartSyncRef.current = schedule;
    const inFlight = (id: string) => {
      const op = heartOpRef.current.get(id);
      return Boolean(op && !op.done);
    };
    setHeartCounts((prev) => {
      const next = { ...prev };
      for (const event of schedule.events) {
        if (typeof event.heartCount !== "number" || inFlight(event.id)) continue;
        next[event.id] = event.heartCount;
      }
      return next;
    });
    // 내 하트: 로그인 사용자만 서버(myHeartIds)가 계정 기준 진실을 준다. 비로그인은 서버 렌더에
    // 내 목록이 없으니(기기 토큰은 클라만 안다) 마운트 때 받은 목록을 그대로 둔다.
    if (!serverHearts || anonymous) return;
    const delta = loadHeartDelta(heartOwner);
    const set = new Set(schedule.myHeartIds ?? []);
    for (const id of delta.off) set.delete(id);
    for (const id of delta.on) set.add(id);
    setBookmarks((prev) => {
      // 응답 대기 중인 일정은 낙관적 값을 유지한다.
      for (const id of prev) if (inFlight(id)) set.add(id);
      for (const id of set) if (inFlight(id) && !prev.includes(id)) set.delete(id);
      const next = [...set];
      if (next.length === prev.length && next.every((id) => prev.includes(id))) return prev;
      return next;
    });
  }, [schedule, serverHearts, anonymous, heartOwner]);

  // 하트를 켤 때 누른 자리에서 ♥들이 스멀스멀 떠오르게 한다(움직임 최소화 설정이면 생략).
  function spawnHearts(x: number, y: number) {
    if (reduceMotionEnabled()) {
      return;
    }
    const batch: HeartFloater[] = Array.from({ length: 6 }, (_, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      dx: Math.round((Math.random() - 0.5) * 64),
      dur: 1100 + Math.round(Math.random() * 800),
      size: 12 + Math.round(Math.random() * 14),
      delay: Math.round(Math.random() * 220)
    }));
    setFloaters((prev) => [...prev, ...batch]);
    const ids = new Set(batch.map((b) => b.id));
    // 가장 긴 입자(지연+지속)보다 넉넉히 뒤에 정리한다.
    window.setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => !ids.has(f.id)));
    }, 2300);
  }

  // 특별한 날(공휴일·기념일·절기·월드컵)을 탭하면 그 자리에서 색종이가 '팡' 터진다(빵빠레).
  // 한국 승리한 날은 큰 폭죽(🏆 솟구침 + 더 많은 입자 + 강한 햅틱), 그 외 특별일은 작은 폭죽.
  // 위 todayCelebration(상단 비처럼 내리는 컨페티)과 달리 탭 '지점'에서 방사형으로 터진다.
  // '동작 줄이기'면 입자 없이 햅틱만(다른 모션 연출과 동일 방침). 다중 탭은 쌓여서 각자 정리된다.
  // 표기 탭 반응. mood: "win" 큰 축포 / "cheer" 작은 폭죽(기본) / "console" 진 날엔
  // 축하 대신 차분히 아래로 떨어지는 응원(💪🙏🥲) — 패배에 폭죽은 결이 안 맞아서.
  function popBurst(clientX: number, clientY: number, mood: "win" | "cheer" | "console") {
    if (mood === "win") hapticSuccess();
    else hapticTick();
    if (reduceMotionEnabled()) return;
    const big = mood === "win";
    const console_ = mood === "console";
    const n = big ? 30 : console_ ? 12 : 16;
    const palette = console_
      ? ["#94a3b8", "#a5b4fc", "#cbd5e1", "#bae6fd", "#ddd6fe"] // 차분한 회청색
      : ["#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f87171", "#ffffff"];
    const cheer = big ? ["🎉", "✨", "🎊", "⚽", "🏆"] : console_ ? ["💪", "🙏", "🥲", "❤️"] : ["✨", "🎉"];
    const bits: BurstBit[] = Array.from({ length: n }, (_, i) => {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5; // 고르게 퍼지되 약간 흩뜨림
      const reach = (big ? 78 : console_ ? 30 : 48) + Math.random() * (big ? 96 : console_ ? 36 : 56);
      const useEmoji = Math.random() < (big ? 0.34 : console_ ? 0.5 : 0.22);
      return {
        dx: Math.cos(ang) * reach * (console_ ? 0.6 : 1), // 진 날은 옆으로 덜 퍼지고
        dy: console_
          ? Math.abs(Math.sin(ang)) * reach + 18 // 아래로 차분히 떨어진다(솟구침 없음)
          : Math.sin(ang) * reach - (big ? 24 : 14), // 살짝 위로 솟구쳤다 흩어짐
        rot: Math.round((Math.random() * 2 - 1) * (console_ ? 180 : 540)),
        color: palette[i % palette.length],
        emoji: useEmoji ? cheer[(Math.random() * cheer.length) | 0] : null,
        dur: (big ? 900 : console_ ? 1000 : 760) + Math.round(Math.random() * 520)
      };
    });
    burstId.current += 1;
    const id = burstId.current;
    setBursts((prev) => [...prev, { id, x: clientX, y: clientY, big, bits }]);
    window.setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1700);
  }
  // 떡밥 공개 순간에도 이 폭죽을 쏜다(revealTeaser는 deps [] 콜백이라 ref로 건넨다).
  popBurstRef.current = popBurst;

  // 관심 토글 — 낙관적으로 즉시 반영하고, 서버 모드면 호출 후 집계 수를 권위값으로 보정한다.
  function toggleBookmark(id: string, ev?: ReactMouseEvent<HTMLButtonElement>) {
    const wasOn = bookmarks.includes(id);
    hapticTick(); // 가벼운 톡(Android만; iOS·미지원은 조용히 무시)
    if (!wasOn && ev) {
      // 이벤트 풀링 영향을 피하려 좌표를 동기적으로 먼저 읽는다.
      const rect = ev.currentTarget.getBoundingClientRect();
      spawnHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    // '내 하트가 이 일정의 등급을 올린 순간'만 알려준다 — 집계가 조용히 바뀌면 내가 뭘 했는지
    // 아무도 모른다. 남의 하트가 revalidation으로 들어올 땐 절대 안 뜬다(이 토글 경로에서만 계산).
    if (!wasOn) {
      const cur = heartCounts[id] ?? 0;
      const before = heartTier(cur, topEventIds.has(id), maxHeart);
      const after = heartTier(cur + 1, cur + 1 >= maxHeart, Math.max(maxHeart, cur + 1));
      if (after && after.key !== before?.key) {
        const title = liveEvents.find((e) => e.id === id)?.publicTitle ?? "이 일정";
        setHeartToast(
          after.key === "top"
            ? `👑 당신의 하트로 "${trimTitle(title)}"이(가) 이 달 1위!`
            : `${after.flames} 당신의 하트로 "${trimTitle(title)}"이(가) ${after.label}이 됐어요!`
        );
        hapticSuccess();
        if (heartToastTimerRef.current) {
          window.clearTimeout(heartToastTimerRef.current);
        }
        heartToastTimerRef.current = window.setTimeout(() => setHeartToast(null), 2600);
      }
    }
    setBookmarks((prev) => (wasOn ? prev.filter((x) => x !== id) : [...prev, id]));
    setHeartCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + (wasOn ? -1 : 1))
    }));
    // 이번 세션 의도를 델타에 기록(미리보기 재마운트에도 유지). 서버 실패 시 되돌린다.
    recordHeartDelta(heartOwner, id, !wasOn);
    if (!toggleHeartAction) {
      return; // 서버 액션 없음(샘플/오프라인): 개인 표시만, 집계 없음.
    }
    // 직렬 큐: 이 일정의 이전 토글이 끝난 뒤에 보낸다(순서 = 결과). 응답은 '가장 마지막' 토글만
    // 집계에 반영 → 빠른 껐다 켬에도 옛(취소) 응답이 방금 켠 하트/배지를 덮지 않는다(새로고침 불필요).
    const prevOp = heartOpRef.current.get(id);
    const seq = (prevOp?.seq ?? 0) + 1;
    const chain = (prevOp?.chain ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        // 서버 액션은 두 가지로 실패한다: ① {ok:false} 응답 ② throw(네트워크 끊김·배포 중 등).
        // 예전엔 ①만 봐서, 정작 흔한 ②에선 낙관적 하트가 켜진 채 굳고 아무 말도 없었다
        // (되돌리기 자체가 안 돌았다). 둘을 한 자리에서 같게 처리한다.
        let ok = false;
        let count: number | null = null;
        try {
          // 비로그인인데 아직 토큰이 없으면(마운트 효과 전 첫 클릭) 여기서 즉석 생성한다.
          // 생성 실패(사생활 모드)면 빈 값으로 보내져 서버가 거절 → 아래 롤백+토스트 경로.
          let token = deviceToken;
          if (anonymous && token.length < 8) {
            token = getOrCreateDeviceToken();
            if (token) setDeviceToken(token);
          }
          const result = await toggleHeartAction(id, token);
          ok = result.ok;
          if (result.ok) count = result.count;
        } catch {
          ok = false;
        }
        const cur = heartOpRef.current.get(id);
        const isLatest = cur?.seq === seq;
        if (isLatest && cur) cur.done = true;
        if (!isLatest) {
          return; // 더 최신 토글이 이미 진행 중 — 옛 응답으로 화면을 건드리지 않는다.
        }
        if (ok) {
          if (count !== null) setHeartCounts((prev) => ({ ...prev, [id]: count }));
          // 2단계 컨벤션의 두 번째 박자 — "서버에 반영됐다"(lib/ui/haptics.ts). 누름(위 hapticTick)과
          // 이 톡 사이의 간격이 곧 실제 왕복이라 체감이 정직하다. 앱에서 제일 많이 눌리는 컨트롤인데
          // 여기만 컨벤션에서 빠져 있었다.
          hapticTick();
          return;
        }
        // 실패 → 낙관적 변경·델타를 되돌린다(서버와 어긋난 채 남지 않게).
        setBookmarks((prev) => (wasOn ? [...prev, id] : prev.filter((x) => x !== id)));
        setHeartCounts((prev) => ({
          ...prev,
          [id]: Math.max(0, (prev[id] ?? 0) + (wasOn ? 1 : -1))
        }));
        recordHeartDelta(heartOwner, id, wasOn);
        // 되돌리기만 하고 아무 말도 안 하면 "♥가 켜졌다가 혼자 꺼짐"으로 보인다 → 왜 그런지 알린다.
        // 이미 있는 하트 토스트 자리를 그대로 쓴다(새 UI 없음).
        hapticWarn();
        setHeartToast("하트를 저장하지 못했어요 — 잠시 뒤 다시 눌러주세요.");
        if (heartToastTimerRef.current) {
          window.clearTimeout(heartToastTimerRef.current);
        }
        heartToastTimerRef.current = window.setTimeout(() => setHeartToast(null), 2600);
      });
    heartOpRef.current.set(id, { chain, seq, done: false });
  }
  const isBookmarked = (id: string) => bookmarks.includes(id);

  // 관심 단계 = "보는 달 최다 하트" 대비 비율 + 절대 하한(lib/schedules/heart-tiers 단일 출처).
  // maxHeart는 '보는 달' 일정만의 최댓값 — 예전엔 로드된 전체 달을 통틀어 재서 "이 달 1위"가 사실은
  // 전체 1위였다(2026-08-27 정정). 낙관적 heartCounts에서 파생되므로 내 하트 누름/취소에 즉시 반영.
  const maxHeart = useMemo(() => {
    const ym = `${view.year}-${String(view.month).padStart(2, "0")}`;
    let max = 0;
    for (const e of schedule.events) {
      if (!getEventDateKey(e).startsWith(ym)) continue;
      const c = heartCounts[e.id] ?? 0;
      if (c > max) max = c;
    }
    return max;
  }, [heartCounts, schedule.events, view.year, view.month]);
  // 이 달 최다 하트와 같은(공동 1위 포함) 일정 id들 — 이들에 👑을 붙인다. 공동 1위를 함께 왕관으로
  // 두면 다른 일정에 하트를 눌러 동점이 돼도 기존 왕관이 사라지지 않는다(단조).
  const topEventIds = useMemo(() => {
    const ids = new Set<string>();
    if (maxHeart <= 0) return ids;
    const ym = `${view.year}-${String(view.month).padStart(2, "0")}`;
    for (const e of schedule.events) {
      if ((heartCounts[e.id] ?? 0) === maxHeart && getEventDateKey(e).startsWith(ym)) ids.add(e.id);
    }
    return ids;
  }, [heartCounts, maxHeart, schedule.events, view.year, view.month]);

  // "내 관심"은 보고 있는 달 기준으로 따로 센다. 휴뱅(방송 안 함) 일정은 하트 대상이 아니라 제외.
  // 분모 = 이 달 휴뱅 제외 일정 수(내가 누를 수 있는 최대), 분자 = 그중 내가 ♥ 누른 수.
  const restTagId = useMemo(
    () => schedule.tags.find((t) => t.displayName === REST_TAG_NAME)?.id ?? null,
    [schedule.tags]
  );
  const monthKey = `${view.year}-${String(view.month).padStart(2, "0")}`;
  const monthHeartable = useMemo(() => {
    const isRest = (e: PublicScheduleEvent) =>
      restTagId ? e.tagIds.includes(restTagId) || e.primaryTagIds.includes(restTagId) : false;
    return schedule.events.filter((e) => e.startsAt.slice(0, 7) === monthKey && !isRest(e));
  }, [schedule.events, monthKey, restTagId]);
  const monthHeartableCount = monthHeartable.length;
  const myMonthHearts = useMemo(
    () => monthHeartable.filter((e) => bookmarks.includes(e.id)).length,
    [monthHeartable, bookmarks]
  );
  const interestRatio = monthHeartableCount > 0 ? myMonthHearts / monthHeartableCount : 0;

  // B4 FLIP: 필터로 아젠다 날들이 사라지고/나타날 때 남은 날이 순간이동하지 않고 활주한다.
  // 상태를 바꾸기 '전' 위치를 캡쳐하고, 커밋 직후(rAF, 페인트 전) 이동을 재생.
  function withAgendaFlip(mutate: () => void) {
    const container = document.querySelector<HTMLElement>(".agenda-flow");
    const prev = captureFlip(container);
    mutate();
    if (prev) requestAnimationFrame(() => playFlip(container, prev));
  }
  // 태그 칩 토글(다중 선택).
  function toggleTagFilter(id: string) {
    hapticTick(); // 셀렉터 손맛(Android만; iOS·미지원은 조용히 무시)
    // 시청자가 무엇을 찾는지의 가장 직접적인 신호(0062) — 태그 id만 남긴다(이름은 자유 서술).
    logActivity("filter.tag", { target: id, meta: { on: !tagFilters.includes(id) } });
    withAgendaFlip(() =>
      setTagFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    );
  }
  function clearFilters() {
    logActivity("filter.clear", { meta: { tags: tagFilters.length, bookmarked: bookmarkedOnly } });
    withAgendaFlip(() => {
      setTagFilters([]);
      setBookmarkedOnly(false);
    });
  }
  const filterActive = tagFilters.length > 0 || bookmarkedOnly;

  // 시청자에서 ←/→ 로 월 이동(입력 칸 안에서는 무시).
  useEffect(() => {
    if (showAgenda) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveMonth(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveMonth(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAgenda, view.year, view.month]);

  // D: 이 일정의 대표 태그(최대 2개) 색. 2개면 그 일정 안에서 그라데이션(경계는 일정 가운데).
  function eventColors(event: PublicScheduleEvent) {
    return tagVisual.eventFills(event);
  }

  // A2 고도화: 현재 필터(태그 다중 + 관심만)에 안 맞는 일정은 흐리게 처리할지 판정.
  function isDimmedByFilter(event: PublicScheduleEvent) {
    const matchesTag =
      tagFilters.length === 0 ||
      // 2계층: 대분류 필터는 그 하위 세부를 가진 일정까지 포함.
      tagFilters.some((id) => eventMatchesTagFilter(event, id, viewTags));
    const matchesBookmark = !bookmarkedOnly || isBookmarked(event.id);
    return !(matchesTag && matchesBookmark);
  }

  // 월 전환 슬라이드 방향(아젠다): 다음 달=왼쪽으로, 이전 달=오른쪽으로 밀려 들어온다.
  const [monthDir, setMonthDir] = useState<"next" | "prev">("next");
  // 첫 진입(세로 스태거)과 달 이동(가로 슬라이드)을 구분 — 실제로 달을 넘긴 뒤에만 슬라이드를 켠다.
  // (안 그러면 popIntro가 꺼질 때 data-enter 슬라이드가 다시 트리거돼 몇 초 뒤 한 번 더 슬라이딩됨.)
  const didNavigateRef = useRef(false);
  // 모바일 익명 로그인: /login 카드를 거치지 않고 클릭 시점에 환경을 분기한다.
  //  · 일반 브라우저 → 기본 폼 제출(/api/auth/login) → 곧장 구글 계정 선택창.
  //  · 안드로이드 웹뷰(숲·카톡) → 크롬 인텐트로 /login을 열면 거기서 자동 제출 → 구글 계정 선택창.
  //  · iOS 등 웹뷰 → 자동 전환 불가 → /login의 외부 브라우저 안내 카드로 보낸다.
  function handleMobileLogin(e: ReactMouseEvent<HTMLButtonElement>) {
    hapticTick();
    const det = detectInAppBrowser(typeof navigator !== "undefined" ? navigator.userAgent : "");
    if (!det.inApp) {
      return; // 폼 기본 제출(action=/api/auth/login)에 맡긴다.
    }
    e.preventDefault();
    if (det.android) {
      // 크롬이 /api/auth/login(GET)을 열면 카드 렌더 없이 서버가 곧장 구글로 302 → 계정 선택창.
      const target = `${window.location.origin}/api/auth/login?next=${encodeURIComponent("/")}`;
      const bare = target.replace(/^https?:\/\//, "");
      // 전환 성공이면 웹뷰가 가려져 document.hidden=true가 된다. 2.5초 뒤에도 그대로면
      // (크롬 미설치 등 인텐트 실패) /login 안내 카드를 최후수단으로 보여준다.
      window.setTimeout(() => {
        if (!document.hidden) window.location.assign(`/login?next=${encodeURIComponent("/")}`);
      }, 2500);
      window.location.replace(`intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`);
    } else {
      window.location.assign(`/login?next=${encodeURIComponent("/")}`);
    }
  }
  function moveMonth(offset: number) {
    didNavigateRef.current = true;
    setDayVodPop(null); // 팝오버는 화면 고정 좌표라 달이 바뀌면 근거를 잃는다
    setMonthDir(offset >= 0 ? "next" : "prev");
    const next = getAdjacentMonth(view.year, view.month, offset);
    setView(next);
    onViewChange?.(next.year, next.month); // 부모(편집실)에 바뀐 달 알림
    // 보던 달을 쿠키에 기록 → 새로고침 시 서버가 읽어 그 달로 바로 렌더(URL·라우터 안 건드림).
    // 월은 화면 구분 없이 하나(sy/sm)로 통일한다 — 시청자에서 본 달이 계정 전환 후 편집실로도
    // 이어진다("마지막 본 달"). 꾸미기는 편집 맥락이 달라 별도 키(dy/dm)를 유지. 편집실 미리보기는
    // accountSwitch=false라 여기서 안 쓰고, onViewChange로 편집실 쿠키(sy/sm)가 처리한다.
    if (accountSwitch) {
      writeViewCookie({ sy: next.year, sm: next.month });
    }
  }

  // 오늘이 속한 달로 한 번에 복귀(모바일 하단 레일 '오늘'). 이미 그 달이면 비활성.
  const todayYM = useMemo(() => {
    const [y, m] = today.split("-").map(Number);

    return { year: y, month: m };
  }, [today]);
  const onTodayMonth = view.year === todayYM.year && view.month === todayYM.month;
  // '오늘' 행으로 아젠다를 스크롤(가운데 정렬). 오늘에 표시할 행이 없으면(공개 일정 없는 날) 무시.
  const todayRowRef = useRef<HTMLDivElement>(null);
  function scrollToToday() {
    todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  // 오늘이 '현재 필터'로도 보이는가 — DOM(렌더 타이밍)이 아니라 데이터로 판정한다(오늘 날짜에 필터를
  // 통과하는 일정이 하나라도 있나). 보이면 필터를 유지하고 오늘로만 스크롤, 안 보이면 필터를 풀고 오늘로.
  const todayVisibleUnderFilter = schedule.events.some(
    (e) => getEventDateKey(e) === today && !isDimmedByFilter(e)
  );
  function jumpToday() {
    hapticTick();
    // 결정은 이동·해제 '전에' 데이터로 한 번만 — 잘못된 이중 이동/이중 처리 방지.
    const needClear = filterActive && !todayVisibleUnderFilter;
    if (needClear) clearFilters();
    if (!onTodayMonth) {
      const offset = (todayYM.year - view.year) * 12 + (todayYM.month - view.month);
      moveMonth(offset);
    }
    // 상태 변화(필터 해제/월 이동)가 렌더된 뒤 오늘로 스크롤. 월 이동이면 슬라이드만큼 더 기다린다.
    const delay = !onTodayMonth ? 360 : needClear ? 60 : 0;
    window.setTimeout(scrollToToday, delay);
  }
  // D3: 방송이 '켜지는 순간'(false→true 전이)만 젤리 팝 + 햅틱. 첫 마운트에 이미 LIVE면 조용히.
  const [liveJustOn, setLiveJustOn] = useState(false);
  const prevLiveRef = useRef<boolean | null>(null);
  const liveNow = Boolean(soopLive?.isLive);
  useEffect(() => {
    const prev = prevLiveRef.current;
    prevLiveRef.current = liveNow;
    if (prev === false && liveNow) {
      setLiveJustOn(true);
      hapticTick();
      const t = window.setTimeout(() => {
        setLiveJustOn(false);
        hapticTick(); // 확정(변신 끝) — 두 번째 틱
      }, 620);
      return () => window.clearTimeout(t);
    }
  }, [liveNow]);
  // 오늘 행이 화면에 보이는 동안만 todayVisible=true → 그때 방송 중이면 '오늘' 자리를 LIVE로 바꾼다.
  // 스크롤로 오늘 행을 벗어나거나 다른 달이면(오늘 행이 렌더 안 됨) false → '오늘'(이동) 버튼 복귀.
  useEffect(() => {
    const el = todayRowRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setTodayVisible(false);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setTodayVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [today, view.year, view.month, showAgenda]);

  // 좌/우 스와이프로 월 이동(모바일 아젠다). 가로로 충분히, 세로 스크롤보다 크게 밀었을 때만.
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  function onAgendaTouchStart(e: ReactTouchEvent) {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  }
  function onAgendaTouchEnd(e: ReactTouchEvent) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      hapticTick(); // 스와이프로 달 넘길 때 톡(Android만; iOS·미지원은 조용히 무시)
      moveMonth(dx < 0 ? 1 : -1);
    }
  }

  // 날짜 칸 렌더러.
  function renderDayCell(cell: MonthCell, cellIndex: number) {
    const covering = getEventsForDate(liveEvents, cell.isoDate);
    const supportHere = covering.filter((e) => e.isSupport);
    const events = covering.filter((e) => !e.isSupport);
    // 이 칸을 실제로 지나는 띠의 최고 레인 깊이 — 일정 목록은 딱 그만큼만 내려앉는다.
    // 레인 번호가 절대 위치(top: lane×20)라 '개수'가 아니라 '최고 레인+1'이어야 한다:
    // 레인0 띠가 이 칸을 안 지나가도 레인1 띠가 지나가면 40px을 비워야 겹치지 않는다.
    const cellLaneDepth = supportHere.reduce(
      (max, s) => Math.max(max, (supportLanes.lanes.get(s.id) ?? 0) + 1),
      0
    );
    const day = classifyDay(cell.isoDate, cell.weekday, today);
    const visibleDayMark = getDayMark(cell.isoDate);
    const showHeaderMark = Boolean(visibleDayMark?.name);

    // 이 칸의 대표 관심 단계 — 진입 시 단계별로 칸을 부각하는 애니메이션(data-pop)에 쓴다.
    let popTier: string | null = null;
    if (interactive) {
      let bestRank = 0;
      for (const e of events) {
        const t = heartTier(heartCounts[e.id] ?? 0, topEventIds.has(e.id), maxHeart);
        if (t && POP_RANK[t.key] > bestRank) {
          bestRank = POP_RANK[t.key];
          popTier = t.key;
        }
      }
    }

    // 이 날 다시보기(공개분)가 있으면 칸 배경 클릭 = 다시보기 팝오버. 카드·업도움 띠·버튼
    // 클릭은 각자의 동작이 우선이다(closest 가드). 포스터/미리보기(비인터랙티브)에선 없음.
    const cellVods = interactive ? vodsByDate.get(cell.isoDate) : undefined;
    return (
      <article
        className={`public-day ${cell.inCurrentMonth ? "" : "outside"} ${
          day.isToday ? "today" : ""
        }${rangeSelected.has(cellIndex) ? " cell-range-selected" : ""}${
          cellVods ? " has-vod" : ""
        }`}
        data-pop={popTier ?? undefined}
        data-cell-index={cellIndex}
        data-act={cellVods ? "day-vod-open" : undefined}
        key={cell.isoDate}
        onClick={
          cellVods
            ? (e) => {
                const t = e.target as HTMLElement;
                if (t.closest(".public-event, .support-bar, button, a")) return;
                hapticTick();
                setDayVodPop({ dateKey: cell.isoDate });
              }
            : undefined
        }
      >
        {/* 호버 ▶ 배지 — 가상요소를 쓰면 outside 베일·today 링(::after)과 슬롯이 충돌해
            좌상단으로 튄다(실측). 실제 요소 + hover 표시로. 비인터랙티브(포스터/캡쳐)에선
            cellVods가 없어 DOM 자체가 없다. */}
        {cellVods ? (
          <span aria-hidden="true" className="day-vod-hint">
            ▶
          </span>
        ) : null}
        {supportHere.map((s) => {
          const lane = supportLanes.lanes.get(s.id) ?? 0;
          const start = getEventDateKey(s);
          const end = s.endDateKey ?? start;
          const isStart = cell.isoDate === start;
          const isEnd = cell.isoDate === end;
          const left = isStart;
          const right = isEnd;
          // 라벨은 '시작 칸'과 '주가 바뀐 첫 칸(일요일)'에만 — 예전 isEnd 라벨은 같은 줄에서
          // 제목이 두 번 보였다. 글자는 sb-head(overflow 허용)로 오른쪽 띠 위로 흘러간다.
          const showLabel = isStart || (!isStart && cell.weekday === 0);
          // 띠 클릭 = 곧장 업도움 링크로(사용자 결정 2026-08-03). 띠에 '도와주러 가기 →'라고
          // 써 있는데 팝오버를 한 단계 거치는 건 문구와 어긋났다 — 여긴 팝오버가 필요 없다.
          // ⚠ window.open은 브라우저 팝업 차단에 막힌다(실사용에서 '안 눌림'으로 보고됨) →
          // 진짜 <a>로 렌더해 브라우저 기본 동작에 맡긴다(미들클릭·새 탭 열기도 자연스럽다).
          // 링크가 없는 업도움만 예외로 상세 팝오버(기간·제목 확인용).
          const bandClickable = interactive;
          const openSupportDetail =
            bandClickable && !s.supportUrl
              ? (el: HTMLElement) => {
                  hapticTick();
                  const r = el.getBoundingClientRect();
                  detailAnchorElRef.current = el;
                  setDetailManual(null);
                  setAgendaDetail({
                    event: s,
                    support: true,
                    dateKey: start,
                    anchor: { x: r.left, y: r.top, w: r.width, h: r.height }
                  });
                }
              : null;
          // 라벨 칸에서 이 주(週)에 띠가 몇 칸 이어지는지 — 1칸뿐이면(하루짜리, 일요일에 끝나는
          // 이어짐, 토요일 시작) 글자를 흘릴 띠가 없어 남의 날짜 위로 튄다(2026-09-01 사용자
          // 신고: 일요일 종료 칸). 그 경우 칸 안에서 끝나는 압축 모양(말줄임+화살표 한 글자)으로.
          const remainDays = Math.round(
            (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${cell.isoDate}T00:00:00Z`)) / 86_400_000
          );
          const segSpan = Math.min(Math.max(remainDays, 0), 6 - cell.weekday) + 1;
          const solo = showLabel && segSpan <= 1;
          // 단순 기간 안내(2026-09-01): 도와주러 갈 필요 없는 정보성 띠 — CTA·색·아이콘을 바꾼다.
          const period = s.supportKind === "period";
          const bandClass = `support-bar${isDimmedByFilter(s) ? " dimmed" : ""}${
            bandClickable ? " is-clickable" : ""
          }${showLabel ? " sb-head" : ""}${solo ? " sb-solo" : ""}${period ? " sb-period" : ""}${
            hoverSupportId === s.id ? " is-hover" : ""
          }`;
          const bandStyle = {
            // 머리글 높이(--day-head-h)에서 파생 — 확대해도 날짜와 겹치지 않는다.
            // -1px은 머리글 밑선에 살짝 걸쳐 띠가 떠 보이지 않게 하는 기존 여백.
            // 레인 스텝 18 = 띠 높이 17 + 틈 1(2026-09-02 사용자 신고 "띠 사이 간격 과함").
            // 편집실은 확대 배율이 스텝(20×zoom)엔 곱해지고 높이(17)엔 안 곱해져 배율에 따라
            // 틈이 변하지만, 시청자는 항상 이 고정 틈이다 — SUPPORT_LANE_STEP과 동기.
            top: `calc(var(--day-head-h, 27px) - 1px + ${lane * SUPPORT_LANE_STEP}px)`,
            // 광택 sweep 지연용 요일 인덱스 — 조각들이 순서대로 반짝여 빛줄기 하나가
            // 띠 전체를 훑는 것처럼 이어진다(CSS .support-bar.is-clickable 참고).
            ["--sb-col" as string]: cell.weekday,
            // 이어지는 칸은 -1px로 칸 경계선을 덮어 대나무 마디처럼 끊겨 보이지 않게.
            left: left ? 3 : -1,
            right: right ? 3 : -1,
            borderTopLeftRadius: left ? 9 : 0,
            borderBottomLeftRadius: left ? 9 : 0,
            borderTopRightRadius: right ? 9 : 0,
            borderBottomRightRadius: right ? 9 : 0
          };
          const bandHover = bandClickable
            ? {
                onMouseEnter: () => setHoverSupportId(s.id),
                onMouseLeave: () => setHoverSupportId((cur) => (cur === s.id ? null : cur))
              }
            : {};
          const bandInner = showLabel ? (
            <span>
              <i className="sb-sprout" aria-hidden="true">
                {period ? "📌" : "🌱"}
              </i>
              {solo ? <b className="sb-title">{s.publicTitle}</b> : s.publicTitle}
              {/* 남는 가로 폭 = 클릭 유도 문구(시청자 전용, 띠 위로 흘러감). 기간 안내는 링크가
                  있을 때만 조용한 '자세히 보기'. 하루짜리는 그만한 폭이 없어 화살표 한 글자로
                  압축한다(뜻은 aria-label에 그대로). */}
              {bandClickable && (!period || s.supportUrl) ? (
                solo ? (
                  <em className="sb-go" aria-hidden="true">
                    →
                  </em>
                ) : (
                  <em className="sb-cta">{period ? "자세히 보기 →" : "도와주러 가기 →"}</em>
                )
              ) : null}
            </span>
          ) : null;
          if (bandClickable && s.supportUrl) {
            return (
              <a
                aria-label={`${s.publicTitle} ${period ? "관련 링크 열기" : "도와주러 가기"}(새 탭)`}
                className={bandClass}
                href={s.supportUrl}
                key={s.id}
                onClick={(e) => {
                  e.stopPropagation(); // 칸 클릭(범위 선택 등)으로 새지 않게 — 이동은 기본 동작
                  hapticTick();
                }}
                rel="noopener noreferrer"
                style={bandStyle}
                target="_blank"
                title={`${s.publicTitle} — ${period ? "자세히 보기" : "도와주러 가기"} (새 탭에서 열림)`}
                {...bandHover}
               data-act={period ? "기간 안내 링크 열기" : "업 도움 링크 열기"}>
                {bandInner}
              </a>
            );
          }
          return (
            <div
              // 필터를 켜면 일정 카드만 흐려지고 업 도움 끈은 쨍하게 남아, 안 고른 기간이 오히려
              // 제일 눈에 띄었다 → 끈도 같이 물러난다(같은 isDimmedByFilter 판정을 쓴다).
              className={bandClass}
              key={s.id}
              style={bandStyle}
              title={s.publicTitle} /* 좁은 칸에서 말줄임된 제목의 전문(호버 툴팁) */
              {...bandHover}
              {...(openSupportDetail
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    "aria-label": `${s.publicTitle} ${period ? "기간 안내" : "업 도움"} 상세`,
                    onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
                      e.stopPropagation();
                      openSupportDetail(e.currentTarget);
                    },
                    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      openSupportDetail(e.currentTarget);
                    }
                  }
                : {})}
            >
              {bandInner}
            </div>
          );
        })}
        <div className="day-strip">
          <strong className={day.isRed ? "red" : day.isSaturday ? "saturday" : ""}>
            {cell.dayOfMonth} 일
          </strong>
          {showHeaderMark ? (
            interactive ? (
              // 특별한 날 표기를 탭하면 그 자리에서 빵빠레가 터진다.
              <button
                type="button"
                className="day-mark celebratable"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  popBurst(r.left + r.width / 2, r.top + r.height / 2, "cheer");
                }}
               data-act="day-mark">
                {visibleDayMark?.name}
              </button>
            ) : (
              <em className="day-mark">
                {visibleDayMark?.name}
              </em>
            )
          ) : null}
        </div>
        <div
          className="day-events"
          style={
            cellLaneDepth > 0
              ? { paddingTop: 8 + cellLaneDepth * SUPPORT_LANE_STEP }
              : undefined
          }
        >
          {events.map((rawEvent) => {
            // 서버가 '이제 없는 일정'이라고 확인해 준 떡밥(삭제/비공개 전환)은 그리지 않는다 —
            // 낡은 캐시가 준 유령이 빈 흰 카드로 남던 자리(2026-08-05).
            if (goneTeaserIds.has(rawEvent.id)) return null;
            // 떡밥 즉시 공개 맵에 있으면 실제 일정으로 갈아끼운다(가린 stub 대신 진짜).
            // 기대 수(hopeCount)는 공개 액션 응답에 없으니 stub의 값을 이어받는다(배지 유지).
            const revealedEv = teaserStillAhead(rawEvent) ? undefined : revealedEvents[rawEvent.id];
            const event = revealedEv
              ? { ...revealedEv, hopeCount: revealedEv.hopeCount ?? rawEvent.hopeCount }
              : rawEvent;
            // 떡밥(가림): 공개 시각이 미래면 항상 ??? 카드 + 카운트다운(미리보기·실제 시청자 모두 —
            // 데이터가 있어도 ???만 보여 지연 없음). 시각이 지났는데 서버가 가린 stub(제목 빈)을
            // 보냈으면(캐시 지연) 중립 placeholder + 즉시 교체. 시각 지났고 제목 있으면 일반 렌더.
            if (event.teaser && event.teaserRevealAt) {
              if (Date.parse(event.teaserRevealAt) > Date.now()) {
                // 클릭 = 떡밥 상세 팝오버(공개 시각 + 기대돼요) — 카드에는 카운트다운만(중복 없음).
                const openTeaserDetail = interactive
                  ? (el: HTMLElement) => {
                      const r = el.getBoundingClientRect();
                      hapticTick();
                      detailAnchorElRef.current = el;
                      setDetailManual(null);
                      setAgendaDetail({
                        event,
                        support: false,
                        dateKey: cell.isoDate,
                        anchor: { x: r.left, y: r.top, w: r.width, h: r.height }
                      });
                    }
                  : null;
                return (
                  <div
                    className={`public-event teaser${openTeaserDetail ? " is-clickable" : ""}`}
                    data-act="teaser-card"
                    key={event.id}
                    {...(openTeaserDetail
                      ? {
                          role: "button" as const,
                          tabIndex: 0,
                          onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
                            openTeaserDetail(e.currentTarget);
                          },
                          onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            openTeaserDetail(e.currentTarget);
                          }
                        }
                      : {})}
                  >
                    {/* 3번째 파동 링(후반부터 스며듦) — ::before/::after가 1·2번을 맡는다. */}
                    <span aria-hidden="true" className="teaser-ring" />
                    <div className="event-main teaser-main">
                      <span className="teaser-spark" aria-hidden="true">🔮</span>
                      <p className="teaser-q">???</p>
                      <TeaserCountdown
                        motionEnabled={interactive}
                        onReveal={() => revealTeaser(rawEvent.id, true)}
                        onWatch={() => markTeaserWatched(rawEvent.id)}
                        revealAt={event.teaserRevealAt}
                      />
                    </div>
                  </div>
                );
              }
              if (!event.publicTitle) {
                // 공개시각은 지났는데 서버가 준 stub에 제목이 없다 = 캐시 지연. 여기서 멈추면
                // 카드가 빈 채로 남는다(2026-08-04 실측: 관리자가 공개시각을 미래로 다시 잡자
                // 서버가 '아직 미공개'라며 빈 배열을 줘서 영원히 빈 칸이었다).
                // 이제 서버가 최신 stub도 돌려주므로 스스로 카운트다운으로 복귀한다.
                return (
                  <TeaserRevealing
                    className="public-event teaser-revealing"
                    eventId={event.id}
                    key={event.id}
                    onReveal={() => revealTeaser(rawEvent.id, false)}
                    revealAt={event.teaserRevealAt}
                  />
                );
              }
              // 시각 지났고 실제 제목 있음(미리보기/신선 캐시) → 일반 렌더로 흐른다.
            }
            const colors = eventColors(event);
            const extraColors = tagVisual.eventExtras(event);
            const { main, subs } = splitEventTitle(event.publicTitle);
            const span = getEventSpan(event, cell.isoDate, cell.weekday, schedule.events);
            const bookmarked = isBookmarked(event.id);
            // 하트는 시작 칸(제목 보이는 칸)에서만, 로그인 시청자 상호작용 모드에서만 노출.
            const showHeart = canHeart && span.showTitle;
            // #3: 관심 단계 배지 — 집계 기반, 숫자는 노출하지 않고 불꽃 게이지로.
            // **모드로 가르지 않는다**: 이 배지는 카드 안 흐름에 있어 있고/없고가 칸 높이를 바꾼다.
            // 시청자에게만 그렸더니 1·2행이 각각 +7/+19px 커지며 표면이 26px 길어졌고, 비율 좌표인
            // 스티커가 꾸미기에서 놓은 자리보다 칸 대비 위로 떠 보였다(ADR-0004 "꾸미기 == 시청자").
            // 집계(heartCount)는 서버에서 오는 같은 값이라 두 화면이 같은 배지를 그린다.
            const tier = span.showTitle
              ? heartTier(heartCounts[event.id] ?? 0, topEventIds.has(event.id), maxHeart)
              : null;
            const eventClass = [
              "public-event",
              span.isMulti ? "span" : "",
              span.isMulti && !span.roundLeft ? "no-left" : "",
              span.isMulti && !span.roundRight ? "no-right" : "",
              isDimmedByFilter(event) ? "dimmed" : "",
              event.isTentative && span.showTitle ? "tentative" : "",
              justRevealed.has(rawEvent.id) ? "just-revealed" : "",
              bookmarked ? "bookmarked" : ""
            ]
              .filter(Boolean)
              .join(" ");
            const mixed = colors.length >= 2;
            // 칠 묶음(같은 태그 구성으로 이어진 칸들) 전체 기준으로 경계를 가운데에 둔다.
            const pg = paintGroups.get(event.id);
            const run =
              mixed && pg
                ? getSpanRunRange(pg.start, pg.end, cell.isoDate, cell.weekday)
                : null;
            const mixStyle = mixed && run ? mixedEventStyle(colors, run) : null;
            // PC 시청자: 카드 클릭 = 상세 팝오버(모바일 시트와 같은 내용, 카드 옆에 앵커).
            // 하트 등 내부 컨트롤 클릭은 제외. 꾸미기/캡쳐 모드는 클릭 없음(interactive만).
            const openDesktopDetail = interactive
              ? (el: HTMLElement) => {
                  const r = el.getBoundingClientRect();
                  hapticTick();
                  detailAnchorElRef.current = el; // rAF 추적용(스크롤·리사이즈 따라 선·배치 갱신)
                  setDetailManual(null); // 새로 열 때는 항상 카드 옆 자동 배치부터
                  setAgendaDetail({
                    event,
                    support: false,
                    dateKey: cell.isoDate,
                    anchor: { x: r.left, y: r.top, w: r.width, h: r.height }
                  });
                }
              : null;
            return (
              <div
                className={`${eventClass}${openDesktopDetail ? " is-clickable" : ""}`}
                data-eventid={event.id} /* 공개 순간 폭죽 좌표를 잡는 앵커 */
                data-chain={chainKeys.get(event.id)}
                data-color={mixed ? undefined : colors[0]?.key}
                data-mixed={mixed ? "" : undefined}
                // 관심 단계를 카드 자체에 실어, 인기가 '불꽃 이모지 개수'가 아니라 '시각적 무게'
                // (제목 굵기 + 링)로도 읽히게 한다 — 달력은 훑는(spotted) 화면이라 한눈에 큰 방송이
                // 잡혀야 한다. 이모지는 정밀도, 무게는 스캔용.
                data-tier={tier?.key}
                key={event.id}
                style={mixStyle ?? (colors.length > 0 ? eventColorStyle(colors) : undefined)}
                {...(openDesktopDetail
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
                        if ((e.target as HTMLElement).closest("button, a")) return;
                        openDesktopDetail(e.currentTarget);
                      },
                      onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        if ((e.target as HTMLElement).closest("button, a")) return;
                        e.preventDefault();
                        openDesktopDetail(e.currentTarget);
                      }
                    }
                  : {})}
              >
                {/* 공개 순간 충격파 링(카드 밖으로 퍼짐) — 연출 끝나면 사라진다. */}
                {justRevealed.has(rawEvent.id) ? (
                  <span aria-hidden="true" className="reveal-shock" />
                ) : null}
                <div className="event-main">
                  {/* 이어지는 칸은 제목을 투명하게 그려 시작 칸과 높이를 맞춘다(이음새 어긋남 방지). */}
                  {span.showTitle ? (
                    <p>
                      {event.isTentative ? <span className="evt-tentative">미정</span> : null}
                      {/* 방금 공개된 떡밥은 ?에서 글자가 확정되는 스크램블로 등장. */}
                      {justRevealed.has(rawEvent.id) ? <ScrambleText text={main} /> : main}
                    </p>
                  ) : (
                    <p className="span-cont">{main || " "}</p>
                  )}
                  {/* 공개된 옛 떡밥 — "n명이 기다렸어요" 배지. 당분간 개발자 확인용만. */}
                  {showHopeBadge && span.showTitle && !event.teaser && hopeCountOf(event) > 0 ? (
                    <em className="hope-badge" title="공개 전 '기대돼요'를 누른 사람 수">
                      🔮 {hopeCountOf(event)}명이 기다렸어요
                    </em>
                  ) : null}
                </div>
                {/* 하트는 카드 직속(.event-main 밖)에 둔다 — 2색/무늬(data-mixed) 칸은
                    .event-main이 position:relative라, 그 안에 두면 하트 offset 기준이
                    .event-main으로 바뀌어 평칸 카드보다 ~5px 내려가 줄이 들쭉날쭉해진다.
                    카드 직속이면 기준이 항상 .public-event → 모든 카드에서 같은 높이. */}
                {showHeart ? (
                    <button
                      aria-label={bookmarked ? "관심 일정에서 빼기" : "관심 일정으로 표시"}
                      aria-pressed={bookmarked}
                      className="event-heart"
                      onClick={(ev) => toggleBookmark(event.id, ev)}
                      title={bookmarked ? "관심 표시됨 · 다시 누르면 취소" : "관심 표시"}
                      type="button"
                     data-act="event-heart">
                      {bookmarked ? "♥" : "♡"}
                    </button>
                  ) : null}
                {/* 형식색 점은 편집실과 똑같이 '마지막 서브 줄 오른쪽'에 함께 둔다 — 서브와 한 줄에
                    들어가면 같은 줄(별도 점 줄 없이 높이 절약), 안 들어가면 flex-wrap으로 점만 아래로.
                    서브가 없으면 아래 메타 줄에 (불꽃과 함께) 둔다. */}
                {(() => {
                  const showDots = span.showTitle && extraColors.length > 0;
                  const dots = showDots ? (
                    <span className="pill-dots" aria-hidden="true">
                      {extraColors.map((c, i) => (
                        <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                      ))}
                    </span>
                  ) : null;
                  const dotsInSub = dots && subs.length > 0;
                  // 공개 보상 스태거는 '시작 칸'에서만 — 이어지는 span 칸까지 연출하면 같은
                  // 일정이 여러 번 등장하는 것처럼 보인다.
                  const stag = justRevealed.has(rawEvent.id) && span.showTitle;
                  return (
                    <>
                      {subs.length > 0 ? (
                        <ul className={`event-subs${span.showTitle ? "" : " span-cont"}`}>
                          {subs.map((sub, i) => {
                            const rs = revealStagger(stag, main, i);
                            return i === subs.length - 1 && dotsInSub ? (
                              <li key={i} className={`pill-sub-last${rs.className}`} style={rs.style}>
                                <span className="pill-sub-text">{sub}</span>
                                {dots}
                              </li>
                            ) : (
                              <li className={rs.className.trim() || undefined} key={i} style={rs.style}>
                                {sub}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {/* 메타 줄: (서브가 없을 때만) 형식색 점. 시작 칸에만. 관심 단계는 카드 테두리
                          (TierMark, 높이 0)로 옮겨 이 줄이 더는 카드를 키우지 않는다. */}
                      {span.showTitle && dots && subs.length === 0 ? (
                        <div
                          className={`event-meta${revealStagger(stag, main, subs.length).className}`}
                          style={revealStagger(stag, main, subs.length).style}
                        >
                          {dots}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
                {/* 관심 단계 링·👑 — 마지막 자식(무늬 위, 본문 아래 z-index 0). 시작 칸에만. */}
                {tier && span.showTitle ? <TierMark tier={tier} /> : null}
              </div>
            );
          })}
        </div>
      </article>
    );
  }

  // 모바일 아젠다(목록) 뷰 — 이번 달 1일~말일만. 하루 = 한 카드, 그 안에 일정 여러 개.
  // 하트는 각 일정 제목 바로 오른쪽에. 왼쪽: 스크롤 따라오는 색상 안내(sticky). 좌/우 스와이프로 월 이동.
  function renderAgenda() {
    type DayGroup = {
      cell: MonthCell;
      day: ReturnType<typeof classifyDay>;
      mark: ReturnType<typeof getDayMark>;
      list: { event: PublicScheduleEvent; support: boolean }[];
    };
    const filtering = filterActive;
    const groups: DayGroup[] = [];
    for (const cell of cells.filter((c) => c.inCurrentMonth)) {
      // 색상 안내에서 태그를 고르면, 그 태그에 맞는 일정만 남긴다(필터에 안 맞으면 제외).
      const support = liveEvents.filter(
        (e) => e.isSupport && getEventDateKey(e) === cell.isoDate && !isDimmedByFilter(e)
      );
      const evs = liveEvents
        .filter(
          (e) => !e.isSupport && getEventDateKey(e) === cell.isoDate && !isDimmedByFilter(e)
        )
        // 편집실 드래그로 바꾼 같은 날 표시 순서(sort_order)를 아젠다도 따른다. 없으면(모두 0)
        // 로드 순서 유지. 이걸 빼면 달력(getEventsForDate)만 순서를 반영하고 모바일 아젠다는
        // created_at 순으로 남아 PC에서 바꾼 순서가 모바일에 안 보였다.
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const list = [
        ...support.map((event) => ({ event, support: true })),
        ...evs.map((event) => ({ event, support: false }))
      ];
      const mark = getDayMark(cell.isoDate);
      // 필터가 없으면 1일~말일 모든 날을 보여준다(빈 날은 "예정된 공개 일정 없음").
      // 필터 중이면 조건에 맞는 일정이 있는 날만 남긴다.
      if (list.length > 0 || !filtering) {
        groups.push({
          cell,
          day: classifyDay(cell.isoDate, cell.weekday, today),
          mark,
          list
        });
      }
    }

    // 빈 날이 연달아 3일 이상이면 한 줄로 접는다. 예전엔 말일까지 모든 빈 날이 풀사이즈 카드라
    // 월말 스크롤의 3분의 1이 "예정된 공개 일정 없음" 벽이었고, 감정적으로는 "방송 안 하나?"로
    // 읽혔다. 접힌 줄을 탭하면 그대로 펼쳐진다(숨기는 게 아니라 접는 것).
    type AgendaRow =
      | { kind: "day"; group: DayGroup }
      | { kind: "gap"; key: string; days: DayGroup[] };
    const rows: AgendaRow[] = [];
    let emptyRun: DayGroup[] = [];
    const flushRun = () => {
      if (emptyRun.length >= 3) {
        rows.push({ kind: "gap", key: `gap-${emptyRun[0].cell.isoDate}`, days: emptyRun });
      } else {
        emptyRun.forEach((group) => rows.push({ kind: "day", group }));
      }
      emptyRun = [];
    };
    for (const group of groups) {
      // 오늘·특별한 날(공휴일/절기/월드컵)은 비어 있어도 접지 않는다 — 찾는 날이니까.
      const collapsible = group.list.length === 0 && !group.mark && !group.day.isToday;
      if (collapsible) {
        emptyRun.push(group);
      } else {
        flushRun();
        rows.push({ kind: "day", group });
      }
    }
    flushRun();

    return (
      <section
        className="agenda"
        onTouchEnd={onAgendaTouchEnd}
        onTouchStart={onAgendaTouchStart}
      >
        {/* P1-VIEWER-1: 레일(인사이트 진입·편집실 이동 포함)은 태그 유무와 무관하게 그린다 —
            예전엔 legendTags가 0개인 달엔 '이 달 기록' 진입점까지 통째로 사라졌다.
            태그 필터 박스만 태그(또는 하트 필터)가 있을 때 그린다. */}
        {interactive ? (
          <div className="agenda-legend-rail">
          {legendTags.length > 0 || canHeart ? (
          <aside className="agenda-legend" aria-label="색상 안내(태그 필터)">
            <strong>색상 필터</strong>
            {(() => {
              const legendBtn = (tag: (typeof legendTags)[number]) => {
                const v = tagVisual.visualOf(tag.id);
                if (v.missing || !v.bg) return null;
                const on = tagFilters.includes(tag.id);
                return (
                  <button
                    aria-pressed={on}
                    className={`agenda-legend-tag ${tag.kind === "modifier" ? "mod" : ""} ${
                      on ? "on" : ""
                    } ${tagFilters.length > 0 && !on ? "dim" : ""}`}
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    type="button"
                   data-act="agenda-legend-tag">
                    <i
                      data-color={v.colorKey ?? undefined}
                      style={{ backgroundColor: v.bg, borderColor: v.border ?? undefined }}
                    />
                    {tag.displayName}
                  </button>
                );
              };
              const content = legendTags.filter((t) => t.kind !== "modifier");
              const mods = legendTags.filter((t) => t.kind === "modifier");
              return (
                <>
                  {content.map(legendBtn)}
                  {mods.length > 0 ? <>{mods.map(legendBtn)}</> : null}
                </>
              );
            })()}
            {/* 웹처럼 '내 관심 일정 ♥'도 같은 자리에서 함께 거른다(로그인 시청자만). */}
            {canHeart ? (
              <button
                aria-pressed={bookmarkedOnly}
                className={`agenda-legend-tag heart ${bookmarkedOnly ? "on" : ""}`}
                onClick={() => {
                  hapticTick(); // 같은 토글인데 누르는 자리(범례/웹/하단레일)마다 감촉이 달랐다
                  withAgendaFlip(() => setBookmarkedOnly((v) => !v));
                }}
                type="button"
               data-act="agenda-legend-tag">
                <LiquidHeart ratio={interestRatio} />
                내 관심
              </button>
            ) : null}
            {/* 톡은 clearFilters 함수가 아니라 버튼에서 — jumpToday도 clearFilters를 부르는데
                거긴 이미 톡을 울려서, 함수 안에 넣으면 두 번 울린다. */}
            {filterActive ? (
              <button
                className="agenda-legend-clear"
                onClick={() => {
                  hapticTick();
                  clearFilters();
                }}
                type="button"
               data-act="agenda-legend-clear">
                필터 해제
              </button>
            ) : null}
            {/* 남는 공간에 인기 배지 단계 안내(웹과 동일, 모바일용으로 간결하게). */}
            <div className="agenda-tier-help">
              <strong>♥ 인기도</strong>
              {/* 좁은 레일(92px = 편집실과 통일) — 텍스트 라벨은 잘려서 뺐다(2026-09-01 사용자:
                  이미지로만). 단계 순서는 스와치 색 강도가 말하고, 뜻은 title·aria-label이 담는다. */}
              <span aria-label="관심" title="관심">
                <i aria-hidden="true" className="tier-swatch tier-warm" />
              </span>
              <span aria-label="높은 관심" title="높은 관심">
                <i aria-hidden="true" className="tier-swatch tier-hot" />
              </span>
              <span aria-label="폭발적" title="폭발적">
                <i aria-hidden="true" className="tier-swatch tier-blaze" />
              </span>
              <span aria-label="이 달 1위" title="이 달 1위">
                <i aria-hidden="true" className="tier-swatch tier-top">👑</i>
              </span>
            </div>
          </aside>
          ) : null}
          {/* '이 달 기록' — 웹에선 헤더(.public-calendar-header)에 있는데, 그 헤더는 ≤1040px에서
              통째로 안 그려진다. 그래서 폰·태블릿 시청자는 만들어 둔 기록 시트를 열 방법이 아예
              없었다(진입점 0개). 새 크롬을 만들지 않고 같은 버튼을 이 레일에 둔다 — 아래 주석대로
              엄지가 닿는 자리이고, 박스가 vh 고정이라 스크롤해도 안 들썩인다. */}
          {interactive ? (
            <button
              // 레일 버튼은 바로 아래 '편집실'과 나란히 서므로 같은 표준 버튼(.button)으로 그린다 —
              // 예전엔 헤더용 글래스 알약(.insights-open)을 그대로 써서 옆 버튼과 모양·높이·라운드가
              // 다 달랐다(같은 자리, 같은 크기, 다른 옷 = 불편함).
              className="button agenda-legend-insights"
              onClick={() => {
                hapticTick();
                setInsightsOpen(true);
              }}
              title="이 달 방송·일정 기록 보기"
              type="button"
             data-act="이 달 기록 보기">
              📊 이 달 기록
            </button>
          ) : null}
          {/* 미리보기 '편집실로 가기'는 색상 필터 박스 '아래'에 — 박스가 vh 고정이라 스크롤해도
              안 들썩이고(인사이트 버튼과 동일), 우상단 대신 엄지 닿는 아래쪽이라 누르기 쉽다. */}
          {previewNav ? <div className="agenda-legend-nav">{previewNav}</div> : null}
          </div>
        ) : null}

        <div
          className={`agenda-flow${popIntro && !didNavigateRef.current ? " cal-reveal" : ""}`}
          data-enter={didNavigateRef.current ? monthDir : undefined}
          key={`${view.year}-${view.month}`}
        >
          {groups.length === 0 ? (
            <p className="agenda-empty">
              {bookmarkedOnly && tagFilters.length === 0
                ? "아무것도 관심 표현을 안 했어요. 🍃"
                : filtering
                  ? "해당 태그 일정이 없어요. 🍃"
                  : "이 달엔 공개된 일정이 없어요. 🍃"}
            </p>
          ) : (
            rows.map((row, agendaIndex) => {
              // 접힌 빈 구간 — 한 줄. 탭하면 그 자리에서 펼쳐진다(내용을 숨기지 않는다).
              if (row.kind === "gap" && !expandedGaps.has(row.key)) {
                const from = row.days[0].cell.dayOfMonth;
                const to = row.days[row.days.length - 1].cell.dayOfMonth;
                return (
                  <button
                    className="agenda-gap"
                    key={row.key}
                    onClick={() => {
                      hapticTick();
                      setExpandedGaps((prev) => new Set(prev).add(row.key));
                    }}
                    style={popIntro ? ({ "--ri": agendaIndex } as CSSProperties) : undefined}
                    type="button"
                   data-act="agenda-gap">
                    <span className="ag-range">
                      {from}~{to}일
                    </span>
                    <span className="ag-note">아직 일정이 없어요 🍃</span>
                    <span className="ag-more">펼치기</span>
                  </button>
                );
              }
              const days = row.kind === "gap" ? row.days : [row.group];
              return days.map(({ cell, day, mark, list }) => (
              <div
                className={`agenda-day ${day.isToday ? "today" : ""}`}
                data-flip-key={cell.isoDate}
                key={cell.isoDate}
                ref={day.isToday ? todayRowRef : undefined}
                style={popIntro ? ({ "--ri": agendaIndex } as CSSProperties) : undefined}
              >
                <div className="agenda-when">
                  <strong className={day.isRed ? "red" : day.isSaturday ? "saturday" : ""}>
                    {cell.dayOfMonth}
                  </strong>
                  <span className="agenda-wd">{WEEKDAYS[cell.weekday]}</span>
                </div>
                <div className="agenda-day-list">
                  {mark ? (() => {
                                      const markText = mark.name;
                    if (!markText) return null;
                    return interactive ? (
                      <button
                        type="button"
                        className={`agenda-mark celebratable ${mark.isHoliday ? "holiday" : ""}`}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          popBurst(r.left + r.width / 2, r.top + r.height / 2, "cheer");
                        }}
                       data-act="agenda-mark">
                        {markText}
                      </button>
                    ) : (
                      <span className={`agenda-mark ${mark.isHoliday ? "holiday" : ""}`}>
                        {markText}
                      </span>
                    );
                  })() : null}
                  {list.length === 0 ? (
                    // DB의 null을 그대로 읽어주던 문구("예정된 공개 일정 없음") 대신 사람 말로.
                    // 쉬는 날은 누락된 레코드가 아니라 쉬는 날이다.
                    <span className="agenda-noevent">아직 일정이 없어요 🍃</span>
                  ) : null}
                  {list.map(({ event: rawEvent, support }) => {
                    // 위 달력 칸과 같은 규칙 — 서버가 없다고 확인한 떡밥은 안 그린다.
                    if (goneTeaserIds.has(rawEvent.id)) return null;
                    // 떡밥 즉시 공개 맵에 있으면 실제 일정으로 갈아끼운다.
                    // 기대 수는 공개 응답에 없으니 stub 값을 이어받는다(배지 유지).
                    const revealedEv = teaserStillAhead(rawEvent)
                      ? undefined
                      : revealedEvents[rawEvent.id];
                    const event = revealedEv
                      ? { ...revealedEv, hopeCount: revealedEv.hopeCount ?? rawEvent.hopeCount }
                      : rawEvent;
                    // 떡밥(가림): 미래면 항상 ??? 카드(미리보기·실제 모두). 지났고 빈 stub이면
                    // placeholder+교체, 지났고 제목 있으면 일반 렌더.
                    if (event.teaser && event.teaserRevealAt) {
                      if (Date.parse(event.teaserRevealAt) > Date.now()) {
                        // 탭 = 떡밥 상세 시트(공개 시각 + 기대돼요). 카드엔 카운트다운만(중복 없음).
                        const openTeaserSheet = interactive
                          ? () => {
                              hapticTick();
                              setAgendaDetail({ event, support: false, dateKey: cell.isoDate });
                            }
                          : null;
                        return (
                          <div
                            className={`agenda-item teaser${openTeaserSheet ? " tappable" : ""}`}
                            key={event.id}
                            {...(openTeaserSheet
                              ? {
                                  role: "button" as const,
                                  tabIndex: 0,
                                  onClick: openTeaserSheet,
                                  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
                                    if (e.key !== "Enter" && e.key !== " ") return;
                                    e.preventDefault();
                                    openTeaserSheet();
                                  }
                                }
                              : {})}
                          >
                            <span className="teaser-spark" aria-hidden="true">🔮</span>
                            <p className="agenda-title teaser-q">???</p>
                            <TeaserCountdown
                              motionEnabled={interactive}
                              onReveal={() => revealTeaser(rawEvent.id, true)}
                              onWatch={() => markTeaserWatched(rawEvent.id)}
                              revealAt={event.teaserRevealAt}
                            />
                          </div>
                        );
                      }
                      if (!event.publicTitle) {
                        return (
                          <TeaserRevealing
                            className="agenda-item teaser-revealing"
                            eventId={event.id}
                            key={event.id}
                            onReveal={() => revealTeaser(rawEvent.id, false)}
                            revealAt={event.teaserRevealAt}
                          />
                        );
                      }
                      // 지났고 실제 제목 있음 → 일반 렌더로 흐른다.
                    }
                    const colors = eventColors(event);
                    const extraColors = support ? [] : tagVisual.eventExtras(event);
                    const { main, subs } = splitEventTitle(event.publicTitle);
                    const bookmarked = isBookmarked(event.id);
                    const tier =
                      interactive && !support
                        ? heartTier(heartCounts[event.id] ?? 0, topEventIds.has(event.id), maxHeart)
                        : null;
                    const single = support
                      ? { background: "#84b74f" }
                      : colors[0]
                        ? { background: colors[0].bgColor }
                        : undefined;
                    const twoColor = !support && colors.length >= 2;
                    const end = event.endDateKey;
                    // 카드 탭 = 상세 시트(하트·링크 등 내부 컨트롤 탭은 제외).
                    const openDetail = (originEl?: HTMLElement | null) => {
                      hapticTick();
                      agendaDetailOriginRef.current = originEl?.getBoundingClientRect() ?? null;
                      setAgendaDetail({ event, support, dateKey: cell.isoDate });
                    };
                    return (
                      <div
                        className={`agenda-event tappable${justRevealed.has(rawEvent.id) ? " just-revealed" : ""}`}
                        data-act="schedule-card"
                        data-eventid={support ? undefined : event.id}
                        data-tier={tier?.key}
                        key={(support ? "s-" : "") + event.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, a")) return;
                          openDetail(e.currentTarget);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          if ((e.target as HTMLElement).closest("button, a")) return;
                          e.preventDefault();
                          openDetail(e.currentTarget);
                        }}
                      >
                        {justRevealed.has(rawEvent.id) ? (
                          <span aria-hidden="true" className="reveal-shock" />
                        ) : null}
                        {twoColor ? (
                          // 2색: 위/아래 반반 + 각 무늬, 가운데 경계는 마스크로 흐릿하게.
                          <span className="agenda-bar agenda-bar-2">
                            <i
                              className="agenda-bar-half top"
                              data-color={colors[0].key}
                              style={{ background: colors[0].bgColor }}
                            />
                            <i
                              className="agenda-bar-half bottom"
                              data-color={colors[1].key}
                              style={{ background: colors[1].bgColor }}
                            />
                          </span>
                        ) : (
                          <span
                            className="agenda-bar"
                            data-color={!support ? colors[0]?.key : undefined}
                            style={single}
                          />
                        )}
                        <div className="agenda-content">
                          <p className="agenda-title">
                            <span className="agenda-title-text">
                              {!support && event.isTentative ? (
                                <span className="evt-tentative">미정</span>
                              ) : null}
                              {support
                                ? `${event.supportKind === "period" ? "📌" : "🌱"} ${event.publicTitle}`
                                : justRevealed.has(rawEvent.id)
                                  ? <ScrambleText text={main} />
                                  : main}
                            </span>
                            {canHeart && !support ? (
                              <button
                                aria-label={bookmarked ? "관심 해제" : "관심 일정"}
                                aria-pressed={bookmarked}
                                className={`event-heart agenda-heart ${bookmarked ? "bookmarked" : ""}`}
                                onClick={(ev) => toggleBookmark(event.id, ev)}
                                title={bookmarked ? "관심 표시됨 · 다시 누르면 취소" : "관심 표시"}
                                type="button"
                               data-act="event-heart">
                                {bookmarked ? "♥" : "♡"}
                              </button>
                            ) : null}
                          </p>
                          {/* 공개된 옛 떡밥 — "n명이 기다렸어요" 배지. 당분간 개발자 확인용만. */}
                          {showHopeBadge && !support && !event.teaser && hopeCountOf(event) > 0 ? (
                            <p className="agenda-sub hope-badge">
                              🔮 {hopeCountOf(event)}명이 기다렸어요
                            </p>
                          ) : null}
                          {support ? (
                            <p className="agenda-sub">
                              {formatShortDate(cell.isoDate)} ~{" "}
                              {formatShortDate(event.endDateKey ?? cell.isoDate)}
                            </p>
                          ) : end && end !== cell.isoDate ? (
                            <p className="agenda-sub">~ {formatShortDate(end)}까지</p>
                          ) : null}
                          {/* 형식색 점은 PC와 동일하게 '마지막 서브 줄 오른쪽'에 함께 둔다 — 서브 빈
                              공간에 다 들어가면 같은 줄(별도 점 줄 없이 높이 절약), 안 들어가면 flex-wrap으로
                              점만 아래로. 서브가 없으면 아래 메타 줄에 (불꽃과 함께) 오른쪽 정렬로 둔다. */}
                          {(() => {
                            const dots = !support && extraColors.length > 0 ? (
                              <span className="pill-dots" aria-hidden="true">
                                {extraColors.map((c, i) => (
                                  <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                                ))}
                              </span>
                            ) : null;
                            const dotsInSub = dots && subs.length > 0;
                            const stag = justRevealed.has(rawEvent.id);
                            return (
                              <>
                                {!support && subs.length > 0 ? (
                                  <ul className="agenda-subs">
                                    {subs.map((sub, i) => {
                                      const rs = revealStagger(stag, main, i);
                                      return i === subs.length - 1 && dotsInSub ? (
                                        <li
                                          className={`pill-sub-last${rs.className}`}
                                          key={i}
                                          style={rs.style}
                                        >
                                          <span className="pill-sub-text">{sub}</span>
                                          {dots}
                                        </li>
                                      ) : (
                                        <li
                                          className={rs.className.trim() || undefined}
                                          key={i}
                                          style={rs.style}
                                        >
                                          {sub}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : null}
                                {support && event.supportUrl ? (
                                  <a
                                    className={`agenda-link${event.supportKind === "period" ? " period" : ""}`}
                                    href={event.supportUrl}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                   data-act="agenda-link">
                                    {event.supportKind === "period" ? "자세히 보기" : "도우러 가기"}
                                    <ExternalLink aria-hidden="true" size={13} />
                                  </a>
                                ) : null}
                                {/* 메타 한 줄: (서브 없을 때만) 형식색 점. 관심 단계는 카드 링(TierMark). */}
                                {dots && subs.length === 0 ? (
                                  <div
                                    className={`agenda-meta${revealStagger(stag, main, subs.length).className}`}
                                    style={revealStagger(stag, main, subs.length).style}
                                  >
                                    {dots}
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                        {tier ? <TierMark tier={tier} /> : null}
                      </div>
                    );
                  })}
                  {/* 다시보기 진입로(모바일) — 날짜 줄의 인라인 칩이 유일한 통로다(일정 상세의
                      다시보기 버튼은 2026-08-31 제거). 일정 유무와 무관하게 그 날 방송이 있으면
                      항상 같은 자리(카드들 '아래')에 붙는다 — 위치 일관 + 계획(카드)이 먼저,
                      기록(다시보기)이 나중이라는 시간 위계(HCI).
                      챕터(타임라인) 접이는 모바일에서 제거(2026-09-01 사용자: 높이 최적화) —
                      칩 탭 = 숲 플레이어 바로 이동, 챕터 목록은 PC 날짜 창 전용. */}
                  {interactive
                    ? (vodsByDate.get(cell.isoDate) ?? []).map((vod, vi, arr) => (
                        <a
                          className="agenda-link vod agenda-vod-inline"
                          data-act="vod-replay"
                          href={`https://vod.sooplive.co.kr/player/${vod.titleNo}`}
                          key={vod.titleNo}
                          onClick={() => hapticTick()}
                          rel="noopener noreferrer"
                          target="_blank"
                          title={vod.title || undefined}
                        >
                          <Play aria-hidden="true" size={13} strokeWidth={2.6} />
                          {/* 라벨 = VOD 제목(넘치면 …). 제목이 비어 있을 때만 '다시보기 N' 폴백. */}
                          <span className="agenda-vod-title">
                            {vod.title || `다시보기${arr.length > 1 ? ` ${vi + 1}` : ""}`}
                          </span>
                          {vod.durationMs > 0 ? (
                            <em className="agenda-vod-dur">{formatVodDuration(vod.durationMs)}</em>
                          ) : null}
                        </a>
                      ))
                    : null}
                </div>
              </div>
              ));
            })
          )}
        </div>
      </section>
    );
  }

  // 시청자 달력 글자 확대(편집실 A안과 같은 문법) — 달력 위 Ctrl+휠로 100/125/150% 단계.
  // 글자(칸 내용)만 커지고 표면은 세로로 자란다(배율은 폭 기준이라 그대로 = 진짜 확대).
  const [posterZoom, setPosterZoom] = useState(1);
  const posterCalRef = useRef<HTMLElement | null>(null);
  const posterZoomStepperRef = useRef(createWheelStepper());
  useEffect(() => {
    if (showAgenda) return;
    const el = posterCalRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      // 달력 위 Ctrl+휠은 항상 브라우저 줌 대신 달력 확대 — 일부만 새면 화면이 뒤죽박죽.
      e.preventDefault();
      const dir = posterZoomStepperRef.current.feed(
        normalizeWheelDelta(e.deltaY, e.deltaMode),
        e.timeStamp
      );
      if (dir === 0) return;
      hapticTick();
      setPosterZoom((z) => stepCalZoom(z, dir));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [showAgenda]);

  // 레일 정보 카드 — 평소엔 표면 안 오른쪽 레일에, 아바타 scene에선 아바타 자리 좌상단으로
  // 옮겨 뜬다. 한 JSX를 두 자리에서 재사용해 마크업이 안 어긋나게 한다.
  // 2026-08-31 사용자 결정: 한 줄로 압축(연·월 ↔ D+N) — '데뷔'·'오늘' 줄 삭제. 오늘 날짜는
  // 달력의 오늘 칸이 이미 말하고, 카드가 낮아진 만큼 생방송 미리보기가 위로 올라온다.
  const railInfoCard = (() => {
    const dplus = debutDPlus(today);
    return (
      <div className="rail-info-card">
        <span className="ric-month">
          <b>
            {view.year}년 {String(view.month).padStart(2, "0")}월
          </b>
          {dplus !== null ? (
            <b className="ric-dplus" title="데뷔 D+">
              D+{dplus}
            </b>
          ) : null}
        </span>
      </div>
    );
  })();

  // 태그 필터 카드 — 표면 안 레일용(follow=true: 스크롤 따라오기 ref 부착)과 아바타 scene의
  // 반대편 얇은 레일용(follow=false)이 같은 마크업을 쓴다(1열 압축·폭은 CSS 담당).
  // compact: 인기도 안내를 '🔥 관심' 짧은 라벨 2×2로 축약(얇은 레일 전용).
  const renderLegendFilter = (follow: boolean, compact = false) => (
    <div
      className="public-legend-vertical"
      aria-label="태그 필터"
      ref={follow ? legendFollowRef : undefined}
    >
      <strong className="legend-title">태그 필터</strong>
      {(() => {
        const legendBtn = (tag: (typeof legendTags)[number]) => {
          const v = tagVisual.visualOf(tag.id);
          if (v.missing || !v.bg) {
            return null;
          }
          const swatch = (
            <i
              data-color={v.colorKey ?? undefined}
              style={{ backgroundColor: v.bg, borderColor: v.border ?? undefined }}
            />
          );
          // A2 고도화: 다중 선택과 동기화. 선택된 게 있으면 안 고른 항목은 흐리게.
          // 꾸미기에선 스티커 레이어가 덮어 어차피 못 누르므로 disabled로만 두고 **마크업은
          // 시청자와 똑같이** 유지한다 — 예전엔 여기서 <span>으로 갈아끼워 범례 줄 높이가
          // 3.8px 어긋났고, 표면 안 레이아웃이 모드마다 달라지면 스티커가 밀린다(ADR-0004).
          const on = tagFilters.includes(tag.id);
          const cls = [
            "legend-item",
            tag.kind === "modifier" ? "mod" : "",
            on ? "active" : "",
            tagFilters.length > 0 && !on ? "dim" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              aria-pressed={on}
              className={cls}
              data-act="legend-item"
              key={tag.id}
              onClick={() => toggleTagFilter(tag.id)}
              type="button"
            >
              {swatch}
              {tag.displayName}
            </button>
          );
        };
        const content = legendTags.filter((t) => t.kind !== "modifier");
        const mods = legendTags.filter((t) => t.kind === "modifier");
        return (
          <>
            {content.map(legendBtn)}
            {mods.length > 0 ? (
              // 방식은 2열로 — 세로 높이를 아껴 아래 ♥ 안내가 들어갈 자리를 만든다(웹).
              <div className="legend-mods">{mods.map(legendBtn)}</div>
            ) : null}
          </>
        );
      })()}
      {/* '필터 해제'는 필터가 있든 없든 항상 자리(높이)를 차지한다 — 필터를 켤 때 이 버튼이
          새로 생기면서 위 색칩들이 위로 밀려, 방금 누른 칩이 커서 밑에서 벗어나 다시 끄려면
          마우스를 옮겨야 했다. 항상 자리만 잡아두고 보이기만 토글하면 칩이 안 움직여, 같은
          자리에서 따닥 눌러 켜고 끌 수 있다. */}
      <button
        className={`legend-clear${filterActive ? "" : " is-hidden"}`}
        onClick={() => {
          hapticTick();
          clearFilters();
        }}
        type="button"
        aria-hidden={!filterActive}
        tabIndex={filterActive ? 0 : -1}
       data-act="legend-clear">
        필터 해제
      </button>
      {/* ♥ 의미·인기 단계 안내 — 하트 토글은 제목 위 배너로 옮겼고, 그 자리에 모바일처럼
          설명을 둔다. margin-top:auto로 안내 박스 바닥에 붙어 빈 공간 없이 채운다.
          **모드로 가르지 않는다**: 시청자에게만 그리면 이 박스(26px)만큼 표면이 길어져,
          비율 좌표인 스티커가 꾸미기에서 놓은 자리보다 위로 떠 보였다(ADR-0004 불변식).
          설명하는 대상(🔥 관심 같은 등급 배지)은 내보낸 PNG에도 찍히므로 범례로도 맞다. */}
      <div className="legend-heart-help">
        <p className="legend-tier-line">
          <span className="hm">♥</span> 인기도
        </p>
        {compact ? (
          // 축약형(얇은 레일) — 짧은 라벨 2×2, 칩 상자 없이 불꽃+라벨만.
          <ul className="legend-tiers is-compact">
            <li>
              <i aria-hidden="true" className="tier-swatch tier-warm" /> 관심
            </li>
            <li>
              <i aria-hidden="true" className="tier-swatch tier-hot" /> 높은
            </li>
            <li>
              <i aria-hidden="true" className="tier-swatch tier-blaze" /> 폭발
            </li>
            <li>
              <i aria-hidden="true" className="tier-swatch tier-top">👑</i> 1위
            </li>
          </ul>
        ) : (
          <ul className="legend-tiers">
            <li>
              <i aria-hidden="true" className="tier-swatch tier-warm" /> 관심
            </li>
            <li>
              <i aria-hidden="true" className="tier-swatch tier-hot" /> 높은 관심
            </li>
            <li>
              <i aria-hidden="true" className="tier-swatch tier-blaze" /> 폭발적
            </li>
            <li>
              <i aria-hidden="true" className="tier-swatch tier-top">👑</i> 이 달 1위
            </li>
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <main
      className={`poster-page${accountSwitch ? " poster-readonly" : ""}${
        avatarCapable && avatarOn ? ` avatar-scene avatar-${avatarSide}` : ""
      }${
        // 태그 필터 중엔 꾸미기 스티커도 함께 물러난다(일정 카드와 같은 흐림) — 꾸미기
        // 편집(decorate) 중엔 제외. 캡쳐 PNG는 필터 없는 서버 렌더라 영향 없음.
        tagFilters.length > 0 || bookmarkedOnly ? " tag-filtering" : ""
      }`}
      data-poster-theme={effectivePosterTheme}
    >
      {/* (라이브 카드는 우측 레일 안 — 정보 카드와 태그 필터 사이 — 로 이사(2026-07-31).
          모바일 아젠다는 하단 '오늘'→LIVE 버튼이 담당해 별도 플로팅 없음.) */}
      {/* 하트 승급 순간 — 화면 밖(fixed)이라 캡쳐 PNG엔 안 들어간다. */}
      {heartToast ? (
        <div className="heart-toast" role="status" aria-live="polite">
          {heartToast}
        </div>
      ) : null}
      {/* 모바일 아젠다 일정 상세 시트 — 카드 탭으로 열리며 전체 제목·기간·태그 이름을 보여준다.
          공개 DTO만 사용(비공개 필드 자체가 없다). fixed 오버레이라 캡쳐 PNG 밖. */}
      {/* 날짜 다시보기 '창'(PC) — 화면 중앙의 작은 창: 썸네일 미리보기(클릭 = 재생) + 제목 +
          챕터. 닫기 = X·백드롭·Esc·뒤로가기(히스토리 스택은 위 dayVod* 참조). */}
      {dayVodPop
        ? (() => {
            const list = vodsByDate.get(dayVodPop.dateKey) ?? [];
            const wd = new Date(`${dayVodPop.dateKey}T00:00:00Z`).getUTCDay();
            const mark = getDayMark(dayVodPop.dateKey);
            const tone = wd === 0 || Boolean(mark?.isHoliday) ? " red" : wd === 6 ? " saturday" : "";
            return (
              <div
                className="day-vod-backdrop"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setDayVodPop(null);
                }}
                role="presentation"
              >
                <div aria-label="다시보기" aria-modal="true" className="day-vod-modal" role="dialog">
                  <div className="dvm-head">
                    <b className={`dvp-date${tone}`}>
                      {Number(dayVodPop.dateKey.slice(0, 4))}.{formatShortDate(dayVodPop.dateKey)} (
                      {WEEKDAYS[wd]})
                    </b>
                    <button
                      aria-label="닫기"
                      autoFocus
                      className="dvm-close"
                      data-act="닫기"
                      onClick={() => {
                        hapticTick();
                        setDayVodPop(null);
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="dvm-body" data-single={list.length === 1 ? "" : undefined}>
                    {list.map((vod, vi, arr) => {
                      const playerUrl = `https://vod.sooplive.co.kr/player/${vod.titleNo}`;
                      const label = vod.title || `다시보기${arr.length > 1 ? ` ${vi + 1}` : ""}`;
                      return (
                        <div className="dvm-vod" key={vod.titleNo}>
                          {/* 플레이어는 창이 열릴 때부터 깔린다(fromApi=1, autoPlay:false 초기화).
                              첫 클릭 = 플레이어 안 ▶ = 어떤 브라우저에서도 1클릭 소리 켠 재생.
                              지정 썸네일 커버는 실제 재생이 시작될 때까지 덮는다(클릭 통과). */}
                          <div className="dvm-thumb is-playing">
                            <iframe
                              allow="autoplay; fullscreen; encrypted-media"
                              src={`https://vod.sooplive.co.kr/player/${vod.titleNo}/embed?fromApi=1`}
                              title={label}
                            />
                            <span
                              aria-hidden="true"
                              className={`dvm-cover${dayVodLive.has(vod.titleNo) ? " is-gone" : ""}`}
                            >
                              {vod.thumbQuery ? (
                                <img
                                  alt=""
                                  src={`https://videoimg.sooplive.com/php/SnapshotLoad.php?${vod.thumbQuery}`}
                                />
                              ) : null}
                              <span className="dvm-play">
                                <Play size={16} strokeWidth={2.6} />
                              </span>
                              {vod.durationMs > 0 ? (
                                <em className="dvm-dur">{formatVodDuration(vod.durationMs)}</em>
                              ) : null}
                            </span>
                            <a
                              aria-label="숲에서 크게 보기"
                              className="dvm-ext"
                              data-act="vod-replay"
                              href={
                                dayVodJump?.titleNo === vod.titleNo
                                  ? `${playerUrl}?change_second=${dayVodJump.sec}`
                                  : playerUrl
                              }
                              onClick={() => hapticTick()}
                              rel="noopener noreferrer"
                              target="_blank"
                              title="숲에서 크게 보기"
                            >
                              <ExternalLink aria-hidden="true" size={13} strokeWidth={2.6} />
                            </a>
                          </div>
                          <a
                            className="dvm-title"
                            data-act="vod-replay"
                            href={playerUrl}
                            onClick={() => hapticTick()}
                            rel="noopener noreferrer"
                            target="_blank"
                            title={label}
                          >
                            {label}
                          </a>
                          <VodChapters
                            chapters={vod.chapters ?? 0}
                            defaultOpen={arr.length === 1}
                            durationMs={vod.durationMs}
                            onJump={(sec) => jumpDayVod(vod.titleNo, sec)}
                            slug={schedule.calendar.slug}
                            timelineBy={vod.timelineBy ?? ""}
                            titleNo={vod.titleNo}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()
        : null}
      {agendaDetail
        ? (() => {
            const { event: rawDetailEvent, support, dateKey, anchor } = agendaDetail;
            // 열어둔 채로 공개 시각이 지나면 이 팝오버 안에서 ???가 실제 일정으로 변신한다.
            const event = revealedEvents[rawDetailEvent.id] ?? rawDetailEvent;
            const detailJustRevealed = justRevealed.has(rawDetailEvent.id);
            const { main, subs } = splitEventTitle(event.publicTitle);
            const detailTags = event.tagIds.flatMap((id) => {
              const tag = viewTags.find((t) => t.id === id);
              if (!tag) return [];
              const v = tagVisual.visualOf(tag.id);
              if (v.missing || !v.bg) return [];
              return [
                {
                  tag,
                  bg: v.bg,
                  border: v.border ?? undefined,
                  primary: event.primaryTagIds.includes(tag.id)
                }
              ];
            });
            const end = event.endDateKey;
            // 아직 안 풀린 떡밥 상세 — 공개 시각 + 기대돼요만(내용 0). 액센트는 떡밥 보라.
            const teaserActive = Boolean(
              event.teaser && event.teaserRevealAt && Date.parse(event.teaserRevealAt) > Date.now()
            );
            // 카드와 같은 연속 강도 — 위 10Hz 루프가 CSS 변수로 흘려보낸다. 여기선 '무엇을
            // 그릴지'(문구 전환)만 판단한다. 이산 단계(hs1~hs4)는 폐기.
            const detailHype = teaserActive && detailRemainS !== null && detailRemainS <= HYPE_WINDOW_S;
            const detailFinal = detailHype && (detailRemainS ?? 99) <= 10;
            // 링과 알약은 66~58초 구간에서 함께 존재한다 — 알약은 접히며 사라지고 링은
            // 자라며 들어온다. 한쪽만 있으면 60초에 DOM이 통째로 바뀌어 '띡' 하고 끊긴다.
            const detailRing =
              teaserActive && detailRemainS !== null && detailRemainS <= HYPE_EMERGE_S;
            const detailPill =
              teaserActive && (detailRemainS === null || detailRemainS > HYPE_WINDOW_S - 2);
            // PC 팝오버 좌표(자동 배치 or 드래그 확정) + 액센트 색(대표 태그 1~2색 그라데이션).
            const pos = anchor ? detailManual ?? detailPos : null;
            // 업도움은 띠와 같은 초록 계열로 액센트·선 색을 통일(카드 ↔ 띠 조화).
            const accent1 = support ? "#9cc46f" : teaserActive ? "#c4b5fd" : (detailTags[0]?.bg ?? "#f4b740");
            const accent2 = support ? "#7fb04e" : teaserActive ? "#8b5cf6" : (detailTags[1]?.bg ?? accent1);
            const lineColor = support ? "#6a9c3d" : teaserActive ? "#7c6cf0" : (detailTags[0]?.border ?? "#d3a94f");
            const popStyle: CSSProperties | undefined = anchor
              ? pos
                ? ({
                    left: pos.left,
                    top: pos.top,
                    "--dt-c1": accent1,
                    "--dt-c2": accent2
                  } as CSSProperties)
                : ({ visibility: "hidden", "--dt-c1": accent1, "--dt-c2": accent2 } as CSSProperties)
              : undefined;
            const edge =
              anchor && pos && detailAnchorPt && detailPopSize
                ? detailEdgePoint(pos, detailPopSize, detailAnchorPt)
                : null;
            return (
              <div
                className={`agenda-detail-backdrop${anchor ? " is-pop" : ""}`}
                role="presentation"
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeAgendaDetailAnimated();
                }}
              >
                {/* 카드 → 팝오버 리더 점선 + 카드 쪽 도트(대표 태그 색) — 어느 일정의 상세인지
                    시각으로 잇는다. 드래그로 멀어져도 따라 늘어난다. 카드에 덮이면 선 생략. */}
                {edge && detailAnchorPt ? (
                  <svg
                    aria-hidden="true"
                    className={`detail-anchor-link${detailHype ? " is-hype" : ""}`}
                    style={{ "--dt-line": lineColor } as CSSProperties}
                  >
                    {edge.x === detailAnchorPt.x && edge.y === detailAnchorPt.y ? null : (
                      (() => {
                        const g = leaderGeom(detailAnchorPt, edge);
                        return (
                          <>
                            <defs>
                              <clipPath id="dt-leader-clip">
                                {/* 클립은 흐름 <g>의 조상에 걸어야 한다 — 흐름 요소 자신에게
                                    걸면 클립도 같이 움직여 구간을 못 자른다. */}
                                <rect
                                  height="14"
                                  ref={detailClipRectRef}
                                  width={Math.max(0, g.len)}
                                  x="0"
                                  y="-7"
                                />
                              </clipPath>
                            </defs>
                            <g
                              ref={detailLineGroupRef}
                              transform={`translate(${detailAnchorPt.x} ${detailAnchorPt.y}) rotate(${g.deg})`}
                            >
                              <g clipPath="url(#dt-leader-clip)">
                                <g className="detail-anchor-flow">
                                  {/* 두 선은 굵기·간격이 고정이고 위 선의 opacity만 박동한다
                                      → 굵어졌다 밝아졌다 하는 인상을 컴포지터로만 만든다
                                      (stroke-width/dasharray 애니메이션은 매 프레임 paint). */}
                                  <line className="detail-anchor-base" x1={-11} x2={g.len + 11} y1={0} y2={0} />
                                  <line className="detail-anchor-pulse" x1={-11} x2={g.len + 11} y1={0} y2={0} />
                                </g>
                              </g>
                            </g>
                          </>
                        );
                      })()
                    )}
                    <circle
                      className="detail-anchor-dot"
                      cx={detailAnchorPt.x}
                      cy={detailAnchorPt.y}
                      r={5}
                    />
                  </svg>
                ) : null}
                <div
                  aria-label="일정 상세"
                  aria-modal="true"
                  className={`agenda-detail-sheet${detailDragging ? " pop-dragging" : ""}${
                    detailSnapback ? " pop-snapback" : ""
                  }${
                    detailHype ? " is-hype" : ""
                  }${teaserActive ? " is-teaser" : ""}${detailFinal ? " is-final" : ""}${
                    detailJustRevealed ? " reveal-burst" : ""
                  }`}
                  ref={(el) => {
                    detailSheetRef.current = el;
                    detailDragSheetRef.current = el;
                  }}
                  role="dialog"
                  style={popStyle}
                >
                  {/* PC: 이동 손잡이 그립(액센트 그라데이션 띠) — 잡아 끌면 통째로 이동. */}
                  {anchor ? (
                    <div
                      aria-hidden="true"
                      className="detail-grab"
                      onPointerDown={onDetailDragStart}
                      title="끌어서 이동"
                    >
                      <span />
                    </div>
                  ) : null}
                  {/* 모바일: 손잡이 줄만 끌어서 닫기 그립 존(sticky, 얇게). 날짜줄·X는 본문과 함께 흐른다 —
                      헤더까지 sticky로 두면 X(44px) 때문에 두꺼워져 스크롤 시 제목을 가렸다(사용자 리포트). */}
                  {anchor ? null : (
                    <div className="agenda-detail-top" {...detailDragBind}>
                      {/* 손잡이 = 접근 가능한 닫기 버튼(탭 = 닫기, iOS 그래버 문법). 모바일엔 X가 없다 —
                          손잡이 탭·스와이프·배경 탭·Esc 네 경로면 충분(사용자 결정). 드래그 뒤 꼬리 click은
                          훅의 onClickCapture가 삼킨다. */}
                      <button
                        aria-label="닫기"
                        autoFocus
                        className="agenda-detail-grab"
                        data-act="닫기"
                        onClick={() => {
                          hapticTick();
                          closeAgendaDetailAnimated();
                        }}
                        type="button"
                      >
                        <span />
                      </button>
                    </div>
                  )}
                  <div
                    className="agenda-detail-head"
                    onPointerDown={anchor ? onDetailDragStart : undefined}
                  >
                    {(() => {
                      // 달력과 같은 날짜 규칙(사용자 요청): 요일 표기 + 일요일·공휴일=빨강,
                      // 토요일=파랑, 특별한 날 이름(제헌절·초복 등)은 달력 마크와 같은 톤.
                      const wd = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
                      const mark = getDayMark(dateKey);
                      const isRed = wd === 0 || Boolean(mark?.isHoliday);
                      const tone = isRed ? " red" : wd === 6 ? " saturday" : "";
                      return (
                        <span className="agenda-detail-date">
                          <b className={`agenda-detail-day${tone}`}>
                            {formatShortDate(dateKey)} ({WEEKDAYS[wd]})
                          </b>
                          {end && end !== dateKey ? ` ~ ${formatShortDate(end)}` : ""}
                          {mark?.name ? (
                            <em
                              className={`agenda-mark agenda-detail-mark${mark.isHoliday ? " holiday" : ""}`}
                            >
                              {mark.name}
                            </em>
                          ) : null}
                        </span>
                      );
                    })()}
                    {/* X는 PC 팝오버만(모바일은 손잡이가 닫기). */}
                    {anchor ? (
                      <button
                        aria-label="닫기"
                        autoFocus
                        className="agenda-detail-close"
                        type="button"
                        onClick={() => {
                          hapticTick();
                          setAgendaDetail(null);
                        }}
                        data-act="닫기"
                      >
                        <X aria-hidden="true" size={16} strokeWidth={2.5} />
                      </button>
                    ) : null}
                  </div>
                  {/* 떡밥은 제목 줄 생략 — 카드가 이미 ???를 말했고, 팝오버는 '기대' 무대다
                      (아래 오브가 주인공). 중복 줄이 위계를 흐렸다(사용자 지적). */}
                  {!teaserActive ? (
                    <p className="agenda-detail-title">
                      <span className="adt-text">
                        {!support && event.isTentative ? (
                          <span className="evt-tentative">미정</span>
                        ) : null}
                        {support ? (
                          `${event.supportKind === "period" ? "📌" : "🌱"} ${event.publicTitle}`
                        ) : detailJustRevealed ? (
                          <ScrambleText text={main} />
                        ) : (
                          main
                        )}
                      </span>
                      {/* 관심 단계 배지 — 제목 줄 오른쪽 끝(좌 제목 ↔ 우 배지). 카드 링만으론 관심↔
                          높은↔폭발 구분이 어려워 글자로 명시(사용자). 같은 heartTier 단일 출처,
                          하트 숫자는 비노출. 별도 줄로 두면 좌우 균형이 무너져 제목 줄에 붙인다. */}
                      {(() => {
                        if (support) return null;
                        const t = heartTier(heartCounts[event.id] ?? 0, topEventIds.has(event.id), maxHeart);
                        if (!t) return null;
                        return (
                          <span aria-label={`관심 단계: ${t.label}`} className={`adt-badge tier-${t.key}`}>
                            {t.key === "top" ? "👑 " : null}
                            {t.label}
                          </span>
                        );
                      })()}
                    </p>
                  ) : null}
                  {!support && subs.length > 0 ? (
                    <ul className="agenda-detail-subs">
                      {subs.map((sub, i) => {
                        const rs = revealStagger(detailJustRevealed, main, i);
                        return (
                          <li className={rs.className.trim() || undefined} key={i} style={rs.style}>
                            {sub}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {detailTags.length > 0 ? (
                    <div aria-label="태그" className="agenda-detail-tags">
                      {detailTags.map(({ tag, bg, border, primary }, ti) => (
                        <span
                          className={`agenda-detail-tag${primary ? " primary" : ""}${
                            revealStagger(detailJustRevealed, main, subs.length + 1 + ti).className
                          }`}
                          key={tag.id}
                          style={revealStagger(detailJustRevealed, main, subs.length + 1 + ti).style}
                        >
                          <i
                            aria-hidden="true"
                            style={{ backgroundColor: bg, borderColor: border }}
                          />
                          {tag.displayName}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {support && event.supportUrl ? (
                    <a
                      className={`agenda-link${event.supportKind === "period" ? " period" : ""}`}
                      href={event.supportUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                     data-act="agenda-link">
                      {event.supportKind === "period" ? "자세히 보기" : "도우러 가기"}
                      <ExternalLink aria-hidden="true" size={13} />
                    </a>
                  ) : null}
                  {/* (다시보기 버튼은 일정 상세에서 뺐다 — 2026-08-31 사용자 결정. 진입로는
                      날짜 쪽으로 일원화: PC = 날짜 칸 클릭 팝오버, 모바일 = 날짜 줄 인라인 칩.) */}
                  {/* 떡밥 전용 — 카드엔 없는 정보만: 공개 시각(절대시각) + 기대돼요.
                      카운트다운은 카드가 담당(중복 데이터 없음, 사용자 결정). */}
                  {teaserActive && event.teaserRevealAt ? (
                    /* 한 줄 요약 + 주 동작만 — 각주·여백은 뺐다(사용자 지적: 쓸데없는 설명·빈 공간).
                       오브를 시각 옆에 나란히 둬 세로 낭비를 없애고, 기대돼요가 바로 손에 닿는다. */
                    <div className="detail-teaser">
                      {/* 1분 안쪽 = 팝오버가 '카운트다운 무대'가 된다(계획 안 B: 링 진행률 +
                          중앙 대형 숫자). 링은 물리 시간(60→0)을, 글로우·크기는 강도 곡선을
                          따르므로 정보와 감정이 분리된다. 그 밖에는 공개 시각 알약. */}
                      {detailRing && detailRemainS !== null ? (
                        (() => {
                          // 남은 비율 p. 진행 호는 SVG 원 경로의 시작점(로컬 3시 방향)에서
                          // 시계방향으로 길이 p만큼 그려진다 → 호의 '끝'은 시작점에서 360p°다.
                          // 별을 12시에서 출발시키면 정확히 90° 어긋난다(사용자 지적한 그 버그).
                          const p = Math.max(0, Math.min(1, detailRemainS / HYPE_WINDOW_S));
                          const deg = 360 * p;
                          // 눈금 12개(5초 간격) — 남은 호 안에 있는 것만 켠다. 시계 문자판처럼
                          // '얼마나 남았는지'를 숫자 없이도 읽히게 하고, 빈 원의 허전함을 없앤다.
                          const ticks = Array.from({ length: 12 }, (_, k) => k / 12);
                          return (
                        <div className={`dt-count${detailFinal ? " is-final" : ""}`}>
                          {/* 링과 라벨은 형제다 — 예전엔 라벨이 링 안에 absolute로 얹혀 있어
                              원 아래쪽 좁은 현(chord)에서 링 stroke와 겹쳤다(글씨 가림 버그).
                              숫자를 줄여도 안 풀리는 기하 문제라 라벨을 링 밖 독립 행으로 뺐다. */}
                          <div className="dt-count-ringbox">
                          {/* 여운 — 마지막 10초, 초가 바뀔 때마다 링에서 파문이 한 번 퍼진다.
                              key로 매초 다시 마운트되므로 1초에 정확히 한 번이다(점멸 예산 안전).
                              흔들림이 멎은 자리에 이 파문만 남아 '고요한데 더 크게' 들린다. */}
                          {detailFinal ? (
                            <span aria-hidden="true" className="dt-echo" key={detailRemainS} />
                          ) : null}
                          <svg aria-hidden="true" className="dt-ring" viewBox="0 0 100 100">
                            <defs>
                              {/* 호를 따라 색이 흐른다 — 단색 바보다 깊이가 생긴다. */}
                              <linearGradient id="dt-ring-grad" x1="0" x2="1" y1="0" y2="1">
                                <stop className="dt-grad-a" offset="0%" />
                                <stop className="dt-grad-b" offset="55%" />
                                <stop className="dt-grad-c" offset="100%" />
                              </linearGradient>
                            </defs>
                            <circle className="dt-ring-track" cx="50" cy="50" r="44" />
                            <circle
                              className="dt-ring-progress"
                              cx="50"
                              cy="50"
                              pathLength={1}
                              r="44"
                              style={{ strokeDasharray: 1, strokeDashoffset: 1 - p }}
                            />
                            {/* 눈금은 바 '위에' 새긴다(반지름 41.8~46.2 = stroke 폭 40.5~47.5 안).
                                안쪽에 두면 링박스 후광의 경계와 겹쳐 숫자 주변에 묻혀 버렸다.
                                진행 호 뒤에 그려야 채워진 구간에서도 새김눈이 보인다. */}
                            <g className="dt-ring-ticks">
                              {ticks.map((f) => (
                                <line
                                  className={f <= p ? "on" : undefined}
                                  key={f}
                                  transform={`rotate(${360 * f} 50 50)`}
                                  /* ⚠ x는 '반지름'이 아니라 좌표다(중심 50). 반지름 41.8을
                                     쓰려면 50+41.8 = 91.8이어야 한다. 예전엔 41.8을 그대로
                                     넣어 반지름 8.2 — 숫자 한가운데에 눈금 12개가 뭉쳐 있었다. */
                                  x1="91.8"
                                  x2="96.2"
                                  y1="50"
                                  y2="50"
                                />
                              ))}
                            </g>
                            {/* 진행 끝을 따라가는 별 + 꼬리 — 캔버스 없이 SVG만. 기준점은 경로
                                시작점(94,50)이고 회전량은 호 길이와 같은 360p°라 항상 붙어 있다. */}
                            {[
                              { k: 1, off: -4, cls: "dt-ring-trail t1" },
                              { k: 0, off: 0, cls: "dt-ring-spark" }
                            ].map(({ k, off, cls }) => (
                              <circle
                                className={cls}
                                cx="94"
                                cy="50"
                                key={k}
                                r={3.2 - k * 0.7}
                                style={{
                                  transform: `rotate(${deg + off}deg)`,
                                  transformOrigin: "50px 50px"
                                }}
                              />
                            ))}
                          </svg>
                          {/* 숫자만 — '초'를 붙이면 두 글자의 무게 때문에 숫자가 원 중심에서
                              왼쪽으로 밀려 보였다(사용자 지적). 자릿수가 줄면 그때그때 다시
                              가운데로 온다(고정 슬롯 없음). */}
                          <div className="dt-count-core">
                            <strong key={detailRemainS}>{detailRemainS}</strong>
                          </div>
                          </div>
                          <p className="dt-count-label">
                            {detailFinal ? "곧 공개!" : "최초공개까지"}
                          </p>
                          {/* 링이 공개 시각 알약을 밀어냈으니 그 정보를 여기서 되살린다. */}
                          <p className="dt-count-when">
                            {formatRevealClockKst(event.teaserRevealAt)}
                          </p>
                        </div>
                          );
                        })()
                      ) : null}
                      {detailPill ? (
                        <p className="dt-when">
                          <span aria-hidden="true" className="dt-orb">
                            🔮
                          </span>
                          <b>{formatRevealKst(event.teaserRevealAt)}</b>
                          <em>공개</em>
                        </p>
                      ) : null}
                      <button
                        aria-pressed={myHopeIds.has(event.id)}
                        className={`dt-hope${myHopeIds.has(event.id) ? " on" : ""}`}
                        onClick={() => toggleHope(event)}
                        type="button"
                       data-act="dt-hope">
                        {myHopeIds.has(event.id) ? "기대 중" : "기대돼요"}
                        {hopeCountOf(event) > 0 ? <b>{hopeCountOf(event)}</b> : null}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })()
        : null}
      {/* 시청자 '이 달 기록' — 공개 데이터만(공개 일정·태그·하트 집계·방송시간 집계 RPC).
          방문자/동시접속 같은 운영 지표는 안 들어간다. fixed 오버레이라 캡쳐 PNG 밖. */}
      {insightsOpen ? (
        <PublicInsights
          events={liveEvents}
          heartCounts={heartCounts}
          month={view.month}
          onClose={() => setInsightsOpen(false)}
          palette={schedule.palette}
          tags={schedule.tags}
          year={view.year}
        />
      ) : null}
      {/* 시청자 화면 미리보기(꾸미기 아님) — 아바타 컨트롤을 페이지 좌상단(absolute)에 둔다. 헤더에
          두면 켜고 끌 때 shell 폭이 전체폭↔가운데로 바뀌며 좌우로 흔들려 버튼이 따라 움직였다.
          viewport 고정(fixed)은 스크롤을 따라 내려와 달력을 가려서 뺐다 — 페이지와 함께 스크롤된다.
          켜짐엔 끄기+위치(왼/오른쪽), 꺼짐엔 켜기. 데스크탑·관리자 전용. */}
      {avatarCapable && !avatarFixed && !showAgenda ? (
        <div className="avatar-ctl avatar-ctl-preview" role="group" aria-label="아바타 자리 설정(관리자 전용)">
          <button
            type="button"
            className={`avatar-ctl-toggle ${avatarOn ? "on" : ""}`}
            aria-pressed={avatarOn}
            onClick={toggleAvatarOn}
           data-act="avatar-ctl-toggle">
            🎙️ 아바타 자리 {avatarOn ? "끄기" : "켜기"}
          </button>
          {avatarOn ? (
            <div className="avatar-ctl-side" role="group" aria-label="아바타 위치">
              <button
                type="button"
                className={avatarSide === "left" ? "on" : ""}
                aria-pressed={avatarSide === "left"}
                onClick={() => pickAvatarSide("left")}
              >
                왼쪽
              </button>
              <button
                type="button"
                className={avatarSide === "right" ? "on" : ""}
                aria-pressed={avatarSide === "right"}
                onClick={() => pickAvatarSide("right")}
              >
                오른쪽
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {celebrate ? (
        <div className="celebrate-overlay" aria-hidden="true">
          {confetti.map((c, i) => (
            <span
              className="confetti"
              key={i}
              style={{
                left: `${c.left}%`,
                background: c.color,
                animationDelay: `${c.delay}ms`,
                animationDuration: `${c.dur}ms`
              }}
            />
          ))}
          <div className="celebrate-toast">🎉 {todayCelebration}</div>
        </div>
      ) : null}
      {bursts.length > 0 ? (
        // 빵빠레 폭죽 — fixed 레이어(export 표면 밖, 클릭 통과). 탭 지점에서 방사형으로 터진다.
        <div className="burst-layer" aria-hidden="true">
          {bursts.map((b) => (
            <div className={`burst${b.big ? " big" : ""}`} key={b.id} style={{ left: b.x, top: b.y }}>
              {b.big ? <span className="burst-core">🏆</span> : null}
              {b.bits.map((bit, i) => (
                <span
                  className={`burst-bit${bit.emoji ? " emoji" : ""}`}
                  key={i}
                  style={
                    {
                      "--dx": `${bit.dx}px`,
                      "--dy": `${bit.dy}px`,
                      "--rot": `${bit.rot}deg`,
                      animationDuration: `${bit.dur}ms`,
                      background: bit.emoji ? undefined : bit.color
                    } as CSSProperties
                  }
                >
                  {bit.emoji}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {floaters.length > 0 ? (
        <div className="heart-floaters" aria-hidden="true">
          {floaters.map((f) => (
            <span
              className="heart-floater"
              key={f.id}
              style={
                {
                  left: f.x,
                  top: f.y,
                  fontSize: f.size,
                  animationDuration: `${f.dur}ms`,
                  animationDelay: `${f.delay}ms`,
                  "--dx": `${f.dx}px`
                } as CSSProperties
              }
            >
              ♥
            </span>
          ))}
        </div>
      ) : null}
      <section className={`public-calendar-shell ${showAgenda ? "agenda-mode" : ""}`}>
        {showAgenda ? (
          <header className="agenda-header">
            {/* 시청자 미리보기 진입 시 — 제목 왼쪽 여백 칸에 안내(작게). */}
            {previewNote ? <span className="agenda-preview-left">{previewNote}</span> : null}
            <h1 className="agenda-title">
              <span className="title-spark" aria-hidden="true">✨️</span>
              빅토리 일정표
              <span className="title-spark" aria-hidden="true">✨️</span>
            </h1>
            {/* 미리보기 이동 버튼(편집실)은 제목 우측이 아니라 색상 필터 박스 아래로 옮겼다(엄지존). */}
            {accountSwitch ? (
              // 이 헤더는 모바일 전용(agenda-header, showAgenda=isNarrow). 익명 로그인은
              // /api/auth/login으로 바로 POST하되, 클릭 시점에 handleMobileLogin이 환경을
              // 분기한다 — 일반 브라우저는 그대로 제출(곧장 구글 계정 선택창), 안드로이드 웹뷰는
              // 크롬 인텐트, iOS 웹뷰는 /login 외부 브라우저 안내 카드로 보낸다.
              <form
                action={anonymous ? "/api/auth/login" : "/api/auth/logout"}
                className="agenda-account"
                method="post"
              >
                {anonymous ? <input name="next" type="hidden" value="/" /> : null}
                <button
                  className={anonymous ? "agenda-login" : "agenda-logout"}
                  onClick={(e) => {
                    if (anonymous) handleMobileLogin(e);
                  }}
                  type="submit"
                >
                  {anonymous ? (
                    <>
                      <LogIn aria-hidden="true" size={12} strokeWidth={2.5} />
                      <span>로그인</span>
                    </>
                  ) : (
                    <>
                      <LogOut aria-hidden="true" size={12} strokeWidth={2.5} />
                      <span>로그아웃</span>
                    </>
                  )}
                </button>
              </form>
            ) : null}
            <span className="agenda-month">
              {view.year}년 {view.month}월
            </span>
            {accountSwitch && accountEmail ? (
              <PlainEmail className="account-email agenda-email" title={accountEmail} value={accountEmail} />
            ) : null}
          </header>
        ) : null}
        {showAgenda ? null : (
          <header className="public-calendar-header">
            <div className="header-left">
              {/* 달력 꾸미기 꺼짐 상태 켜기 토글만 헤더에 둔다. 시청자 미리보기는 켜짐/꺼짐 모두 좌상단
                  고정 오버레이(.avatar-ctl-preview)로 뺀다 — 헤더는 shell 폭이 토글마다 바뀌며 좌우로
                  흔들려 버튼이 따라 움직였다(fixed면 안 흔들림). */}
            </div>

            {/* 월 이동은 시청자·꾸미기 모두 하단 플로팅 < > 바로 통일(달력 보며 넘기기 편하게).
                현재 월 표시는 포스터 제목(✨️ … N월)에 이미 있어 헤더 가운데는 비어 있다.
                그 가운데 자리에 '내 관심(♥)' 토글을 둔다 — 계정변경/미리보기 바와 같은 줄이라
                세로 공간을 안 먹어 포스터가 줄지 않고, 포스터 표면(캡쳐 캔버스) 밖이라 스티커
                좌표도 안전하다. 상호작용(시청자/미리보기) 모드에서만(꾸미기·캡쳐 제외). */}
            {interactive ? (
              <div className="poster-interest">
                {canHeart ? (
                  <button
                    aria-pressed={bookmarkedOnly}
                    className={`interest-toggle ${bookmarkedOnly ? "active" : ""}`}
                    onClick={() => {
                      hapticTick();
                      withAgendaFlip(() => setBookmarkedOnly((v) => !v));
                    }}
                    title="내가 ♥ 누른 일정만 모아서 보기"
                    type="button"
                   data-act="관심 일정만 보기">
                    <LiquidHeart ratio={interestRatio} />
                    <span className="it-text">
                      <strong>내 관심</strong>
                      <em>♥ 누른 일정만 모아보기</em>
                    </span>
                  </button>
                ) : null}
                {/* 서비스 제목 — 포스터 표면에서 크롬 중앙(내 관심 ↔ 이 달 기록 사이)으로 이동
                    (2026-07-31). 표면 밖이라 캡쳐에 안 찍히고(PNG는 연·월만), 스티커 좌표 불침범. */}
                <h1 className="poster-chrome-title">
                  <span aria-hidden="true" className="title-spark">✨️</span>
                  {schedule.calendar.title}
                  <span aria-hidden="true" className="title-spark">✨️</span>
                </h1>
                {/* '이 달 기록' — 비로그인 시청자도 볼 수 있다. 좌상단(미니게임·아바타)·우상단(로그인)·
                    좌우 화살표(월 이동)·하단(미니게임 컨트롤)과 안 겹치는 상단 중앙 크롬 자리. */}
                <button
                  className="insights-open"
                  data-act="open-insights"
                  onClick={() => {
                    hapticTick();
                    setInsightsOpen(true);
                  }}
                  title="이 달 방송·일정 기록 보기"
                  type="button"
                >
                  📊 이 달 기록
                </button>
              </div>
            ) : null}

            {/* 편집실로 돌아가기 + 시청자 화면 보기(미리보기 토글)는 우측 상단(계정변경 옆)에 둔다. */}
            <div className="viewer-actions">
              {accountSwitch ? (
                // 웹 헤더는 데스크톱 전용(public-calendar-header) — 웹뷰가 없으니 익명 로그인은
                // /api/auth/login으로 바로 OAuth를 시작한다(/login 디투어·Chrome 유도 불필요).
                <form
                  className="account-form"
                  action={anonymous ? "/api/auth/login" : "/api/auth/logout"}
                  method="post"
                >
                  {anonymous ? <input name="next" type="hidden" value="/" /> : null}
                  {!anonymous && accountEmail ? (
                    <PlainEmail className="account-email" title={accountEmail} value={accountEmail} />
                  ) : null}
                  <button className="button" data-act={anonymous ? "login" : "logout"} type="submit">
                    {anonymous ? "로그인" : "로그아웃"}
                  </button>
                </form>
              ) : null}
            </div>
          </header>
        )}

        {showAgenda ? renderAgenda() : null}

        {showAgenda ? null : (
        <div className="poster-fit" ref={posterFitRef}>
        <div
          className="poster-stage"
          ref={posterStageRef}
          style={{ height: posterNaturalH * posterScale }}
        >
        <div
          className="poster-scaler"
          ref={posterScalerRef}
          style={
            {
              "--poster-scale": posterScale,
              width: POSTER_DESIGN_W
            } as CSSProperties
          }
        >
        <section
          className={`poster-surface${popIntro ? " pop-intro" : ""}`}
          data-enter={monthDir}
          data-export-surface
          data-poster-theme={effectivePosterTheme}
          key={`surface-${view.year}-${view.month}`}
        >
          {/* (상단 마스트헤드 제거 — 2026-07-31 사용자 결정 2차. 연·월은 오른쪽 레일 정보
              카드로 이동, 빈 세로 공간만큼 달력이 커진다. 서비스 제목은 상단 크롬에.) */}

          {/* (메모지 컬럼 삭제 — 2026-07-31 사용자 결정. 거의 안 쓰여 왼쪽 238px를 달력에
              돌려줬다. 모든 모드(시청자·꾸미기·캡쳐)가 같은 2컬럼 지오메트리라 스티커 비율
              좌표는 모드 간 일치. 과거 달에 메모지 위에 붙였던 스티커는 그대로 둔다 — 위치가
              어색하면 꾸미기에서 직접 옮긴다.) */}
          <section
            className="public-calendar-area"
            ref={posterCalRef}
            style={{ "--cal-zoom": posterZoom } as CSSProperties}
          >
            <div className="weekday-row" aria-hidden="true">
              {WEEKDAYS.map((weekday, index) => (
                <span
                  className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""}
                  key={weekday}
                >
                  {weekday}
                </span>
              ))}
            </div>

            <div className="public-month-grid" aria-label="월간 공개 일정" ref={setMonthGridRef}>
              {cells.map((cell, i) => renderDayCell(cell, i))}
            </div>
          </section>

          {/* 표면 안 오른쪽 레일 — 아바타 scene에선 접힌다(컬럼 폭 0, CSS). 내용은 아바타
              자리(정보·라이브 카드)와 반대편 얇은 레일(태그 필터)로 이사. */}
          <aside
            className="public-right"
            aria-label="방송 정보와 색상 안내"
            aria-hidden={avatarCapable && avatarOn ? true : undefined}
          >
            {/* 레일 정보 카드 — 데뷔 D+N · 오늘 날짜(마크업은 railInfoCard 공용). */}
            {railInfoCard}

            {/* 라이브 카드 — 라이브 중에만 렌더. 아바타 scene에선 아바타 자리 우상단으로
                이사하므로 여기선 내리고(중복 iframe 방지), 평소엔 정보 카드 아래·필터 위. */}
            {!(avatarCapable && avatarOn) ? (
              <SoopLiveBeacon inRail live={soopLive} />
            ) : null}

            {renderLegendFilter(true)}
          </aside>
        </section>
        </div>
        </div>
        {/* 스트리머 scene: avatar 박스는 화면 옆 1/4 고정. 표면 안 레일은 접히고(컬럼 0)
            정보 카드는 아바타 자리 좌상단, 라이브 카드는 우상단으로 이사(2026-07-31 사용자
            결정 — 캡쳐 삭제로 표면 고정 레이아웃 제약 해제, 달력이 표면 전체를 쓴다). */}
        {avatarCapable ? (
          <aside className="avatar-slot" aria-label="버츄얼 스트리머 아바타 자리(관리자 전용)">
            {avatarOn ? (
              // key=side — 좌우 전환 때 remount로 팝인 모션이 다시 재생된다.
              <div className="avatar-top-cards" key={`atc-${avatarSide}`}>
                {railInfoCard}
                <SoopLiveBeacon inRail live={soopLive} />
              </div>
            ) : null}
            <div className="avatar-dock-inner">
              <span className="avatar-slot-hint">아바타 자리</span>
            </div>
          </aside>
        ) : null}
        {/* scene 전용 얇은 태그 필터 레일 — 아바타 반대편 끝에 1열로(인기도 안내까지).
            표면 밖 fixed 크롬이라 달력(표면)은 그만큼 더 커진다. */}
        {avatarCapable && avatarOn ? (
          <aside
            aria-label="태그 필터(아바타 배치)"
            className="avatar-side-rail"
            key={`asr-${avatarSide}`}
          >
            {renderLegendFilter(false, true)}
          </aside>
        ) : null}
        </div>
        )}
      </section>

      {/* 확대 중 배율 표시(편집실과 같은 문법) — 하단 중앙 플로팅, 누르면 100%로 복귀.
          '맨 위로' 버튼(하단 중앙)보다 위에 떠 안 겹친다. 100%에선 사라진다. */}
      {posterZoom > 1 ? (
        <button
          className="poster-zoom-float"
          onClick={() => {
            hapticTick();
            setPosterZoom(1);
          }}
          title="100%로 되돌리기"
          type="button"
         data-act="확대 초기화">
          🔍 {Math.round(posterZoom * 100)}%<span>초기화</span>
        </button>
      ) : null}

      {/* 월 이동 버튼을 하단 좌·우에 띄운다(가운데는 비워 '맨 위로' 버튼과 안 겹치게).
          시청자·아젠다·꾸미기 모두 — 달력을 보며 월을 넘기기 쉽게(HCI). 상단 월 pill은 폐지. */}
      <nav className="agenda-monthbar" aria-label="월 이동">
        {/* 스와이프(2629)는 톡이 울리는데 화살표는 맨손이었다 — 같은 동작은 같은 감촉.
            톡은 moveMonth 안이 아니라 여기서 울린다(안에 넣으면 jumpToday·스와이프가 두 번 울린다). */}
        <button
          className="mb-step"
          onClick={() => {
            hapticTick();
            moveMonth(-1);
          }}
          title="이전 달"
          type="button"
         data-act="이전 달">
          <ChevronLeft aria-hidden="true" size={22} />
        </button>

        {/* 모바일 엄지 영역: 자주 쓰는 관심·오늘을 하단 가운데로(웹은 헤더에 따로 있어 숨김). */}
        {isNarrow ? (
          <div className="mb-center">
            {interactive ? (
              // 위치 보존을 위해 '오늘'과 함께 항상 자리에 두되, 비로그인(익명)이면
              // 관심(서버 1인1하트)은 못 쓰므로 회색 비활성으로 둔다.
              <button
                aria-pressed={canHeart ? bookmarkedOnly : undefined}
                className={`mb-act ${canHeart && bookmarkedOnly ? "on" : ""}`}
                disabled={!canHeart}
                onClick={() => {
                  if (!canHeart) return;
                  hapticTick();
                  withAgendaFlip(() => setBookmarkedOnly((v) => !v));
                }}
                title={canHeart ? "내가 ♥ 누른 일정만 보기" : "로그인하면 관심 일정을 모아볼 수 있어요"}
                type="button"
               data-act="mb-act">
                <Heart aria-hidden="true" size={18} />
                <span>관심</span>
              </button>
            ) : null}
            {/* '오늘' 버튼: 다른 달이면 오늘로 이동. 이미 오늘 달이라 이동이 무의미한데 방송 중이면,
                그 자리를 'LIVE'(보러가기)로 재활용한다 — 모바일 상단이 버튼으로 붐벼 따로 못 두므로. */}
            {/* D3(2026-08-27): '오늘'과 LIVE는 **한 요소**가 변신한다(다이나믹 아일랜드 문법) — 방송이 켜지는
                순간 같은 자리가 빨강으로 차오르며 젤리 팝(--spring-bouncy) + 햅틱, 내용은 크로스페이드.
                두 요소를 갈아끼우던 이전 방식은 '뿅' 교체였다. */}
            {(() => {
              const live = Boolean(soopLive?.isLive && todayVisible);
              return (
                <button
                  className={`mb-act${live ? " live" : ""}${liveJustOn ? " just-live" : ""}`}
                  onClick={() => {
                    if (live) {
                      if (!soopLive?.watchUrl) return;
                      hapticTick();
                      window.open(soopLive.watchUrl, "_blank", "noopener,noreferrer");
                      return;
                    }
                    jumpToday();
                  }}
                  title={live ? `방송 중: ${soopLive?.title ?? ""} — 보러가기` : onTodayMonth ? "오늘 위치로" : "오늘이 있는 달로"}
                  type="button"
                  data-act="mb-act"
                >
                  {live ? (
                    <>
                      <span className="mb-live-dot" aria-hidden="true" />
                      <span>LIVE</span>
                    </>
                  ) : (
                    <>
                      <CalendarCheck aria-hidden="true" size={18} />
                      <span>오늘</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        ) : null}

        <button
          className="mb-step"
          onClick={() => {
            hapticTick();
            moveMonth(1);
          }}
          title="다음 달"
          type="button"
         data-act="다음 달">
          <ChevronRight aria-hidden="true" size={22} />
        </button>
      </nav>
    </main>
  );
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");

  return `${Number(month)}.${Number(day)}`;
}

// 다시보기 길이(ms) → "5시간 12분" / "45분". 초는 버린다 — 칩에서 초 단위는 소음이다.
function formatVodDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return "";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
