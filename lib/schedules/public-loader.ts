import type {
  BroadcastTag,
  ColorPaletteEntry,
  MemoLine,
  PublicSchedule,
  PublicScheduleEvent,
  StickerAsset,
  StickerInstance
} from "@/lib/domain/schedule-types";
import {
  PRODUCT_TIMEZONE,
  isPosterThemeKey,
  isStickerAssetKind
} from "@/lib/domain/schedule-types";
import type { PosterThemeKey } from "@/lib/domain/schedule-types";
import { getCurrentKstYearMonth } from "@/lib/calendar/month";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { timed } from "@/lib/perf/perf";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
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

// 익명 공개 데이터는 모든 시청자에게 동일하므로 Data Cache에 캐시한다.
// 수백 명이 동시에 봐도 DB는 이 주기마다 한 번만 조회된다(읽기 위주 트래픽 최적화).
//
// 소유자/스태프의 모든 쓰기(일정·태그·스티커·테마·링크·캠페인)는 revalidatePublicSchedule()로
// 이 캐시 태그를 즉시 무효화하므로, 편집 반영은 이 주기와 무관하게 '즉시'다. 이 주기가 늦추는
// 유일한 것은 '다른' 시청자가 보는 하트 집계(인기 단계 배지)뿐 — 하트를 누른 본인은 토글이
// 반환한 최신 수로 즉시 갱신된다. 30초는 불필요하게 짧아 캐시 미스가 잦았고(미스마다 8쿼리를
// 차가운 풀러로 ~4s) anon 페이지 p95를 끌어올렸다. 인기 배지가 몇 분 늦는 건 포스터에서
// 사실상 보이지 않으므로, 주기를 늘려 미스(=느린 DB 왕복) 빈도를 크게 줄인다.
const PUBLIC_SCHEDULE_REVALIDATE_SECONDS = 300;
// 방송시간은 '라이브성' 데이터다 — 방송 중엔 계속 자라고 끝나면 최종값이 확정된다. 서버측 캐시는
// 두지 않는다(집계 RPC 직접 호출): CDN 라우트 캐시 60초와 이중으로 쌓이면 값이 계단식으로 바뀌어
// 시청자가 오류인지 갱신 중인지 구분할 수 없었다. 캐시는 라우트의 s-maxage 한 겹뿐.

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
    loadMyHeartIds(calendarSlug)
  ]);

  return { ...data, myHeartIds };
}

// 떡밥 즉시 공개 — 캐시(30초)를 우회해 DB를 직접 읽는다. 주어진 일정들 중 '공개 시각이 지난'
// 것만 실제 내용으로 돌려준다(서버가 reveal 시각을 강제 확인 → 공개 전엔 가린 stub만 나오므로
// 실제 내용 유출 0). 카운트다운이 0이 되면 클라가 호출 → 캐시 기다림 없이 그 순간 풀린다.
export async function loadRevealedEvents(
  calendarSlug: string,
  eventIds: string[]
): Promise<PublicScheduleEvent[]> {
  if (eventIds.length === 0) return [];
  const supabase = createPublicReadClient();
  if (!supabase) return [];
  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", calendarSlug)
    .eq("is_public", true)
    .maybeSingle();
  if (!calendar) return [];
  const { data: rows } = await supabase
    .from("events")
    .select(
      "id, date_key, end_date_key, link_next, is_support, support_url, start_time, end_time, is_all_day, is_tentative, public_title, public_description, status, sort_order, category, teaser, teaser_reveal_at, event_tags(tag_id, is_primary, sort_order)"
    )
    .is("deleted_at", null) // tombstone 제외(P0-DATA-1)
    .eq("calendar_id", calendar.id)
    .eq("visibility_scope", "public")
    .neq("status", "draft")
    .in("id", eventIds);
  if (!rows) return [];
  const now = Date.now();
  // mapEvent: now>=reveal이면 실제 DTO, 아직이면 가린 stub(teaser=true). 실제로 공개된 것만 반환.
  return (rows as EventRow[]).map((row) => mapEvent(row, now)).filter((e) => !e.teaser);
}

// 익명 공개 묶음 로더 — 캐시된다. myHeartIds는 사용자별이라 여기 포함하지 않는다(빈 배열).
const loadPublicScheduleData = unstable_cache(
  async (calendarSlug: string): Promise<PublicSchedule> => {
    const supabase = createPublicReadClient();
    const { year, month } = getCurrentKstYearMonth();

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
        stickers: [],
        stickerAssets: [],
        heartCount: 0,
        myHeartIds: []
      };
    }

    // RLS 공개 정책이 1차 방어선이지만, 쿼리에서도 명시적으로 공개분만 조회한다.
    // (P2-PROTO-1: support_campaigns 쿼리 제거 — UI 소비자가 0인 죽은 payload였다.
    //  업 도움은 이벤트 단위(is_support/support_url)가 정본.)
    const [tagsRes, paletteRes, eventsRes, stickersRes, assetsRes, heartsRes, eventHeartsRes] =
      await timed("publicSchedule:db(7 parallel queries)", () =>
        Promise.all([
        // 모든 공개 쿼리를 이 캘린더로 한정한다. RLS는 공개 행을 허용할 뿐 캘린더별로
        // 막지 않으므로, 캘린더가 2개 이상이 되면 application-level 스코프가 없으면 다른
        // 공개 캘린더의 태그·팔레트·일정·스티커가 섞인다(공개 데이터끼리의 교차 혼입).
        supabase
          .from("broadcast_tags")
          .select("id, tag_key, display_name, color_key, bg_hex, sort_order, is_default, is_active, parent_id, kind, v3_only")
          .eq("calendar_id", calendar.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("color_palette")
          .select("key, name, bg_color, text_color, border_color, sort_order")
          .eq("calendar_id", calendar.id)
          .order("sort_order"),
        supabase
          .from("events")
          .select(
            "id, date_key, end_date_key, link_next, is_support, support_url, start_time, end_time, is_all_day, is_tentative, public_title, public_description, status, sort_order, category, teaser, teaser_reveal_at, event_tags(tag_id, is_primary, sort_order)"
          )
          .is("deleted_at", null)
          .eq("calendar_id", calendar.id)
          .eq("visibility_scope", "public")
          .neq("status", "draft")
          .order("date_key")
          .order("created_at"),
        supabase
          .from("sticker_instances")
          .select(
            "id, emoji, text_content, text_color, font_weight, font_family, text_align, text_bg, text_fx, italic, outline, shadow, anim, shape_key, locked, year, month, x_ratio, y_ratio, width_ratio, rotation_deg, flip_x, flip_y, opacity, z_index, is_visible, asset_id, sticker_assets(name, file_url, file_type)"
          )
          .eq("calendar_id", calendar.id)
          .eq("is_visible", true),
        supabase
          .from("sticker_assets")
          .select("id, name, file_url, file_type, kind, sort_order")
          .eq("calendar_id", calendar.id)
          // 사용자가 팔레트에서 드래그로 정한 순서가 먼저. 동률이면 최신순(업로드 직후 앞으로).
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("calendar_hearts")
          .select("count")
          .eq("calendar_id", calendar.id)
          .maybeSingle(),
        // A: 일정별 관심 집계(공개 안전 — user_id 비노출). 함수가 공개 일정만 집계한다.
        supabase.rpc("get_event_heart_counts", { p_calendar_id: calendar.id })
        ])
      );

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
        ...mapEvent(row, Date.now()),
        heartCount: heartCountByEvent.get(row.id) ?? 0
      })),
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
// RLS가 본인 행으로 제한하지만, 캘린더 교차 혼입을 막기 위해 events→calendars 조인으로
// 이 캘린더(slug)의 일정으로 한정한다.
async function loadMyHeartIds(calendarSlug: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }
  const { data } = await supabase
    .from("event_hearts")
    .select("event_id, events!inner(calendars!inner(slug))")
    .eq("events.calendars.slug", calendarSlug);
  return ((data as { event_id: string }[] | null) ?? []).map((row) => row.event_id);
}

function mapStickerAsset(row: {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  kind?: string | null;
  sort_order?: number | null;
}): StickerAsset {
  return {
    id: row.id,
    name: row.name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    kind: isStickerAssetKind(row.kind) ? row.kind : "static",
    sortOrder: Number(row.sort_order ?? 0)
  };
}

// (P2-KST-1: currentKstYearMonth 중복 제거 — lib/calendar/month.ts의 getCurrentKstYearMonth 사용.)

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
  is_tentative: boolean | null;
  public_title: string;
  public_description: string | null;
  status: PublicScheduleEvent["status"];
  sort_order: number;
  category: PublicScheduleEvent["category"];
  teaser: boolean | null;
  teaser_reveal_at: string | null;
  event_tags: Array<{ tag_id: string; is_primary: boolean; sort_order: number }> | null;
};

function mapEvent(row: EventRow, nowMs: number): PublicScheduleEvent {
  const tags = [...(row.event_tags ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  // 떡밥: 공개 시각 전이면 제목·태그·카테고리·기간을 통째로 가린 DTO만 내보낸다(유출 방지).
  // 시청자는 전용 떡밥 룩 + 공개까지 카운트다운만 본다. 공개 시각이 지나면 아래 평범한 DTO로.
  const revealMs = row.teaser && row.teaser_reveal_at ? Date.parse(row.teaser_reveal_at) : 0;
  if (revealMs && nowMs < revealMs) {
    return {
      id: row.id,
      startsAt: toKstIso(row.date_key, null),
      isAllDay: true,
      isTentative: false,
      publicTitle: "", // 가림 — 클라가 전용 룩으로 렌더
      status: row.status,
      visibilityScope: "public",
      category: "stream", // 실제 카테고리도 가린다(중립값)
      tagIds: [],
      primaryTagIds: [],
      sortOrder: row.sort_order,
      teaser: true,
      teaserRevealAt: new Date(revealMs).toISOString()
    };
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

function mapSticker(row: {
  id: string;
  emoji: string | null;
  text_content?: string | null;
  text_color?: string | null;
  font_weight?: number | null;
  font_family?: string | null;
  text_align?: string | null;
  text_bg?: string | null;
  text_fx?: string | null;
  italic?: boolean | null;
  outline?: boolean | null;
  shadow?: boolean | null;
  anim?: string | null;
  shape_key?: string | null;
  locked?: boolean | null;
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
  // 텍스트 > 이미지 > 도형 > 이모지 순으로 종류를 판정한다.
  const text = (row.text_content ?? "").trim();
  const isText = text.length > 0;
  const isImage = !isText && Boolean(row.asset_id && asset?.file_url);
  const isShape = !isText && !isImage && Boolean(row.shape_key);
  const kind: StickerInstance["kind"] = isText
    ? "text"
    : isImage
      ? "image"
      : isShape
        ? "shape"
        : "emoji";

  return {
    id: row.id,
    kind,
    label: isText
      ? text
      : isImage
        ? (asset?.name ?? "")
        : isShape
          ? (row.shape_key ?? "")
          : (row.emoji ?? ""),
    imageUrl: isImage ? asset?.file_url : undefined,
    assetId: isImage ? (row.asset_id ?? undefined) : undefined,
    shapeKey: isShape ? (row.shape_key ?? undefined) : undefined,
    // 도형도 text_color를 fill로 재사용 → 텍스트/도형 모두 textColor를 채운다.
    textColor: isText || isShape ? (row.text_color ?? "#1f2937") : undefined,
    fontWeight: isText ? (row.font_weight ?? 700) : undefined,
    fontFamily: isText ? (row.font_family ?? "sans") : undefined,
    textAlign: isText
      ? ((row.text_align as StickerInstance["textAlign"]) ?? "left")
      : undefined,
    textBg: isText ? (row.text_bg ?? undefined) : undefined,
    textFx: isText ? ((row.text_fx as StickerInstance["textFx"]) ?? undefined) : undefined,
    italic: isText ? (row.italic ?? false) : undefined,
    outline: row.outline ?? false,
    shadow: row.shadow ?? false,
    anim: (row.anim as StickerInstance["anim"]) ?? undefined,
    locked: row.locked ?? false,
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

// ── 폴백: Supabase 미설정 환경에서 공개 샘플 데이터로 공개 스케줄 구성 ──
// 데이터는 공개 전용 파일(`sample-public-data`)에서 이미 공개 안전 형태(공개 일정·공개 업도움·공개
// 스티커만)로 온다 → 여기선 스튜디오 데이터를 만지지 않는다(공개 경계). 슬러그가 다르면 일정만 비운다.
function samplePublicSchedule(calendarSlug: string): PublicSchedule {
  return {
    ...samplePublicScheduleData,
    events:
      calendarSlug === samplePublicScheduleData.calendar.slug
        ? samplePublicScheduleData.events
        : []
  };
}

// ── 공개 방송 기록(시청자 인사이트) ────────────────────────────────────────
// broadcast_session 테이블은 RLS deny-all이라 시청자가 직접 못 읽는다(운영 데이터). 대신 집계만
// 내주는 SECURITY DEFINER RPC(get_public_broadcast_stats, 0049)를 anon 클라이언트로 호출한다.
// 나가는 값은 '월별 시간/방송일수/세션수'뿐 — 개별 세션(시작·종료 시각, 방송 제목)은 절대 안 나간다.
export type PublicBroadcastMonth = {
  ym: string; // "2026-07" (KST 시작일 귀속)
  hours: number; // 그 달 총 방송시간(시간, 소수 1자리)
  days: number; // 방송한 날 수
  sessions: number; // 방송 횟수
};

// 서버측 unstable_cache를 걷어내고 RPC를 직접 부른다 — CDN 캐시(라우트 60초)와 이중으로 쌓이면
// 값이 최대 2분에 걸쳐 계단식으로 바뀌어, 보는 사람이 오류인지 갱신 중인지 구분할 수 없었다.
// 집계 RPC는 가볍고 CDN이 초당 1회 미만으로만 흘려보내므로 서버 캐시 없이도 부하 문제 없음.
const loadPublicBroadcastStats = async (fromDay: string): Promise<PublicBroadcastMonth[]> => {
    const supabase = createPublicReadClient();
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.rpc("get_public_broadcast_stats", {
      p_from_day: fromDay
    });
    if (error || !data) {
      return [];
    }
    // 명시적 DTO 구성(스프레드 금지 — 공개 경계를 넘는 값은 하나하나 고른다).
    return (data as { ym: string; hours: number; days: number; sessions: number }[]).map((row) => ({
      ym: String(row.ym),
      hours: Number(row.hours ?? 0),
      days: Number(row.days ?? 0),
      sessions: Number(row.sessions ?? 0)
    }));
};

// 최근 N개월(이번 달 포함) 방송 기록. 시청자·비로그인 모두 볼 수 있다.
export async function getPublicBroadcastStats(months = 6): Promise<PublicBroadcastMonth[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const { year, month } = getCurrentKstYearMonth();
  const from = new Date(Date.UTC(year, month - 1 - (months - 1), 1));
  const fromDay = from.toISOString().slice(0, 10);
  return loadPublicBroadcastStats(fromDay);
}

// 일별 방송시간(그 달) — 관리자 인사이트와 같은 일별 막대를 시청자에게도 그리기 위해.
// 역시 집계 RPC(0050)만 호출한다: (KST 시작일, 시간)뿐, 세션 원본은 안 나간다.
const loadPublicBroadcastDaily = async (
  fromDay: string,
  toDay: string
): Promise<{ day: string; hours: number }[]> => {
    const supabase = createPublicReadClient();
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.rpc("get_public_broadcast_daily", {
      p_from_day: fromDay,
      p_to_day: toDay
    });
    if (error || !data) {
      return [];
    }
    return (data as { day: string; hours: number }[]).map((row) => ({
      day: String(row.day),
      hours: Number(row.hours ?? 0)
    }));
};

// 이번 달 1일~말일의 일별 방송시간(길이 = 그 달 일수, 방송 없는 날은 0).
export async function getPublicBroadcastDaily(year: number, month: number): Promise<number[]> {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!isSupabaseConfigured()) {
    return new Array(daysInMonth).fill(0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const rows = await loadPublicBroadcastDaily(
    `${year}-${pad(month)}-01`,
    `${year}-${pad(month)}-${pad(daysInMonth)}`
  );
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r.hours]));
  return Array.from({ length: daysInMonth }, (_, i) =>
    byDay.get(`${year}-${pad(month)}-${pad(i + 1)}`) ?? 0
  );
}
