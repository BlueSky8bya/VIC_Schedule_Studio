// 새로고침해도 직전에 보던 화면(편집실 달·시청자 미리보기·꾸미기 달)을 복원하기 위한 쿠키.
// 쿠키라서 서버가 렌더 시점에 읽어 "처음부터 올바른 화면"을 그릴 수 있다 → 깜빡임 없음,
// URL을 건드리지 않으니 Next 라우팅/속도에도 영향 없음. (세션 쿠키 — 브라우저 닫으면 초기화.)
export const VIEW_COOKIE = "vic_view";

export type ViewMemory = {
  sy?: number; // 편집실 연도
  sm?: number; // 편집실 월
  v?: 0 | 1; // 시청자 미리보기 여부
  dy?: number; // 꾸미기 연도
  dm?: number; // 꾸미기 월
  dp?: 0 | 1; // 꾸미기에서 "시청자 화면 보기"(미리보기) 중인지
};

// 쿠키 값(문자열) → ViewMemory. 서버/클라 양쪽에서 쓰는 순수 함수.
export function parseViewCookie(raw: string | undefined | null): ViewMemory {
  if (!raw) {
    return {};
  }
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    return obj && typeof obj === "object" ? (obj as ViewMemory) : {};
  } catch {
    return {};
  }
}

// 클라이언트에서 현재 쿠키에 patch를 병합해 다시 쓴다(세션 쿠키).
export function writeViewCookie(patch: ViewMemory) {
  if (typeof document === "undefined") {
    return;
  }
  const current = parseViewCookie(
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${VIEW_COOKIE}=`))
      ?.slice(VIEW_COOKIE.length + 1)
  );
  const next = { ...current, ...patch };
  document.cookie = `${VIEW_COOKIE}=${encodeURIComponent(
    JSON.stringify(next)
  )}; path=/; samesite=lax`;
}
