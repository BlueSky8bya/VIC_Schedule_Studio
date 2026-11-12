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

// 편집실 비밀번호(최초공개 게이트 확인·비밀번호 변경)를 쓸 수 있는 자격. 소유자·개발자만.
// (비공개 보기 UI는 ADR-0014, 비공개 일정·잠금해제 세션은 2026-11-13 0159로 철수.)
export function canUsePrivateLayer(role: MembershipRole) {
  return role === "owner" || role === "developer";
}
