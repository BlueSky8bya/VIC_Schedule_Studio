# 빅타민 편집실·잡기·소파·최초공개 검증

2026-10-16 KST. [PLAN-062](../plans/PLAN-20261016-062-companion-studio-and-contact.md). 구현 중 기록이며 실행하지 않은 항목은 미검증이다.

## 조사 범위와 경계

| 영역 | 연결과 판단 |
| --- | --- |
| 편집실·시청자 | 같은 `ViewerCompanion`·설정·PanelSection·집을 사용한다. 편집실 미리보기는 기존 공개 화면으로 전환하며 두 엔진을 동시에 띄우지 않는다. |
| 발판·하트 | 편집실은 명시적으로 표시한 공개 일반 일정의 익명 기하만 사용한다. 비공개·지원·미공개 떡밥과 편집 버튼을 제외한다. 하트는 로컬 보라 기념 효과이며 실제 클릭·투표·카운팅·서버 쓰기를 실행하지 않는다. |
| 숨바꼭질 | 시청자의 공개 상세 팝오버 계약을 유지한다. 편집실 일정은 편집기를 열기 때문에 같은 발견 창을 제공할 수 없어 숨기만 비활성화한다. |
| 창·포커스 | 일반 창 밖의 pet은 기존 조용한 대기/수동 이동을 유지한다. 집 resident는 소파 앞·뒤와 함께 배경에 남아 같은 blur를 받는다. 편집기 입력·모달 focus trap·history 소유권을 빼앗지 않는다. |
| 최초공개 | prelude 일반 이동→집 resident168초 기상/점프→73~69초 실제 카드 진입→기존 관객→공개 뒤 일정표 복귀 점프를 연결한다. 집중 단계에는 평소 brain·음식·하트가 멈춘다. |
| 잡기 | 실제 잡은 좌표로 귀·머리·몸통의 처짐과 양축 관성을 계산한다. HD 원본·전체 viewport 제한·100ms 해제·감소동작은 기존 구현을 유지한다. 새 그림·모델·의존성은 없다. |
| 소파·음식 | 몸통까지 포함한 안쪽 seat와 진짜 집 바닥만 착지점으로 삼는다. 경계 drop은 유한 정착이며 음식은059 규칙대로 소파가 아닌 바닥으로 간다. |
| 서버·권한·시각 | 서버 로더/DTO/RLS/권한/언락·KST·DB/폴링·1840 export 표면은 변경하지 않는다. 테스트는 fixture와 가로챈 쓰기를 사용한다. |

## 구현 확인

독립 검토에서 세로 grip 관성 부호, 비활성 창 상태의 집 이탈 점프 유지, 편집실 실제 창 충돌 목록을 확인·보완했다. 최종 읽기에서 추가 확정 차단 사항은 없었다. 이전061의 통과 결과는062의 실행 근거로 재사용하지 않는다.

- 편집실 단일 엔진·패널 연결: `components/studio/studio-shell.tsx:212`, `:7241`, `:7267`; 공개 일반 일정 opt-in `:6450`, `:7977`. 모바일 역할 배지는 `components/studio/role-badge.tsx:42`의 공유 `SettingsButton`으로 같은 settings modal을 연다. 포커스 복원 기록은 `studio-shell.tsx:1871`이며 trap 호출 `:1884`보다 먼저 실행한다.
- 익명 발판·하트 경계: `lib/ui/viewer-companion/geometry.ts:157`, `:213`, `:358`; `hearts.ts:58`. 스튜디오 지원 띠/헤더/날짜 및 편집 컨트롤은 공개 일정 opt-in에 해당하지 않아 자율 발판에서 제외한다. 기존 시청자 지원 띠/헤더 발판은 보존한다.
- 집168초 기상·유한 점프·parked 착지: `components/poster/viewer-companion/viewer-companion.tsx:192`, `:639`, `:834`, `:857`. 실제 카드73초 진입은 `:1017`의 기존 generation·공유 시계 경로를 사용한다.
- 잡기 실제 pivot·감소동작·inertia 연결: `viewer-companion.tsx:321`, `:331`; `lib/ui/viewer-companion/contact-grip.ts`, `held-inertia.ts`, `motion.ts`. 전체 등록 그림 경계와 release mixer를 중첩 적용한다.
- 소파 몸통 범위와 경계 release: `lib/ui/viewer-companion/sofa.ts:8`, `:16`; `geometry.ts:289`, `viewer-companion.tsx:493`. 집 resident 앞면 유지와 일반 창 배경 계층은 `viewer-companion.tsx:390`, `:1129`; 실제 편집 창 목록은 `:881`.
- 모바일 집 위치는 `viewer-companion.tsx:114`에서 실제 오른쪽 도구의 표시 상자를 잰다. 양쪽 레일에 동일한44px 버튼+기존8px 간격을 예약하고92px 폭을 쓴다. 레이아웃/scroll·요소 크기·폰트 준비·관련 진입 애니메이션 완료에서만 예약 측정한다. 새 상시 프레임 루프는 없다.
- 개체별 관객 score·고요·5→2 감쇠는 `lib/ui/premiere/company.ts:23`, `:27`, `:47`; seed 생명주기는 `components/poster/premiere/premiere-scene.tsx:14`. 모바일 대기 화면의 한정 높이는 `premiere-stage.css:272`; 공개 후 본문 scroller는 그대로 둔다.

## 실행 기록

- 관련 단위41파일446개 PASS. `.scratch-pw/companion-059-062-unit.log`. 이후 테스트 fake DOM identity 비교6곳의 TypeScript cast를 고쳤고 해당 geometry41개를 재실행해 PASS했다. 제품 조건과 단언은 그대로다.
- 전체 lint·typecheck·production fixture build exit0. 최초 `.scratch-pw/companion-059-062-{lint,type,build}.log`, 후속 수정 뒤 최종 `062-lint-final-2`, `062-type-final`, `062-build-final` 로그도 exit0. 최초24파일 SHA256은 `.scratch-pw/companion-062-build-product-hashes.json`, 최종24파일은 `.scratch-pw/companion-062-final-build-product-hashes.json`으로 구분한다. 최초 빌드 이후 관객 파일은 변경하지 않았다.
- 관객 새8+기존 company14+reference8 고유30개 완료. 첫 실행27PASS/의도된 기준 이미지3FAIL을 `.scratch-pw/companion-062-audience-initial.*`에 보존했다. PC·모바일·가로 실제 이미지를 전후 확인하고 wish-background1100/390/844 세 장만 갱신해3PASS했다. 30개를 한 번에 모두 통과했다고 표현하지 않는다. 모바일1/2/3/5·혼합 공개·가로의 실제 터치/가시성, seed/포커스 유지·음악·gfx 경로를 포함한다.
- 첫 studio/contact9개는3PASS/6FAIL. 귀/몸통 실제 캡처와 CSS 경계, 공유 접힘, 실제168초 집 이탈 뒤 자율 이동/73초 합류는 통과했다. 실패 원본은 `.scratch-pw/companion-062-contact-studio-initial.*`에 보존했다. 새 테스트의 편집기 자동 포커스 가정·소리 미리보기와 중복된 닫기 selector·pet에 가려진 쿠션 중앙점·창 드래그 뒤 닫기 포커스 가정을 실제 입력 절차로 바로잡았다. 가시성·캡처·이동 상한·경계·정숙 tail0·POST0 조건은 완화하지 않았다.
- 제품 실패도 분리했다. Studio가 focus trap 실행 뒤 opener를 기록해 사라질 닫기 버튼을 복원 대상으로 삼았다. opener 기록을 trap보다 앞에 두고 두 화면의 공통 톱니 버튼이 실제 tap 때 자신을 먼저 focus하게 고쳤다. 집 버튼은 `.m-rail-insights`가 측정 selector에 없었으며 별도 세로 예산도 없었다. 같은 레일 예약과 실제 도구 측정으로 수정했다. 또한 기존 소파 lift 회귀의 구조를 읽고 불필요하게 추가했던 앞쪽 턱 opacity fade를 제거해 실물 U자 턱을 계속 불투명하게 유지한다. 후속 독립 읽기 검토에서 추가 확정 차단은 없었다.
- 최종 빌드에서 studio/contact9/9 PASS(54.4초, 재시도0). `.scratch-pw/companion-062-final-contact-studio-{report.json,log}`. owner/developer·native390/coarse900 설정 X/Back·opener 복원·편집 입력/비가림·다크 레일·집 음식, 공유 접힘 저장, 실제 귀/몸통 캡처, 안/밖 소파 착지·배경 blur/앞턱, 일반 창의 가까운 재배치·정숙 tail,175초 실제 기상/점프 뒤 자율 이동과 별도76초 합류, 양쪽 모바일 런처 위치를 포함한다. 모든 POST0/pageerror0. 각각의 실 PNG도 검수했다.
- 최종 잡기 세 종류는76/76/77개 held 프레임 모두 capture/visible였다. 실제 CSS 계층을 제품 helper와 별개로 합성한 pivot 최대 오차는0.000515px 이하였고 등록 clip의 보수적 네 모서리가 viewport 안이었다. 픽셀 alpha·물리 OBS·실기기 성능을 이 수치로 대신 주장하지 않는다.
- 기존 관성6·소파/집4·집 바닥4·최초공개 입장/귀환PC/native2 =16/16 PASS(118.77초), 이어 발견 guest PC/native2/2 PASS(31.92초). `.scratch-pw/companion-062-legacy.*`, `companion-062-guest.*`, `companion-062-integration-qa-summary.json`. 실제 입력·전체 모서리·감소동작/GFX OFF 중립·집 fold/side/reflow/먹기·불투명 소파 턱·찾은 뒤 drag-out/cancel·quiet tail을 보존한다. POST0/pageerror0, 제품24파일 해시 변화0. 소파 PC·native·가로 이미지도 검수했다.
- 위 입장/귀환은80초 fixture에서73→69초 진입을 실제 시계로 관찰하고, 공개 상태만 fixture 응답에서 `released`로 바꾼 뒤 실제 일정표 버튼과 복귀를 검증한다.80초 전체를0초까지 기다린 검사가 아니다. 현재 결과 artifact는062 접두사로 복사했고 spec의 향후 출력 경로도062로 옮겼다. 이 문자열 변경은 동작/단언을 바꾸지 않는다.
- UI 고유 검사 총57개 완료(관객30, 최종studio/contact9, 기존 회귀18). 일부는 최초 빌드의 변경 없는 관객 파일에 대한 근거이며 전부 한 실행/한 시점의57green이라고 주장하지 않는다. 최종 공유 엔진은9+18개 실제 조작을 통과했다.
- 문서 하네스 단위25개 PASS. `harness:verify`는 기존 RULE_MIGRATION inventory/mapping 불일치2건으로 FAIL했다. 새 라우팅/제품 오류와 구분하며 기록을 숨기지 않는다. `git diff --check` exit0, artifact 접두사만 바꾼 spec 범위 lint도 exit0. 최종 커밋/배포 확인은 아래에 마감한다.

## 커밋·배포

승인된 main 커밋·푸시·운영 확인 진행 중. 실제 배포 및 익명 공개 경로를 확인하기 전 완료로 표시하지 않는다.
- 최초 ambient-pause 추가 검사에서 테스트의 marker-write 개수 기대값이 틀렸다. 실제 hold/release 뒤 기준을 저장하도록 oracle을 고쳐 최종6개가 통과했다. 제품 pause 로직을 완화하지 않았다.
- 잡기 독립 검토가 비대칭 grip의 세로 관성 회전 부호 오류를 찾아 수정했다. 몸통 점의 실제 world-Y 지연을 검증하는 독립 수식 검사를 추가했다.
- 기존 최초공개 시각 검사061은 prelude 일반 이동을 허용하는 새 요구에 맞춰 정지 care 기준을 실제73초 진입 직후에 잡는다. 관측하지 않은95초 연속 구간을 검증했다고 주장하지 않는다.

## 제한

실제 로그인·RLS·물리 OBS·실기기 성능은 fixture만으로 검증되지 않는다. 관련 현재 변경은 서버 정보 경계를 바꾸지 않으며 새 production 인증 우회도 만들지 않는다. 기존 문서 하네스 RULE_MIGRATION 불일치2건은 새 실패와 구분해 최종 실행 결과에 남긴다. 사용자 미술 기록26줄과 보류 자산은 이번 커밋에서 제외한다.
