export function getSiteUrl() {
  // 1) 명시 설정값이 최우선(프로덕션은 wrangler.jsonc vars·Workers Builds 변수, Supabase 리다이렉트 허용목록에 등록).
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // 2) 로컬 개발 기본값.
  return "http://localhost:3000";
}

// 소유자 계정 목록. OWNER_EMAIL을 콤마로 구분해 여러 구글 계정을 같은 스트리머의
// 소유자로 인정한다(예: "tory@gmail.com,tory2@gmail.com"). 한 사람이 계정 2개로
// 동일한 owner 권한을 쓰는 경우를 지원한다.
export function getOwnerEmails(): string[] {
  const raw = process.env.OWNER_EMAIL ?? "";
  return raw
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter((email): email is string => Boolean(email));
}

// 주 소유자 = 목록의 첫 번째 계정. seed(0002/0003)가 calendars.owner_id를 이 계정으로
// 잡고, 나머지는 calendar_co_owners로 추가된다.
export function getOwnerEmail() {
  return getOwnerEmails()[0] ?? null;
}

export function isOwnerEmail(email: string | null) {
  return Boolean(email) && getOwnerEmails().includes(email as string);
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isSupabaseServiceConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}
