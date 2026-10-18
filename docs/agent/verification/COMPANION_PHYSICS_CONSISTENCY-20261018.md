# 빅타민 물리·입 앵커·패널·판단 검증100

2026-10-18 KST. [계획100](../plans/PLAN-20261018-100-companion-physics-and-consistency.md). 배포/실물 결과는 아래 실제 실행 범위만 인정한다. 사용자 작업·미배포099 원화는 보존했다. DB·권한·DTO·언락·KST·의존성 변경은 없다.

## 변경과 독립 검토

- 음식: 카드의 실제 충돌 폭과 입력 안전 중심 구간을 분리했다. 상단 카드의 하트 주변 안전 구간이 빠지면 기존 exact-x 우선 탐색은 더 아래 바닥을 골랐다. 음식 전용 메타데이터로 실제 첫 면을 선택한 뒤 같은 카드의 가까운 안전 구간으로160ms 미끄러진다. release 시 실제 anchor delta를 충돌 폭/안전 폭에 한 번만 적용한다. 집 바닥·소파 제외·수동 이동·문서 부착·단일 소비를 보존했다. 수정 전 회귀1 FAIL/53 PASS, 수정 후 관련103 unit PASS. 두뇌 담당자가 독립 검토했다.
- 입: 실제 운영098 row1/row9의32셀 입을 각 atlas src/SHA/셀에 등록했다. 요청한 포즈가 아닌 실제 decode·채택된 포즈의 입을 소파와 같은 행렬로 투영한다. 마지막 음식 중심이 입에 모이고 기존 음식 발 좌표→그림 중심16px 변환을 유지한다. 입 등록 이미지 실패 시 활성 시간1,200ms만 대기하고 소비·보상을 보류한다. 독립 검토에서 새 식사 이전 프레임 지연까지 더하던 P2를 발견해 식사 시작 이후 구간만 계산하도록 고쳤다.
- 두뇌: utility/유한 음식 목표·실패 기억·종/성향·학습 습관 구조를 유지했다. 유지된 이름의 발판이 삭제되거나 현재 발 아래에서 옮겨지면 그 발판을 임의 가까운 발판으로 대체해 걷지 않는다. 독립 검토에서 귀가 경로의 같은 stale x 문제도 발견해 수정했다. 음식 좌표 변경/재접근/사고 회복/귀가 명령의 맥락과 유한 예산을 검증했다. LLM/네트워크 추론이나 상시 재계획 루프는 추가하지 않았다.
- 도약: 소파의 기존28% 수직·44% 수평·28% 하강을 연속 이차 곡선으로 교체했다. 실제 몸통/개구부/림/천장을 증명하고 불가능한 좌석 경로는 실제 집 바닥을 경유한다. 일반/소파 모두 출발 계수·곡선을 고정한다. 독립 검토가 스크롤 중 계수 재계산의 C0 불연속을 발견했다. 1차 carry 교정은 튐을 같은 전달로 옮겼을 뿐이라 기각하고, 최종적으로 남은 고정 궤적이 위험해지면 현재 실제 점에서 유한 착지 복구로 잇는다. 목표·음식ID·episode는 보존하고 직접 입력은 취소한다.
- 패널: 실제 PC capability +빅타민ON +미설정 항목만 태그/계절 접힘·집 펼침을 기본으로 한다. 기존 v1 저장 boolean은 모두 보존한다. 새 저장은 바꾼 항목만 쓴다. 사전 paint/hydration·저장 차단·quota fallback·같은 탭/다른 탭·masterON/OFF·모바일 제외를 다룬다. 독립 검토의 저장 차단 첫 paint 불일치와 stale ON listener 순서 P2를 수정했다.

## 이미지 검수의 판정과 범위

운영098과 미배포099 각각 패킹512셀·활성71키, 최초공개16키와 원본 REF-016/017을 실제 열었다. **외곽선 일관성 FAIL**:098 회복/비행이 기본/감정/놀이보다 가늘고 옅다.099 놀이는 오히려 더 굵고 진하다. 등록된192px셀 하단 dark-run 중앙값098은 대체로3px 대2px,099 놀이는4px 대3px다. 이는 AA·명암·대각선이 섞인 선별 지표이며 정확한 벡터 stroke 두께 인증이 아니다.

비슷한 정면 실루엣 폭은 기본130px 대 대표 감정/놀이/회복/비행134–137px로 약3–5% 차이다. 귀·종이층·기울기가 포함돼 몸통 체적이나 가려진 귀 길이 일치 증명은 아니다. 구름/착지/눕힌 귀 등 의도된 연기를 정면 정적으로 평준화하지 않았다. 추가 생성·눈/귀/선 합성·운영 이미지 교체는0회. 새 통일본이 배포됐다고 주장하지 않는다.

원문/요청 계약·검수 접수·실제 비교 PNG·계측은 로컬 `art-src/빅타민/동행/작업회차/20261018-체형선굵기검수/`에 보존했다. 원문 식별자가 포함된 raw 접수 자료는 공개 Git에 싣지 않았다. 런타임에는 측정한 비식별 입 좌표/SHA만 포함한다.099의 눈 선택 범위와 후속 선택 대기는 별도다.

## 실행 결과

- 최신 전체 단위209파일/2,159 PASS. `.scratch-pw/companion-100-unit-final.json`.
- 전체 lint/typecheck/build PASS. 최종 build `TS3w0M-xdW0FM203n1BF0`. 런타임 수정 뒤 native는 이 build만 사용한다.
- 초기 build `dCDjcHE1HvEps0Vj9xyLf`: 패널4·실제 좌우 방향 식사4 PASS. 실패 packet1은 test 차단 URL의 `vitamin`/실제 `victamin` 오타를 수정해 실제 양쪽 packet503에서 음식·보상 보존 PASS. 이전 실패 보고서는 보존했다.
- 음식 native는 viewer/studio 실제 spawn→drag→release→낙하→첫 카드 정착2 PASS. 기본 공개 fixture에는 실제 하트 action이 없으므로 하트 cutout을 찾는 초기 하네스는 precondition 실패했다. 텍스트도 수동 낙하 충돌의 control 장애물이 아니므로 그 대체 검사는 채택하지 않았다. 최종 native는 실제 카드 낙하, cutout 회귀는 source/unit 경계 증거로 구별한다. 시청자 미리보기 시도의 초기 read action POST도503 차단했으며 DB 쓰기는 실행하지 않았다.
- 신규 소파 native의 초기 인근 카드 조건은 실제 접힌 패널 좌석보다85px 이상 높은 모든 카드를 배제해4건 precondition FAIL. 실제 발판으로 후보를 넓힌 뒤 귀가는 성공했으나, 정상적인 바닥 우회→같은x의 좌석 진입에 수평 이동을 강제한 검사는 실패했다. 이어 cat의 실제 도달 범위 밖 카드 음식에 직접 출발하라는 조건도 실패했다. 목표를 억지로 바꾸지 않고 실제 귀가의 수평 도약과 수직 좌석 진입을 별도로 검사했다. 최종 viewer/studio 귀가·비행 중 태그 펼침4 PASS:236–270 native rAF 표본, 실제 좌석 도약58표본씩, hidden0, 전경 최대 오차<.001px. 출발/수평 소파 곡선은 단위/수식 검증이며 실물에서 모든 횡단 경로를 실행했다고 주장하지 않는다.
- 입 실물 witness의 숨겨진 요소 오차0 false PASS 가능성과 packet실패 뒤 무기한eat 가능성을 독립 검토로 보강했다. 축소 프레임마다 실제 양수 크기·가시성·채택 이미지 decode를 검증하고, 실패4.2초 시점에eat를 빠져나오는지 확인했다. 이 엄격한 식사5 PASS.
- 기존 스크롤 긴 프레임 viewer/studio2·음식8개 집 flip1·소파 수동 경계/앞 레이어/좌석 귀가3·배고픈 소파 주민의 집 바닥 실제 식사1 PASS. 이 중 기존 집 바닥 식사 검사는 focus stub을 쓰므로 실제 focus 증거로 확대하지 않는다.
- 기존 chrome8 중4는 상호작용/재질 검증 PASS, anonymous/studio folded rail4는 기준 이미지 차이로 FAIL. 실제 expected/actual/diff12 PNG를 `.scratch-pw/companion-100/chrome-baseline-review/`에 보존했다. 독립 검수자가4쌍을 열어 누락/겹침/글자 왜곡 없이 동일 재질·포커스 색상과 중앙 정렬임을 확인했다. 익명 화면 약1px 픽셀 정렬·편집실54→55px 캡처 높이 차이는 남으므로 ‘기하 완전 동일’이나 ‘AA만’이라고 단정하지 않는다. 이어 실제 도달한 compact8도 별도 before/after16 PNG를 열어 검수했다. 익명 제목284×37→282×36, 편집실 버튼92×45→92×44·제목283×37→283×36 캡처 차이가 있지만 누락/겹침/왜곡은 없었다. CSS 변경0이며 이12개 범위만 기준선을 갱신한다. before/after는 `.scratch-pw/companion-100/chrome-full-before-after/`에 보존했다.
- wide touch3 검사는 눌림/패널 spring이 끝나기 전43.96px를44px로 재는 타이밍 문제로 실패했다. 새 첫 기본 배치 viewer1도 이동 중clip206px를 측정해340px 기준과 달랐다. 기존 한 번의 animation.finished 대기는 후속 ResizeObserver/transition을 기다리지 못했다. 테스트 전용 `settlePanelLayout`은 실제 유한 동작 종료와 실제 BCR/transform/active 상태200ms 안정을6초 안에서 확인한다. clock/스타일/기하/media를 수정하지 않고44px 하한·픽셀 허용치를 낮추지 않는다. 이 대기로 wide touch4는 모두 PASS했다. 최종 chrome/default 저장·재방문/미갱신 기준선 실행은 별도 기록한다.
- 새 첫 설정 기본 배치2 PNG를 실제 확인했다. 정지한 패널 크롬만 캡처하며 움직이는 펫은 레이아웃 기준선에서 제외한다. 실제 펫 가시성은 별도 행동 witness가 검증한다.
- 최종 build에서 viewer/studio 실제 native focus의65초 자율 행동 각각 PASS: hidden0, 최대 unchanged277.6/556.8ms. 실제 창 blur 후 현재 동작 완료→CSS 수면→자리 보존 복귀1 PASS. 실제 모바일/가로 touch3표면 제외6·PC→모바일→PC 복귀2 PASS. 실제 broadcaster OBS 장비의 결과가 아니다.

## 배포와 남은 범위

최종 build의 서로 다른 native47개 PASS: 패널 기본/저장4·첫 카드 낙하2·입5·귀가/기하 변경4·긴 프레임/집 flip/소파/집 식사7·chrome14·liveness/mobile11. 일부 보고서는 앞선 하네스 실패와 함께 저장되므로 위에서 구분한 최종 case 결과만 합산한다. `.scratch-pw/companion-100/native-settled-final.json`의 chrome14와 `native-default-stable-final.json`의 기본/저장4는 기준선 업데이트 없이 통과했다. 음식 최종 x 열 유지도 엄격하게 확인했다. 첫 설정2+기존12 기준선을 실제 대조했다. 입/패널 witness 보강은 독립 재검토에서 추가 P1/P2 없음. 실제 이미지 형상/외곽선 검수 FAIL은 이 상호작용 PASS와 별개다.

`e4ddc503556fc1481c6096caea33f920da1a8c0c`을 main에 commit/push했다. [원격 quality39060778341](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39060778341)의13개 단계(unit/격리 SQL/harness/build/generated typecheck/lint 포함) 모두 success, [Vercel 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/6FkbmY5xkx9rDSRjTwMM6ZhxmRDd) success를 확인했다. 배포 뒤5개 GET canary에서 정확한 full SHA·공개 clock200/no-store·warm204·익명 developer401/error-only/no-store·운영 fixture 비노출을 확인했다. fixture는HTTP200 안의 streamed404 fallback이며 HTTP404로 오기하지 않는다. 원본 응답은 `.scratch-pw/companion-100/canary-http/`, 요약은 `deployed-canaries.json`이다.

실제 Chrome 운영 developer 편집실에서 새 배포 배지를 확인했다. 태그 제목 펼침/접힘과 실제 시청자 미리보기 왕복을 조작했고, 두 화면의 펫1/집1·펫 가시성·공유 재질·저장된 false/false/true를 확인했다. 원래 오른쪽 패널/태그 접힘/계절 접힘/집 펼침을 같은 DOM 상태로 복구했다. 일정 저장/하트 쓰기는 하지 않았다. 실제 운영 smoke와 세부 fixture 검사를 구분하며, 숨겨진 전경의 큰 BCR 오차를 가시 레이어 정렬 실패나 정렬 PASS로 사용하지 않는다. 요약은 `.scratch-pw/companion-100/production-ui.json`이다.

배포 뒤 메타데이터 갱신은 로컬에 남겨 문서만 바꾸는 재배포를 만들지 않았다. 실제 방송 PC의 GPU 합성·인코딩 동시 부하 장시간 실험, 실로그인 RLS, 기기별 UI와 과거096 focus 증거는 이 fixture/unit 검사로 대체하지 않는다. 이미지 선 굵기 FAIL과 미배포099 선택은 미해결이며 현098 원화를 유지한다.
