# ADR-0005: 스튜디오 월 라우트는 북마크·콜드 진입 전용이다

Status: Accepted
Date: 소급 기록 2026-07-12
Related: `app/(studio)/studio/calendar/[year]/[month]`, `app/(studio)/studio/decorate/[year]/[month]`

## Context

`/studio/calendar/2026/7` 같은 월 라우트가 존재한다. 월을 넘길 때마다 라우트를 이동시키면 서버 왕복·스트리밍
로딩·스크롤/선택 상태 초기화가 매번 발생해 편집실이 답답해진다(몰입 저하 = 이 제품에서는 회귀).

## Decision

월 라우트는 **북마크/콜드 진입에만** 쓴다. 런타임 월 이동은 클라이언트 상태로 처리하고, 마지막으로 보던 달은
쿠키(`VIEW_COOKIE`)로 복원한다. **라우트 기반 월 전환을 다시 넣지 않는다.**

## Consequences

- URL은 진입 시점의 달을 가리키고, 이후 월 이동과 동기화되지 않는다(의도된 트레이드오프).
- 월 데이터는 클라이언트가 이미 들고 있거나 필요 시 액션으로 가져온다.

## Revisit Conditions

월별 데이터가 한 번에 들고 있기 부담스러울 만큼 커지면 재검토.
