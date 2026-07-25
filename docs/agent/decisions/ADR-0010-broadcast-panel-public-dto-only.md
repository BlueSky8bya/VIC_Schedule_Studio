# ADR-0010: 방송 판서 창은 공개 DTO만 먹는다 — 서버 스냅샷 단일 출처 + fail-closed teaser

Status: Accepted
Date: 2026-07-25
Related: `lib/schedules/broadcast-dto.ts`, `components/studio/broadcast-panel.tsx`,
`tests/unit/broadcast-dto.test.ts`, `tests/unit/broadcast-callsite.test.ts`,
PLAN-20260725-001 (G0×3·G2×2 게이트 합의)

## Context

방송 판서 창(B안)은 편집실 '미리보기'에서 열리는 도구라, 가장 가까운 데이터는 편집실의
낙관적 `events`(StudioScheduleEvent)다. 그러나 그 경로엔 두 가지 유출면이 있다:

1. 기존 미리보기 sanitization이 `{ privateMeta, ...rest }` **spread**라 privateMeta 외의
   스튜디오 필드가 전부 통과한다(공개 필터가 유일한 방어).
2. 공개 일정이어도 **teaser(떡밥)** 는 공개 시각 전까지 실제 제목·태그·기간을 서버
   (public-loader `mapEvent`)가 가려서 내려보낸다 — 낙관적 studio events엔 이 가림이 없다.
   방송 화면 공유 중 미공개 제목이 그대로 노출될 수 있는 구조.

## Decision

1. 판서의 데이터 입구는 `toBroadcastPanelDays(schedule.viewerModePreview, dateKeys)` **하나**.
   소스는 서버가 만든 공개 스냅샷(public-loader 결과)만 — 낙관적 events 재가공 금지.
   호출 인자는 `tests/unit/broadcast-callsite.test.ts`가 소스 정적 검사로 고정한다.
2. DTO는 **필드 명시 나열로만** 구성(spread 금지). 태그도 raw tags/palette 대신 색 해석이
   끝난 `BroadcastPanelTag{id,label,colorHex,isPrimary}` 4필드만 내장한다.
3. teaser=true는 "서버가 가린 상태"라는 뜻으로 취급 — 소스가 계약을 어기고 실제 내용을
   실어 보내도 변환기가 서버 stub과 같은 형태로 **강제 마스킹**(fail-closed)한다.
   날짜 배정 '전'에 적용해 가려진 기간이 다른 날짜 카드로 번지는 것까지 막는다.
4. 판서 컴포넌트는 `StudioSchedule*` 타입·studio-loader·편집실 DOM 캡처에 접근하지 않고,
   서버 무저장에 더해 클라이언트 저장소·클립보드·URL에도 아무것도 남기지 않는다
   (소스 정적 단언). 닫힘 = unmount = 소멸.
5. 유출 테스트 계약: 3계층 키 화이트리스트 정확 일치 + canary 문자열 직렬화 부재 +
   비공개(work/owner_private/레거시 embargo)·draft 부재 + teaser '존재하되 내용 부재'.

## Consequences

- 신선도 희생: 방금 만든/고친 일정은 서버 스냅샷 갱신 전까지 판서에 안 보인다 — 방송 설명
  도구 특성상 수용(G0 합의).
- 판서에 새 필드가 필요하면 화이트리스트·유출 테스트·(필요시) 변환기를 함께 고쳐야 한다 —
  이 마찰은 의도된 것.
- 부수 발견: 기존 미리보기 낙관 경로의 teaser 미가림은 **별도 잠재 이슈**로 남아 있다
  (CURRENT_STATE 알려진 이슈 — 이 ADR 범위 밖).

## Revisit Conditions

판서에 실시간성(낙관 반영)이 꼭 필요해지면 — 그때는 studio events를 쓰는 게 아니라
공유 redaction 함수(서버 mapEvent 로직 추출)를 클라이언트에서 재사용하는 방향으로.
