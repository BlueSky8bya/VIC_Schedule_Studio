import type { MembershipRole } from "@/lib/domain/schedule-types";

// 플랫폼 개발자 / 슈퍼관리자: 전체 캘린더를 가로질러 시스템을 유지보수한다.
export function isDeveloper(role: MembershipRole) {
  return role === "developer";
}

// 소유자(스트리머) 또는 개발자(시스템 유지보수자)만 일정 데이터를 편집할 수 있다.
export function canEditSchedule(role: MembershipRole) {
  return role === "owner" || role === "developer";
}

// (canDecorate·canManageStickerAssets 삭제 — 달력 꾸미기·스티커 기능 철수, 2026-08-27 ADR-0015.)
// (매니저 역할 철수 2026-09-04 ADR-0018 — 아래 두 자격은 이제 canEditSchedule과 같다. 호출부의
//  '업 도움만/태그만' 분기가 남아 있어 함수는 유지한다.)

// 업 도움(support) 이벤트의 기간/링크 편집 — 소유자·개발자.
export function canEditSupport(role: MembershipRole) {
  return role === "owner" || role === "developer";
}

// 일정별 태그 "할당" 편집(어떤 태그를 붙일지) — 소유자·개발자.
export function canEditEventTags(role: MembershipRole) {
  return role === "owner" || role === "developer";
}

// 비공개 레이어(잠금 해제·비밀번호 확인)를 쓸 수 있는 자격. 소유자·개발자만. 편집실의 비공개 보기 UI는
// ADR-0014로 철수했고, 이 자격은 최초공개 게이트(verifyOnly)·비밀번호 변경에 쓰인다.
export function canUsePrivateLayer(role: MembershipRole) {
  return role === "owner" || role === "developer";
}

// 위 자격이 있고 + 유효한 잠금해제 세션이 있어야 비공개(work/엠바고) 행이 실제로 보인다.
export function canReadPrivateLayer(role: MembershipRole, hasUnlockSession: boolean) {
  return canUsePrivateLayer(role) && hasUnlockSession;
}

// "엠바고"(DB owner_private, 옛 '나만'·'엠바고' 통합) 일정은 소유자 전용. 개발자도 볼 수 없다.
export function canReadOwnerPrivate(role: MembershipRole) {
  return role === "owner";
}
