import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

// 시청자 검색(0076) — 공개 경계·순위 계약을 **실제 DB**에서 확인한다.
//
// 보는 것:
//  · 공개 일정은 제목·설명·(다단어) 부분 매칭으로 찾힌다.
//  · 비공개(work)·초안·삭제(tombstone)·미공개 떡밥 일정은 **제목을 그대로 검색해도 0건**이다.
//  · 응답 DTO에 비공개 계열 필드명이 없다(경계 규칙).
//  · 제목 정확 포함 > 설명만 포함(순위).
//
// 안전 규칙: 과거 달에만 만들고, 표식을 달고, 끝나면 물리 삭제(event-lifecycle과 같은 규약).

const SLUG = "vic";
const PAST_DAY = "2025-09-16";
const MARK = "[통합테스트검색]";
const TOKEN = "츠쿠요미얌얌"; // 실데이터에 없을 법한 검색어

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && serviceKey);
const admin = configured ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;

vi.mock("next/cache", () => ({
  revalidateTag: () => {},
  revalidatePath: () => {},
  unstable_cache: (fn: unknown) => fn
}));

const { searchPublic } = await import("@/lib/schedules/public-loader");

const created: string[] = [];
async function insertEvent(over: Record<string, unknown>): Promise<string> {
  const { data: cal } = await admin!.from("calendars").select("id").eq("slug", SLUG).single();
  const { data, error } = await admin!
    .from("events")
    .insert({
      calendar_id: cal!.id,
      date_key: PAST_DAY,
      start_time: "20:00",
      is_all_day: false,
      public_title: `${MARK} 기본`,
      visibility_scope: "public",
      status: "scheduled",
      ...over
    })
    .select("id")
    .single();
  expect(error, error?.message).toBeNull();
  created.push(data!.id);
  return data!.id;
}
const find = async (q: string) => (await searchPublic(SLUG, q, 100)).hits;

describe.skipIf(!configured)("시청자 검색 — 공개 경계·순위(실제 DB)", () => {
  beforeAll(() => {
    expect(admin).toBeTruthy();
  });

  afterAll(async () => {
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

  it("공개 일정은 제목으로 찾히고 DTO는 공개 필드뿐이다", async () => {
    const id = await insertEvent({ public_title: `${MARK} ${TOKEN} 제목` });
    const hits = await find(TOKEN);
    const hit = hits.find((h) => h.kind === "event" && h.eventId === id);
    expect(hit, "공개 일정이 검색에 없다").toBeTruthy();
    expect(hit!.dateKey).toBe(PAST_DAY);
    expect(hit!.startTime).toBe("20:00");
    const json = JSON.stringify(hits);
    for (const banned of ["private", "embargo", "work", "codename", "editor", "request", "secret"]) {
      expect(json.toLowerCase(), `금지 필드명 '${banned}'가 응답에 있다`).not.toContain(`"${banned}`);
    }
  });

  it("설명 본문으로도 찾히지만 제목 적중보다 순위가 낮고, 발췌가 붙는다", async () => {
    const titleId = await insertEvent({ public_title: `${MARK} ${TOKEN}` });
    const descId = await insertEvent({
      public_title: `${MARK} 설명만`,
      public_description: `오늘은 예전에 했던 ${TOKEN} 얘기를 다시 꺼낸다`
    });
    const hits = await find(TOKEN);
    const ti = hits.findIndex((h) => h.eventId === titleId);
    const di = hits.findIndex((h) => h.eventId === descId);
    expect(ti).toBeGreaterThanOrEqual(0);
    expect(di).toBeGreaterThanOrEqual(0);
    expect(ti).toBeLessThan(di);
    expect(hits[di].snippet).toContain(TOKEN);
  });

  it("공백·기호가 달라도 같은 말로 본다('츠쿠요미 얌얌!')", async () => {
    const id = await insertEvent({ public_title: `${MARK} ${TOKEN} 띄어쓰기` });
    const hits = await find("츠쿠요미 얌얌!");
    expect(hits.some((h) => h.eventId === id)).toBe(true);
  });

  it("비공개(work)·초안·삭제·미공개 떡밥은 제목을 그대로 쳐도 0건", async () => {
    const secret = `${MARK} 비밀토큰쿠쿠루`;
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await insertEvent({ public_title: secret, visibility_scope: "work" });
    await insertEvent({ public_title: secret, status: "draft" });
    await insertEvent({ public_title: secret, deleted_at: new Date().toISOString() });
    await insertEvent({ public_title: secret, teaser: true, teaser_reveal_at: future });
    // 실데이터 챕터가 트라이그램 퍼지로 걸릴 수 있으니(예: "비밀토리!") 일정 적중만 본다.
    const hits = (await find("비밀토큰쿠쿠루")).filter((h) => h.kind === "event");
    expect(hits, JSON.stringify(hits)).toHaveLength(0);
    // 표식 부분이 다른 테스트 일정과 겹치므로 비밀 토큰이 든 제목만 센다.
    const exact = (await find(secret)).filter((h) => h.kind === "event" && h.title.includes("비밀토큰"));
    expect(exact, JSON.stringify(exact)).toHaveLength(0);
  });

  it("줄임말·동의어: '배그'로 '배틀그라운드' 일정이 정확 적중으로 찾힌다(0078 사전)", async () => {
    const id = await insertEvent({ public_title: `${MARK} 배틀그라운드 ${TOKEN}` });
    // '배그' 단독은 실데이터 적중이 100건을 넘어 새 일정이 잘릴 수 있다 — 희귀 토큰과 함께 두 단어로.
    const hits = await find(`배그 ${TOKEN}`);
    const hit = hits.find((h) => h.eventId === id);
    expect(hit, "동의어 확장 실패").toBeTruthy();
    expect(hit!.exact).toBe(true);
    // 사전에 없는 줄임말은 부분열 안전망으로 '비슷한 결과'(exact=false)에는 든다.
    const id2 = await insertEvent({ public_title: `${MARK} 츠쿠요미 온라인` });
    const hit2 = (await find("츠온")).find((h) => h.eventId === id2);
    expect(hit2, "줄임말 부분열 실패").toBeTruthy();
    expect(hit2!.exact).toBe(false);
  });

  it("정규화 후 2글자 미만이면 왕복 없이 빈 결과", async () => {
    expect((await searchPublic(SLUG, " ㅋ ")).hits).toHaveLength(0);
  });
});
