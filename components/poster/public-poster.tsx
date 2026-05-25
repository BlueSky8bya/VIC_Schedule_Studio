"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BringToFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  FlipHorizontal,
  FlipVertical,
  Keyboard,
  Redo2,
  SendToBack,
  Trash2,
  Type,
  Undo2,
  Upload
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { PosterExportActions } from "@/components/poster/poster-export-actions";
import { StickerLayer, TEXT_FONT_STACK } from "@/components/poster/sticker-layer";
import {
  POSTER_THEMES,
  type PublicSchedule,
  type PublicScheduleEvent,
  type StickerAsset,
  type StickerInstance
} from "@/lib/domain/schedule-types";
import type { ThemeResult } from "@/lib/schedules/theme-actions";
import type {
  SaveStickerInput,
  StickerResult
} from "@/lib/schedules/sticker-actions";
import type { StickerAssetResult } from "@/lib/schedules/sticker-asset-actions";
import type { HeartResult } from "@/lib/schedules/heart-actions";
import { getDayMark } from "@/lib/calendar/holidays";
import {
  assignSupportLanes,
  buildCalendarMonth,
  buildChainKeys,
  classifyDay,
  eventColorStyle,
  getAdjacentMonth,
  getEventDateKey,
  getEventsForDate,
  getEventSpan,
  getEventTagColors,
  getMonthLabel,
  getSpanRun,
  getTodayKst,
  mixedEventPatterns,
  mixedEventStyle,
  splitEventTitle,
  type MonthCell
} from "@/lib/calendar/month";
import { useEqualChainHeights } from "@/lib/calendar/use-equal-chain-heights";

type PublicPosterProps = {
  schedule: PublicSchedule;
  initialYear?: number;
  initialMonth?: number;
  canExport?: boolean;
  decorate?: boolean;
  saveStickerAction?: (input: SaveStickerInput) => Promise<StickerResult>;
  deleteStickerAction?: (id: string) => Promise<StickerResult>;
  uploadStickerAssetAction?: (formData: FormData) => Promise<StickerAssetResult>;
  deleteStickerAssetAction?: (id: string) => Promise<StickerAssetResult>;
  setPosterThemeAction?: (theme: string) => Promise<ThemeResult>;
  // A: 일정 관심(하트) 토글. 주어지면 서버 집계 연동, 없으면 기기별 localStorage로만 동작.
  toggleHeartAction?: (eventId: string) => Promise<HeartResult>;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 관심 일정 북마크 저장 키 — 캘린더 슬러그가 하나(vic)라 단일 키로 충분하다.
const BOOKMARK_STORAGE_KEY = "vic:bookmarks:v1";

// #3: 관심 하트 단계(불꽃 게이지). 최소 3개부터 표시하고, 이번 달 최다 대비 비율로 단계를 올린다.
type HeartTier = { key: "warm" | "hot" | "blaze" | "top"; flames: string; label: string };
function heartTier(count: number, max: number): HeartTier | null {
  if (count < 3) {
    return null; // 너무 적으면 표시하지 않는다(노이즈 방지).
  }
  // 이번 달 1위(그리고 어느 정도 모였을 때)는 왕관으로 특별 취급.
  if (count === max && max >= 5) {
    return { key: "top", flames: "👑", label: "최고 인기" };
  }
  const ratio = max > 0 ? count / max : 0;
  if (ratio >= 0.8) {
    return { key: "blaze", flames: "🔥🔥🔥", label: "폭발적 관심" };
  }
  if (ratio >= 0.5) {
    return { key: "hot", flames: "🔥🔥", label: "높은 관심" };
  }
  return { key: "warm", flames: "🔥", label: "관심" };
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
      "🙀", "😿", "😾", "🙈", "🙉", "🙊", "💋", "💯", "🫶", "🥶"
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
      "😍", "🥰", "😘", "💐", "🌹", "💒"
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
      "🐹", "🐰", "🐮", "🐷", "🐗", "🐔", "🦉", "🦅", "🦆", "🦢",
      "🦩", "🦚", "🦜", "🐝", "🐞", "🦗", "🕷️", "🦂", "🐌", "🦕",
      "🦖", "🐉", "🐲", "🦔", "🐺", "🐴", "🦓", "🦒", "🐘", "🦣",
      "🦛", "🦏", "🐪", "🐫", "🦙", "🐑", "🐐", "🦌", "🐕", "🦮",
      "🐩", "🐈", "🐈‍⬛", "🐓", "🦃", "🕊️", "🐇", "🦝", "🦨", "🦡",
      "🦦", "🦥", "🐿️", "🦔", "🦇", "🐾", "🦤", "🪲", "🐛", "🦂"
    ]
  },
  {
    key: "plant",
    label: "식물·꽃",
    emojis: [
      "🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🪷",
      "💐", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️",
      "🍀", "🎍", "🎋", "🍃", "🍂", "🍁", "🪺", "🍄", "🌰", "🪻",
      "🌽", "🫛", "🥬", "🥦", "🌶️", "🫚", "🌊", "🪸", "🪹", "🌍"
    ]
  },
  {
    key: "food",
    label: "음식",
    emojis: [
      "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🍎", "🍏", "🍐",
      "🍊", "🍋", "🍌", "🍉", "🍇", "🍈", "🥝", "🍅", "🥑", "🍆",
      "🥕", "🌽", "🥔", "🍠", "🥐", "🍞", "🥖", "🥨", "🧀", "🥞",
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
      "💧", "💦", "🌊", "🔥", "❄️", "⚡", "🌠", "🌌", "🪐", "🌍"
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
      "👚", "👕", "👖", "🧥", "👔", "👒", "🎩", "🧢", "👑", "🕶️",
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
  schedule,
  canExport = false,
  decorate = false,
  saveStickerAction,
  deleteStickerAction,
  uploadStickerAssetAction,
  deleteStickerAssetAction,
  setPosterThemeAction,
  toggleHeartAction
}: PublicPosterProps) {
  const router = useRouter();
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
  const supportEvents = schedule.events.filter((e) => e.isSupport);
  // 이어진 일정 묶음 키 — 같은 묶음 칸들의 높이를 맞추는 데 쓴다(아래 useEqualChainHeights).
  const chainKeys = useMemo(() => buildChainKeys(schedule.events), [schedule.events]);
  const monthGridRef = useRef<HTMLDivElement>(null);
  useEqualChainHeights(monthGridRef, [schedule.events, view]);
  // #1: 색상 안내에서 "기타"는 항상 맨 마지막으로(나머지는 기존 정렬 유지).
  const legendTags = useMemo(
    () =>
      [...schedule.tags].sort(
        (a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타")
      ),
    [schedule.tags]
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
  const [bookmarksReady, setBookmarksReady] = useState(serverHearts);
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
  // 키보드 미세이동 등에서 최신 스티커 배열을 읽기 위한 ref + 저장 디바운스 타이머
  const stickersRef = useRef<StickerInstance[]>([]);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeBurstRef = useRef(0); // 방향키 연속 입력을 한 단위로 묶기 위한 타임스탬프
  stickersRef.current = stickers;
  // C2: 실행취소/다시실행 — 현재 달 스티커 배열 스냅샷 스택.
  const [undoStack, setUndoStack] = useState<StickerInstance[][]>([]);
  const [redoStack, setRedoStack] = useState<StickerInstance[][]>([]);

  // 달을 바꿀 때만 해당 달 스티커로 다시 시드한다.
  // (스티커 저장 시 서버 revalidate로 schedule이 갱신되어도 로컬 상태가 우선 —
  //  그렇지 않으면 추가/이동/회전 직후 선택이 풀려 패널·핸들이 사라진다.)
  useEffect(() => {
    setStickers(schedule.stickers.filter((s) => s.year === view.year && s.month === view.month));
    setSelectedSticker(null);
    setMultiIds([]);
    setTagFilters([]);
    setBookmarkedOnly(false);
    setUndoStack([]); // 달이 바뀌면 실행취소 히스토리는 초기화
    setRedoStack([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.year, view.month]);

  // 서버 연동이 없을 때만(샘플/오프라인) 기기별 localStorage를 쓴다 — 마운트 시 한 번 불러온다.
  useEffect(() => {
    if (serverHearts) {
      return; // 서버 집계 모드에선 schedule.myHeartIds가 권위값.
    }
    try {
      const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch {
      // 손상된 값/사생활 모드 등은 조용히 무시 — 북마크는 부가 기능.
    }
    setBookmarksReady(true);
  }, [serverHearts]);

  // 북마크가 바뀌면 저장(localStorage 모드만). 초기 로드 전에는 덮어쓰지 않도록 ready 이후에만.
  useEffect(() => {
    if (serverHearts || !bookmarksReady) {
      return;
    }
    try {
      window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      // 저장 실패는 무시.
    }
  }, [bookmarks, bookmarksReady, serverHearts]);

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
    if (!toggleHeartAction) {
      return; // localStorage 모드: 개인 표시만, 집계 없음.
    }
    void toggleHeartAction(id).then((result) => {
      if (result.ok) {
        setHeartCounts((prev) => ({ ...prev, [id]: result.count }));
      } else {
        // 실패 → 낙관적 변경을 되돌린다.
        setBookmarks((prev) => (wasOn ? [...prev, id] : prev.filter((x) => x !== id)));
        setHeartCounts((prev) => ({
          ...prev,
          [id]: Math.max(0, (prev[id] ?? 0) + (wasOn ? 1 : -1))
        }));
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

  // 태그 칩 토글(다중 선택).
  function toggleTagFilter(id: string) {
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
      text: sticker.kind === "text" ? sticker.label : undefined,
      textColor: sticker.textColor,
      fontWeight: sticker.fontWeight,
      fontFamily: sticker.fontFamily,
      textAlign: sticker.textAlign,
      textBg: sticker.textBg,
      italic: sticker.italic,
      outline: sticker.outline,
      shadow: sticker.shadow,
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
      widthRatio: 0.16,
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
    // 순차 업로드 (서버·스토리지 부하를 줄이고 실패 메시지를 모은다)
    for (const file of images) {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadStickerAssetAction(formData);
      if (!result.ok) {
        lastError = result.error;
      }
    }
    setUploading(false);
    if (lastError) {
      setStickerError(lastError);
    }
    router.refresh(); // 새 에셋들이 schedule.stickerAssets에 반영되도록
  }

  // 업로드한 커스텀 이모지 삭제 (이를 쓰는 스티커도 함께 사라짐).
  async function removeAsset(assetId: string) {
    if (!deleteStickerAssetAction) {
      return;
    }
    setStickers((prev) => prev.filter((s) => s.assetId !== assetId));
    const result = await deleteStickerAssetAction(assetId);
    if (result.ok) {
      router.refresh();
    } else {
      setStickerError(result.error);
    }
  }

  async function deleteSelected() {
    const ids = selectedIds;
    if (ids.length === 0 || !deleteStickerAction) {
      return;
    }
    pushHistory();
    const idSet = new Set(ids);
    setStickers((prev) => prev.filter((s) => !idSet.has(s.id)));
    clearSelection();
    for (const id of ids) {
      if (!id.startsWith("temp-")) {
        const result = await deleteStickerAction(id);
        if (!result.ok) {
          setStickerError(result.error);
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
      let top = r.top - gap - bh; // 기본: 스티커 위
      if (top < margin) {
        top = r.bottom + gap; // 위가 좁으면 아래로
      }
      if (top + bh > vh - margin) {
        top = Math.max(margin, vh - margin - bh);
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
      text: fresh.kind === "text" ? fresh.label : undefined,
      textColor: fresh.textColor,
      fontWeight: fresh.fontWeight,
      fontFamily: fresh.fontFamily,
      textAlign: fresh.textAlign,
      textBg: fresh.textBg,
      italic: fresh.italic,
      outline: fresh.outline,
      shadow: fresh.shadow,
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
    setUndoStack((prev) => [...prev.slice(-49), snapshot()]);
    setRedoStack([]);
  }
  // 재삽입으로 새 id가 발급되면 로컬 상태·히스토리 스택의 옛 id를 모두 새 id로 바꾼다.
  function remapId(oldId: string, newId: string) {
    const swap = (arr: StickerInstance[]) =>
      arr.map((s) => (s.id === oldId ? { ...s, id: newId } : s));
    setStickers((prev) => swap(prev));
    setUndoStack((prev) => prev.map(swap));
    setRedoStack((prev) => prev.map(swap));
    setSelectedSticker((cur) => (cur === oldId ? newId : cur));
  }
  // 스냅샷(target) 상태로 되돌리고, 그 차이를 서버에도 반영(삭제·재삽입·수정).
  async function applySnapshot(target: StickerInstance[]) {
    const current = stickersRef.current;
    setStickers(target);
    clearSelection();
    const targetIds = new Set(target.map((s) => s.id));
    const curIds = new Set(current.map((s) => s.id));
    // 1) target에 없는 현재 스티커 → 서버에서 삭제
    for (const s of current) {
      if (!targetIds.has(s.id) && !s.id.startsWith("temp-") && deleteStickerAction) {
        await deleteStickerAction(s.id);
      }
    }
    // 2) 현재에 없는 target 스티커 → 재삽입(새 id 발급 후 remap)
    for (const s of target) {
      if (!curIds.has(s.id) && saveStickerAction) {
        const result = await saveStickerAction({
          year: s.year,
          month: s.month,
          emoji: s.kind === "emoji" ? s.label : undefined,
          assetId: s.kind === "image" ? s.assetId : undefined,
          text: s.kind === "text" ? s.label : undefined,
          textColor: s.textColor,
          fontWeight: s.fontWeight,
          fontFamily: s.fontFamily,
          textAlign: s.textAlign,
          textBg: s.textBg,
          italic: s.italic,
          outline: s.outline,
          shadow: s.shadow,
          xRatio: s.xRatio,
          yRatio: s.yRatio,
          widthRatio: s.widthRatio,
          rotationDeg: s.rotationDeg,
          flipX: s.flipX,
          flipY: s.flipY,
          opacity: s.opacity,
          zIndex: s.zIndex
        });
        if (result.ok) {
          remapId(s.id, result.id);
        } else {
          setStickerError(result.error);
        }
      }
    }
    // 3) 양쪽에 다 있는 스티커 → 값 저장(이동/크기 등 되돌림 반영)
    for (const s of target) {
      if (curIds.has(s.id)) {
        await commitSticker(s);
      }
    }
  }
  function undo() {
    if (undoStack.length === 0) {
      return;
    }
    const target = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, snapshot()]);
    void applySnapshot(target);
  }
  function redo() {
    if (redoStack.length === 0) {
      return;
    }
    const target = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, snapshot()]);
    void applySnapshot(target);
  }

  // 복제: 선택한 스티커를 살짝 옮긴 위치에 똑같이 하나 더.
  function duplicateSelected() {
    const sources = selectedIds
      .map((id) => stickersRef.current.find((x) => x.id === id))
      .filter((s): s is StickerInstance => Boolean(s));
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

  // D: 대표 태그(최대 2개)의 색. 2개면 그라데이션으로 칠한다.
  function eventColors(event: PublicScheduleEvent) {
    return getEventTagColors(event, schedule.tags, schedule.palette);
  }

  // A2 고도화: 현재 필터(태그 다중 + 관심만)에 안 맞는 일정은 흐리게 처리할지 판정.
  function isDimmedByFilter(event: PublicScheduleEvent) {
    const matchesTag =
      tagFilters.length === 0 ||
      tagFilters.some(
        (id) => event.primaryTagIds.includes(id) || event.tagIds.includes(id)
      );
    const matchesBookmark = !bookmarkedOnly || isBookmarked(event.id);
    return !(matchesTag && matchesBookmark);
  }

  function moveMonth(offset: number) {
    setView((current) => getAdjacentMonth(current.year, current.month, offset));
  }

  // 날짜 칸 렌더러.
  function renderDayCell(cell: MonthCell) {
    const covering = getEventsForDate(schedule.events, cell.isoDate);
    const supportHere = covering.filter((e) => e.isSupport);
    const events = covering.filter((e) => !e.isSupport);
    const day = classifyDay(cell.isoDate, cell.weekday, today);

    return (
      <article
        className={`public-day ${cell.inCurrentMonth ? "" : "outside"} ${
          day.isToday ? "today" : ""
        }`}
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
          style={
            supportLanes.count > 0 ? { paddingTop: 8 + supportLanes.count * 20 } : undefined
          }
        >
          {events.map((event) => {
            const colors = eventColors(event);
            const { main, subs } = splitEventTitle(event.publicTitle);
            const span = getEventSpan(event, cell.isoDate, cell.weekday, schedule.events);
            const bookmarked = isBookmarked(event.id);
            // 하트는 시작 칸(제목 보이는 칸)에서만, 시청자 상호작용 모드에서만 노출.
            const showHeart = interactive && span.showTitle;
            // #3: 관심 단계 배지 — 집계 기반, 숫자는 노출하지 않고 불꽃 게이지로(시청자 화면 전용).
            const tier =
              interactive && span.showTitle
                ? heartTier(heartCounts[event.id] ?? 0, maxHeart)
                : null;
            const eventClass = [
              "public-event",
              span.isMulti ? "span" : "",
              span.isMulti && !span.roundLeft ? "no-left" : "",
              span.isMulti && !span.roundRight ? "no-right" : "",
              isDimmedByFilter(event) ? "dimmed" : "",
              bookmarked ? "bookmarked" : ""
            ]
              .filter(Boolean)
              .join(" ");
            const mixed = colors.length >= 2;
            // 이어진 칸 전체 기준으로 그라데이션·무늬 경계를 잡는다(2칸=이음새, 3칸=가운데).
            const run = mixed ? getSpanRun(event, cell.isoDate, cell.weekday) : null;
            return (
              <div
                className={eventClass}
                data-chain={chainKeys.get(event.id)}
                data-color={mixed ? undefined : colors[0]?.key}
                data-mixed={mixed ? "" : undefined}
                key={event.id}
                style={
                  mixed
                    ? mixedEventStyle(colors, run!)
                    : colors.length > 0
                      ? eventColorStyle(colors)
                      : undefined
                }
              >
                {mixed
                  ? mixedEventPatterns(colors, run!).map((p, pi) => (
                      <span
                        aria-hidden="true"
                        className="evt-pat"
                        data-color={p.key}
                        key={pi}
                        style={p.clipPath ? { clipPath: p.clipPath } : undefined}
                      />
                    ))
                  : null}
                <div className="event-main">
                  {/* 이어지는 칸은 제목을 투명하게 그려 시작 칸과 높이를 맞춘다(이음새 어긋남 방지). */}
                  {span.showTitle ? (
                    <p>{main}</p>
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
              </div>
            );
          })}
        </div>
      </article>
    );
  }

  return (
    <main className="poster-page" data-poster-theme={posterTheme}>
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
      <section className="public-calendar-shell">
        <header className="public-calendar-header">
          <div className="month-controls" aria-label="월 이동">
            <button onClick={() => moveMonth(-1)} title="이전 달" type="button">
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <strong>{getMonthLabel(view.year, view.month)}</strong>
            <button onClick={() => moveMonth(1)} title="다음 달" type="button">
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="viewer-actions">
            {decorate ? (
              <Link className="button" href="/studio">
                <ChevronLeft aria-hidden="true" size={16} />
                편집실로 돌아가기
              </Link>
            ) : null}
          </div>
        </header>

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
                <div className="theme-switch" role="group" aria-label="포스터 테마">
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
              {schedule.stickerAssets.length > 0 ? (
                <div className="emoji-palette asset-palette">
                  {schedule.stickerAssets.map((asset) => (
                    <div className="asset-chip" key={asset.id}>
                      <button
                        className="emoji-chip"
                        onClick={() => addImageSticker(asset)}
                        title={`${asset.name} 추가`}
                        type="button"
                      >
                        {/* 업로드 이미지 미리보기 — 동적 URL이라 next/image 부적합 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={asset.name} src={asset.fileUrl} />
                      </button>
                      <button
                        aria-label={`${asset.name} 삭제`}
                        className="asset-del"
                        onClick={() => removeAsset(asset.id)}
                        title="이 이모지 삭제"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* 업로드 칸: 드래그 앤 드롭 또는 클릭 (저장 칸과 분리) */}
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
                      </div>
                      <div className="stf-row">
                        <label className="stf-opacity" title="투명도">
                          투명도
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
                        <span className="stf-spacer" />
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
                    </div>
                  ) : selected ? (
                    <div className="stf-body">
                      <div className="stf-row">
                        <label className="stf-opacity" title="투명도">
                          투명도
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
                        <span className="stf-spacer" />
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
        {decorate || canExport ? (
          <div className="poster-capture-row">
            {decorate ? (
              <div className="text-add-row">
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

        <section className="poster-surface" data-export-surface data-poster-theme={posterTheme}>
          <div className="poster-heading">
            <span aria-hidden="true">✦</span>
            <h1>{schedule.calendar.title}</h1>
            <span aria-hidden="true">✦</span>
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
              {cells.map((cell) => renderDayCell(cell))}
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
              {legendTags.map((tag) => {
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
              })}
              {/* 내가 ♥ 누른 일정만 모아 보기 — 색상 안내와 같은 자리에서 함께 거른다. */}
              {!decorate ? (
                <button
                  aria-pressed={bookmarkedOnly}
                  className={`legend-item heart ${bookmarkedOnly ? "active" : ""}`}
                  onClick={() => setBookmarkedOnly((v) => !v)}
                  title="내가 ♥ 누른 일정만 모아서 보기"
                  type="button"
                >
                  <i className="heart-mark" aria-hidden="true">
                    ♥
                  </i>
                  내 관심 일정{bookmarks.length > 0 ? ` (${bookmarks.length})` : ""}
                </button>
              ) : null}
              {filterActive ? (
                <button className="legend-clear" onClick={clearFilters} type="button">
                  필터 해제
                </button>
              ) : null}
              {/* 관심(♥)을 많이 받은 일정의 인기 배지 단계만 간단히 안내. */}
              {!decorate ? (
                <div className="legend-heart-help">
                  <p className="legend-tier-line">
                    관심(♥)을 많이 받은 일정엔 인기 배지가 붙어요:
                  </p>
                  <ul className="legend-tiers">
                    <li>
                      <span className="flame">🔥</span> 관심
                    </li>
                    <li>
                      <span className="flame">🔥🔥</span> 높은 관심
                    </li>
                    <li>
                      <span className="flame">🔥🔥🔥</span> 폭발적 관심
                    </li>
                    <li>
                      <span className="flame">👑</span> 이 달 최고 인기
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");

  return `${Number(month)}.${Number(day)}`;
}
