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
  Redo2,
  SendToBack,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload
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
import { PosterExportActions } from "@/components/poster/poster-export-actions";
import { StickerLayer, TEXT_FONT_STACK } from "@/components/poster/sticker-layer";
import {
  POSTER_THEMES,
  STICKER_ANIMS,
  STICKER_SHAPES,
  shapeDefaultColor,
  type PublicSchedule,
  type PublicScheduleEvent,
  type StickerAsset,
  type StickerInstance
} from "@/lib/domain/schedule-types";
import { ShapeSvg } from "@/components/poster/sticker-shapes";
import type { ThemeResult } from "@/lib/schedules/theme-actions";
import type { SaveStickerInput, StickerResult } from "@/lib/schedules/sticker-actions";
import type { StickerAssetResult } from "@/lib/schedules/sticker-asset-actions";
import type { HeartResult } from "@/lib/schedules/heart-actions";
import { getDayMark } from "@/lib/calendar/holidays";
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
import { MOBILE_QUERY } from "@/lib/ui/breakpoints";
import { hapticTick } from "@/lib/ui/haptics";
import { writeViewCookie } from "@/lib/ui/view-cookie";

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
  toggleHeartAction?: (eventId: string) => Promise<HeartResult>;
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
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 포스터 고정 캔버스 설계 크기(16:9). 화면에선 이 크기를 통째로 축소해 보여주고,
// export는 이 원본 크기로 캡쳐한다. 작은 화면에서도 내부 비율·스티커 위치가 절대 안 바뀐다.
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
// 하트의 진실은 항상 서버(myHeartIds). 아래 델타는 '이번 브라우저 세션에 사용자가 직접 토글한
// 일정'만 담아(sessionStorage, 탭 닫으면 소멸) 시청자 미리보기 재마운트 동안 변경을 보존한다.
// 매 로드 신선한 서버값에 이 델타(on/off)를 덮어 적용하므로, 손대지 않은 일정에 가짜 하트가
// 생기지 않는다(자가 보정). 페이지 새로고침 후엔 서버값이 이미 최신이라 델타는 무해한 멱등 합집합.
const HEART_DELTA_KEY = "vic:heartDelta:v1";
type HeartDelta = { on: string[]; off: string[] };
function loadHeartDelta(): HeartDelta {
  try {
    const raw = window.sessionStorage.getItem(HEART_DELTA_KEY);
    if (raw) {
      const p: unknown = JSON.parse(raw);
      if (p && Array.isArray((p as HeartDelta).on) && Array.isArray((p as HeartDelta).off)) {
        return {
          on: (p as HeartDelta).on.filter((x) => typeof x === "string"),
          off: (p as HeartDelta).off.filter((x) => typeof x === "string")
        };
      }
    }
  } catch {
    // 손상·사생활 모드 등은 무시 — 델타는 보조 기능.
  }
  return { on: [], off: [] };
}
function saveHeartDelta(d: HeartDelta) {
  try {
    window.sessionStorage.setItem(HEART_DELTA_KEY, JSON.stringify(d));
  } catch {
    // 저장 실패 무시.
  }
}
// 사용자가 한 일정을 토글했음을 델타에 기록한다(on=켬, off=끔). 반대편 목록에선 제거.
function recordHeartDelta(id: string, on: boolean) {
  const d = loadHeartDelta();
  if (on) {
    d.on = [...new Set([...d.on, id])];
    d.off = d.off.filter((x) => x !== id);
  } else {
    d.off = [...new Set([...d.off, id])];
    d.on = d.on.filter((x) => x !== id);
  }
  saveHeartDelta(d);
}

// #3: 관심 하트 단계(불꽃 게이지).
// 작은 수에서 과장되지 않도록 "절대 하트 수"를 1차 기준으로 쓰고, 상위 단계는 "이 달 최다 대비
// 비율"까지 함께 충족해야 한다. 👑(최고 인기)는 이 달에 단 하나(유일한 1위)만 붙는다.
// 아래 임계값만 바꾸면 채널 규모에 맞게 쉽게 조정할 수 있다.
const HEART_MIN = 5; // 이 수 미만이면 배지 없음(2~3개로 들썩이지 않게)
const HEART_HOT = 12; // 🔥🔥 높은 관심 최소 하트
const HEART_BLAZE = 25; // 🔥🔥🔥 폭발적 관심 최소 하트
const HEART_CROWN = 10; // 👑 최고 인기로 인정할 최소 하트(유일 1위일 때)
type HeartTier = { key: "warm" | "hot" | "blaze" | "top"; flames: string; label: string };
function heartTier(count: number, max: number, isSoleTop: boolean): HeartTier | null {
  if (count < HEART_MIN) {
    return null; // 너무 적으면 표시하지 않는다(노이즈 방지).
  }
  // 이 달 최고 인기: "유일한 1위"이고 충분히 모였을 때만 — 딱 하나만 왕관.
  if (isSoleTop && count >= HEART_CROWN) {
    return { key: "top", flames: "👑", label: "최고 인기" };
  }
  const ratio = max > 0 ? count / max : 0;
  // 상위 단계는 절대 수 + 상대 비율을 모두 만족해야 한다(작은 max로 부풀지 않게).
  if (count >= HEART_BLAZE && ratio >= 0.85) {
    return { key: "blaze", flames: "🔥🔥🔥", label: "폭발적 관심" };
  }
  if (count >= HEART_HOT && ratio >= 0.6) {
    return { key: "hot", flames: "🔥🔥", label: "높은 관심" };
  }
  return { key: "warm", flames: "🔥", label: "관심" };
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
  previewNav
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
  const supportLanes = useMemo(() => assignSupportLanes(schedule.events), [schedule.events]);
  // 업 도움 띠 줄 수를 "주별"로 — 띠 없는 주는 0이라 그 주 일정이 위로 붙는다(높이 낭비 방지).
  const weekSupportLaneCount = useMemo(() => {
    const perWeek: number[] = [];
    for (let w = 0; w * 7 < cells.length; w += 1) {
      let maxLane = -1;
      for (const c of cells.slice(w * 7, w * 7 + 7)) {
        for (const s of getEventsForDate(schedule.events, c.isoDate)) {
          if (!s.isSupport) continue;
          maxLane = Math.max(maxLane, supportLanes.lanes.get(s.id) ?? 0);
        }
      }
      perWeek[w] = maxLane + 1;
    }
    return perWeek;
  }, [cells, schedule.events, supportLanes]);
  const supportEvents = schedule.events.filter((e) => e.isSupport);
  // 이어진 일정 묶음 키 — 같은 묶음 칸들의 높이를 맞추는 데 쓴다(아래 useEqualChainHeights).
  const chainKeys = useMemo(() => buildChainKeys(schedule.events), [schedule.events]);
  // 같은 태그 구성으로 이어진 묶음은 하나의 그라데이션으로(경계 가운데). 묶음별 날짜 범위.
  const paintGroups = useMemo(() => buildPaintGroups(schedule.events), [schedule.events]);
  // 이어진 일정(link_next로 묶인 '별개' 일정들)은 같은 묶음 칸끼리 높이를 맞춰 이음새가 어긋나지
  // 않게 한다. 묶음의 '가장 큰 내용' 높이에만 맞추므로(과확장 없음) 짧은 쪽만 그만큼 채워진다.
  // callback ref라 그리드가 (재)마운트되는 어떤 경로에서도 자동 재설정된다. deps는 보강용.
  const monthGridRef = useEqualChainHeights<HTMLDivElement>([schedule.events, view]);
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
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
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
    const result = await setPosterThemeAction(theme);
    if (!result.ok) {
      setPosterTheme(prev);
      setStickerError(result.error);
    }
  }

  // 스티커는 달(월)마다 따로 — 현재 보는 달의 스티커만 로컬 상태로 다룬다.
  const monthStickers = (year: number, month: number) =>
    schedule.stickers.filter((s) => s.year === year && s.month === month);
  const [stickers, setStickers] = useState<StickerInstance[]>(() =>
    monthStickers(view.year, view.month)
  );
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  // C3: 다중 선택 — 기본(primary) 선택 외에 추가로 선택된 스티커들.
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [stickerError, setStickerError] = useState<string | null>(null);
  // A2 고도화: 여러 태그를 동시에 고르고, "관심만 보기"까지 더해 보고 싶은 일정만 추려 본다.
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  // A: 관심(하트). toggleHeartAction이 있으면 서버 집계(1인 1하트)와 연동되고,
  //    없으면(샘플/오프라인) 기기별 localStorage로만 동작한다. 둘 다 "내가 누른 일정" 집합으로 관리.
  const serverHearts = Boolean(toggleHeartAction);
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
  // 하트를 누를 때 화면에 떠오르는 ♥ 입자들(틱톡식 좋아요 연출). 잠깐 떴다 사라진다.
  const [floaters, setFloaters] = useState<HeartFloater[]>([]);
  // 시청자 상호작용(필터·북마크) 가능 모드 — 꾸미기 중에는 끈다(스티커 조작과 충돌·포스터 청결).
  const interactive = !decorate;
  // 하트(관심)는 로그인 시청자만 — 익명 시청자에겐 ♥ 토글/모아보기를 숨긴다(서버 1인1하트 불가).
  // 색상 필터 등 다른 상호작용은 익명에게도 그대로 둔다.
  const canHeart = interactive && !anonymous;

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
  // 모바일(좁은 화면) 시청자는 세로 아젠다(목록) 전용 — 월간 그리드/캡쳐는 PC로 유도.
  // (꾸미기 모드엔 적용 안 함: 꾸미기는 PC 전용.)
  const [isNarrow, setIsNarrow] = useState(initialNarrow);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
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
    const measure = () => {
      const natW = scaler.offsetWidth || POSTER_DESIGN_W;
      const natH = scaler.offsetHeight || POSTER_DESIGN_H;
      const w = stage.clientWidth;
      if (w <= 0) {
        return;
      }
      setPosterScale(Math.max(0.12, Math.min(1, w / natW)));
      setPosterNaturalH(natH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scaler); // 달 변경 등으로 자연 높이가 바뀌면 stage 높이 갱신
    ro.observe(stage); // 뷰포트 폭 변하면 배율 갱신
    return () => ro.disconnect();
  }, [showAgenda, decorate]);

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
    const serverIds = serverHearts ? (schedule.myHeartIds ?? []) : [];
    const delta = loadHeartDelta();
    const set = new Set(serverIds);
    for (const id of delta.off) set.delete(id);
    for (const id of delta.on) set.add(id);
    setBookmarks([...set]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 하트를 켤 때 누른 자리에서 ♥들이 스멀스멀 떠오르게 한다(움직임 최소화 설정이면 생략).
  function spawnHearts(x: number, y: number) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
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

  // 관심 토글 — 낙관적으로 즉시 반영하고, 서버 모드면 호출 후 집계 수를 권위값으로 보정한다.
  function toggleBookmark(id: string, ev?: ReactMouseEvent<HTMLButtonElement>) {
    const wasOn = bookmarks.includes(id);
    hapticTick(); // 가벼운 톡(Android만; iOS·미지원은 조용히 무시)
    if (!wasOn && ev) {
      // 이벤트 풀링 영향을 피하려 좌표를 동기적으로 먼저 읽는다.
      const rect = ev.currentTarget.getBoundingClientRect();
      spawnHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    setBookmarks((prev) => (wasOn ? prev.filter((x) => x !== id) : [...prev, id]));
    setHeartCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + (wasOn ? -1 : 1))
    }));
    // 이번 세션 의도를 델타에 기록(미리보기 재마운트에도 유지). 서버 실패 시 되돌린다.
    recordHeartDelta(id, !wasOn);
    if (!toggleHeartAction) {
      return; // 서버 액션 없음(샘플/오프라인): 개인 표시만, 집계 없음.
    }
    void toggleHeartAction(id).then((result) => {
      if (result.ok) {
        setHeartCounts((prev) => ({ ...prev, [id]: result.count }));
      } else {
        // 실패 → 낙관적 변경·델타를 함께 되돌린다(서버와 어긋난 채 남지 않게).
        setBookmarks((prev) => (wasOn ? [...prev, id] : prev.filter((x) => x !== id)));
        setHeartCounts((prev) => ({
          ...prev,
          [id]: Math.max(0, (prev[id] ?? 0) + (wasOn ? 1 : -1))
        }));
        recordHeartDelta(id, wasOn);
      }
    });
  }
  const isBookmarked = (id: string) => bookmarks.includes(id);

  // A(#3): 관심 단계는 "이번 달 최다 하트" 대비 상대 + 최소 절대 기준의 혼합으로 정한다.
  // 50~100명 규모에서 한두 명 차이로 단계가 출렁이지 않게 상대(ratio)를 쓰고,
  // 최소 3개 floor로 노이즈를 막는다. maxHeart는 현재 보이는 집계의 최댓값.
  const maxHeart = useMemo(() => {
    const counts = Object.values(heartCounts);
    return counts.length > 0 ? Math.max(...counts) : 0;
  }, [heartCounts]);
  // 이 달 "유일한 1위" 일정 id — 최댓값을 가진 일정이 딱 하나일 때만(공동 1위면 왕관 없음).
  const soleTopEventId = useMemo(() => {
    const entries = Object.entries(heartCounts);
    if (entries.length === 0 || maxHeart <= 0) {
      return null;
    }
    const tops = entries.filter(([, c]) => c === maxHeart);
    return tops.length === 1 ? tops[0][0] : null;
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
          fileType: file.type
        };
        // 서버는 created_at DESC(최신순)로 내려주므로 새 에셋은 결국 맨 왼쪽에 온다.
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
  // 페이지 이동(편집실로 돌아가기·계정 변경)은 서버 왕복이라 즉시 안 바뀐다 → 눌렀다는 신호를 띄운다.
  const [navMsg, setNavMsg] = useState<string | null>(null);
  function startNav(message: string) {
    setNavMsg(message);
    window.setTimeout(() => setNavMsg(null), 8000);
  }
  // 모바일 익명 로그인: /login 카드를 거치지 않고 클릭 시점에 환경을 분기한다.
  //  · 일반 브라우저 → 기본 폼 제출(/api/auth/login) → 곧장 구글 계정 선택창.
  //  · 안드로이드 웹뷰(숲·카톡) → 크롬 인텐트로 /login을 열면 거기서 자동 제출 → 구글 계정 선택창.
  //  · iOS 등 웹뷰 → 자동 전환 불가 → /login의 외부 브라우저 안내 카드로 보낸다.
  function handleMobileLogin(e: ReactMouseEvent<HTMLButtonElement>) {
    hapticTick();
    const det = detectInAppBrowser(typeof navigator !== "undefined" ? navigator.userAgent : "");
    if (!det.inApp) {
      startNav("Google 계정으로 이동 중…");
      return; // 폼 기본 제출(action=/api/auth/login)에 맡긴다.
    }
    e.preventDefault();
    if (det.android) {
      startNav("Chrome으로 여는 중…");
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
      startNav("로그인 안내 화면으로 이동 중…");
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
  function jumpToday() {
    if (onTodayMonth) return;
    hapticTick();
    const offset =
      (todayYM.year - view.year) * 12 + (todayYM.month - view.month);
    moveMonth(offset);
  }

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
  function renderDayCell(cell: MonthCell, weekSupCount: number) {
    const covering = getEventsForDate(schedule.events, cell.isoDate);
    const supportHere = covering.filter((e) => e.isSupport);
    const events = covering.filter((e) => !e.isSupport);
    const day = classifyDay(cell.isoDate, cell.weekday, today);

    // 이 칸의 대표 관심 단계 — 진입 시 단계별로 칸을 부각하는 애니메이션(data-pop)에 쓴다.
    let popTier: string | null = null;
    if (interactive) {
      let bestRank = 0;
      for (const e of events) {
        const t = heartTier(heartCounts[e.id] ?? 0, maxHeart, e.id === soleTopEventId);
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
        }`}
        data-pop={popTier ?? undefined}
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
              className="support-bar"
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
          {day.markName ? <em className="day-mark">{day.markName}</em> : null}
        </div>
        <div
          className="day-events"
          style={weekSupCount > 0 ? { paddingTop: 8 + weekSupCount * 20 } : undefined}
        >
          {events.map((event) => {
            const colors = eventColors(event);
            const extraColors = getExtraCategoryColors(event, viewTags, schedule.palette);
            const { main, subs } = splitEventTitle(event.publicTitle);
            const span = getEventSpan(event, cell.isoDate, cell.weekday, schedule.events);
            const bookmarked = isBookmarked(event.id);
            // 하트는 시작 칸(제목 보이는 칸)에서만, 로그인 시청자 상호작용 모드에서만 노출.
            const showHeart = canHeart && span.showTitle;
            // #3: 관심 단계 배지 — 집계 기반, 숫자는 노출하지 않고 불꽃 게이지로(시청자 화면 전용).
            const tier =
              interactive && span.showTitle
                ? heartTier(heartCounts[event.id] ?? 0, maxHeart, event.id === soleTopEventId)
                : null;
            const eventClass = [
              "public-event",
              span.isMulti ? "span" : "",
              span.isMulti && !span.roundLeft ? "no-left" : "",
              span.isMulti && !span.roundRight ? "no-right" : "",
              isDimmedByFilter(event) ? "dimmed" : "",
              event.isTentative && span.showTitle ? "tentative" : "",
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
                  {showHeart ? (
                    <button
                      aria-label={bookmarked ? "관심 일정에서 빼기" : "관심 일정으로 표시"}
                      aria-pressed={bookmarked}
                      className="event-heart"
                      onClick={(ev) => toggleBookmark(event.id, ev)}
                      title={bookmarked ? "관심 해제" : "관심 일정"}
                      type="button"
                    >
                      {bookmarked ? "♥" : "♡"}
                    </button>
                  ) : null}
                </div>
                {tier ? (
                  <span
                    className={`event-popular tier-${tier.key}`}
                    title="관심을 많이 받은 일정"
                  >
                    <span className="flame" aria-hidden="true">
                      {tier.flames}
                    </span>{" "}
                    {tier.label}
                  </span>
                ) : null}
                {subs.length > 0 ? (
                  <ul className={`event-subs${span.showTitle ? "" : " span-cont"}`}>
                    {subs.map((sub, i) => (
                      <li key={i}>{sub}</li>
                    ))}
                  </ul>
                ) : null}
                {/* PR2: 칸 색에 못 담은 추가 대분류 점 줄(시작 칸에만). */}
                {span.showTitle && extraColors.length > 0 ? (
                  <span className="pill-dots" aria-hidden="true">
                    {extraColors.map((c, i) => (
                      <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                    ))}
                  </span>
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
      const support = schedule.events.filter(
        (e) => e.isSupport && getEventDateKey(e) === cell.isoDate && !isDimmedByFilter(e)
      );
      const evs = schedule.events.filter(
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
                  {mods.length > 0 ? (
                    <>
                      <span className="agenda-legend-sub">방식</span>
                      {mods.map(legendBtn)}
                    </>
                  ) : null}
                </>
              );
            })()}
            {/* 웹처럼 '내 관심 일정 ♥'도 같은 자리에서 함께 거른다(로그인 시청자만). */}
            {canHeart ? (
              <button
                aria-pressed={bookmarkedOnly}
                className={`agenda-legend-tag heart ${bookmarkedOnly ? "on" : ""}`}
                onClick={() => setBookmarkedOnly((v) => !v)}
                type="button"
              >
                <LiquidHeart ratio={interestRatio} />
                내 관심
              </button>
            ) : null}
            {filterActive ? (
              <button className="agenda-legend-clear" onClick={clearFilters} type="button">
                필터 해제
              </button>
            ) : null}
            {/* 남는 공간에 인기 배지 단계 안내(웹과 동일, 모바일용으로 간결하게). */}
            <div className="agenda-tier-help">
              <strong>♥ 많이 받으면</strong>
              <span>
                <b className="flame">🔥</b> 관심
              </span>
              <span>
                <b className="flame">🔥🔥</b> 높은 관심
              </span>
              <span>
                <b className="flame">🔥🔥🔥</b> 폭발적
              </span>
              <span>
                <b className="flame">👑</b> 이 달 1위
              </span>
            </div>
          </aside>
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
            groups.map(({ cell, day, mark, list }, agendaIndex) => (
              <div
                className={`agenda-day ${day.isToday ? "today" : ""}`}
                key={cell.isoDate}
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
                    <span className={`agenda-mark ${mark.isHoliday ? "holiday" : ""}`}>
                      {mark.name}
                    </span>
                  ) : null}
                  {list.length === 0 ? (
                    <span className="agenda-noevent">예정된 공개 일정 없음</span>
                  ) : null}
                  {list.map(({ event, support }) => {
                    const colors = eventColors(event);
                    const extraColors = support
                      ? []
                      : getExtraCategoryColors(event, viewTags, schedule.palette);
                    const { main, subs } = splitEventTitle(event.publicTitle);
                    const bookmarked = isBookmarked(event.id);
                    const tier =
                      interactive && !support
                        ? heartTier(
                            heartCounts[event.id] ?? 0,
                            maxHeart,
                            event.id === soleTopEventId
                          )
                        : null;
                    const single = support
                      ? { background: "#84b74f" }
                      : colors[0]
                        ? { background: colors[0].bgColor }
                        : undefined;
                    const twoColor = !support && colors.length >= 2;
                    const end = event.endDateKey;
                    return (
                      <div className="agenda-event" key={(support ? "s-" : "") + event.id}>
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
                          {extraColors.length > 0 ? (
                            <span className="pill-dots" aria-hidden="true">
                              {extraColors.map((c, i) => (
                                <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                              ))}
                            </span>
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
                          {tier ? (
                            <span className={`event-popular tier-${tier.key}`}>
                              <span className="flame" aria-hidden="true">
                                {tier.flames}
                              </span>{" "}
                              {tier.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <main
      className={`poster-page${accountSwitch ? " poster-readonly" : ""}`}
      data-poster-theme={posterTheme}
    >
      {navMsg ? (
        <div className="private-loading" role="status" aria-live="polite">
          <span className="private-loading-spinner" aria-hidden="true" />
          {navMsg}
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
                  className={anonymous ? "agenda-login" : undefined}
                  onClick={(e) => {
                    if (anonymous) {
                      handleMobileLogin(e);
                    } else {
                      startNav(isNarrow ? "계정 변경 중…" : "계정 선택 화면으로 이동 중입니다…");
                    }
                  }}
                  type="submit"
                >
                  {anonymous ? (
                    <>
                      <LogIn aria-hidden="true" size={13} strokeWidth={2.5} />
                      <span>로그인</span>
                    </>
                  ) : (
                    /* 모바일은 폭이 좁아 넘칠 수 있어 "계정/변경" 2줄로 — 버튼이 좁아져 잘 들어간다. */
                    <span style={{ whiteSpace: "pre-line", lineHeight: 1.12, textAlign: "center" }}>
                      {"계정\n변경"}
                    </span>
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
            <div className="header-left" />

            {/* 월 이동은 시청자·꾸미기 모두 하단 플로팅 < > 바로 통일(달력 보며 넘기기 편하게).
                현재 월 표시는 포스터 제목(✨️ … N월)에 이미 있어 헤더 가운데는 비어 있다.
                그 가운데 자리에 '내 관심(♥)' 토글을 둔다 — 계정변경/미리보기 바와 같은 줄이라
                세로 공간을 안 먹어 포스터가 줄지 않고, 포스터 표면(캡쳐 캔버스) 밖이라 스티커
                좌표도 안전하다. 상호작용(시청자/미리보기) 모드에서만(꾸미기·캡쳐 제외). */}
            {canHeart ? (
              <div className="poster-interest">
                <button
                  aria-pressed={bookmarkedOnly}
                  className={`interest-toggle ${bookmarkedOnly ? "active" : ""}`}
                  onClick={() => setBookmarkedOnly((v) => !v)}
                  title="내가 ♥ 누른 일정만 모아서 보기"
                  type="button"
                >
                  <LiquidHeart ratio={interestRatio} />
                  <span className="it-text">
                    <strong>내 관심</strong>
                    <em>♥ 누른 일정만 모아보기</em>
                  </span>
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
                      // 꾸미기에서 보던 달을 편집실 월(sy/sm)로 넘겨, 편집실이 그 달로 열리게 한다.
                      writeViewCookie({ sy: view.year, sm: view.month });
                      startNav(isNarrow ? "편집실 여는 중…" : "편집실로 가는 중입니다…");
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
                  <button
                    className="button"
                    onClick={() =>
                      startNav(
                        anonymous
                          ? isNarrow
                            ? "로그인 중…"
                            : "로그인 화면으로 이동 중입니다…"
                          : isNarrow
                            ? "계정 변경 중…"
                            : "계정 선택 화면으로 이동 중입니다…"
                      )
                    }
                    type="submit"
                  >
                    {anonymous ? "로그인" : "계정변경"}
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
                <div className="theme-switch" role="group" aria-label="달력 테마">
                  {POSTER_THEMES.map((theme) => (
                    <button
                      aria-pressed={posterTheme === theme.key}
                      className={posterTheme === theme.key ? "active" : ""}
                      key={theme.key}
                      onClick={() => void changeTheme(theme.key)}
                      type="button"
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="decorate-cols">
                <div className="palette-group">
              <span className="palette-label">기본 이모지</span>
              <div className="emoji-tabs" role="tablist" aria-label="이모지 분류">
                {EMOJI_CATEGORIES.map((cat) => (
                  <button
                    aria-pressed={emojiCat === cat.key}
                    className={emojiCat === cat.key ? "active" : ""}
                    key={cat.key}
                    onClick={() => setEmojiCat(cat.key)}
                    type="button"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="emoji-palette">
                {activeEmojis.map((emoji, i) => (
                  <button
                    className="emoji-chip"
                    key={`${emoji}-${i}`}
                    onClick={() => addEmoji(emoji)}
                    title={`${emoji} 추가`}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="palette-group">
              <span className="palette-label">내 이모지</span>

              {/* 저장 칸: 업로드해 둔 이모지 보관함 */}
              {assets.length > 0 ? (
                <div className="emoji-palette asset-palette">
                  {assets.map((asset) => {
                    const pending = pendingAssetIds.has(asset.id);
                    return (
                      <div
                        className={`asset-chip ${pending ? "uploading" : ""}`}
                        key={asset.id}
                      >
                        <button
                          className="emoji-chip"
                          disabled={pending}
                          onClick={() => addImageSticker(asset)}
                          title={pending ? "올리는 중…" : `${asset.name} 추가`}
                          type="button"
                        >
                          {/* 업로드 이미지 미리보기 — 동적 URL이라 next/image 부적합 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={asset.name} src={asset.fileUrl} />
                          {pending ? <span className="asset-spinner" aria-hidden="true" /> : null}
                        </button>
                        {/* 삭제(×)는 에셋 관리 권한이 있을 때만 — 매니저는 꾸미기만(삭제 불가). */}
                        {!pending && deleteStickerAssetAction ? (
                          <button
                            aria-label={`${asset.name} 삭제`}
                            className="asset-del"
                            onClick={() => removeAsset(asset.id)}
                            title="이 이모지 삭제"
                            type="button"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* 업로드 칸 — 에셋 관리 권한이 있을 때만(매니저는 숨김 = 꾸미기만). 드래그앤드롭/클릭. */}
              {uploadStickerAssetAction ? (
              <label
                className={`upload-drop ${dragOver ? "dragover" : ""} ${uploading ? "busy" : ""}`}
                onDragLeave={() => setDragOver(false)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleUploadFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <input
                  accept="image/png,image/webp,image/gif,image/jpeg"
                  disabled={uploading}
                  hidden
                  multiple
                  onChange={(e) => {
                    void handleUploadFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                <span className="upload-drop-icon" aria-hidden="true">
                  <Upload size={20} />
                </span>
                <span className="upload-drop-title">
                  {uploading
                    ? "올리는 중…"
                    : dragOver
                      ? "여기에 놓으면 업로드돼요"
                      : "이미지를 끌어다 놓거나 클릭해서 업로드"}
                </span>
                <span className="upload-drop-hint">
                  정사각형 · 투명 배경 PNG 권장 · PNG·WebP·GIF·JPG · 2MB 이하 · 여러 개 가능
                </span>
              </label>
              ) : null}
            </div>

            {/* P2: 데코 도형 — 누르면 프리셋 색으로 올라가고, 툴바에서 색·움직임·회전 등 조절. */}
            <div className="palette-group">
              <span className="palette-label">도형</span>
              <div className="emoji-palette shape-palette">
                {STICKER_SHAPES.map((s) => (
                  <button
                    className="emoji-chip shape-chip"
                    key={s.key}
                    onClick={() => addShape(s.key)}
                    title={`${s.label} 추가`}
                    type="button"
                  >
                    <ShapeSvg
                      color={s.defaultColor}
                      shapeKey={s.key}
                      style={{ width: "74%", height: "74%" }}
                    />
                  </button>
                ))}
              </div>
            </div>
            </div>

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
          data-poster-theme={posterTheme}
          key={`surface-${view.year}-${view.month}`}
        >
          <div className="poster-heading">
              <span aria-hidden="true">✨️</span>
            <h1>{schedule.calendar.title}</h1>
              <span aria-hidden="true">✨️</span>
            <em>
              {view.year}년 {view.month}월
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

          {/* 메모지 — 빈 노트로 띄워두고, 토리님이 이 위에 텍스트 스티커로 하고 싶은 말을 적는다. */}
          <aside className="public-side" aria-label="메모">
            <div className="public-memo">
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

            <div className="public-month-grid" aria-label="월간 공개 일정" ref={monthGridRef}>
              {cells.map((cell, i) =>
                renderDayCell(cell, weekSupportLaneCount[Math.floor(i / 7)] ?? 0)
              )}
            </div>
          </section>

          <aside className="public-right" aria-label="업 도움과 색상 안내">
            {supportEvents.map((s) => {
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

            <div className="public-legend-vertical" aria-label="콘텐츠 색상 안내">
              <strong className="legend-title">색상 안내</strong>
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
                  // 꾸미기 모드에선 스티커 레이어가 덮어 클릭이 막히므로 정적 표시.
                  if (decorate) {
                    return (
                      <span key={tag.id}>
                        {swatch}
                        {tag.displayName}
                      </span>
                    );
                  }
                  // A2 고도화: 다중 선택과 동기화. 선택된 게 있으면 안 고른 항목은 흐리게.
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
                      <>
                        <strong className="legend-subhead">방식</strong>
                        {/* 방식은 2열로 — 세로 높이를 아껴 아래 ♥ 안내가 들어갈 자리를 만든다(웹). */}
                        <div className="legend-mods">{mods.map(legendBtn)}</div>
                      </>
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
                onClick={clearFilters}
                type="button"
                aria-hidden={!filterActive}
                tabIndex={filterActive ? 0 : -1}
              >
                필터 해제
              </button>
              {/* ♥ 의미·인기 단계 안내 — 하트 토글은 제목 위 배너로 옮겼고, 그 자리에 모바일처럼
                  설명을 둔다. margin-top:auto로 안내 박스 바닥에 붙어 빈 공간 없이 채운다. */}
              {interactive ? (
                <div className="legend-heart-help">
                  <p className="legend-tier-line">
                    <span className="hm">♥</span> 많이 받으면
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
              ) : null}
            </div>
          </aside>
        </section>
        </div>
        </div>
        </div>
        )}
      </section>

      {/* 월 이동 버튼을 하단 좌·우에 띄운다(가운데는 비워 '맨 위로' 버튼과 안 겹치게).
          시청자·아젠다·꾸미기 모두 — 달력을 보며 월을 넘기기 쉽게(HCI). 상단 월 pill은 폐지. */}
      <nav className="agenda-monthbar" aria-label="월 이동">
        <button className="mb-step" onClick={() => moveMonth(-1)} title="이전 달" type="button">
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
            <button
              className="mb-act"
              disabled={onTodayMonth}
              onClick={jumpToday}
              title="오늘이 있는 달로"
              type="button"
            >
              <CalendarCheck aria-hidden="true" size={18} />
              <span>오늘</span>
            </button>
          </div>
        ) : null}

        <button className="mb-step" onClick={() => moveMonth(1)} title="다음 달" type="button">
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
