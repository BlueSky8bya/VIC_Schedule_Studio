# Decision Index (ADR)

> 되돌리기 비싼 결정, 또는 "왜 이렇게 했지?"를 다음 에이전트가 다시 물을 결정만 여기 적는다.
> **Accepted ADR은 조용히 뒤집지 않는다.** 충돌하면 먼저 근거를 제시하고, 바꾸기로 하면
> 기존 ADR을 `Superseded`로 바꾸고 대체 ADR을 쓴다. 지우지 않는다.
>
> 소소한 구현 선택은 ADR 대상이 아니다(코드 주석 + git log로 충분).

| ADR | Status | Area | Decision | Revisit Trigger |
|---|---|---|---|---|
| [0001](ADR-0001-public-private-server-boundary.md) | Accepted | 보안 경계 | 공개/비공개는 **서버에서** 분리(전용 public-loader + 명시적 DTO). CSS로 숨기지 않음 | 공개 API에 새 소비자가 생기거나 캐시 계층을 바꿀 때 |
| [0002](ADR-0002-private-content-encryption.md) | Accepted | 프라이버시 | 비공개 일정 본문 AES-256-GCM 저장 암호화, 키=운영자 에스크로우(E2EE 아님) | 위협모델에 "서버 운영자 불신"이 추가되면 |
| [0003](ADR-0003-owner-dual-binding.md) | Accepted | 인증/권한 | 오너 = `OWNER_EMAIL`(앱) **AND** `calendars.owner_id`(RLS) 이중 바인딩 | 멀티 캘린더(스트리머 2인 이상) 지원 시 |
| [0004](ADR-0004-poster-surface-geometry.md) | Accepted | 포스터 | 표면 폭 1840 고정 + 내용에 따라 높이 성장, JS로 뷰포트에 맞춰 스케일 | 포스터를 고정 비율(16:9/4:5) 캔버스로 전환할 때 |
| [0005](ADR-0005-month-routes-cold-entry-only.md) | Accepted | 라우팅 | 스튜디오 월 라우트는 북마크·콜드 진입 전용. 런타임 월 이동은 클라이언트 상태로 | 월별 SSR 데이터가 너무 커져 라우트 분할이 필요해지면 |
| [0006](ADR-0006-optimistic-writes-keepalive-queue.md) | Accepted | 쓰기 경로 | 에디터/꾸미기 낙관적 쓰기는 **직렬 큐** + `keepalive` fetch(`/api/studio-write`, `/api/sticker-write`) | 실시간 협업(다중 편집자 동시 쓰기)을 도입할 때 |
| [0007](ADR-0007-anon-hearts-device-token.md) | Accepted | 참여 | 하트는 비로그인 허용(기기 토큰). 로그인 장벽이 참여 병목이었음 | 어뷰징이 실제로 관측되면 |
| [0008](ADR-0008-public-insights-aggregate-rpc.md) | Accepted | 공개 경계 | 시청자 인사이트는 **집계 전용 SECURITY DEFINER RPC**로만. 방문/체류(운영 지표)는 공개 금지, 하트 개수는 비노출(비율만) | 방문자 지표를 공개하기로 하거나 캘린더가 2개 이상이 되면 |
| [0009](ADR-0009-seasonal-toys-are-opt-in.md) | Accepted | 시즌 연출 | 미니게임·시즌 테마는 **기본 꺼짐 + 클릭 통과 + 오너 테마 우선**. 장난감은 포스터의 뚜껑이 아니다 | 특정 기간 자동 노출을 원하면(좁은 조건으로만) |
