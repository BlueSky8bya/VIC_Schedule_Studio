# 빅타민 행동강령 개선 제안 — 구현 핸드오프

작성 2026-11-26 KST. 원 대화 01a213f6-9a7f-7642-b379-4cd3df982ee5. 세션 맥락 약 80% 규칙으로 이어감.

## 이어가기 최종 갱신 — 2026-11-26

아래의 예전 '남은 일'보다 이 절과 [최종 기록](../../../runs/20261126-companion-local-personalization/verification.md)이 우선한다.

- 기존 worktree에서 실제 ViewerCompanion을 오프라인 React wrapper로 실행. 38.406초·193회 모두 그림 표시, 25곳 위치·8종 상태, 오류0. 키보드 교감·이동, OFF, cat/dog, 초기화·도감/기질 보존, 재접속 통과. 별도 실제 마우스 긴 교감(+.065)과 짧은 키보드 교감(-.065) 확인.
- 최종 typecheck/lint/fixture 생산 build 통과. 마지막 전체 단위 489파일·7,482건 전부 통과(112.86초), unit-release-candidate.log. 앞선 skip/timeout 로그와 구별.
- 새 방침 공개 접기에 고정 activity target/표시명을 연결. 학습값 전송 없음. 공개 접기·Enter·Space 실제 확인. 전후 보고서 그림10장 PC/모바일 로드·가로넘침 없음.
- harness 전체는 기존 규칙 등록표 불일치2건·아트46건 실패 유지. 기준742de77b/현재 규칙 목록 hash 동일. 아트 입력·카탈로그 코드 변경/미추적 없음에 따라 기존 실패로 분리. memory budget/구조 단독 검사와 git diff --check 통과.
- 자체 diff 검토·문서 갱신 완료. 최신 원격 추적 ref가 다른 작업으로 바뀌었으므로 비교 기준은 고정742de77b. main 사용자 변경 보존.
- 실제 Next hydration/전체 topology/Google 로그인/RLS/전성격 장시간 검수와 비작성자 독립 검수는 미검증. listener 시작 거절은 우회하지 않음. 독립 검수 전 통합하지 않음. 커밋·통합·푸시·배포 권한을 추정하지 않음. worktree는 미커밋 상태로 보존.

보고서: runs/20261126-companion-local-personalization/report.html. 상세 로그는 같은 worktree의 .scratch-pw/local-personalization/, 보존정책 적용. 이 이어가기에서 새 예약 작업·새 채팅 생성 없음.

## 사용자 요청과 최신 수정

계획대로 단계별 구현 승인. 연합학습 제외, 기존 설정·기록·도감·선물 보존, 새 동의창 없는 로컬 개인화, 방침 실제 동작에 맞춰 최소 수정.
일반 방침 본문에는 날짜(시행일)와 자잘한 운영 이력을 보이지 않게 하고 중요한 30일 사전공지급 변경만 강조하길 원함("309일"은 30일로 이해했다고 알림). 과거에 제보를 방송인도 열람했다가 개발자만 보게 한 상세표를 관리자(owner)가 보지 않길 원함.
설명한 절충: 기본 본문에 시행일·날짜표 없음, 변경 전후 한 줄 + 공개 접힌 '방침 정보·주요 변경 비교'에 필요한 날짜/전후 정보, 원문 운영 이력은 실제 developer만 서버 검증 뒤 설정 개발자 탭에서 봄. 권리 관련 공개 의무까지 비공개로 숨기지 않음. 새 팝업·동의창 없음.

## 작업 위치 — 중요

주 작업 폴더는 오래된 main c1a72506와 사용자 미커밋 다수. 건드리지 말 것.
실제 구현: C:/Projects/VIC-worktrees/20261126-companion-local-personalization
branch codex/companion-local-personalization, base origin/main 742de77b (fetch 확인).
모든 구현은 아직 미커밋. main 통합/푸시/배포 요청 없으므로 하지 않음. 깨끗하지 않은 worktree를 삭제하지 말 것.
계획은 위 worktree docs/agent/plans/PLAN-20261126-companion-local-personalization.md. 초기 계획의 이전 '미승인' 문구보다 현재 사용자 구현 승인이 우선.

## 완료한 코드

새 lib/ui/viewer-companion/individuality.ts: 집/밖별 contact/company/sharing/novelty 수치·근거량, 의미상 home/card/floor 선호. active-time 학습 예산, 최소 근거 후 제한된 보정.
individuality-store.ts: 별도 vic.companionIndividual.v1 envelope, 자동 기질·세대·학습값만 allowlist. 구버전 prefs1/care3 그대로. quota/corrupt fallback, stale generation 거부, 초기화 시 identity 보존.
interaction-learning.ts: 실제 교감 세션만 short/long contact, 실제 발견 후 사용자 반응만 shared-discovery, 무응답 미관측, transient active timestamps는 저장 안 함.
preferences.ts: 실제 활성화 시 자동 기질 정착, 수동 우선, SSR/읽기 무쓰기. 명시적 무작위 제어만 새로 뽑아 정착. 기존 성격 UI 문구 수정.
brain/living/deliberation/planner/personality-director: 기존 허용 후보·목적 우선 유지, 개인 교감 길이/관찰·목표 가중치/의미상 자리 반영, active-time으로 회복하는 session-only 반복 싫증. cat/dog에는 새 학습 보정 적용 안 함.
care.ts 기존 reset이 새 개성 학습도 지우되 기질/기존 자산 보존.
viewer-companion.tsx: 현재 shared runtime에 연결. 저장 5초 기존 경계, 실제 이벤트 입력, 학습 OFF, 외부 storage/세대 reset, 오래된 drag completion 방지. 신규 계정·서버학습·업로드·분석 메타데이터 없음.
방침 app/(legal)/privacy/page.tsx, legal-doc.tsx/.module.css: 본문 시행일 제거, 기기 내 학습 설명, 전후 짧게, 필요한 공시 정보는 native details(공개). 자세한 원 운영표는 lib/legal/privacy-history.ts use-server action의 실제 authenticated developer gate 뒤에만. owner/viewer/불확실 권한 거부. components/developer/privacy-history.tsx를 기존 SystemPanel에 연결. 법적 공개 최소 사항의 충분성도 검수할 것.
문서: UI_RULES 최신 교체 조항, ADR-0032 + DECISION_INDEX, CHANGELOG_AGENT, ACTIVE_PLAN/CURRENT_STATE, 구현 계획 상태 추가.
테스트: tests/unit/companion-individuality.test.ts(7), privacy-history-boundary.test.ts(5), 기존 companion-document-personality-138.test.ts의 랜덤 재추첨 계약 교체 + 자동 지속성 테스트(37).

## 검증과 남은 일

1. 최종 전체 단위 검사 완료 PASS: direct node vitest --maxWorkers 2, 489파일 / 7,481 PASS / 1 skipped (총7,482). 115.11초. .scratch-pw/local-personalization/unit-bounded.log. 과거 병렬 실행의 timeout 실패 로그도 보존. session13623은 완료됨.
2. typecheck, lint, fixture production build PASS. 마지막 build: .scratch-pw/local-personalization/build.log. 빌드 이후 동작 코드는 안 바뀌고 주석/문서만 변경.
3. 실제 Chromium browser-local.cjs PASS, 결과 browser-local-result.json. 실 브라우저 저장/실제 배포 pure decision 모듈 검사일 뿐 전체 renderer/상호작용 아님.
4. Next 로컬 테스트 서버 시작을 자동 승인 검토가 두 번 blocked by policy로 거절. 이유 더 없음. 동일 listener를 다른 이름으로 우회하지 말 것. 사용자에게도 거절 사실 이미 알림. headless 오프라인 브라우저 방식은 허용돼 동작.
5. 정적 방침 전후 실제 생산 SSR 캡처 + native details 클릭 PASS. 1440/390 동일 밝은 테마. runs/20261126-companion-local-personalization/report.html 및 before/after-privacy-{changes,local}-{1440,390}.png. 모바일 변경안 직접 view_image로 확인했고 잘림 없음. staticSSR+로컬 요청 fulfill 방식이라 hydration 증거로 쓰면 안 됨. before는 변경 전 origin/main 생산 build에서 캡처.
6. 전체 ViewerCompanion 브라우저 bundle 성공: .scratch-pw/local-personalization/probe-renderer.cjs, 약5.1MB. listener 없이 actual React component를 offline wrapper로 마운트해 연속 동작/직접 입력/설정·초기화·새로고침/전송canary 검증을 이어갈 수 있음. esbuild jsx:'automatic' 주의. 실제 CSS(앱 globals+컴포넌트들)를 함께 로드하고 요청은 public/.next 파일로 fulfill, 외부/쓰기는 차단. Props는 파일149행, geometry.ts selectors 참조. 적어도 실제 컴포넌트가 새 모듈과 연결되는지 보고 성공으로 속이지 말 것. 충분한 실제 before/after 행동 비교가 필요하면 변경 전 source bundle은 git show에서 임시 source tree로 준비(사용자 파일 덮어쓰기 금지).
7. harness:verify FAIL: active rule IDs inventory 변경/표 불일치 + art catalog drift46. 새 UI_RULES 문장은 규칙 ID를 안 만들었으므로 origin/main 기존실패인지 비교해야 함. rule-migration.mjs collectRuleInventory/renderRuleInventory로 필요시 현재/HEAD를 비교. 무관한 아트46개 일괄 재생성 금지. 마지막 harness.log에 원실패 보존.
8. 검수: 저장/초기화·OFF·세대경합·동물모드·개인성격 데이터 미전송·실제 owner/developer/viewer 분리 확인. G21 독립 통합 검수는 아직 안 했고 main 통합도 안 함. 현재 지침은 명시적 위임 없으면 subagent 금지이므로 임의 spawning하지 말 것.
9. 최종 문서/보고를 실제 검증 범위로 갱신. 현재 계획/ACTIVE_PLAN/CURRENT_STATE는 QA pending. 작업 전체 성공이나 배포 완료라고 쓰지 말 것. 마지막 diff 검토 후 사용자에게 간결한 결과와 링크/검증 한계를 보고. 배포/커밋은 별도 권한 확인 대상.

## 규칙

작업 전 python C:/Projects/context-hub/tools/board.py open. 이번 직접 요청에 해당하는 [코덱스] W번호는 없었음; 새 요청 줄 만들지 않음.
최신 승인·사장 디자인 원칙 우선. 보고 전후 이미지는 같은 크기/테마 실제 img. 로컬 QA는 fixture/analytics guard, 운영 DB 사용·정리 안 함. 추가 의존성/외부 AI/원본 그림 변경 없음. Next 최신은15.5.28(origin). production local cf:deploy 금지: .env.local 번들 노출 위험, 실제 배포는 Workers Builds만.
사용한 skill caveman, vercel:verification, vercel:react-best-practices. 새 대화면 필요한 skill읽기 유지.
맥락80% 규칙으로 이 단계 기록 후 새 단계 시작하지 말고 이어갈 대화에서 진행. 이 채팅에 생성한 예약 작업 없음.
커밋할 때 Codex-Session: <그 세션id> trailer 필수.
