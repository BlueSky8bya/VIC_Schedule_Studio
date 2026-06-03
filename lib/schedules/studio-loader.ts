import type {
  BroadcastTag,
  ColorPaletteEntry,
  MembershipRole,
  StudioSchedule,
  StudioScheduleEvent,
  SupportCampaign
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getUnlockState } from "@/lib/private-layer/unlock";
import { canReadOwnerPrivate, canReadPrivateLayer } from "@/lib/permissions/roles";

// 서버에서 비공개 이벤트를 역할/잠금해제에 따라 응답에서 제거한다(클라이언트 필터와 동일 규칙).
// RLS와 별개의 2차 방어 — "엠바고"(owner_private, 옛 embargo 통합)는 소유자 전용, "작업자"(work)는
// 소유자·개발자·작업자만(매니저는 비공개 전부 제외). (CLAUDE.md 규칙 9·10)
function filterEventsForViewer(
  events: StudioScheduleEvent[],
  role: MembershipRole,
  isWorker: boolean,
  hasUnlockSession: boolean
): StudioScheduleEvent[] {
  return events.filter((event) => {
    if (event.visibilityScope === "public") {
      return true;
    }
    if (!canReadPrivateLayer(role, isWorker, hasUnlockSession)) {
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

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, slug, display_name, title, public_memo")
    .eq("slug", calendarSlug)
    .maybeSingle();

  const { year, month } = currentKstYearMonth();
  const [viewerModePreview, actor, unlock] = await Promise.all([
    getPublicSchedule(calendarSlug),
    context?.actor ?? resolveCurrentActor(calendarSlug),
    context?.unlock ?? getUnlockState(calendarSlug)
  ]);

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
      supportCampaigns: [],
      events: [],
      stickers: [],
      stickerAssets: [],
      heartCount: viewerModePreview.heartCount,
      variantGroups: [],
      proposals: [],
      requests: [],
      viewerModePreview
    };
  }

  // RLS가 역할/잠금 세션에 따라 보이는 행을 결정한다.
  // owner/developer: 전체 / manager·worker: public + (unlock 시 embargo·work)
  const [tagsRes, paletteRes, eventsRes, campaignsRes] = await Promise.all([
    supabase
      .from("broadcast_tags")
      .select("id, tag_key, display_name, color_key, sort_order, is_default, is_active, parent_id, kind, v3_only")
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
        "id, date_key, end_date_key, link_next, is_support, support_url, start_time, end_time, is_all_day, public_title, public_description, status, sort_order, category, visibility_scope, event_tags(tag_id, is_primary, sort_order), event_private_meta(private_title, private_memo, editor_note)"
      )
      .eq("calendar_id", calendar.id)
      .order("date_key")
      .order("created_at"),
    supabase
      .from("support_campaigns")
      .select(
        "id, title, description, url, starts_on, ends_on, public_cta_label, highlight_color_key, is_public, is_active"
      )
      .eq("calendar_id", calendar.id)
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
    supportCampaigns: (campaignsRes.data ?? []).map(mapCampaign),
    events: filterEventsForViewer(
      (eventsRes.data ?? []).map(mapStudioEvent),
      actor.role,
      actor.isWorker === true,
      unlock.hasUnlockSession
    ),
    stickers: [],
    stickerAssets: [],
    heartCount: viewerModePreview.heartCount,
    variantGroups: [],
    proposals: [],
    requests: [],
    viewerModePreview
  };
}

function currentKstYearMonth() {
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT_TIMEZONE,
    year: "numeric",
    month: "2-digit"
  })
    .format(new Date())
    .split("-")
    .map(Number);

  return { year: y, month: m };
}

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
  public_title: string;
  public_description: string | null;
  status: StudioScheduleEvent["status"];
  sort_order: number;
  category: StudioScheduleEvent["category"];
  visibility_scope: StudioScheduleEvent["visibilityScope"];
  event_tags: Array<{ tag_id: string; is_primary: boolean; sort_order: number }> | null;
  event_private_meta:
    | { private_title: string | null; private_memo: string | null; editor_note: string | null }[]
    | { private_title: string | null; private_memo: string | null; editor_note: string | null }
    | null;
};

function mapStudioEvent(row: StudioEventRow): StudioScheduleEvent {
  const tags = [...(row.event_tags ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const meta = one(row.event_private_meta);

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
    publicTitle: row.public_title,
    publicDescription: row.public_description ?? undefined,
    status: row.status,
    visibilityScope: row.visibility_scope,
    category: row.category,
    tagIds: tags.map((t) => t.tag_id),
    primaryTagIds: tags.filter((t) => t.is_primary).map((t) => t.tag_id),
    sortOrder: row.sort_order,
    privateMeta: meta
      ? {
          eventId: row.id,
          privateTitle: meta.private_title ?? undefined,
          privateMemo: meta.private_memo ?? undefined,
          editorNote: meta.editor_note ?? undefined
        }
      : undefined
  };
}

function mapTag(row: {
  id: string;
  tag_key: string;
  display_name: string;
  color_key: string;
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

function mapCampaign(row: {
  id: string;
  title: string;
  description: string | null;
  url: string;
  starts_on: string;
  ends_on: string;
  public_cta_label: string;
  highlight_color_key: string;
  is_public: boolean;
  is_active: boolean;
}): SupportCampaign {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    label: row.public_cta_label,
    url: row.url,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    highlightColorKey: row.highlight_color_key as SupportCampaign["highlightColorKey"],
    isPublic: row.is_public,
    isActive: row.is_active
  };
}
