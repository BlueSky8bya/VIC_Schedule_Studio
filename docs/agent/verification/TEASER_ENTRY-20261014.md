# 최초공개 카드 합류 — PLAN-035

2026-10-14 KST. [계획](../plans/PLAN-20261014-035-premiere-card-convergence.md). 제품 코드 검증과 운영 배포 검증을 구분한다.

## 변경과 경계

한 장/여러 장의 최초공개 카드가 원래 크기로 중앙에 모이고, 포개진 뒤 창 표면으로 펼쳐진다. full 1.7 + 0.2 + 1.5초, lite 1.25 + 0.2 + 1.05초. full 운반체 상한 8개, lite 2개, 초과분은 실제 일정 수로 표시. 실제 카드 위치/크기를 읽고 기존 FLIP와 공용 스프링을 사용한다. 글자는 최종 크기로 나타난다. 계절·토리님·응원·음악·공개 후 수동 종료는 기존 구현을 유지한다.

마지막 22초 입장·동작 줄이기·gfx soft/off는 이동 생략. 공개/시각/묶음 변경, 숨김, resize, gfx 변경, 나가기에서 유한 타이머·observer·시계 구독·장식 DOM 상태를 정리한다. 시계 보정으로 18초 이하가 되어도 종료한다. 진입 중 주변 컨트롤만 inert; 공유 countdown 관측과 서버 공개 경로는 계속 동작한다. 운반체는 ???/개수만 사용한다. 공개 DTO·서버 권한·KST·DB 요청·1840 export 표면은 변경하지 않았다.

## 실제 실행

- 최종 제품 build: PASS(Next production fixture build, lint/typecheck 포함). 앞선 중간 build의 `prefer-const` 실패는 수정 후 다시 빌드했다.
- 최종 관련 단위/메모리: **125 PASS**(제품 82, 메모리/규칙 43).
- 새 진입 브라우저 8개: PASS. PC1440/agenda390 × 1/3개, 중앙 합류 후 확대 순서, 확대 전 글자 숨김, 타이머 단일성, PC export 1840, 공개 중단·시각 변경·숨김·resize·gfx·늦은 입장·Escape/재진입. 처음 실행의 모바일 2개 실패는 agenda에 없는 export 표면을 기다린 테스트 조건이었으며 PC에만 해당 검증을 적용한 뒤 재실행했다.
- 기존 포함 브라우저 94개 실행: 92 PASS/2 FAIL. 긴 입장 뒤 기본 fade까지 5초 안에 기다리던 테스트와, 실시간 `--pm-gather`에 따라 초상화가 1px가량 이동하던 모바일 snapshot 조건이었다. 진입 종료를 먼저 기다리고 정적 비교의 gather만 기존 kairos 검증과 같은 .4로 고정했다. 해당 3개 재실행 PASS, 최종 fluid 파일 전체 **20 PASS**. 따라서 관련 94개 고유 항목 모두 통과 증거 확보(전체 1회 green 실행이라는 의미는 아님). 기준선 이미지 변경 없음.
- 일반 `/` PC1440/agenda390 합성 smoke PASS: 입장·공유 타이머·응원·음악·숨김 후 자동 재생 금지·9초 집중·공개·7.5초 이상 읽기 유지·수동 종료. 각 환경 page error 0, POST 차단 1/전송 0. 실제 운영 데이터 변경 없음.
- 일반 `/` 다중 합류 별도 smoke PASS: PC/agenda 각각 3장의 merge→unfold 측정, 펼치기 직전 중앙 오차 0.02/0.06px, 타이머 1개·기대 버튼 3개·나가기 복원·가로 넘침 없음. page error 0, POST 차단 1/전송 0. 운영 적용 전 로컬 production-build 클라이언트 기준이다.
- PC/agenda 중간 프레임 100/1000/1750/2100/2700/3550ms를 캡처하고 실제 열어 확인했다. 초기의 큰 보라색 사각형과 조기 중첩을 고쳐 중앙의 작은 부채꼴→포개짐→어두운 표면 확장으로 조정했다. 최종 화면 snapshot 기준선은 수정하지 않았다.
- G-21 독립 코드 검토: 진입과 18초 퇴장 경계 중첩, gfx 변경 정리 지적을 반영했다. 최종 재검토에서 확정 release blocker 없음. 검토자는 브라우저 테스트를 직접 실행하지 않았다.

브라우저는 모든 POST를 차단하고 과거 달 합성 fixture만 사용한다. 실제 달력 데이터 생성/수정은 없다. 캡처/측정은 무시된 `.scratch-pw/entry-review/`에 보존한다.

## 남은 범위

실제 Safari/iOS 장치·스크린리더·물리 저사양 장치의 프레임률, 장기 관람의 재미/몰입은 미검증이다. 서버/인증/RLS를 변경하지 않았으며 fixture를 실제 로그인 검증으로 주장하지 않는다. 전역 `harness:verify` 재실행: 기존 RULE_MIGRATION active IDs/inventory 불일치 2건 FAIL. 이번 작업은 규칙 ID를 신설/삭제하지 않았다. 관련 메모리/규칙 단위 43 PASS와 전역 harness 실패는 별도로 구분한다.

## 배포

제품 커밋 `2bc5b21d08b0a34ae2024d3bcf8eb27c99649337` main push 완료. [Vercel 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/2W2GfH3TogLiqBW2YzCGkvZn3way) success와 운영 build SHA 일치를 확인했다.

`https://vic-schedule-studio.vercel.app/` PC1440/agenda390 **PASS**: 3장의 합류→중앙 포개짐→표면 확장, 펼치기 직전 중앙 오차 0.18/0.06px, 타이머 1개·기대 버튼 3개·나가기 복원·가로 넘침 없음. 배포 화면의 중간 프레임과 최종 창을 실제 열어 확인했다. 별도 운영 smoke도 두 환경 PASS: 응원·음악·숨김 후 자동 재생 금지·9초 집중·실제 공개 경로의 합성 응답·7.5초 이상 읽기 유지·수동 종료. 각 smoke/환경 page error 0, POST 차단 1/전송 0. 실제 운영 일정 생성/변경 없음.

증거는 무시된 `.scratch-pw/entry-production-deploy.json`, `entry-production-smoke.json`, `company-production-smoke.json` 및 캡처에 보존했다. 후속 검증 기록 커밋은 문서만 변경하며, 병행 작업의 별도 편집기 수정은 이 제품 검증 범위에 포함하지 않는다.
