import type { BroadcastTag, MembershipRole } from "@/lib/domain/schedule-types";

// 단계 배포 제어점: 이 역할들이 분류 v3(2계층 세부·modifier·신설 그룹)를 본다. 현재 전원 노출.
// 다시 좁히려면 역할을 빼면 된다(순서: developer → owner → viewer).
export const TAXONOMY_V3_ROLES: MembershipRole[] = ["developer", "owner", "viewer"];

export function isTaxonomyV3(role: MembershipRole): boolean {
  return TAXONOMY_V3_ROLES.includes(role);
}

// 레거시 뷰(비-v3 역할) — '세부 나누기 이전'의 완전 평탄 상태로 되돌린 태그 목록(공용 데이터는 안
// 바꾸고 뷰만 변환).
//  - v3_only 태그 숨김: 외부출연·별별랭킹·구플뱅·게임 세부 시드(와우 등)
//  - 세부(자식) 전부 숨김 → 평탄. 단 v3 부모(외부출연) 밑 자식은 원래 최상위였던 태그(토크쇼·타스뱅송)
//    이므로 최상위로 되살린다. 그 외 자식(예: 게임>실크송·명조)은 숨긴다.
//  - kind 무시(modifier→content): 합방·시참·대회·짧뱅·풀트뱅을 예전처럼 일반 대분류로
// (조공 비활성·종겜→게임 리네임은 '세부 나누기'가 아니라 그대로 둔다.)
export function legacyTagView(tags: BroadcastTag[]): BroadcastTag[] {
  const v3Ids = new Set(tags.filter((t) => t.v3Only).map((t) => t.id));
  return tags
    .filter((t) => !t.v3Only)
    .filter((t) => !t.parentId || v3Ids.has(t.parentId))
    .map((t) => ({ ...t, parentId: null, kind: "content" as const }));
}

// (tagsForRole 삭제 — isTaxonomyV3 + legacyTagView를 묶던 편의 함수인데 호출자가 0이다.
//  호출부들이 두 함수를 직접 조합해 쓴다. 지금은 전 역할이 v3라 분기 자체가 사실상 항등이다.)
