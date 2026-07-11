# ADR-0004: 포스터 표면은 폭 1840 고정 · 높이는 내용에 따라 성장 · JS로 스케일

Status: Accepted
Date: 소급 기록 2026-07-12
Related: `components/poster/public-poster.tsx`, `public-poster.css`(`.poster-surface`)

## Context

스티커(꾸미기)는 **비율 좌표**(`x_ratio`, `y_ratio`, `width_ratio`)로 저장된다. 즉 스티커 위치는 포스터 표면의
기하에 완전히 종속된다. 꾸미기 화면과 시청자 화면의 기하가 다르면 스티커가 통째로 밀린다.

## Decision

- 표면 **폭 1840px 고정**, 높이는 콘텐츠에 따라 자란다(고정 1035·clamp·clip 금지).
- 화면에 맞추는 축소는 **JS 스케일**(자연 크기 → 뷰포트 fit)로만 한다.
- **꾸미기 == 시청자 기하가 동일해야 한다.** 시청자 전용 크롬(필터·하트 UI 등)은 표면 **바깥**에 둔다.

## Consequences

- 셀 높이·헤더 높이를 바꾸는 CSS 변경은 스티커 좌표에 영향을 준다 → 구조 변경 시 꾸미기에서 실물 확인 필요.
- 반응형은 "같은 DOM을 축소"가 아니라 표면 스케일 + 모바일 아젠다(별도 레이아웃)로 푼다.

## Revisit Conditions

포스터를 고정 비율(16:9 / 4:5) 캔버스로 전환하기로 하면 이 ADR을 대체한다(스티커 좌표 마이그레이션 필요).

## Validation

`tests/visual` 스냅샷 + 꾸미기/시청자 두 모드에서 같은 스티커가 같은 자리에 있는지 눈으로 확인.
