import type {
  BroadcastTag,
  ColorPaletteEntry,
  MembershipRole,
  StudioSchedule,
  StudioScheduleEvent
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";
import { getCurrentKstYearMonth } from "@/lib/calendar/month";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getUnlockState } from "@/lib/private-layer/unlock";
import { canReadOwnerPrivate, canReadPrivateLayer } from "@/lib/permissions/roles";
import { decryptSecret, isCiphertext } from "@/lib/private-layer/secret-crypto";

// 서버에서 비공개 이벤트를 역할/잠금해제에 따라 응답에서 제거한다(클라이언트 필터와 동일 규칙).
// RLS와 별개의 2차 방어 — "엠바고"(owner_private, 옛 embargo 통합)는 소유자 전용, "작업자"(work)는
// 소유자·개발자만(매니저는 비공개 전부 제외). (CLAUDE.md 규칙 9·10)
function filterEventsForViewer(
  events: StudioScheduleEvent[],
  role: MembershipRole,
  hasUnlockSession: boolean
): StudioScheduleEvent[] {
  return events.filter((event) => {
    if (event.visibilityScope === "public") {
      return true;
    }
    if (!canReadPrivateLayer(role, hasUnlockSession)) {
      return false;
    }
    // "엠바고"(owner_private) + 옛 embargo 행은 소유자만.
    if (event.visibilityScope === "owner_private" || event.visibilityScope === "embargo") {
      return canReadOwnerPrivate(role);
    }
    // "작업자"(work): 위 게이트(소유자/개발자/작업자)를 통과한 사람만 본다.
    return true;
  });
}

// 같은 요청에서 page가 이미 구한 actor/unlock을 주입하면 loader가 중복 조회하지 않는다.
// (없으면 기존대로 직접 조회 — 호출부 호환 유지.)
type StudioScheduleContext = {
  actor?: Awaited<ReturnType<typeof resolveCurrentActor>>;
  unlock?: Awaited<ReturnType<typeof getUnlockState>>;
};

export async function getStudioSchedule(
  calendarSlug: string,
  context?: StudioScheduleContext
): Promise<StudioSchedule> {
  const supabase = await createSupabaseServerClient();

  // Supabase 미설정이면 샘플로 폴백 (개발/테스트 보호)
  if (!supabase) {
    return {
      ...sampleStudioSchedule,
      viewerModePreview: await getPublicSchedule(calendarSlug)
    };
  }

  const { year, month } = getCurrentKstYearMonth();
  // calendar 행은 slug로만 조회 — preview/actor/unlock과 서로 의존이 없어 한 배치로 병렬 처리한다.
  // (예전엔 calendar를 먼저 단독 await 해서 한 라운드트립을 더 기다렸다 → TTFB 손해. calendar.id가
  //  필요한 건 그 아래 tags/palette/events 배치뿐이라 여기서 함께 병렬로 받아도 안전하다.)
  const [calendarRes, viewerModePreview, actor, unlock] = await Promise.all([
    supabase
      .from("calendars")
      .select("id, slug, display_name, title, public_memo")
      .eq("slug", calendarSlug)
      .maybeSingle(),
    getPublicSchedule(calendarSlug),
    context?.actor ?? resolveCurrentActor(calendarSlug),
    context?.unlock ?? getUnlockState(calendarSlug)
  ]);
  const calendar = calendarRes.data;

  if (!calendar) {
    return {
      calendar: {
        slug: calendarSlug,
        displayName: calendarSlug,
        title: calendarSlug,
        timezone: PRODUCT_TIMEZONE,
        defaultYear: year,
        defaultMonth: month,
        publicMemo: "",
        posterTheme: viewerModePreview.calendar.posterTheme
      },
      tags: [],
      palette: [],
      events: [],
      variantGroups: [],
      viewerModePreview
    };
  }

  // RLS가 역할/잠금 세션에 따라 보이는 행을 결정한다.
  // owner/developer: 전체 / manager: public
  // (P2-PROTO-1: support_campaigns 쿼리 제거 — UI 소비자 0의 죽은 payload.)
  const [tagsRes, paletteRes, eventsRes] = await Promise.all([
    supabase
      .from("broadcast_tags")
      .select("id, tag_key, display_name, color_key, bg_hex, sort_order, is_default, is_active, parent_id, kind, v3_only")
      .eq("calendar_id", calendar.id)
      .order("sort_order"),
    supabase
      .from("color_palette")
      .select("key, name, bg_color, text_color, border_color, sort_order")
      .eq("calendar_id", calendar.id)
      .order("sort_order"),
    supabase
      .from("events")
      .select(
        "id, date_key, end_date_key, link_next, is_support, support_url, start_time, end_time, is_all_day, is_tentative, public_title, public_description, secret_cipher, status, sort_order, category, visibility_scope, teaser, teaser_reveal_at, event_tags(tag_id, is_primary, sort_order), event_private_meta(private_title, private_memo, editor_note)"
      )
      .is("deleted_at", null) // tombstone 제외(P0-DATA-1)
      .eq("calendar_id", calendar.id)
      .order("date_key")
      .order("created_at")
  ]);

  return {
    calendar: {
      slug: calendar.slug,
      displayName: calendar.display_name,
      title: calendar.title,
      timezone: PRODUCT_TIMEZONE,
      defaultYear: year,
      defaultMonth: month,
      publicMemo: calendar.public_memo ?? "",
      posterTheme: viewerModePreview.calendar.posterTheme
    },
    tags: (tagsRes.data ?? []).map(mapTag),
    palette: (paletteRes.data ?? []).map(mapPalette),
    events: filterEventsForViewer(
      (eventsRes.data ?? []).map((r) => mapStudioEvent(r, calendar.id)),
      actor.role,
      unlock.hasUnlockSession
    ),
    variantGroups: [],
    viewerModePreview
  };
}

// (P2-KST-1: currentKstYearMonth 중복 제거 — lib/calendar/month.ts의 getCurrentKstYearMonth 사용.)

function toKstIso(dateKey: string, time?: string | null) {
  return `${dateKey}T${time ?? "00:00:00"}+09:00`;
}

function one<T>(value: T[] | T | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

type StudioEventRow = {
  id: string;
  date_key: string;
  end_date_key: string | null;
  link_next: string | null;
  is_support: boolean;
  support_url: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_tentative: boolean | null;
  public_title: string;
  public_description: string | null;
  secret_cipher: string | null;
  status: StudioScheduleEvent["status"];
  sort_order: number;
  category: StudioScheduleEvent["category"];
  visibility_scope: StudioScheduleEvent["visibilityScope"];
  teaser: boolean | null;
  teaser_reveal_at: string | null;
  event_tags: Array<{ tag_id: string; is_primary: boolean; sort_order: number }> | null;
  event_private_meta:
    | { private_title: string | null; private_memo: string | null; editor_note: string | null }[]
    | { private_title: string | null; private_memo: string | null; editor_note: string | null }
    | null;
};

function mapStudioEvent(row: StudioEventRow, calendarId: string): StudioScheduleEvent {
  const tags = [...(row.event_tags ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const meta = one(row.event_private_meta);

  // 비공개 이벤트는 본문이 secret_cipher에 암호화돼 있다 → 복호화해 실제 제목/설명/메타로 복원.
  // 암호문이 아니면(공개 이벤트·레거시 미마이그레이션 행) 평문 컬럼 + 조인 메타 폴백.
  let title = row.public_title;
  let description = row.public_description ?? undefined;
  let privateMeta = meta
    ? {
        eventId: row.id,
        privateTitle: meta.private_title ?? undefined,
        privateMemo: meta.private_memo ?? undefined,
        editorNote: meta.editor_note ?? undefined
      }
    : undefined;

  if (isCiphertext(row.secret_cipher)) {
    try {
      const secret = decryptSecret(row.secret_cipher, calendarId);
      title = secret.publicTitle ?? title;
      description = secret.publicDescription ?? undefined;
      privateMeta = {
        eventId: row.id,
        privateTitle: secret.privateTitle,
        privateMemo: secret.privateMemo,
        editorNote: secret.editorNote
      };
    } catch {
      // 복호화 실패(키 미설정/변조): 본문을 노출하느니 플레이스홀더를 그대로 둔다.
      // (RLS가 이미 행 접근을 가렸으므로 권한 없는 노출은 아님 — 안전 폴백.)
    }
  }

  return {
    id: row.id,
    startsAt: toKstIso(row.date_key, row.start_time),
    endsAt: row.end_time ? toKstIso(row.date_key, row.end_time) : undefined,
    endDateKey:
      row.end_date_key && row.end_date_key > row.date_key ? row.end_date_key : undefined,
    linkNext: row.link_next ?? undefined,
    isSupport: row.is_support,
    supportUrl: row.support_url ?? undefined,
    isAllDay: row.is_all_day,
    isTentative: row.is_tentative ?? false,
    publicTitle: title,
    publicDescription: description,
    status: row.status,
    visibilityScope: row.visibility_scope,
    category: row.category,
    tagIds: tags.map((t) => t.tag_id),
    primaryTagIds: tags.filter((t) => t.is_primary).map((t) => t.tag_id),
    sortOrder: row.sort_order,
    teaser: row.teaser ?? undefined,
    teaserRevealAt: row.teaser_reveal_at ?? undefined,
    privateMeta
  };
}

function mapTag(row: {
  id: string;
  tag_key: string;
  display_name: string;
  color_key: string;
  bg_hex?: string | null;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  parent_id?: string | null;
  kind?: string | null;
  v3_only?: boolean | null;
}): BroadcastTag {
  return {
    id: row.id,
    tagKey: row.tag_key,
    displayName: row.display_name,
    colorKey: row.color_key as BroadcastTag["colorKey"],
    bgHex: row.bg_hex ?? null,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    isActive: row.is_active,
    parentId: row.parent_id ?? null,
    kind: row.kind === "modifier" ? "modifier" : "content",
    v3Only: row.v3_only === true
  };
}

function mapPalette(row: {
  key: string;
  name: string;
  bg_color: string;
  text_color: string;
  border_color: string;
  sort_order: number;
}): ColorPaletteEntry {
  return {
    key: row.key as ColorPaletteEntry["key"],
    name: row.name,
    bgColor: row.bg_color,
    textColor: row.text_color,
    borderColor: row.border_color,
    sortOrder: row.sort_order
  };
}

