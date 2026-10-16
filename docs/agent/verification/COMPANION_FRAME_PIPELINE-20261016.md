# 빅타민 프레임 경로·모바일 로그아웃 검증

2026-10-16 KST. [PLAN-066](../plans/PLAN-20261016-066-companion-frame-pipeline.md). 제품 `f8ca092870590b092dbe78ceeb4343714ccb87f0`의 전후 측정·최종 렌더41개·운영 배포 확인을 완료했다. 모든 상황의 처리 시간 감소나 실제 OBS 송출 품질을 확정하지 않는다.

## 변경 원인과 경로

| 경로 | 소스에서 확인한 반복/오류 | 수정 구조 |
| --- | --- | --- |
| 그래픽 등급 | pose·spring·layer의 각 `gfxMode()` 호출이 동기 localStorage 조회를 반복할 수 있었다. | 엔진 시작 시 등급을 한 번 읽고 기존 sync·설정/자동 판정·storage 이벤트에서 갱신한다. 활성 프레임은 로컬 snapshot을 사용하며 관련 listener도 종료 시 해제한다. |
| 실제 발판 추종 | 정적 월드에서도 main/follow 경로가 점유·목적지 anchor를 중복 측정할 수 있었다. | 기존 layout/scroll/geometry invalidation이 유한 추종 구간을 연다. 같은 rAF 시각·같은 support/target 묶음의 읽기를 합치고, full geometry와 창 진입/복귀는 강제로 재기준화한다. 글자 Range 전체 검사는 기존 coalesce 예산을 유지한다. |
| 표시 소유권 | full-rate 이동 중 main과 유한 follow가 같은 프레임의 pet 표시를 각각 쓸 수 있었다. | 기존 연속 동작 판정 하나로 main의 frame 소유권을 판단한다. full main이 이동을 그릴 때 follow는 anchor만 전달하며, quiet/parked/낮은 등급의 유한 follow와 마지막 중립 프레임은 유지한다. 기존 full/lite cadence를 낮추지 않는다. |
| 집기 | 빠른 pointermove마다 main과 별개로 전체 포즈를 다시 그릴 수 있었다. | 모든 물리 입력·관성 표본은 유지하되 일반 full 모드의 표시는 main에서 합친다. pointerup은 최신 held pose를 먼저 확정한 뒤 소파 몸체 충돌을 검사한다. 감소동작/다른 등급은 즉각적인 입력 피드백을 유지한다. |
| 음식 | 한 음식의 표시 쓰기 뒤 다음 음식의 source/control rect를 읽고, 낙하 경로에서 한 음식이 두 번 그려질 수 있었다. | 최대 기존 용량의 source/control을 먼저 읽고 위치·중력 sample을 계산한 뒤 음식별 한 번 표시한다. live fall이 attachment 표시를 소유하고 유한 home-follow는 그동안 양보한다. 마지막 낙하와 follow의 같은 timestamp/배열은 합치되 geometry sync는 새로 측정한다. |
| 모바일 로그아웃 | 063 `db1d53e8`에서 헤더 톱니 때문에 로그아웃을2행으로 내렸고, 064 `995e0983`에서 톱니를 월 이동 줄로 옮긴 뒤에도 남아 있었다. | Studio의 기존 `.m-head-logout`만 원래 제목 오른쪽1행으로 복원한다. 시청자 설정·계정 위치, Studio 월 이동 줄 톱니와 인증 form/handler는 그대로다. |

관련 소스: `components/poster/viewer-companion/viewer-companion.tsx`, `lib/ui/viewer-companion/geometry.ts`, `components/poster/viewer-companion/companion-food.tsx`, `components/studio/studio-shell.css`. 기존 모바일 설정 회귀는 `tests/visual/mobile-settings-header.spec.ts`에서 실제 로그아웃 BCR/행·제목 중앙·가림과 native hit를 추가 확인하며, 출력 prefix 환경변수로 이전 증거를 보존한다.

## 독립 검토와 보존 경계

첫 유한 구간 설계는 긴 main-thread 작업으로 첫 rAF가 deadline 뒤에 실행되면 anchor 읽기를 생략할 수 있었다. 그러면 뒤 full scan이 논리 좌표를 고쳐도 첫 표시만 옛 위치에 남을 수 있다. `anchorsDirty`는 실제 invalidation을 첫 측정까지 유지해 만료 시각과 무관하게 한 번 읽게 한다. 실제 follow 직전에 소비하며, overlay/premiere/hiding의 조기 반환은 이를 지우지 않는다. 이 수정은 추가 polling이나 프레임 loop를 만들지 않는다. 최종 소스 재독에서 해당 경계 처리를 확인했으며, 실제 긴 프레임 검증은 아래 실행 기록과 구별한다.

음식 배치의 read/compute/write 순서와 timestamp cache, 마지막 낙하·재집기·cancel/pause 경로를 별도로 읽었다. 낙하 시계/원점과 실제 attachment는 유지하고, geometry sync는 같은 frame cache로 생략하지 않는다. quiet 상태에 새 자율 작업을 더하지 않는다. 이 소스 검토는 렌더 회귀나 성능 측정을 대신하지 않는다.

한 엔진을 공유하는 viewer/Studio/preview, 모바일 전체 제외·기본OFF·92px·1840 기하, HD 원본/해상도·동작 clip/cadence, 감소동작/gfx·숨김/parked 정지, 실제 grip·전체 소파 몸체/앞면 깊이·유한 해제, 스크롤 지원, 숨바꼭질/팝오버·065 위치 연결·최초공개 소유권을 보존한다. 음식은 바닥만 착지하며 native drag/keyboard 대안·trash·먹기·집 접기/좌우/reflow 정책도 유지한다. 서버/공개 DTO/권한/KST/DB·이미지 자산은 변경하지 않는다. 사용자 미술26줄·보류 자산과 과거 raw/PNG 증거는 건드리지 않는다.

## 측정·실행 상태

같은 Windows/Ryzen5 7500F·Chromium148.0.7778.96, 1920×900/DPR1/headless에서 기준 `399c703d`/BuildID `rVdSALoK0I1t8KGAwbNr4`와 후보 `TT9d0EYIAJi6IyrDTB1eE`를 따로 실행했다. 후보는 당시 HEAD399c703d에 커밋 전 제품4파일을 적용한 빌드이며 SHA를 보존했다. 한 번에 한 브라우저만 사용했다. full/HD·소리OFF·ambientOFF로 공유 동행 경로를 분리했다. 실제 방송의 계절 배경·인코더 전체 비용을 대표하는 조건은 아니다.

각 화면 CPU4 slowdown3회와 CPU1 sanity1회로 빌드마다8개 primary 표본을 얻었다. metric 창은 CDP Performance 누적값 차이만 사용하고, 주입 rAF/DOM 읽기/프로토타입 spy 없이 native 집기 왕복6초·P 점프/실제 wheel/집 복귀6초·설정 창에서 parked3초를 측정했다. 프레임 간격은 같은 입력을 별도 반복하며 timestamp-only rAF/LoAF로 얻었다. 시간/초 단위는 전체 페이지 renderer 수치이며 빅타민 전용 CPU 사용률이 아니다. CPU4는 실제 OBS 장비와 동등한 부하 배수가 아니다.

아래는 CPU4×3 중앙값 `[최소–최대]`, 시간 단위 ms/s, style 횟수는 약6초 창당이다. JS와 Style 시간을 횟수 감소와 혼동하지 않는다.

| 화면·동작 | JS 전→후 | Style 전→후 | Layout 전→후 | Style 횟수 전→후 |
| --- | --- | --- | --- | --- |
| 시청자 집기 | 55.87[53.43–61.69]→61.54[53.72–65.78] | 24.52[23.51–27.77]→31.22[28.20–34.30] | .62[.61–.63]→.68[.66–.72] | 363[362–364]→363[361–363] |
| 시청자 점프·스크롤·집 | 48.18[46.29–59.05]→43.95[41.42–46.89] | 22.46[21.52–27.43]→22.00[21.82–24.81] | 1.40[1.38–1.49]→1.31[1.30–1.32] | 495[494–502]→376[372–378] |
| 편집실 집기 | 43.04[42.73–45.46]→36.95[33.80–38.77] | 20.57[19.22–21.75]→18.47[17.56–19.08] | .54[.54–.56]→.51[.48–.51] | 463[463–464]→364[364–364] |
| 편집실 점프·스크롤·집 | 35.51[34.19–37.73]→35.09[27.47–39.22] | 15.19[15.08–16.18]→16.32[13.81–16.52] | 1.17[1.15–1.27]→1.26[1.14–1.31] | 255[251–296]→208[205–209] |

확인한 감소는 시청자 혼합 style 횟수24.0%, 편집실 집기21.4%·혼합18.4%다. 시청자 CPU4 집기의 JS는10.1%·Style 시간은27.3% 증가했다. 원인을 추가 실험으로 분리하지 않았으므로 모든 상황의 가속이나 회귀 부재를 주장하지 않는다. CPU1 sanity의 JS 전→후는 시청자 집기18.41→9.82·혼합9.96→8.89, 편집실 집기8.67→8.17·혼합7.82→6.90ms/s지만 각1회라 대표값으로 삼지 않는다. Layout 횟수 중앙값은 네 행 순서대로7→7/10→10/7→7/9→9다.

별도 frame 표본은5742→5747개, 최대 p95는 양쪽16.8ms·최대 간격은33.4ms·50ms 초과0이었다. 따라서 이미60Hz에 가까웠던 기준보다 FPS가 크게 올랐다는 결론은 없다. LoAF 귀속 forced duration0도50ms 초과 프레임만 다루므로 모든 동기 layout0의 증거가 아니다. parked는 두 화면 모두 Layout0, 페이지 전체 JS는 시청자5.79→5.90·편집실.21→.20ms/s였다.

6초 timeline은 primary와 분리했다. 시청자 혼합의 `follow()` 직접 stack 귀속은252→130건/57.541→31.532ms(Style248→127, Layout4→3)로 줄었다. 기준 원본 `geometry.ts:500/520`의 retained anchor BCR 읽기와 연결했다. 편집실 실제 walk는 Style216→222·Layout6→6이며 양쪽 JS stack 귀속0이어서 강제 작업 부재로 해석하지 않는다. 이 walk trace만 기존 motion fixture 방식의 `.9999` RNG·jumpOFF를 사용했고 primary8회는 RNG/시계/focus를 바꾸지 않았다. 실제 요청된 HD atlas9종·1,560,892bytes의 SHA/크기가 전부 같았다. 화질을 낮춰 얻은 결과가 아니다.

측정 뒤 기능 회귀에서 접힌 집의 대기 중 동일 `hidden` 속성 쓰기를 발견했다. 최종 빌드 `U4jswTA9AeubFyz6m3Fi_`는 pending paint/진입 대기/미복구 handoff/집 가림4곳에서 이미 true이면 재쓰지 않는다. 다른 제품3파일과 활성 수치 계산 경로는 동일하다. 이4조건만 되돌린 텍스트의 SHA가 측정 빌드 소스와 정확히 같음을 `companion-066-final-delta-proof.json`으로 확인했다. 위 성능 수치는 측정 빌드 TT9의 결과이며 최종 U4 빌드에서8회를 다시 측정했다고 주장하지 않는다. 최종 빌드는 아래 기능 회귀로 별도 확인한다.

첫 렌더41개 실행은37 PASS/4 FAIL이었다. 실패를 덮거나 허용 오차를 넓히지 않았다.

- 기존 held2는 rAF 시작에서 이번 입력과 아직 갱신 전 DOM을 비교했다. 5.4829/67px 오차 뒤 다음 frame0의 패턴을 보존했다. 별도 진단은 rAF 뒤 task의 실제 읽기 시각·입력/RAF 버전을 함께 기록하고 독립 style MutationObserver에서 DOM commit을 읽었다. pointer retained227/MO228, edge194/MO195개, 혼합/제외0이었다. 이동 구간의12/13개 서로 다른 위치와 edge의80위치·x1340/y888px 이동을 포함했고 최대 grip/pivot 오차는 pointer.006626/.015761px, edge.001122/.016269px였다. 기존 .1/.15·관성·몸체 경계·캡처·중립 기준을 유지한 채 통과했다. 이 관측을 기존 held test에 통합했고 모든 원자료·phase coverage·mixed 수와 취소 cleanup을 남긴다. task만으로 실제 모니터 픽셀 표시를 증명하는 것은 아니다. [HTML 이벤트 루프](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model), [MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)의 실행 순서를 근거로 관측 단계를 구별한다.
- folded-home1은350ms 중 `vc-companion.hidden`의 old/current 값이 모두 빈 문자열인 기록1개였다. 이미 숨은 carrier의 같은 속성 재쓰기를 위4조건으로 막았다.0회 기준은 그대로 유지한다.
- 새 Studio longframe1은 native scroll 자체가 발생하지 않아800ms stress 시작에 도달하지 않았다. 성공하던 기존 Studio scroll 검사와 동일한900px 높이·실제 카드 배치 후 native 확대·실제 scroll 여유/가림 없는 panel target을 준비하도록 하네스를 고쳤다. 새로운 carry 관측은 실제 readAt/RAF serial/source/scroll version을 보존하며 첫 changed sample이 혼합이면 나중 PASS 표본으로 대체하지 않는다. 기존3px 기준은 유지한다. 최종 재실행 결과와 초기 setup 실패를 구별한다.

| 검증 | 상태 |
| --- | --- |
| 동일 production 전후 | 각 primary8회·native smoke2회·별도 timeline2회, 모든 최종 child exit0. 실제 mutation/pageerror0. 초기 baseline의 gfx full=no-attribute 해석 오류와 첫 편집실 walk 준비 timeout은 실패 raw로 별도 보존하고 성공 표본에 넣지 않았다. |
| 전후 frame/layout/style/JS 비교 | 위 표와 제한. `.scratch-pw/companion-066-comparison.json`, `companion-066-final-receipt.json`에 원본 경로·환경·제품SHA·요청 자산SHA·예외를 보존했다. |
| 최종 type/lint/unit/build | 최종 production build40554 exit0(type/lint 포함), 관련 최종 unit37파일417개 PASS(10:29 KST). 앞선 넓은458개 실행과 합산하지 않는다. |
| 실제 입력·UI 회귀 | 최종41/41 PASS: 기존 공유22(148.65초), 위치 연결6(48.8초), 추가13(70.7초), child모두0·retry/skip/flaky0. `.scratch-pw/companion-066-final-v2-suite-summary.json`, integration-final2/continuity-v4/additional-final2의 각 report/results/raw를 보존한다. |
| 운영·배포 | f8ca0928 main push 후 Vercel success·운영 API의 전체 build SHA 일치. 실제 개발자 모바일 편집실과 익명 PC/mobile3뷰·GET gate를 아래처럼 확인했다. 운영 일정 수정/저장/시험 데이터 생성0. |
| 문서 하네스 | exit1: 기존 Active rule IDs inventory/mapping 불일치2건. 제품 type/lint/build 결과와 구별한다. |

공유22는 실제 귀/몸통 잡기·50% hover excursion·cold decode·두 축 관성·전체 몸체/viewport·소파 안/밖 낙하·일반 창/blur/parked·reduced/off·집 바닥 먹기·최초공개 집 퇴장/합류/반환·OFF 관객을 포함한다. 위치 연결6은 owner/developer 왕복·실제 쿠션/바닥·접힌 집 복구/350ms writes0·안전 바닥·모바일 제외를 확인한다. 추가13은390/coarse 모바일 logout/gear·두 화면 native scroll/800ms 지연 후 첫 coherent DOM batch·native full/lite/full 변경·8개 음식의 낙하/집 FLIP·full/lite 보행·소파 세 경로다. off는 native picker에서 선택했다고 주장하지 않고 기존 초기 off 검사를 사용한다. 읽기용 preview POST는 별도 집계하고 실제 mutation 전달은 차단한다.

시각 검수는 초기 최종 후보 PNG10장과 최종 재실행의 모바일·held/소파/blur 대표 화면을 구별해 읽었다. 제목 오른쪽 로그아웃·월 이동 줄 gear, 실제 표시 크기의 HD, 소파 전후 깊이와 중립 키보드 표시는 확인했으나 정지 PNG로 모든 이동 경로나8개 음식 수량을 증명하지 않는다. 기존221개 통합 증거와 motion18개의 SHA를 백업/복원했고 초기 실패4개·진단·최종 성공의 raw를 모두 분리했다.

## 실제 운영 확인

- 기존 Chrome의 개발자 로그인 세션에서 열린 편집창/일반 창이 없음을 확인한 후 새 배포를 읽었다. 인증/세션 추출·실제 로그아웃 클릭·권한 변경·일정 입력/저장 없이 UI만 확인했다.
- 실제 CSS390×844 모바일 편집실의 로그아웃 grid row1, 제목/로그아웃 중앙Y가 모두34.34028px, gear top65.67709px/right13.99303px였다. 설정을 실제로 열고 X로 닫은 뒤 `/studio` 유지·dialog0·원래 gear 초점 복원을 확인했다. mobile pet0, viewport override 해제 후 PC pet1이었다. 교감/볼륨 등 저장 취향을 바꾸지 않았다.
- 모바일 전환의 scroll anchoring으로220px 내려간 초기 캡처는 최종 배치 증거로 쓰지 않았다. native Ctrl+Home으로 실제 scroll0을 확인한 뒤 제목/로그아웃/월 이동/gear가 함께 있는 `companion-066-production-mobile-header-correct.jpg`를 새로 저장했다. 원래 scroll0과 PC 화면을 복구했다.
- 익명 운영 PC1920/DPR2·390×844·1120×600 coarse3뷰 smoke exit0. PC 실제 집기/관성/hover/음식8개/소파 앞면/집 접기 복귀, 모바일 pet/집/asset/설정 탭0·기존 master 취향 보존·설정 X/Back/focus를 확인했다. 각 뷰 POST `/`1회는 차단했고 실제 mutation 전달0/pageerror0·SOOP GET stub각1회였다. 현재/미래 달에 시험 일정을 만들지 않고 기존2025-09를 읽었다. 초기 smoke 명령의 `VIC_VERIFY_SHA` 누락은 브라우저 시작 전 preflight 실패였으며 변수를 지정한 실행과 구별한다.
- 운영 GET gate exit0. 두 fixture는 HTTP200 스트림의404 NotFound fallback이며 제품 markup0, 익명 Studio는 공개 화면으로 streamed redirect/Studio markup0이었다. 이는 전체 RLS/과거 노출 부재 검증이 아니다.
- `.scratch-pw/companion-066-product-production-deploy.json`, `companion-066-public-production.json`, `companion-066-pc-public-production.json`, `companion-066-production-gates.json`에 배포/운영 원자료를 보존했다. 최종4파일 SHA는 `companion-066-final-product-hashes.json`, 최종41개 요약은 `companion-066-final-v2-qa-summary.json`이다. 종료 문서는 제품 파일을 더 수정하지 않는다.

브라우저 부하/CPU throttle 검증은 해당 브라우저·장비 조건의 증거다. 실제 OBS 장면의 인코더/GPU·SOOP 업로드/수신·네트워크 지연을 측정한 실험이 아니며, 모든 방송 환경의 프레임 안정성을 보증하지 않는다.

## 공식 근거와 적용

- [web.dev — Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing): 스타일 쓰기 후 기하를 읽는 반복은 동기 layout을 유발할 수 있어 읽기를 먼저 모으도록 권고한다. 음식 batch와 중복 anchor 읽기/표시를 줄이는 근거로 적용한다. 실제 병목 크기는 전후 trace로 별도 판정한다.
- [MDN — Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API): Web Storage 조회·쓰기·삭제는 동기 작업이다. 작은 설정의 저장 형식은 유지하고, 프레임마다 재조회하는 대신 변경 이벤트로 등급 snapshot을 갱신한다.
- [OBS — Browser Source](https://obsproject.com/kb/browser-source): Browser Source는 CEF 기반이며 viewport·사용자 지정 FPS·비가시 source 종료 옵션을 가진다. 이 경로를 고려하되 제품 해상도/FPS를 임의로 낮추거나 브라우저 측정만으로 실제 OBS/SOOP 송출 완료를 주장하지 않는다.
