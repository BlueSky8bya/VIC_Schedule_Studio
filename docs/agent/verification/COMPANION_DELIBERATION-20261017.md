# 빅타민의 읽을 수 있는 판단 — 2026-10-17

대상: [PLAN-074](../plans/PLAN-20261017-074-companion-deliberation.md). 기존 공유 로컬 companion을 개선한다. 새 학습 모델·외부 AI 서비스·새 이미지 생성은 없다. 원래의 목표/경험 기억을 실제 대상 관찰과 이동으로 드러내는 변경이다.

## 동작과 연결

- `deliberation.ts`: 실제 새 먹이·귀가·다른 발판 목표에만180–520ms 확인 동작. 고양이는 더 살피고 강아지는 빨리 결정하며 걸음 설정도 반영한다. 중간 발판마다 반복하지 않는다. 즉시 식사·긴급 배고픔을 지연하지 않는다.
- `planner.ts`: 관찰도 같은 normalized intention의 `consider` 단계다. 관찰이 끝나면 현재 기하로 경로를 다시 증명하고 `travel`로 진행한다. 미래 동작/절대좌표 closure를 예약하지 않는다.
- `brain.ts`: 기존 장소 실패 기억을 가까운 발판 선택에도 반영한다. 실패한 곳은8초의 실제 활성 시간 동안 피하고 다시 검토한다. 기억12개·후보200개·상위6개/경로 증명2개·행동 예산은 유지한다.
- 공유 runtime: 유지하던 목표의 삭제/막힘만480ms 재확인. 음식의 `contains()`와 현재 이용 가능 목록을 구분해 집힘·가림을 삭제로 오인하지 않는다. 실제 음식 삭제의 반응은 발이 안전하게 지지된 때만 한다. 공중에서는 기존 착지를 끝낸다.
- `motion.ts`: 기존 look/두리번 clip이 실제 대상을 바라본다.1.6도/1px 이내의 유한 몸 반응을 기존100ms mixer에 넣고 얼굴·크기·발·입·소파 충돌 기하는 바꾸지 않는다. 실제 이동·잡기·play가 방향을 우선 소유한다. 친화적인 기존 관찰/냄새 동작은 주변 포인터를 바라볼 수 있다.
- 생각 문구/풍선/링/새 버튼은 없다. diagnostics는 `inspect|reconsider|social`, `feed|explore|rest`만 표시하며 제목/태그/내용/계정 정보와 자율 행동 로그는 추가하지 않는다.

viewer·anonymous·preview·studio가 같은 renderer/brain을 쓴다. 기본OFF·92px·모바일 제외·1840 포스터 폭·직접 조작·소파/스크롤·열린 창/presence/최초공개·감소 동작/gfx 우선권은 보존한다. 서버 DTO/권한/unlock/KST 처리 변경은 없다.

## 비용과 한계

새 판단은 기존 행동 결정 경계에만 실행한다. 기존 `getAction`을 한 번 호출한 결과에 유한 관찰을 붙이며 프레임별 경로 탐색·새 타이머·RNG·DOM scan·네트워크·DB 호출은 없다. 시선은 캐시된 목표 발판 하나 또는 최대8개 로컬 음식에서 구한다. 관찰 중 현재 지지점과 목표를 기존 최대2개 anchor follow 경로로 추적한다. 기존 decode 동시2개·보유 이미지3개 상한을 늘리지 않는다.

관련 연구와 프로젝트 적용 추론은 계획 문서에 구분해 기재했다. 관찰 시간과 몸 반응 수치는 프로젝트 디자인 결정이다. 실제 의식·추론 모델·생물학적 두뇌를 구현했다는 뜻이 아니다. 실제 OBS 방송 장비 측정과 소유자의 주관적 몰입도 승인은 이번 자동 검사로 입증하지 않는다.

## 검증

- 독립 brain/runtime 리뷰와 motion의 별도 독립 리뷰: 수정 필요한 항목 없음. 목표 유지·가림/삭제·입력 우선·geometry/presence·정보 경계를 검토했다.
- companion 관련 단위47파일501개 PASS. 관찰1회→동일 목표/현재 기하 재계획, 삭제·막힘 재확인1회, 가까운 발판의 활성 시간 재시도, 긴급 식사/각 설정, 시선 방향/상한/mixer/60·120Hz를 포함한다.
- `npm run typecheck`, `npm run lint`, `npm run build` PASS. fixture build `HPEh6mziB_u26k5I0LWY5`. 제품 소스5개의 hash를 native 검사 전에 고정했다(`.scratch-pw/companion-074-source-proof.json`).
- 전체 단위1638개 중1630개 PASS,8개 FAIL(6파일). `ambient-codex`2, `vod-chat-recovery`2, `public-cache-revalidate`1, `centering-vs-animation`1, `scroll-position-wiring`1, `timeline-route`1. 해당6파일만 재실행해46 PASS/8 FAIL을 재현했다. 실패 테스트와 관련 소스20개는 변경 전 HEAD `261f4ba2`와 같은 Git blob이며 이번 CSS 변경도0개다. 전체 검사는 PASS가 아니다. 원문 결과와 소스 일치는 `.scratch-pw/companion-074-existing-failures.json`, `companion-074-existing-failure-source-proof.json`.
- `harness:verify`는 기존 rule inventory 불일치2건으로 FAIL: `Active rule IDs changed; update RULE_MIGRATION inventory and mappings`, `RULE_MIGRATION inventory table differs from live rule IDs`. 이번 변경에서 규칙 ID를 추가/삭제하지 않았다.
- 생산 빌드 상호작용6개 PASS: 두 화면의 실제 음식 관찰→동일 음식 접근→먹기, 잠시 집힘과 실제 삭제 구별/단발 재확인, 관찰 중 직접 잡기, 편집실 감소 동작. 서버 mutation/페이지 오류0, fake clock0. `.scratch-pw/companion-deliberation-report.json` 및 각 JSON/PNG. 첫 검사 실패는 fixture 루트와 짧은264ms 동작을 놓친 assertion backoff였으며 원 보고서를 보존하고 읽기 poll을16ms로 교정했다.
- 공유 회귀18개 PASS(2.0분): 모바일/터치 landscape 제외와 desktop 복귀8, 편집 팝오버 숨바꼭질/꺼내기1, 긴 메인스레드 지연 뒤 실제 스크롤·gfx 전환·음식 anchor4, 실제 소파 앞/뒤 접촉3, 두 화면의 팝오버 가림/닫기 위치 보존2. `.scratch-pw/companion-074-regression-report.json`.
- 시각 검수에서 초기 `studio-inspect.png`에 그림자만 보이는 순간을 발견해 증거를 보존했다. 실제 브라우저의92px 캡처에서 귀/볼의 주황색 픽셀을 세는 검사와 캡처 전후 포즈/레이어/리소스 기록을 추가했다. 두 화면2개 및 편집실 반복3개 PASS, 실제 캐릭터 픽셀294–345개, 캡처 전후 모두 inspect/look/pose16, ancestor opacity1·유효 clip. 편집실4회에서는 초기 빈 그림을 재현하지 못했다. [Playwright routing의 HTTP cache 비활성화](https://playwright.dev/docs/api/class-page#page-route) 아래 preload/CSS의 같은 WEBP 완전 전송2회가 관측됐으나, 원 캡처의 정확한 원인을 입증한 것은 아니다. 재현되지 않은 초기 paint/resource 순간으로 남기며 모든 프레임의 무결함을 주장하지 않는다. 제품 코드를 추측으로 바꾸거나 첫 증거를 정상 이미지로 대체하지 않았다. `.scratch-pw/companion-deliberation-diagnostic-v4-report.json`, native clip PNG와 각 capture JSON.
- 강화된 최종 native6개도 PASS(49.319초, skipped/flaky/unexpected0). 편집실 실제 캐릭터294px·캡처 전후 inspect/pose16, 시청자345px·캡처 전후 inspect이며 준비 중 기존 pose6을 유지하다 pose16으로 전환했다. 원래 빈 캡처는 `companion-deliberation-original-shadow-only.png`, v3 전체/v4 진단/v5 반복 보고서는 별도 보존했다. 실제 OBS·모든 네트워크 지연/프레임을 포괄한 증거로 확대하지 않는다.
- 문서/세션 단위43개 PASS(`agent-memory`18, `rule-migration`25). 제품 소스는 native 최초 고정 뒤 변경0개다. 운영 배포 확인은 진행 중이다.
