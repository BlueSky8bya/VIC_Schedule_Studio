# ADR-0006: 낙관적 쓰기는 직렬 큐 + keepalive fetch로 보낸다

Status: Accepted
Date: 소급 기록 2026-07-12
Related: `app/api/studio-write/route.ts`, `app/api/sticker-write/route.ts`

## Context

편집실·꾸미기는 즉시 반응(낙관적 업데이트)이 핵심 UX다. 두 가지 사고가 반복됐다.

1. 스티커를 옮기거나 카드를 고치고 **바로 달을 넘기거나 창을 닫으면** 저장이 유실됐다.
2. 빠르게 여러 번 조작하면 요청이 서로 앞질러 **마지막 조작이 아닌 것이 DB의 진실**이 됐다
   (하트 배지, 스티커 순서에서 실제로 발생).

## Decision

- 모든 편집 쓰기는 서버 액션 직접 호출이 아니라 **`/api/studio-write` · `/api/sticker-write`** 라우트로 보내고,
  `fetch(..., { keepalive: true })`를 쓴다 → 페이지를 떠나도 브라우저가 전송을 끝까지 보장한다.
- 같은 자원을 건드리는 낙관적 쓰기는 **직렬 큐**(promise chain)에 태운다 → 마지막 조작이 저장의 진실.
- `beforeunload` 경고는 **실제 진행 중인 쓰기가 있을 때만**(고정 타이머 금지, 진행 op를 센다).
- 게이팅은 좁게: 전역 `pending` 같은 넓은 플래그로 무관한 컨트롤을 비활성화하지 않는다.

새 쓰기를 추가할 때는 새 엔드포인트를 만들지 말고 해당 라우트의 **dispatch op**를 추가한다.

## Consequences

- 라우트가 얇은 dispatch 계층이 되어 op가 늘어난다(허용).
- 권한 검사는 각 서버 액션 내부에 그대로 남는다 — 라우트가 새 권한면을 만들지 않는다.

## Revisit Conditions

다중 편집자 실시간 협업을 도입하면 last-write-wins 대신 충돌 병합 전략이 필요하다.
