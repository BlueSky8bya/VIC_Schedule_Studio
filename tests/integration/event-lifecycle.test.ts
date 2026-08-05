import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

// 편집실 쓰기의 **서버 왕복** 실물 검증(ISSUE-001의 나머지 절반).
//
// 브라우저 e2e(tests/visual/studio-editor.spec.ts)는 "클라가 무엇을 보내는가"까지만 본다.
// 여기서는 그 명령이 **진짜 DB에 어떻게 반영되고, 시청자에게 무엇으로 보이는지**를 확인한다:
// 서버 액션 → 저장 RPC(save_event_atomic / reorder_events_atomic) → 공개 로더 재조회.
// RPC 시그니처나 컬럼이 바뀌면 지금까지 아무 테스트도 못 잡았다.
//
// 안전 규칙(어기면 시청자 실시간 화면이 오염된다):
//  · 테스트 일정은 **과거 달**에만 만든다. 현재/미래 달 금지.
//  · 제목에 표식을 달고, 끝나면 tombstone이 아니라 **물리 삭제**까지 한다.
//  · 실패로 중간에 끊겨도 afterAll이 표식으로 훑어 지운다.
//
// 인증은 서버 actor를 owner로 고정하고 DB 접근은 service-role로 바꾼다 — 따라서 **RLS는 이
// 테스트의 대상이 아니다**(RLS는 공개 경계 e2e와 SQL 정책이 담당). 여기서 보는 것은 스키마·
// RPC·로더 계약이다.

const SLUG = "vic";
const PAST_DAY = "2025-09-15"; // 지난 달(시청자가 보는 현재/미래 달이 아니다)
const MARK = "[통합테스트]"; // 남더라도 사람이 바로 알아볼 표식

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && serviceKey);
const admin = configured ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;

// next/cache는 요청 컨텍스트 밖에서 부르면 던진다 — 호출 여부만 기록한다.
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  revalidatePath: () => {},
  unstable_cache: (fn: unknown) => fn // 캐시를 통과시켜 **매번 실제 DB**를 읽는다
}));
vi.mock("@/lib/auth/actor", () => ({
  resolveCurrentActor: async () => ({
    role: "owner",
    isAuthenticated: true,
    userId: "integration-owner",
    email: process.env.OWNER_EMAIL ?? "owner@example.com"
  })
}));
// 쿠키 기반 클라이언트 대신 service-role을 쓴다(테스트에는 세션이 없다).
vi.mock("@/lib/auth/server", () => ({
  createSupabaseServerClient: async () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false }
    })
}));
// 비공개 잠금은 '해제 안 된 상태'로 둔다 — 서버가 비공개 저장을 거절하는지 확인하기 위해서다.
vi.mock("@/lib/private-layer/unlock", () => ({
  getUnlockState: async () => ({ hasUnlockSession: false })
}));
vi.mock("@/lib/activity/record", () => ({ recordActivity: async () => {} }));

const {
  saveEventAction,
  deleteEventAction,
  restoreEventAction,
  reorderEventsAction,
  updateEventTagsAction
} = await import("@/lib/schedules/event-actions");
const { getPublicSchedule, loadRevealedEvents } = await import("@/lib/schedules/public-loader");
type SaveInput = Parameters<typeof saveEventAction>[0];

const base: SaveInput = {
  dateKey: PAST_DAY,
  startTime: "20:00",
  endTime: "",
  isAllDay: false,
  publicTitle: `${MARK} 기본`,
  publicDescription: "",
  category: "stream" as const,
  status: "scheduled" as const,
  visibilityScope: "public" as const,
  tagIds: [] as string[],
  primaryTagIds: [] as string[]
};

const created: string[] = [];
async function createEvent(over: Partial<SaveInput> = {}): Promise<string> {
  const res = await saveEventAction({ ...base, ...over });
  expect(res.ok, `저장 실패: ${res.ok ? "" : res.error}`).toBe(true);
  const id = (res as { ok: true; id: string }).id;
  created.push(id);
  return id;
}
const publicEventById = async (id: string) =>
  (await getPublicSchedule(SLUG)).events.find((e) => e.id === id);

describe.skipIf(!configured)("일정 쓰기 — 서버 왕복(실제 DB)", () => {
  beforeAll(() => {
    expect(admin).toBeTruthy();
  });

  afterAll(async () => {
    // 표식이 붙은 그 날짜의 행을 **물리 삭제**한다(tombstone도 남기지 않는다).
    if (!admin) return;
    await admin.from("events").delete().in("id", created);
    await admin.from("events").delete().eq("date_key", PAST_DAY).like("public_title", `${MARK}%`);
    const { data } = await admin
      .from("events")
      .select("id")
      .eq("date_key", PAST_DAY)
      .like("public_title", `${MARK}%`);
    expect(data ?? [], "테스트 데이터가 남았다").toHaveLength(0);
  });

  it("만들면 공개 스냅샷에 그대로 나타난다(제목·시간·범위)", async () => {
    const id = await createEvent({ publicTitle: `${MARK} 생성 확인` });
    const ev = await publicEventById(id);
    expect(ev, "공개 스냅샷에 없음").toBeTruthy();
    expect(ev!.publicTitle).toBe(`${MARK} 생성 확인`);
    expect(ev!.visibilityScope).toBe("public");
    expect(ev!.startsAt.startsWith(`${PAST_DAY}T20:00`)).toBe(true);
    expect(revalidateTag).toHaveBeenCalled(); // 캐시 무효화까지 이어졌다
  });

  it("고치면 반영되고, 지우면 공개에서 사라지고, 되돌리면 같은 id로 돌아온다", async () => {
    const id = await createEvent({ publicTitle: `${MARK} 수정 전` });
    await saveEventAction({ ...base, id, publicTitle: `${MARK} 수정 후` });
    expect((await publicEventById(id))?.publicTitle).toBe(`${MARK} 수정 후`);

    const del = await deleteEventAction(id);
    expect(del.ok).toBe(true);
    expect(await publicEventById(id), "지운 일정이 공개에 남아 있다").toBeUndefined();

    const res = await restoreEventAction(id);
    expect(res.ok).toBe(true);
    expect((await publicEventById(id))?.publicTitle).toBe(`${MARK} 수정 후`);
  });

  it("최초공개: 공개 시각 전에는 제목이 안 나가고, 지나면 나간다", async () => {
    // 공개 전 — 서버가 가린 stub만 준다(제목·태그 없음). 유출면이라 가장 중요한 계약.
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    const id = await createEvent({
      publicTitle: `${MARK} 비밀 제목`,
      teaser: true,
      teaserRevealAt: future
    });
    const hidden = await publicEventById(id);
    expect(hidden?.teaser).toBe(true);
    expect(hidden?.publicTitle).toBe("");
    expect(JSON.stringify(hidden)).not.toContain("비밀 제목");
    // 캐시를 우회하는 즉시 공개 경로도 같은 기준으로 가린다.
    const early = await loadRevealedEvents(SLUG, [id]);
    expect(early.ok).toBe(true);
    expect(early.events[0]?.publicTitle).toBe("");

    // 공개 시각을 과거로 옮기면 실제 내용이 나온다.
    await saveEventAction({
      ...base,
      id,
      publicTitle: `${MARK} 비밀 제목`,
      teaser: true,
      teaserRevealAt: new Date(Date.now() - 60_000).toISOString()
    });
    const shown = await loadRevealedEvents(SLUG, [id]);
    expect(shown.events[0]?.teaser).toBeFalsy();
    expect(shown.events[0]?.publicTitle).toBe(`${MARK} 비밀 제목`);
  });

  it("지워진 일정을 물으면 'ok지만 없음'으로 답한다(유령 카드 탈출의 근거)", async () => {
    const id = await createEvent({ publicTitle: `${MARK} 곧 삭제` });
    await deleteEventAction(id);
    const res = await loadRevealedEvents(SLUG, [id]);
    expect(res.ok).toBe(true);
    expect(res.events).toHaveLength(0);
  });

  it("태그 할당이 공개 DTO의 tagIds까지 이어진다", async () => {
    const { data: tags } = await admin!
      .from("broadcast_tags")
      .select("id")
      .eq("is_active", true)
      .limit(1);
    const tagId = tags?.[0]?.id as string | undefined;
    if (!tagId) return; // 태그가 없는 환경이면 검사 생략
    const id = await createEvent({ publicTitle: `${MARK} 태그` });
    const res = await updateEventTagsAction(id, [tagId], [tagId]);
    expect(res.ok).toBe(true);
    const ev = await publicEventById(id);
    expect(ev?.tagIds).toContain(tagId);
    expect(ev?.primaryTagIds).toContain(tagId);
  });

  it("날짜 이동(reorder RPC)이 실제로 날짜를 옮긴다", async () => {
    const id = await createEvent({ publicTitle: `${MARK} 이동` });
    const target = "2025-09-16";
    const res = await reorderEventsAction({ dateKey: target, orderedIds: [id], movedId: id });
    expect(res.ok, `이동 실패: ${res.ok ? "" : res.error}`).toBe(true);
    expect((await publicEventById(id))?.startsAt.startsWith(target)).toBe(true);
    // 정리 대상 날짜를 벗어났으므로 여기서 직접 되돌린다(afterAll 청소 범위 유지).
    await reorderEventsAction({ dateKey: PAST_DAY, orderedIds: [id], movedId: id });
  });

  it("잠금 해제 없이는 비공개 범위로 저장할 수 없다(서버 2차 방어)", async () => {
    const res = await saveEventAction({
      ...base,
      publicTitle: `${MARK} 비공개 시도`,
      visibilityScope: "work"
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("잠금 해제");
  });
});
