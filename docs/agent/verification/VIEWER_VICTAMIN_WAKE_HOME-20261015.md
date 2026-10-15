# 빅타민 창 닫기 복귀·포근한 집

2026-10-15 KST. [PLAN-051](../plans/PLAN-20261015-051-companion-wake-and-cozy-home.md). 상태: 구현·독립 소스/시각 리뷰·로컬 검증 완료, 운영 배포 대기.

## 진단과 변경

- [`ViewerCompanion`](../../../components/poster/viewer-companion/viewer-companion.tsx)의 기존 `sync`는 창 닫기에서 display-only `overlayPerch`를 지운 뒤 즉시 논리 좌표로 `paint`했다. 작은44px 피신 자리에서76px 원래 발판으로 돌아갈 때 위치뿐 아니라 배율도 한 프레임에 바뀌었다. 기존 창 회귀는 마지막 원래 좌표·동일 DOM·quiet 상태를 확인했지만 중간 프레임 연속성을 측정하지 않았다.
- 새 [`overlay-return.ts`](../../../lib/ui/viewer-companion/overlay-return.ts)는 현재 보이는 행렬의 위치·배율을 WAAPI 취소 전에 읽어 이어받는다. 기존 wake800ms(짧게 열었을 때160ms) → 기존 `FLIP_MS`520ms/연속 travel 곡선 → 착지350ms를 기존 렌더 시계에서 샘플한다. 별도 타이머/rAF/물리 엔진을 만들지 않는다. 종료 후350ms는 새 자율 행동을 기다린다. 기존 원래 지원 DOM/ID를 우선하며 닫는 순간 지난 점프·식사·교감 액션을 재생하지 않는다.
- 전체 스캔 완료와 실제 복귀 발판의 유효함을 분리했다. 집 접힘·화면 밖 쿠션·지원 소실은 잘못된 목적지로 이동하지 않는다. 이미 유효했던 목적지 소실은 마지막 표시에서 종료하고 안전 검사로 넘기며, 첫 측정이 오지 않아도1초 뒤 종료한다. 가짜 발판이나 무한 대기를 추가하지 않는다.
- 복귀 중 재열기는 현재 표시 지점·배율에서 다시 피한다. 드래그·Enter/Space/P/N·집 호출은 같은 표시 지점을 채택하고, 가장자리의 작은 피신 그림은 실제 위치 차이·배율만200ms 동안 원래 크기의 안전 좌표로 풀어낸다. 복귀 중 hover 교감은 막는다. [`presence.ts`](../../../lib/ui/viewer-companion/presence.ts)의 명시적 직접 입력만 기지개를 중단하며, 문서 blur를 강제로 active로 바꾸지 않는다.
- hidden/차단·월 재구성·dispose에서는 유한 복귀를 정리한다. blur 중에는 복귀만 마무리하고 기존 quiet 수면으로 간다. 감소동작/gfx OFF는 대기·이동을 생략하며 짧은 자율 행동 지연만 유지한다. 일반 창의 inert/aria-hidden·초점/입력 소유권·parked 작업0 정책을 보존한다.

독립 리뷰에서 최초 두 경계(접힌 집의 잘못된 귀환, 작은 하단 피신 자리 직접 집기의 숨김)를 발견해 유효 발판 분리와 표시 위치/배율 인계로 수정했다. 최신 소스의 추가 확정 차단은 없었다. 이는 렌더/실OBS 통과를 대신하는 주장은 아니다.

실제 익명 `/` 추가 검사에서 설정 창 안에서 기본OFF→ON/크게를 고른 최초 개체는 아직 지원 ID가 없어서 같은x 복귀 대상을 못 찾고 종료되는 경계를 재현했다. 최초 미배치만 기존 안전 span으로 초기 배치하도록 `worldSeeded`를 ref 내 마지막 자세와 함께 보존한다. 단순히 빈 지원 ID를 최초 배치로 취급하지 않으므로 지원 소실·직접 집기 뒤에 가로로 다시 뽑지 않는다. 새 달의 잔여 pending landing은 창 닫기 복귀가 맡아 두 번째 점프가 뒤따르지 않게 했다. 이 수정도 독립 소스 리뷰에서 확인했다.

## 집의 재질

[`companion-home.tsx`](../../../components/poster/viewer-companion/companion-home.tsx)/[CSS](../../../components/poster/viewer-companion/companion-home.css)는 같은 glass/theme 토큰에 따뜻한 목재·리넨을 섞고 창 커튼·바닥 몰딩/빛·직조 러그·쿠션 앞면 두께/봉제선/작은 접힘을 더했다. 캐릭터 원화·생성 이미지·새 제어/문구·상시 장식 애니메이션은 추가하지 않았다.

방132px, 실제 쿠션 발판16px의 top·위치·조작 크기는 유지한다. 두께와 눌림 표현은 발판 아래 장식과 내부 천에서만 만든다. 같은 구현을 PC rail/모바일 집에 사용하며 다크/눈 편안함도 테마 기준으로 바뀐다. 실제 기하/색·조작·before/after 렌더 수치는 아래 검증에 기록한다.

## 접힘 기억 조사와 사용자 결정

PLAN-050의 각 제목 접기는 `vic.panelSections`에 이미 저장된다. 이번 운영1920/1440/390에서 native 제목 접기→새로고침→복원·다른 탭 갱신을 확인했다. raw 저장값·prepaint marker·aria 상태와 오류0을 확인했으며 각 화면의 bootstrap POST2를 모두 차단, 전달0이었다. epoch 초기화는 해당 키를 삭제하지 않았다. 좁은 폭 전체 rail의 별도 열림 정책과 구별해 사용자에게 확인했고, 사용자는 “잘 되면 넘어가”라고 결정했다. 접힘·좌우 저장 상품 코드는 이번에 변경하지 않았다. 진단 원본은 ignored `.scratch-pw/panel-051-diagnose*.json`이다.

## 검증

| 범위 | 현재 상태 |
|---|---|
| 타입·전체 lint·production fixture build | PASS. build가 생성하는 `.next/types`를 다른 검사와 동시에 지우는 실행을 피하고 최종 build 뒤 명시적 typecheck도 PASS 확인. |
| 관련 단위 |278 PASS: viewer-companion/ambient-pause/panel-section-preferences/agent-memory/rule-migration. 새 복귀6개·직접 입력 presence1개 포함. |
| 복귀 렌더·기존 창 회귀 | 고유6 PASS: 기존 overlays2 + 신규 wake4. 초기 candidate에서5PASS(PC1의 모든 모션은 통과했으나 새 focus 가정 실패), 그 가정을 교정한 최종 PC1 PASS를 합산했다. 최종 seed latch 수정 후6개 전체를 다시 실행했다는 주장은 아니다. 실제 root 최초 켜기 분기는 별도로 아래2뷰에서 검증했다. 기존 설정 창은 opener focus 복원을 보장하지 않으므로 잘못 추가한 해당 단언을 실제 activeElement/복귀 중 pet focusin0 검증으로 교정했다. 상품 focus 계약은 변경하지 않았다. |
| 최종 실제 익명 `/` 로컬 |1920 PC/390 touch 두 화면 PASS. 기본OFF→설정 안에서ON/크게→수면→닫기, 설정/검색/기록3창의 첫 위치·너비 연속성→settle→marker 종료·계속 표시를 확인했다. 기본OFF atlas 요청0, sharp, inert/입력 통과·동일 DOM·접기 reload·export 내 pet0·pageerror0. 각 bootstrap POST2 전부 차단·전달0, 과거2025-09 사용. |
| 집 렌더/기하 |5뷰 PASS: PC1920 밝음/다크·390 밝음/다크·900×600 coarse 다크+gfxsoft/눈편안lite. 동일 새 markup에 HEAD oldCSS를 적용한 재질 before/after 비교이며 옛 빌드 PNG는 아니다. 방132·쿠션16/top97, room/anchor/controls6rect의 x/y/w/h 최대차0px. PC room322/쿠션135.234×16, touch room292/쿠션122.625×16, feed48×62·slot26×5·trash44×56 유지. native home/feed/trash 입력 및 음식1→0, 버튼 중심 hit-test 전뷰 PASS, filter:none/room animation:none·pageerror0·POST0. |
| 배포·운영 | PENDING. main push와 운영 build SHA, 실제 익명 PC/터치 창 복귀를 확인한다. |

공개 DTO·서버 권한/unlock·KST·DB·실제 일정·1840 표면 기하 변경0. 기본 OFF·로컬만·시청자/비로그인/미리보기 공용 한 구현을 유지했다. 모든 UI 검사는 fixture/합성 또는 과거2025-09 읽기·POST 차단으로 시행한다. Chromium touch 경로는 물리 휴대폰 검증이 아니며, 실OBS·물리 햅틱·주관적 미술 승인은 별도다. 기존 harness inventory2 오류는 이번 변경과 분리한다.

최종 PC218.74px 귀환의 첫 프레임 오차0.00305px, 최대13.323px/관측 프레임·scale step0, return31/settle21프레임을 기록했다. 종료 후 첫250ms15프레임은 원래 발판 고정, 다음 실제 자율 행동까지416.3ms였다. touch 배율0.579→1, 직접 집기의 첫 위치·배율 변화0과 여러 단계의200ms 복구를 확인했다. blur 후 귀환은 유한하게 끝나 수면 꼬리 Range0/style write0, native close 뒤 실제 activeElement는 BODY였고 pet focusin0이었다. 재열기·동일 DOM·감소동작 이동 생략도 확인했다.

근거는 ignored `.scratch-pw/companion-051-wake-summary.json`, `companion-051-wake-final-pc.log`, `companion-wake-public-local.json`, `companion-cozy-051.json`과 PC/touch/cozy PNG에 남겼다. 직접 열람에서 밝음/다크의 목재·리넨·쿠션 앞면/솔기·바닥층이 읽히고 가림/클립은 없었다. root와 독립 담당의 시각 검토이며 최종 소유자 취향 승인을 대신하지 않는다.
