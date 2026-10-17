# 빅타민 습관 설명·빠른 놓기 검증

Status: Deployedecaa940f and verified; final local/independent checks and remote quality all PASS. [PLAN-086](../plans/PLAN-20261017-086-companion-habits-and-release.md).

## 변경

공유 설정의 작은 회색 각주를 별도 ‘배운 습관’ 카드로 분리했다. 교감/놀이/새로운 곳의 실제 임계값을 넘은 성향만 행으로 표시하고 중립·초기화·학습OFF를 구분한다. 저장/학습/초기화·돌봄 값은 유지하며 새 점수/프로필/서버 수집은 없다. ‘손길’은 쓰다듬기로 바꿨고 기존 쓰다듬기 안내 음성용 텍스트도 통일했다.

`viewer-companion.tsx`의 `settle()`은 수직 아래 첫 발판과 같은 x의 보호 바닥을 찾지 못하면 `awaitingAtX="drop"`으로 숨긴 채 같은 열만 재검사했다. 집 열기 버튼 등으로 바닥이 끊긴 위치에서 빠르게 놓으면 복구하지 못했다. 일반 `pointerup`은 release 좌표 대신 직전 move 좌표를 사용했다.

정상 release는 공통 move의 grip/clamp를 한 번 더 소비한 뒤 표시·착지를 결정한다. cancel/lost capture는 기존 위치를 보존한다. 첫 수직 충돌/같은 x 바닥을 우선하고, 모두 실패한 명시 drop에만 가장 가까운 **실제 안전 viewport 바닥 조각**으로 기존 유한 보간을 사용한다. 팝오버에서 꺼낸 뒤 창을 닫는 pendingDetailDrop에도 같은 복구를 적용한다. 수동 스크롤의 수직 복구·소파·음식·공개/역할/언락/KST/1840 기하는 보존하며 새 상시 loop/scan/API는 없다.

## 재현·격리 결과

99ee2a76 기반 `C:/Projects/VIC-086`의 production build `qEYaKkNdaxGAa0578oq9R`에서 native 한 번 이동→즉시 release로 실제 재현했다. 집 열기 버튼 위쪽 x, 화면 아래 y에 놓은 뒤 관측67frame 모두 hidden, platform 빈 값, state held 잔존이었다. 별도 CDP native mouseReleased가 직전 move보다650px 오른쪽인 경우 최종 위치도650px 잘못됐다. DOM 이벤트/제품 callback/위치를 주입해 실패를 만든 검사가 아니다.

기존 패널 버튼 중앙 x는 안전 바닥이 있어 성공했다. 이어 `.vc-home`이 항상 펼쳐져 있다고 가정한 하네스는 실제 compact launcher 상태에서 timeout했다. 실제 launcher 또는 표시된 집을 선택한 뒤 제품 실패를 확인했다. 최초 config의 상대 testDir 오류(`No tests found`)도 제품 결함으로 세지 않는다. 실패 JSON/PNG/context는 `.scratch-pw/fast-release-before-launcher-*`, `final-pointer-before*`에 보존했다.

수정 후 격리 build `dpUF4gVs3Kg65WN-jknrt`:

| 검사 | 결과 | 범위 |
|---|---|---|
| 전체 unit |1,929/1,929 PASS |기존 수직 착지 계약 유지+실제 바닥 회복3회귀·습관 행1회귀 |
| 빠른 놓기 |10/10 PASS |시청자/편집실×full/lite/reduced/off의 native 놓기+스크롤8, 마지막 release 좌표2 |
| 습관 UI |6/6 PASS |시청자/편집실×light/dark4+기존 실제 습관/reset2 |
| 기존 잡기/게스트 |6/6 PASS |자연 숨기→편집 팝오버에서 꺼내기, 관성/반전/가장자리/감소/OFF/잠든 상태 집기 |
| 정적/빌드 |build·typecheck·전체 lint PASS |해당 격리 소스 |

습관 UI4장은 직접 열어 읽기·정렬·잘림을 확인했다. 본문13.5px 이상/실효 명도 대비4.5 이상, 학습OFF 기억·reset 돌봄 보존·새로고침 후 선택 유지, 새 설정 검사 POST0/pageerror0을 확인했다. 최초 studio 접힌 패널 진입 실패2건 및 불필요 viewer 패널 조작 실패는 하네스 교정으로 분리 보존했다. 중간 중단된 실행에는 완료 JSON이 없고 terminal/context만 남는 범위를 명시한다.

검증용 새 GET `/`·`/studio` prefetch는 로컬 빈 응답으로 막아 실제 공개 DB 읽기를 줄였다. 최초/기존 검사 일부는 로컬 root prefetch를 통해 읽기 전용 public loader를 불렀다. 운영 DB 쓰기는 차단했고 실제 계정/데이터를 수정하지 않았다. 모든 검사가 DB 요청0이었다고 주장하지 않는다.

독립 검토에서 pendingDetailDrop의 누락을 발견해 보강했고 최종 차단0을 확인했다. 소유자의 동시085 귀가 수정은 제거/덮어쓰기 없이 diff로 반영했고, 아래 통합 검증을 별도로 기록한다.

## 통합 검증

085가 실제 귀가 경로를 수정한 메인 작업 내용을 보존한 채086 diff만 적용했다. 겹친 home-route 단위/화면 검사는 최신085 내용을 유지하고 습관 문구·행별 단언만 교정했다. 메인과 동일한11개 변경 source/test 파일을 격리 작업트리로 복사해 실제 통합 build `8FdhRmZTfwAuGpAy-fTvY`를 만들었다. 최종 검사 직전 두 작업트리11개 파일의 바이트 일치를 확인했다.

- 전체 unit **1,932/1,932 PASS**, skip0. 격리086의1,929개와 구분한다.
- build·후속typecheck·전체 lint PASS. 두 fixture의 실제 HTTP HTML에 해당 build ID 포함 확인.
- 통합 rendered **22/22 PASS**: 빠른 놓기10+습관/실제reset6+기존 관성/게스트6. 재시도/skip/flaky0. 두 report는18개/4개로 분리되어 있다.
- 라이트/다크 카드·실제 놓기 후 표시 PNG 직접 검수. native 빠른 놓기와 후속 scroll 관측에 hidden0, 마지막 release 좌표2px 이내 단언을 유지했다.

원본은 작업트리 `.scratch-pw/companion-086-combined-{unit,visual,ui}.json` 및 `086-served-build.json`, `086-combined-source.json`; 복사본과 주요 PNG는 메인 `.scratch-pw/companion-086/`에 보존한다. reporter 상대 경로 때문에 visual/ui 원본은 작업트리 `.scratch-pw/.scratch-pw/`에 있었음을 구분해 복사했다. 문서 harness와 diff whitespace도 확인한다. 코드/검사만 로컬에 반영했으며 커밋·푸시·운영 배포는 하지 않았다.

## 문구·좌우 균형 후속 및 배포 승인

이후 소유자가 ‘설명 어미가 너무 AI스럽고 좌우 균형이 맞지 않는다. 수정해서 배포’라고 요청했다. 이 요청이 최초086의 미배포 상태를 대체하며, 아직 로컬에 있던085 실제 귀가/086 빠른 놓기 수정을 함께 배포한다. 요금제·DB·권한 변경은 포함하지 않는다.

습관은 ‘쓰다듬기와 곁에 있기’, ‘장난치고 탐험하기’, ‘낯선 곳도 씩씩하게’처럼 짧게 표시한다. 제목/설명과 하단 초기화를 중앙에 맞추고, 실제 습관 개수만큼 같은 폭으로 나눈다. 360px 이하 카드만 세로 구성이다. 중립에 없는 성향을 추가하지 않고 기존±.12 임계값/기억/돌봄/reset을 유지한다.

최종 production fixture build `ieqZbE33fSgrlw4I_rZ8J`: build·후속typecheck·전체 lint와 전체 unit **1,932/1,932 PASS**(skip0). 메인/격리 작업트리의 변경 source/test13파일 바이트 일치와 양쪽 실제 HTML의 build ID 일치를 확인했다. 새 UI4사례는 제목/설명/버튼/타일 전체 중심·좌우 padding·타일 폭 차이≤1px, 본문13.5px 이상·대비4.5 이상·잘림 없음, 학습OFF/reset/새로고침 보존을 단언했다. 최신 PNG4장은 root와 독립 리뷰어가 직접 확인했다. 독립 소스 리뷰는 통합085/086 이동과 새 UI에 차단0이며, 서버 DTO/권한/DB/API 경계 변경이 없다.

전체 통합 rendered와 배포 결과는 아래 확정한다. 원본은 작업트리 `.scratch-pw/companion-086-final-{unit,visual}.json`, 메인 복사/증거는 `.scratch-pw/companion-086/086-final-{source,build}.json` 및 `companion-086-habits-final-{surface}-{theme}.png`. 이전 디자인4장은 `*-before-balance.png`로 보존했다.

첫 후속 전체 렌더는 **32/33 PASS, 1실패**였다. 창 축소로 집이 compact 버튼으로 바뀐 뒤 열자마자 귀가를 누르면, 실제 집 DOM보다120ms 간격의 발판 측정이 늦게 갱신되어 유효한 호출을 ‘집을 펼쳐 주세요’로 거절했다. 같은 native 조작3회에서1회 재현했고2회 성공했으므로 단순 timeout 증설/재시도 PASS로 처리하지 않는다. trace의 `after@call@152`에는 열린 집이 있고 `after@call@154`에는 위 잘못된 안내와 귀가 명령 누락이 있다. 실패 report는 `companion-086-pre-fold-fix-visual.json`, 별도3회 report/trace는 `companion-086-fold-reproduce*`에 보존했다. 이후 실제 열린 집의 호출만 기존 geometry 재검증까지 한 번 보관하도록 수정·재검증한다.

보강: 연결·표시·펼침 상태인 같은 쿠션 노드에만 요청 하나를 보관하고 기존120ms 측정에 완료 전달을 요청한다. 새 입력/드래그/다른 집 조작/overlay/pause/DOM 교체면 취소한다. 측정 적용 뒤 pending을 먼저 지우고 기존 귀가 함수를 재요청 없이 한 번 호출한다. 독립 리뷰가 ‘동일한 측정 결과에는 callback을 생략하므로 pending이 남을 수 있음’을 지적해, 명시 호출의 `revalidate(true)`만 동일 결과에서도 한 번 전달하도록 보완했다. 일반 추종의 `revalidate()`는 기존 중복 억제를 유지한다. 새 단위 회귀는 동일 결과의 일반 억제→명시 요청 여러 개의 측정1회/전달1회→후속 일반 억제를 검증한다. 관련 geometry/home unit **63/63 PASS**, 독립 후속 소스 리뷰 차단0. 새 상시 loop/타이머/서버 요청이 없다.

보강 후 최종 build `FjBCgLBfH0mm62aMkRKPn`, build·후속typecheck·전체 lint·전체 unit **1,933/1,933 PASS**(201파일, skip0). source/test14파일이 메인과 검증 입력에 일치한다. 앞선1,932개/ieq build 결과와 구별한다. 최종 report는 `companion-086-release-unit.json`, `companion-086-release-visual.json`, 문제 조작 반복은 `companion-086-fold-fixed-repeat.json`; 메인 증거 묶음은 `.scratch-pw/companion-086/`이다.

- 최종 전체 rendered **33/33 PASS**(4.0분), 별도 native race 반복 **5/5 PASS**(47.3초). retry/skip/flaky0이며 최초 실패를 지운 재실행으로 집계하지 않는다. 같은33개 전체 suite에 실패 사례도 다시 포함했다.
- 설정·습관/reset6, 실제 귀가/resize/취소11, 빠른 놓기10, 편집 게스트1, 관성/overlay5를 포함해 총33개다. 실제 브라우저 report를 기준으로 집계한다.
- 최종 crop4장과 전체 설정창 viewer-light/studio-dark2장은 독립 검수에서 잘림/겹침/정렬 결함0. root도 전체 창과 light/dark 카드를 확인했다. 기존 화면과 새로운 화면의 PNG를 구분해 보존한다.
- source/test14파일 동일 및 두 실제 fixture HTML의 최종 build ID 일치. 명시25파일만 release index에 넣고 사용자 art/preview/.vscode/환경 파일을 제외했다. 비밀 형식5종 매치0·diff whitespace·문서 harness233개 PASS. 운영 플랜/데이터/권한 변경은 없다.

## 운영 배포

소유자 승인에 따라 main `ecaa940f37ecb40e33716ca9452b50791e5e535c`를 push했다. [Vercel 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/FsoVAf8LrcPuFyhPtS68gu3c4Sgx) success, 실제 운영 `/api/soop-live` 전체 SHA 일치를 확인했다. public clock200/no-store·warm204/public-readiness·익명 developer presence401/no-store/고정 unauthorized/운영 필드0, production fixture의 streamed404 비노출도 확인했다. [원격 quality39006074013](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39006074013)는 unit·격리 SQL5·harness·실제 production build·typecheck·lint·마무리까지 모든 단계 success다.

실제 로그인된 개발자 편집실에서 배포 표기ecaa940을 확인하고 설정→빅타민→성격을 열었다. 새 제목/intro/빈 습관 문구/하단 초기화가 실제 운영에 표시됐다. read-only DOM 측정에서 제목/버튼 중심 오차0.009px 미만, 좌우 padding14px씩, overflow=false이며 실제 스크린샷도 검수했다. 첫 측정 스크립트의 CUA `parseFloat` 미지원 오류는 CSS 문자열값 비교로 교정했다. 일정 편집·취향 변경·습관 초기화는 누르지 않았다. 이 실제 UI의 활동 전송은 계측하지 않았으므로 production POST0 또는 활동 저장 검증으로 확대하지 않는다. 실제 계정/RLS의 전수 검사도 아니다.

원본은 ignored `.scratch-pw/companion-086-{release-check,ci-jobs,production-ui}.json`. 커밋은 사용자 art/preview/.vscode를 포함하지 않았다. 사후 배포 결과는 로컬 문서에 기록했으며, 제품 변경 없는 기록만을 위해 추가 운영 배포를 만들지 않았다. Hobby 무료 포함량 초과와 실제 방송 PC 검증은 별도 열린 항목으로 유지한다.

## 한계

안전한 실제 바닥이 전혀 없는 geometry에서는 기존 숨김 안전 게이트가 남는다. ‘모든 상황에서 무조건 표시’나 모든 scroll/기기/창/숨기/최초공개 순열·OBS 실방송 무끊김을 증명하지 않는다. 기존 게스트 검사는 정상 꺼내기 경로를 검사하며 새 pendingDetailDrop의 바닥 gap을 별도 native 사례로 전수 검증한 것은 아니다. 실제 운영 로그인·활동 DB 저장은 fixture 증거와 구분한다. 운영 플랜·Vercel 한도는 변경하지 않았다.
