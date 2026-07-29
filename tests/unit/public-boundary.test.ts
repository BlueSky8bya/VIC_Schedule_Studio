import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// 공개 표면(공개 API 라우트 + 공개 로더)이 스튜디오/서비스롤/비공개 샘플을 import하지 않는지
// 소스에서 정적으로 검증한다. 규칙: .claude/rules/public-private-boundary.md.
// (첫 슬라이스 시점의 공개 트리 — 새 공개 route를 추가하면 이 목록에 넣는다.)
const publicSurfaceFiles = [
  "lib/schedules/public-loader.ts",
  "app/api/public/[calendarSlug]/events/route.ts",
  // (P2-PROTO-1: proposals 라우트 삭제 — 가짜 데이터 엔드포인트였다)
  "app/api/public/[calendarSlug]/broadcast/route.ts"
];

// import 문에서 등장하면 안 되는 모듈 지정자(주석은 무시하려고 import 라인만 검사).
const forbiddenImports = [
  "@/lib/schedules/sample-data", // 스튜디오 샘플(privateMeta·requests 포함)
  "@/lib/schedules/studio-loader", // 스튜디오 로더
  "@/lib/auth/admin" // service_role 클라이언트
];

function importLines(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line) || /\bfrom\s+["']/.test(line));
}

describe("public boundary — static imports", () => {
  for (const rel of publicSurfaceFiles) {
    it(`${rel} imports no studio/service-role modules`, () => {
      const source = readFileSync(join(repoRoot, rel), "utf8");
      const imports = importLines(source).join("\n");
      for (const forbidden of forbiddenImports) {
        expect(imports, `${rel} must not import ${forbidden}`).not.toContain(forbidden);
      }
    });
  }
});

// 공개 폴백 스케줄에 비공개 데이터가 새지 않는지(구조 검증). getPublicSchedule은 Supabase 미설정
// 테스트 환경에서 이 폴백을 그대로 돌려준다.
const forbiddenPrivateKeys = [
  "privateTitle",
  "privateMemo",
  "editorNote",
  "privateMeta",
  "requests",
  "variantGroups",
  "embargo",
  "owner_private",
  "receivedAt", // request payload 필드
  "triaged"
];

describe("public sample fallback — no private leak", () => {
  it("exposes only public-scope events (evt-007 embargo / evt-008 work excluded)", () => {
    const ids = samplePublicScheduleData.events.map((e) => e.id).sort();
    expect(ids).toEqual([
      "evt-001",
      "evt-002",
      "evt-003",
      "evt-004",
      "evt-005",
      "evt-006",
      "evt-tourn"
    ]);
    for (const e of samplePublicScheduleData.events) {
      expect(e.visibilityScope).toBe("public");
    }
  });

  it("only public stickers", () => {
    // (P2-PROTO-1: supportCampaigns payload 제거 — 검사 대상에서 삭제)
    expect(samplePublicScheduleData.stickers.every((s) => s.visiblePublicly)).toBe(true);
    // sticker-private(💖, visiblePublicly:false)는 폴백에 없다.
    expect(samplePublicScheduleData.stickers.some((s) => s.id === "sticker-private")).toBe(false);
  });

  it("getPublicSchedule('vic') carries no private keys", async () => {
    const schedule = await getPublicSchedule("vic");
    const payload = JSON.stringify(schedule);
    for (const key of forbiddenPrivateKeys) {
      expect(payload, `payload leaked ${key}`).not.toContain(key);
    }
    expect(schedule.events).toHaveLength(7);
  });

  it("unknown slug empties events but keeps public calendar shape", async () => {
    const schedule = await getPublicSchedule("nope");
    expect(schedule.events).toHaveLength(0);
    expect(schedule.calendar.slug).toBe("vic");
  });
});
