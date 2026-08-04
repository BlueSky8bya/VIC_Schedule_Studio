// 행동 기록(0062)의 순수 규약 — 종류 목록, 식별 범위, meta 소독. 서버·클라 공용이고 부수효과 없다.
// 테스트: tests/unit/activity-kinds.test.ts

// ── 식별 범위(사용자 결정 2026-08-04) ──
// 내부자만 계정 단위로 남긴다. viewer·비로그인은 account_hash를 **쓰기 시점에 null로 강제**한다
// (읽는 쪽에서 거르는 게 아니라 애초에 저장하지 않는다 → 개인 타임라인이 구조적으로 불가능).
const INTERNAL_ROLES = new Set(["owner", "manager", "worker", "developer"]);
export function isInternalRole(role: string): boolean {
  return INTERNAL_ROLES.has(role);
}
/** 이 역할에 대해 저장할 account_hash. 내부자가 아니면 무조건 null. */
export function accountHashForRole(role: string, hash: string | null): string | null {
  return isInternalRole(role) ? hash : null;
}

export type ActivitySource = "server" | "client";

// ── 종류 ──
// server = 권한을 통과한 실제 변경(진실, 위조 불가). client = 열람·시선(의도, 위조 가능).
// 둘을 섞으면 "고쳤다"와 "고치려 했다"를 구분할 수 없어 source로 나눠 저장한다.
export const SERVER_KINDS = [
  "event.create",
  "event.update",
  "event.delete",
  "event.move",
  "event.reorder",
  "sticker.add",
  "sticker.move",
  "sticker.delete",
  "tag.create",
  "tag.update",
  "tag.delete",
  "support.update",
  "theme.change",
  "unlock.success",
  "unlock.fail",
  // 떡밥 게이트 통과 — grant를 발급하지 않는 '확인 전용' 경로지만 비밀번호를 서버가 검증한다.
  "gate.pass",
  "lock.manual",
  "passcode.change",
  "heart.toggle",
  "hope.toggle"
] as const;

export const CLIENT_KINDS = [
  // 버튼 전수 수집 — target이 버튼 id다. 개별 kind를 버튼마다 만들지 않는 이유: 버튼이 늘 때마다
  // 레지스트리를 고쳐야 하면 결국 일부만 계측되고, "안 쓰이는 버튼"은 계측 안 된 버튼과 구분이 안 된다.
  "ui.click",
  // 모달·패널처럼 라우트가 아닌 화면(그림판·꾸미기·태그·멤버·인사이트…). leave에 dur_ms.
  "section.enter",
  "section.leave",
  "route.enter",
  "route.leave",
  "month.change",
  "event.open",
  "event.close",
  "teaser.open",
  "filter.tag",
  "filter.clear",
  "export.png",
  "export.clipboard",
  "decorate.open",
  "zoom.change",
  "settings.toggle"
] as const;

export type ServerKind = (typeof SERVER_KINDS)[number];
export type ClientKind = (typeof CLIENT_KINDS)[number];
export type ActivityKind = ServerKind | ClientKind;

const SERVER_KIND_SET: ReadonlySet<string> = new Set(SERVER_KINDS);
const CLIENT_KIND_SET: ReadonlySet<string> = new Set(CLIENT_KINDS);

/** 클라이언트가 보낸 kind인지 — 클라는 server kind를 사칭할 수 없다(진실 로그 오염 방지). */
export function isClientKind(kind: string): kind is ClientKind {
  return CLIENT_KIND_SET.has(kind);
}
export function isServerKind(kind: string): kind is ServerKind {
  return SERVER_KIND_SET.has(kind);
}

// 패널 표시용 라벨. 없으면 kind 원문을 그대로 쓴다.
export const KIND_LABEL: Record<string, string> = {
  "ui.click": "버튼",
  "section.enter": "패널 진입",
  "section.leave": "패널 이탈",
  "route.enter": "화면 진입",
  "route.leave": "화면 이탈",
  "month.change": "월 이동",
  "event.open": "일정 열람",
  "event.close": "일정 닫음",
  "teaser.open": "떡밥 열람",
  "gate.pass": "게이트 통과",
  "filter.tag": "태그 필터",
  "filter.clear": "필터 해제",
  "export.png": "PNG 내보내기",
  "export.clipboard": "클립보드 복사",
  "decorate.open": "꾸미기 진입",
  "zoom.change": "확대 조절",
  "settings.toggle": "설정 변경",
  "event.create": "일정 생성",
  "event.update": "일정 수정",
  "event.delete": "일정 삭제",
  "event.move": "일정 이동",
  "event.reorder": "일정 순서 변경",
  "sticker.add": "스티커 추가",
  "sticker.move": "스티커 이동",
  "sticker.delete": "스티커 삭제",
  "tag.create": "태그 생성",
  "tag.update": "태그 수정",
  "tag.delete": "태그 삭제",
  "support.update": "업 도움 수정",
  "theme.change": "테마 변경",
  "unlock.success": "잠금해제 성공",
  "unlock.fail": "잠금해제 실패",
  "lock.manual": "직접 잠금",
  "passcode.change": "비밀번호 변경",
  "heart.toggle": "하트",
  "hope.toggle": "기대돼요"
};

// ── meta 소독 ──
// ⚠ 이 설계의 최우선 제약: 일정 제목·본문은 절대 저장하지 않는다. target에는 uuid만 두고 제목은
// 읽는 시점에 권한을 확인한 뒤 조인한다. 안 그러면 이 테이블이 owner_private 우회 경로가 되어
// 비공개 본문 AES-256-GCM 암호화가 통째로 무의미해진다.
//
// 그래서 meta는 화이트리스트가 아니라 **형태 제한 + 이름 차단**으로 이중으로 막는다:
//   - 값은 원시값(문자열·숫자·불리언) 또는 그 배열만. 중첩 객체 금지(본문이 숨어들 통로).
//   - 문자열은 64자로 자른다(자유 서술을 담을 수 없는 길이).
//   - 아래 이름은 통째로 버린다.
const BLOCKED_META_KEYS = [
  "title",
  "body",
  "note",
  "memo",
  "content",
  "description",
  "text",
  "detail",
  "summary",
  "label",
  "name",
  "email",
  "제목",
  "내용",
  "메모"
];
const MAX_META_KEYS = 12;
const MAX_META_STRING = 64;
const MAX_META_ARRAY = 8;

function isBlockedKey(key: string): boolean {
  const k = key.toLowerCase();
  return BLOCKED_META_KEYS.some((bad) => k === bad || k.includes(bad));
}

type Primitive = string | number | boolean;
function cleanPrimitive(v: unknown): Primitive | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.slice(0, MAX_META_STRING);
  return null;
}

/** 저장 직전 meta 소독. 남길 게 없으면 null(빈 객체를 굳이 쓰지 않는다). */
export function sanitizeMeta(raw: unknown): Record<string, Primitive | Primitive[]> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, Primitive | Primitive[]> = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_META_KEYS) break;
    if (isBlockedKey(key)) continue;
    if (Array.isArray(value)) {
      const arr = value
        .slice(0, MAX_META_ARRAY)
        .map(cleanPrimitive)
        .filter((x): x is Primitive => x !== null);
      if (arr.length === 0) continue;
      out[key] = arr;
      n += 1;
      continue;
    }
    const prim = cleanPrimitive(value);
    if (prim === null) continue; // 중첩 객체·null·함수 등은 버린다
    out[key] = prim;
    n += 1;
  }
  return n > 0 ? out : null;
}

/** target 소독 — uuid·라우트 경로·태그 키 정도. 길이만 제한한다(자유 서술 방지). */
export function sanitizeTarget(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, 120);
  return t.length > 0 ? t : null;
}

/** 보존 기간(일) — 사용자 결정. 조회할 때 지나가며 이보다 오래된 행을 지운다. */
export const ACTIVITY_RETENTION_DAYS = 90;

// 서버 이벤트는 클라의 detectDevice()를 못 쓰므로 User-Agent로 같은 판정을 한다
// (lib/presence/presence-client.ts의 detectDevice와 규칙 동일 — 어긋나면 같은 방문이 두 기기로 보인다).
export function deviceFromUserAgent(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (/Android/i.test(s)) return "android";
  if (/iPhone|iPad|iPod/i.test(s)) return "ios";
  if (/Mobi|Mobile/i.test(s)) return "mobile";
  return "desktop";
}
