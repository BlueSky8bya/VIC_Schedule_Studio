// 비밀번호를 잊었을 때의 본인 확인 — "방금 구글로 다시 로그인했는가".
// 현재 비밀번호 대신 쓰는 증명이라 창을 짧게 둔다: 다시 로그인한 뒤 10분 안에만 새 비밀번호를 정할 수 있다.
// last_sign_in_at은 Supabase Auth가 로그인(OAuth 왕복)이 끝날 때 적는 시각이다.
export const RECENT_LOGIN_WINDOW_MS = 10 * 60_000;

/** 다시 로그인하러 보내는 주소 — 돌아오면 편집실이 '비밀번호 다시 만들기' 창을 바로 연다(studio-shell). */
export const PASSCODE_RESET_LOGIN_HREF = `/api/auth/login?next=${encodeURIComponent("/studio?passcode=reset")}`;

export function signedInRecently(user: { last_sign_in_at?: string | null } | null | undefined, now: number = Date.now()): boolean {
  const at = user?.last_sign_in_at ? Date.parse(user.last_sign_in_at) : Number.NaN;
  // 시계 차이로 살짝 미래로 찍힌 값은 허용하되(1분), 그보다 미래면 믿지 않는다.
  return Number.isFinite(at) && now - at <= RECENT_LOGIN_WINDOW_MS && at - now <= 60_000;
}
