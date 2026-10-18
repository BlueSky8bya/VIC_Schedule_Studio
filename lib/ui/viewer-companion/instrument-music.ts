/** A finite, actually rendered calendar instrument onset. No date, song title,
 * schedule data or persistent listener state crosses this local event. */
export const COMPANION_INSTRUMENT_EVENT = "vic:companion-instrument";
import { companionInstrumentScoreBoundary, companionInstrumentScorePosition } from "./instrument-score";
export type CompanionInstrumentRhythm = Readonly<{ sequence: number; index: number; segment: number; onsetMs: number; gapMs: number; tapAt: number; audibleAt: number }>;
export type CompanionInstrumentPulse = Readonly<{ mood: "lively" | "graceful" | "calm"; bpm: number; at: number; durationMs: number; expectedGapMs: number; rhythm?: CompanionInstrumentRhythm; scoreKey?: string; scoreSegment?: number; scoreIndex?: number; phraseEnd?: boolean; scoreEnd?: boolean }>;
const CALM = new Set(["브람스 자장가", "고요한 밤", "그린슬리브스", "어메이징 그레이스", "석별의 정", "클레멘타인", "노를 저어라"]);
const GRACEFUL = new Set(["캐논", "결혼 행진곡", "엘리제를 위하여", "미뉴에트", "비발디 '봄'"]);
const TEMPO: Readonly<Record<string, number>> = { "브람스 자장가": 72, "고요한 밤": 72, "그린슬리브스": 80, "어메이징 그레이스": 80, "캐논": 80, "미뉴에트": 108, "비발디 '봄'": 120, "캉캉": 144, "엔터테이너": 120, "터키 행진곡": 132, "생일 축하합니다": 60000 / 270 };
/** Verified attacks follow this arrangement's score, including unequal note
 * lengths and rests. Unverified/automatic music carries mood only; its pace
 * hint never becomes a rhythm grade. No private calendar data is inferred. */
export function companionInstrumentPulse(title: string, at: number, durationMs = 500, performed?: { sequence: number; index: number }): CompanionInstrumentPulse {
  const actual = performed && Number.isSafeInteger(performed.sequence) && performed.sequence >= 0 ? performed : undefined;
  const score = actual && companionInstrumentScorePosition(title, actual.index);
  const boundary = actual && companionInstrumentScoreBoundary(title, actual.index);
  const bpm = score?.bpm ?? TEMPO[title] ?? 112;
  return { mood: CALM.has(title) ? "calm" : GRACEFUL.has(title) ? "graceful" : "lively", bpm, at, durationMs, expectedGapMs: score?.gapMs ?? 60000 / bpm, ...(score && performed ? { rhythm: { sequence: performed.sequence, index: performed.index, segment: score.segment, onsetMs: score.onsetMs, gapMs: score.gapMs, tapAt: at, audibleAt: at } } : {}), ...(boundary ? boundary : {}) };
}
