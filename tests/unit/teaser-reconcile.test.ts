import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { reconcileTeaserReveal } from "@/lib/schedules/teaser-reconcile";
import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

const stub = (id: string, teaser = true): PublicScheduleEvent => ({
  id,
  startsAt: "2025-10-01T00:00:00+09:00",
  isAllDay: true,
  isTentative: false,
  publicTitle: teaser ? "" : "제목",
  status: "scheduled",
  visibilityScope: "public",
  category: "stream",
  tagIds: [],
  primaryTagIds: [],
  sortOrder: 0,
  teaser,
  teaserRevealAt: teaser ? "2025-10-01T11:00:00.000Z" : undefined
});

// 2026-08-05 실측: 낡은 공개 캐시가 이미 **지워진** 떡밥을 스냅샷에 남기면, 카드는 빈 흰 칸을
// 그리고 2초마다 서버에 실제 내용을 조른다. 서버는 그 id를 못 찾아 계속 빈 응답 → 영원히 빈 칸.
describe("reconcileTeaserReveal — 유령 떡밥 카드 탈출", () => {
  it("확인됐고 응답에 없으면 '없어진 일정'으로 표시한다", () => {
    const r = reconcileTeaserReveal(["a", "b"], { ok: true, events: [stub("a")] });
    expect(r.goneIds).toEqual(["b"]);
    expect(r.events).toHaveLength(1);
  });

  it("확인 실패(ok=false)면 아무것도 지우지 않는다 — 모르는 것과 없는 것은 다르다", () => {
    const r = reconcileTeaserReveal(["a", "b"], { ok: false, events: [] });
    expect(r.goneIds).toEqual([]);
  });

  it("응답 자체가 없어도(네트워크 실패) 지우지 않는다", () => {
    expect(reconcileTeaserReveal(["a"], null).goneIds).toEqual([]);
    expect(reconcileTeaserReveal(["a"], undefined).goneIds).toEqual([]);
  });

  it("전부 살아 있으면 지울 것이 없다(공개된 실제 DTO 포함)", () => {
    const r = reconcileTeaserReveal(["a", "b"], {
      ok: true,
      events: [stub("a"), stub("b", false)]
    });
    expect(r.goneIds).toEqual([]);
    expect(r.events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

const LOADER = fs.readFileSync(path.join(process.cwd(), "lib/schedules/public-loader.ts"), "utf8");
const POSTER = fs.readFileSync(
  path.join(process.cwd(), "components/poster/public-poster.tsx"),
  "utf8"
);

describe("서버는 '확인 실패'와 '없음'을 구분해서 답한다", () => {
  it("DB 미설정·캘린더 없음·쿼리 실패는 ok:false(빈 결과와 다르다)", () => {
    const fn = LOADER.slice(
      LOADER.indexOf("export async function loadRevealedEvents"),
      LOADER.indexOf("const loadPublicScheduleData")
    );
    expect(fn).toContain("if (!supabase) return { ok: false, events: [] }");
    expect(fn).toContain("if (!calendar) return { ok: false, events: [] }");
    expect(fn).toContain("if (!rows) return { ok: false, events: [] }");
    expect(fn).toContain("return { ok: true, events:");
    // 공개된 것만 거르는 필터가 다시 생기면 카운트다운 복귀가 막힌다(2026-08-04 회귀).
    expect(fn).not.toMatch(/\.filter\(\s*\(e\)\s*=>\s*!e\.teaser\s*\)/);
  });
});

describe("시청자 포스터는 '없어진 떡밥'을 그리지 않는다", () => {
  it("두 렌더 경로(달력 칸·모바일 아젠다) 모두에서 걸러낸다", () => {
    const guards = POSTER.match(/if \(goneTeaserIds\.has\(rawEvent\.id\)\) return null;/g) ?? [];
    expect(guards.length).toBe(2);
  });
  it("공개 요청 응답은 reconcile을 거쳐 처리된다(마운트 동기화 + 카운트다운 0)", () => {
    expect(POSTER).toContain("reconcileTeaserReveal(ids, result)");
    expect(POSTER).toContain("reconcileTeaserReveal([id], result)");
  });
});
