/** Local notation timing. The numbers are score facts, not a recorded
 * performance or an inferred regular-click rhythm. Unverified transitions
 * explicitly break grading; they never acquire an equal-interval fallback. */
export type CompanionInstrumentScore = Readonly<{ bpm: number; gaps: readonly (number | null)[] }>;
import { COMPANION_INSTRUMENT_SCORES } from "./instrument-score-data";

// Stable public score keys. Preserve these assignments when adding scores;
// neither a free-form title nor a performance/session identifier is emitted.
const SCORE_KEY_BY_TITLE: Readonly<Record<string, string>> = {
  "어메이징 그레이스": "score-01", "반짝반짝 작은 별": "score-02", "자크 형제": "score-03", "런던 다리": "score-04",
  "올드 맥도날드": "score-05", "노를 저어라": "score-06", "징글벨": "score-07", "양키 두들": "score-08",
  "오! 수재나": "score-09", "미뉴에트": "score-10", "클레멘타인": "score-11", "산왕의 궁전에서": "score-12",
  "석별의 정": "score-13", "결혼 행진곡": "score-14", "엔터테이너": "score-15", "비발디 '봄'": "score-16",
  "고요한 밤": "score-17", "그린슬리브스": "score-18", "캐논": "score-19", "떴다 떴다 비행기": "score-20",
  "엘리제를 위하여": "score-21", "터키 행진곡": "score-22", "브람스 자장가": "score-23", "아리랑": "score-24",
  "족제비 뿅": "score-25", "캉캉": "score-26", "환희의 송가": "score-27", "나비야": "score-28",
  "애국가": "score-29", "젓가락 행진곡": "score-30", "도레미 계단": "score-31", "생일 축하합니다": "score-32",
};

export function isCompanionInstrumentScoreKey(value: unknown): value is string {
  return typeof value === "string" && Object.entries(SCORE_KEY_BY_TITLE).some(([title, key]) => key === value && Object.hasOwn(COMPANION_INSTRUMENT_SCORES, title));
}

/** Three actually performed attacks form one exchange phrase. These are
 * authored interaction groups, not a claim about musical phrase analysis. */
export function companionInstrumentScoreBoundary(title: string, index: number) {
  if (!Object.hasOwn(SCORE_KEY_BY_TITLE, title) || !Object.hasOwn(COMPANION_INSTRUMENT_SCORES, title) || !Number.isSafeInteger(index) || index < 0) return;
  const score = COMPANION_INSTRUMENT_SCORES[title], local = index % score.gaps.length;
  const complete = score.gaps.every(gap => gap !== null);
  const scoreSegment = complete ? 0 : Math.floor(index / score.gaps.length) * (score.gaps.length + 1) + score.gaps.slice(0, local).filter(gap => gap === null).length;
  return { scoreKey: SCORE_KEY_BY_TITLE[title], scoreSegment, scoreIndex: index, phraseEnd: (local + 1) % 3 === 0 || local === score.gaps.length - 1, scoreEnd: local === score.gaps.length - 1 };
}

export function companionInstrumentScorePosition(title: string, index: number): { segment: number; onsetMs: number; gapMs: number; bpm: number } | undefined {
  const score: CompanionInstrumentScore | undefined = COMPANION_INSTRUMENT_SCORES[title];
  if (!score || !Number.isSafeInteger(index) || index < 0) return;
  const length = score.gaps.length, cycle = Math.floor(index / length), local = index % length;
  let segment = cycle * (length + 1), onset = 0;
  // Repeated complete verses share the same clock. In a partially verified
  // arrangement, each unknown transition starts a fresh finite segment.
  const complete = score.gaps.every(value => value !== null);
  if (complete) { segment = 0; onset = cycle * score.gaps.reduce<number>((sum, gap) => sum + gap!, 0); }
  for (let i = 0; i < local; i++) {
    const gap = score.gaps[i];
    if (gap === null) { segment++; onset = 0; } else onset += gap;
  }
  const gap = score.gaps[local];
  if (gap === null || !Number.isFinite(gap) || gap <= 0) return;
  return { segment, onsetMs: onset * 60000 / score.bpm, gapMs: gap * 60000 / score.bpm, bpm: score.bpm };
}
