# ADR-0001: 공개/비공개는 서버에서 분리한다

Status: Accepted
Date: 소급 기록 2026-07-12 (결정 자체는 프로젝트 초기)
Decision Owners: User (Victory 운영) / Agent-assisted

## Context

이 제품의 핵심 약속: **시청자는 오직 공개 일정 데이터만 받는다.** 비공개·엠바고(owner_private)·작업자(work)·
오너 전용·운영/관리 데이터는 공개 UI와 공개 API에 절대 실려서는 안 된다. 방송 화면 공유 중 유출은 되돌릴 수 없다.

## Considered Options

- **A. 하나의 로더로 다 불러오고 클라이언트에서 필터/CSS로 숨김** — 구현 간단. 그러나 DOM·네트워크 응답에 비공개
  본문이 남아 devtools·캐시·스크린 공유로 새어나간다. 실질적으로 유출.
- **B. 공개 전용 로더 + 명시적 DTO 구성 (선택)** — `app/(public)`·`app/api/public`은 `lib/schedules/public-loader`만
  import 가능. studio-loader·service-role 헬퍼·비공개 DTO import 금지. 객체 스프레드 대신 필드를 명시적으로 조립.
- C. 별도 백엔드 서비스로 물리 분리 — 경계는 가장 확실하나 1인 운영에 비용 과다.

## Decision

B. 서버에서 분리한다. 규칙은 `.claude/rules/public-private-boundary.md`와 `docs/security-boundary.md`에 강제한다.
읽기 권한: public=모두 / work=owner·developer·worker / owner_private=owner만(개발자도 못 읽음). 매니저는 비공개 접근 0.
클라이언트 게이트는 절대 유일한 보호막이 아니다 — 서버 권한 검사를 항상 유지한다.

## Consequences

- 공개 DTO에 필드를 추가할 때마다 "이게 비공개인가"를 매번 판단해야 한다(의도된 마찰).
- 스티커·태그처럼 공개/비공개 양쪽에서 쓰는 데이터는 공개 페이로드에 들어가도 되는지 개별 확인이 필요하다.

## Revisit Conditions

공개 API에 새로운 소비자(외부 위젯·봇)가 생기거나, 캐시 계층을 바꿀 때 경계를 재검증한다.

## Validation

`tests/unit/public-dto.test.ts`, 공개 라우트 응답 점검, 코드 리뷰 시 import 경계 확인.
