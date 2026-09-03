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
| [0009](ADR-0009-seasonal-toys-are-opt-in.md) | Superseded | 시즌 연출 | 미니게임·시즌 테마는 **기본 꺼짐 + 클릭 통과 + 오너 테마 우선**. 장난감은 포스터의 뚜껑이 아니다 | 특정 기간 자동 노출을 원하면(좁은 조건으로만) | ← 2026-08-27 월드컵 기능 전부 삭제(CHG-20260827-002)
| [0010](ADR-0010-broadcast-panel-public-dto-only.md) | Accepted | 보안 경계 | 방송 판서는 **서버 공개 스냅샷→명시 DTO만**(spread 금지) + teaser fail-closed 마스킹 + 클라이언트 무저장 | 판서에 낙관적 실시간 반영이 필요해지면(공유 redaction 추출 방향) |
| [0011](ADR-0011-ux-overhaul-l-decisions.md) | Accepted | UX 전면 개선 | 개선 계획 L1~L8 확정: 하루 개수 무제한, 제목 줄바꿈 유지, 메모리 draft, iPad 개요+아젠다, 삭제 8초+24h, developer 권한 현행 유지, 태그 6/2, 잠금해제 auth-session 단위 | 신뢰 멤버 증가·부제목 혼란 반복 시 |
| [0012](ADR-0012-phase0-capability-matrix.md) | Accepted | 권한/보안 | Phase 0 capability matrix + 불변식(범위 fail-closed·미리보기 서버 스냅샷만·오류 원문 비노출) | 역할 추가·캘린더 2개 이상 시 |
| [0013](ADR-0013-activity-log-internal-identified.md) | Accepted | 프라이버시/지표 | 행동 기록(`activity_event`): **내부자만 계정 식별**, 시청자·비로그인은 쓰기 시점에 `account_hash` null 강제. meta에 일정 제목·본문 저장 금지(ADR-0002 우회 차단). 보존 90일 | 신뢰 멤버가 다수가 되거나 시청자 개인 단위 분석이 필요해질 때(고지 선행) |
| [0014](ADR-0014-private-layer-ui-retired.md) | Accepted | 역할 UX/보안 | 편집실 **비공개 레이어 UI 철수**(비공개 보기 토글·공개 범위 피커·배너·필터). 서버 모델·RLS·fail-closed 저장 검사는 그대로, 새 일정은 항상 public. 비밀번호는 **최초공개 게이트·변경 전용**(관리 묶음) | 관리자가 엠바고/작업자 일정을 다시 쓰고 싶을 때(UI만 복원) |
| [0015](ADR-0015-retire-decorate-stickers-worker.md) | Accepted | 기능/역할 철수 | **달력 꾸미기(스티커)·작업자 역할 철수** — 코드 삭제 + 0065 테이블/컬럼 drop(백업 JSON·이미지 커밋). 신뢰 멤버 = 매니저만. 공개 API DTO에서 stickers 필드 제거 | 관리자가 꾸미기를 다시 원할 때(코드는 git, 데이터는 백업, 스키마는 새 마이그레이션) |
| [0016](ADR-0016-metal-water-design-language.md) | Accepted | 디자인 언어 | **금생수(金生水)**: 일(편집 팝오버·띠·버튼·칩·카드 테두리) = 금(헤어라인·광택·작은 라운드), 품는 것(바탕·표면·칸·패널) = 수(물빛 유리·큰 라운드). 편집실은 차분 모드 아래, 시청자 화면은 기본 모습. 의미색 8종·태그색·기하 불변. CLAUDE.md "따뜻한 콘텐츠 안쪽" 조항 대체 | 소유자가 크림 톤을 다시 원할 때 · 모달/VOD/모바일 아젠다까지 넓힐 때 |
| [0017](ADR-0017-ambient-season-registry.md) | Accepted | 디자인 언어/구조 | **앰비언트 배경 레지스트리**: 물결(.gs-tide)은 사철 상수, 계절(절기 기준 KST)은 그 위의 강세 — 봄 초목(木)·여름 물결·가을 채도 낮춘 낙엽+서리(金)·겨울 눈. 편집실·시청자 공용 `<AmbientLayer />`, 스위치 "계절 배경"(`vic.ambient`, 기본 ON) — OFF면 물결만. 특정일은 `SPECIAL_DAYS`(3단계). 포스터 테마 7종은 공존 → 4단계 supersede 예정 | 소유자가 계절 소품을 원치 않을 때(스위치) · 포스터 테마 철거 시(ADR 개정) |
