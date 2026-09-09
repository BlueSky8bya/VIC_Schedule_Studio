# 현재 메모리·아트 파이프라인·초기화 프로토콜 수정

Status: Completed
Date: 2026-09-09 (KST)
Base revision: 94b0a71d9732f21e557cca507e77eecd419b84fe + uncommitted working-tree changes

사용자가 상담안을 수락하고 CURRENT_STATE 및 제공한 초기화 원본의 보완을 요청했다. 제공 문서는 수정 대상이며 재초기화 명령으로 실행하지 않았다. [계획](../plans/PLAN-20260909-012-harness-memory-and-art-pipeline.md), [결정](../decisions/ADR-0020-bounded-memory-and-art-review.md).

## 원인과 수정

| 확인한 문제 | 이번 수정 |
|---|---|
| CURRENT_STATE에 완료 이력·중복 Next·오래된 미해결 표시 누적 | 정확한 다섯 섹션, 활성 ID만 유지. 종료 기록은 주제 문서로 이동; 충돌한 검증 결과는 OPEN_CHECKS에 보존 |
| CLAUDE가 공통 규칙·UI·ambient·과거 사유를 모두 보유 | AGENTS를 공통 진입점, CLAUDE를 짧은 adapter로 변경. UI_RULES·ENGINE_RULES·ART_RULES를 작업별로 선택 |
| SessionStart가 거대한 상태와 결정 색인을 통째로 주입 | 크기 예산을 적용한 현재 brief만 출력. 초과 시 실패하며 조용히 자르지 않음 |
| 존재·링크 검사만 통과하면 상태 모순도 통과 | UTF-8 바이트 예산, 중복 섹션/ID, 종료 상태와 문서 참조, Next의 선행 작업 ID 검사 |
| Stop이 오늘 변경한 파일을 세션 작업으로 추정 | 실제 session_id별 파일 해시 snapshot. 기존 dirty 작업 제외, 같은 파일의 후속 변경 감지. 설정·스크립트·아트 포함 |
| CURRENT_STATE를 만지면 다른 문서 갱신도 대신한 것으로 취급 | 관련 도메인 기록 또는 정확한 변경 해시에 묶인 영향 없음 사유. 성공한 Stop 뒤 baseline 갱신 |
| 21장 의뢰가 합격본 세 장까지 포함해 24장을 요청 | 변형 2·3 × 기본/가을/겨울 = 여섯 장 파일럿. 합격본 제외, 별도 raw/normalized, 고정 입력·검토 증거 |
| 검사 후보가 baseline과 같은 이름이면 가려지고 실패도 exit 0 | 후보와 baseline 분리, singleton 포함, 구조화 상태와 실패 exit 1. 소나무 전용 검사 범위 제한 |
| 시각 승인과 반영할 파일의 연결 부족 | 원본·정리본·보고서·시트·규격 해시를 승인에 연결. 기존 public 보호, 복사 예외 시 신규 파일만 해시 확인 후 복구 |

초기화 원본에도 일부 원칙은 이미 있었다. 부족했던 부분은 누적을 유도하는 상태 템플릿, 수명 종료 규칙, 크기/신선도/세션 검증 계약이다. 모든 문제가 원본 하나에서만 발생했다고 단정하지 않는다. 이번에는 원본 템플릿과 프로젝트의 실제 검사 구현을 함께 수정했다.

## 보존과 외부 원본

- 기존 CLAUDE/CURRENT_STATE/QA_PROGRESS는 [archive](../archive/20260909-CURRENT_STATE-before-memory-split.md)에 원문 바이트 수·SHA-256와 함께 보존했다. ACTIVE_PLAN 원문도 별도 snapshot으로 보존했다. 역사 문서 본문은 시작 시 주입하지 않는다.
- 수정 원본: `G:/내 드라이브/project initializing/project-initializing_260712.md`.
- 백업: 같은 폴더의 `project-initializing_260712.md.20260909-pre-memory-repair.bak`.
- 수정 전 95,970 bytes; SHA-256 `f06a778f9590d3d5871114ea0c498282c7559d9dc1b927d8318f92d9189fa89d`.
- 수정 후 111,976 bytes; SHA-256 `69a2d33983f51c27a48eebc97771cae935f9611b68d6ea3da855083fb91a441c`.
- 파일명·원래 프로토콜 날짜·schema 1.1을 유지하고 2026-09-09 개정 표시를 추가했다. 저장소 초기 도입 출처 260710도 덮어쓰지 않고 이번 검토 출처 260712를 별도 기록했다.
- 원본의 상태/계획/DoD/자체검사/훅 예시를 함께 맞췄다. Markdown 안쪽 코드블록이 바깥 템플릿을 조기에 닫던 fence도 수정했다. 번호 섹션 70개와 YAML 6블록을 검사했다. 재초기화 실행이나 설치된 모든 skill의 일괄 갱신은 하지 않았다.

## 검증

| 시작 문서/출력 | 수정 전 UTF-8 bytes | 수정 후 UTF-8 bytes |
|---|---:|---:|
| CLAUDE.md | 59,266 | 768 |
| CURRENT_STATE.md | 289,226 | 3,033 |
| SessionStart stdout | 298,194 | 3,544 |

현재 AGENTS 5,877 bytes, ACTIVE_PLAN 418 bytes. AGENTS+CLAUDE+brief+Claude rules 합계 11,092 / 예산 16,384 bytes. 바이트 실측이며 토큰 사용량 추정이 아니다.

검증 소스 묶음: scripts 전체, manifest.ts, 신규 harness/art unit tests, package.json, agent-harness.yaml의 경로순 52파일 SHA-256 목록을 JSON으로 직렬화한 digest `6964f230bac4cadeb1d3a1e518c294b6ef6cb2bf18934dcedfa01507498f3605`. 문서의 자기 참조 해시는 포함하지 않았다. 이후 작업이 바뀌면 이 기록은 해당 시점의 검증 증거다.

- `npm test`: 63파일, 680테스트 통과. 신규 harness 17개·아트 파이프라인 8개 포함. 기존 Vite CJS API deprecation 경고가 있으나 exit 0.
- `npm run typecheck`, `npm run lint`, `npm run build`: 최종 제품/스크립트 변경 기준 exit 0. 문서 검증 범위 확장은 이후 `harness:verify`로 확인했다.
- `npm run harness:verify`: 62문서의 링크·ADR 상태·활성 수명주기·크기 예산 통과. 시작 출력은 전체 상태/결정 이력을 싣지 않는다.
- 원문 snapshot 세 개를 메타데이터의 원본 길이로 복원해 SHA-256 일치 확인. 외부 원본/백업 해시도 독립 확인.
- 준비 요청의 request/prompt/source/input/review 해시 일치; 원본 사본 네 개도 현재 합격본과 동일. request SHA-256: `ecf06a3731eec19c77d9620a5b770ffdb300d3848b133ba64be0e05cb74a100e`.
- 기존 합격 소나무 검사: 기계 실패 0, pass 24 / not-applicable 6 / unmeasured 4. 다양성과 시각 판단 미측정 항목을 전체 승인으로 바꾸지 않았다.
- `git diff --check`, 기존 `public/ambient/art` 및 `art-src` 추적 PNG 변경 없음 확인. 실제 이미지 생성·브라우저·로그인/RLS·운영 DB 검사는 실행하지 않았다.

## 후속 작업과 한계

- [소나무 의뢰](../../../art-src/tree/tree-pine/runs/20260909-pilot-01/request.md)는 준비 상태. raw/normalized에는 생성 PNG가 없고 review는 pending이다. 이미지 생성기의 참고 전달과 소유자 시각 승인은 이후 실제 실행 때 기록한다.
- 저장소의 잘못된 24장 의뢰와 IDE의 이전 21장 scratch 의뢰는 서로 다른 복사본이었다. 둘 다 현재 요청 경로로 돌렸고 scratch 원문은 같은 폴더의 `prompt-pine21.md.bak`에 보존했다.
- [아트 명령 안내](../../ambient/ART_PIPELINE.md). CLI의 owner 값은 실제 소유자 판단을 기록하는 로컬 절차이며 인증 서버가 아니다. 에이전트가 승인을 만들어 넣지 않는다.
- 기존 public 및 기존 art-src PNG를 변경하지 않았다. 복사 예외 복구는 검사했지만 프로세스 강제 종료까지 파일시스템 트랜잭션을 보장하지 않는다.
- Claude hook 설정과 실제 stdin CLI 동작을 확인했다. 호스트가 해당 훅을 자동 실행했는지는 NOT VERIFIED. 다른 에이전트는 AGENTS와 명시적 harness 검사를 사용한다.
- [열린 검증/운영 항목](../verification/OPEN_CHECKS.md)은 별도 작업으로 유지했다. 이 기록은 운영 데이터 삭제·배포·commit/push 승인이나 실행 증거가 아니다.
