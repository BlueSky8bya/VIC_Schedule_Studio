import type { MembershipRole } from "@/lib/domain/schedule-types";

// 플랫폼 개발자 / 슈퍼관리자: 전체 캘린더를 가로질러 시스템을 유지보수한다.
export function isDeveloper(role: MembershipRole) {
  return role === "developer";
}

// 소유자(스트리머) 또는 개발자(시스템 유지보수자)만 일정 데이터를 편집할 수 있다.
export function canEditSchedule(role: MembershipRole) {
  return role === "owner" || role === "developer";
}

// 꾸미기(스티커 장식)는 일정 데이터 편집과 별개다. 소유자·개발자에 더해
// 신뢰 멤버(매니저·작업자)도 스티커를 추가/이동/삭제할 수 있다.
// (일정·태그·멤버 편집은 여전히 canEditSchedule = owner/developer 전용)
export function canDecorate(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager" || role === "worker";
}

// 후원(support) 이벤트의 기간/링크 편집. 매니저는 "방송 운영" 역할이라 후원 정보를 손볼 수
// 있지만, 작업자(worker)는 "제작"(에셋/꾸미기) 역할이라 후원은 읽기 전용이다.
// (일반 일정 자체의 생성/수정/삭제는 여전히 canEditSchedule = owner/developer 전용)
export function canEditSupport(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager";
}

// 일정별 태그 "할당" 편집(어떤 태그를 붙일지). 매니저는 방송 분류가 업무라 허용한다.
// 태그 자체의 생성/삭제/색상 변경은 여전히 canEditSchedule = owner/developer 전용.
export function canEditEventTags(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager";
}

// 비공개 레이어를 볼 수 있는 사람(소유자, 개발자, 신뢰 멤버)이라도
// 엠바고/작업/owner_private 행이 보이려면 유효한 잠금해제 세션이 필요하다.
export function canReadPrivateLayer(role: MembershipRole, hasUnlockSession: boolean) {
  return (
    (role === "developer" ||
      role === "owner" ||
      role === "manager" ||
      role === "worker") &&
    hasUnlockSession
  );
}

// owner_private("나만") 일정은 소유자 전용이다. 개발자(superadmin)도 볼 수 없다.
export function canReadOwnerPrivate(role: MembershipRole) {
  return role === "owner";
}

export function assertOwner(role: MembershipRole) {
  if (!canEditSchedule(role)) {
    throw new Error("Only owner or developer can mutate schedule data.");
  }
}
