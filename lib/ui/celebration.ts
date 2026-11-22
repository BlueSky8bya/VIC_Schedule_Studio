// 기념일 빵빠레 테마(2026-10-06 소유자: "데뷔 1주년·개천절·할로윈… 눌러도 똑같은 빵빠레 — 그 날에 맞게").
// 표기 이름(lib/calendar/holidays.ts getDayMark)을 보고 색·이모지·터지는 모양·효과음을 고른다. 순수 함수 — DOM 없음.
//
// 모양(shape):
//   burst    사방으로 팡(기본)
//   firework 큰 축포 — 더 멀리, 더 많이(데뷔 주년·마일스톤)
//   rise     위로 떠오름(풍선·등불·하트·보름달)
//   fall     아래로 흩날림(눈·꽃잎·낙엽)
//   calm     조용히 내려앉음(추모일 — 폭죽은 결이 안 맞는다)
// 국기 이모지(🇰🇷)는 쓰지 않는다 — 윈도우는 국기 이모지를 안 그려 "KR" 글자로 보인다(2026-10-06 캡처).
// 소리(sound)는 lib/ui/sfx.ts의 짧은 합성음 이름 — 효과음 설정이 켜져 있을 때만 난다.

export type CelebrationShape = "burst" | "firework" | "rise" | "fall" | "calm";
export type CelebrationSound = "fanfare" | "grand" | "chime" | "bells" | "spooky" | "sparkle" | "pop" | "soft" | "birthday" | "none";

export type CelebrationTheme = {
  key: string;
  shape: CelebrationShape;
  palette: string[];
  emojis: string[];
  /** 입자 중 이모지 비율(0~1). 나머지는 색종이. */
  emojiRatio: number;
  count: number;
  sound: CelebrationSound;
  /** 큰 연출(햅틱 성공 + 큰 입자). */
  big?: boolean;
  /** 특별한 축하 날(생일·데뷔 주년·D+N00) — 화면 곳곳 축포 + 위에서 색종이 비 + 의식 빵빠레, 당일엔 '눌러 보세요' 유도. */
  grand?: boolean;
};

const BASE: CelebrationTheme = {
  key: "default",
  shape: "burst",
  palette: ["#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f87171", "#ffffff"],
  emojis: ["✨", "🎉"],
  emojiRatio: 0.22,
  count: 16,
  sound: "pop"
};

const t = (key: string, o: Partial<CelebrationTheme>): CelebrationTheme => ({ ...BASE, key, ...o });

// 24절기 — 계절별 한 벌.
const SPRING_TERMS = ["입춘", "우수", "경칩", "춘분", "청명", "곡우"];
const SUMMER_TERMS = ["입하", "소만", "망종", "하지", "소서", "대서"];
const AUTUMN_TERMS = ["입추", "처서", "백로", "추분", "한로", "상강"];
const WINTER_TERMS = ["입동", "소설", "대설", "소한", "대한"];

/** 표기 이름 → 테마. 이모지 접두(🎉·🍗 등)가 붙어 있어도 글자로 판정한다. */
export function celebrationFor(name: string | null | undefined): CelebrationTheme {
  const n = (name ?? "").trim();
  const has = (...words: string[]) => words.some((w) => n.includes(w));

  if (has("주년", "스트리머 데뷔"))
    return t("debut-anniv", {
      shape: "firework",
      big: true,
      grand: true,
      palette: ["#f5c542", "#ffdf7e", "#ff8fb1", "#ffffff", "#ffd1e0", "#c9a227"],
      emojis: ["🎉", "🎊", "🏆", "✨", "⭐", "🥂"],
      emojiRatio: 0.38,
      count: 34,
      sound: "grand"
    });
  // 데뷔 D+N00(백 단위)은 특별한 날 — 의식 빵빠레·화면 축포. 그 밖의 D+·첫 방송 등은 보통 축포.
  const dplus = /D\+\s*(\d+)/.exec(n);
  if (dplus && Number(dplus[1]) % 100 === 0)
    return t("milestone-grand", {
      shape: "firework",
      big: true,
      grand: true,
      palette: ["#f5c542", "#ff8fb1", "#7cc4ff", "#ffffff", "#a78bfa", "#ffdf7e"],
      emojis: ["🎉", "🎊", "✨", "⭐", "💯", "🎈"],
      emojiRatio: 0.36,
      count: 36,
      sound: "grand"
    });
  if (has("D+", "첫 방송", "합격", "공개"))
    return t("milestone", {
      shape: "firework",
      palette: ["#f5c542", "#ff8fb1", "#7cc4ff", "#ffffff", "#a78bfa"],
      emojis: ["🎉", "✨", "🎈", "⭐"],
      emojiRatio: 0.32,
      count: 24,
      sound: "fanfare"
    });
  // 생일(2026-10-06 소유자: "토리님 생일은 단순 빵빠레가 아니라 생일축하합니다~ 멜로디") — 케이크·풍선이 떠오르고
  // 생일 축하 노래 한 소절(lib/ui/sfx 'birthday', 오르골 음색).
  if (has("생일"))
    return t("birthday", {
      shape: "firework", // "빵빠레 한 번 크게 터지고"
      big: true,
      grand: true,
      palette: ["#ff9ec7", "#ffd27a", "#9ad8ff", "#c8b6ff", "#ffffff", "#ffb4a2"],
      emojis: ["🎂", "🎈", "🎁", "🧁", "🎉", "🕯️"],
      emojiRatio: 0.5,
      count: 40,
      sound: "birthday"
    });
  if (has("할로윈"))
    return t("halloween", {
      shape: "rise",
      palette: ["#f97316", "#7c3aed", "#1f1f1f", "#facc15", "#a3e635"],
      emojis: ["🎃", "👻", "🦇", "🕸️", "🍬", "🕯️"],
      emojiRatio: 0.6,
      count: 18,
      sound: "spooky"
    });
  if (has("크리스마스", "성탄"))
    return t("christmas", {
      shape: "fall",
      palette: ["#dc2626", "#16a34a", "#ffffff", "#facc15", "#e5f3ff"],
      emojis: ["🎄", "🎅", "❄️", "⭐", "🎁", "🔔"],
      emojiRatio: 0.55,
      count: 22,
      sound: "bells"
    });
  if (has("설날"))
    return t("seollal", {
      palette: ["#dc2626", "#f5c542", "#ffffff", "#2563eb", "#f472b6"],
      emojis: ["🧧", "🎍", "🪭", "🍡", "✨"],
      emojiRatio: 0.5,
      count: 18,
      sound: "chime"
    });
  if (has("신정"))
    return t("newyear", {
      shape: "firework",
      palette: ["#f5c542", "#ffffff", "#60a5fa", "#f472b6", "#a78bfa"],
      emojis: ["🎆", "🎇", "🎉", "✨"],
      emojiRatio: 0.4,
      count: 26,
      sound: "fanfare"
    });
  if (has("추석"))
    return t("chuseok", {
      shape: "rise",
      palette: ["#f5c542", "#f59e0b", "#fde68a", "#fb923c", "#ffffff"],
      emojis: ["🌕", "🍡", "🌾", "🍂", "🐇"],
      emojiRatio: 0.55,
      count: 16,
      sound: "chime"
    });
  if (has("대보름"))
    return t("daeboreum", {
      shape: "rise",
      palette: ["#f5c542", "#fde68a", "#fb923c", "#ffffff"],
      emojis: ["🌕", "🥜", "🔥", "✨"],
      emojiRatio: 0.55,
      count: 14,
      sound: "chime"
    });
  if (has("초복", "중복", "말복"))
    return t("bok", {
      palette: ["#f59e0b", "#ef4444", "#22c55e", "#fde68a"],
      emojis: ["🍗", "🔥", "💦", "🍉", "🥵"],
      emojiRatio: 0.6,
      count: 16,
      sound: "pop"
    });
  if (has("발렌타인", "화이트데이"))
    return t("love", {
      shape: "rise",
      palette: ["#f43f5e", "#fb7185", "#fecdd3", "#ffffff", "#be185d"],
      emojis: ["💝", "💕", "🍫", "🍬", "💌"],
      emojiRatio: 0.6,
      count: 18,
      sound: "sparkle"
    });
  if (has("빼빼로"))
    return t("pepero", {
      palette: ["#7c4a2d", "#f5c542", "#f472b6", "#ffffff"],
      emojis: ["🍫", "🥢", "💝", "✨"],
      emojiRatio: 0.55,
      count: 16,
      sound: "sparkle"
    });
  if (has("만우절"))
    return t("aprilfools", {
      palette: ["#ef4444", "#f59e0b", "#facc15", "#22c55e", "#3b82f6", "#a855f7"],
      emojis: ["🤡", "😜", "🃏", "❓", "🙃"],
      emojiRatio: 0.55,
      count: 18,
      sound: "spooky"
    });
  if (has("어린이날"))
    return t("children", {
      shape: "rise",
      palette: ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#c084fc"],
      emojis: ["🎈", "🧸", "🪁", "🍭", "🎠"],
      emojiRatio: 0.6,
      count: 18,
      sound: "sparkle"
    });
  if (has("어버이날"))
    return t("parents", {
      shape: "rise",
      palette: ["#e11d48", "#fb7185", "#16a34a", "#ffffff"],
      emojis: ["🌹", "💐", "❤️"],
      emojiRatio: 0.6,
      count: 14,
      sound: "chime"
    });
  if (has("스승의 날"))
    return t("teachers", {
      palette: ["#ef4444", "#16a34a", "#f5c542", "#ffffff"],
      emojis: ["🍎", "📚", "💐", "✏️"],
      emojiRatio: 0.55,
      count: 14,
      sound: "chime"
    });
  if (has("현충일"))
    return t("memorial", {
      shape: "calm",
      palette: ["#cbd5e1", "#e2e8f0", "#ffffff", "#94a3b8"],
      emojis: ["🕊️", "🌼"],
      emojiRatio: 0.4,
      count: 10,
      sound: "soft"
    });
  if (has("한글날"))
    return t("hangul", {
      palette: ["#1d4ed8", "#0f172a", "#dc2626", "#f5c542"],
      emojis: ["ㄱ", "ㄴ", "ㅎ", "가", "한", "글"],
      emojiRatio: 0.7,
      count: 18,
      sound: "chime"
    });
  if (has("개천절"))
    return t("gaecheon", {
      shape: "rise",
      palette: ["#60a5fa", "#f5c542", "#ffffff", "#dc2626", "#1d4ed8"],
      emojis: ["☀️", "⛰️", "🌄", "✨"],
      emojiRatio: 0.5,
      count: 16,
      sound: "chime"
    });
  if (has("삼일절", "광복절", "제헌절"))
    return t("national", {
      palette: ["#dc2626", "#1d4ed8", "#ffffff", "#0f172a"],
      emojis: ["🕊️", "🌸", "✨"],
      emojiRatio: 0.45,
      count: 16,
      sound: "chime"
    });
  if (has("부처님"))
    return t("buddha", {
      shape: "rise",
      palette: ["#f472b6", "#f5c542", "#fb923c", "#fde68a"],
      emojis: ["🪷", "🏮", "✨"],
      emojiRatio: 0.55,
      count: 14,
      sound: "chime"
    });
  if (has("식목일"))
    return t("arbor", {
      shape: "rise",
      palette: ["#16a34a", "#4ade80", "#a3e635", "#854d0e"],
      emojis: ["🌱", "🌳", "🍃"],
      emojiRatio: 0.55,
      count: 14,
      sound: "sparkle"
    });
  if (has("근로자"))
    return t("labor", {
      palette: ["#f59e0b", "#60a5fa", "#94a3b8", "#ffffff"],
      emojis: ["💪", "🛠️", "☕", "🛌"],
      emojiRatio: 0.55,
      count: 14,
      sound: "pop"
    });
  if (has("선거"))
    return t("election", {
      palette: ["#1d4ed8", "#94a3b8", "#ffffff", "#dc2626"],
      emojis: ["🗳️", "✅", "✨"],
      emojiRatio: 0.5,
      count: 12,
      sound: "pop"
    });
  if (has("대체공휴일", "임시공휴일"))
    return t("rest", {
      shape: "rise",
      palette: ["#93c5fd", "#c4b5fd", "#fde68a", "#ffffff"],
      emojis: ["😴", "🛋️", "☕", "💤"],
      emojiRatio: 0.55,
      count: 14,
      sound: "soft"
    });
  if (has("동지"))
    return t("dongji", {
      shape: "fall",
      palette: ["#7f1d1d", "#ffffff", "#e5f3ff", "#a16207"],
      emojis: ["🥣", "❄️", "🌙"],
      emojiRatio: 0.5,
      count: 14,
      sound: "bells"
    });
  if (has(...SPRING_TERMS))
    return t("spring", {
      shape: "fall",
      palette: ["#f9a8d4", "#fbcfe8", "#bbf7d0", "#ffffff"],
      emojis: ["🌸", "🌱", "🦋"],
      emojiRatio: 0.55,
      count: 16,
      sound: "sparkle"
    });
  if (has(...SUMMER_TERMS))
    return t("summer", {
      palette: ["#facc15", "#38bdf8", "#4ade80", "#ffffff"],
      emojis: ["☀️", "🌿", "🍉", "🌊"],
      emojiRatio: 0.5,
      count: 16,
      sound: "sparkle"
    });
  if (has(...AUTUMN_TERMS))
    return t("autumn", {
      shape: "fall",
      palette: ["#ea580c", "#f59e0b", "#b45309", "#facc15"],
      emojis: ["🍂", "🍁", "🌰"],
      emojiRatio: 0.6,
      count: 16,
      sound: "chime"
    });
  if (has(...WINTER_TERMS))
    return t("winter", {
      shape: "fall",
      palette: ["#e0f2fe", "#ffffff", "#bae6fd", "#cbd5e1"],
      emojis: ["❄️", "⛄"],
      emojiRatio: 0.55,
      count: 16,
      sound: "bells"
    });
  return BASE;
}
