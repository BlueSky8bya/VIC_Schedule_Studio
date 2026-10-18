/** A finite, actually rendered calendar instrument onset. No date, song title,
 * schedule data or persistent listener state crosses this local event. */
export const COMPANION_INSTRUMENT_EVENT = "vic:companion-instrument";
export type CompanionInstrumentPulse = Readonly<{ mood: "lively" | "graceful" | "calm"; bpm: number; at: number; durationMs: number; expectedGapMs: number }>;
const CALM = new Set(["브람스 자장가", "고요한 밤", "그린슬리브스", "어메이징 그레이스", "석별의 정", "클레멘타인", "노를 저어라"]);
const GRACEFUL = new Set(["캐논", "결혼 행진곡", "엘리제를 위하여", "미뉴에트", "비발디 '봄'"]);
const TEMPO: Readonly<Record<string, number>> = { "브람스 자장가": 72, "고요한 밤": 72, "그린슬리브스": 80, "어메이징 그레이스": 80, "캐논": 80, "미뉴에트": 108, "비발디 '봄'": 120, "캉캉": 144, "엔터테이너": 120, "터키 행진곡": 132, "생일 축하합니다": 60000 / 270 };
/** Calendar's one-note-per-tap arrangements use one expected beat per tap.
 * Birthday's authored beat is270ms. No inference from private calendar data. */
export function companionInstrumentPulse(title: string, at: number, durationMs = 500): CompanionInstrumentPulse {
  const bpm = TEMPO[title] ?? 112;
  return { mood: CALM.has(title) ? "calm" : GRACEFUL.has(title) ? "graceful" : "lively", bpm, at, durationMs, expectedGapMs: 60000 / bpm };
}
