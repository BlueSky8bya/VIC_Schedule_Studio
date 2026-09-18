import { describe, expect, it } from "vitest";
import type { PublicSearchHit } from "@/lib/domain/schedule-types";
import {
  MAX_CHAPTERS_PER_VOD,
  findMatchRange,
  groupSearchHits,
  normalizeQuery,
  personalizeHits
} from "@/lib/search/group";

const ev = (over: Partial<PublicSearchHit>): PublicSearchHit => ({
  kind: "event",
  eventId: "e1",
  dateKey: "2026-03-14",
  startTime: "20:00",
  title: "젤다 야숲 엔딩 도전",
  snippet: "",
  score: 3,
  ...over
});
const vod = (over: Partial<PublicSearchHit>): PublicSearchHit => ({
  kind: "vod",
  titleNo: 100,
  dateKey: "2026-03-14",
  title: "젤다 엔딩 봤다",
  snippet: "",
  durationMs: 3600_000,
  score: 2.2,
  ...over
});
const ch = (sec: number, over: Partial<PublicSearchHit> = {}): PublicSearchHit => ({
  kind: "chapter",
  titleNo: 100,
  sec,
  dateKey: "2026-03-14",
  title: `젤다 챕터 ${sec}`,
  snippet: "젤다 엔딩 봤다",
  durationMs: 3600_000,
  score: 1.5,
  ...over
});

describe("검색 결과 묶기 — 날짜 → 일정·다시보기 → 챕터", () => {
  it("같은 날의 일정·다시보기·챕터가 한 묶음이고, 챕터는 다시보기 아래 시각순", () => {
    const g = groupSearchHits([ch(2530), ev({}), ch(200), vod({})]);
    expect(g).toHaveLength(1);
    expect(g[0].events).toHaveLength(1);
    expect(g[0].vods).toHaveLength(1);
    expect(g[0].vods[0].matched).toBe(true);
    expect(g[0].vods[0].chapters.map((c) => c.sec)).toEqual([200, 2530]);
    expect(g[0].score).toBe(3); // 묶음 점수 = 최댓값
  });

  it("다시보기 제목이 적중하지 않아도 챕터가 있으면 부모 카드가 생기고 제목은 챕터 행의 snippet에서 온다", () => {
    const g = groupSearchHits([ch(10)]);
    expect(g[0].vods[0].matched).toBe(false);
    expect(g[0].vods[0].title).toBe("젤다 엔딩 봤다");
    expect(g[0].vods[0].durationMs).toBe(3600_000);
  });

  it("묶음 순서는 점수 내림차순, 같으면 최신 날짜 우선", () => {
    const g = groupSearchHits([
      ev({ dateKey: "2025-01-01", score: 2 }),
      ev({ dateKey: "2026-01-01", score: 2 }),
      ev({ dateKey: "2024-01-01", score: 5 })
    ]);
    expect(g.map((d) => d.dateKey)).toEqual(["2024-01-01", "2026-01-01", "2025-01-01"]);
  });

  it("한 다시보기의 챕터는 상위 N개만 남기고 나머지는 개수로 접는다", () => {
    const hits = Array.from({ length: MAX_CHAPTERS_PER_VOD + 4 }, (_, i) =>
      ch(i * 100, { score: 1 + i * 0.01 })
    );
    const v = groupSearchHits(hits)[0].vods[0];
    expect(v.chapters).toHaveLength(MAX_CHAPTERS_PER_VOD);
    expect(v.chapterOverflow).toBe(4);
    // 점수 낮은(앞쪽 sec) 것이 잘려 나갔고 남은 것은 시각순
    expect(v.chapters[0].sec).toBe(400);
    const secs = v.chapters.map((c) => c.sec);
    expect(secs).toEqual([...secs].sort((a, b) => a - b));
  });

  it("개인화: 내가 ♥ 누른 일정만 +0.3, 서버 응답 객체는 바꾸지 않는다", () => {
    const src = [ev({ eventId: "mine" }), ev({ eventId: "other" }), vod({})];
    const out = personalizeHits(src, new Set(["mine"]));
    expect(out[0].score).toBeCloseTo(3.3);
    expect(out[1].score).toBe(3);
    expect(out[2].score).toBe(2.2);
    expect(src[0].score).toBe(3);
    expect(personalizeHits(src, new Set())).toBe(src);
  });
});

describe("검색어 정규화·하이라이트 구간 — 서버 search_norm과 같은 규칙", () => {
  it("소문자 + 공백·기호 제거", () => {
    expect(normalizeQuery("야 숲!")).toBe("야숲");
    expect(normalizeQuery("Zelda  BotW")).toBe("zeldabotw");
  });

  it("원문의 공백·기호를 건너뛰며 구간을 찾는다", () => {
    expect(findMatchRange("젤다의 전설: 야 숲 엔딩", "야숲")).toEqual([8, 11]);
    expect(findMatchRange("[마인크래프트 왁피스] 빅토리 시점!", "왁피스")).toEqual([8, 11]);
    expect(findMatchRange("엔딩멘트", "노래")).toBeNull();
    expect(findMatchRange("엔딩", "")).toBeNull();
  });
});
