"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmail, normalizeEmail } from "@/lib/auth/config";

// 개발자 전용 "인사이트" 대시보드용 집계. 모든 값은 합계/개수만 — 비공개·owner_private 일정의
// 내용(제목)은 절대 내보내지 않는다(개발자는 owner-only 콘텐츠를 못 본다는 규칙 유지).
// "나만"(owner_private)은 카운트에서도 제외한다(요청).

const SLUG = "vic";

export type InsightsData = {
  content: {
    publicCount: number; // 이번 달 공개 일정
    privateCount: number; // 이번 달 비공개(엠바고+작업) — owner_private 제외
    upcoming7: number; // 앞으로 7일 공개 일정
    stickerCount: number; // 이번 달 포스터 스티커
    assetCount: number; // 커스텀 스티커 에셋
    tags: { name: string; count: number; colorKey: string }[]; // 이번 달 태그 사용 분포(상위)
  };
  engagement: {
    calendarHearts: number; // 달력 전체 누적 하트
    eventHeartTotal: number; // 공개 일정 하트 합계
    topEvents: { title: string; count: number }[]; // 하트 많은 공개 일정 상위
  };
  security: {
    activeUnlocks: number; // 지금 유효한 비공개 잠금 세션 수
    managers: number;
    workers: number;
    passcodeVersion: number | null;
    passcodeUpdatedAt: string | null;
  };
  system: {
    ownerEmail: string | null; // 설정(OWNER_EMAIL) 주 소유자
    calendarOwnerEmail: string | null; // calendars.owner_id가 가리키는 실제 계정
    ownerBindingOk: boolean; // 둘이 일치하는가(어긋나면 저장 실패 위험)
    commit: string | null;
    generatedAt: string; // KST ISO
  };
};

export type InsightsResult =
  | { ok: true; data: InsightsData }
  | { ok: false; error: string };

function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getInsightsAction(): Promise<InsightsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }

  const { data: cal } = await supabase
    .from("calendars")
    .select("id, owner_id, title")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  // 이번 달(KST) 범위 + 오늘/7일 뒤.
  const now = kstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(y, m, 1)); // m은 1-base라 다음 달 1일
  const nextMonthStart = ymd(nextMonth);
  const todayKey = ymd(now);
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const in7Key = ymd(in7);
  const nowIso = new Date().toISOString();

  const [
    monthEventsRes,
    upcomingRes,
    tagRowsRes,
    stickerRes,
    assetRes,
    heartsRes,
    eventHeartRes,
    unlockRes,
    membersRes,
    passcodeRes
  ] = await Promise.all([
    supabase
      .from("events")
      .select("visibility_scope")
      .eq("calendar_id", calendarId)
      .gte("date_key", monthStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", todayKey)
      .lte("date_key", in7Key),
    supabase
      .from("event_tags")
      .select("tag_id, broadcast_tags(display_name, color_key), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", monthStart)
      .lt("events.date_key", nextMonthStart),
    supabase
      .from("sticker_instances")
      .select("*", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .eq("year", y)
      .eq("month", m)
      .eq("is_visible", true),
    supabase
      .from("sticker_assets")
      .select("*", { count: "exact", head: true })
      .eq("calendar_id", calendarId),
    supabase.from("calendar_hearts").select("count").eq("calendar_id", calendarId).maybeSingle(),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    supabase
      .from("unlock_sessions")
      .select("*", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .gt("expires_at", nowIso),
    supabase
      .from("trusted_members")
      .select("is_manager, is_worker, trusted_role")
      .eq("calendar_id", calendarId)
      .eq("is_active", true),
    supabase
      .from("private_layer_settings")
      .select("passcode_version, passcode_updated_at")
      .eq("calendar_id", calendarId)
      .maybeSingle()
  ]);

  // 콘텐츠: 이번 달 공개/비공개 개수 (owner_private는 카운트에서 제외).
  const monthEvents = monthEventsRes.data ?? [];
  let publicCount = 0;
  let privateCount = 0;
  for (const e of monthEvents) {
    const scope = (e as { visibility_scope: string }).visibility_scope;
    if (scope === "public") publicCount += 1;
    else if (scope === "embargo" || scope === "work") privateCount += 1;
    // owner_private("나만")은 의도적으로 세지 않는다.
  }

  // 태그 사용 분포(이번 달) — 상위 8개.
  const tagMap = new Map<string, { name: string; count: number; colorKey: string }>();
  for (const row of tagRowsRes.data ?? []) {
    const tag = (row as { broadcast_tags?: { display_name?: string; color_key?: string } })
      .broadcast_tags;
    const id = (row as { tag_id: string }).tag_id;
    if (!tag?.display_name) continue;
    const cur = tagMap.get(id);
    if (cur) cur.count += 1;
    else tagMap.set(id, { name: tag.display_name, count: 1, colorKey: tag.color_key ?? "" });
  }
  const tags = [...tagMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // 참여(하트).
  const calendarHearts = Number((heartsRes.data as { count?: number } | null)?.count ?? 0);
  const heartRows = (eventHeartRes.data ?? []) as { event_id: string; count: number }[];
  const eventHeartTotal = heartRows.reduce((s, r) => s + Number(r.count), 0);
  const topHeart = [...heartRows].sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 5);
  let topEvents: { title: string; count: number }[] = [];
  if (topHeart.length > 0) {
    const { data: titleRows } = await supabase
      .from("events")
      .select("id, public_title, is_public")
      .in("id", topHeart.map((r) => r.event_id));
    const titleMap = new Map(
      (titleRows ?? [])
        .filter((t) => (t as { is_public?: boolean }).is_public) // 공개 일정만(안전)
        .map((t) => [(t as { id: string }).id, (t as { public_title: string }).public_title])
    );
    topEvents = topHeart
      .map((r) => ({ title: titleMap.get(r.event_id) ?? "", count: Number(r.count) }))
      .filter((e) => e.title);
  }

  // 보안.
  const members = membersRes.data ?? [];
  let managers = 0;
  let workers = 0;
  for (const mem of members) {
    const isM = (mem as { is_manager?: boolean; trusted_role?: string }).is_manager;
    const isW = (mem as { is_worker?: boolean }).is_worker;
    const role = (mem as { trusted_role?: string }).trusted_role;
    if (isM ?? role === "manager") managers += 1;
    if (isW ?? role === "worker") workers += 1;
  }
  const passcode = passcodeRes.data as
    | { passcode_version?: number; passcode_updated_at?: string }
    | null;

  // 시스템: 소유자 바인딩 점검.
  const ownerEmail = getOwnerEmail();
  let calendarOwnerEmail: string | null = null;
  if (cal.owner_id) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(cal.owner_id as string);
      calendarOwnerEmail = normalizeEmail(u?.user?.email);
    } catch {
      calendarOwnerEmail = null;
    }
  }
  const ownerBindingOk = Boolean(
    ownerEmail && calendarOwnerEmail && ownerEmail === calendarOwnerEmail
  );

  return {
    ok: true,
    data: {
      content: {
        publicCount,
        privateCount,
        upcoming7: upcomingRes.count ?? 0,
        stickerCount: stickerRes.count ?? 0,
        assetCount: assetRes.count ?? 0,
        tags
      },
      engagement: {
        calendarHearts,
        eventHeartTotal,
        topEvents
      },
      security: {
        activeUnlocks: unlockRes.count ?? 0,
        managers,
        workers,
        passcodeVersion: passcode?.passcode_version ?? null,
        passcodeUpdatedAt: passcode?.passcode_updated_at ?? null
      },
      system: {
        ownerEmail,
        calendarOwnerEmail,
        ownerBindingOk,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        generatedAt: now.toISOString()
      }
    }
  };
}
