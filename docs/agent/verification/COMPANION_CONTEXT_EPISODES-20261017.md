# 빅타민 동작 재고와 상황별 연속 행동

[093 계획](../plans/PLAN-20261017-093-companion-context-episodes.md)의 구현/검증 기록. 소유자는 단편 동작이 아닌 원인→반응→접근→실수→회복의 연속성과 기존 아트 활용을 요청했다.092의 일반 탐색은 유지하고, 급식 사고 제외를 명시적인 식사 장면에 한해 대체한다.

## 동작 재고와 실제 접점

`sprite-quality.ts`의 base304+play192=496물리 그림/31atlas/32논리행을 실제 호출과 대조했다. 활성31행을 사용한다.7행은 의도된 legacy-unused이며 그 물리112~126은16/17에서 재사용된다. 활성 메타 참조434개 외62개는 기존 rig/대체 hold 정책에 속하므로 품질을 버리고 노출률을 위해 복원하지 않는다. 새 그림을 생성하지 않는다.

| 논리행 | 사용 맥락 | 코드 |
|---|---|---|
|0 idle·1 look |대기·발견/관찰·냄새·먹기 시작 |`brain.ts`, `deliberation.ts`, `episodes.ts`, renderer |
|2 walk·20 sprint |실제 안전 발판 보행/달리기·종별 먹이 접근 |`getFoodAction`, `planCompanionEpisode`, renderer walk |
|3 crouch·4 rise·5 fall·6 land |증명한 실제 도약/낙하/착지; run-up만 준비 정지 생략 |`reachablePlatforms`, `companionEpisodeRunHop`, renderer jump |
|7 legacy |의도된 제외, 관련 그림은16/17 재사용 |`COMPANION_CLIP_TIMING` |
|8 held·9 happy |실제 집기/쓰다듬기·반가움·식사/식후 |renderer/기존 실제 보상 경로 |
|10 yawn·11 sleep·12 wake |수면/비활성/기상;10/11 단일 그림 hold 의도 유지 |renderer presence/sleep |
|13 heart |설정된 하트/실제 패널 장난 |`hearts.ts`, `panel-play.ts` |
|14 hide·15 emerge |현재 일정 숨기/발견/최초공개 |`hide-seek.ts`, `premiere.ts`, renderer |
|16 stretch·17 shake |자율 휴식·기상 연쇄·식후 마무리 |`episodes.ts`, renderer |
|18 disappointed·19 sulky |하트 거절/음식 소실/반복 취급의 기존 감정 |`affect.ts`, renderer |
|21 tumble·22 dizzy·26 glance·23 recover |실제 음식/평지 사고·두 번 구르기→어지럼→눈치→힘찬 회복 |`romp.ts`, `episodes.ts`, `COMPANION_PLAY_TIMING` |
|24 slip·25 bump·27 tears·28 sulk |실제 착지 실수/좁은 곳의 작은 충돌·톡 치기·감정 |`arrival-play.ts`, `companionEpisodeMishap`, `play.ts` |
|29 bow·30 groom·31 pounce/celebrate |강아지/고양이/기본 빅타민의 발견·접촉·식후 반응 |`planCompanionEpisode`, 기존 일반 놀이 |

## 장면과 소유권

- 식사 장면은 `careful/dash/bound/rush-trip/bound-slip` 중 종/성향/걸음/에너지·기존 mishap 제한에 맞춰 한 번 추첨한다. 음식ID/현재 단계/24회 예산/실수 여부만 기억하며, 다음 동작은 현재 음식·기하와 기존32회 급식 예산에서 다시 계산한다. 새 절대좌표 action 배열은 없다.
- 발견→관찰·냄새 또는 반가운 인사→현재 안전 발판의 보행/달리기/실제 점프→선택적 사고 최대1회→조심스러운 재접근→기존 consume 성공1회→식후로 연결한다. 긴급 허기는 장면 대신 기존 급식을 우선한다. 집/컨트롤/수동 발판은 새 접근 장난에서 제외하며, 집의 정지한 기상/접촉/식후 반응은 허용한다.
- 앞 음식에 달려가다 실제로 걸리거나 도약 뒤 실제 발판에 잘못 디디면, 넓은 곳에서는 안전한56px 이내의 최종 위치로 단조롭게 구른다. `slip-tumble`은24→21→22→26→23, 기존 tumble과 함께 마지막800ms의 빠른3왕복 회복을 공유한다. 좁은 곳/점프OFF는 작은 충돌·미끄러짐으로 양보한다. 음식 흔들림은 표현일 뿐 논리 좌표/소비/일정 데이터는 바꾸지 않는다.
- 실제 달리기의 끝 곡선과 다음 impulse/flight가 맞는 같은 지지면 도약만 run-up이다. 현재 선택한 음식 앞에 내려앉는지 완료 때 다시 확인한다. 단순히 이전 행동이 walk라는 이유로 positive marker를 붙이지 않는다.
- 실제 쓰다듬기/휴식/consume만 사회적 반응·기상·식후 문맥을 만들며, 표정 때문에 친밀도/학습/식사 기록을 추가하지 않는다. 식후 동작의 action.foodId는 비우며 성공한 음식의 이력만 episode에 남긴다. 취소된 급식은 같은 ID의 일반 경로로 재계획하고, 실제로 먹은 뒤의 새 마무리만 허용한다.
- `clearAction` 기본은 취소, 정상 완료만 문맥을 보존한다. blur/새 창/편집/OFF/숨김/공연은 후속 문맥·예정 hop/trip을 폐기한다. 현재 움직임 곡선과 안전한 착지는 보존하고 빠르게 복귀해도 취소한 단계가 부활하지 않는다. 현재/바로 다음 beat만 기존 exact decoder2 in-flight/3 retained로 준비한다. 새 상시 루프·타이머·프레임별 경로 탐색·서버/모델 요청은 없다.

공유 시청자/편집실/미리보기/비로그인 구현, 모바일 제외·공개 DTO/역할/언락/KST·1840 기하·직렬 쓰기·사용자 아트·의존성·운영 DB는 유지한다.

## 발견하고 수정한 문제

첫 설계 검토에서 식사 보행 끝 속도가0인데 이후 jump에 runUp을 붙이던 불연속을 찾았다. 실제 보행 곡선과 속도/flight를 미리 증명한1개 도약만 연결하고, 완료 때 현재 음식/실제 발판을 재검증하도록 바꿨다. 증명되지 않은 도약은 일반 준비 동작을 지킨다.

추가 독립 검토에서 action 없는 사회/기상 문맥과 pending hop이 blur/창/편집/OFF의 빠른 왕복 뒤 살아날 수 있음을 찾았다. 취소 표식을 현재 action에 남기고 문맥/예정 동작을 진입 시 폐기한다. 선택된 현재 walk 곡선은 별도 플래그로 보존해 취소 자체가 위치를 바꾸지 않게 했다. 현재 식사/수면 완료가 새 문맥을 만드는 경우도 취소 표식을 확인한다. 두 P2는 소스 재검토에서 해소됐으며 실행 검증은 아래 결과로만 판단한다.

## 검증 현황

최종 제품 소스의 전체 unit2,001/2,001(204파일), 전체 lint, typecheck 및 production fixture build `mvTnvekoF00gUfxEqdp2y`와 빌드 후 typecheck는 PASS였다. 새 unit26건은 다섯 식사 변형/실제 run-up/예산/동일ID/사고1회/실제 consume/취소를 검사한다. 독립 소스·native spec 검토에서 추가 차단0. 최종 native 식사/음식 이동/실제 탭 전환6/6, 기존 귀가·편집창 닫기·빠른 놓기·게스트·흔들기·먹이 추적·관성·창 소유권41/41 PASS, 합계47/47(skip/flaky0)다. main과 검증한 격리 소스36파일 SHA256 exact 일치, harness246문서 PASS. 배포는 아직 확인 전이다.

최종 원본6개4,992프레임에 대한 별도 작성자 정적 감사168조건 PASS(exit0), 각 최대 표본 간격29.6~96.6ms/100ms 초과0, 원본 SHA256/mtime 불변을 확인했다. 모든 프레임의 동일 개체/visible/decoded HD, 음식 동일성/기록된 floor 좌표, 설정/학습 불변, 쓰기/오류0, 식사 진입·음식 제거·실제 보상 각1회 및 음식ID 없는 식후 완료를 확인했다. 원본/PNG는 격리 `.scratch-pw/093-context-episodes/`, 정식 report와 감사/시각 검토는 main `.scratch-pw/companion-093/`에 보존한다. unit 결과는 실행 도구92027(exit0)의 전체2,001 로그와 요약에 기록하며 npm 인자 전달로 생성되지 않은 full JSON report가 있다고 주장하지 않는다.

| 실제 관찰 | 결과와 한계 |
|---|---|
|viewer 정상 식사 |rush-trip: 같은 평면의 선택 음식x1050에 실제 접근, x1040에서 접촉; 직전 walk와17.6ms, HD21/22/26/23 각38/18/26/53프레임·56px 단조 구름·음식 표현 흔들림26프레임 뒤 같은 음식 재접근/섭취/마무리 |
|studio 정상 식사 |bound: 실제 상승23/하강24프레임, apex83.969px, 이륙 전후 −135.779/−130.944px/s·17.6ms, 같은 지지면에 착지 뒤 섭취/마무리 |
|양쪽 음식 이동 |viewer bound-slip/studio dash를 접근 중 실제 집기로 취소; 새 좌표의 같은 ID로 일반 접근/실제 소비 후 새 식후 마무리만 허용 |
|양쪽 실제 blur/복귀 |viewer bound/studio dash; trusted blur(false)/focus(true), 빠른 왕복164.6/166.4ms, 같은 journey/walk 유지와 취소 문맥 비움. 두 표본 모두 예정 hop 취소를 목격했다는 뜻은 아님 |
|대표 PNG4장 |양쪽 식사 시 입 앞 과일·한 개체, 양쪽 refocus 최종 시 음식 없음·한 개체·글자/컨트롤 침범 없음. 정지 이미지 검토와 동작 원본 증거를 구분 |

첫 headless6건은 정상/음식 이동4PASS, 실제 blur2FAIL이었다. `bringToFront` 뒤에도 원 탭 `document.hasFocus()`가 true이고 실제 focus 이벤트가 없으므로 취소 검증으로 세지 않는다. `.scratch-pw/093-context-headless-attempt/`에 원본/실패 report를 보존했다. headed 첫 재실행은1PASS/5FAIL: 일부 환경에서 rAF 표본 간격이 약1,016ms로 내려가 짧은 beat를 놓쳤고 음식 drag 정착 검사도 실패했다. `.scratch-pw/093-context-headed-attempt/`에 그대로 남겼다. 단언/시간/제품 코드를 완화하지 않고 실제 창·Windows native occlusion 제외 실행 조건을 명시해 재검증한다.

추가 occlusion 시도1PASS/5FAIL 원본은 `.scratch-pw/093-context-occlusion-attempt/`에, 창 격리 뒤4PASS/2FAIL은 `.scratch-pw/093-context-focus-emulation-attempt/`에 보존했다. 창을 화면 밖으로 격리해 명령하지 않은 실제 desktop pointer 입력 혼입을 막았고, 포커스 실패의 최종 원인은 headless 여부가 아닌 Playwright의 기본 `Emulation.setFocusEmulationEnabled(true)`임을 설치된 `coreBundle.js`에서 확인했다. 최종 refocus2건만 CDP로 그 강제 설정을 해제하고 실제 다른 탭의 `bringToFront`를 사용한다. 제품 callback/`hasFocus`/시계/난수/상태를 덮어쓰거나 가짜 이벤트를 보내지 않는다. 원본은 실제 trusted blur(false)→100ms 이상→focus(true) 및 이동 중 좌표/문맥 폐기를 직접 검증한다. 기본 식사/음식 이동4건은 이 CDP 설정을 사용하지 않는다.

임의90초 내 모든 확률적 변형을 보장하는 검사를 만들지 않고, 재현 단위 상태 전이와 실제 식사/취소의 native 관찰을 구분한다. 무작위 refocus가 매번 예정 hop 취소까지 목격한다는 뜻은 아니다. 실제 OBS 장비·전 장치/모든 난수·실제 로그인 RLS의 완료를 주장하지 않는다.
