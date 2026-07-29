# ADR-0012: Phase 0 — 역할 capability matrix와 공개/비공개 불변식 고정

- Status: Accepted
- Date: 2026-07-29
- 상위 결정: ADR-0011(L1~L8), 계획 `docs/ux/audit/vic-schedule-studio-ux-hci-improvement-plan_260729.md`
- 목적: P0 보안 슬라이스들이 공유하는 **한 장의 권한표**. server action, RLS, UI, test가 전부
  이 표를 정본으로 삼는다. UI 숨김은 권한이 아니다 — 최종 강제는 항상 server.

## Capability Matrix

| capability | owner | developer | manager | worker | viewer |
|---|---|---|---|---|---|
| 일정 본문 생성/수정/삭제 | ✅ | ✅(현행 유지, L6) | ❌ | ❌ | ❌ |
| 엠바고(owner_private) 생성/읽기 | ✅(잠금해제 시) | ❌ | ❌ | ❌ | ❌ |
| work(작업자) 일정 읽기 | ✅(잠금해제 시) | ✅(잠금해제 시) | ❌ | ✅(잠금해제 시) | ❌ |
| **비공개 범위 저장** | 잠금해제 시만 | 잠금해제 시만(work) | ❌ | ❌ | ❌ |
| 태그 정의(생성/삭제/색) | ✅ | ✅(L6 현행 유지) | ❌ | ❌ | ❌ |
| 기존 일정 태그 부여(전체6/대표2, L7) | ✅ | ✅ | ✅(공개 일정만) | ❌ | ❌ |
| 업 도움 기간/링크 수정 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 꾸미기(스티커) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 커스텀 이모지 업로드/삭제 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 멤버/패스코드 관리 | ✅ | ✅(유지보수) | ❌ | ❌ | ❌ |
| 공개 포스터 열람 | 전원(익명 포함) | | | | |

## 불변식(P0에서 테스트로 못박을 것)

1. **fail-closed**: 비공개 범위(work/owner_private/legacy embargo)는 어떤 경로(저장·붙여넣기·
   직접 API)로도 잠금 해제 세션 없이 저장되지 않으며, **조용한 public 변환은 금지**(거부+사유).
2. **미리보기 = 서버 공개 스냅샷만**: 낙관적 studio 이벤트의 클라이언트 재가공 금지(떡밥 가림
   우회 방지). 신선도는 미리보기 진입 시 재조회로 해결(ADR-0001/0010과 동일 원칙).
3. **오류 원문 비노출**: DB/드라이버 error.message는 서버 로그 전용. 클라이언트에는 작업 라벨 +
   일반 문구(+ error digest)만. (`lib/utils/safe-action-error.ts`)
4. KST 정본: date_key는 KST 달력 날짜, timestamptz는 UTC 저장 + KST 표시. 주 시작 = 일요일.
5. 삭제 복구(L5): 스낵바 8초 + 최근 삭제 24시간(P0-DATA-1에서 tombstone으로 구현 예정).

## 구현 이력

- 2026-07-29: 불변식 1~3 구현(P0-SEC-1/2/3). 4는 기존 준수 상태 문서화, 5는 미구현(P0-DATA-1).
