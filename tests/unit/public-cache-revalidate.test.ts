import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_SCHEDULE_CACHE_TAG } from "@/lib/schedules/cache";

// 2026-08-05 실측 버그의 회귀 테스트.
//
// 일정 저장/삭제가 공개 캐시(unstable_cache, TTL 300초)를 무효화하지 않으면, 방금 만든 일정이
// 시청자 화면·편집실 미리보기에 최대 5분간 안 나오고, 지운 일정은 그 시간 동안 남는다.
// 지운 것이 '최초공개(떡밥)'였다면 서버가 그 id를 더 이상 못 찾아 카드가 빈 흰 칸으로 굳는다
// (새로고침·Ctrl+Shift+R도 같은 캐시를 받아 그대로).
// 실제 원인: 커밋 72f6971이 recordActivity를 넣으며 save/delete에서 revalidate 3줄을 지웠다.
//
// 그래서 이 테스트는 소스 문자열이 아니라 **액션을 실제로 실행해** revalidateTag 호출을 본다.

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
  unstable_cache: (fn: unknown) => fn
}));

// 권한·DB·행동기록은 이 테스트의 관심사가 아니다 — 성공 경로만 만들어 준다.
vi.mock("@/lib/auth/actor", () => ({
  resolveCurrentActor: async () => ({
    role: "owner",
    isAuthenticated: true,
    userId: "u-1",
    email: "owner@example.com"
  })
}));
vi.mock("@/lib/activity/record", () => ({ recordActivity: async () => {} }));
vi.mock("@/lib/private-layer/unlock", () => ({
  getUnlockState: async () => ({ hasUnlockSession: true })
}));
vi.mock("@/lib/schedules/event-validation", () => ({
  validateDateKey: () => ({ ok: true }),
  validateSupportUrl: () => ({ ok: true }),
  validateTagAssignment: async () => ({ ok: true })
}));

// 최소 Supabase 흉내 — 체이닝 가능하고 await 가능한 빌더.
function rowFor(table: string) {
  if (table === "calendars") return { id: "cal-1" };
  if (table === "events") {
    return { id: "evt-1", is_support: true, calendar_id: "cal-1", visibility_scope: "public" };
  }
  return null;
}
function fakeClient() {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of [
      "select",
      "eq",
      "is",
      "not",
      "in",
      "order",
      "lt",
      "update",
      "delete",
      "insert",
      "limit"
    ]) {
      b[m] = chain;
    }
    const result = () => Promise.resolve({ data: rowFor(table), error: null });
    b.maybeSingle = result;
    b.single = result;
    // await 가능하게(then) — .update().eq() 처럼 종결 메서드 없이 기다리는 호출 대응.
    b.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) => result().then(ok, err);
    return b;
  };
  return {
    from: (table: string) => builder(table),
    rpc: async (name: string) => ({
      data: name === "save_event_atomic" ? "evt-1" : null,
      error: null
    })
  };
}

vi.mock("@/lib/auth/server", () => ({ createSupabaseServerClient: async () => fakeClient() }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: () => fakeClient() }));

const {
  saveEventAction,
  deleteEventAction,
  restoreEventAction,
  reorderEventsAction,
  updateEventTagsAction,
  updateSupportSettingsAction
} = await import("@/lib/schedules/event-actions");

const baseSave = {
  dateKey: "2025-10-01",
  startTime: "20:00",
  endTime: "",
  isAllDay: false,
  publicTitle: "테스트",
  publicDescription: "",
  category: "stream" as const,
  status: "scheduled" as const,
  visibilityScope: "public" as const,
  tagIds: [],
  primaryTagIds: []
};

// 공개 화면에 보이는 것을 바꾸는 모든 일정 액션. 새 액션을 추가하면 여기 한 줄 추가한다 —
// 빠뜨리면 "왜 시청자 화면에 안 뜨지"를 또 처음부터 추적하게 된다.
const WRITES: Array<[string, () => Promise<{ ok: boolean }>]> = [
  ["새 일정 저장(생성)", () => saveEventAction({ ...baseSave })],
  ["일정 수정", () => saveEventAction({ ...baseSave, id: "evt-1" })],
  [
    "최초공개(떡밥) 저장",
    () =>
      saveEventAction({
        ...baseSave,
        id: "evt-1",
        teaser: true,
        teaserRevealAt: "2025-10-01T11:00:00.000Z"
      })
  ],
  ["일정 삭제", () => deleteEventAction("evt-1")],
  ["삭제 취소(복구)", () => restoreEventAction("evt-1")],
  [
    "날짜 이동/순서",
    () => reorderEventsAction({ dateKey: "2025-10-01", orderedIds: ["evt-1"] })
  ],
  ["태그 할당", () => updateEventTagsAction("evt-1", [], [])],
  ["업 도움 설정", () => updateSupportSettingsAction("evt-1", { supportUrl: "" })]
];

describe("공개 캐시 무효화 — 쓰기마다 반드시", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
  });

  for (const [label, run] of WRITES) {
    it(`${label} → public-schedule 태그 무효화`, async () => {
      const result = await run();
      expect(result.ok).toBe(true);
      expect(revalidateTag).toHaveBeenCalledWith(PUBLIC_SCHEDULE_CACHE_TAG);
    });
  }

  it("공개 포스터(/)와 편집실(/studio) 경로도 함께 갱신한다", async () => {
    await saveEventAction({ ...baseSave });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/studio");
    revalidatePath.mockClear();
    await deleteEventAction("evt-1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/studio");
  });

  // 위 표는 일정 액션만 실행해 본다. 다른 쓰기 액션(태그·스티커·테마·잇기)까지 한 번에 훑어,
  // 새로 만든 액션이 무효화를 빠뜨린 채 머지되는 걸 막는다.
  it("lib/schedules의 모든 공개-영향 쓰기 액션이 무효화를 부른다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "lib/schedules");
    // 하트·기대돼요는 의도적 제외 — 초 단위로 눌리는 값이라 무효화하면 캐시가 무의미해진다
    // (집계는 다음 TTL에 따라붙는다). 제외를 늘릴 땐 이유를 여기 적는다.
    const EXCEPT = new Set(["heart-actions.ts", "hope-actions.ts"]);
    const missing: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith("-actions.ts"))) {
      if (EXCEPT.has(file)) continue;
      const src = fs.readFileSync(path.join(dir, file), "utf8");
      const parts = src.split(/export async function /).slice(1);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf("(")).trim();
        const body = part.split("\nexport ")[0];
        const writes = /\.(insert|update|upsert|delete)\(|\.rpc\(/.test(body);
        if (writes && !body.includes("revalidatePublicSchedule()")) {
          missing.push(`${file}:${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("실패한 쓰기는 캐시를 건드리지 않는다(권한 없음)", async () => {
    const actor = await import("@/lib/auth/actor");
    const spy = vi.spyOn(actor, "resolveCurrentActor").mockResolvedValue({
      role: "viewer",
      isAuthenticated: true
    } as never);
    const res = await saveEventAction({ ...baseSave });
    expect(res.ok).toBe(false);
    expect(revalidateTag).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
