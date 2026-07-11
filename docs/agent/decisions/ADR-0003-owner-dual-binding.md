# ADR-0003: 오너는 앱(`OWNER_EMAIL`)과 DB(`calendars.owner_id`) 양쪽에 바인딩한다

Status: Accepted
Date: 소급 기록 2026-07-12
Related: `scripts/apply-db.mjs`(app.owner_email/owner_emails 설정), `lib/auth/actor.ts`, RLS 정책

## Context

오너(스트리머 Victory)는 여러 Google 계정을 쓸 수 있고, 서비스 인수인계(개발자 → 스트리머) 시 오너가 바뀐다.
권한 판정은 두 층에 있다: 앱 레벨(역할 해석)과 DB 레벨(RLS 정책의 `calendars.owner_id`).

## Decision

오너 전환 시 **둘 다** 바꾼다.

1. 앱: `OWNER_EMAIL` / `app.owner_emails`(공동 오너 포함)
2. DB: `calendars.owner_id`

## Consequences

한쪽만 바꾸면 앱 UI는 오너로 보이는데 RLS가 쓰기를 거부해 **저장이 조용히 실패**한다(에러 메시지가 권한 문제로
안 보이고 그냥 안 저장된 것처럼 보임 — 실제로 겪은 함정).

## Revisit Conditions

캘린더가 2개 이상(스트리머 다수)이 되면 오너 판정은 환경변수가 아니라 멤버십 테이블로 옮겨야 한다.

## Validation

`tests/unit/owner-email.test.ts`, 오너 계정으로 실제 저장 1건.
