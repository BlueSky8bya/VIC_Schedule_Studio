# Local Agent Instructions — `components/`

## Role
`poster/`(시청자 포스터·꾸미기·공개 인사이트) · `studio/`(편집실 셸·관리자 인사이트·차트) ·
`seasonal/`(시즌 장난감) · 공용 UI.

## Read Before Editing
- `components/README.md` · 루트 `CLAUDE.md`의 **Design rules**(이게 수용 기준이다)
- ADR-0004(포스터 지오메트리), ADR-0006(낙관적 쓰기), ADR-0009(시즌 장난감)

## Invariants
- 포스터 표면은 **폭 1840 고정 캔버스**. 뷰포트 미디어쿼리로 내부를 재배치하지 않는다(스티커 좌표가 어긋난다).
  좁은 화면은 표면을 비틀지 말고 아젠다(목록)로 보낸다.
- `[data-export-surface]` 안에는 상호작용 크롬(버튼·필터·토글)을 넣지 않는다 — PNG에 박힌다.
- 웹(≥641px)과 모바일(≤640px)은 **다른 레이아웃**이다. 같은 DOM을 축소한 것 = 결함.
- 디자인 토큰(`app/globals.css :root`)을 쓴다. 하드코딩 금지.
- 낙관적 쓰기는 직렬 큐 + keepalive(`/api/studio-write`, `/api/sticker-write`).
- 게이팅은 좁게. 전역 pending으로 무관한 버튼을 막지 않는다.
- 인사이트 차트는 편집실·시청자가 **같은 컴포넌트**를 쓴다(`insights-charts.css` 공유). 갈라놓지 마라.

## Verification
- 프로덕션 빌드 + Playwright로 데스크톱/태블릿/모바일 실물 확인.
- 편집실은 로그인이 필요 → 자동 검증 불가. `NOT VERIFIED`로 남기고 사용자에게 요청한다.
