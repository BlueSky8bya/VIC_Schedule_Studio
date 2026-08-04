"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BringToFront,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  FlipHorizontal,
  FlipVertical,
  Heart,
  Keyboard,
  Lock,
  LogIn,
  LogOut,
  Redo2,
  SendToBack,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  X
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
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
import { StickerLayer, TEXT_FONT_STACK } from "@/components/poster/sticker-layer";
import { logActivity } from "@/lib/activity/client";
import { useSectionActivity } from "@/lib/activity/use-section";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만 존중
// 월드컵 장난감(공 미니게임 + 중력 공)은 월드컵 달에만 렌더되는데 정적 import라 6,400여 줄
// (컴포넌트 + lib/football/*)이 시청자 첫 로드 번들에 1년 내내 들어 있었다. 아래 꾸미기 UI와
// 같은 방식으로 지연 로드한다(ssr:false — 장난감이라 SSR 불필요).
const WorldCupBallGoal = dynamic(
  () => import("@/components/seasonal/worldcup-ball-goal").then((m) => m.WorldCupBallGoal),
  { ssr: false }
);
const WorldCupStudioBall = dynamic(
  () => import("@/components/seasonal/worldcup-studio-ball").then((m) => m.WorldCupStudioBall),
  { ssr: false }
);
// 꾸미기 전용 UI는 decorate일 때만 렌더된다 → 지연 로드로 시청자(공개 /) 번들서 제외(ssr:false:
// 사용자 동작으로 여는 꾸미기 화면이라 SSR 불필요, 진입 시 잠깐 로드).
const ThemeSwitch = dynamic(
  () => import("@/components/poster/theme-switch").then((m) => m.ThemeSwitch),
  { ssr: false }
);
const DecoratePalette = dynamic(
  () => import("@/components/poster/decorate-palette").then((m) => m.DecoratePalette),
  { ssr: false }
);
// '이 달 기록' 시트 — 열 때만 로드(시청자 첫 페인트 번들에서 제외).
const PublicInsights = dynamic(
  () => import("@/components/poster/public-insights").then((m) => m.PublicInsights),
  { ssr: false }
);
import {
  STICKER_ANIMS,
  shapeDefaultColor,
  type PublicSchedule,
  type PublicScheduleEvent,
  type StickerAsset,
  type StickerAssetKind,
  type StickerInstance
} from "@/lib/domain/schedule-types";
import type { AssetTabKey } from "@/components/poster/decorate-palette";
import type { ThemeResult } from "@/lib/schedules/theme-actions";
import type { SaveStickerInput, StickerResult } from "@/lib/schedules/sticker-actions";
import type {
  StickerAssetOpResult,
  StickerAssetResult
} from "@/lib/schedules/sticker-asset-actions";
import { getAnonHeartIdsAction, type HeartResult } from "@/lib/schedules/heart-actions";
import { revealTeaserAction } from "@/lib/schedules/teaser-actions";
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
import { heartTier } from "@/lib/schedules/heart-tiers";
import { debutDPlus, getDayMark, withoutWorldCupMark } from "@/lib/calendar/holidays";
import { isWorldCupMonth } from "@/lib/calendar/worldcup";
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
  nowKstHm,
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
import { captureFlip, playFlip } from "@/lib/ui/list-flip";
import { popInnerOverlay, pushInnerOverlay } from "@/lib/ui/overlay-pop";
import { writeViewCookie } from "@/lib/ui/view-cookie";
import { useWorldCupVisibility } from "@/lib/ui/use-worldcup-visibility";
import { SoopLiveBeacon } from "@/components/poster/soop-live-beacon";
import { useSoopLive } from "@/components/poster/use-soop-live";
import { createWheelStepper, normalizeWheelDelta, stepCalZoom } from "@/lib/ui/calendar-zoom";
// 포스터 CSS는 이 컴포넌트와 함께 로드(루트 레이아웃 전역 import 제거에 대응). PublicPoster가 쓰이는
// 곳(공개 /, 꾸미기, 스튜디오 시청자 미리보기)에서만 실린다.
import "./public-poster.css";

// (일정표 캡쳐(클립보드/PNG 다운로드) 기능 삭제 — 2026-07-31 사용자 결정: 토리님이 안 씀.
//  PosterExportActions 컴포넌트·html2canvas 경로 제거. 필요해지면 git 이력에 구현이 있다.)

// 스티커 일괄 저장/삭제 액션의 응답 모양(별도 export가 없어 여기 한 곳에 정의해 재사용).
type StickerBatchResult =
  | { ok: true; ids: string[] }
  | { ok: true }
  | { ok: false; error: string };

type PublicPosterProps = {
  schedule: PublicSchedule;
  initialYear?: number;
  initialMonth?: number;
  // 월을 바꿀 때 부모(편집실)에 알린다 — 시청자 미리보기에서 본 달을 편집실로 돌아갈 때 잇기 위함.
  onViewChange?: (year: number, month: number) => void;
  // (canExport 삭제 — 일정표 캡쳐 기능 제거, 2026-07-31.)
  decorate?: boolean;
  // 꾸미기에서 "시청자 화면 보기" 중이었는지(새로고침 복원용 초기값).
  initialPreviewing?: boolean;
  // 서버 UA 판정 휴대폰 여부 — 모바일 아젠다를 처음부터 그려 깜빡임을 없앤다(클라가 보정).
  initialNarrow?: boolean;
  saveStickerAction?: (input: SaveStickerInput) => Promise<StickerResult>;
  deleteStickerAction?: (id: string) => Promise<StickerResult>;
  // 다중 동작(다중 삭제·undo/redo)을 한 번에 저장/삭제 — 권한확인·캐시무효화를 1회로 묶는다.
  saveStickerBatchAction?: (
    inputs: SaveStickerInput[]
  ) => Promise<{ ok: true; ids: string[] } | { ok: false; error: string }>;
  deleteStickerBatchAction?: (
    ids: string[]
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  uploadStickerAssetAction?: (formData: FormData) => Promise<StickerAssetResult>;
  deleteStickerAssetAction?: (id: string) => Promise<StickerAssetResult>;
  setPosterThemeAction?: (theme: string) => Promise<ThemeResult>;
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
  // 편집실 미리보기에서는 관리자 토글 상태를 직접 받는다. 일반 공개 화면은 기기별 저장값 사용.
  showWorldCupFeatures?: boolean;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
function trimTitle(title: string, max = 14) {
  const line = title.split("\n")[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
const POSTER_DESIGN_W = 1840;
const POSTER_DESIGN_H = Math.round((POSTER_DESIGN_W * 9) / 16); // 1035 (16:9)

// 관심 단계 순위(높을수록 인기). 한 칸의 "대표 인기 단계"를 고를 때 쓴다.
const POP_RANK: Record<string, number> = { warm: 1, hot: 2, blaze: 3, top: 4 };

// (P2-KST-1: nowKstHm은 lib/calendar/month.ts 단일 출처에서 import — 편집실과 동일 모양.)

// StickerInstance → 저장 입력(SaveStickerInput). 배치/단건 저장이 같은 매핑을 쓰게 모은다.
// year/month는 호출 맥락에 따라 다름(수정=현재 보기 월, 재삽입=스티커 자체 월)이라 인자로 받는다.
function stickerToSaveInput(
  s: StickerInstance,
  year: number,
  month: number,
  withId: boolean
): SaveStickerInput {
  return {
    id: withId ? s.id : undefined,
    year,
    month,
    emoji: s.kind === "emoji" ? s.label : undefined,
    assetId: s.kind === "image" ? s.assetId : undefined,
    shapeKey: s.kind === "shape" ? s.shapeKey : undefined,
    text: s.kind === "text" ? s.label : undefined,
    textColor: s.textColor,
    fontWeight: s.fontWeight,
    fontFamily: s.fontFamily,
    textAlign: s.textAlign,
    textBg: s.textBg,
    textFx: s.textFx,
    italic: s.italic,
    outline: s.outline,
    shadow: s.shadow,
    anim: s.anim,
    locked: s.locked,
    xRatio: s.xRatio,
    yRatio: s.yRatio,
    widthRatio: s.widthRatio,
    rotationDeg: s.rotationDeg,
    flipX: s.flipX,
    flipY: s.flipY,
    opacity: s.opacity,
    zIndex: s.zIndex
  };
}

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
function TeaserRevealing({ onReveal, className }: { onReveal: () => void; className: string }) {
  const fired = useRef(false);
  const ref = useRef(onReveal);
  ref.current = onReveal;
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
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

// 추천 이모지 팔레트 — 카테고리 탭으로 나눠 관리(#5b). 종류를 대폭 확충.
const EMOJI_CATEGORIES: { key: string; label: string; emojis: string[] }[] = [
  {
    key: "face",
    label: "표정",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "🫠", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚",
      "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
      "🫢", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶",
      "🫥", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "🫨", "😌",
      "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
      "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎",
      "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲",
      "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭",
      "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡",
      "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺",
      "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽",
      "🙀", "😿", "😾", "🙈", "🙉", "🙊", "💋"
    ]
  },
  {
    key: "hand",
    label: "손짓·사람",
    emojis: [
      "👍", "👎", "👏", "🙌", "🙏", "🤝", "✌️", "🤟", "🤙", "👋",
      "💪", "🦾", "🫶", "👌", "🤌", "🤏", "🤞", "🫰", "✊", "👊",
      "🤛", "🤜", "🖐️", "✋", "🖖", "🫲", "🫱", "👐", "🤲", "🫳",
      "🫴", "☝️", "👆", "👇", "👈", "👉", "✍️", "🤚", "🖕", "🦵",
      "🦶", "👂", "👃", "👀", "👁️", "👄", "🦷", "🧠", "🫀", "🗣️",
      "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧓", "👮", "🦸",
      "🦹", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧟", "💃", "🕺",
      "👯", "🧖", "🧗", "🏃", "🚶", "🧘", "👫", "👬", "👭", "👪"
    ]
  },
  {
    key: "heart",
    label: "하트",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "🩷",
      "🩵", "🩶", "💖", "💕", "💗", "💓", "💞", "💘", "💝", "💟",
      "❣️", "💌", "💋", "❤️‍🔥", "❤️‍🩹", "💔", "♥️", "💑", "💏", "🫶",
      "😍", "🥰", "😘", "💐", "🌹", "💒", "😻", "😽", "🫂", "👩‍❤️‍👨",
      "👩‍❤️‍💋‍👨", "🥹"
    ]
  },
  {
    key: "spark",
    label: "반짝·기호",
    emojis: [
      "⭐", "🌟", "✨", "💫", "⚡", "🔥", "💥", "🌈", "💯", "❗",
      "❕", "‼️", "⁉️", "💢", "💦", "💨", "🕳️", "💬", "💭", "🗯️",
      "♨️", "🌀", "✅", "✔️", "❌", "⭕", "🚫", "❓", "❔", "❎",
      "➕", "➖", "➗", "✖️", "🟰", "💲", "💱", "⚠️", "🔱", "♻️",
      "🔰", "✳️", "✴️", "❇️", "🆗", "🆕", "🆒", "🆙", "🔟", "🔢",
      "▶️", "⏸️", "⏯️", "⏹️", "🔼", "🔽", "⏫", "⏬", "🔀", "🔁",
      "🔂", "🔄", "🔃", "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↩️",
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟥", "🟦"
    ]
  },
  {
    key: "party",
    label: "축하·놀이",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎀", "🥇", "🥈", "🥉", "🏆", "🏅",
      "🎖️", "🎯", "🎮", "🕹️", "🎲", "🃏", "🀄", "🧩", "🎰", "🎳",
      "🎫", "🎟️", "🪅", "🪩", "🎏", "🎐", "🧧", "🎆", "🎇", "🧨",
      "🎄", "🎃", "🎗️", "🎠", "🎡", "🎢", "🎪", "🤹", "🎭", "🪄",
      "🧸", "🪀", "🪁", "🔮", "🎴", "🥏", "🪃", "🛝", "🎺", "📣"
    ]
  },
  {
    key: "music",
    label: "음악·취미",
    emojis: [
      "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🎸", "🪕",
      "🎻", "🪗", "📯", "🎙️", "🎚️", "🎛️", "🎬", "📷", "📸", "📹",
      "🎥", "📽️", "🎨", "🖌️", "🖍️", "🖊️", "🖋️", "✏️", "📝", "📚",
      "📖", "📕", "📗", "📘", "📙", "🏀", "⚽", "🏈", "⚾", "🥎",
      "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🥊", "🥋",
      "⛳", "🏌️", "⛸️", "🎣", "🤿", "🛹", "🛼", "🛷", "🥌", "🎽",
      "🏆", "🚴", "🏊", "🏄", "🧗", "🤸", "⛷️", "🏂", "🏋️", "🤺"
    ]
  },
  {
    key: "animal",
    label: "동물",
    emojis: [
      "🐰", "🐱", "🐶", "🐻", "🐻‍❄️", "🐼", "🐨", "🐯", "🦁", "🐸",
      "🐧", "🐥", "🐣", "🐤", "🦄", "🦋", "🐢", "🐳", "🐋", "🐬",
      "🐙", "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🦈", "🦊", "🐭",
      "🐹", "🐮", "🐷", "🐗", "🐔", "🦉", "🦅", "🦆", "🦢",
      "🦩", "🦚", "🦜", "🐝", "🐞", "🦗", "🕷️", "🦂", "🐌", "🦕",
      "🦖", "🐉", "🐲", "🦔", "🐺", "🐴", "🦓", "🦒", "🐘", "🦣",
      "🦛", "🦏", "🐪", "🐫", "🦙", "🐑", "🐐", "🦌", "🐕", "🦮",
      "🐩", "🐈", "🐈‍⬛", "🐓", "🦃", "🕊️", "🐇", "🦝", "🦨", "🦡",
      "🦦", "🦥", "🐿️", "🦇", "🐾", "🦤", "🪲", "🐛"
    ]
  },
  {
    key: "plant",
    label: "식물·꽃",
    emojis: [
      "🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🪷",
      "💐", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️",
      "🍀", "🎍", "🎋", "🍃", "🍂", "🍁", "🍄", "🪻"
    ]
  },
  {
    key: "food",
    label: "음식",
    emojis: [
      "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🍎", "🍏", "🍐",
      "🍊", "🍋", "🍌", "🍉", "🍇", "🍈", "🥝", "🍅", "🥑", "🍆",
      "🥕", "🌽", "🥔", "🥬", "🥦", "🌶️", "🫛", "🫚", "🍠", "🥐", "🍞", "🥖", "🥨", "🧀", "🥞",
      "🧇", "🍳", "🥚", "🍕", "🍔", "🌭", "🥪", "🌮", "🌯", "🍟",
      "🍜", "🍝", "🍲", "🍛", "🍣", "🍱", "🍙", "🍚", "🍘", "🍢",
      "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭",
      "🍬", "🍫", "🍩", "🍪", "🌰", "🍯", "🍿", "🥛", "☕", "🍵",
      "🧋", "🥤", "🧃", "🧉", "🍶", "🍺", "🍻", "🥂", "🍷", "🍸"
    ]
  },
  {
    key: "season",
    label: "계절·날씨",
    emojis: [
      "🌸", "🌷", "🐝", "🦋", "🌱", "🐣", "☀️", "🌊", "🏖️", "🍉",
      "🍧", "⛱️", "🩴", "🕶️", "🌴", "🍁", "🍂", "🌾", "🎃", "🌰",
      "🍄", "❄️", "⛄", "☃️", "🎄", "🎅", "🤶", "🦌", "🧣", "🧤",
      "🌙", "🌛", "🌜", "🌝", "🌞", "⭐", "🌟", "☁️", "⛅", "🌥️",
      "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "🌬️", "🌪️", "🌫️", "🌈", "☔",
      "💧", "💦", "🔥", "⚡", "🌠", "🌌", "🪐", "🌍"
    ]
  },
  {
    key: "travel",
    label: "여행·탈것",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐",
      "🛻", "🚚", "🚛", "🚜", "🛵", "🏍️", "🛺", "🚲", "🛴", "🚨",
      "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️",
      "🛫", "🛬", "🛩️", "🚁", "🚀", "🛸", "🛶", "⛵", "🚤", "🛥️",
      "🚢", "⚓", "🗺️", "🧭", "🏔️", "⛰️", "🌋", "🏕️", "🏖️", "🏝️",
      "🏞️", "🗽", "🗼", "🏰", "🏯", "🎡", "🎢", "🎠", "⛲", "🌁"
    ]
  },
  {
    key: "object",
    label: "사물",
    emojis: [
      "💎", "👑", "💍", "🔮", "📌", "📍", "💌", "🔔", "🔕", "🧸",
      "🪄", "🫧", "🎐", "🛍️", "🎒", "👜", "👛", "👝", "🎁", "👗",
      "👚", "👕", "👖", "🧥", "👔", "👒", "🎩", "🧢", "🕶️",
      "👓", "💄", "💅", "📱", "💻", "🖥️", "⌨️", "🖱️", "🖨️", "📷",
      "📺", "📻", "⏰", "⏲️", "⏳", "🕰️", "🔑", "🗝️", "🔒", "🔓",
      "💡", "🔦", "🕯️", "🧷", "📎", "🖇️", "✂️", "📏", "📐", "🪙",
      "💰", "💵", "💸", "💳", "🧧", "📦", "📫", "✉️", "📨", "🔭",
      "🔬", "🧲", "🧪", "💊", "🩹", "🩺", "🌡️", "🧹", "🪥", "🧼"
    ]
  }
];

// #7: 텍스트 스티커 글꼴/굵기 선택지
const TEXT_FONTS = [
  { key: "sans", label: "기본" },
  { key: "round", label: "손글씨" },
  { key: "display", label: "제목" },
  { key: "serif", label: "명조" },
  { key: "jua", label: "둥근" },
  { key: "dohyeon", label: "고딕" },
  { key: "pen", label: "펜글씨" },
  { key: "gamja", label: "감자" },
  { key: "gugi", label: "붓글씨" },
  { key: "melody", label: "멜로디" }
];
const TEXT_WEIGHTS = [
  { w: 400, label: "보통" },
  { w: 700, label: "굵게" },
  { w: 900, label: "두껍게" }
];

export function PublicPoster({
  initialMonth,
  initialYear,
  onViewChange,
  schedule,
  decorate: decorateProp = false,
  initialPreviewing = false,
  initialNarrow = false,
  saveStickerAction: saveStickerActionRaw,
  deleteStickerAction: deleteStickerActionRaw,
  saveStickerBatchAction: saveStickerBatchActionRaw,
  deleteStickerBatchAction: deleteStickerBatchActionRaw,
  uploadStickerAssetAction,
  deleteStickerAssetAction,
  setPosterThemeAction,
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
  onAvatarToggle,
  onAvatarSide,
  showWorldCupFeatures: showWorldCupFeaturesProp
}: PublicPosterProps) {
  const [showWorldCupFeatures] = useWorldCupVisibility(showWorldCupFeaturesProp);
  // 스티커 저장/삭제가 서버에 들어가는 동안만 세는 카운터(아래 beforeunload 경고용).
  // 실제 전송은 keepalive fetch(/api/sticker-write)로 보낸다 → 스티커를 옮기/추가/삭제하고 바로
  // 달을 넘기거나 창을 닫/새로고침해도 브라우저가 전송을 끝까지 보장해 작업이 유실되지 않는다.
  // raw 액션 prop은 "이 기능이 켜져 있는지"의 게이트로만 쓰고(서버 호출은 라우트가 대신), 응답은
  // 기존 액션과 같은 모양({ok,sticker}/{ok,stickers}/{ok,error})이라 호출부를 바꿀 필요가 없다.
  const pendingSaveRef = useRef(0);
  // #저장칩 — 꾸미기에서도 편집실처럼 저장 상태를 항상 보여준다(저장중/저장됨/실패 + KST).
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [lastSavedKst, setLastSavedKst] = useState<string | null>(null);
  const savingSinceRef = useRef(0); // '저장 중' 최소 노출 계산용
  const savedTimerRef = useRef<number | null>(null);
  const stickerWrite = useCallback(
    async <T,>(op: string, payload: unknown, fallback: T): Promise<T> => {
      if (pendingSaveRef.current === 0) savingSinceRef.current = Date.now();
      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      pendingSaveRef.current += 1;
      // 매크로태스크로 빼 항상 긴급으로 칠해지게(편집실 studioWrite와 동일 이유).
      window.setTimeout(() => {
        if (pendingSaveRef.current > 0) setSaveState("saving");
      }, 0);
      let result = fallback;
      let ok = false;
      try {
        const res = await fetch("/api/sticker-write", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ op, payload })
        });
        const data = await res.json().catch(() => null);
        result = (data ?? fallback) as T;
        ok = Boolean((result as { ok?: boolean })?.ok);
      } catch {
        result = fallback;
        ok = false;
      } finally {
        pendingSaveRef.current = Math.max(0, pendingSaveRef.current - 1);
        if (!ok) {
          setSaveState("failed"); // 실패는 칩에 빨갛게 계속 — 조용히 사라지지 않게(#12)
        } else if (pendingSaveRef.current === 0) {
          setLastSavedKst(nowKstHm());
          const elapsed = Date.now() - savingSinceRef.current;
          if (elapsed >= 700) {
            setSaveState("saved");
          } else {
            savedTimerRef.current = window.setTimeout(() => {
              if (pendingSaveRef.current === 0) setSaveState("saved");
            }, 700 - elapsed);
          }
        }
      }
      return result;
    },
    []
  );
  // Ctrl+S — 꾸미기엔 따로 '저장 버튼'이 없다(스티커는 조작 즉시 keepalive 저장). 저장할 게 없으면
  // '이미 저장됨'을 칩으로 잠깐 확인시킨다(진행 중 저장이 있으면 그 표시를 안 건드림).
  const flashSavedChip = useCallback(() => {
    if (pendingSaveRef.current > 0) return;
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setSaveState("saving");
    savedTimerRef.current = window.setTimeout(() => {
      if (pendingSaveRef.current === 0) {
        setSaveState("saved");
        setLastSavedKst(nowKstHm());
      }
      savedTimerRef.current = null;
    }, 600);
  }, []);
  const saveStickerAction = useMemo(
    () =>
      saveStickerActionRaw
        ? (input: SaveStickerInput) =>
            stickerWrite<StickerResult>("save", input, { ok: false, error: "저장에 실패했어요." })
        : undefined,
    [saveStickerActionRaw, stickerWrite]
  );
  const deleteStickerAction = useMemo(
    () =>
      deleteStickerActionRaw
        ? (id: string) =>
            stickerWrite<StickerResult>("delete", { id }, { ok: false, error: "삭제에 실패했어요." })
        : undefined,
    [deleteStickerActionRaw, stickerWrite]
  );
  const saveStickerBatchAction = useMemo(
    () =>
      saveStickerBatchActionRaw
        ? (inputs: SaveStickerInput[]) =>
            stickerWrite<StickerBatchResult>("saveBatch", { inputs }, {
              ok: false,
              error: "저장에 실패했어요."
            })
        : undefined,
    [saveStickerBatchActionRaw, stickerWrite]
  );
  const deleteStickerBatchAction = useMemo(
    () =>
      deleteStickerBatchActionRaw
        ? (ids: string[]) =>
            stickerWrite<StickerBatchResult>("deleteBatch", { ids }, {
              ok: false,
              error: "삭제에 실패했어요."
            })
        : undefined,
    [deleteStickerBatchActionRaw, stickerWrite]
  );
  // 스티커 저장/삭제가 아직 서버에 안 들어갔는데 새로고침/닫기 하면 작업을 잃을 수 있어 경고한다.
  // 꾸미기 화면에서만, 그리고 실제로 진행 중일 때만 뜬다(평소엔 방해 없음).
  useEffect(() => {
    if (!decorateProp) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingSaveRef.current > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [decorateProp]);
  // 꾸미기 화면에서 "시청자 화면 보기"로 잠깐 미리보기 — 꾸미기 도구를 숨기고
  // 시청자 시점으로 본다. previewing 동안에는 effective decorate를 꺼서, 아래의
  // 모든 꾸미기 로직(도구바·키보드·스티커 편집)이 자동으로 비활성화된다.
  const [previewing, setPreviewing] = useState(initialPreviewing);
  const decorate = decorateProp && !previewing;
  // 꾸미기는 라우트이기도 하지만 미리보기 전환으로 껐다 켜지는 '모드'라, 실제 꾸미기 상태를
  // 섹션으로 따로 잰다(라우트 체류에는 미리보기 시간이 섞인다).
  useSectionActivity(decorate ? "decorate" : null);
  // 토리님 SOOP 라이브 상태 — 꾸미기 아니면 폴링(편집실 '시청자 미리보기'에서도 켜서 개발자/오너가
  // 시청자가 볼 LIVE를 그대로 확인). 데스크탑 플로팅 비콘은 편집실 chrome과 겹쳐 미리보기에선 숨기고
  // (아래 마운트의 !previewNav), 모바일은 겹침 없는 하단 '오늘'→LIVE 버튼이라 미리보기에서도 보인다.
  const soopLiveRaw = useSoopLive(!decorate);
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
  // 꾸미기에서 미리보기 상태를 쿠키에 기록 → 새로고침 시 서버가 그 화면(미리보기/꾸미기)으로 바로 렌더.
  useEffect(() => {
    if (decorateProp) {
      writeViewCookie({ dp: previewing ? 1 : 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewing]);
  // 처음 화면에 들어왔을 때만 잠깐, 인기(관심) 단계별로 날짜 칸을 부각하는 애니메이션을 켠다.
  // 이후(월 이동 등)엔 꺼서 산만하지 않게 한다.
  const [popIntro, setPopIntro] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setPopIntro(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [textDraft, setTextDraft] = useState(""); // C6: 추가할 텍스트 스티커 문구
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0].key); // #5b: 선택된 이모지 카테고리
  const activeEmojis =
    EMOJI_CATEGORIES.find((c) => c.key === emojiCat)?.emojis ?? EMOJI_CATEGORIES[0].emojis;
  const [view, setView] = useState({
    year: initialYear ?? schedule.calendar.defaultYear,
    month: initialMonth ?? schedule.calendar.defaultMonth
  });
  const cells = useMemo(() => buildCalendarMonth(view.year, view.month), [view]);
  const today = getTodayKst();
  // 업 도움은 기간(종료일, KST)이 지나면 전부 자동으로 내린다 — 달력 띠·줄 칸·우측 안내 카드
  // 어디서도 끝난 업 도움은 그리지 않는다. 종료일이 오늘 이전이면 이벤트 집합에서 제외해, 모든
  // 업 도움 시각화(레인 배정·주별 줄 수·띠·카드)가 한 소스에서 일관되게 사라지게 한다.
  const liveEvents = useMemo(
    () =>
      schedule.events.filter(
        (e) => !e.isSupport || (e.endDateKey ?? getEventDateKey(e)) >= today
      ),
    [schedule.events, today]
  );
  const supportLanes = useMemo(() => assignSupportLanes(liveEvents), [liveEvents]);
  // 업 도움 띠 줄 수를 "주별"로 — 띠 없는 주는 0이라 그 주 일정이 위로 붙는다(높이 낭비 방지).
  const weekSupportLaneCount = useMemo(() => {
    const perWeek: number[] = [];
    for (let w = 0; w * 7 < cells.length; w += 1) {
      let maxLane = -1;
      for (const c of cells.slice(w * 7, w * 7 + 7)) {
        for (const s of getEventsForDate(liveEvents, c.isoDate)) {
          if (!s.isSupport) continue;
          maxLane = Math.max(maxLane, supportLanes.lanes.get(s.id) ?? 0);
        }
      }
      perWeek[w] = maxLane + 1;
    }
    return perWeek;
  }, [cells, liveEvents, supportLanes]);
  // (레일 업도움 카드 삭제로 activeSupportEvents 목록은 불필요 — 업도움 접근은 띠 클릭 팝오버.)
  // 이어진 일정 묶음 키 — 같은 묶음 칸들의 높이를 맞추는 데 쓴다(아래 useEqualChainHeights).
  const chainKeys = useMemo(() => buildChainKeys(schedule.events), [schedule.events]);
  // 같은 태그 구성으로 이어진 묶음은 하나의 그라데이션으로(경계 가운데). 묶음별 날짜 범위.
  const paintGroups = useMemo(() => buildPaintGroups(schedule.events), [schedule.events]);
  // 이어진 일정(link_next로 묶인 '별개' 일정들)은 같은 묶음 칸끼리 높이를 맞춰 이음새가 어긋나지
  // 않게 한다. 묶음의 '가장 큰 내용' 높이에만 맞추므로(과확장 없음) 짧은 쪽만 그만큼 채워진다.
  // callback ref라 그리드가 (재)마운트되는 어떤 경로에서도 자동 재설정된다. deps는 보강용.
  const monthGridRef = useEqualChainHeights<HTMLDivElement>([schedule.events, view]);
  // 스티커 좌표 매핑용 실측 대상 — 달력 그리드·표면 엘리먼트(아래 스티커 프레임 실측에서 사용).
  const stickerGridElRef = useRef<HTMLDivElement | null>(null);
  const stickerSurfaceElRef = useRef<HTMLElement | null>(null);
  // 구글 시트식 날짜 칸 범위 선택(마우스 전용, 시각 강조) + 텍스트 긁힘 방지.
  // (P1-MULTI-0로 제거했다가 사용자 요청으로 복원 — 방송 중 기간을 짚어주는 실사용 도구.)
  const { setRef: rangeSelectRef, selected: rangeSelected } = useCellRangeSelect<HTMLDivElement>();
  const setMonthGridRef = useCallback(
    (el: HTMLDivElement | null) => {
      monthGridRef(el);
      rangeSelectRef(el);
      stickerGridElRef.current = el;
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

  // "내 이모지" 보관함 — 로컬 상태로 들고 있어 업로드·삭제를 새로고침(왕복) 없이 즉시 반영한다.
  // (서버 router.refresh를 기다리면 몇 초씩 늦게 떠/늦게 사라져 답답하다.)
  const [assets, setAssets] = useState<StickerAsset[]>(schedule.stickerAssets);
  useEffect(() => {
    setAssets(schedule.stickerAssets);
  }, [schedule.stickerAssets]);
  // 업로드 진행 중인(아직 서버 저장 전) 임시 에셋 id — 스피너 표시 + 클릭(스티커 추가) 차단용.
  const [pendingAssetIds, setPendingAssetIds] = useState<Set<string>>(() => new Set());
  // 보관함 분류 탭(전체/아바타/이모티콘/움직이는 이모티콘).
  const [assetTab, setAssetTab] = useState<AssetTabKey>("all");
  // 보관함 쓰기(정렬·분류) 직렬 큐 — 마지막 드래그가 저장의 진실.
  const assetQueueRef = useRef<Promise<void>>(Promise.resolve());

  // 살아있는 커스텀 이모지(에셋) id 집합. 삭제된 에셋을 가리키는 이미지 스티커를 다시
  // 저장하면 FK 위반(sticker_instances_asset_id_fkey)이 난다 — undo/복제 등 어떤 경로로든
  // 죽은 에셋을 되살리기 전에 이 집합으로 걸러낸다. (저장 전 임시 에셋도 살아있는 것으로 본다.)
  const liveAssetIds = useMemo(() => new Set(assets.map((a) => a.id)), [assets]);
  const isStickerAssetAlive = (s: StickerInstance) =>
    s.kind !== "image" || (s.assetId != null && liveAssetIds.has(s.assetId));

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

  // C9/C10: 포스터 테마(계절/배경). 소유자만 바꿀 수 있고 모든 시청자에게 반영된다.
  const [posterTheme, setPosterTheme] = useState(schedule.calendar.posterTheme);
  async function changeTheme(theme: string) {
    if (!setPosterThemeAction) {
      return;
    }
    const prev = posterTheme;
    setPosterTheme(theme as typeof posterTheme); // 낙관적 반영
    // 클릭 즉시 '내 의도'를 쿠키에 기록(타임스탬프 포함) — 서버 저장(DB 쓰기 ~0.3s)이 끝나기 전에
    // 새로고침해도 꾸미기 page가 이 쿠키를 먼저 읽어 바로 반영한다. 15초 지나면 만료라 묵은 값이
    // 영구히 우선되지 않는다(그 뒤엔 DB 신선 읽기가 진실).
    try {
      document.cookie = `vic_theme=${theme}|${Date.now()}; path=/; max-age=60; samesite=lax`;
    } catch {
      /* 쿠키 불가 환경 무시 */
    }
    const result = await setPosterThemeAction(theme);
    if (!result.ok) {
      setPosterTheme(prev);
      setStickerError(result.error);
      try {
        document.cookie = `vic_theme=${prev}|${Date.now()}; path=/; max-age=60; samesite=lax`;
      } catch {
        /* 무시 */
      }
    }
  }
  // 보는 달이 월드컵 기간(2026-06~07)과 겹치면 포스터 테마를 월드컵으로 자동 전환한다 —
  // 단 토리님이 그 달 테마를 직접 고르지 않았을 때만("none"). 예전엔 owner 선택보다 우선했는데,
  // 그러면 대회 두 달 내내 직접 꾸민 포스터가 잔디밭으로 덮이고 내보낸 PNG까지 축구 포스터가 된다.
  // 포스터의 저자는 토리님이다 — 시즌 테마는 '기본값 제안'이지 '강제'가 아니다.
  const effectivePosterTheme =
    posterTheme !== "none"
      ? posterTheme
      : showWorldCupFeatures && isWorldCupMonth(view.year, view.month)
        ? "worldcup"
        : posterTheme;

  // 관리자 아바타 자리(스트리머 scene). 꾸미기(decorate)에서도 허용 — 현재 방식은 surface를 통째로
  // uniform scale(축소)만 하므로 스티커 좌표(1840 design 기준)가 안 틀어진다(시청자=avatar OFF와도
  // 동일 좌표). 캡처(PNG)는 export 표면 밖이라 아바타가 안 들어간다. localStorage는 owner 로컬.
  const avatarCapable = avatarSlot;
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
  const avatarOn = avatarControlled ? avatarOnProp ?? true : avatarOnState;
  const avatarSide = avatarControlled ? avatarSideProp ?? "left" : avatarSideState;
  const toggleAvatarOn = avatarControlled ? onAvatarToggle! : toggleAvatarOnInternal;
  const pickAvatarSide = avatarControlled ? onAvatarSide! : pickAvatarSideInternal;

  // 스티커는 달(월)마다 따로 — 현재 보는 달의 스티커만 로컬 상태로 다룬다.
  const monthStickers = (year: number, month: number) =>
    schedule.stickers.filter((s) => s.year === year && s.month === month);
  const [stickers, setStickers] = useState<StickerInstance[]>(() =>
    monthStickers(view.year, view.month)
  );
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  // 모바일 아젠다에서 사용자가 펼친 '빈 날 구간'(접기는 숨김이 아니라 접힘 — 탭하면 그대로 보인다).
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(() => new Set());
  // 하트 등급 승급 토스트(시청자) — 내 하트가 등급을 올렸을 때만 잠깐 뜬다.
  const [heartToast, setHeartToast] = useState<string | null>(null);
  const heartToastTimerRef = useRef<number | null>(null);
  // 시청자 '이 달 기록' 시트 열림.
  const [insightsOpen, setInsightsOpen] = useState(false);
  // 미니게임이 켜졌는지 — 켜지면 캐주얼 중력 축구공을 아예 언마운트한다(둘 다 뜨면 어수선하고,
  // 공이 미니게임 버튼 위에 굴러와 앉는다). 공 컴포넌트 내부의 숨김 상태에 기대지 않고 여기서
  // 렌더 자체를 끊는다 — 미니게임을 켰는데 공이 그대로 남던 문제가 실제로 있었다.
  const [minigameOn, setMinigameOn] = useState(false);
  useEffect(() => {
    const onMini = (e: Event) => setMinigameOn(Boolean((e as CustomEvent).detail?.enabled));
    window.addEventListener("wc-minigame-enabled", onMini);
    return () => window.removeEventListener("wc-minigame-enabled", onMini);
  }, []);
  // C3: 다중 선택 — 기본(primary) 선택 외에 추가로 선택된 스티커들.
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [stickerError, setStickerError] = useState<string | null>(null);
  // 스티커 복사/붙여넣기 안내 토스트(월 간 복붙 — 잠깐 떴다 사라짐).
  const [stickerClipMsg, setStickerClipMsg] = useState<string | null>(null);
  const stickerClipTimerRef = useRef<number | null>(null);
  // A2 고도화: 여러 태그를 동시에 고르고, "관심만 보기"까지 더해 보고 싶은 일정만 추려 본다.
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  // A: 관심(하트). toggleHeartAction이 있으면 서버 집계(1인 1하트)와 연동되고,
  //    없으면(샘플/오프라인) 기기별 localStorage로만 동작한다. 둘 다 "내가 누른 일정" 집합으로 관리.
  // 떡밥 즉시 공개 — 카운트다운이 0이 되면 캐시 우회 액션으로 실제 내용을 받아 이 맵에 덮는다.
  // (이게 있으면 렌더에서 가린 stub 대신 실제 일정을 쓴다 → 캐시 30초 안 기다리고 그 순간 풀림.)
  const [revealedEvents, setRevealedEvents] = useState<Record<string, PublicScheduleEvent>>({});
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
        sheet.classList.add("pop-dragging");
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
    };
    const onUp = () => {
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
      sheet.classList.remove("pop-dragging");
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
      .then((list) => {
        if (list.length > 0) {
          const ids = list.map((ev) => ev.id);
          setRevealedEvents((prev) => {
            const next = { ...prev };
            for (const ev of list) next[ev.id] = ev;
            return next;
          });
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
  }, []);
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
  const heartOpRef = useRef<Map<string, { chain: Promise<void>; seq: number }>>(new Map());
  // 하트를 누를 때 화면에 떠오르는 ♥ 입자들(틱톡식 좋아요 연출). 잠깐 떴다 사라진다.
  const [floaters, setFloaters] = useState<HeartFloater[]>([]);
  // 특별한 날(공휴일·기념일·월드컵·한국 승) 탭 시 그 자리에서 터지는 점(point) 폭죽들.
  const [bursts, setBursts] = useState<
    { id: number; x: number; y: number; big: boolean; bits: BurstBit[] }[]
  >([]);
  const burstId = useRef(0);
  // 시청자 상호작용(필터·북마크) 가능 모드 — 꾸미기 중에는 끈다(스티커 조작과 충돌·포스터 청결).
  const interactive = !decorate;
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

  // "시청자 화면 보기" 미리보기는 히스토리에 한 칸 쌓아, 휴대폰/브라우저 뒤로가기를 누르면
  // 페이지를 떠나지 않고 꾸미기로 돌아온다(편집실 오버레이 스택과 같은 방식).
  const previewDepthRef = useRef(0);
  const ignorePreviewPop = useRef(false);
  const previewBackClosing = useRef(false);
  // popstate 리스너는 한 번만 등록하므로(deps []) 최신 값을 ref로 읽는다.
  const previewingRef = useRef(previewing);
  previewingRef.current = previewing;
  useEffect(() => {
    const depth = previewing ? 1 : 0;
    const prev = previewDepthRef.current;
    if (depth > prev) {
      window.history.pushState({ vicPreview: true }, "");
    } else if (depth < prev) {
      if (previewBackClosing.current) {
        previewBackClosing.current = false; // 뒤로가기로 닫힘 → 브라우저가 이미 정리함
      } else {
        ignorePreviewPop.current = true; // 버튼으로 닫힘 → 쌓은 항목 정리(그 popstate는 무시)
        window.history.back();
      }
    }
    previewDepthRef.current = depth;
  }, [previewing]);
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
      if (ignorePreviewPop.current) {
        ignorePreviewPop.current = false;
        return;
      }
      if (insightsOpenRef.current) {
        insightsBackClosing.current = true;
        setInsightsOpen(false);
        return;
      }
      // 미리보기 중일 때만 처리 — 아니면 일반 뒤로가기를 방해하지 않는다.
      if (previewingRef.current) {
        previewBackClosing.current = true;
        setPreviewing(false);
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
  const showAgenda = isNarrow && !decorate;

  // 포스터(시청자/꾸미기/export 표면)는 화면마다 reflow되면 안 된다 — 소유자가 찍은
  // 스티커·텍스트 위치가 틀어지고 글자가 가려질 수 있다. 그래서 내부는 고정 16:9 캔버스
  // (POSTER_DESIGN_W×H)로 설계하고, 화면 폭에 맞춰 통째로 축소(transform: scale)만 한다.
  // export는 변형 없는 .poster-surface를 원본 해상도로 캡쳐하므로 화질에 영향 없다.
  // 태그 필터 카드가 세로 스크롤을 따라온다 — 표면이 transform: scale 안이라 position:sticky가
  // 뷰포트에 안 붙는다(변환 조상이 containing block). 대신 rAF로 스크롤만큼 translateY(레일
  // 남은 높이로 클램프). transform이라 레이아웃·표면 기하 불변(스티커 안전). 시청자 전용.
  const legendFollowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (decorate || showAgenda) return;
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
  }, [decorate, showAgenda]);

  const posterStageRef = useRef<HTMLDivElement | null>(null);
  const posterFitRef = useRef<HTMLDivElement | null>(null);
  const posterScalerRef = useRef<HTMLDivElement | null>(null);
  const [posterScale, setPosterScale] = useState(1);
  // 표면(달력)이 일정 양에 따라 세로로 자라므로, 축소 전 '자연 높이'를 재서 stage 높이/배율 계산에 쓴다.
  const [posterNaturalH, setPosterNaturalH] = useState(POSTER_DESIGN_H);
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
  }, [showAgenda, decorate, avatarSlot]);




  // 이 세션에서 삭제한 스티커 id. 달을 다시 시드할 때 schedule prop(서버 스냅샷)이 캐시 탓에
  // 아직 그 스티커를 들고 있을 수 있어, 지운 게 월 이동 후 되살아나는 걸 막는다.
  const deletedStickerIdsRef = useRef<Set<string>>(new Set());
  // 이 세션에서 편집한 달별 스티커 최신 상태(낙관적 로컬). schedule prop은 페이지 로드 시점
  // 스냅샷이라, 달을 옮겼다 돌아오면 prop으로 리시드돼 "이번 세션에 추가/이동/편집한 게
  // 사라져 보이는" 되돌림이 났다. 이 캐시로 떠난 달의 최신 상태를 보존해 다시 와도 그대로 보인다
  // (DB엔 keepalive로 이미 저장됨 — 캐시는 화면 연속성용).
  const monthStickerCacheRef = useRef<Map<string, StickerInstance[]>>(new Map());
  const prevViewRef = useRef<{ year: number; month: number }>({ year: view.year, month: view.month });
  // 키보드 미세이동 등에서 최신 스티커 배열을 읽기 위한 ref + 저장 디바운스 타이머
  const stickersRef = useRef<StickerInstance[]>([]);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeBurstRef = useRef(0); // 방향키 연속 입력을 한 단위로 묶기 위한 타임스탬프
  stickersRef.current = stickers;
  // C2: 실행취소/다시실행 — 현재 달 스티커 배열 스냅샷 스택.
  // ref를 단일 진실 소스로 둔다: 비동기 undo/redo(applySnapshot→remapId) 도중 setState
  // 타이밍/클로저로 인해 redo 스택 push가 유실되던 문제를 막는다. state는 버튼 활성화
  // 렌더링용 거울일 뿐이고, 스택 로직은 항상 ref를 읽고 쓴다.
  const undoRef = useRef<StickerInstance[][]>([]);
  const redoRef = useRef<StickerInstance[][]>([]);
  const [undoStack, setUndoStack] = useState<StickerInstance[][]>([]);
  const [redoStack, setRedoStack] = useState<StickerInstance[][]>([]);
  // ref(진실) + state(렌더용)를 함께 갱신한다.
  function commitStacks(undo: StickerInstance[][], redo: StickerInstance[][]) {
    undoRef.current = undo;
    redoRef.current = redo;
    setUndoStack(undo);
    setRedoStack(redo);
  }

  // 달을 바꿀 때만 해당 달 스티커로 다시 시드한다.
  // (스티커 저장 시 서버 revalidate로 schedule이 갱신되어도 로컬 상태가 우선 —
  //  그렇지 않으면 추가/이동/회전 직후 선택이 풀려 패널·핸들이 사라진다.)
  useEffect(() => {
    // 떠나는 달의 최신 로컬 상태를 캐시에 저장(이 렌더 시점 stickers는 아직 이전 달 것).
    const prev = prevViewRef.current;
    monthStickerCacheRef.current.set(`${prev.year}-${prev.month}`, stickersRef.current);
    prevViewRef.current = { year: view.year, month: view.month };
    // 들어오는 달은 캐시(이번 세션 편집 보존)가 있으면 그걸로, 없으면 서버 prop으로 시드한다.
    const key = `${view.year}-${view.month}`;
    const cached = monthStickerCacheRef.current.get(key);
    const seed =
      cached ??
      schedule.stickers.filter((s) => s.year === view.year && s.month === view.month);
    setStickers(seed.filter((s) => !deletedStickerIdsRef.current.has(s.id)));
    setSelectedSticker(null);
    setMultiIds([]);
    // 색상 필터/관심만 보기는 달을 넘겨도 그대로 유지한다(사용자가 선택을 다시 안 해도 되게).
    commitStacks([], []); // 달이 바뀌면 실행취소/다시실행 히스토리는 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.year, view.month]);

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
      const before = heartTier(heartCounts[id] ?? 0, topEventIds.has(id));
      const after = heartTier((heartCounts[id] ?? 0) + 1, topEventIds.has(id));
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
        const isLatest = heartOpRef.current.get(id)?.seq === seq;
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
    heartOpRef.current.set(id, { chain, seq });
  }
  const isBookmarked = (id: string) => bookmarks.includes(id);

  // A(#3): 관심 단계는 "이번 달 최다 하트" 대비 상대 + 최소 절대 기준의 혼합으로 정한다.
  // 50~100명 규모에서 한두 명 차이로 단계가 출렁이지 않게 상대(ratio)를 쓰고,
  // 최소 3개 floor로 노이즈를 막는다. maxHeart는 현재 보이는 집계의 최댓값.
  const maxHeart = useMemo(() => {
    const counts = Object.values(heartCounts);
    return counts.length > 0 ? Math.max(...counts) : 0;
  }, [heartCounts]);
  // 이 달 최다 하트와 같은(공동 1위 포함) 일정 id들 — 이들에 👑을 붙인다. 공동 1위를 함께 왕관으로
  // 두면 다른 일정에 하트를 눌러 동점이 돼도 기존 왕관이 사라지지 않는다(단조).
  const topEventIds = useMemo(() => {
    const ids = new Set<string>();
    if (maxHeart <= 0) return ids;
    for (const [id, c] of Object.entries(heartCounts)) {
      if (c === maxHeart) ids.add(id);
    }
    return ids;
  }, [heartCounts, maxHeart]);

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

  // 꾸미기 중 스티커 키보드 조작: Delete 삭제 · 화살표 이동(Shift=크게) · Ctrl/Cmd+D 복제.
  useEffect(() => {
    if (!decorate || !selectedSticker) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      // 입력 칸에서 누른 경우는 무시(텍스트 편집 보호)
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "d" || event.key === "D")) {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "c" || event.key === "C")) {
        event.preventDefault();
        copySelected();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        void deleteSelected();
        return;
      }
      // Esc = 선택 해제. 없으면 스티커를 고른 채로는 키보드로 빠져나갈 방법이 없다 —
      // 아래 월 이동도 화살표를 스티커 미세이동에 양보하므로, 빈 캔버스를 마우스로 찾아
      // 눌러야만 했다. Esc는 누구나 먼저 눌러보는 키다.
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedSticker(null);
        setMultiIds([]);
        return;
      }
      // P2-STICKER-1: 키보드 크기/회전 — 포인터 핸들 없이도 조작 완결.
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        resizeSelectedBy(event.shiftKey ? 1.1 : 1.03);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        resizeSelectedBy(event.shiftKey ? 1 / 1.1 : 1 / 1.03);
        return;
      }
      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        rotateSelectedBy((event.key === "[" ? -1 : 1) * (event.shiftKey ? 15 : 5));
        return;
      }
      const step = event.shiftKey ? 0.02 : 0.004;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeSelected(0, -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeSelected(0, step);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelected(-step, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelected(step, 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorate, selectedSticker, multiIds]);

  // 스티커 붙여넣기(Ctrl/⌘+V) — 선택이 없어도 동작(다른 빈 달에 붙이기용). view가 바뀌면 재구독해
  // 항상 '지금 보고 있는 달'에 붙는다(다른 월 꾸미기로 이동 후 붙여넣기 지원).
  useEffect(() => {
    if (!decorate) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || (event.key !== "v" && event.key !== "V")) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      pasteClipboard();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorate, view.year, view.month]);

  // 시청자·꾸미기에서 ←/→ 로 월 이동. 단, 꾸미기에서 스티커를 선택 중이면 위 핸들러가
  // 화살표를 미세이동에 쓰므로 그때는 비활성(스티커 미선택/시청자에서만 월 이동).
  useEffect(() => {
    if (showAgenda || (decorate && selectedSticker)) {
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
  }, [decorate, selectedSticker, showAgenda, view.year, view.month]);

  // C2: 실행취소/다시실행 단축키(선택 여부와 무관하게 동작).
  useEffect(() => {
    if (!decorate) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      } else if (key === "s") {
        // Ctrl/⌘+S: 브라우저 페이지 저장 가로채기 → 저장 칩으로 '저장됨' 확인(스티커는 이미 즉시 저장).
        event.preventDefault();
        flashSavedChip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorate, undoStack, redoStack]);

  // C3: 현재 선택된 모든 스티커 id(primary + 추가 선택). primary가 항상 맨 앞.
  const selectedIds = selectedSticker
    ? [selectedSticker, ...multiIds.filter((id) => id !== selectedSticker)]
    : multiIds;

  // 선택 핸들러: Shift/Ctrl 클릭=토글(다중), 일반 클릭=단일.
  function handleSelect(id: string | null, additive?: boolean) {
    if (!id) {
      setSelectedSticker(null);
      setMultiIds([]);
      return;
    }
    if (!additive) {
      setSelectedSticker(id);
      setMultiIds([]);
      return;
    }
    if (id === selectedSticker) {
      // primary를 토글로 끄면 추가 선택의 첫 항목을 primary로 승격.
      setSelectedSticker(multiIds[0] ?? null);
      setMultiIds((prev) => prev.slice(1));
      return;
    }
    setMultiIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (!selectedSticker) {
      setSelectedSticker(id);
    }
  }

  function clearSelection() {
    setSelectedSticker(null);
    setMultiIds([]);
  }

  function updateStickerLocal(updated: StickerInstance) {
    setStickers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function commitSticker(sticker: StickerInstance) {
    if (!saveStickerAction || sticker.id.startsWith("temp-")) {
      return; // 아직 insert 진행 중인 신규 스티커는 id 확정 후 저장됨
    }
    const result = await saveStickerAction({
      id: sticker.id,
      year: view.year,
      month: view.month,
      emoji: sticker.kind === "emoji" ? sticker.label : undefined,
      assetId: sticker.kind === "image" ? sticker.assetId : undefined,
      shapeKey: sticker.kind === "shape" ? sticker.shapeKey : undefined,
      text: sticker.kind === "text" ? sticker.label : undefined,
      textColor: sticker.textColor,
      fontWeight: sticker.fontWeight,
      fontFamily: sticker.fontFamily,
      textAlign: sticker.textAlign,
      textBg: sticker.textBg,
      textFx: sticker.textFx,
      italic: sticker.italic,
      outline: sticker.outline,
      shadow: sticker.shadow,
      anim: sticker.anim,
      locked: sticker.locked,
      xRatio: sticker.xRatio,
      yRatio: sticker.yRatio,
      widthRatio: sticker.widthRatio,
      rotationDeg: sticker.rotationDeg,
      flipX: sticker.flipX,
      flipY: sticker.flipY,
      opacity: sticker.opacity,
      zIndex: sticker.zIndex
    });
    if (!result.ok) {
      setStickerError(result.error);
    }
  }

  async function addEmoji(emoji: string) {
    const value = emoji.trim();
    if (!value || !saveStickerAction) {
      return;
    }
    pushHistory();
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    const nextZ = stickers.reduce((max, s) => Math.max(max, s.zIndex), 0) + 1;
    const fresh: StickerInstance = {
      id: tempId,
      kind: "emoji",
      label: value,
      year: view.year,
      month: view.month,
      xRatio: 0.5,
      yRatio: 0.5,
      widthRatio: 0.08,
      rotationDeg: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      zIndex: nextZ,
      visiblePublicly: true
    };
    setStickers((prev) => [...prev, fresh]);
    setSelectedSticker(tempId);
    const result = await saveStickerAction({
      year: fresh.year,
      month: fresh.month,
      emoji: fresh.label,
      xRatio: fresh.xRatio,
      yRatio: fresh.yRatio,
      widthRatio: fresh.widthRatio,
      rotationDeg: fresh.rotationDeg,
      flipX: fresh.flipX,
      flipY: fresh.flipY,
      opacity: fresh.opacity,
      zIndex: fresh.zIndex
    });
    if (result.ok) {
      setStickers((prev) => prev.map((s) => (s.id === tempId ? { ...s, id: result.id } : s)));
      setSelectedSticker((cur) => (cur === tempId ? result.id : cur));
    } else {
      setStickers((prev) => prev.filter((s) => s.id !== tempId));
      setStickerError(result.error);
    }
  }

  // C6: 텍스트 스티커를 달력에 올린다. 기본은 흰 외곽선(가독성)으로 시작.
  async function addText() {
    const value = textDraft.trim();
    if (!value || !saveStickerAction) {
      return;
    }
    pushHistory();
    setTextDraft("");
    await persistNewSticker({
      id: `temp-${Math.random().toString(36).slice(2)}`,
      kind: "text",
      label: value,
      textColor: "#1f2937",
      fontWeight: 700,
      fontFamily: "sans",
      textAlign: "left",
      outline: false,
      shadow: false,
      year: view.year,
      month: view.month,
      xRatio: 0.5,
      yRatio: 0.5,
      // 처음엔 작게 시작(예전 0.16은 너무 커서 창을 넘어 크기 핸들을 못 누르던 문제). 툴바 "크기"로 조절.
      widthRatio: 0.1,
      rotationDeg: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      zIndex: nextZIndex(),
      visiblePublicly: true
    });
  }

  // P2: 데코 도형을 달력에 올린다(프리셋 색으로 시작 → 툴바에서 재채색).
  async function addShape(shapeKey: string) {
    if (!saveStickerAction) {
      return;
    }
    pushHistory();
    await persistNewSticker({
      id: `temp-${Math.random().toString(36).slice(2)}`,
      kind: "shape",
      label: shapeKey,
      shapeKey,
      textColor: shapeDefaultColor(shapeKey),
      year: view.year,
      month: view.month,
      xRatio: 0.5,
      yRatio: 0.5,
      widthRatio: 0.1,
      rotationDeg: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      zIndex: nextZIndex(),
      visiblePublicly: true
    });
  }

  // 업로드한 커스텀 이모지(이미지)를 달력에 올린다.
  async function addImageSticker(asset: StickerAsset) {
    if (!saveStickerAction) {
      return;
    }
    pushHistory();
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    const nextZ = stickers.reduce((max, s) => Math.max(max, s.zIndex), 0) + 1;
    const fresh: StickerInstance = {
      id: tempId,
      kind: "image",
      label: asset.name,
      imageUrl: asset.fileUrl,
      assetId: asset.id,
      year: view.year,
      month: view.month,
      xRatio: 0.5,
      yRatio: 0.5,
      widthRatio: 0.12,
      rotationDeg: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      zIndex: nextZ,
      visiblePublicly: true
    };
    setStickers((prev) => [...prev, fresh]);
    setSelectedSticker(tempId);
    const result = await saveStickerAction({
      year: fresh.year,
      month: fresh.month,
      assetId: asset.id,
      xRatio: fresh.xRatio,
      yRatio: fresh.yRatio,
      widthRatio: fresh.widthRatio,
      rotationDeg: fresh.rotationDeg,
      flipX: fresh.flipX,
      flipY: fresh.flipY,
      opacity: fresh.opacity,
      zIndex: fresh.zIndex
    });
    if (result.ok) {
      setStickers((prev) => prev.map((s) => (s.id === tempId ? { ...s, id: result.id } : s)));
      setSelectedSticker((cur) => (cur === tempId ? result.id : cur));
    } else {
      setStickers((prev) => prev.filter((s) => s.id !== tempId));
      setStickerError(result.error);
    }
  }

  // 이미지 파일 업로드 → 커스텀 이모지로 등록. 여러 개를 한 번에(파일 선택·드래그앤드롭).
  async function handleUploadFiles(files: File[]) {
    if (!uploadStickerAssetAction) {
      return;
    }
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (files.length > 0) {
        setStickerError("이미지 파일만 올릴 수 있습니다.");
      }
      return;
    }
    setStickerError(null);
    setUploading(true);
    let lastError: string | null = null;
    // 순차 업로드 (서버·스토리지 부하를 줄이고 실패 메시지를 모은다).
    // try/finally로 감싸 어떤 이유로 액션이 throw해도 "올리는 중…"이 안 멈추게 한다(에러 표시).
    try {
      for (const file of images) {
        // 낙관적 표시: 로컬 미리보기(objectURL)로 "내 이모지"에 즉시 띄우고,
        // 서버 저장이 끝나면 진짜 에셋(id·URL)으로 교체한다 — 업로드가 바로 보이게.
        const tempId = `temp-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const previewUrl = URL.createObjectURL(file);
        const tempAsset: StickerAsset = {
          id: tempId,
          name: file.name.replace(/\.[^.]+$/, "") || "커스텀 이모지",
          fileUrl: previewUrl,
          fileType: file.type,
          // 서버와 같은 규칙으로 미리 판정 — GIF만 확실히 '움직이는 이모티콘'.
          kind: file.type === "image/gif" ? "anim" : "static",
          sortOrder: (assets[0]?.sortOrder ?? 0) - 1
        };
        // 새 에셋은 sort_order가 가장 작아(맨 앞) 결국 맨 왼쪽에 온다.
        // 로딩 자리표시도 처음부터 맨 왼쪽(prepend)에 둬, 완료 시 좌우로 튀지 않게 한다.
        setAssets((prev) => [tempAsset, ...prev]);
        setPendingAssetIds((prev) => new Set(prev).add(tempId));

        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadStickerAssetAction(formData);
        if (result.ok && result.asset) {
          const saved = result.asset;
          // 실제 저장 이미지(스토리지 URL)를 먼저 디코드한 뒤 교체 → src 교체 시 깜빡임 제거.
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = saved.fileUrl;
          });
          setAssets((prev) => prev.map((a) => (a.id === tempId ? saved : a)));
          setPendingAssetIds((prev) => {
            const next = new Set(prev);
            next.delete(tempId);
            return next;
          });
        } else {
          setPendingAssetIds((prev) => {
            const next = new Set(prev);
            next.delete(tempId);
            return next;
          });
          // 실패 → 임시 미리보기 제거.
          setAssets((prev) => prev.filter((a) => a.id !== tempId));
          if (!result.ok) lastError = result.error;
        }
        URL.revokeObjectURL(previewUrl);
      }
    } catch {
      lastError =
        "업로드에 실패했어요. 파일이 너무 크거나(2MB 이하) 네트워크 문제일 수 있어요.";
    } finally {
      setUploading(false);
    }
    if (lastError) {
      setStickerError(lastError);
    }
  }

  // 보관함(정렬·분류) 쓰기는 직렬 큐로 — 빠르게 여러 번 끌어도 마지막 순서가 서버의 진실이 된다
  // (요청이 서로 앞지르면 낙관적 화면과 DB가 어긋난다).
  async function queueAssetWrite<T>(run: () => Promise<T>): Promise<T> {
    const next = assetQueueRef.current.then(run, run);
    assetQueueRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  // 드래그로 바꾼 보관함 순서 저장 — 낙관적으로 먼저 바꾸고, 실패하면 되돌린다.
  async function reorderAssets(orderedIds: string[]) {
    const prev = assets;
    const byId = new Map(prev.map((a) => [a.id, a]));
    const next = orderedIds
      .map((id, index) => {
        const asset = byId.get(id);
        return asset ? { ...asset, sortOrder: index } : null;
      })
      .filter((a): a is StickerAsset => a !== null);
    if (next.length !== prev.length) {
      return; // 업로드 중 목록이 바뀐 경우 — 다음 드래그에서 다시 저장된다.
    }
    setAssets(next);
    // 아직 저장 안 된 임시 에셋은 서버에 보낼 수 없다(업로드가 끝나면 맨 앞으로 들어온다).
    const ids = next.map((a) => a.id).filter((id) => !id.startsWith("temp-"));
    const result = await queueAssetWrite(() =>
      stickerWrite<StickerAssetOpResult>(
        "assetOrder",
        { ids },
        { ok: false, error: "순서 저장에 실패했어요." }
      )
    );
    if (!result.ok) {
      setAssets(prev);
      setStickerError(result.error);
    } else {
      hapticTick(); // 서버 확정 — 집을 때 톡, 저장되면 한 번 더.
    }
  }

  // 분류(아바타/이모티콘/움직이는 이모티콘) 이동 — 탭 위로 끌어다 놓았을 때.
  async function setAssetKind(assetId: string, kind: StickerAssetKind) {
    if (assetId.startsWith("temp-")) {
      return;
    }
    const prev = assets;
    setAssets((cur) => cur.map((a) => (a.id === assetId ? { ...a, kind } : a)));
    const result = await queueAssetWrite(() =>
      stickerWrite<StickerAssetOpResult>(
        "assetKind",
        { id: assetId, kind },
        { ok: false, error: "분류 변경에 실패했어요." }
      )
    );
    if (!result.ok) {
      setAssets(prev);
      setStickerError(result.error);
    } else {
      hapticTick();
    }
  }

  // 업로드한 커스텀 이모지 삭제 (이를 쓰는 스티커도 함께 사라짐).
  async function removeAsset(assetId: string) {
    if (!deleteStickerAssetAction) {
      return;
    }
    // 낙관적 삭제: 보관함에서 즉시 빼고(새로고침 대기 없이 바로 사라짐), 이를 쓰는 스티커도 함께 정리.
    const removed = assets.find((a) => a.id === assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setStickers((prev) => prev.filter((s) => s.assetId !== assetId));
    // 에셋 삭제는 이를 쓰는 스티커를 서버에서 함께 지운다(FK cascade) → 월 재시드 때 stale prop
    // 에서 되살아나지 않도록 그 id들도 기억한다(모든 달 포함).
    schedule.stickers
      .filter((s) => s.assetId === assetId)
      .forEach((s) => deletedStickerIdsRef.current.add(s.id));
    // 실행취소/다시실행 히스토리에서도 이 에셋을 쓰는 스티커를 함께 비운다 —
    // 그렇지 않으면 Undo가 죽은 에셋을 되살리려다 FK 오류를 낸다.
    const scrub = (stacks: StickerInstance[][]) =>
      stacks.map((snap) => snap.filter((s) => s.assetId !== assetId));
    commitStacks(scrub(undoRef.current), scrub(redoRef.current));
    const result = await deleteStickerAssetAction(assetId);
    if (!result.ok) {
      setStickerError(result.error);
      if (removed) setAssets((prev) => [...prev, removed]); // 실패 → 되돌림
    }
  }

  async function deleteSelected() {
    const ids = selectedIds;
    if (ids.length === 0 || (!deleteStickerAction && !deleteStickerBatchAction)) {
      return;
    }
    pushHistory();
    const idSet = new Set(ids);
    // 실패 시 되돌릴 수 있게, 지우기 전 대상 스티커를 보관한다.
    const removedStickers = stickersRef.current.filter((s) => idSet.has(s.id));
    setStickers((prev) => prev.filter((s) => !idSet.has(s.id)));
    clearSelection();
    // 임시(미저장) 스티커는 서버 호출 없이 로컬에서만 제거된다.
    const realIds = ids.filter((id) => !id.startsWith("temp-"));
    if (realIds.length === 0) {
      return;
    }
    // 월 재시드 때 stale prop에서 되살아나지 않도록 삭제 id를 기억한다.
    realIds.forEach((id) => deletedStickerIdsRef.current.add(id));
    // 서버 삭제가 실패하면(권한·대상 문제) 낙관적 제거를 되돌려 "지워진 척" 가리지 않게 한다.
    const rollback = (message: string) => {
      setStickerError(message);
      realIds.forEach((id) => deletedStickerIdsRef.current.delete(id));
      setStickers((prev) => {
        const have = new Set(prev.map((s) => s.id));
        const restored = removedStickers.filter((s) => !have.has(s.id));
        return restored.length > 0 ? [...prev, ...restored] : prev;
      });
    };
    // 다중 삭제는 배치(.in() 단일 쿼리 + 무효화 1회)로 — 동접 중 캐시 thrash를 줄인다.
    if (deleteStickerBatchAction) {
      const result = await deleteStickerBatchAction(realIds);
      if (!result.ok) {
        rollback(result.error);
      }
    } else if (deleteStickerAction) {
      for (const id of realIds) {
        const result = await deleteStickerAction(id);
        if (!result.ok) {
          rollback(result.error);
        }
      }
    }
  }

  function changeOpacity(value: number) {
    const id = selectedSticker;
    if (!id) {
      return;
    }
    const sticker = stickers.find((s) => s.id === id);
    if (sticker) {
      updateStickerLocal({ ...sticker, opacity: value });
    }
  }

  // 좌우/상하 대칭 토글. 토글 즉시 저장.
  function toggleFlip(axis: "x" | "y") {
    const id = selectedSticker;
    if (!id) {
      return;
    }
    const sticker = stickers.find((s) => s.id === id);
    if (!sticker) {
      return;
    }
    pushHistory();
    const updated =
      axis === "x"
        ? { ...sticker, flipX: !sticker.flipX }
        : { ...sticker, flipY: !sticker.flipY };
    updateStickerLocal(updated);
    void commitSticker(updated);
  }

  // C6: 텍스트 스티커 글자색 변경(즉시 저장).
  function changeTextColor(color: string) {
    const sticker = stickers.find((s) => s.id === selectedSticker);
    if (!sticker) {
      return;
    }
    const updated = { ...sticker, textColor: color };
    updateStickerLocal(updated);
    void commitSticker(updated);
  }

  // #7: 텍스트 스티커 전용 — 문구/굵기/글꼴/크기 변경.
  function patchSelected(patch: Partial<StickerInstance>, commit = true) {
    const sticker = stickers.find((s) => s.id === selectedSticker);
    if (!sticker) {
      return;
    }
    const updated = { ...sticker, ...patch };
    updateStickerLocal(updated);
    if (commit) {
      void commitSticker(updated);
    }
  }
  function changeText(value: string) {
    patchSelected({ label: value }, false);
  }

  // C7: 외곽선/그림자 효과 토글(즉시 저장).
  function toggleEffect(effect: "outline" | "shadow") {
    const sticker = stickers.find((s) => s.id === selectedSticker);
    if (!sticker) {
      return;
    }
    pushHistory();
    const updated =
      effect === "outline"
        ? { ...sticker, outline: !sticker.outline }
        : { ...sticker, shadow: !sticker.shadow };
    updateStickerLocal(updated);
    void commitSticker(updated);
  }

  const selected = stickers.find((s) => s.id === selectedSticker) ?? null;

  // C: 선택한 스티커 옆에 떠서 따라다니는 편집 바의 화면 위치 계산.
  // 위쪽에 자리가 없으면 아래로 뒤집고, 가로는 스티커 중심에 맞춰 화면 안으로 가둔다.
  // 드래그 중 stickers가 바뀌면 매번 다시 계산해 스티커를 따라 움직인다.
  const anchorId = selectedIds[0] ?? null;
  const floatRef = useRef<HTMLDivElement>(null);
  const [floatStyle, setFloatStyle] = useState<CSSProperties | null>(null);
  // 편집 바는 document.body로 포털 렌더한다 — 위쪽 도구바의 backdrop-filter가 fixed 기준을
  // 가로채 엉뚱한 곳에 뜨던 문제를 없앤다. (포털은 클라이언트 마운트 후에만)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 편집 바 접기 — 옮기거나 모서리로 크기 조절할 때 가리지 않게. 새 스티커를 고르면 다시 펼친다.
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  useEffect(() => setToolbarCollapsed(false), [anchorId]);
  useLayoutEffect(() => {
    if (!decorate || !anchorId) {
      setFloatStyle(null);
      return;
    }
    function place() {
      const el = document.querySelector<HTMLElement>(`[data-sticker-id="${anchorId}"]`);
      const bar = floatRef.current;
      if (!el || !bar) {
        return;
      }
      const r = el.getBoundingClientRect();
      const bw = bar.offsetWidth;
      const bh = bar.offsetHeight;
      const gap = 12;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 편집 바(불투명·z-index 70·body 포털)가 헤더 띠(편집실로 돌아가기·계정변경 버튼)를
      // 덮으면 그 버튼의 첫 클릭을 가로채 "두 번 눌러야 넘어가는" 문제가 생긴다. 그래서
      // 헤더 아래쪽을 상단 한계로 삼아, 바가 헤더 영역으로 올라가지 않게 한다.
      const header = document.querySelector<HTMLElement>(".public-calendar-header");
      const topLimit = (header ? header.getBoundingClientRect().bottom : 0) + margin;
      let top = r.top - gap - bh; // 기본: 스티커 위
      if (top < topLimit) {
        top = r.bottom + gap; // 위가 좁거나 헤더를 침범하면 스티커 아래로
      }
      if (top + bh > vh - margin) {
        top = Math.max(topLimit, vh - margin - bh);
      }
      let left = r.left + r.width / 2 - bw / 2; // 스티커 중심 정렬
      left = Math.min(Math.max(margin, left), Math.max(margin, vw - margin - bw));
      setFloatStyle({ position: "fixed", top, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [decorate, anchorId, selectedIds.length, stickers, view, toolbarCollapsed, selected?.kind]);

  // 편집 바는 예전엔 달력(스티커 레이어) 배경을 클릭해야만 닫혔다. 화면 어디를 눌러도 닫히게
  // 한다 — 단, 스티커 자체나 편집 바 위 클릭은 제외(그건 선택/조작이라 닫으면 안 된다).
  useEffect(() => {
    if (!decorate || !anchorId) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest(".sticker-item") || target.closest(".sticker-toolbar-float")) {
        return;
      }
      clearSelection();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [decorate, anchorId]);

  // 신규 스티커를 로컬에 추가하고 저장 후 실제 id로 교체(복제 등에서 재사용).
  async function persistNewSticker(fresh: StickerInstance) {
    if (!saveStickerAction) {
      return;
    }
    setStickers((prev) => [...prev, fresh]);
    setSelectedSticker(fresh.id);
    const result = await saveStickerAction({
      year: fresh.year,
      month: fresh.month,
      emoji: fresh.kind === "emoji" ? fresh.label : undefined,
      assetId: fresh.kind === "image" ? fresh.assetId : undefined,
      shapeKey: fresh.kind === "shape" ? fresh.shapeKey : undefined,
      text: fresh.kind === "text" ? fresh.label : undefined,
      textColor: fresh.textColor,
      fontWeight: fresh.fontWeight,
      fontFamily: fresh.fontFamily,
      textAlign: fresh.textAlign,
      textBg: fresh.textBg,
      textFx: fresh.textFx,
      italic: fresh.italic,
      outline: fresh.outline,
      shadow: fresh.shadow,
      anim: fresh.anim,
      locked: fresh.locked,
      xRatio: fresh.xRatio,
      yRatio: fresh.yRatio,
      widthRatio: fresh.widthRatio,
      rotationDeg: fresh.rotationDeg,
      flipX: fresh.flipX,
      flipY: fresh.flipY,
      opacity: fresh.opacity,
      zIndex: fresh.zIndex
    });
    if (result.ok) {
      setStickers((prev) => prev.map((s) => (s.id === fresh.id ? { ...s, id: result.id } : s)));
      setSelectedSticker((cur) => (cur === fresh.id ? result.id : cur));
    } else {
      setStickers((prev) => prev.filter((s) => s.id !== fresh.id));
      setStickerError(result.error);
    }
  }

  function nextZIndex() {
    return stickersRef.current.reduce((max, s) => Math.max(max, s.zIndex), 0) + 1;
  }

  // ── C2: 실행취소/다시실행 ──────────────────────────────────────────
  // 변형(추가·삭제·이동·크기·회전·대칭·순서·복제) 직전에 현재 상태를 스냅샷한다.
  function snapshot(): StickerInstance[] {
    return stickersRef.current.map((s) => ({ ...s }));
  }
  function pushHistory() {
    // 새 변형은 redo 가지를 무효화한다(표준 undo/redo 동작).
    commitStacks([...undoRef.current.slice(-49), snapshot()], []);
  }
  // 재삽입으로 새 id가 발급되면 로컬 상태·히스토리 스택의 옛 id를 모두 새 id로 바꾼다.
  function remapId(oldId: string, newId: string) {
    const swap = (arr: StickerInstance[]) =>
      arr.map((s) => (s.id === oldId ? { ...s, id: newId } : s));
    setStickers((prev) => swap(prev));
    commitStacks(undoRef.current.map(swap), redoRef.current.map(swap));
    setSelectedSticker((cur) => (cur === oldId ? newId : cur));
  }
  // 스냅샷(target) 상태로 되돌리고, 그 차이를 서버에도 반영(삭제·재삽입·수정).
  async function applySnapshot(rawTarget: StickerInstance[]) {
    // 삭제된 커스텀 이모지를 가리키는 이미지 스티커는 되돌려도 재삽입할 수 없으므로(FK)
    // 스냅샷에서 제외한다 — 죽은 에셋만 빠지고 나머지 되돌리기는 정상 동작한다.
    const target = rawTarget.filter(isStickerAssetAlive);
    const current = stickersRef.current;
    setStickers(target);
    clearSelection();
    const targetIds = new Set(target.map((s) => s.id));
    const curIds = new Set(current.map((s) => s.id));
    // 1) target에 없는 현재 스티커 → 서버에서 삭제(배치 한 번).
    const toDelete = current
      .filter((s) => !targetIds.has(s.id) && !s.id.startsWith("temp-"))
      .map((s) => s.id);
    if (toDelete.length > 0) {
      if (deleteStickerBatchAction) {
        const r = await deleteStickerBatchAction(toDelete);
        if (!r.ok) setStickerError(r.error);
      } else if (deleteStickerAction) {
        for (const id of toDelete) await deleteStickerAction(id);
      }
    }
    // 2) 현재에 없는 target 스티커 → 재삽입(새 id 발급 후 remap). 인덱스로 id를 되짚어야 해
    //    안전하게 단건 호출을 유지한다(배치로 묶으면 remap 인덱스 어긋남 위험).
    for (const s of target) {
      if (!curIds.has(s.id) && saveStickerAction) {
        const result = await saveStickerAction(stickerToSaveInput(s, s.year, s.month, false));
        if (result.ok) {
          remapId(s.id, result.id);
        } else {
          setStickerError(result.error);
        }
      }
    }
    // 3) 양쪽에 다 있는 스티커 → 값 저장(이동/크기 등 되돌림 반영). 배치 한 번으로.
    const toUpdate = target.filter((s) => curIds.has(s.id) && !s.id.startsWith("temp-"));
    if (toUpdate.length > 0 && saveStickerBatchAction) {
      const r = await saveStickerBatchAction(
        toUpdate.map((s) => stickerToSaveInput(s, view.year, view.month, true))
      );
      if (!r.ok) setStickerError(r.error);
    } else {
      for (const s of target) {
        if (curIds.has(s.id)) {
          await commitSticker(s);
        }
      }
    }
  }
  function undo() {
    if (undoRef.current.length === 0) {
      return;
    }
    const target = undoRef.current[undoRef.current.length - 1];
    // 현재 상태를 redo 스택으로 올리고 undo 스택에서 하나 뺀다(ref가 진실, 동기 갱신).
    commitStacks(undoRef.current.slice(0, -1), [...redoRef.current, snapshot()]);
    void applySnapshot(target);
  }
  function redo() {
    if (redoRef.current.length === 0) {
      return;
    }
    const target = redoRef.current[redoRef.current.length - 1];
    commitStacks([...undoRef.current, snapshot()], redoRef.current.slice(0, -1));
    void applySnapshot(target);
  }

  // 복제: 선택한 스티커를 살짝 옮긴 위치에 똑같이 하나 더.
  function duplicateSelected() {
    const sources = selectedIds
      .map((id) => stickersRef.current.find((x) => x.id === id))
      .filter((s): s is StickerInstance => Boolean(s))
      // 삭제된 커스텀 이모지를 가리키는 스티커는 복제해도 저장이 막히므로(FK) 제외.
      .filter(isStickerAssetAlive);
    if (sources.length === 0) {
      return;
    }
    pushHistory();
    let z = nextZIndex();
    for (const s of sources) {
      void persistNewSticker({
        ...s,
        id: `temp-${Math.random().toString(36).slice(2)}`,
        xRatio: Math.min(1, s.xRatio + 0.03),
        yRatio: Math.min(1, s.yRatio + 0.03),
        zIndex: z++
      });
    }
  }

  // ── 스티커 월 간 복사/붙여넣기 ──
  // 월 이동은 라우트 리로드라 메모리 클립보드가 사라진다 → localStorage에 담아 다른 월에서도 붙인다.
  // 붙여넣을 때 좌표(xRatio/yRatio)를 그대로 둬, 복사한 그 자리에 그대로 붙는다(오프셋 없음).
  const STICKER_CLIPBOARD_KEY = "vic:sticker-clipboard:v1";
  function flashClipMsg(msg: string) {
    setStickerClipMsg(msg);
    if (stickerClipTimerRef.current) {
      window.clearTimeout(stickerClipTimerRef.current);
    }
    stickerClipTimerRef.current = window.setTimeout(() => setStickerClipMsg(null), 1400);
  }
  function copySelected() {
    const items = selectedIds
      .map((id) => stickersRef.current.find((x) => x.id === id))
      .filter((s): s is StickerInstance => Boolean(s))
      .filter(isStickerAssetAlive)
      // 전체를 그대로 저장 — 붙여넣을 때 id·year·month·zIndex만 새로 덮어쓴다(좌표는 보존).
      .map((s) => ({ ...s }));
    if (items.length === 0) {
      return;
    }
    try {
      window.localStorage.setItem(STICKER_CLIPBOARD_KEY, JSON.stringify(items));
      flashClipMsg(`스티커 ${items.length}개 복사됨 — 다른 달에서 Ctrl+V`);
    } catch {
      /* 사생활 모드 등 localStorage 불가 — 조용히 무시 */
    }
  }
  function pasteClipboard() {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STICKER_CLIPBOARD_KEY);
    } catch {
      return;
    }
    if (!raw) {
      return;
    }
    let items: StickerInstance[];
    try {
      items = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }
    pushHistory();
    let z = nextZIndex();
    for (const it of items) {
      // 다른 달에 붙이면 '복사한 그 자리' 그대로. 같은 달이면 원본과 겹쳐 구분이 안 되니 살짝 오프셋.
      const sameMonth = it.year === view.year && it.month === view.month;
      const off = sameMonth ? 0.03 : 0;
      void persistNewSticker({
        ...it,
        id: `temp-${Math.random().toString(36).slice(2)}`,
        year: view.year,
        month: view.month,
        xRatio: Math.min(1, it.xRatio + off),
        yRatio: Math.min(1, it.yRatio + off),
        zIndex: z++
      });
    }
    flashClipMsg(`스티커 ${items.length}개 붙여넣음`);
  }

  // 레이어 순서: 맨 앞 / 맨 뒤로 보내기.
  function reorderSelected(toFront: boolean) {
    const s = stickersRef.current.find((x) => x.id === selectedSticker);
    if (!s) {
      return;
    }
    pushHistory();
    const zs = stickersRef.current.map((x) => x.zIndex);
    const updated = {
      ...s,
      zIndex: toFront ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1
    };
    updateStickerLocal(updated);
    void commitSticker(updated);
  }

  function scheduleCommit(stickersToSave: StickerInstance | StickerInstance[]) {
    const list = Array.isArray(stickersToSave) ? stickersToSave : [stickersToSave];
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = setTimeout(() => {
      for (const s of list) {
        void commitSticker(s);
      }
    }, 350);
  }

  // 키보드 미세 이동(저장은 디바운스). 다중 선택 시 선택 전체를 함께 옮긴다.
  function nudgeSelected(dx: number, dy: number) {
    const ids = selectedIds;
    if (ids.length === 0) {
      return;
    }
    // 연속된 방향키 입력은 하나의 실행취소 단위로 묶는다(0.5초 간격 기준).
    const now = Date.now();
    if (now - nudgeBurstRef.current > 500) {
      pushHistory();
    }
    nudgeBurstRef.current = now;
    const updatedList: StickerInstance[] = [];
    for (const id of ids) {
      const s = stickersRef.current.find((x) => x.id === id);
      if (!s) {
        continue;
      }
      const updated = {
        ...s,
        xRatio: Math.min(1, Math.max(0, s.xRatio + dx)),
        yRatio: Math.min(1, Math.max(0, s.yRatio + dy))
      };
      updateStickerLocal(updated);
      updatedList.push(updated);
    }
    scheduleCommit(updatedList);
  }

  // P2-STICKER-1: 키보드 크기(+/-)·회전([/]) — 화살표 미세이동과 같은 패턴(연속 입력은 하나의
  // 실행취소 단위, 낙관 반영 + 지연 커밋). 포인터 핸들과 같은 한계값(widthRatio 0.008~0.6).
  function adjustSelected(patch: (s: StickerInstance) => Partial<StickerInstance>) {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const now = Date.now();
    if (now - nudgeBurstRef.current > 500) {
      pushHistory();
    }
    nudgeBurstRef.current = now;
    const updatedList: StickerInstance[] = [];
    for (const id of ids) {
      const s = stickersRef.current.find((x) => x.id === id);
      if (!s || s.locked) continue;
      const updated = { ...s, ...patch(s) };
      updateStickerLocal(updated);
      updatedList.push(updated);
    }
    scheduleCommit(updatedList);
  }
  function resizeSelectedBy(factor: number) {
    adjustSelected((s) => ({
      widthRatio: Math.min(0.6, Math.max(0.008, s.widthRatio * factor))
    }));
  }
  function rotateSelectedBy(deltaDeg: number) {
    adjustSelected((s) => ({ rotationDeg: Math.round(s.rotationDeg + deltaDeg) }));
  }

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
    setMonthDir(offset >= 0 ? "next" : "prev");
    const next = getAdjacentMonth(view.year, view.month, offset);
    setView(next);
    onViewChange?.(next.year, next.month); // 부모(편집실)에 바뀐 달 알림
    // 보던 달을 쿠키에 기록 → 새로고침 시 서버가 읽어 그 달로 바로 렌더(URL·라우터 안 건드림).
    // 월은 화면 구분 없이 하나(sy/sm)로 통일한다 — 시청자에서 본 달이 계정 전환 후 편집실로도
    // 이어진다("마지막 본 달"). 꾸미기는 편집 맥락이 달라 별도 키(dy/dm)를 유지. 편집실 미리보기는
    // accountSwitch=false라 여기서 안 쓰고, onViewChange로 편집실 쿠키(sy/sm)가 처리한다.
    if (decorateProp) {
      writeViewCookie({ dy: next.year, dm: next.month });
    } else if (accountSwitch) {
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
  function renderDayCell(cell: MonthCell, weekSupCount: number, cellIndex: number) {
    const covering = getEventsForDate(liveEvents, cell.isoDate);
    const supportHere = covering.filter((e) => e.isSupport);
    const events = covering.filter((e) => !e.isSupport);
    const day = classifyDay(cell.isoDate, cell.weekday, today);
    const visibleDayMark = showWorldCupFeatures
      ? getDayMark(cell.isoDate)
      : withoutWorldCupMark(getDayMark(cell.isoDate));
    const showHeaderMark = Boolean(visibleDayMark?.name);
    const visibleMatch = visibleDayMark?.match ?? null;

    // 이 칸의 대표 관심 단계 — 진입 시 단계별로 칸을 부각하는 애니메이션(data-pop)에 쓴다.
    let popTier: string | null = null;
    if (interactive) {
      let bestRank = 0;
      for (const e of events) {
        const t = heartTier(heartCounts[e.id] ?? 0, topEventIds.has(e.id));
        if (t && POP_RANK[t.key] > bestRank) {
          bestRank = POP_RANK[t.key];
          popTier = t.key;
        }
      }
    }

    return (
      <article
        className={`public-day ${cell.inCurrentMonth ? "" : "outside"} ${
          day.isToday ? "today" : ""
        }${rangeSelected.has(cellIndex) ? " cell-range-selected" : ""}${
          visibleMatch?.kind === "wc-korea-win" ? " day-win" : ""
        }`}
        data-pop={popTier ?? undefined}
        data-cell-index={cellIndex}
        key={cell.isoDate}
      >
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
          const bandClass = `support-bar${isDimmedByFilter(s) ? " dimmed" : ""}${
            bandClickable ? " is-clickable" : ""
          }${showLabel ? " sb-head" : ""}${hoverSupportId === s.id ? " is-hover" : ""}`;
          const bandStyle = {
            // 머리글 높이(--day-head-h)에서 파생 — 확대해도 날짜와 겹치지 않는다.
            // -1px은 머리글 밑선에 살짝 걸쳐 띠가 떠 보이지 않게 하는 기존 여백.
            top: `calc(var(--day-head-h, 27px) - 1px + ${lane * 20}px)`,
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
                🌱
              </i>
              {s.publicTitle}
              {/* 남는 가로 폭 = 클릭 유도 문구(시청자 전용, 띠 위로 흘러감). */}
              {bandClickable ? <em className="sb-cta">도와주러 가기 →</em> : null}
            </span>
          ) : null;
          if (bandClickable && s.supportUrl) {
            return (
              <a
                aria-label={`${s.publicTitle} 도와주러 가기(새 탭)`}
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
                title="도와주러 가기 (새 탭에서 열림)"
                {...bandHover}
              >
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
              {...bandHover}
              {...(openSupportDetail
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    "aria-label": `${s.publicTitle} 업 도움 상세`,
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
              // 특별한 날 표기를 탭하면 그 자리에서 빵빠레가 터진다. 한국 승은 큰 폭죽.
              <button
                type="button"
                className={`day-mark celebratable${
                  visibleDayMark?.kind ? ` ${visibleDayMark.kind}` : ""
                }`}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  popBurst(
                    r.left + r.width / 2,
                    r.top + r.height / 2,
                    visibleDayMark?.kind === "wc-korea-win"
                      ? "win"
                      : visibleDayMark?.kind === "wc-korea-done"
                        ? "console"
                        : "cheer"
                  );
                }}
              >
                {visibleDayMark?.name}
              </button>
            ) : (
              <em
                className={`day-mark${
                  visibleDayMark?.kind ? ` ${visibleDayMark.kind}` : ""
                }`}
              >
                {visibleDayMark?.name}
              </em>
            )
          ) : null}
        </div>
        {/* 월드컵 경기 대진·스코어 — 헤더에 욱여넣지 않고 칸 본문 전체폭 칩으로(통일·균형·리듬).
            헤더 슬롯은 초복·절기 등에 양보. 탭하면 이 칩에서 빵빠레(한국 승=큰 폭죽). */}
        {visibleMatch ? (
          interactive ? (
            <button
              type="button"
              className={`day-wc-match ${visibleMatch.kind}`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                popBurst(
                  r.left + r.width / 2,
                  r.top + r.height / 2,
                  visibleMatch.celebrate === "win"
                    ? "win"
                    : visibleMatch.celebrate === "done"
                      ? "console"
                      : "cheer"
                );
              }}
            >
              {visibleMatch.text}
            </button>
          ) : (
            <div className={`day-wc-match ${visibleMatch.kind}`}>{visibleMatch.text}</div>
          )
        ) : null}
        <div
          className="day-events"
          style={weekSupCount > 0 ? { paddingTop: 8 + weekSupCount * 20 } : undefined}
        >
          {events.map((rawEvent) => {
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
                return (
                  <TeaserRevealing
                    className="public-event teaser-revealing"
                    key={event.id}
                    onReveal={() => revealTeaser(rawEvent.id, false)}
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
              ? heartTier(heartCounts[event.id] ?? 0, topEventIds.has(event.id))
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
                    >
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
                      {/* 메타 줄: 인기 불꽃(왼쪽) + (서브가 없을 때만) 형식색 점(오른쪽). 시작 칸에만. */}
                      {span.showTitle && (tier || (dots && subs.length === 0)) ? (
                        <div
                          className={`event-meta${revealStagger(stag, main, subs.length).className}`}
                          style={revealStagger(stag, main, subs.length).style}
                        >
                          {tier ? (
                            <span className={`event-popular tier-${tier.key}`} title={tier.label} aria-label={`관심 단계: ${tier.label}`}>
                              <span className="flame" aria-hidden="true">{tier.flames}</span>
                            </span>
                          ) : null}
                          {dots && subs.length === 0 ? dots : null}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
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
      const rawMark = getDayMark(cell.isoDate);
      const mark = showWorldCupFeatures ? rawMark : withoutWorldCupMark(rawMark);
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
                  >
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
              >
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
              >
                필터 해제
              </button>
            ) : null}
            {/* 남는 공간에 인기 배지 단계 안내(웹과 동일, 모바일용으로 간결하게). */}
            <div className="agenda-tier-help">
              <strong>♥ 인기도</strong>
              {/* 모바일 좁은 레일(92px) — 라벨을 짧게 줄여 '불꽃+라벨'을 한 줄(가로)에 담는다.
                  (세로로 쌓으면 불꽃이 어느 라벨 것인지 헷갈림.) 웹 범례는 긴 라벨 유지. */}
              <span>
                <b className="flame">🔥</b> 관심
              </span>
              <span>
                <b className="flame">🔥🔥</b> 높음
              </span>
              <span>
                <b className="flame">🔥🔥🔥</b> 폭발
              </span>
              <span>
                <b className="flame">👑</b> 1위
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
            >
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
                  >
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
                    // 모바일 아젠다는 폭이 넉넉해 헤더 마크(초복/절기)와 월드컵 경기를 한 pill에 함께.
                    const markKind = mark.match?.kind ?? mark.kind;
                    const markText = mark.match
                      ? mark.name
                        ? `${mark.match.text} · ${mark.name}`
                        : mark.match.text
                      : mark.name;
                    if (!markText) return null;
                    return interactive ? (
                      <button
                        type="button"
                        className={`agenda-mark celebratable ${mark.isHoliday ? "holiday" : ""}${
                          markKind === "wc-korea-win" ? " wc-korea-win" : ""
                        }`}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          const celeb = mark.match?.celebrate;
                          popBurst(
                            r.left + r.width / 2,
                            r.top + r.height / 2,
                            celeb === "win" ? "win" : celeb === "done" ? "console" : "cheer"
                          );
                        }}
                      >
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
                            key={event.id}
                            onReveal={() => revealTeaser(rawEvent.id, false)}
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
                        ? heartTier(heartCounts[event.id] ?? 0, topEventIds.has(event.id))
                        : null;
                    const single = support
                      ? { background: "#84b74f" }
                      : colors[0]
                        ? { background: colors[0].bgColor }
                        : undefined;
                    const twoColor = !support && colors.length >= 2;
                    const end = event.endDateKey;
                    // 카드 탭 = 상세 시트(하트·링크 등 내부 컨트롤 탭은 제외).
                    const openDetail = () => {
                      hapticTick();
                      setAgendaDetail({ event, support, dateKey: cell.isoDate });
                    };
                    return (
                      <div
                        className={`agenda-event tappable${justRevealed.has(rawEvent.id) ? " just-revealed" : ""}`}
                        data-eventid={support ? undefined : event.id}
                        key={(support ? "s-" : "") + event.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, a")) return;
                          openDetail();
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          if ((e.target as HTMLElement).closest("button, a")) return;
                          e.preventDefault();
                          openDetail();
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
                                ? `🌱 ${event.publicTitle}`
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
                              >
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
                                    className="agenda-link"
                                    href={event.supportUrl}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    도우러 가기
                                    <ExternalLink aria-hidden="true" size={13} />
                                  </a>
                                ) : null}
                                {/* 메타 한 줄: 관심(왼쪽) + (서브 없을 때만) 형식색 점(오른쪽). */}
                                {tier || (dots && subs.length === 0) ? (
                                  <div
                                    className={`agenda-meta${revealStagger(stag, main, subs.length).className}`}
                                    style={revealStagger(stag, main, subs.length).style}
                                  >
                                    {tier ? (
                                      <span className={`event-popular tier-${tier.key}`} title={tier.label} aria-label={`관심 단계: ${tier.label}`}>
                                        <span className="flame" aria-hidden="true">{tier.flames}</span>
                                      </span>
                                    ) : null}
                                    {dots && subs.length === 0 ? dots : null}
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
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
  const posterMainRef = useRef<HTMLElement | null>(null); // 스티커 기준 probe가 scene 클래스 원복에 사용
  const posterZoomStepperRef = useRef(createWheelStepper());
  useEffect(() => {
    if (showAgenda || decorate) return;
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
  }, [showAgenda, decorate]);

  // 스티커 좌표 보정(해법 1 최종형, 2026-08-01) — 저장 좌표의 기준은 '기본 지오메트리'
  // (아바타 OFF·확대 100%)의 표면 비율. scene/확대에서 달력 그리드가 움직이면 기준(canon)↔
  // 현재(live) 지오메트리를 실측해 구간별 매핑으로 보정한다(저장 시 역매핑, DB 불변).
  // - x: 열(요일) 경계 8개 실측 → 칸 구간별 선형(칸 안 내용은 stretch라 비례가 정답).
  // - y: 행마다 [행 top → 콘텐츠 하단 → 행 bottom] 두 구간 앵커 — 카드는 행 top부터 쌓이므로
  //   카드 옆 스티커는 콘텐츠 구간을, 빈 아래 공간의 스티커는 슬랙 구간을 따라간다.
  //   (전행 비례·px×글자배율 모델은 6모드 fixture 실측에서 각각 아래로 드리프트 — 폐기.)
  // - 아바타 기본 ON 등으로 기준을 잴 기회가 없어도 probe가 한 프레임 안에서 scene 클래스·
  //   --cal-zoom을 잠깐 원복해 기준을 실측한다(트랜지션 off + 동기 블록 = paint 전이라 안 보임).
  type StickerFrame = {
    x: number;
    y: number;
    w: number;
    h: number;
    cols: number[]; // 열(요일) 경계 x — 8개(칸 판별용)
    xs: number[]; // x 매핑 앵커 — 열마다 [칸L, 카드L, 카드R] + 마지막 칸R(카드 좌우변 고정)
    rowTops: number[]; // 행(주) 경계 y — n+1개
    cells: number[][]; // 칸별 y 앵커(칸 top·날짜줄·각 카드 상/하단·칸 bottom, DOM 순서 고정)
  };
  const sceneOn = avatarCapable && avatarOn;
  const sceneOnRef = useRef(sceneOn);
  sceneOnRef.current = sceneOn;
  const posterZoomRef = useRef(posterZoom);
  posterZoomRef.current = posterZoom;
  const [stickerFrames, setStickerFrames] = useState<{
    canon: StickerFrame | null;
    live: StickerFrame | null;
  }>({ canon: null, live: null });
  const stickerCanonRef = useRef<StickerFrame | null>(null);
  stickerCanonRef.current = stickerFrames.canon;
  // 현재 DOM에서 프레임 실측 — 표면·그리드가 같은 transform scale 안이라 비율은 배율 무관 정확.
  const readStickerFrame = useCallback((): StickerFrame | null => {
    const s = stickerSurfaceElRef.current;
    const g = stickerGridElRef.current;
    if (!s || !g) return null;
    const sr = s.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    if (sr.width < 1 || sr.height < 1 || gr.width < 1 || gr.height < 1) return null;
    const cellEls = Array.from(g.querySelectorAll<HTMLElement>(".public-day"));
    if (cellEls.length < 7) return null;
    const cols: number[] = [];
    for (let i = 0; i < 7; i++) {
      cols.push((cellEls[i].getBoundingClientRect().left - sr.left) / sr.width);
    }
    cols.push((cellEls[6].getBoundingClientRect().right - sr.left) / sr.width);
    // 칸 안 카드의 좌우 여백(px 상수) — 순수 비례 매핑은 이 상수까지 비례로 늘려 카드
    // 우변에 붙인 스티커가 ~1px대로 밀렸다. 아무 카드 하나에서 실측해 열마다
    // [칸L, 카드L, 카드R, 칸R] 4앵커를 깐다(카드 좌우변이 앵커 = 정확히 고정).
    let padL = 0;
    let padR = 0;
    const anyCard = g.querySelector(".public-event");
    if (anyCard) {
      const cardRect = anyCard.getBoundingClientRect();
      const hostCell = anyCard.closest(".public-day");
      if (hostCell) {
        const hostRect = hostCell.getBoundingClientRect();
        padL = Math.max(0, cardRect.left - hostRect.left) / sr.width;
        padR = Math.max(0, hostRect.right - cardRect.right) / sr.width;
      }
    }
    const xs: number[] = [];
    for (let k = 0; k < 7; k++) {
      const L = cols[k];
      const R = cols[k + 1];
      xs.push(L);
      if (padL + padR > 0 && L + padL < R - padR) {
        xs.push(L + padL, R - padR);
      }
      // (여백 실측 실패 시 열 경계만 — 이전과 동일한 폴백)
    }
    xs.push(cols[7]);
    const rowTops: number[] = [];
    for (let i = 0; i < cellEls.length; i += 7) {
      rowTops.push((cellEls[i].getBoundingClientRect().top - sr.top) / sr.height);
    }
    rowTops.push(
      (cellEls[cellEls.length - 1].getBoundingClientRect().bottom - sr.top) / sr.height
    );
    // 칸별 y 앵커: [칸 top, 날짜줄 bottom, 카드1 top, 카드1 bottom, …, 칸 bottom].
    // DOM 순서 고정이라 기준/현재 프레임의 앵커가 1:1로 짝지어진다(정렬 금지 — 짝이 깨진다).
    // 카드 상·하단이 앵커라 카드 '옆'에 붙인 스티커는 그 카드 모서리를 정확히 따라간다.
    const cells: number[][] = cellEls.map((cell) => {
      const r = cell.getBoundingClientRect();
      const top = (r.top - sr.top) / sr.height;
      const bottom = (r.bottom - sr.top) / sr.height;
      const list = [top];
      const push = (px: number) => {
        const v = (px - sr.top) / sr.height;
        list.push(Math.min(Math.max(v, list[list.length - 1]), bottom));
      };
      const strip = cell.querySelector(".day-strip");
      if (strip) push(strip.getBoundingClientRect().bottom);
      cell.querySelectorAll(".public-event, .day-wc-match").forEach((el) => {
        const er = el.getBoundingClientRect();
        push(er.top);
        push(er.bottom);
      });
      list.push(bottom);
      return list;
    });
    return {
      x: (gr.left - sr.left) / sr.width,
      y: (gr.top - sr.top) / sr.height,
      w: gr.width / sr.width,
      h: gr.height / sr.height,
      cols,
      xs,
      rowTops,
      cells
    };
  }, []);
  // 기준 지오메트리 probe — scene 클래스/--cal-zoom을 트랜지션 없이 잠깐 원복해 실측 후 복구.
  // 전 과정이 동기라 브라우저가 그 사이를 paint하지 않는다(깜빡임 없음).
  const probeCanonFrame = useCallback((): StickerFrame | null => {
    const main = posterMainRef.current;
    if (!main) return null;
    // 표면 등장(pop-intro)·월 슬라이드(data-enter) 애니 중엔 rect가 이동 중이라 기준이
    // 오염된다(로드 타이밍 따라 스티커가 엉뚱한 칸에 붙던 레이스). 애니가 끝난 뒤에만 잰다
    // — 실패 시 measure 쪽에서 재시도한다. (표면/달력 영역 '자신'의 애니만 검사 — 불꽃 등
    // 자손의 무한 장식 애니는 지오메트리와 무관하므로 무시.)
    const surf = stickerSurfaceElRef.current;
    const calArea = surf?.querySelector(".public-calendar-area");
    const animating = [surf, calArea].some(
      (el) =>
        el &&
        typeof el.getAnimations === "function" &&
        el.getAnimations().some((a) => a.playState === "running")
    );
    if (animating) return null;
    const cal = posterCalRef.current;
    const sceneCls = ["avatar-scene", "avatar-left", "avatar-right"].filter((c) =>
      main.classList.contains(c)
    );
    main.classList.add("sticker-geom-probe");
    sceneCls.forEach((c) => main.classList.remove(c));
    const prevZoom = cal?.style.getPropertyValue("--cal-zoom") ?? "";
    cal?.style.setProperty("--cal-zoom", "1");
    const frame = readStickerFrame();
    sceneCls.forEach((c) => main.classList.add(c));
    if (cal) {
      if (prevZoom) cal.style.setProperty("--cal-zoom", prevZoom);
      else cal.style.removeProperty("--cal-zoom");
    }
    // ⚠ probe 클래스를 떼기 '전에' 강제 reflow — 트랜지션이 꺼진 채 원상태를 확정해, 떼는
    // 순간 기본↔scene 재전환 애니가 새로 시작되는 것을 막는다(토글 직후 일시 틀어짐 원인).
    void main.offsetWidth;
    main.classList.remove("sticker-geom-probe");
    return frame;
  }, [readStickerFrame]);
  const measureRetryRef = useRef<() => void>(() => {});
  const measureStickerFrames = useCallback(() => {
    const next = readStickerFrame();
    if (!next) return;
    // 기준(canon)은 언제나 probe로 얻는다 — '기본 상태로 보이는 순간'의 live를 기준 삼으면
    // 전환 애니 중간 지오메트리가 기준을 오염시킨다(토글 직후 크게 틀어지던 레이스의 원인).
    const probed = !stickerCanonRef.current ? probeCanonFrame() : null;
    // 등장/월 슬라이드 애니 때문에 기준을 못 쟀으면 잠시 뒤 재시도(애니 종료는 RO를 안 울린다).
    if (!stickerCanonRef.current && !probed) {
      window.setTimeout(() => measureRetryRef.current(), 450);
    }
    setStickerFrames((prev) => {
      const sameArr = (a: number[], b: number[]) =>
        a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
      const same = (a: StickerFrame | null, b: StickerFrame) =>
        !!a &&
        Math.abs(a.x - b.x) < 1e-4 &&
        Math.abs(a.y - b.y) < 1e-4 &&
        Math.abs(a.w - b.w) < 1e-4 &&
        Math.abs(a.h - b.h) < 1e-4 &&
        sameArr(a.cols, b.cols) &&
        sameArr(a.xs, b.xs) &&
        sameArr(a.rowTops, b.rowTops) &&
        a.cells.length === b.cells.length &&
        a.cells.every((c, i) => sameArr(c, b.cells[i]));
      const live = same(prev.live, next) ? prev.live : next;
      const canonNext = probed ?? prev.canon;
      const canon = canonNext && same(prev.canon, canonNext) ? prev.canon : canonNext;
      return live === prev.live && canon === prev.canon ? prev : { canon, live };
    });
  }, [readStickerFrame, probeCanonFrame]);
  measureRetryRef.current = measureStickerFrames;
  // 월이 바뀌면 그리드 내용이 달라 기준도 무효 — 다음 실측에서 다시 probe한다.
  useEffect(() => {
    setStickerFrames({ canon: null, live: null });
  }, [view.year, view.month]);
  useEffect(() => {
    if (showAgenda) return;
    measureStickerFrames();
    const ro = new ResizeObserver(() => measureStickerFrames());
    if (stickerSurfaceElRef.current) ro.observe(stickerSurfaceElRef.current);
    if (stickerGridElRef.current) ro.observe(stickerGridElRef.current);
    return () => ro.disconnect();
    // view = 월 전환 시 그리드가 remount되므로 새 엘리먼트를 다시 관찰한다.
  }, [showAgenda, view.year, view.month, sceneOn, posterZoom, measureStickerFrames]);
  // 콜드 스타트 폴백(기준 실측 전) — 예전 상수 x 보정만이라도.
  // ⚠ 252(레일 폭)·16(컬럼 gap)은 .poster-surface grid-template-columns와 함께 움직인다.
  const FALLBACK_K = POSTER_DESIGN_W / (POSTER_DESIGN_W - 252 - 16);
  const stickerMap = useMemo(() => {
    const { canon, live } = stickerFrames;
    if (!canon || !live) {
      // probe까지 실패한 극단 폴백 — scene x 상수 보정만이라도.
      return sceneOn
        ? {
            to: (s: StickerInstance) => ({
              ...s,
              xRatio: Math.min(1, s.xRatio * FALLBACK_K)
            }),
            from: (s: StickerInstance) => ({ ...s, xRatio: s.xRatio / FALLBACK_K })
          }
        : null;
    }
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    // 앵커 배열(canon A ↔ live B) 사이 구간별 선형 매핑 — 경계 밖은 전체 span 비율로 외삽.
    // x 앵커 = 열 경계 8개(칸 안 내용은 stretch라 칸 안 비례가 정답). y 앵커 = 스티커가 앉은
    // '그 칸'의 [칸 top·날짜줄·각 카드 상/하단·칸 bottom] — 카드 모서리가 앵커라 카드 옆
    // 스티커는 어느 모드에서든 그 카드 모서리에 붙는다. 칸을 못 찾으면 행 경계 매핑으로 폴백.
    // 프레임이 같으면(기본 상태) 자연히 항등 — 전환 애니 중에도 live가 프레임 단위로 따라온다.
    const okX = canon.xs.length >= 2 && canon.xs.length === live.xs.length;
    const okCols = canon.cols.length >= 2 && canon.cols.length === live.cols.length;
    const okRows = canon.rowTops.length >= 2 && canon.rowTops.length === live.rowTops.length;
    const mapPiece = (v: number, A: number[], B: number[], aSpan: number, bSpan: number) => {
      const n = A.length;
      const scale = aSpan > 0 ? bSpan / aSpan : 1;
      if (v <= A[0]) return B[0] + (v - A[0]) * scale;
      if (v >= A[n - 1]) return B[n - 1] + (v - A[n - 1]) * scale;
      for (let k = 0; k < n - 1; k++) {
        if (v <= A[k + 1]) {
          const w = A[k + 1] - A[k];
          const t = w > 0 ? (v - A[k]) / w : 0;
          return B[k] + t * (B[k + 1] - B[k]);
        }
      }
      return B[n - 1];
    };
    // (x,y)가 프레임 f에서 어느 칸(index)에 있는지 — 그리드 밖이면 -1.
    const cellIndexAt = (f: StickerFrame, x: number, y: number) => {
      if (!okRows) return -1;
      if (x < f.cols[0] || x > f.cols[f.cols.length - 1]) return -1;
      if (y < f.rowTops[0] || y > f.rowTops[f.rowTops.length - 1]) return -1;
      let col = 6;
      for (let k = 0; k < 7; k++) {
        if (x <= f.cols[k + 1]) {
          col = k;
          break;
        }
      }
      let row = f.rowTops.length - 2;
      for (let k = 0; k < f.rowTops.length - 1; k++) {
        if (y <= f.rowTops[k + 1]) {
          row = k;
          break;
        }
      }
      const idx = row * 7 + col;
      return idx < f.cells.length ? idx : -1;
    };
    const toX = (x: number) =>
      okX
        ? mapPiece(x, canon.xs, live.xs, canon.w, live.w)
        : okCols
          ? mapPiece(x, canon.cols, live.cols, canon.w, live.w)
          : live.x + ((x - canon.x) * live.w) / canon.w;
    const fromX = (x: number) =>
      okX
        ? mapPiece(x, live.xs, canon.xs, live.w, canon.w)
        : okCols
          ? mapPiece(x, live.cols, canon.cols, live.w, canon.w)
          : canon.x + ((x - live.x) * canon.w) / live.w;
    const toY = (x: number, y: number) => {
      const ci = cellIndexAt(canon, x, y);
      if (ci >= 0 && ci < live.cells.length) {
        const A = canon.cells[ci];
        const B = live.cells[ci];
        if (A.length === B.length && A.length >= 2) {
          return mapPiece(y, A, B, canon.h, live.h);
        }
      }
      return okRows
        ? mapPiece(y, canon.rowTops, live.rowTops, canon.h, live.h)
        : live.y + ((y - canon.y) * live.h) / canon.h;
    };
    const fromY = (x: number, y: number) => {
      const ci = cellIndexAt(live, x, y);
      if (ci >= 0 && ci < canon.cells.length) {
        const A = live.cells[ci];
        const B = canon.cells[ci];
        if (A.length === B.length && A.length >= 2) {
          return mapPiece(y, A, B, live.h, canon.h);
        }
      }
      return okRows
        ? mapPiece(y, live.rowTops, canon.rowTops, live.h, canon.h)
        : canon.y + ((y - live.y) * canon.h) / live.h;
    };
    return {
      to: (s: StickerInstance) => ({
        ...s,
        xRatio: clamp01(toX(s.xRatio)),
        yRatio: clamp01(toY(s.xRatio, s.yRatio))
      }),
      from: (s: StickerInstance) => ({
        ...s,
        xRatio: fromX(s.xRatio),
        yRatio: fromY(s.xRatio, s.yRatio)
      })
    };
  }, [sceneOn, stickerFrames, FALLBACK_K]);
  // dev 전용: fixture 실측 스크립트가 내부 매핑 상태를 검사할 수 있게 창에 노출(프로덕션 제외).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __stickerMapDebug?: unknown }).__stickerMapDebug = {
      sceneOn,
      posterZoom,
      frames: stickerFrames,
      map: stickerMap, // to/from 함수 — fixture 실측 스크립트가 가상 좌표를 검증할 때 사용
      mapped: stickerMap
        ? stickers.map((s) => ({ id: s.id, to: stickerMap.to(s) }))
        : null
    };
  });
  const sceneStickers = useMemo(
    () => (stickerMap ? stickers.map(stickerMap.to) : stickers),
    [stickers, stickerMap]
  );
  const unmapSceneSticker = useCallback(
    (s: StickerInstance): StickerInstance => (stickerMap ? stickerMap.from(s) : s),
    [stickerMap]
  );

  // 꾸미기 단축키 안내 접기/펴기 — 선택은 로컬에 기억(방송 준비 중 화면 정리용).
  const [shortcutOpen, setShortcutOpen] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("vic_shortcut_help_open") === "0") setShortcutOpen(false);
    } catch {
      /* localStorage 접근 불가 환경 무시 */
    }
  }, []);
  function toggleShortcutHelp() {
    hapticTick();
    setShortcutOpen((v) => {
      try {
        window.localStorage.setItem("vic_shortcut_help_open", v ? "0" : "1");
      } catch {
        /* 무시 */
      }
      return !v;
    });
  }

  // 레일 정보 카드(연·월 · 데뷔 D+ · 오늘) — 평소엔 표면 안 오른쪽 레일에, 아바타 scene에선
  // 아바타 자리 좌상단으로 옮겨 뜬다. 한 JSX를 두 자리에서 재사용해 마크업이 안 어긋나게 한다.
  const railInfoCard = (() => {
    const dplus = debutDPlus(today);
    const wd = new Date(`${today}T00:00:00Z`).getUTCDay();
    return (
      <div className="rail-info-card">
        {/* 보는 달 — 옛 상단 마스트헤드가 여기로. */}
        <span className="ric-month">
          <b>
            {view.year}년 {String(view.month).padStart(2, "0")}월
          </b>
        </span>
        {/* 라벨(왼쪽, 조용히) ↔ 값(오른쪽, 굵게) 정렬 — 두 줄이 같은 문법을 공유. */}
        {dplus !== null ? (
          <span className="ric-row">
            <em>🎂 데뷔</em>
            <b className="ric-dplus">D+{dplus}</b>
          </span>
        ) : null}
        <span className="ric-row">
          <em>오늘</em>
          {/* 연도까지 풀 날짜 + 요일은 달력과 같은 색 문법(일=빨강, 토=파랑). */}
          <b className="ric-today">
            {Number(today.slice(0, 4))}.{formatShortDate(today)}{" "}
            <i className={wd === 0 ? "sunday" : wd === 6 ? "saturday" : undefined}>
              ({WEEKDAYS[wd]})
            </i>
          </b>
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
              disabled={decorate}
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
      >
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
              <span className="flame">🔥</span> 관심
            </li>
            <li>
              <span className="flame">🔥🔥</span> 높은
            </li>
            <li>
              <span className="flame">🔥🔥🔥</span> 폭발
            </li>
            <li>
              <span className="flame">👑</span> 1위
            </li>
          </ul>
        ) : (
          <ul className="legend-tiers">
            <li>
              <span className="flame">🔥</span> 관심
            </li>
            <li>
              <span className="flame">🔥🔥</span> 높은 관심
            </li>
            <li>
              <span className="flame">🔥🔥🔥</span> 폭발적
            </li>
            <li>
              <span className="flame">👑</span> 이 달 1위
            </li>
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <main
      className={`poster-page${accountSwitch ? " poster-readonly" : ""}${
        decorate ? " is-decorate" : ""
      }${
        avatarCapable && avatarOn ? ` avatar-scene avatar-${avatarSide}` : ""
      }${
        // 태그 필터 중엔 꾸미기 스티커도 함께 물러난다(일정 카드와 같은 흐림) — 꾸미기
        // 편집(decorate) 중엔 제외. 캡쳐 PNG는 필터 없는 서버 렌더라 영향 없음.
        !decorate && (tagFilters.length > 0 || bookmarkedOnly) ? " tag-filtering" : ""
      }`}
      data-poster-theme={effectivePosterTheme}
      ref={posterMainRef}
    >
      {/* (라이브 카드는 우측 레일 안 — 정보 카드와 태그 필터 사이 — 로 이사(2026-07-31).
          모바일 아젠다는 하단 '오늘'→LIVE 버튼이 담당해 별도 플로팅 없음.) */}
      {/* 스티커 월 간 복사/붙여넣기 안내 토스트 */}
      {decorate && stickerClipMsg ? (
        <div className="sticker-clip-toast" role="status" aria-live="polite">
          {stickerClipMsg}
        </div>
      ) : null}
      {/* 하트 승급 순간 — 화면 밖(fixed)이라 캡쳐 PNG엔 안 들어간다. */}
      {heartToast ? (
        <div className="heart-toast" role="status" aria-live="polite">
          {heartToast}
        </div>
      ) : null}
      {/* 모바일 아젠다 일정 상세 시트 — 카드 탭으로 열리며 전체 제목·기간·태그 이름을 보여준다.
          공개 DTO만 사용(비공개 필드 자체가 없다). fixed 오버레이라 캡쳐 PNG 밖. */}
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
                  if (e.target === e.currentTarget) setAgendaDetail(null);
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
                  className={`agenda-detail-sheet${detailSnapback ? " pop-snapback" : ""}${
                    detailHype ? " is-hype" : ""
                  }${teaserActive ? " is-teaser" : ""}${detailFinal ? " is-final" : ""}${
                    detailJustRevealed ? " reveal-burst" : ""
                  }`}
                  ref={detailSheetRef}
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
                  <div
                    className="agenda-detail-head"
                    onPointerDown={anchor ? onDetailDragStart : undefined}
                  >
                    {(() => {
                      // 달력과 같은 날짜 규칙(사용자 요청): 요일 표기 + 일요일·공휴일=빨강,
                      // 토요일=파랑, 특별한 날 이름(제헌절·초복 등)은 달력 마크와 같은 톤.
                      const wd = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
                      const mark = withoutWorldCupMark(getDayMark(dateKey));
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
                    <button
                      aria-label="닫기"
                      autoFocus
                      className="agenda-detail-close"
                      type="button"
                      onClick={() => {
                        hapticTick();
                        setAgendaDetail(null);
                      }}
                    >
                      <X aria-hidden="true" size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  {/* 떡밥은 제목 줄 생략 — 카드가 이미 ???를 말했고, 팝오버는 '기대' 무대다
                      (아래 오브가 주인공). 중복 줄이 위계를 흐렸다(사용자 지적). */}
                  {!teaserActive ? (
                    <p className="agenda-detail-title">
                      {!support && event.isTentative ? (
                        <span className="evt-tentative">미정</span>
                      ) : null}
                      {support ? (
                        `🌱 ${event.publicTitle}`
                      ) : detailJustRevealed ? (
                        <ScrambleText text={main} />
                      ) : (
                        main
                      )}
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
                      className="agenda-link"
                      href={event.supportUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      도우러 가기
                      <ExternalLink aria-hidden="true" size={13} />
                    </a>
                  ) : null}
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
                      >
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
      {/* 아바타 자리 토글(켜짐) — 달력 꾸미기에서만 여기(고정 오버레이)에서 아바타 자리 '바로 위'에
          뜬다. 데스크탑·관리자 전용. */}
      {avatarCapable && !showAgenda && avatarOn && decorate ? (
        <div className="avatar-ctl" role="group" aria-label="아바타 자리 설정(관리자 전용)">
          <button
            type="button"
            className="avatar-ctl-toggle on"
            aria-pressed={true}
            onClick={toggleAvatarOn}
          >
🎙️ 아바타 자리 끄기
          </button>
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
        </div>
      ) : null}
      {/* 시청자 화면 미리보기(꾸미기 아님) — 아바타 컨트롤을 화면 좌상단에 '고정'(fixed)한다. 헤더에
          두면 켜고 끌 때 shell 폭이 전체폭↔가운데로 바뀌며 좌우로 흔들려 버튼이 따라 움직였다. fixed면
          안 움직인다. 켜짐엔 끄기+위치(왼/오른쪽), 꺼짐엔 켜기. 데스크탑·관리자 전용. */}
      {avatarCapable && !showAgenda && !decorate ? (
        <div className="avatar-ctl avatar-ctl-preview" role="group" aria-label="아바타 자리 설정(관리자 전용)">
          <button
            type="button"
            className={`avatar-ctl-toggle ${avatarOn ? "on" : ""}`}
            aria-pressed={avatarOn}
            onClick={toggleAvatarOn}
          >
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
      {/* 월드컵 시즌 미니 놀이(공·골대) — 상호작용 모드(시청자)에서 월드컵 기간에만. export 표면 밖이라
          캡처(PNG)엔 안 들어가고, 레이어가 클릭 통과(pointer-events:none)라 일정 조작을 방해하지 않는다.
          관리자가 아바타 자리를 켜면(avatar-scene) 아바타가 골대를 덮으므로 게임을 끈다. 단 아바타
          scene은 데스크탑(!showAgenda)서만 실제로 뜨므로, 모바일(showAgenda)에선 avatarOn이어도
          억제하지 않는다 — 안 그러면 dev가 모바일 시청자 미리보기서 게임을 못 켜는 버그가 났다. */}
      {interactive &&
      showWorldCupFeatures &&
      isWorldCupMonth(view.year, view.month) &&
      !(avatarCapable && avatarOn && !showAgenda) ? (
        <WorldCupBallGoal />
      ) : null}
      {/* 편집실 중력 축구공 — 시청자(웹·모바일)도 늘 잡고 놀 수 있게. 레이어 클릭 통과(공만 잡힘),
          export 밖. 풀 미니게임(위)과 별개의 캐주얼 토이. 아바타 scene은 데스크탑(!showAgenda)서만
          뜨므로 모바일(showAgenda)에선 avatarOn이어도 억제 X — owner/dev가 모바일 시청자 미리보기서도
          중력공이 뜨게(미니게임과 동일 조건). */}
      {interactive &&
      showWorldCupFeatures &&
      isWorldCupMonth(view.year, view.month) &&
      !minigameOn &&
      !(avatarCapable && avatarOn && !showAgenda) ? (
        <WorldCupStudioBall />
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
              {avatarCapable && !avatarOn && decorate ? (
                <button
                  type="button"
                  className="avatar-ctl-toggle avatar-ctl-inheader"
                  aria-pressed={false}
                  onClick={toggleAvatarOn}
                >
                  🎙️ 아바타 자리 켜기
                </button>
              ) : null}
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
                  >
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
              {decorateProp ? (
                <>
                  <Link
                    className="button"
                    href="/studio"
                    onClick={() => {
                      // 꾸미기에서 보던 달을 편집실 월(sy/sm)로 넘기고, 시청자 미리보기 플래그(v)는 꺼서
                      // /studio가 미리보기가 아니라 '실제 편집실'로 열리게 한다(이전에 켠 v:1이 남아 있었음).
                      writeViewCookie({ sy: view.year, sm: view.month, v: 0 });
                    }}
                  >
                    <ChevronLeft aria-hidden="true" size={16} />
                    편집실로 가기
                  </Link>
                  {previewing ? (
                    <button
                      className="button"
                      onClick={() => setPreviewing(false)}
                      type="button"
                    >
                      <Sparkles aria-hidden="true" size={16} />
                      꾸미기로 가기
                    </button>
                  ) : (
                    <button
                      className="button"
                      onClick={() => setPreviewing(true)}
                      type="button"
                    >
                      <Eye aria-hidden="true" size={16} />
                      시청자 화면 미리보기
                    </button>
                  )}
                </>
              ) : null}
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
                  <button className="button" type="submit">
                    {anonymous ? "로그인" : "로그아웃"}
                  </button>
                </form>
              ) : null}
            </div>
          </header>
        )}

        {showAgenda ? renderAgenda() : null}

        {decorate ? (
          <div className="decorate-toolbar" aria-label="꾸미기 도구">
            <div className="decorate-history" role="group" aria-label="실행취소/다시실행">
              <button
                className="button icon-only"
                disabled={undoStack.length === 0}
                onClick={undo}
                title="실행취소 (Ctrl+Z)"
                type="button"
              >
                <Undo2 aria-hidden="true" size={15} />
              </button>
              <button
                className="button icon-only"
                disabled={redoStack.length === 0}
                onClick={redo}
                title="다시실행 (Ctrl+Y)"
                type="button"
              >
                <Redo2 aria-hidden="true" size={15} />
              </button>

              {/* C9/C10: 포스터 테마 — 소유자만(액션이 있을 때만) 노출 */}
              {setPosterThemeAction ? (
                <ThemeSwitch posterTheme={posterTheme} onChange={(t) => void changeTheme(t)} />
              ) : null}
            </div>

            <DecoratePalette
              activeEmojis={activeEmojis}
              assets={assets}
              assetTab={assetTab}
              canDeleteAssets={Boolean(deleteStickerAssetAction)}
              canManageAssets={Boolean(uploadStickerAssetAction)}
              canUpload={Boolean(uploadStickerAssetAction)}
              categories={EMOJI_CATEGORIES}
              dragOver={dragOver}
              emojiCat={emojiCat}
              fileInputRef={fileInputRef}
              onAddEmoji={(e) => void addEmoji(e)}
              onAddImageSticker={(a) => void addImageSticker(a)}
              onAddShape={(k) => void addShape(k)}
              onAssetTab={setAssetTab}
              onDragOver={setDragOver}
              onEmojiCat={setEmojiCat}
              onRemoveAsset={(id) => void removeAsset(id)}
              onReorderAssets={(ids) => void reorderAssets(ids)}
              onSetAssetKind={(id, kind) => void setAssetKind(id, kind)}
              onUploadFiles={(files) => void handleUploadFiles(files)}
              pendingAssetIds={pendingAssetIds}
              uploading={uploading}
            />

            {anchorId && mounted ? (
              createPortal(
                <div
                  className="sticker-toolbar-float"
                  ref={floatRef}
                  style={floatStyle ?? { position: "fixed", top: -9999, left: -9999 }}
                >
                  <div className="stf-head">
                    <span className="stf-title">
                      {selectedIds.length > 1
                        ? `${selectedIds.length}개 선택`
                        : selected?.kind === "text"
                          ? "텍스트"
                          : "스티커"}
                    </span>
                    <button
                      className="stf-collapse"
                      onClick={() => setToolbarCollapsed((v) => !v)}
                      title={toolbarCollapsed ? "펼치기" : "접기 (옮기거나 크기 조절할 때)"}
                      type="button"
                    >
                      {toolbarCollapsed ? (
                        <ChevronDown aria-hidden="true" size={15} />
                      ) : (
                        <ChevronUp aria-hidden="true" size={15} />
                      )}
                    </button>
                  </div>

                  {toolbarCollapsed ? null : selectedIds.length > 1 ? (
                    <div className="stf-body stf-row">
                      <button
                        className="stf-btn"
                        onClick={duplicateSelected}
                        title="모두 복제 (Ctrl+D)"
                        type="button"
                      >
                        <Copy aria-hidden="true" size={15} />
                      </button>
                      <button
                        className="stf-btn danger"
                        onClick={deleteSelected}
                        title="모두 삭제 (Delete)"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    </div>
                  ) : selected && selected.kind === "text" ? (
                    <div className="stf-body">
                      <div className="stf-text-top">
                        <textarea
                          aria-label="텍스트 내용"
                          className="stf-textarea"
                          maxLength={200}
                          onBlur={() => commitSticker(selected)}
                          onChange={(event) => changeText(event.target.value)}
                          onFocus={() => pushHistory()}
                          rows={2}
                          value={selected.label}
                        />
                        <label className="stf-color" title="글자색">
                          <input
                            onChange={(event) => changeTextColor(event.target.value)}
                            type="color"
                            value={selected.textColor ?? "#1f2937"}
                          />
                        </label>
                      </div>
                      <div className="stf-row">
                        <select
                          aria-label="글꼴"
                          className="stf-select"
                          onChange={(event) => {
                            pushHistory();
                            patchSelected({ fontFamily: event.target.value });
                          }}
                          value={selected.fontFamily ?? "sans"}
                        >
                          {TEXT_FONTS.map((f) => (
                            <option key={f.key} style={{ fontFamily: TEXT_FONT_STACK[f.key] }} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <div className="stf-group" role="group" aria-label="굵기">
                          {TEXT_WEIGHTS.map((w) => (
                            <button
                              className={(selected.fontWeight ?? 700) === w.w ? "active" : ""}
                              key={w.w}
                              onClick={() => {
                                pushHistory();
                                patchSelected({ fontWeight: w.w });
                              }}
                              style={{ fontWeight: w.w }}
                              type="button"
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="stf-row">
                        <div className="stf-group" role="group" aria-label="정렬">
                          {(
                            [
                              { key: "left", Icon: AlignLeft },
                              { key: "center", Icon: AlignCenter },
                              { key: "right", Icon: AlignRight }
                            ] as const
                          ).map(({ key, Icon }) => (
                            <button
                              aria-label={`${key} 정렬`}
                              className={(selected.textAlign ?? "left") === key ? "active" : ""}
                              key={key}
                              onClick={() => {
                                pushHistory();
                                patchSelected({ textAlign: key });
                              }}
                              type="button"
                            >
                              <Icon aria-hidden="true" size={14} />
                            </button>
                          ))}
                        </div>
                        <button
                          aria-pressed={Boolean(selected.italic)}
                          className="stf-btn"
                          onClick={() => {
                            pushHistory();
                            patchSelected({ italic: !selected.italic });
                          }}
                          style={{ fontStyle: "italic" }}
                          title="기울임"
                          type="button"
                        >
                          가
                        </button>
                        <button
                          aria-pressed={Boolean(selected.textBg)}
                          className="stf-btn"
                          onClick={() => {
                            pushHistory();
                            patchSelected({ textBg: selected.textBg ? undefined : "#fff3a0" });
                          }}
                          title="글자 배경(하이라이트)"
                          type="button"
                        >
                          배경
                        </button>
                        {selected.textBg ? (
                          <label className="stf-color" title="배경색">
                            <input
                              onChange={(event) => patchSelected({ textBg: event.target.value })}
                              type="color"
                              value={selected.textBg}
                            />
                          </label>
                        ) : null}
                        <span className="stf-spacer" />
                        <button
                          aria-pressed={selected.textFx === "neon"}
                          className="stf-btn"
                          onClick={() => {
                            pushHistory();
                            patchSelected({
                              textFx: selected.textFx === "neon" ? undefined : "neon"
                            });
                          }}
                          title="네온 글로우"
                          type="button"
                        >
                          네온
                        </button>
                      </div>
                      <div className="stf-row">
                        <label className="stf-opacity" title="글자 크기">
                          <span className="stf-label-w">크기</span>
                          <input
                            max={0.15}
                            min={0.04}
                            onChange={(event) =>
                              patchSelected({ widthRatio: Number(event.target.value) }, false)
                            }
                            onPointerDown={() => pushHistory()}
                            onPointerUp={() => commitSticker(selected)}
                            step={0.0025}
                            type="range"
                            value={Math.min(selected.widthRatio, 0.15)}
                          />
                        </label>
                      </div>
                      <div className="stf-row">
                        <label className="stf-opacity" title="투명도">
                          <span className="stf-label-w">투명도</span>
                          <input
                            max={1}
                            min={0.1}
                            onChange={(event) => changeOpacity(Number(event.target.value))}
                            onPointerDown={() => pushHistory()}
                            onPointerUp={() => commitSticker(selected)}
                            step={0.05}
                            type="range"
                            value={selected.opacity}
                          />
                        </label>
                        <button
                          aria-pressed={Boolean(selected.locked)}
                          className="stf-btn"
                          onClick={() => {
                            hapticTick();
                            pushHistory();
                            patchSelected({ locked: !selected.locked });
                          }}
                          title={selected.locked ? "잠금 해제" : "잠금 (이동/크기 방지)"}
                          type="button"
                        >
                          <Lock aria-hidden="true" size={15} />
                        </button>
                        <button
                          className="stf-btn"
                          onClick={duplicateSelected}
                          title="복제 (Ctrl+D)"
                          type="button"
                        >
                          <Copy aria-hidden="true" size={15} />
                        </button>
                        <button
                          className="stf-btn danger"
                          onClick={deleteSelected}
                          title="삭제 (Delete)"
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                      <div className="stf-row stf-anim" role="group" aria-label="움직임">
                        <span className="stf-anim-label">움직임</span>
                        <button
                          className={`stf-btn ${!selected.anim ? "active" : ""}`}
                          onClick={() => {
                            pushHistory();
                            patchSelected({ anim: undefined });
                          }}
                          type="button"
                        >
                          정지
                        </button>
                        {STICKER_ANIMS.map((a) => (
                          <button
                            className={`stf-btn ${selected.anim === a.key ? "active" : ""}`}
                            key={a.key}
                            onClick={() => {
                              pushHistory();
                              patchSelected({ anim: a.key });
                            }}
                            type="button"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : selected ? (
                    <div className="stf-body">
                      <div className="stf-row">
                        <label className="stf-opacity" title="투명도">
                          <span className="stf-label-w">투명도</span>
                          <input
                            max={1}
                            min={0.1}
                            onChange={(event) => changeOpacity(Number(event.target.value))}
                            onPointerDown={() => pushHistory()}
                            onPointerUp={() => commitSticker(selected)}
                            step={0.05}
                            type="range"
                            value={selected.opacity}
                          />
                        </label>
                        <button
                          aria-pressed={Boolean(selected.locked)}
                          className="stf-btn"
                          onClick={() => {
                            hapticTick();
                            pushHistory();
                            patchSelected({ locked: !selected.locked });
                          }}
                          title={selected.locked ? "잠금 해제" : "잠금 (이동/크기 방지)"}
                          type="button"
                        >
                          <Lock aria-hidden="true" size={15} />
                        </button>
                        <button
                          className="stf-btn"
                          onClick={duplicateSelected}
                          title="복제 (Ctrl+D)"
                          type="button"
                        >
                          <Copy aria-hidden="true" size={15} />
                        </button>
                        <button
                          className="stf-btn danger"
                          onClick={deleteSelected}
                          title="삭제 (Delete)"
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                      <div className="stf-row stf-icons">
                        {selected.kind === "shape" ? (
                          <label className="stf-color" title="도형 색">
                            <input
                              onChange={(event) => changeTextColor(event.target.value)}
                              type="color"
                              value={selected.textColor ?? "#ff6b9d"}
                            />
                          </label>
                        ) : null}
                        <button
                          aria-pressed={selected.flipX}
                          className="stf-btn"
                          onClick={() => toggleFlip("x")}
                          title="좌우 대칭"
                          type="button"
                        >
                          <FlipHorizontal aria-hidden="true" size={15} />
                        </button>
                        <button
                          aria-pressed={selected.flipY}
                          className="stf-btn"
                          onClick={() => toggleFlip("y")}
                          title="상하 대칭"
                          type="button"
                        >
                          <FlipVertical aria-hidden="true" size={15} />
                        </button>
                        <button
                          aria-pressed={Boolean(selected.shadow)}
                          className="stf-btn"
                          onClick={() => toggleEffect("shadow")}
                          title="진한 그림자"
                          type="button"
                        >
                          그림자
                        </button>
                        <button
                          className="stf-btn"
                          onClick={() => reorderSelected(true)}
                          title="맨 앞으로"
                          type="button"
                        >
                          <BringToFront aria-hidden="true" size={15} />
                        </button>
                        <button
                          className="stf-btn"
                          onClick={() => reorderSelected(false)}
                          title="맨 뒤로"
                          type="button"
                        >
                          <SendToBack aria-hidden="true" size={15} />
                        </button>
                      </div>
                      <div className="stf-row stf-anim" role="group" aria-label="움직임">
                        <span className="stf-anim-label">움직임</span>
                        <button
                          className={`stf-btn ${!selected.anim ? "active" : ""}`}
                          onClick={() => {
                            pushHistory();
                            patchSelected({ anim: undefined });
                          }}
                          type="button"
                        >
                          정지
                        </button>
                        {STICKER_ANIMS.map((a) => (
                          <button
                            className={`stf-btn ${selected.anim === a.key ? "active" : ""}`}
                            key={a.key}
                            onClick={() => {
                              pushHistory();
                              patchSelected({ anim: a.key });
                            }}
                            type="button"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>,
                document.body
              )
            ) : null}

            {/* #8: 단축키 안내 — 접기/펴기(제목 pill이 토글, 선택은 로컬 기억). 나열 대신
                의미 그룹(편집/선택·이동/기록)으로 묶고 헤어라인 구분 — 조화 3요소(그룹핑·
                정렬·일정한 리듬), 애플 문법. */}
            <div
              className={`shortcut-help${shortcutOpen ? "" : " is-closed"}`}
              aria-label="단축키 안내"
            >
              <button
                aria-expanded={shortcutOpen}
                className="shortcut-help-title"
                onClick={toggleShortcutHelp}
                title={shortcutOpen ? "단축키 안내 접기" : "단축키 안내 펴기"}
                type="button"
              >
                <Keyboard aria-hidden="true" size={14} />
                단축키
                <ChevronDown aria-hidden="true" className="sh-chev" size={13} />
              </button>
              {shortcutOpen ? (
                <div className="shortcut-help-groups">
                  <div className="sh-group">
                    <em>편집</em>
                    <ul className="shortcut-help-list">
                      <li>
                        <kbd>Del</kbd> 삭제
                      </li>
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>D</kbd> 복제
                      </li>
                      {/* 복사/붙여넣기는 달 넘겨 붙이기가 진짜 쓸모 — 안내판에도 명시. */}
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>C</kbd> 복사
                      </li>
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>V</kbd> 붙여넣기 <i>다른 달도</i>
                      </li>
                    </ul>
                  </div>
                  <div className="sh-group">
                    <em>선택·이동</em>
                    <ul className="shortcut-help-list">
                      <li>
                        <kbd>Shift</kbd>+클릭 여러 개
                      </li>
                      <li>
                        <kbd>Esc</kbd> 해제
                      </li>
                      <li>
                        <kbd>←↑↓→</kbd> 미세 이동
                      </li>
                    </ul>
                  </div>
                  <div className="sh-group">
                    <em>기록</em>
                    <ul className="shortcut-help-list">
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>Z</kbd> 실행취소
                      </li>
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>Y</kbd> 다시실행
                      </li>
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>S</kbd> 저장
                      </li>
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            {stickerError ? <span className="poster-action-error">{stickerError}</span> : null}
          </div>
        ) : null}

        {/* 텍스트 추가 줄(꾸미기 전용). 옛 캡쳐 버튼 자리는 비움 — 기능 삭제(2026-07-31). */}
        {!showAgenda && decorate ? (
          <div className="poster-capture-row">
            {decorate ? (
              <div className="text-add-row">
                {/* 저장 상태 칩 — 달력 바로 위, 문구 입력칸 왼쪽 동일선상(편집실과 같은 모양). */}
                <span
                  className={`save-status ${saveState}`}
                  aria-live="polite"
                  title={
                    saveState === "failed"
                      ? "저장에 실패했어요. 잠시 후 다시 시도해 주세요"
                      : saveState === "saving"
                        ? "저장 중이에요"
                        : lastSavedKst
                          ? `마지막 저장 ${lastSavedKst} KST`
                          : "변경사항이 저장돼 있어요"
                  }
                >
                  <span className="ss-dot" aria-hidden="true" />
                  <em>
                    {saveState === "saving"
                      ? "저장 중…"
                      : saveState === "failed"
                        ? "저장 실패"
                        : "저장됨"}
                  </em>
                  {saveState === "saved" && lastSavedKst ? (
                    <b className="ss-time">{lastSavedKst}</b>
                  ) : null}
                </span>
                <input
                  className="text-add-input"
                  maxLength={60}
                  onChange={(event) => setTextDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addText();
                    }
                  }}
                  placeholder="문구 입력 후 Enter 또는 추가 → 달력에 텍스트 스티커로 올라가요"
                  type="text"
                  value={textDraft}
                />
                <button
                  className="button"
                  disabled={!textDraft.trim()}
                  onClick={() => void addText()}
                  type="button"
                >
                  <Type aria-hidden="true" size={15} />
                  추가
                </button>
              </div>
            ) : (
              <span />
            )}
          </div>
        ) : null}

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
          ref={stickerSurfaceElRef}
        >
          {/* (상단 마스트헤드 제거 — 2026-07-31 사용자 결정 2차. 연·월은 오른쪽 레일 정보
              카드로 이동, 빈 세로 공간만큼 달력이 커진다. 서비스 제목은 상단 크롬에.) */}

          <StickerLayer
            avoidSelector="[data-sticker-avoid]"
            editable={decorate}
            onChange={(s) => updateStickerLocal(unmapSceneSticker(s))}
            onCommit={(s) => commitSticker(unmapSceneSticker(s))}
            onGestureStart={pushHistory}
            onSelect={handleSelect}
            selectedIds={selectedIds}
            stickers={sceneStickers}
          />

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
              {cells.map((cell, i) =>
                renderDayCell(cell, weekSupportLaneCount[Math.floor(i / 7)] ?? 0, i)
              )}
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
            {!decorate && !(avatarCapable && avatarOn) ? (
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
                {!decorate ? <SoopLiveBeacon inRail live={soopLive} /> : null}
              </div>
            ) : null}
            <div className="avatar-dock-inner">
              <span className="avatar-slot-hint">🎙️ 아바타 자리</span>
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
        >
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
        >
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
              >
                <Heart aria-hidden="true" size={18} />
                <span>관심</span>
              </button>
            ) : null}
            {/* '오늘' 버튼: 다른 달이면 오늘로 이동. 이미 오늘 달이라 이동이 무의미한데 방송 중이면,
                그 자리를 'LIVE'(보러가기)로 재활용한다 — 모바일 상단이 버튼으로 붐벼 따로 못 두므로. */}
            {soopLive?.isLive && todayVisible ? (
              <button
                className="mb-act live"
                onClick={() => {
                  if (!soopLive.watchUrl) return;
                  hapticTick();
                  window.open(soopLive.watchUrl, "_blank", "noopener,noreferrer");
                }}
                title={`방송 중: ${soopLive.title ?? ""} — 보러가기`}
                type="button"
              >
                <span className="mb-live-dot" aria-hidden="true" />
                <span>LIVE</span>
              </button>
            ) : (
              <button
                className="mb-act"
                onClick={jumpToday}
                title={onTodayMonth ? "오늘 위치로" : "오늘이 있는 달로"}
                type="button"
              >
                <CalendarCheck aria-hidden="true" size={18} />
                <span>오늘</span>
              </button>
            )}
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
        >
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
