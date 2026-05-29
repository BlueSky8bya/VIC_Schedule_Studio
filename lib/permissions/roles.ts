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

// 커스텀 이모지(스티커 에셋) 업로드/삭제 — 소유자·개발자·작업자만(매니저 제외). 매니저는 "방송 운영"
// 역할이라 기존 이모지로 꾸미기'만' 한다(라이브러리 관리·파괴적 삭제는 못 함). 겸직(매니저+작업자,
// effective=manager)은 isWorker로 작업자 권한을 인정해 허용한다.
export function canManageStickerAssets(role: MembershipRole, isWorker: boolean) {
  return role === "owner" || role === "developer" || role === "worker" || isWorker === true;
}

// 업 도움(support) 이벤트의 기간/링크 편집. 매니저는 "방송 운영" 역할이라 업 도움 정보를 손볼 수
// 있지만, 작업자(worker)는 "제작"(에셋/꾸미기) 역할이라 업 도움은 읽기 전용이다.
// (일반 일정 자체의 생성/수정/삭제는 여전히 canEditSchedule = owner/developer 전용)
export function canEditSupport(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager";
}

// 일정별 태그 "할당" 편집(어떤 태그를 붙일지). 매니저는 방송 분류가 업무라 허용한다.
// 태그 자체의 생성/삭제/색상 변경은 여전히 canEditSchedule = owner/developer 전용.
export function canEditEventTags(role: MembershipRole) {
  return role === "owner" || role === "developer" || role === "manager";
}

// 비공개 레이어(잠금 해제)를 쓸 수 있는 자격. 소유자·개발자·작업자만. 매니저는 비공개를 전혀
// 보지 못한다(공개 일정만). 작업자 겸직(매니저+작업자, effective=manager)도 isWorker로 인정한다.
export function canUsePrivateLayer(role: MembershipRole, isWorker: boolean) {
  return role === "owner" || role === "developer" || role === "worker" || isWorker === true;
}

// 위 자격이 있고 + 유효한 잠금해제 세션이 있어야 비공개(작업자/엠바고) 행이 실제로 보인다.
export function canReadPrivateLayer(
  role: MembershipRole,
  isWorker: boolean,
  hasUnlockSession: boolean
) {
  return canUsePrivateLayer(role, isWorker) && hasUnlockSession;
}

// "엠바고"(DB owner_private, 옛 '나만'·'엠바고' 통합) 일정은 소유자 전용. 개발자도 볼 수 없다.
export function canReadOwnerPrivate(role: MembershipRole) {
  return role === "owner";
}

export function assertOwner(role: MembershipRole) {
  if (!canEditSchedule(role)) {
    throw new Error("Only owner or developer can mutate schedule data.");
  }
}
