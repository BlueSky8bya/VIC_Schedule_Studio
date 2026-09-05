// scripts/lib/timeline-parse.mjs의 타입 — 테스트(TS)에서 거울 구현을 불러 동치를 검사하기 위해서만
// 필요하다(tsconfig의 allowJs는 false 그대로 둔다).
export type MirrorTimelineEntry = {
  sec: number;
  label: string;
  section: string | null;
  depth?: number;
};

export function decodeHtmlEntities(text: string): string;
export function parseTimeline(text: string): MirrorTimelineEntry[];
export function pickTimelineComment(
  comments: { p_comment_no?: number; user_nick?: string; comment?: string }[]
): { nick: string; commentNo: number | null; entries: MirrorTimelineEntry[] } | null;
