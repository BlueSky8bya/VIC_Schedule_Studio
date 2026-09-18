import type { PublicSearchHit } from "@/lib/domain/schedule-types";

// 검색 결과를 화면 구조로 — 날짜 묶음 안에 일정·다시보기, 다시보기 아래에 챕터(들여쓰기).
// 서버는 적중 행만 주고(순위는 서버가 냄), 묶는 일은 여기서만 한다(시청자·미리보기·비로그인 공용).
//
// 규칙(계획서 §3·§5):
//   · 묶음 점수 = 안의 최댓값. 묶음 순서 = 점수 desc, 같으면 최신 날짜 우선.
//   · 같은 다시보기의 챕터는 그 다시보기 아래 시각순. 다시보기 제목 자체가 적중이 아니어도
//     챕터가 있으면 '부모 카드'를 만든다(챕터 행이 snippet에 다시보기 제목을 들고 온다).
//   · 한 다시보기당 챕터는 최대 MAX_CHAPTERS — 같은 라벨("엔딩멘트")이 수십 번 붙는 방송이 있다.
export const MAX_CHAPTERS_PER_VOD = 6;

export type SearchVodGroup = {
  titleNo: number;
  title: string;
  durationMs: number;
  hostNick?: string;
  matched: boolean; // 다시보기 제목 자체가 적중했는가(아니면 챕터만)
  score: number;
  chapters: { sec: number; label: string; score: number; section: string; parent: string; matchedOn: string }[];
  chapterOverflow: number; // 잘라낸 챕터 수
};

export type SearchDayGroup = {
  dateKey: string;
  score: number;
  exact: boolean; // 안에 정확 적중이 하나라도 있는가(없으면 '비슷한 결과' 구역으로)
  popularity: number; // 안의 최댓값(0~1) — '인기순'
  events: PublicSearchHit[]; // kind=event만
  vods: SearchVodGroup[];
};

// 정렬(2026-09-18 소유자): 관련도(기본) · 최신 · 오래된 · 인기. 묶음 단위로만 다시 세우고, 묶음 안
// (일정 → 다시보기 → 챕터 시각순)은 그대로 — 안까지 뒤집으면 방송 흐름이 깨진다.
// '비슷한 결과'(exact=false) 묶음은 어느 정렬에서도 정확 적중 뒤에 온다.
export type SearchSort = "relevance" | "newest" | "oldest" | "popular";
export const SEARCH_SORTS: { key: SearchSort; label: string; hint: string }[] = [
  { key: "relevance", label: "관련도", hint: "검색어와 가장 잘 맞는 순 + 최신 가산" },
  { key: "newest", label: "최신", hint: "가까운 날짜부터" },
  { key: "oldest", label: "오래된", hint: "먼 날짜부터" },
  { key: "popular", label: "인기", hint: "조회·좋아요·댓글·하트가 많은 순" }
];

export function sortSearchGroups(groups: SearchDayGroup[], sort: SearchSort): SearchDayGroup[] {
  const out = [...groups];
  const byExact = (a: SearchDayGroup, b: SearchDayGroup) => Number(b.exact) - Number(a.exact);
  switch (sort) {
    case "newest":
      out.sort((a, b) => byExact(a, b) || b.dateKey.localeCompare(a.dateKey));
      break;
    case "oldest":
      out.sort((a, b) => byExact(a, b) || a.dateKey.localeCompare(b.dateKey));
      break;
    case "popular":
      out.sort((a, b) => byExact(a, b) || b.popularity - a.popularity || b.score - a.score);
      break;
    default:
      out.sort((a, b) => byExact(a, b) || b.score - a.score || b.dateKey.localeCompare(a.dateKey));
  }
  return out;
}

export function groupSearchHits(hits: PublicSearchHit[]): SearchDayGroup[] {
  const days = new Map<string, SearchDayGroup>();
  const dayOf = (dateKey: string): SearchDayGroup => {
    let d = days.get(dateKey);
    if (!d) {
      d = { dateKey, score: 0, exact: false, popularity: 0, events: [], vods: [] };
      days.set(dateKey, d);
    }
    return d;
  };
  const vodOf = (day: SearchDayGroup, hit: PublicSearchHit): SearchVodGroup => {
    const titleNo = hit.titleNo ?? 0;
    let v = day.vods.find((x) => x.titleNo === titleNo);
    if (!v) {
      v = {
        titleNo,
        // 챕터 행은 snippet에 다시보기 제목을 싣는다(RPC 계약).
        title: hit.kind === "vod" ? hit.title : hit.snippet,
        durationMs: hit.durationMs ?? 0,
        hostNick: hit.hostNick,
        matched: false,
        score: 0,
        chapters: [],
        chapterOverflow: 0
      };
      day.vods.push(v);
    }
    return v;
  };

  for (const hit of hits) {
    if (!hit.dateKey) continue;
    const day = dayOf(hit.dateKey);
    day.score = Math.max(day.score, hit.score);
    day.popularity = Math.max(day.popularity, hit.popularity ?? 0);
    if (hit.exact) day.exact = true;
    if (hit.kind === "event") {
      day.events.push(hit);
      continue;
    }
    const v = vodOf(day, hit);
    v.score = Math.max(v.score, hit.score);
    if (hit.kind === "vod") {
      v.matched = true;
      v.title = hit.title;
      v.durationMs = hit.durationMs ?? v.durationMs;
      continue;
    }
    if (typeof hit.sec === "number") {
      v.chapters.push({
        sec: hit.sec,
        label: hit.title,
        score: hit.score,
        section: hit.section ?? "",
        parent: hit.parent ?? "",
        matchedOn: hit.matchedOn ?? ""
      });
    }
  }

  const out = [...days.values()];
  for (const day of out) {
    day.events.sort((a, b) => b.score - a.score || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    for (const v of day.vods) {
      // 점수 상위 N개만 남기고 시각순으로 보여준다(방송 흐름대로 읽힌다).
      v.chapters.sort((a, b) => b.score - a.score);
      if (v.chapters.length > MAX_CHAPTERS_PER_VOD) {
        v.chapterOverflow = v.chapters.length - MAX_CHAPTERS_PER_VOD;
        v.chapters = v.chapters.slice(0, MAX_CHAPTERS_PER_VOD);
      }
      v.chapters.sort((a, b) => a.sec - b.sec);
    }
    day.vods.sort((a, b) => b.score - a.score);
  }
  // 정확 적중 묶음이 먼저, 그 다음 '비슷한 결과'(유사도만) — 서버 정렬(exact desc)과 같은 원칙.
  out.sort(
    (a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || b.dateKey.localeCompare(a.dateKey)
  );
  return out;
}

// 개인화 가산(클라이언트 전용 — 서버 응답은 익명 동일해야 CDN 캐시가 안전하다).
// 로그인 시청자가 ♥ 누른 일정 +0.3. 계획서 §3 "개인화" 행.
export function personalizeHits(
  hits: PublicSearchHit[],
  myHeartIds: ReadonlySet<string>
): PublicSearchHit[] {
  if (myHeartIds.size === 0) return hits;
  return hits.map((h) =>
    h.kind === "event" && h.eventId && myHeartIds.has(h.eventId) ? { ...h, score: h.score + 0.3 } : h
  );
}

// 검색어 정규화 — 서버 search_norm과 같은 규칙(소문자 + 공백·기호 제거). 하이라이트에 쓴다.
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

// 원문에서 검색어가 차지하는 구간(원문 인덱스, [시작, 끝)) — 공백·기호를 건너뛰며 정규화
// 매칭한다. 없으면 null. 첫 적중 한 구간만. 화면은 그 구간을 <mark>로 감싼다.
export function findMatchRange(text: string, q: string): [number, number] | null {
  const qn = normalizeQuery(q);
  if (qn.length < 1) return null;
  const map: number[] = []; // 정규화 글자 i → 원문 인덱스
  let norm = "";
  for (let i = 0; i < text.length; i += 1) {
    const n = normalizeQuery(text[i]);
    if (n.length === 0) continue;
    norm += n;
    for (let k = 0; k < n.length; k += 1) map.push(i);
  }
  const at = norm.indexOf(qn);
  if (at < 0) return null;
  return [map[at], map[at + qn.length - 1] + 1];
}
