export function getSiteUrl() {
  // 1) 명시 설정값이 최우선(프로덕션에서는 이 값을 Supabase 리다이렉트 허용목록에 등록).
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // 2) Vercel 프로덕션 도메인(배포마다 안 바뀌는 안정적 별칭)이 있으면 안전 폴백으로 사용.
  //    NEXT_PUBLIC_SITE_URL을 깜빡해도 프로덕션 OAuth가 올바른 도메인으로 향하게 한다.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // 3) 로컬 개발 기본값.
  return "http://localhost:3000";
}

export function getOwnerEmail() {
  return normalizeEmail(process.env.OWNER_EMAIL);
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
