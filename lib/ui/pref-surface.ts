// 글자 설정(크기·굵기·글꼴)의 '화면' — 편집실과 시청자 화면 계열은 서로 완전히 따로 쓴다(2026-10-10 소유자: "시청자 화면에서
// 글씨 크기를 바꾸면 편집실도 바뀐다 — 크기·굵기·글꼴 모두 각각 독립적으로").
//  · studio : 편집실(/studio…)에서 편집 중
//  · viewer : 시청자 화면(/)과 편집실 안의 '시청자 화면 미리보기'(주소는 /studio지만 시청자 화면 계열)
// 편집실이 미리보기를 켜고 끌 때 <html data-pref-surface>를 바꾸고 'vic:pref-surface' 이벤트를 쏜다 — 설정 훅이 그 화면의
// 값을 다시 읽어 입힌다. 표시가 없으면 주소로 가른다. 페인트 전 적용(app/layout.tsx)은 주소 + 미리보기 쿠키(vic_view.v)로 같은 판정.
export type PrefSurface = "studio" | "viewer";
export const PREF_SURFACE_EVENT = "vic:pref-surface";

export function prefSurface(): PrefSurface {
  if (typeof window === "undefined") return "viewer";
  const forced = document.documentElement.dataset.prefSurface;
  if (forced === "studio" || forced === "viewer") return forced;
  return /(^|\/)studio(\/|$)/.test(window.location.pathname) ? "studio" : "viewer";
}

/** 편집실이 부른다 — null이면 표시를 지워 주소 판정으로 돌아간다(편집실을 떠날 때). */
export function setPrefSurface(surface: PrefSurface | null): void {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  const before = prefSurface();
  if (surface) d.dataset.prefSurface = surface;
  else delete d.dataset.prefSurface;
  if (prefSurface() !== before) window.dispatchEvent(new Event(PREF_SURFACE_EVENT));
}

/** 화면별 저장 키 — 시청자 화면은 원래 키(분리 전 값 그대로), 편집실은 '.studio'를 붙인다. */
export function surfaceKey(base: string, surface: PrefSurface = prefSurface()): string {
  return surface === "studio" ? `${base}.studio` : base;
}

/**
 * 분리 전(한 벌) 글꼴·굵기를 편집실 몫으로 한 번 복사한다 — 배포한 날 편집실 글꼴이 갑자기 기본으로 바뀌지 않게.
 * 글씨 크기는 복사하지 않는다: 편집실 값이 없던 기기는 시청자 값을 따라가고 있었고, 그게 바로 고칠 버그였다(기본 14px로 돌아간다).
 * 페인트 전 스크립트(app/layout.tsx)도 같은 일을 먼저 한다.
 */
export const PREF_SPLIT_KEY = "vic.prefSplit";
export function migratePrefSplit(): void {
  try {
    const s = window.localStorage;
    if (s.getItem(PREF_SPLIT_KEY) === "1") return;
    for (const k of ["vic.font", "vic.calWeight"]) {
      const v = s.getItem(k);
      if (v !== null && s.getItem(`${k}.studio`) === null) s.setItem(`${k}.studio`, v);
    }
    s.setItem(PREF_SPLIT_KEY, "1");
  } catch {
    /* 저장소를 못 쓰면 이번 세션은 기본값 */
  }
}
