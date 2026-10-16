# 함께 지내며 달라지는 빅타민 성향 — 2026-10-17

대상: [PLAN-075](../plans/PLAN-20261017-075-companion-adaptive-habits.md). 시청자·비로그인·미리보기·편집실이 같은 로컬 runtime/profile를 사용한다. 모델/서버 호출·새 이미지·실제 사용자의 성격 추정은 없다.

## 동작과 저장

- 수동 동물 모드·성격·걸음은 기준값으로 보존한다. 친화성·놀이성·자신감은 별도 작은 연속 경험값이다. 기존 배고픔/친밀감/피로/호기심, 초 단위 기분과 혼동하지 않는다.
- 인정된 쓰다듬기→친화/신뢰, 취소되지 않은 수동 이동·꺼내기→놀이/신뢰, 실제 사용자 음식 섭취 성공→친화/신뢰, 직접 딱밤→더 신중한 접근으로 조금씩 바뀐다. 한 경험의 EMA 계수.035, 최대 성향 변화.07. 뒤의 다른 경험으로 회복 가능하다.
- 경험은1개 credit을 쓰고18초의 실제 활성 시간으로만 다시 충전된다. 인정된 경험만 한 번 즉시 저장해 빠른 새로고침으로 credit이 되살아나지 않게 한다. 연타·키 반복·pointermove·취소·실패한 섭취·음식 생성/이동·자동 착지/휴식/장난/탐색으로 성향을 강화하지 않는다. 접속하지 않음·휴면·숨김 탭에는 성향 감소·부재 감점이 없다.
- 프로필은 실제 포인터 접근 거리/관심, 놀이·활동·새 장소 탐색 가중치, 관찰 리듬을 제한적으로 보정한다. 선택한 걸음의 속도/도약 높이·고양이 습관·피로 기준, 꺼 둔 기능·직접 조작·창/presence/최초공개·감소 동작/gfx 권한은 유지한다.
- 공유 설정>빅타민>성격의 ‘함께 지내며 배우기’는 기본ON이고, 빅타민 마스터는 기본OFF다. OFF는 학습과 보정 효과를 멈추고 기억은 보존한다. ‘배운 습관 초기화’는 배운 값만 지우고 needs/수동 설정을 보존한다. 집에 버튼·생각 문구·통계 대시보드를 더하지 않는다.
- 기존 `vic.viewerCompanionCare`를 v1 네 needs에서 v2의 명시적 needs+habits로 읽기 호환한다. habits는 성향3개·credit·로컬 reset generation의5숫자만 저장한다. generation은 초기화 뒤 옛 snapshot을 거부하고 같은 경험의 재학습은 허용하기 위한 값이다. 신원·날짜·좌표·일정/음식 ID·입력 궤적/원본 행동 기록·제목/본문은 저장/전송하지 않는다. 필요 없어진 값은 습관 초기화 또는 브라우저 저장소 삭제로 제거하며, 성향의 별도 만료/접속 시각은 수집하지 않는다.

## 비용·경계

새 학습은 완료된 실제 입력 경계에만 있다. credit은 기존250ms needs 경계에서 O(1)로 충전하고 trait 자체는 그때 바뀌지 않는다. 일반 store 갱신은 기존5초 예산, 인정 경험은 최소18초 활성 credit 예산의 force1회, 섭취는 중복 force를 제거해1회다. 저장소 읽기도 초기 시도/실제5초 쓰기/force/명시적 조회·storage event로 제한한다. quota/차단 실패는 메모리와 같은 재시도 예산을 유지한다.

새 타이머·프레임별 학습/경로 탐색·DOM scan·네트워크·DB·의존성은 없다. 설정 두 조작은 기존 활동 기록에 고정 ID 이름만 추가하며 성향 수치/자율 결정 로그는 보내지 않는다. 공개 DTO·권한·unlock·KST·모바일 제외·92px·1840 포스터/소파/입/스크롤 기하·사용자 아트는 보존한다.

## 검증 상태

- 독립 검토에서 실제 입력/취소·자율 행동 분리, OFF·휴면·동기 저장 예산을 확인했다. 식사 시 연속2회 force 저장은1회로 합쳤다. 초기화 stale 차단에서 credit 변화 및 같은 경험 재학습 충돌을 발견해 단순 숫자 reset generation으로 교체했다. care 작성자 외의 독립 검토와 runtime/profile 통합 검토에서 추가 차단 문제는 없었다.
- 초기 생산 fixture build `NUSE91Sm74filc645hvq6`에서 실제 교감/새로고침, OFF/초기화, 직접 딱밤·드래그, 실제 식사6개 PASS(47.360초,0retry/flake/skip). generation 변경 전 진단 결과이며 최종 검증으로 재사용하지 않는다. 원 보고서는 `.scratch-pw/companion-habits-trial-v1-report.json`에 보존한다.
- 최종 생산 fixture build `BGFWYstCt9Lc1MVFCiW2_`: build/typecheck/lint PASS. 관련 companion49파일538검사 PASS. 새 순수 학습13·적응 프로필7·care23, 기존 preferences16·활동 이름7을 포함한다. 문서 관련43검사 PASS. 전체 unit은1675개 중1667 PASS/8 FAIL이며, 종전6파일8실패와 동일하다. 실패 관련20파일의 Git blob이 직전 검증과 같음도 확인했다.
- harness는 종전2건 FAIL: active rule ID inventory 및 RULE_MIGRATION inventory/live rule 불일치. 전체 unit/harness를 PASS로 표시하지 않는다.
- 최종 native7개 PASS(52.853초,0retry/flake/skip). 두 화면의 실제 교감→즉시 새로고침/credit 유지, 학습OFF·needs/설정 보존 초기화, 직접 딱밤/정상 드래그, 음식 생성·잡기 무학습과 실제 섭취 학습을 확인했다. 동일 첫 교감의 성향값 `[.035,.00525,.028000000000000004]`는 초기화 전 generation0과 초기화 후 generation1에서 각각 정상 학습되고 즉시 새로고침 뒤 유지됐다. 학습 함수 직접 호출·가짜 시계 없이 실제 입력으로 수행했다. mutation/페이지 오류0.
- 같은 빌드에서 추가 왕복1개 PASS(3.364초,0retry/flake/skip): 실제 시청자 Enter 교감→같은 브라우저 편집실 진입→편집실 실제 Enter→브라우저 뒤로가기까지 성향/generation 유지, 사용한 credit을 다시 지급하지 않음 확인. 원7개 보고서는 보존하고 추가 결과는 `.scratch-pw/companion-habits-cross-surface-report.json`에 분리했다. 최종 spec8개는7+1 두 실행으로 확인했으며 왕복 mutation/페이지 오류0. 추가 spec 뒤 typecheck도 PASS.
- 실제 캡처3장(시청자/편집실 밝은 설정창, 시청자 어두운 설정창)을 읽어 새 switch·초기화·설명 가독성/잘림을 확인했다. 증거: `.scratch-pw/companion-habits-report.json`, `companion-habits-{viewer-settings,studio-settings,viewer-dark-settings}.png`.
- 공유 회귀24개는23 PASS/1 FAIL(2.9분,0retry/skip). 모바일 제외8·편집실 숨기/꺼내기1·프레임/스크롤/음식4·소파3·창 소유권2의18개는 모두 PASS. 이전 deliberation6개 중5 PASS, 편집실 최초 음식 관찰의 실제 texture 픽셀1개는 FAIL이다. 원본 결과를 보존했으며 성공한 재실행으로 이 실패를 덮지 않는다.
- 해당 texture 증상은 [직전 검증](COMPANION_DELIBERATION-20261017.md)에서도 관찰된 기존 경로다.075의 paint/아트/`sprite-quality.ts`/CSS는 바뀌지 않았다. 이번 캡처는 첫 Image 응답3058.6ms 뒤 CSS packet 교체3085.6ms, 별도 CSS 요청 응답3090.0ms, screenshot3091.5ms에서 실제 주황 픽셀0을 보였다. opacity/clip/기하는 유효했다. 이미지 decode 완료가 CSS의 첫 paint 완료를 보장하지 않는 간격이 확인됐다. route interception의 HTTP cache 비활성화가 별도 요청을 유발하는 조건이며, 정상 운영에서도 같은 현상이 있는지는 입증하지 않았다. 보존 증거 `.scratch-pw/companion-075-inspect-failure.{json,png}`, 원 실행 `.scratch-pw/companion-075-regression-report.json`. 새 학습7개 통과와 별개인 기존 texture 문제를 ‘해결’로 표시하지 않는다. [열린 검사](OPEN_CHECKS.md#companion-texture--첫-css-packet-paint-간격)에 후속 범위를 남긴다.
- 같은 원본 spec의 독립 진단3회는 모두 PASS(11.06/11.22/11.68초), 실제 색상294px씩 확인됐다. 코드·검사 조건을 바꾸지 않았고 원 회귀 실패도 보존한다. 각 증거 `.scratch-pw/companion-075-inspect-trial-{1,2,3}-{report,case}.json` 및 PNG.3회 성공은 간헐 texture 간격의 해결 증거가 아니다.
- 제품 `08b72ade9810bcd060b50e60828d696b9ce69335` commit/push 후 Vercel/GitHub success 및 운영 `/api/soop-live`의 동일 SHA를 확인했다. 공개 `/`200, 검증 빌드와 같은 companion lazy CSS `c83a1f3c98fee758`와 JS `7863.143bdebb460b6b20`, 실제 초기/shared/lazy 스크립트의 학습·성향·초기화 marker7개를 확인했다. 빌드 입력10파일과 커밋 소스가 모두 일치한다. 증거 `.scratch-pw/companion-075-production-deploy.json`, `companion-075-product-{deployed-resources,committed-source-proof}.json`. 실제 로그인/OBS/장기 사용자 성향 체감 검사를 수행한 것으로 확대하지 않는다. 로컬 fixture 서버는 종료했다.

연구 원문과 프로젝트 적용 추론은 계획에 구분했다. 계수·상한·시간은 제품 결정이다. 실제 OBS 장비·사용자의 장기 주관적 몰입을 자동 검사가 승인한 것으로 확대하지 않는다.
