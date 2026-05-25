import type {
  BroadcastTag,
  ColorPaletteEntry,
  MemoLine,
  PublicSchedule,
  PublicScheduleEvent,
  StickerInstance,
  StudioScheduleEvent,
  SupportCampaign
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE, isPosterThemeKey } from "@/lib/domain/schedule-types";
import type { PosterThemeKey } from "@/lib/domain/schedule-types";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { PUBLIC_SCHEDULE_CACHE_TAG } from "@/lib/schedules/cache";

function coercePosterTheme(value: unknown): PosterThemeKey {
  return typeof value === "string" && isPosterThemeKey(value) ? value : "none";
}
function coerceMemoAlign(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}
function coerceMemoVAlign(value: unknown): "top" | "center" | "bottom" {
  return value === "center" || value === "bottom" ? value : "top";
}
// B: 저장된 줄별 메모(jsonb)를 안전하게 MemoLine[]로. 없거나 비면 undefined → publicMemo 폴백.
function coerceMemoLines(value: unknown): MemoLine[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const lines = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      text: typeof item.text === "string" ? item.text : "",
      align:
        item.align === "center" || item.align === "right"
          ? (item.align as "center" | "right")
          : ("left" as const),
      indent:
        typeof item.indent === "number"
          ? Math.min(4, Math.max(0, Math.round(item.indent)))
          : 0
    }));
  return lines.length > 0 ? lines : undefined;
}

// 익명 공개 데이터는 모든 시청자에게 동일하므로 Data Cache에 짧게 캐시한다.
// 수백 명이 동시에 봐도 DB는 이 주기마다 한 번만 조회된다(읽기 위주 트래픽 최적화).
// 소유자가 스튜디오에서 한 편집은 최대 이 시간만큼 뒤 시청자 화면에 반영된다.
const PUBLIC_SCHEDULE_REVALIDATE_SECONDS = 30;

// 쿠키 없는 anon 클라이언트 — 캐시 가능한 익명 쿼리 전용(요청 컨텍스트에 묶이지 않음).
// 공개 RLS 정책 + anon SELECT 권한으로 공개 행만 읽힌다(비공개 데이터는 RLS가 차단).
function createPublicReadClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getPublicSchedule(calendarSlug: string): Promise<PublicSchedule> {
  // Supabase 미설정(키 없음)이면 샘플 데이터로 폴백한다 — 개발/테스트 보호.
  if (!isSupabaseConfigured()) {
    return samplePublicSchedule(calendarSlug);
  }

  // 익명 공개 묶음(캐시 대상) + 로그인 사용자의 개인 관심 목록(비캐시)을 합친다.
  const [data, myHeartIds] = await Promise.all([
    loadPublicScheduleData(calendarSlug),
    loadMyHeartIds()
  ]);

  return { ...data, myHeartIds };
}

// 익명 공개 묶음 로더 — 캐시된다. myHeartIds는 사용자별이라 여기 포함하지 않는다(빈 배열).
const loadPublicScheduleData = unstable_cache(
  async (calendarSlug: string): Promise<PublicSchedule> => {
    const supabase = createPublicReadClient();
    const { year, month } = currentKstYearMonth();

    if (!supabase) {
      return samplePublicSchedule(calendarSlug);
    }

    const { data: calendar } = await supabase
      .from("calendars")
      .select(
        "id, slug, display_name, title, public_memo, public_memo_lines, poster_theme, public_memo_align, public_memo_valign"
      )
      .eq("slug", calendarSlug)
      .eq("is_public", true)
      .maybeSingle();

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
          posterTheme: "none"
        },
        events: [],
        tags: [],
        palette: [],
        supportCampaigns: [],
        stickers: [],
        stickerAssets: [],
        heartCount: 0,
        myHeartIds: []
      };
    }

    // RLS 공개 정책이 1차 방어선이지만, 쿼리에서도 명시적으로 공개분만 조회한다.
    const [tagsRes, paletteRes, eventsRes, campaignsRes, stickersRes, assetsRes, heartsRes, eventHeartsRes] =
      await Promise.all([
        supabase
          .from("broadcast_tags")
          .select("id, tag_key, display_name, color_key, sort_order, is_default, is_active")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("color_palette")
          .select("key, name, bg_color, text_color, border_color, sort_order")
          .order("sort_order"),
        supabase
          .from("events")
          .select(
            "id, date_key, end_date_key, link_next, is_support, support_url, start_time, end_time, is_all_day, public_title, public_description, status, sort_order, category, event_tags(tag_id, is_primary, sort_order)"
          )
          .eq("visibility_scope", "public")
          .neq("status", "draft")
          .order("date_key")
          .order("created_at"),
        supabase
          .from("support_campaigns")
          .select(
            "id, title, description, url, starts_on, ends_on, public_cta_label, highlight_color_key, is_public, is_active"
          )
          .eq("is_public", true)
          .eq("is_active", true),
        supabase
          .from("sticker_instances")
          .select(
            "id, emoji, text_content, text_color, font_weight, font_family, text_align, text_bg, italic, outline, shadow, year, month, x_ratio, y_ratio, width_ratio, rotation_deg, flip_x, flip_y, opacity, z_index, is_visible, asset_id, sticker_assets(name, file_url, file_type)"
          )
          .eq("is_visible", true),
        supabase
          .from("sticker_assets")
          .select("id, name, file_url, file_type")
          .order("created_at", { ascending: false }),
        supabase
          .from("calendar_hearts")
          .select("count")
          .eq("calendar_id", calendar.id)
          .maybeSingle(),
        // A: 일정별 관심 집계(공개 안전 — user_id 비노출). 함수가 공개 일정만 집계한다.
        supabase.rpc("get_event_heart_counts", { p_calendar_id: calendar.id })
      ]);

    // 일정 id → 관심 집계 수 맵. 인기 배지 판정에 쓴다.
    const heartCountByEvent = new Map<string, number>(
      ((eventHeartsRes.data as { event_id: string; count: number }[] | null) ?? []).map((row) => [
        row.event_id,
        Number(row.count)
      ])
    );

    return {
      calendar: {
        slug: calendar.slug,
        displayName: calendar.display_name,
        title: calendar.title,
        timezone: PRODUCT_TIMEZONE,
        defaultYear: year,
        defaultMonth: month,
        publicMemo: calendar.public_memo ?? "",
        posterTheme: coercePosterTheme(calendar.poster_theme),
        memoAlign: coerceMemoAlign(calendar.public_memo_align),
        memoVAlign: coerceMemoVAlign(calendar.public_memo_valign),
        memoLines: coerceMemoLines(calendar.public_memo_lines)
      },
      tags: (tagsRes.data ?? []).map(mapTag),
      palette: (paletteRes.data ?? []).map(mapPalette),
      events: (eventsRes.data ?? []).map((row) => ({
        ...mapEvent(row),
        heartCount: heartCountByEvent.get(row.id) ?? 0
      })),
      supportCampaigns: (campaignsRes.data ?? []).map(mapCampaign),
      stickers: (stickersRes.data ?? []).map(mapSticker),
      stickerAssets: (assetsRes.data ?? []).map(mapStickerAsset),
      heartCount: Number(heartsRes.data?.count ?? 0),
      myHeartIds: []
    };
  },
  ["public-schedule-data"],
  { revalidate: PUBLIC_SCHEDULE_REVALIDATE_SECONDS, tags: [PUBLIC_SCHEDULE_CACHE_TAG] }
);

// 로그인 사용자가 관심 표시한 일정 id(본인 것만, RLS로 보장). 캐시하지 않는다(사용자별).
async function loadMyHeartIds(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase.from("event_hearts").select("event_id");
  return ((data as { event_id: string }[] | null) ?? []).map((row) => row.event_id);
}

function mapStickerAsset(row: {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
}) {
  return {
    id: row.id,
    name: row.name,
    fileUrl: row.file_url,
    fileType: row.file_type
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

// date_key(YYYY-MM-DD) + start_time(HH:mm:ss) → KST ISO 문자열
function toKstIso(dateKey: string, time?: string | null) {
  return `${dateKey}T${time ?? "00:00:00"}+09:00`;
}

type EventRow = {
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
  status: PublicScheduleEvent["status"];
  sort_order: number;
  category: PublicScheduleEvent["category"];
  event_tags: Array<{ tag_id: string; is_primary: boolean; sort_order: number }> | null;
};

function mapEvent(row: EventRow): PublicScheduleEvent {
  const tags = [...(row.event_tags ?? [])].sort((a, b) => a.sort_order - b.sort_order);

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
    visibilityScope: "public",
    category: row.category,
    tagIds: tags.map((t) => t.tag_id),
    primaryTagIds: tags.filter((t) => t.is_primary).map((t) => t.tag_id),
    sortOrder: row.sort_order
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
}): BroadcastTag {
  return {
    id: row.id,
    tagKey: row.tag_key,
    displayName: row.display_name,
    colorKey: row.color_key as BroadcastTag["colorKey"],
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    isActive: row.is_active
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

function mapSticker(row: {
  id: string;
  emoji: string | null;
  text_content?: string | null;
  text_color?: string | null;
  font_weight?: number | null;
  font_family?: string | null;
  text_align?: string | null;
  text_bg?: string | null;
  italic?: boolean | null;
  outline?: boolean | null;
  shadow?: boolean | null;
  year: number;
  month: number;
  x_ratio: number | string;
  y_ratio: number | string;
  width_ratio: number | string;
  rotation_deg: number | string;
  flip_x?: boolean | null;
  flip_y?: boolean | null;
  opacity: number | string;
  z_index: number;
  is_visible: boolean;
  asset_id?: string | null;
  sticker_assets:
    | { name: string; file_url: string; file_type: string }[]
    | { name: string; file_url: string; file_type: string }
    | null;
}): StickerInstance {
  const asset = Array.isArray(row.sticker_assets)
    ? row.sticker_assets[0]
    : row.sticker_assets;
  // 텍스트 > 이미지 > 이모지 순으로 종류를 판정한다.
  const text = (row.text_content ?? "").trim();
  const isText = text.length > 0;
  const isImage = !isText && Boolean(row.asset_id && asset?.file_url);
  const kind: StickerInstance["kind"] = isText ? "text" : isImage ? "image" : "emoji";

  return {
    id: row.id,
    kind,
    label: isText ? text : isImage ? (asset?.name ?? "") : (row.emoji ?? ""),
    imageUrl: isImage ? asset?.file_url : undefined,
    assetId: isImage ? (row.asset_id ?? undefined) : undefined,
    textColor: isText ? (row.text_color ?? "#1f2937") : undefined,
    fontWeight: isText ? (row.font_weight ?? 700) : undefined,
    fontFamily: isText ? (row.font_family ?? "sans") : undefined,
    textAlign: isText
      ? ((row.text_align as StickerInstance["textAlign"]) ?? "left")
      : undefined,
    textBg: isText ? (row.text_bg ?? undefined) : undefined,
    italic: isText ? (row.italic ?? false) : undefined,
    outline: row.outline ?? false,
    shadow: row.shadow ?? false,
    year: row.year,
    month: row.month,
    xRatio: Number(row.x_ratio),
    yRatio: Number(row.y_ratio),
    widthRatio: Number(row.width_ratio),
    rotationDeg: Number(row.rotation_deg),
    flipX: row.flip_x ?? false,
    flipY: row.flip_y ?? false,
    opacity: Number(row.opacity),
    zIndex: row.z_index,
    visiblePublicly: row.is_visible
  };
}

// ── 폴백: Supabase 미설정 환경에서 샘플 데이터로 공개 스케줄 구성 ──
function toPublicEvent(event: StudioScheduleEvent): PublicScheduleEvent | null {
  if (event.status === "draft" || event.visibilityScope !== "public") {
    return null;
  }

  return {
    id: event.id,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isAllDay: event.isAllDay,
    isSupport: event.isSupport,
    supportUrl: event.supportUrl,
    publicTitle: event.publicTitle,
    publicDescription: event.publicDescription,
    status: event.status,
    visibilityScope: "public",
    category: event.category,
    tagIds: event.tagIds,
    primaryTagIds: event.primaryTagIds,
    sortOrder: event.sortOrder,
    variantGroupId: event.variantGroupId,
    variantLabel: event.variantLabel
  };
}

function samplePublicSchedule(calendarSlug: string): PublicSchedule {
  const publicEvents =
    calendarSlug === sampleStudioSchedule.calendar.slug
      ? sampleStudioSchedule.events
          .map(toPublicEvent)
          .filter((event): event is PublicScheduleEvent => event !== null)
      : [];

  return {
    calendar: sampleStudioSchedule.calendar,
    events: publicEvents,
    tags: sampleStudioSchedule.tags,
    palette: sampleStudioSchedule.palette,
    supportCampaigns: sampleStudioSchedule.supportCampaigns.filter(
      (campaign) => campaign.isPublic && campaign.isActive
    ),
    stickers: sampleStudioSchedule.stickers.filter((sticker) => sticker.visiblePublicly),
    stickerAssets: sampleStudioSchedule.stickerAssets,
    heartCount: 0
  };
}
