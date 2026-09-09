# 엔티티별 아트 보관소 정리 — 2026-09-09

Status: Completed

원래 상담의 요구는 한 엔티티의 참고·반려 이유·생성 원본·검토를 같은 위치에서 찾는 것이었다. 이전 구현은 runs 중심 절차만 만들고 기존 파일을 옮기지 않아 이 범위를 빠뜨렸다. 사용자의 정정에 따라 물리 이관과 생성 진입점을 추가했다.

## 실제 결과

- 정본 207 slots / 419 filenames를 194개 디렉터리 엔티티로 묶는다. 계절은 실제 slot 파일에만 적용하며 출현 seasons를 곱하지 않는다. 실제 자료가 있는 14곳에 진입점·네 자료 README를 만들었고 나머지는 목록에만 둔다. 생성 문서는 전체 목록을 포함해 71개다.
- 보존 원본 40장 → 엔티티 `생성본/<변형>/<계절·공통>/`. 이름·바이트 유지, 불확실한 승인 계보는 명시.
- 반려 45장 → 소나무 `반려본/incoming-pine/` 24장, `incoming-pine-r3/` 21장. 과거 사유와 당시 수치는 별도 review.json에 이관했으며 현행 재측정 결과로 표시하지 않는다.
- 후속 사용자 지시에 따라 루트 incoming 안내 README 두 개도 각각의 반려 묶음으로 옮겨 설명을 정리하고, 빈 루트 incoming 폴더는 제거했다. 45개 반려 PNG와 review 기록은 그대로다. 옛 위치는 이관 receipt와 역사 원문에만 보존한다.
- 외부 참고 10장 + sidecar 10개 → 대상 엔티티 `레퍼런스/`. 나머지 93장은 범주 공용 후보. 자동 선별·화풍 승인 아님.
- `프롬프트.md`와 네 자료 README는 매니페스트 및 현재 자료에서 생성한다. 전체 파일 계획과 현재 run의 한정 납품 목록을 구별한다. `검토/`는 flat normalized와 두 대조 시트를 연결한다.
- 고정 run의 경로·파일은 그대로이며, 미래 요청은 엔티티 경로를 사용하고 run/과거 반려의 미해결 사유를 읽는다. reference NOTICE는 공용·엔티티 참고 직하만 집계해 run JSON을 건드리지 않는다.

이관 명세와 예외: [receipt](../../../art-src/migrations/20260909-entity-layout.json), [설명](../../../art-src/migrations/README.md). 구조와 명령: [art-src](../../../art-src/README.md), [ART_PIPELINE](../../ambient/ART_PIPELINE.md).

## 검증

Base revision 94b0a71 + 기존 사용자 변경 및 이번 미커밋 변경. 이번 작업의 manifest/codex/public/고정 run은 receipt 보호 해시와 같다.

| 검사 | 결과 |
|---|---|
| `npm run art:migrate -- check` | 이동 105개 이름·바이트 보존, 보호 244개 경로·해시 일치 |
| `npm run art:catalog -- --check` | 14개 진입점, 207 slots / 419 files, drift·충돌 0 |
| `npm run ref:check` | 공용 93 + 엔티티 10 = 103장, sidecar·NOTICE 일치 |
| 아트 Markdown 로컬 링크 검사 | 고정 run 제외 78문서, 깨진 링크 0 |
| 새 pine 요청 dry 실행 | 요청 6파일, 과거 미해결 사유 6개 포함, 실제 run 생성 0 |
| `npm run test` | 66파일 / 702 tests PASS |
| 최종 참고 파일 쓰기 보완 후 관련 검사 | refs 13 + pipeline 10 tests PASS, 대상 ESLint PASS |
| `npm run lint`, 최종 `npm run typecheck` | PASS |
| 최종 `npm run harness:verify`, `git diff --check` | PASS. 68문서·현재 작업 상태·예산·카탈로그 검증, startup brief 3,882 UTF-8 bytes |

카탈로그에는 생성 표시와 내용 해시를 넣어 수기 변경을 덮어쓰지 않는다. harness에서도 카탈로그 freshness를 검사한다. 이동 테스트는 마지막 파일 충돌/원본 변경의 사전 차단, 경로·junction 차단, 중간 실패 복구, 부분 파일 잔여 시 recovery-required, 완료 호출의 무변경을 확인했다. 참고 쓰기는 기존 이미지·sidecar·깨진 링크를 덮지 않고, 실패 시 자신의 동일 바이트만 복구하도록 별도 검증했다.

제품 화면·API 변경이 없어 이번 정리에서 제품 build/browser/device/DB 검사를 다시 실행하지 않았다. 새 아트 미감·소유자 승인은 미검증이다.

## 다음 작업

소나무 파일럿은 준비 상태 그대로다. 새 생성물, 측정, 소유자 승인 없음. 새 작업은 [CURRENT_STATE](../CURRENT_STATE.md)의 범위를 따른다. G-drive 초기화 프로토콜, DB, 제품 화면, commit/push/deploy는 이번 정리에서 변경하지 않았다.
