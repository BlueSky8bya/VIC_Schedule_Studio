# ADR-0008: 시청자 인사이트는 '집계 전용 RPC'로만 연다 (운영 지표는 공개하지 않음)

Status: Accepted
Date: 2026-07-12
Related: `db/migrations/0049_public_broadcast_stats.sql`, `0050_public_broadcast_daily.sql`,
`app/api/public/[calendarSlug]/broadcast/route.ts`, `components/poster/public-insights.tsx`
Supersedes: —

## Context

시청자·비로그인에게도 월별 기록(방송 시간, 일정 구성, 인기 일정)을 보여주기로 했다. 그런데
방송 세션 원본(`broadcast_session`)은 RLS deny-all(운영 데이터: 시작·종료 시각, 방송 제목)이고,
방문/체류 데이터(`visit_session`, `presence_ping`)는 애초에 운영 지표다.

## Considered Options

- A. `broadcast_session`에 anon SELECT 정책을 열고 클라이언트에서 집계 — 세션 원본이 그대로 노출된다. 기각.
- B. 서비스 롤로 읽는 공개 API — `app/api/public`은 service-role 헬퍼 import 금지(ADR-0001). 기각.
- **C. SECURITY DEFINER 집계 함수 (선택)** — 테이블은 계속 deny-all, 함수가 '월별/일별 합계'만 반환.
  anon에게 EXECUTE만 부여. public-loader가 anon 클라이언트로 호출하고, 공개 API가 명시 DTO로 조립.

## Decision

C. 공개 인사이트에 들어갈 수 있는 것은 다음뿐이다.

- 공개 일정 + 태그(공개 로더가 이미 내려주는 값)
- 하트 **집계**(개수는 UI에 노출하지 않는다 — 1위 대비 비율 막대만)
- 방송 **집계**(월별 시간/일수/세션수, 일별 시간) — `get_public_broadcast_stats` / `get_public_broadcast_daily`

**넣지 않는 것**: 방문자 수·최다 방문일·최고 방문 시간대·동시 접속(=관리자 인사이트의 '하이라이트'
패널 기반 데이터). 공개판 하이라이트는 공개 데이터(인기 일정·최다 요일·방송일·다음 방송)로 새로 구성한다.

차트는 관리자 인사이트와 **같은 컴포넌트**를 쓴다(`BroadcastHours`/`StackTrendChart`/`HighlightCards`,
스타일은 `components/studio/insights-charts.css` 공유). 디자인이 두 갈래로 갈라지지 않게.

## Consequences

- 새 공개 지표를 추가하려면 "이건 팬에게 주는 값인가, 운영 지표인가"를 먼저 판정해야 한다.
- 집계 함수는 SECURITY DEFINER라 변경 시 반환 컬럼을 반드시 재검토한다(원본 필드를 실수로 얹지 말 것).
- 휴뱅(REST_TAG) 규칙은 관리자와 동일하게 적용한다 — 휴뱅 일정은 컨텐츠·다음 방송에서 빠지고 '휴뱅 날'로만 센다.

## Revisit Conditions

토리님이 방문자 수를 공개하고 싶다고 하면(그때도 절대 수치보다 추이/비율을 권한다), 또는 캘린더가
2개 이상이 되어 slug별 스코프가 필요해지면.

## Validation

프로덕션 빌드 + 실제 클릭: `/api/public/vic/broadcast`가 월별/일별 집계만 반환하는지, 시트에 하트
개수가 어디에도 안 뜨는지, 방문 기반 카드가 없는지 확인.
