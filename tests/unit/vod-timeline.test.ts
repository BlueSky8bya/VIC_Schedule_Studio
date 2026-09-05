import { describe, expect, it } from "vitest";
import { parseTimeline, pickTimelineComment } from "@/lib/broadcast/vod-timeline";
// 백필/재수집 스크립트가 쓰는 거울 구현 — 아래 "거울 동치" 테스트가 두 구현을 붙잡아 둔다.
import {
  parseTimeline as parseTimelineMirror,
  pickTimelineComment as pickTimelineCommentMirror
} from "../../scripts/lib/timeline-parse.mjs";

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
  it("숲 API의 HTML 이스케이프를 푼다 — 이중 이스케이프 포함(2026-09-01 prod 실측)", () => {
    const entries = parseTimeline(
      "00:01:00 ILLIT - It&#039;s Me\n00:02:00 빙밍&amp;amp;추사랑\n00:03:00 비명 -&amp;gt; 동가리\n00:04:00 &quot;가난하게 컸어?&quot; 챌린지"
    );
    expect(entries.map((e) => e.label)).toEqual([
      "ILLIT - It's Me",
      "빙밍&추사랑",
      "비명 -> 동가리",
      '"가난하게 컸어?" 챌린지'
    ]);
  });
});

// 2026-09-06 실측 표본 — 시각을 대괄호로 감싸고 세부 항목을 "ㄴ"로 매다는 팬 포맷.
// 이 포맷은 **댓글 통째로** 버려지고 있었다(항목 0개 → "타임라인 없음").
const BRACKET_SAMPLE = `[ 02:10:55 ] ✨토리님 굿즈 소개 PPT 시작✨
ㄴ[ 02:13:59 ] 목록
ㄴ[ 02:15:22 ] 빵떡 쿠션

[  빅이봤  ]
[ 03:06:31 ] 진짜 진짜 사랑하는 한국인
[ 03:13:00 ] [직캠 댓글모음]천년돌 아이로 직캠 4K 'PLUG ON'
[ 03:56:21 ] 왁굳님의 서운한 행동 범위표
ㄴ[ 03:57:22 ] 토리님의 경우
ㄴㄴ[ 04:40:02 ] 남/여사친 허용 범위`;

describe("parseTimeline — 괄호 시각·ㄴ 계층(2026-09-06)", () => {
  const entries = parseTimeline(BRACKET_SAMPLE);
  it("대괄호로 감싼 시각도 항목으로 읽는다", () => {
    expect(entries).toHaveLength(8);
    expect(entries[0]).toEqual({ sec: 7855, label: "✨토리님 굿즈 소개 PPT 시작✨", section: null });
  });
  it("ㄴ는 라벨에서 떼어 depth로 옮긴다(중첩은 개수만큼)", () => {
    expect(entries[1]).toEqual({ sec: 8039, label: "목록", section: null, depth: 1 });
    expect(entries.at(-1)).toEqual({
      sec: 16802,
      label: "남/여사친 허용 범위",
      section: "빅이봤",
      depth: 2
    });
  });
  it("최상위 항목은 depth를 담지 않는다(jsonb 절약)", () => {
    expect(entries[0].depth).toBeUndefined();
  });
  it("라벨 속 대괄호는 그대로 둔다", () => {
    expect(entries[4].label).toBe("[직캠 댓글모음]천년돌 아이로 직캠 4K 'PLUG ON'");
  });
  it("코너 헤더는 계속 코너로 읽고, 시각뿐인 괄호 줄은 코너가 되지 않는다", () => {
    expect(entries[4].section).toBe("빅이봤");
    expect(parseTimeline("[ 02:10:55 ]\n00:01:00 가\n00:02:00 나\n00:03:00 다")[0].section).toBeNull();
  });
  it("소괄호 표기와 시각 뒤 ㄴ 표기도 같은 뜻", () => {
    expect(parseTimeline("(02:15) 인사")[0]).toEqual({ sec: 135, label: "인사", section: null });
    expect(parseTimeline("00:15:00 ㄴ 세부")[0]).toEqual({
      sec: 900,
      label: "세부",
      section: null,
      depth: 1
    });
  });
  it("불릿 뒤 공백을 요구해 '-20도' 같은 라벨을 갉아먹지 않는다", () => {
    expect(parseTimeline("00:01:00 -20도 실화냐")[0].label).toBe("-20도 실화냐");
    expect(parseTimeline("- 00:01:00 인사")[0]).toEqual({ sec: 60, label: "인사", section: null });
  });
  it("본문 속 시각(붙어 있는 글자)은 항목이 아니다", () => {
    expect(parseTimeline("12:34분에 시작함")).toEqual([]);
  });
});

// VOD 385편 댓글 전수조사(2026-09-06)에서 나온 나머지 표기들. 각 케이스 뒤 숫자는 실측 줄 수.
describe("parseTimeline — 전수조사로 넓힌 표기(2026-09-06)", () => {
  it("시각과 라벨이 붙어 있어도 항목이다(13줄)", () => {
    expect(parseTimeline("01:18:00토리님 복귀")[0]).toEqual({
      sec: 4680,
      label: "토리님 복귀",
      section: null
    });
    expect(parseTimeline("ㄴ04:02:54🧈로봇 버터우스님")[0]).toEqual({
      sec: 14574,
      label: "🧈로봇 버터우스님",
      section: null,
      depth: 1
    });
  });
  it("시각 뒤 구분 콜론은 라벨이 아니다", () => {
    expect(parseTimeline("02:29:49:✨:오늘이 금요일이었다면~")[0].label).toBe(
      "✨:오늘이 금요일이었다면~"
    );
  });
  it("분·초 한 자리 오타도 읽는다(1줄)", () => {
    expect(parseTimeline("00:7:30 귤 노가리")[0]).toEqual({ sec: 450, label: "귤 노가리", section: null });
  });
  it("초가 60을 넘으면 시각이 아니다", () => {
    expect(parseTimeline("1:75 뭔가")).toEqual([]);
  });
  it("라벨이 앞·시각이 뒤인 표기(10줄) — 시각이 여럿이면 항목도 여럿", () => {
    expect(parseTimeline("발로란트 01:23:25")[0]).toEqual({ sec: 5005, label: "발로란트", section: null });
    expect(parseTimeline("[🌺무꽃피] 54:30")[0]).toEqual({ sec: 3270, label: "무꽃피", section: null });
    expect(parseTimeline("롤 23:05  01:45:20 03:35:20").map((e) => e.sec)).toEqual([1385, 6320, 12920]);
  });
  it("라벨 없는 시각 나열은 항목이 아니다(클립 표시 76줄)", () => {
    expect(parseTimeline("4:40:04*\n4:41:28*\n4:42:09*")).toEqual([]);
    expect(parseTimeline("[06:41:21]")).toEqual([]);
  });
  it("날짜 표기와 긴 문장 뒤 시각은 항목이 아니다", () => {
    expect(parseTimeline("[ 26.06.02 ] 🔨쵸로키 타임라인")).toEqual([]);
    expect(
      parseTimeline("ㄴ 릴파님이 토리님 만난 다시보기 시점 '릴파님' 3월13일 다시보기 01:42:47")
    ).toEqual([]);
  });
});

// 스크립트 거울(scripts/lib/timeline-parse.mjs)이 lib의 규칙과 어긋나면 백필이 다른 결과를 쓴다.
describe("거울 동치 — lib 파서 == 스크립트 파서", () => {
  it("같은 표본에 같은 결과", () => {
    for (const sample of [SAMPLE, BRACKET_SAMPLE, "/쓰담//쓰담/", "12:34분에 시작함"]) {
      expect(parseTimelineMirror(sample)).toEqual(parseTimeline(sample));
    }
    const comments = [
      { p_comment_no: 1, user_nick: "짧은댓글", comment: "00:01:00 하나" },
      { p_comment_no: 2, user_nick: "리야-", comment: BRACKET_SAMPLE }
    ];
    expect(pickTimelineCommentMirror(comments)).toEqual(pickTimelineComment(comments));
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
