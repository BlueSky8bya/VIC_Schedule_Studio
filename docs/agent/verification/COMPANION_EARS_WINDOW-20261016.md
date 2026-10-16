# 빅타민 귀·편집 이동·창 소유권·패널 버튼

2026-10-16 KST. [PLAN-069](../plans/PLAN-20261016-069-companion-ears-and-window-ownership.md). 구현·검증·운영 배포 확인 완료. 제품 `0432443a3874523a1f2b035aabb06af0d97b7f82`. 미술 승인·OBS 송출 합격은 주장하지 않는다. DB/공개 DTO/권한/unlock/KST·1840 poster·모바일 companion 제외는 보존한다.

## 확인한 원인

편집실 schedule/span drag 상태가 shared companion의 blocked prop으로 전달되어 같은 엔진을 숨기고 해제했다. 일반 팝오버는 collision-free 표시 perch를 따로 계산하고 닫을 때 원래 world로 되돌아가는 경로가 있었다. 최신 소유자는 두 동작을 폐기하고 창 뒤 실제 위치에 머물도록 요청했다. 발견된 hide-seek guest는 별도 기존 detail 경로를 유지한다.

원화36키포즈의1-based5행2열/5행4열/2행5열/4행2열(0-based25/27/10/19)은 두 귀가 충분히 보이지 않는다. 기존 기술 패킹/동작 검증은 이 외형 실패를 검출하지 못했고 독립 미술 PASS/사용자 승인은 없었다. 해당 원본/회차는 보존하고 이번 지정 귀 교정만 새 회차로 진행한다.

## 구현과 아트

- Studio의 실제 edit drag는 `workspaceBusy`로 전달해 새 결정/교감/음식/장난 입력만 잠시 막고 엔진/DOM/그림을 보존한다. 잠시 숨겨진 drag source도 현재 실제 지원의 identity/캐시를 유지하고 끝나면 다시 측정한다. 기존 editor가 native 입력과 저장 경로를 소유한다. 종료 시 이전 frame/timer를 먼저 회수해 중복 체인이 생기지 않게 한다.
- 일반 창은 현재 world에서 유한 행동 완료→quiet sleep을 잇고 표시 perch를 따로 만들지 않는다. 창을 닫아도 collision-return 이동은 없다. Studio 편집기는 기존75/76인 pet/sofa carrier 위80에, 발견 guest만98에 놓는다. 공개 detail의 기존 window layer와 같은 결과이며, 집 주민/소파 depth와 발견 guest의 직접 꺼내기는 유지한다.
- 실제 공유 패널 화살표의 top−3px를 등록된 발판으로 쓴다. 장난은90활성초 이후 현재 실제 반대쪽 버튼 위에서만 낮은 확률로 고르고 cooldown도90초 이상이다. `panelPrank`는 빅타민→장난의 독립 토글이다. 정확히 그 control만 받는 typed callback으로7초간 일시 side preview 후 원래 저장 위치로 돌아오며 사람의 좌우/접기/다른 화면 변경은 즉시 우선한다. 임의 DOM click·저장 위치 덮어쓰기·새 brain loop는 없다. 창/편집 drag/최초공개/숨김/reduced/gfx OFF는 우선한다.
- 새 `20261016-귀두개교정` 회차에서 실제 사용자 원문→요청 귀/연결부 한정 독립 검수1회(네 칸 FAIL)→preflight/once claim→builtin edit1회→native 관찰/등록을 보존했다. native SHA `a155a1597dd89dbc8957cb1c9aad20de7cc68245bed54c077bc53c81056ab89a`. 생성자 관찰로 네 포즈의 두 귀를 확인하고 결과를 사용자에게 표시했으며 수정 후 독립 미술검수·사용자 승인은 주장하지 않는다.
- 전체 포즈4개만 원래 index10/19/25/27에 연결했다. 기존12WebP는 SHA 불변이며 새4개 `-ear-v2` packet(21/24/27/28) 합409,938B다. 같은 packet의 미요청 column도 기존 decodeRGBA와 정확히 같다. 나머지8atlas/frame객체/rows·기존HD 인덱스·192물리/80논리·lazy decode2/LRU3는 유지한다. 실제92CSS 전후 비교는 `.scratch-pw/companion-069-art/four-poses-css92-before-after.png`이며 위068/아래069다. 현재 canonical 재현 검사는 `node scripts/prepare-companion-ear-repair.mjs --check`; 역사068스크립트·원본·기록은 바꾸지 않는다.

## 검증 진행

첫 unit은 교정 packet 경로를 아직 반영하지 않은 구형 literal assertion1건 실패/456통과였다. metadata 경로 assertion과 선택 패킹5case를 마무리한 뒤43파일462unit 통과,069패킹 `--check` 통과. 첫 production build `TpiRUGXbEErHw8nkZXIX2`의33개 검사는13번째에서 중단했다. 업도움 synthetic fixture가 과거6월에 끝나 실제 Studio의 ‘이미 끝난 업도움 제외’ 필터에 걸린 준비 오류가 있었고, build 후 workspace frame 예약 중복 보완도 있었으므로 단일 최종 PASS로 합치지 않았다. 중단은 JSON report를 내보내지 못했으며 첫 error-context·drag raw/PNG와 `.scratch-pw/companion-069-first-trial-notes.md`/`companion-069-first-preserved/`를 남겼다.

Fixture만 과거6월 시작/실제 KST오늘 종료의 synthetic 지원바로 바꿔 실제 native 경로를 검사한다. 실제 일정/과거·현재·미래 DB 시험 생성/수정은0이며 clock override도 없다. 새 최종 build `PrWSm_YZjoNOa0qhRwTEg` 전후29개 변경 source의 SHA가 동일하다(`companion-069-source-before-v2.json`, `companion-069-source-after-v2.json`). 타입/린트/build·최종 실물 결과를 추가한다. 기존 harness의 rule inventory2오류는 그대로 실패이며 상품/미술 검사 PASS에 섞지 않는다.

두 번째 실물 실행은35개 중33통과/2실패였다(`companion-069-final-v2-report.json`). 실제 결함1개는 발견 guest를 창 밖으로 놓은 좌표가 fresh geometry까지 world로 넘어가지 않아 닫기 첫 프레임에 옛 world x를 보여주는 약50px flash였다. 일반 창을 밀어내지 않는 새 정책과 별개인 **명시적인 guest drop만** 현재 표시 좌표를 즉시 world로 넘기고 기존 유한 helper로 같은-x 실제 발판까지 세로 착지한다. 일반 창에는 return helper/속성이 생기지 않는다. native guest-close rAF의 x/hidden/sameDOM과 released/still/landed를 단언 전에 보존하도록 확장했고 x<3px 기준은 유지했다. 다른 실패는 Studio editor가 닫혀도 selected `.is-edit` DOM은 마운트된 채 `.studio-workspace:not(.editor-open)`에서 숨는 기존 구조를 count0으로 요구한 oracle였다. 실제 workspace 닫힘+가시성으로 수정하고 viewer detail은 계속 count0을 요구한다. 이전35개 결과·raw/PNG는 `companion-069-v2-preserved/`에 별도 보존했다.

이 보완 뒤 관련43파일463unit·문서2파일43unit 통과. 기존helper의 guest-only 수직 착지/배율/고정x도 별도 unit으로 검사했다. 최종 code/build/source 및35개 화면 재검증 결과는 이어 기록한다. Controlled focus/clock을 쓰는 기존 숨바꼭질 fixture 결과는 실제 OS background/OBS 검증으로 확장하지 않는다.

최종 build `ildIRXlnDruMSctRs4fW9`의 타입·린트·build exit0, 변경 source31파일의 build 전후SHA 동일. 최종 실물35/35통과(4.9분, retries0), flaky/skipped0이다(`.scratch-pw/companion-069-final-v3-report.json`). 앞선 실패/중단을 이 배치로 덮어쓰지 않았다. 양쪽 실제 창을 pet 위로 native drag해 hit-test로 창의 입력 레이어 우선을 확인했고, 열기/닫기 전 프레임의 실제 위치·같은DOM·hidden/returning0을 검사했다. Studio 일정/업도움/기간안내125/123/124프레임에서 hidden/교체/POST/pageerror0, busy 동안 입력 잠금을 확인했다. 발견 guest의 실제 닫힘 프레임은 `companion-069-guest-close-1920.json`에 x<3px 기준과 함께 보존했다. 패널의 실제 발판/사람 클릭영역,7초 복귀·사람 선택 우선, 기존 집6·소파3·프레임4·숨바꼭질/편집실 guest·모바일 제외8도 최종 배치에서 통과했다. 자연90초/5.5% 결정은 seed unit,7초 callback 수명은 명시된 controlled capability와 실제 UI로 분리해 검사했다. 실제 운영 SHA/자산/두 화면 확인은 배포 뒤 기록한다.

원화/기술 패킹의 독립 코드 검토와 창/패널 담당의 상호 검토를 통합했으며 차단 지적은 남지 않았다. 수정 후 독립 미술검수는 추가하지 않았다. 일반 창186/196프레임의 최대 위치 차이는 viewer0.83px/Studio0.90px, hidden/DOM교체/returning/POST/pageerror0이었다. 발견 guest의84개 닫힘 프레임은 x오차0·hidden/교체0이었다. 생성·검수 JSON은 Git의 줄바꿈 정규화로 원본과 byte 차이가 생긴 것을 확인해 이번 회차에만 `-text -eol whitespace=cr-at-eol`을 지정하고19개 회차 파일의 실제 index/raw 바이트 일치를 확인했다. 계약·원문·claim을 재작성하거나 원본 SHA를 바꾸지 않았다. 제품 source31파일은 commit `0432443a3874523a1f2b035aabb06af0d97b7f82`와 정규화 SHA가 모두 일치한다(`companion-069-committed-source-proof.json`).

## 운영 확인과 종료

제품 [Vercel 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/8VGCQh41sznbAATu1MjkSQjRfozK)는 success이며 운영 `/api/soop-live` build도 같은 전체 SHA였다(`.scratch-pw/companion-069-production-deploy.json`). 새 귀 교정4WebP 모두 HTTP200/로컬 SHA 일치(`companion-069-operating-assets.json`). 실제 로그인된 개발자 편집실의0432443 배지와 ordinary 편집창의80/pet75·quiet/parked·returning 없음, native X와 Escape 닫힘을 확인했다. 첫 close wait는 timeout이었으나 Escape로 닫은 뒤 새 native 열기/X는 정상 종료됐다. form 입력·일정/띠 이동·하트 투표·설정 변경은 하지 않았다. 실제 이동은 쓰기 차단한 위 fixture의 세 native drag로만 검증했다.

실제 메뉴로 시청자 미리보기에 들어가 같은 공개 일정을 열고 pet75/실제 backdrop90·quiet/parked·returning 없음과 닫힘을 확인했다. native 짧은 클릭이 `bonk-tears`로 들어가는 것까지 운영에서 확인했으나 순간 packet27을 기다린 단일 wait는 timeout이었다. 운영 연속 포즈 계측을 합격으로 부르지 않고, **동일 최종 제품 build**에서 기존 실제 클릭/drag/중력 검사4개를 추가 실행해 모두 통과했다(32.3초, retry0, `companion-069-play-report.json`). 실제 새27-ear-v2 packet→회복과 양쪽 drag interrupt,9개 설정 조합 UI,Studio 낙하 중 클릭이 포함된다. 이로써 해당 build의35개 회귀+4개 보강이 통과했으며 단일39개 배치라고 부르지 않는다. `companion-069-live-packets-*` raw/PNG도 별도 보존했다.

운영 screenshot은 `companion-069-operating-studio-window.png`, `companion-069-operating-viewer-window.png`다. 실제 편집실 돌아가기 버튼으로 preview를 종료했고 editorOpen false·preview0·태그/계절/집 펼침 false/true/true·저장 side right를 유지했다. 원래 theme/master/종/성향/걸음은 바꾸지 않았고 확인용 탭도 닫았다. 운영 노출 이미지의 외형은 위 생성자 관찰/실제92CSS 확인 범위이며 별도 수정 후 전문 검수·사용자 시각 승인이나 실제 OS/OBS 송출 품질을 인증하지 않는다. 남은 harness2오류는 기존 inventory 문제로 별도다.
