import type { SupabaseClient } from "@supabase/supabase-js";

// P0-AUTH-1: 일정/태그/업도움 입력의 서버 검증 모음.
// 클라이언트는 UI로 이미 제한하지만, 여기의 검증이 최종 방어다(직접 API 호출 포함).
// 원칙: 조용히 자르지(slice) 않고 **거부**한다 — 잘림은 "저장됐는데 내가 고른 것과 다름"이라는
// 더 나쁜 결과를 만든다(ADR-0012 불변식 1과 같은 fail-closed 사상).

// 이벤트당 콘텐츠 태그 상한(전체 6 / 대표 2 — ADR-0011 L7, owner·manager 공통).
export const MAX_EVENT_TAGS = 6;
export const MAX_PRIMARY_TAGS = 2;

export type Validation = { ok: true } | { ok: false; error: string };

/** YYYY-MM-DD(KST 달력 날짜) 형식 검사. 빈 값은 허용(호출부가 optional 처리). */
export function validateDateKey(key: string | undefined | null, label: string): Validation {
  if (!key) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return { ok: false, error: `${label} 날짜 형식이 올바르지 않습니다.` };
  }
  return { ok: true };
}

/**
 * 업 도움 링크 검증 — https만 허용(javascript:/data:/http: 전부 거부).
 * 링크는 공개 포스터에서 시청자가 그대로 클릭하는 값이라 스킴 검증이 필수다.
 * (특정 호스트 allowlist는 운영 중인 링크 host 목록을 조사한 뒤 별도 슬라이스에서 —
 *  지금 좁히면 기존 정상 링크를 깨뜨릴 수 있다.)
 */
export function validateSupportUrl(url: string | undefined | null): Validation {
  const trimmed = url?.trim();
  if (!trimmed) return { ok: true }; // 링크 없음 = 허용(기간만 있는 업 도움)
  if (trimmed.length > 2048) {
    return { ok: false, error: "업 도움 링크가 너무 깁니다." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "업 도움 링크가 올바른 주소가 아닙니다." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "업 도움 링크는 https 주소만 쓸 수 있습니다." };
  }
  return { ok: true };
}

/**
 * 태그 할당 payload 검증 — 개수/중복/대표 부분집합 + **이 캘린더의 활성 태그인지** DB 확인.
 * 남의 캘린더 태그 id·비활성 태그·존재하지 않는 id를 service-role 쓰기 전에 걸러낸다.
 */
export async function validateTagAssignment(
  db: SupabaseClient,
  calendarId: string,
  tagIds: string[],
  primaryTagIds: string[]
): Promise<Validation> {
  if (tagIds.length > MAX_EVENT_TAGS) {
    return { ok: false, error: `태그는 일정당 최대 ${MAX_EVENT_TAGS}개까지입니다.` };
  }
  if (new Set(tagIds).size !== tagIds.length) {
    return { ok: false, error: "같은 태그가 중복으로 들어왔습니다." };
  }
  const primary = primaryTagIds.filter((id) => tagIds.includes(id));
  if (primary.length !== primaryTagIds.length) {
    return { ok: false, error: "대표 태그는 선택한 태그 중에서만 고를 수 있습니다." };
  }
  if (primaryTagIds.length > MAX_PRIMARY_TAGS) {
    return { ok: false, error: `대표 태그는 최대 ${MAX_PRIMARY_TAGS}개까지입니다.` };
  }
  if (tagIds.length === 0) return { ok: true };
  const { data, error } = await db
    .from("broadcast_tags")
    .select("id")
    .eq("calendar_id", calendarId)
    .eq("is_active", true)
    .in("id", tagIds);
  if (error) {
    return { ok: false, error: "태그 확인에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }
  if ((data?.length ?? 0) !== tagIds.length) {
    return { ok: false, error: "이 달력에 없는(또는 비활성) 태그가 포함돼 있습니다." };
  }
  return { ok: true };
}
