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

// 업 도움(support) 이벤트의 기간/링크 편집. 매니저는 "방송 운영" 역할이라 업 도움 정보를 손볼 수 있다.
// (일반 일정 자체의 생성/수정/삭제는 여전히 canEditSchedule = owner/developer 전용)
export function canEditSupport(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager";
}

// 일정별 태그 "할당" 편집(어떤 태그를 붙일지). 매니저는 방송 분류가 업무라 허용한다.
// 태그 자체의 생성/삭제/색상 변경은 여전히 canEditSchedule = owner/developer 전용.
export function canEditEventTags(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager";
}

// 비공개 레이어(잠금 해제·비밀번호 확인)를 쓸 수 있는 자격. 소유자·개발자만. 매니저는 비공개를 전혀
// 보지 못한다(공개 일정만). (작업자 역할은 2026-08-27 철수 — ADR-0015.) 편집실의 비공개 보기 UI는
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
