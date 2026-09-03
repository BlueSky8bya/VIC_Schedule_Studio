# ADR-0018 — 신뢰 멤버(매니저) 기능 철수: 역할은 개발자·관리자·시청자 셋

Status: Accepted
- Date: 2026-09-04
- Supersedes(부분): ADR-0015의 "신뢰 멤버 = 매니저 한 종류" 조항 → 신뢰 멤버 자체가 없다. ADR-0012 capability
  matrix의 manager 행 폐기.
- 관련: 0074 마이그레이션, `lib/permissions/roles.ts`, `lib/auth/actor.ts`, CLAUDE.md "Roles & permissions"

## 맥락

관리자(사용자) 결정 2026-09-04: "멤버 관리 기능 아예 프로젝트에서 삭제 — 개발자, 관리자, 시청자만 딱 남긴다."
데이터도 같은 말을 한다 — 프로덕션 `trusted_members` **0행**(활성 0, 2026-09-04 실측; 2026-08-27 ADR-0015 때도 0명).
매니저 전용 UI(업 도움 수정 시트·모바일 태그 수정 시트·읽기전용 상세의 태그 토글·매니저 관리 접이·역할
미리보기 '매니저 화면'·권한 표)는 전부 쓰이지 않는 코드였다.

## 결정

1. **역할 셋**: `MembershipRole = "developer" | "owner" | "viewer"`. actor 판정에서 `trusted_members` 조회 삭제
   (`trustedRole`·`isManager` 필드 삭제). `canEditSupport`·`canEditEventTags`는 owner/developer(= canEditSchedule)
   — 호출부 분기 호환을 위해 함수는 남긴다.
2. **코드 삭제**: `/studio/trusted-members` 라우트, `components/trusted-members/*`, `lib/trusted-members/actions.ts`,
   편집실의 매니저 전용 시트 2종·모바일 '매니저 관리' 접이·`panel=members` 딥링크·모달 `members`, 설정의 '멤버
   관리 열기', 역할 미리보기의 '매니저 화면', 인사이트의 members 목록·겸업 표식 조회, 활동 로그의 신뢰 멤버
   이메일 해석, 실시간 접속자 패널의 매니저 행, fixture `role=manager`, 매니저 비주얼 기준선·권한 표 테스트.
3. **DB(0074)**: `trusted_members` drop(cascade) · enum `trusted_role` drop · `is_active_trusted_member()` drop.
   `is_active_worker()`는 정책이 참조하는 항상-false 스텁이라 유지. 참조 정책 0·행 0을 실측한 뒤 적용.
4. **과거 기록 판독용 문자열은 남긴다**: 활동 라벨 사전(`role-preview-manager`, `/studio/trusted-members`, ROLE_ORDER
   의 manager/worker), 인사이트 역할 라벨(`SESSION_ROLE_LABEL` 등), `INTERNAL_ROLES` — 옛 행이 "이름 미등록"으로
   떨어지지 않게. 새 값은 더 생기지 않는다.
5. 공개 API DTO 변화 없음(공개 경계 무영향). 스키마 변화는 CHANGELOG_AGENT에 기록.

## 배포 순서

코드 push → (옛 코드는 조회 실패를 삼켜 화면이 안 깨지므로) 바로 0074 적용 가능. 실제로 push 뒤 적용했다.

## 되돌릴 조건

관리자가 다시 보조 역할을 원할 때. 코드는 git 이력(이 ADR 날짜 커밋 직전), 스키마는 0001·0022·0065의 정의로
새 마이그레이션 재생성(데이터 0행이라 복원할 것 없음).
