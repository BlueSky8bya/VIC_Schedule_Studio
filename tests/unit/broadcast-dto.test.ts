import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { PublicSchedule } from "@/lib/domain/schedule-types";
import { toBroadcastPanelDays } from "@/lib/schedules/broadcast-dto";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// ── 픽스처: '적대적' 스냅샷 — 잘못된 소스가 물렸을 때조차 새면 안 되는 canary를 심는다 ──
// (실서비스 입력은 public-loader 결과라 이런 필드가 없지만, 유출 테스트는 최악을 가정한다.)
const CANARY = {
  privateTitle: "CANARY_PRIVATE_TITLE_9f1",
  privateMemo: "CANARY_PRIVATE_MEMO_9f2",
  editorNote: "CANARY_EDITOR_NOTE_9f3",
  requestPayload: "CANARY_REQUEST_9f4",
  workTitle: "CANARY_WORK_TITLE_9f5",
  embargoTitle: "CANARY_EMBARGO_TITLE_9f6",
  legacyEmbargoTitle: "CANARY_LEGACY_EMBARGO_9f6b",
  draftTitle: "CANARY_DRAFT_TITLE_9f7",
  teaserRealTitle: "CANARY_TEASER_REAL_9f8",
  teaserRealDesc: "CANARY_TEASER_DESC_9f9"
} as const;

function hostileSnapshot(): PublicSchedule {
  const tags = [
    {
      id: "tag-game",
      tagKey: "game",
      displayName: "게임",
      colorKey: "coral",
      bgHex: null,
      sortOrder: 0,
      isDefault: false,
      isActive: true,
      parentId: null,
      kind: "content"
    },
    {
      id: "tag-talk",
      tagKey: "talk",
      displayName: "소통",
      colorKey: "lemon",
      bgHex: "#ffe28a",
      sortOrder: 1,
      isDefault: false,
      isActive: true,
      parentId: null,
      kind: "content"
    }
  ];
  const palette = [
    { key: "coral", label: "코랄", bgColor: "#f9a8a8", borderColor: "#ef8484", textColor: "#7f1d1d" },
    { key: "lemon", label: "레몬", bgColor: "#fde68a", borderColor: "#fcd34d", textColor: "#78350f" }
  ];
  const events = [
    {
      // 정상 공개 멀티데이(7/3~7/5) + 스튜디오 전용 canary 필드가 '섞여 들어온' 최악 케이스
      id: "evt-pub-multi",
      startsAt: "2026-07-03T20:00:00+09:00",
      endsAt: "2026-07-03T23:00:00+09:00",
      endDateKey: "2026-07-05",
      isAllDay: false,
      publicTitle: "메이플 종일방\n280 스토리\n에픽던전",
      publicDescription: "사흘 연속",
      status: "confirmed",
      visibilityScope: "public",
      category: "game",
      tagIds: ["tag-game", "tag-talk"],
      primaryTagIds: ["tag-game"],
      sortOrder: 0,
      heartCount: 42,
      isSupport: false,
      supportUrl: "https://example.com/should-not-pass",
      linkNext: "evt-should-not-pass",
      variantGroupId: "vg-1",
      variantLabel: "A안",
      privateMeta: {
        eventId: "evt-pub-multi",
        privateTitle: CANARY.privateTitle,
        privateMemo: CANARY.privateMemo,
        editorNote: CANARY.editorNote
      },
      requestPayload: CANARY.requestPayload
    },
    {
      // 서버가 이미 가린 teaser stub(공개 전) — 제목·태그·기간이 '비어서' 온다. 이대로 통과해야 함.
      id: "evt-teaser-stub",
      startsAt: "2026-07-04T18:00:00+09:00",
      isAllDay: true,
      publicTitle: "",
      status: "confirmed",
      visibilityScope: "public",
      category: "etc",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 1,
      teaser: true,
      teaserRevealAt: "2026-07-10T12:00:00.000Z"
    },
    {
      // 비공개(작업자) — 잘못 섞여 들어와도 절대 통과 금지
      id: "evt-work",
      startsAt: "2026-07-04T10:00:00+09:00",
      isAllDay: true,
      publicTitle: CANARY.workTitle,
      status: "confirmed",
      visibilityScope: "work",
      category: "etc",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 2
    },
    {
      // 비공개(엠바고/owner_private)
      id: "evt-embargo",
      startsAt: "2026-07-05T10:00:00+09:00",
      isAllDay: true,
      publicTitle: CANARY.embargoTitle,
      status: "confirmed",
      visibilityScope: "owner_private",
      category: "etc",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 3
    },
    {
      // draft — 공개 범위여도 통과 금지
      id: "evt-draft",
      startsAt: "2026-07-04T09:00:00+09:00",
      isAllDay: true,
      publicTitle: CANARY.draftTitle,
      status: "draft",
      visibilityScope: "public",
      category: "etc",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 4
    },
    {
      // 레거시 "embargo" scope 문자열이 남아 들어온 최악 케이스 — exact-public 필터가 걸러야 함
      id: "evt-embargo-legacy",
      startsAt: "2026-07-05T11:00:00+09:00",
      isAllDay: true,
      publicTitle: CANARY.legacyEmbargoTitle,
      status: "confirmed",
      visibilityScope: "embargo",
      category: "etc",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 6
    },
    {
      // ★ 소스 계약 위반 최악 케이스: teaser=true인데 서버 stub이 아니라 '실제 내용'을 실은 채
      // 들어옴(낙관적 studio events를 잘못 물린 상황). DTO가 fail-closed로 stub 형태로
      // 강제 마스킹해야 한다 — 제목·설명·태그·기간·시간·카테고리 전부.
      id: "evt-teaser-unredacted",
      startsAt: "2026-07-04T21:30:00+09:00",
      endsAt: "2026-07-04T23:00:00+09:00",
      endDateKey: "2026-07-05",
      isAllDay: false,
      isTentative: true,
      publicTitle: CANARY.teaserRealTitle,
      publicDescription: CANARY.teaserRealDesc,
      status: "confirmed",
      visibilityScope: "public",
      category: "game",
      tagIds: ["tag-game"],
      primaryTagIds: ["tag-game"],
      sortOrder: 7,
      teaser: true,
      teaserRevealAt: "2026-08-01T12:00:00.000Z"
    },
    {
      // 업 도움(isSupport) 배너 — 날짜 카드 비교엔 소음이라 제외 규칙 검증용
      id: "evt-support",
      startsAt: "2026-07-03T00:00:00+09:00",
      endDateKey: "2026-07-05",
      isAllDay: true,
      publicTitle: "업 도움 기간",
      status: "confirmed",
      visibilityScope: "public",
      category: "etc",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 5,
      isSupport: true
    }
  ];
  return {
    calendar: {},
    events,
    tags,
    palette,
    supportCampaigns: [],
    stickers: [],
    stickerAssets: [],
    heartCount: 7
  } as unknown as PublicSchedule;
}

// ── 화이트리스트: 명시 구성이므로 키 집합이 결정적이다(optional도 undefined로 항상 존재) ──
const DAY_KEYS = ["dateKey", "events"].sort();
const EVENT_KEYS = [
  "id",
  "publicTitle",
  "publicDescription",
  "startsAt",
  "endsAt",
  "endDateKey",
  "isAllDay",
  "isTentative",
  "category",
  "sortOrder",
  "tags",
  "teaser",
  "teaserRevealAt",
  "dayIndex",
  "dayTotal"
].sort();
const TAG_KEYS = ["id", "label", "colorHex", "isPrimary"].sort();

describe("broadcast-dto — 유출 방지(화이트리스트·canary·비공개 부재)", () => {
  const days = toBroadcastPanelDays(hostileSnapshot(), [
    "2026-07-05",
    "2026-07-03",
    "2026-07-04",
    "2026-07-04" // 중복 — dedup 검증
  ]);

  it("모든 계층의 키가 화이트리스트와 '정확히' 일치한다(초과 필드 0)", () => {
    expect(days.length).toBeGreaterThan(0);
    for (const day of days) {
      expect(Object.keys(day).sort()).toEqual(DAY_KEYS);
      for (const ev of day.events) {
        expect(Object.keys(ev).sort()).toEqual(EVENT_KEYS);
        for (const tag of ev.tags) {
          expect(Object.keys(tag).sort()).toEqual(TAG_KEYS);
        }
      }
    }
  });

  it("canary 문자열이 직렬화 결과 어디에도 없다", () => {
    const payload = JSON.stringify(days);
    for (const [name, canary] of Object.entries(CANARY)) {
      expect(payload, `leaked via ${name}`).not.toContain(canary);
    }
  });

  it("스튜디오 전용/제외 키가 직렬화 결과에 존재하지 않는다", () => {
    const payload = JSON.stringify(days);
    for (const key of [
      "privateMeta",
      "privateTitle",
      "privateMemo",
      "editorNote",
      "requestPayload",
      "visibilityScope",
      "status",
      "heartCount",
      "supportUrl",
      "linkNext",
      "variantGroupId",
      "variantLabel",
      "isSupport"
    ]) {
      expect(payload, `must not carry ${key}`).not.toContain(`"${key}"`);
    }
  });

  it("비공개(work·owner_private·레거시 embargo)·draft 이벤트는 어떤 날짜에도 없다", () => {
    const ids = days.flatMap((d) => d.events.map((e) => e.id));
    expect(ids).not.toContain("evt-work");
    expect(ids).not.toContain("evt-embargo");
    expect(ids).not.toContain("evt-embargo-legacy");
    expect(ids).not.toContain("evt-draft");
  });

  it("미공개 teaser stub은 '존재하되' 제목·설명·태그·기간·시간·카테고리 전부 비어 있다", () => {
    const day4 = days.find((d) => d.dateKey === "2026-07-04");
    const stub = day4?.events.find((e) => e.id === "evt-teaser-stub");
    expect(stub).toBeDefined();
    expect(stub?.teaser).toBe(true);
    expect(stub?.publicTitle).toBe("");
    expect(stub?.publicDescription).toBeUndefined();
    expect(stub?.tags).toEqual([]);
    expect(stub?.endsAt).toBeUndefined();
    expect(stub?.endDateKey).toBeUndefined();
    expect(stub?.dayIndex).toBeUndefined();
    expect(stub?.dayTotal).toBeUndefined();
    expect(stub?.isAllDay).toBe(true);
    expect(stub?.isTentative).toBeUndefined();
    expect(stub?.category).toBe("stream"); // 중립값 — 실제 카테고리 가림
    expect(stub?.startsAt).toBe("2026-07-04T00:00:00+09:00"); // 날짜만, 실제 시각 없음
  });

  it("fail-closed: 가리지 않은 teaser(소스 계약 위반)도 stub 형태로 강제 마스킹된다", () => {
    const day4 = days.find((d) => d.dateKey === "2026-07-04");
    const masked = day4?.events.find((e) => e.id === "evt-teaser-unredacted");
    expect(masked).toBeDefined();
    expect(masked?.teaser).toBe(true);
    expect(masked?.publicTitle).toBe("");
    expect(masked?.publicDescription).toBeUndefined();
    expect(masked?.tags).toEqual([]);
    expect(masked?.endsAt).toBeUndefined();
    expect(masked?.endDateKey).toBeUndefined(); // 실제 기간(7/5까지) 가림 → 7/5엔 안 나타남
    expect(masked?.isAllDay).toBe(true);
    expect(masked?.isTentative).toBeUndefined();
    expect(masked?.category).toBe("stream");
    expect(masked?.startsAt).toBe("2026-07-04T00:00:00+09:00"); // 21:30 실제 시각 가림
    expect(masked?.dayIndex).toBeUndefined();
    expect(masked?.dayTotal).toBeUndefined();
    // 기간이 가려졌으므로 7/5 카드에 이 이벤트가 번지지 않는다
    const day5 = days.find((d) => d.dateKey === "2026-07-05");
    expect(day5?.events.map((e) => e.id)).not.toContain("evt-teaser-unredacted");
  });

  it("업 도움(isSupport) 배너는 날짜 카드에서 제외된다", () => {
    const ids = days.flatMap((d) => d.events.map((e) => e.id));
    expect(ids).not.toContain("evt-support");
  });
});

describe("broadcast-dto — 배치·날짜 계약", () => {
  const days = toBroadcastPanelDays(hostileSnapshot(), [
    "2026-07-05",
    "2026-07-03",
    "2026-07-04",
    "2026-07-04"
  ]);

  it("dateKeys는 중복 제거 + 시간순 정렬로 나간다(떨어진 날짜도 항상 날짜순)", () => {
    expect(days.map((d) => d.dateKey)).toEqual(["2026-07-03", "2026-07-04", "2026-07-05"]);
  });

  it("멀티데이는 각 날짜에 n일차/총 m일로 실린다(KST date-key 산술 — 로컬 TZ 무관)", () => {
    const byDay = new Map(days.map((d) => [d.dateKey, d.events.find((e) => e.id === "evt-pub-multi")]));
    expect(byDay.get("2026-07-03")?.dayIndex).toBe(1);
    expect(byDay.get("2026-07-04")?.dayIndex).toBe(2);
    expect(byDay.get("2026-07-05")?.dayIndex).toBe(3);
    expect(byDay.get("2026-07-03")?.dayTotal).toBe(3);
  });

  it("태그는 색 해석 완료된 최소 정보로 내장된다(커스텀 bgHex 반영·primary 표시)", () => {
    const ev = days[0].events.find((e) => e.id === "evt-pub-multi");
    expect(ev?.tags.map((t) => t.label)).toEqual(["게임", "소통"]);
    expect(ev?.tags.find((t) => t.id === "tag-game")?.isPrimary).toBe(true);
    expect(ev?.tags.find((t) => t.id === "tag-talk")?.isPrimary).toBe(false);
    // 커스텀 색(bgHex)은 resolver 격리를 거쳐 반영된다 — 값 자체보다 '색이 나온다'가 계약.
    expect(ev?.tags.every((t) => typeof t.colorHex === "string" && t.colorHex.length > 0)).toBe(true);
  });
});

describe("broadcast-dto — 정적 import 경계", () => {
  it("broadcast-dto.ts는 studio-loader·서비스롤·스튜디오 샘플·낙관 경로를 import하지 않는다", () => {
    const source = readFileSync(join(repoRoot, "lib/schedules/broadcast-dto.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line) || /\bfrom\s+["']/.test(line))
      .join("\n");
    for (const forbidden of [
      "@/lib/schedules/studio-loader",
      "@/lib/schedules/sample-data",
      "@/lib/auth/admin",
      "@/components/studio/studio-shell"
    ]) {
      expect(imports, `must not import ${forbidden}`).not.toContain(forbidden);
    }
  });
});
