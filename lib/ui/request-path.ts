// 미들웨어가 요청 경로를 서버 컴포넌트에 넘기는 헤더(loading.tsx는 목적지 경로를 직접 알 수 없다).
export const VIC_PATH_HEADER = "x-vic-path";

/** 문서형 페이지 — 로딩 화면을 달력·편집실 뼈대 대신 문서 틀로. */
export const LEGAL_PATHS = new Set(["/privacy", "/terms"]);

/** 문서 경로 → 로딩 문구의 목적지 이름("개인정보처리방침 불러오는 중…"). */
export const LEGAL_TITLES: Record<string, string> = { "/privacy": "개인정보처리방침", "/terms": "이용약관" };
