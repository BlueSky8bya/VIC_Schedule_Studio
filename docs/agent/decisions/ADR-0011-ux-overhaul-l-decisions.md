# ADR-0011: 전면 UX/HCI 개선 계획의 L1~L8 사용자 결정

- Status: Accepted
- Date: 2026-07-29
- 근거 문서: `docs/ux/audit/vic-schedule-studio-ux-hci-improvement-plan_260729.md` (코덱스 설계안, §L)
- 결정자: 사용자(개발자, blackspace665)

## 결정 내용

| # | 항목 | 결정 |
|---|---|---|
| L1 | 하루 일정 개수 | **무제한 유지.** hard cap 없음. 달력 칸 표시만 대표 2 + `+n`으로 정리 |
| L2 | 제목/부제목 모델 | **줄바꿈 계약 유지**(첫 줄=제목, 이후=세부). 필드 분리/백필 안 함. 도움말·줄수 안내·미리보기만 보강 |
| L3 | 저장 정책 | 권장안: 일정 body/scope/publish는 명시 `일정 저장`. **모든 미저장 일정 draft는 memory-only**(localStorage 영속 중단 + legacy key purge). dirty 시 in-app navigation 경고 |
| L4 | iPad 세로 기본 표현 | 권장안: **compact 월 개요 + 선택일 아젠다 + bottom sheet** |
| L5 | 삭제 복구 보존 | 권장안: 스낵바 실행취소 8초 + `최근 삭제` same-ID 복구 24시간 + 이후 자동 hard purge. 잠금 상태에선 제목/본문 비노출 |
| L6 | developer 운영 권한 | **현행 유지(권장안 아님):** developer는 태그 생성/삭제/색변경 가능 + 잠금해제 시 work 일정 열람 가능. 단 일정 본문 편집과 owner_private(엠바고) 읽기/쓰기는 계속 금지 — 이 경계를 server/RLS/fixture로 명시 고정 |
| L7 | 태그 상한 | 권장안: 태그 부여 권한자(owner·manager) 공통 **전체 6 / 대표(primary) 2**. server reject + transaction으로 강제(클라 slice 금지). manager는 태그 정의/색 변경·private 부여 불가 유지 |
| L8 | 잠금해제 범위 | 권장안: account-global 폐기 → **브라우저 auth-session 단위 grant**. 다른 기기/세션은 따로 잠김. `지금 잠그기`=현 세션 revoke+탭 purge, `모든 세션 잠그기` 별도. opaque token은 HttpOnly cookie, private 접근은 server-only gateway, direct client private GRANT/RLS 폐쇄 |

## 함의

- L6로 인해 계획서의 `P0-AUTH-1` 범위 중 "developer 태그 정의 회수"는 **적용하지 않는다**.
  CLAUDE.md의 developer 태그 정의·work 열람 서술이 정본이며, 충돌하는 "diagnostics-only" 서술을
  Phase 0 capability matrix에서 현행 유지 방향으로 정리한다.
- L2로 인해 `P1-TITLE-1`의 데이터 마이그레이션 분기는 제외되고 저비용 대안(도움말/미리보기)만 남는다.
- L1로 인해 하루 개수 서버 제약/마이그레이션은 하지 않는다.

## Revisit Trigger

- 신뢰 멤버가 늘어나 shared-device 위협이 커지면 L6 재검토.
- 부제목 관련 사용자 혼란/요청이 반복되면 L2(필드 분리) 재검토.
