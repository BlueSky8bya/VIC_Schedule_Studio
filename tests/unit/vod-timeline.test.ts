import { describe, expect, it } from "vitest";
import { parseTimeline, pickTimelineComment } from "@/lib/broadcast/vod-timeline";

// 팬 타임라인 파서(0071) — 실측 포맷 그대로를 고정한다(2026-08-31 크롤 표본 기반):
// "✨타임라인✨" 장식 줄, "[💬:소통]" / "[  게 임  ] - FC26" 코너 헤더, "HH:MM:SS 라벨" 항목.

const SAMPLE = `✨타임라인✨

00:10:53 토리님 등장

[💬:소통]
00:11:40 토리님의 쓸모 없는 고충
00:14:10 ✨:고카상사는 재밌게 보셨나요?

[  게 임  ] - FC26
00:24:49 게임 시작
00:27:31 1경기
1:00:48 3경기`;

describe("parseTimeline", () => {
  const entries = parseTimeline(SAMPLE);
  it("장식 줄은 버리고 타임스탬프 줄만 초 단위로 파싱한다", () => {
    expect(entries).toHaveLength(6);
    expect(entries[0]).toEqual({ sec: 653, label: "토리님 등장", section: null });
    expect(entries[5]).toEqual({ sec: 3648, label: "3경기", section: "게임 - FC26" });
  });
  it("코너 헤더는 이모지·콜론·벌린 공백을 정리해 이후 항목에 붙는다", () => {
    expect(entries[1].section).toBe("소통");
    expect(entries[3].section).toBe("게임 - FC26");
  });
  it("MM:SS(시 없음)도 읽는다", () => {
    expect(parseTimeline("02:15 인사")[0]).toEqual({ sec: 135, label: "인사", section: null });
  });
  it("타임라인이 아닌 텍스트는 빈 배열", () => {
    expect(parseTimeline("/쓰담//쓰담/")).toEqual([]);
  });
});

describe("pickTimelineComment", () => {
  it("타임스탬프가 가장 많은 댓글을 고르고, 3개 미만은 무시한다", () => {
    const picked = pickTimelineComment([
      { p_comment_no: 1, user_nick: "짧은댓글", comment: "00:01:00 하나\n00:02:00 둘" },
      { p_comment_no: 2, user_nick: "리야-", comment: SAMPLE },
      { p_comment_no: 3, user_nick: "잡담", comment: "재밌었어요!" }
    ]);
    expect(picked?.nick).toBe("리야-");
    expect(picked?.commentNo).toBe(2);
    expect(picked?.entries).toHaveLength(6);
  });
  it("타임라인 댓글이 없으면 null", () => {
    expect(pickTimelineComment([{ comment: "굿" }])).toBeNull();
  });
});
