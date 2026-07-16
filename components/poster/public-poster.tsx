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
  Undo2
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
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
import { heartTier } from "@/lib/schedules/heart-tiers";
import { getDayMark } from "@/lib/calendar/holidays";
import { isWorldCupMonth } from "@/lib/calendar/worldcup";
import { useEqualChainHeights } from "@/lib/calendar/use-equal-chain-heights";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
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
  getEventTagColors,
  getExtraCategoryColors,
  getSpanRunRange,
  getTodayKst,
  mixedEventStyle,
  mixedPatternMaskStyle,
  splitEventTitle,
  type MonthCell
} from "@/lib/calendar/month";
import { isTaxonomyV3, legacyTagView } from "@/lib/tags/taxonomy";
import { markContentReady } from "@/lib/presence/content-ready";
import { detectInAppBrowser } from "@/lib/auth/in-app-browser";
import { PlainEmail } from "@/components/ui/plain-email";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { hapticSuccess, hapticTick, hapticWarn } from "@/lib/ui/haptics";
import { writeViewCookie } from "@/lib/ui/view-cookie";
import { SoopLiveBeacon } from "@/components/poster/soop-live-beacon";
import { useSoopLive } from "@/components/poster/use-soop-live";
// 포스터 CSS는 이 컴포넌트와 함께 로드(루트 레이아웃 전역 import 제거에 대응). PublicPoster가 쓰이는
// 곳(공개 /, 꾸미기, 스튜디오 시청자 미리보기)에서만 실린다.
import "./public-poster.css";

// 내보내기 버튼은 꾸미기/소유자(canExport)일 때만 렌더된다 → 시청자(공개 /)는 안 받게 지연 로드.
// 클라 전용(내보내기는 사용자 동작)이라 ssr:false. (html2canvas는 이 안에서 또 한 번 지연 import.)
const PosterExportActions = dynamic(
  () => import("@/components/poster/poster-export-actions").then((m) => m.PosterExportActions),
  { ssr: false }
);

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
  canExport?: boolean;
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
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 포스터 고정 캔버스 설계 크기(16:9). 화면에선 이 크기를 통째로 축소해 보여주고,
// export는 이 원본 크기로 캡쳐한다. 작은 화면에서도 내부 비율·스티커 위치가 절대 안 바뀐다.
// 메모 컬럼(238px)이 표면 폭(1840)에서 차지하는 비율 — 이 안에 스티커가 하나라도 있으면
// 시청자에게도 메모지를 보여준다(붙인 게 있는데 종이가 사라지면 스티커가 허공에 뜬다).
const MEMO_COLUMN_RATIO = 238 / 1840;
// 토스트 한 줄에 들어가게 제목을 줄인다(긴 제목이 화면을 가로지르지 않게).
function trimTitle(title: string, max = 14) {
  const line = title.split("\n")[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
const POSTER_DESIGN_W = 1840;
const POSTER_DESIGN_H = Math.round((POSTER_DESIGN_W * 9) / 16); // 1035 (16:9)

// 관심 단계 순위(높을수록 인기). 한 칸의 "대표 인기 단계"를 고를 때 쓴다.
const POP_RANK: Record<string, number> = { warm: 1, hot: 2, blaze: 3, top: 4 };

// 저장 칩의 KST 시각(HH:MM) — 편집실(studio-shell)과 같은 모양.
function nowKstHm(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

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
function TeaserCountdown({ revealAt, onReveal }: { revealAt: string; onReveal: () => void }) {
  const target = useMemo(() => Date.parse(revealAt), [revealAt]);
  const [now, setNow] = useState<number | null>(null);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remain = now === null ? null : target - now;
  const revealed = remain !== null && remain <= 0;
  // 공개 시각이 지나면 즉시 실제 내용을 받아온다(캐시 우회 액션). 서버 시계가 reveal에 아직 안
  // 닿았으면(미세한 시계차) 빈 결과 → 카드가 그대로라 짧게 재시도, 풀리면 카드가 사라져 멈춘다.
  useEffect(() => {
    if (!revealed) return;
    onRevealRef.current();
    const id = window.setInterval(() => onRevealRef.current(), 2000);
    return () => window.clearInterval(id);
  }, [revealed]);
  if (Number.isNaN(target)) return null;
  if (remain === null) return <span className="teaser-count">⏳</span>;
  const s = Math.max(0, Math.floor(remain / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="teaser-count">
      {s <= 0 ? "✨ 공개!" : d > 0 ? `D-${d} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`}
    </span>
  );
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
  canExport: canExportProp = false,
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
  accountEmail = null,
  anonymous = false,
  previewNote,
  previewNav,
  avatarSlot = false,
  avatarOn: avatarOnProp,
  avatarSide: avatarSideProp,
  onAvatarToggle,
  onAvatarSide
}: PublicPosterProps) {
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
  // 꾸미기 화면에서 "시청자 화면 보기"로 잠깐 미리보기 — 꾸미기/내보내기 도구를 숨기고
  // 시청자 시점으로 본다. previewing 동안에는 effective decorate/canExport를 꺼서, 아래의
  // 모든 꾸미기 로직(도구바·키보드·스티커 편집·내보내기)이 자동으로 비활성화된다.
  const [previewing, setPreviewing] = useState(initialPreviewing);
  const decorate = decorateProp && !previewing;
  const canExport = canExportProp && !previewing;
  // 토리님 SOOP 라이브 상태 — 꾸미기 아니면 폴링(편집실 '시청자 미리보기'에서도 켜서 개발자/오너가
  // 시청자가 볼 LIVE를 그대로 확인). 데스크탑 플로팅 비콘은 편집실 chrome과 겹쳐 미리보기에선 숨기고
  // (아래 마운트의 !previewNav), 모바일은 겹침 없는 하단 '오늘'→LIVE 버튼이라 미리보기에서도 보인다.
  const soopLive = useSoopLive(!decorate);
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
  const activeSupportEvents = liveEvents.filter((e) => e.isSupport);
  // 이어진 일정 묶음 키 — 같은 묶음 칸들의 높이를 맞추는 데 쓴다(아래 useEqualChainHeights).
  const chainKeys = useMemo(() => buildChainKeys(schedule.events), [schedule.events]);
  // 같은 태그 구성으로 이어진 묶음은 하나의 그라데이션으로(경계 가운데). 묶음별 날짜 범위.
  const paintGroups = useMemo(() => buildPaintGroups(schedule.events), [schedule.events]);
  // 이어진 일정(link_next로 묶인 '별개' 일정들)은 같은 묶음 칸끼리 높이를 맞춰 이음새가 어긋나지
  // 않게 한다. 묶음의 '가장 큰 내용' 높이에만 맞추므로(과확장 없음) 짧은 쪽만 그만큼 채워진다.
  // callback ref라 그리드가 (재)마운트되는 어떤 경로에서도 자동 재설정된다. deps는 보강용.
  const monthGridRef = useEqualChainHeights<HTMLDivElement>([schedule.events, view]);
  // 구글 시트식 날짜 칸 범위 선택(마우스 전용, 시각 강조만) + 텍스트 긁힘 방지.
  // 선택은 React state(rangeSelected)라 다른 리렌더에도 안 지워진다.
  // 둘 다 callback ref라 한 요소에 합쳐 단다(안정 identity라 매 렌더 재부착 없음).
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
      : isWorldCupMonth(view.year, view.month)
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
  // 메모지(왼쪽 238px 컬럼 = 표면 폭의 ≈13%)는 **어느 모드에서도 자리를 비우지 않는다**.
  // 예전엔 시청자 화면에서 내용이 없으면 컬럼째 접었는데(꾸미기에선 항상 표시), 그러면 달력
  // 컬럼이 1314→1552px로 넓어져 **표면 안 레이아웃이 모드마다 달라진다** → 비율 좌표(xRatio)로
  // 저장되는 스티커가 시청자 화면에서 전부 가로로 밀린다(ADR-0004의 "꾸미기 == 시청자" 불변식).
  // 내용이 없을 때는 '자리'는 그대로 두고 종이의 라벨만 감춘다(아래 is-empty).
  const memoHasContent =
    Boolean(schedule.calendar.publicMemo) ||
    stickers.some((s) => s.xRatio < MEMO_COLUMN_RATIO);
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
  // 방금 공개된 떡밥 id — 잠깐 '짠!' 등장 애니메이션을 입힌다(보상감). 1.8초 뒤 해제.
  const [justRevealed, setJustRevealed] = useState<Set<string>>(() => new Set());
  const revealTeaser = useCallback((id: string) => {
    revealTeaserAction([id])
      .then((list) => {
        if (list.length > 0) {
          const ids = list.map((ev) => ev.id);
          setRevealedEvents((prev) => {
            const next = { ...prev };
            for (const ev of list) next[ev.id] = ev;
            return next;
          });
          // 이미 공개돼 화면에 떠 있던(애니 끝난) 건 다시 안 튀게, 이번에 새로 들어온 것만 표시.
          setJustRevealed((prev) => {
            const fresh = ids.filter((x) => !prev.has(x) && !revealedEvents[x]);
            if (fresh.length === 0) return prev;
            const next = new Set(prev);
            for (const x of fresh) next.add(x);
            window.setTimeout(() => {
              setJustRevealed((cur) => {
                const n = new Set(cur);
                for (const x of fresh) n.delete(x);
                return n;
              });
            }, 1800);
            return next;
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // 하트(관심)는 로그인 시청자만 — 익명 시청자에겐 ♥ 토글/모아보기를 숨긴다(서버 1인1하트 불가).
  // 색상 필터 등 다른 상호작용은 익명에게도 그대로 둔다.
  // 하트 가능 = 상호작용 화면이고 하트 액션이 연결돼 있으면(로그인이든 비로그인이든). 비로그인도
  // 기기 토큰으로 누를 수 있게 해 로그인 장벽을 없앤다(참여 ↑). 단 기기 토큰을 못 만들면(사생활 모드)
  // 익명은 비활성.
  const canHeart = interactive && serverHearts && (!anonymous || deviceToken.length >= 8);

  // "시청자 화면 보기" 미리보기는 히스토리에 한 칸 쌓아, 휴대폰/브라우저 뒤로가기를 누르면
  // 페이지를 떠나지 않고 꾸미기로 돌아온다(편집실 오버레이 스택과 같은 방식).
  const previewDepthRef = useRef(0);
  const ignorePreviewPop = useRef(false);
  const previewBackClosing = useRef(false);
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
  useEffect(() => {
    function onPop() {
      if (ignorePreviewPop.current) {
        ignorePreviewPop.current = false;
        return;
      }
      // 미리보기 중일 때만 처리 — 아니면 일반 뒤로가기를 방해하지 않는다.
      setPreviewing((cur) => {
        if (cur) {
          previewBackClosing.current = true;
          return false;
        }
        return cur;
      });
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
    // 스트리머 컨텍스트(관리자 미리보기·꾸미기=avatarSlot)는 4K 등 큰 화면에서 1배에 막히지 않고
    // 1.6배까지 키운다 — Math.min(1,…) 캡 때문에 3840 화면이 텅 비던 낭비를 줄인다. 공개 시청자
    // (avatarSlot 아님)는 기존대로 1배 상한(레이아웃 안정). 폭 기준 fit이라 가로 넘침은 없다.
    const maxScale = avatarSlot ? 1.6 : 1;
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
          const result = await toggleHeartAction(id, deviceToken);
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

  // 태그 칩 토글(다중 선택).
  function toggleTagFilter(id: string) {
    hapticTick(); // 셀렉터 손맛(Android만; iOS·미지원은 조용히 무시)
    setTagFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function clearFilters() {
    setTagFilters([]);
    setBookmarkedOnly(false);
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

  // D: 이 일정의 대표 태그(최대 2개) 색. 2개면 그 일정 안에서 그라데이션(경계는 일정 가운데).
  function eventColors(event: PublicScheduleEvent) {
    return getEventTagColors(event, viewTags, schedule.palette);
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
          day.markKind === "wc-korea-win" ? " day-win" : ""
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
          return (
            <div
              // 필터를 켜면 일정 카드만 흐려지고 업 도움 끈은 쨍하게 남아, 안 고른 기간이 오히려
              // 제일 눈에 띄었다 → 끈도 같이 물러난다(같은 isDimmedByFilter 판정을 쓴다).
              className={`support-bar${isDimmedByFilter(s) ? " dimmed" : ""}`}
              key={s.id}
              style={{
                top: 26 + lane * 20,
                left: left ? 3 : 0,
                right: right ? 3 : 0,
                borderTopLeftRadius: left ? 9 : 0,
                borderBottomLeftRadius: left ? 9 : 0,
                borderTopRightRadius: right ? 9 : 0,
                borderBottomRightRadius: right ? 9 : 0
              }}
            >
              {isStart || isEnd ? <span>🌱 {s.publicTitle}</span> : null}
            </div>
          );
        })}
        <div className="day-strip">
          <strong className={day.isRed ? "red" : day.isSaturday ? "saturday" : ""}>
            {cell.dayOfMonth} 일
          </strong>
          {day.markName ? (
            interactive ? (
              // 특별한 날 표기를 탭하면 그 자리에서 빵빠레가 터진다. 한국 승은 큰 폭죽.
              <button
                type="button"
                className={`day-mark celebratable${day.markKind ? ` ${day.markKind}` : ""}`}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  popBurst(
                    r.left + r.width / 2,
                    r.top + r.height / 2,
                    day.markKind === "wc-korea-win"
                      ? "win"
                      : day.markKind === "wc-korea-done"
                        ? "console"
                        : "cheer"
                  );
                }}
              >
                {day.markName}
              </button>
            ) : (
              <em className={`day-mark${day.markKind ? ` ${day.markKind}` : ""}`}>{day.markName}</em>
            )
          ) : null}
        </div>
        <div
          className="day-events"
          style={weekSupCount > 0 ? { paddingTop: 8 + weekSupCount * 20 } : undefined}
        >
          {events.map((rawEvent) => {
            // 떡밥 즉시 공개 맵에 있으면 실제 일정으로 갈아끼운다(가린 stub 대신 진짜).
            const event = revealedEvents[rawEvent.id] ?? rawEvent;
            // 떡밥(가림): 공개 시각이 미래면 항상 ??? 카드 + 카운트다운(미리보기·실제 시청자 모두 —
            // 데이터가 있어도 ???만 보여 지연 없음). 시각이 지났는데 서버가 가린 stub(제목 빈)을
            // 보냈으면(캐시 지연) 중립 placeholder + 즉시 교체. 시각 지났고 제목 있으면 일반 렌더.
            if (event.teaser && event.teaserRevealAt) {
              if (Date.parse(event.teaserRevealAt) > Date.now()) {
                return (
                  <div className="public-event teaser" key={event.id}>
                    <div className="event-main teaser-main">
                      <span className="teaser-spark" aria-hidden="true">🔮</span>
                      <p className="teaser-q">???</p>
                      <TeaserCountdown
                        onReveal={() => revealTeaser(rawEvent.id)}
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
                    onReveal={() => revealTeaser(rawEvent.id)}
                  />
                );
              }
              // 시각 지났고 실제 제목 있음(미리보기/신선 캐시) → 일반 렌더로 흐른다.
            }
            const colors = eventColors(event);
            const extraColors = getExtraCategoryColors(event, viewTags, schedule.palette);
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
            return (
              <div
                className={eventClass}
                data-chain={chainKeys.get(event.id)}
                data-color={mixed ? undefined : colors[0]?.key}
                data-mixed={mixed ? "" : undefined}
                // 관심 단계를 카드 자체에 실어, 인기가 '불꽃 이모지 개수'가 아니라 '시각적 무게'
                // (제목 굵기 + 링)로도 읽히게 한다 — 달력은 훑는(spotted) 화면이라 한눈에 큰 방송이
                // 잡혀야 한다. 이모지는 정밀도, 무게는 스캔용.
                data-tier={tier?.key}
                key={event.id}
                style={mixStyle ?? (colors.length > 0 ? eventColorStyle(colors) : undefined)}
              >
                {mixStyle ? (
                  <>
                    {/* 무늬도 색 그라데이션과 같은 위치에서 부드럽게 사라지게(마스크) — 경계 흐릿 */}
                    <span
                      aria-hidden="true"
                      className="evt-pat"
                      data-color={colors[0].key}
                      style={mixedPatternMaskStyle(mixStyle, "a")}
                    />
                    <span
                      aria-hidden="true"
                      className="evt-pat"
                      data-color={colors[1].key}
                      style={mixedPatternMaskStyle(mixStyle, "b")}
                    />
                  </>
                ) : null}
                <div className="event-main">
                  {/* 이어지는 칸은 제목을 투명하게 그려 시작 칸과 높이를 맞춘다(이음새 어긋남 방지). */}
                  {span.showTitle ? (
                    <p>
                      {event.isTentative ? <span className="evt-tentative">미정</span> : null}
                      {main}
                    </p>
                  ) : (
                    <p className="span-cont">{main || " "}</p>
                  )}
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
                {subs.length > 0 ? (
                  <ul className={`event-subs${span.showTitle ? "" : " span-cont"}`}>
                    {subs.map((sub, i) => (
                      <li key={i}>{sub}</li>
                    ))}
                  </ul>
                ) : null}
                {/* 메타 한 줄: 관심(왼쪽) + 형식색 점(오른쪽). 따로 흩어져 공간 낭비하던 둘을 묶어
                    가로폭을 채운다. 시작 칸에만(이어지는 칸엔 안 그림). */}
                {span.showTitle && (tier || extraColors.length > 0) ? (
                  <div className="event-meta">
                    {tier ? (
                      <span className={`event-popular tier-${tier.key}`} title={tier.label} aria-label={`관심 단계: ${tier.label}`}>
                        <span className="flame" aria-hidden="true">{tier.flames}</span>
                      </span>
                    ) : null}
                    {extraColors.length > 0 ? (
                      <span className="pill-dots" aria-hidden="true">
                        {extraColors.map((c, i) => (
                          <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                        ))}
                      </span>
                    ) : null}
                  </div>
                ) : null}
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
      const evs = liveEvents.filter(
        (e) => !e.isSupport && getEventDateKey(e) === cell.isoDate && !isDimmedByFilter(e)
      );
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
        {interactive && legendTags.length > 0 ? (
          <div className="agenda-legend-rail">
          <aside className="agenda-legend" aria-label="색상 안내(태그 필터)">
            <strong>색상 필터</strong>
            {(() => {
              const legendBtn = (tag: (typeof legendTags)[number]) => {
                const color = schedule.palette.find((p) => p.key === tag.colorKey);
                if (!color) return null;
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
                      data-color={color.key}
                      style={{ backgroundColor: color.bgColor, borderColor: color.borderColor }}
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
                  setBookmarkedOnly((v) => !v);
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
          {/* '이 달 기록' — 웹에선 헤더(.public-calendar-header)에 있는데, 그 헤더는 ≤1040px에서
              통째로 안 그려진다. 그래서 폰·태블릿 시청자는 만들어 둔 기록 시트를 열 방법이 아예
              없었다(진입점 0개). 새 크롬을 만들지 않고 같은 버튼을 이 레일에 둔다 — 아래 주석대로
              엄지가 닿는 자리이고, 박스가 vh 고정이라 스크롤해도 안 들썩인다. */}
          {interactive ? (
            <button
              className="insights-open agenda-legend-insights"
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
                  {mark ? (
                    interactive ? (
                      <button
                        type="button"
                        className={`agenda-mark celebratable ${mark.isHoliday ? "holiday" : ""}${
                          mark.kind === "wc-korea-win" ? " wc-korea-win" : ""
                        }`}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          popBurst(
                            r.left + r.width / 2,
                            r.top + r.height / 2,
                            mark.kind === "wc-korea-win"
                              ? "win"
                              : mark.kind === "wc-korea-done"
                                ? "console"
                                : "cheer"
                          );
                        }}
                      >
                        {mark.name}
                      </button>
                    ) : (
                      <span className={`agenda-mark ${mark.isHoliday ? "holiday" : ""}`}>
                        {mark.name}
                      </span>
                    )
                  ) : null}
                  {list.length === 0 ? (
                    // DB의 null을 그대로 읽어주던 문구("예정된 공개 일정 없음") 대신 사람 말로.
                    // 쉬는 날은 누락된 레코드가 아니라 쉬는 날이다.
                    <span className="agenda-noevent">아직 일정이 없어요 🍃</span>
                  ) : null}
                  {list.map(({ event: rawEvent, support }) => {
                    // 떡밥 즉시 공개 맵에 있으면 실제 일정으로 갈아끼운다.
                    const event = revealedEvents[rawEvent.id] ?? rawEvent;
                    // 떡밥(가림): 미래면 항상 ??? 카드(미리보기·실제 모두). 지났고 빈 stub이면
                    // placeholder+교체, 지났고 제목 있으면 일반 렌더.
                    if (event.teaser && event.teaserRevealAt) {
                      if (Date.parse(event.teaserRevealAt) > Date.now()) {
                        return (
                          <div className="agenda-item teaser" key={event.id}>
                            <span className="teaser-spark" aria-hidden="true">🔮</span>
                            <p className="agenda-title teaser-q">???</p>
                            <TeaserCountdown
                              onReveal={() => revealTeaser(rawEvent.id)}
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
                            onReveal={() => revealTeaser(rawEvent.id)}
                          />
                        );
                      }
                      // 지났고 실제 제목 있음 → 일반 렌더로 흐른다.
                    }
                    const colors = eventColors(event);
                    const extraColors = support
                      ? []
                      : getExtraCategoryColors(event, viewTags, schedule.palette);
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
                    return (
                      <div
                        className={`agenda-event${justRevealed.has(rawEvent.id) ? " just-revealed" : ""}`}
                        key={(support ? "s-" : "") + event.id}
                      >
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
                              {support ? `🌱 ${event.publicTitle}` : main}
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
                          {support ? (
                            <p className="agenda-sub">
                              {formatShortDate(cell.isoDate)} ~{" "}
                              {formatShortDate(event.endDateKey ?? cell.isoDate)}
                            </p>
                          ) : end && end !== cell.isoDate ? (
                            <p className="agenda-sub">~ {formatShortDate(end)}까지</p>
                          ) : null}
                          {!support && subs.length > 0 ? (
                            <ul className="agenda-subs">
                              {subs.map((sub, i) => (
                                <li key={i}>{sub}</li>
                              ))}
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
                          {/* 메타 한 줄: 관심(왼쪽) + 형식색 점(오른쪽) — 따로 흩어지던 둘을 묶어 폭을 채운다. */}
                          {tier || extraColors.length > 0 ? (
                            <div className="agenda-meta">
                              {tier ? (
                                <span className={`event-popular tier-${tier.key}`} title={tier.label} aria-label={`관심 단계: ${tier.label}`}>
                                  <span className="flame" aria-hidden="true">{tier.flames}</span>
                                </span>
                              ) : null}
                              {extraColors.length > 0 ? (
                                <span className="pill-dots" aria-hidden="true">
                                  {extraColors.map((c, i) => (
                                    <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                                  ))}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
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

  return (
    <main
      className={`poster-page${accountSwitch ? " poster-readonly" : ""}${
        avatarCapable && avatarOn ? ` avatar-scene avatar-${avatarSide}` : ""
      }`}
      data-poster-theme={effectivePosterTheme}
    >
      {/* 토리님 SOOP 라이브 비콘 — '실제 공개 페이지'에서만. 꾸미기/export 제외(decorate),
          편집실 '시청자 미리보기'(previewNav 존재)에서도 숨김 — 편집실 버튼과 겹치면 안 되므로.
          fixed 오버레이라 export 표면 밖 → 공식 PNG엔 안 들어간다(실시간 정보). */}
      {!decorate && !previewNav ? <SoopLiveBeacon live={soopLive} /> : null}
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
      isWorldCupMonth(view.year, view.month) &&
      !(avatarCapable && avatarOn && !showAgenda) ? (
        <WorldCupBallGoal />
      ) : null}
      {/* 편집실 중력 축구공 — 시청자(웹·모바일)도 늘 잡고 놀 수 있게. 레이어 클릭 통과(공만 잡힘),
          export 밖. 풀 미니게임(위)과 별개의 캐주얼 토이. 아바타 scene은 데스크탑(!showAgenda)서만
          뜨므로 모바일(showAgenda)에선 avatarOn이어도 억제 X — owner/dev가 모바일 시청자 미리보기서도
          중력공이 뜨게(미니게임과 동일 조건). */}
      {interactive &&
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
                      setBookmarkedOnly((v) => !v);
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

            {/* #8: 단축키 안내 */}
            <div className="shortcut-help" aria-label="단축키 안내">
              <span className="shortcut-help-title">
                <Keyboard aria-hidden="true" size={14} />
                단축키
              </span>
              <ul className="shortcut-help-list">
                <li>
                  <kbd>Del</kbd> 삭제
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>D</kbd> 복제
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>Z</kbd> 실행취소
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>Y</kbd> 다시실행
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>S</kbd> 저장
                </li>
                <li>
                  <kbd>←↑↓→</kbd> 미세 이동
                </li>
                <li>
                  <kbd>Shift</kbd>+클릭 여러 개 선택
                </li>
              </ul>
            </div>

            {stickerError ? <span className="poster-action-error">{stickerError}</span> : null}
          </div>
        ) : null}

        {/* 텍스트 추가(왼쪽) + 캡쳐 버튼(오른쪽)을 같은 줄에. 달력을 보면서 누르기 쉽게. */}
        {!showAgenda && (decorate || canExport) ? (
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
            {canExport ? (
              <PosterExportActions
                onBeforeCapture={() => {
                  clearSelection();
                  clearFilters();
                }}
              />
            ) : null}
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
        >
          {/* 마스트헤드 — PNG로 잘려 나가도 "빅토리의 이 달"로 읽혀야 하는 부분.
              큰 월 숫자(썸네일에서도 보이는 앵커) + 제목 + 브랜드 색 룰. 반짝임(✨)은 캡쳐에선
              멈추므로 정체성을 모션에 기대지 않는다 — 숫자·굵기·색이 정지 상태의 정체성이다. */}
          <div className="poster-heading">
            <h1>
              <span aria-hidden="true">✨️</span>
              {schedule.calendar.title}
              <span aria-hidden="true">✨️</span>
            </h1>
            <em>
              {view.year}년 {String(view.month).padStart(2, "0")}월
            </em>
          </div>

          <StickerLayer
            avoidSelector="[data-sticker-avoid]"
            editable={decorate}
            onChange={updateStickerLocal}
            onCommit={commitSticker}
            onGestureStart={pushHistory}
            onSelect={handleSelect}
            selectedIds={selectedIds}
            stickers={stickers}
          />

          {/* 메모지 — 빈 노트로 띄워두고, 토리님이 이 위에 텍스트 스티커로 하고 싶은 말을 적는다.
              **모드와 무관하게 항상 렌더한다**: 컬럼을 접으면 달력 폭이 바뀌어 스티커(비율 좌표)가
              시청자 화면에서 전부 밀린다. 내용이 없을 때는 이름표만 감춰(자리는 유지) '메모'라고
              적힌 빈 상자 — 관리 도구의 문법 — 로 보이지 않게 한다. 꾸미기에선 붙일 종이를 알아야
              하므로 이름표를 그대로 둔다(둘 다 자리는 같아 지오메트리는 동일). */}
          <aside className="public-side" aria-label="메모">
            <div className={`public-memo${memoHasContent || decorate ? "" : " is-empty"}`}>
              <strong>메모</strong>
              <div className="memo-body" />
            </div>
          </aside>

          <section className="public-calendar-area">
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

          <aside className="public-right" aria-label="업 도움과 색상 안내">
            {activeSupportEvents.map((s) => {
              const start = getEventDateKey(s);
              const end = s.endDateKey ?? start;
              return (
                <div className="support-card" key={s.id}>
                  <span>🌱 {s.publicTitle}</span>
                  <strong>
                    {formatShortDate(start)} ~ {formatShortDate(end)}
                  </strong>
                  {s.supportUrl ? (
                    <a
                      data-sticker-avoid
                      href={s.supportUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      도우러 가기
                      <ExternalLink aria-hidden="true" size={14} />
                    </a>
                  ) : null}
                </div>
              );
            })}

            <div className="public-legend-vertical" aria-label="태그 필터">
              <strong className="legend-title">태그 필터</strong>
              {(() => {
                const legendBtn = (tag: (typeof legendTags)[number]) => {
                  const color = schedule.palette.find((item) => item.key === tag.colorKey);
                  if (!color) {
                    return null;
                  }
                  const swatch = (
                    <i
                      data-color={color.key}
                      style={{ backgroundColor: color.bgColor, borderColor: color.borderColor }}
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
              </div>
            </div>
          </aside>
        </section>
        </div>
        </div>
        {/* 스트리머 scene: avatar 박스는 색상안내(legend) 왼쪽 모서리부터 화면 끝까지(우측 ~1/4),
            짧아진 legend '아래'에 깔린다. left/top은 legend를 JS로 재서 맞춘다(absolute). surface
            내부 폭은 안 바꾸므로 스티커 안전. 꾸미기는 avatarCapable=false라 안 뜸. */}
        {avatarCapable ? (
          <aside className="avatar-slot" aria-label="버츄얼 스트리머 아바타 자리(관리자 전용)">
            <div className="avatar-dock-inner">
              <span className="avatar-slot-hint">🎙️ 아바타 자리</span>
            </div>
          </aside>
        ) : null}
        </div>
        )}
      </section>

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
                  setBookmarkedOnly((v) => !v);
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
