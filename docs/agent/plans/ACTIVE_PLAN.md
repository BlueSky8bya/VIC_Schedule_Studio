# Active ExecPlan

Plan ID: PLAN-20260827-004
Status: Completed (①②③ 구현 후 ③의 '높이 fit'은 당일 철회 — prod 8월에서 배율 ~0.6, 글씨 축소.
scene도 폭 fit만. 추가: 뱅송 미리보기 URL `/onair`(avatarFixed, 로그인 없음, 공개 로더만))
Task Risk: L2 (구조적 — 포스터 전역 밀도 변경 = 지오메트리 게이트 baseline 의도적 갱신, 아바타 scene 레이아웃 재구성, fit 배율 계산 확장)
Created / Updated: 2026-08-27

## Objective

뱅온(아바타 scene) 화면이 OBS 1920×1080 브라우저 소스 안에서 **한눈에** 들어오게 한다
(사용자·빅토리 취향: "한 눈에 들어오는 게 취향"). 사진 증상: 오른쪽 정보 카드가 반토막 폭이라
`2026년 08 / 월` 줄바꿈, 달력은 8월(6주·고밀도)에 표면 1840×1360(1.35)이라 1:1에 가깝게 보임.

## 실측 (2026-08-27, 1920×1080)

- 8월 prod 표면 자연 크기 1840×1360, scene stage 1337×988(가용 1006) → 폭 기준 fit이라 오른쪽을
  줄여도 비율은 안 변함. 원인 = 달력 콘텐츠 높이(표면 폭 1840 고정·높이 콘텐츠 기준 불변식).
- 정보 카드 232px·max 48% → 180px에서 줄바꿈.

## 확정 방향 (사용자, 2026-08-27 01:43)

① 오른쪽 칸 **세로 스택**(정보 카드 위, 라이브 카드 아래, 열 전폭) — 줄바꿈 소멸.
② **전역 밀도 압축 ~10%** — 행 최소높이·칩/칸 패딩·간격(글자 크기는 유지: 방송 화면 가독성).
   scene 전용 압축은 꾸미기≠시청자 지오메트리 → 스티커 어긋남이라 금지. 전역이면 canon 프레임이
   두 모드에서 같이 바뀌어 불변식 유지. (기존 스티커는 칸 대비 소폭 이동 가능 — 보고.)
③ **방송 모드 고정 컴포지션** — 아바타 열 `--avatar-col: clamp(300px, 18.75vw, 380px)`(1920에서
   정확히 360px), 태그 레일 120+12, 나머지 = 달력 영역. scene에선 fit을 **폭·높이 둘 다**로
   (`min(w/natW, availH/natH, 1.6)`) → 어떤 달도 1080 안에 들어감. 달력은 영역 안에서 **세로
   중앙**(`--poster-dy` translate, 균일 scale이라 스티커 좌표 안전).
   아바타 자리는 `top:76 / bottom:14` 세로 flex 열 = [카드 스택][꾸미기 토글][점선 박스(flex:1)] —
   `--avatar-h` 매직 넘버 제거, 박스는 남는 높이를 결정적으로 차지.

## 원칙 / 불가침

- 표면 폭 1840 고정, 높이 콘텐츠 기준 — 유지. 스티커 좌표 = 기본 지오메트리 표면 비율(ADR-0004).
- 꾸미기 == 시청자 지오메트리. scene 전용 밀도 금지.
- 지오메트리 게이트(`tests/visual/geometry.spec.ts`) baseline 갱신은 **이 변경이 의도한 레이아웃
  변경**이므로 허용 — 커밋 메시지에 명시.
- 시청자(avatarSlot=false)·모바일(≤640)·<1100px(scene off)은 ②만 영향, ①③ 무영향.
- 내보내기 표면(`[data-export-surface]`)에 관리 UI 없음 — 불변.

## 단계

- [x] P0. 컨텍스트 재수집(세션 유실) + 본 플랜.
- [x] A. CSS ① — `.avatar-top-cards` flow·column·전폭, 카드 max-width 해제, in-rail 정보 카드 타이포 확대.
- [x] B. CSS ③ — `--avatar-col`, stage margin, `.avatar-slot` top/bottom flex 열, dock flex:1,
      `.avatar-ctl-inslot`(꾸미기 토글을 슬롯 안 흐름으로), `--avatar-h`·translate 규칙 제거,
      <1100 media에서 슬롯=토글만 좌상단.
- [x] C. TSX ③ — measure(): scene && ≥1100px이면 높이 fit + dy; stage 높이 = 가용 높이; 창 resize 리스너;
      꾸미기 토글 JSX를 슬롯 안으로 이동.
- [x] D. CSS ② — grid-auto-rows 150→132, weekday-row 10/7→8/5, surface gap 16→12·세로 padding 18→14,
      day-events 5/6-5-8→4/5-5-6, public-event gap 3→2·padding 5→4, day-strip head 27→25·padding 3→2.
- [x] E. 검증 — tsc·lint·build exit code, vitest, e2e(그림판·포스터), 비주얼(geometry·poster baseline
      의도 갱신), fixture 실측 스크립트(1920×1080·1366×768, viewer/decorate, left/right): stage 바닥 ≤
      뷰포트, 카드 스택 폭=열 폭·줄바꿈 0, 토글↔카드↔박스 겹침 0, 스티커 매핑 e2e(geometry) 통과.
- [x] F. CURRENT_STATE 갱신, 커밋·푸시.

## 검증

- `tsc --noEmit` · `npm run lint` · `next build` **exit code 확인**
- 공개 경계: 변경 없음(CSS/클라 레이아웃만).
- 회귀: 아바타 ON/OFF·좌우 전환 애니(margin transition) 유지, 시청자 미리보기 토글 좌상단 유지,
  scene 확대(Ctrl+휠)는 높이 fit 안에서 동작.
