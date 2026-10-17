# PLAN-080 — 운영 감사 후속과 빅타민 방송 안정화

Status: Complete
Date: 2026-10-17 KST
Scope: L3 공개 경계·실패 복구, L2 비용·공유 UI/빅타민 파이프라인

## 승인과 목표

소유자: “중요한 것부터 아까 빅타민 관련까지 차례로 다 해놔”. PLAN-079 감사의 미적용 수정과 이전 빅타민 점검 후속을 중요도 순서로 구현·검증한다. 기존 commit/push/배포 승인도 이어간다. 과거 완료 요구를 새 구현으로 중복 복원하지 않고 현재 코드·재현으로 필요한 수정만 한다.

## 고정 경계

- 공개 DTO/DB now() 가림·owner/developer/viewer·grant 만료/철회·KST·직렬 쓰기 보존. 공개 API/캐시에는 개인정보·운영 원본·비공개 일정 없음.
- 운영 데이터 삭제/대량 UPDATE·청소·유료 전환·권한 확대 금지. 필요한 비파괴 함수/메타데이터 마이그레이션은 격리 SQL 검증·독립 보안 검토·되돌림/적용 순서를 갖춘다. 오래된 집계 상태는 함부로 재생성하지 않는다.
- 빅타민은 PC 기본ON/저장선택 유지·모바일 제외·92px/전체포즈·bounded decoded pool·실제 하트불변·창뒤 같은 개체·소파 단일 앞면·quiet tail0 보존. 새 상시 프레임루프·실제 OBS 보증 없음.
- 사용자 art/preview/.vscode 작업 보존. 검사는 과거 fixture·가짜 DB/외부 API로 수행하고 현재/미래 운영 달에 시험 데이터를 넣지 않는다.

## 순서와 합격 기준

1. 보안/정확성: 검색 실패 원문 로그 제거, critical DB 오류와 정상 부재 구분, 공개 실패 복구·pagination, 저장 실패 latch. 합성 민감 canary·실제 함수 오류 주입·직렬 순서/재시도 검사.
2. 비용/복구: warm bounded stage·진짜 성공 계약, live single-flight, 변경 없는 timeline 파생 작업 억제, graph 성공 marker·retry·전체deadline. 동시1/100/1000 모의요청, 실패/부분성공/재시작 SQL 검사. 필요 이상 KV/Redis 미도입.
3. 클라이언트/빅타민: hidden/offline poll·clock·SW 중복SSR 억제, popover 유한 위치추적과 공유 엔진 동등성. 스크롤/집 접힘·소파/먹이/입력·창/숨바꼭질·최초공개·모바일 제외의 실제 production fixture 조작·PNG, quiet-tail/측정횟수 확인.
4. 유지보수: 의존성 보안 patch·검증TLS·analytics IPv6/body guard·적절한 관측표본/집계·월toast·기존unit8/harness2를 실제 정책/결함별 해결. 공개호출 계약을 임의로 깨지 않는다.
5. typecheck/lint/관련+전체unit/build/harness, 독립 코드·보안·UI검토, 배포·운영SHA/익명 smoke/집계 재확인. 기존FAIL도 남으면 정확히 기록하며 무력화하지 않는다.

## 증거와 미확인

작업별 결과·원 실패·모의 비용·PNG는 `.scratch-pw/platform-080-*` 및 새 검증 문서에 기록한다. Supabase dashboard 실제 플랜/egress/backup와 실제 방송PC·스크린리더/모바일기기 등 외부 한계는 작업 완료 주장과 분리한다. 현재 코드로 고칠 수 있는 일을 우선 끝내며 외부 로그인 대기로 전체 작업을 멈추지 않는다.

## 통합 현황

구현·독립 리뷰·최종 unit1894/1894·build/typecheck/lint·격리 SQL4·harness PASS. 화면28+최종popup2·실제SW3 PASS. 0151은10:25KST 검증 TLS로 먼저 적용했으며 cron 불변·service-only 권한 확인. 제품9aefbd29 운영18 smoke와 Vercel Ready, 최종aac6b78d 원격quality38992818125 전 단계 PASS/Ready 확인. CI의 실제 이미지 통합 검사1개만30초 제한이며 입력/단언 보존. [통합 기록](../verification/PLATFORM_REMEDIATION-20261017.md)에 원 실패·의존성 잔존·복구/외부 한계를 보존한다. 진단14,209행 정리는 당시 별도 승인 대기였고, 이후 [081](PLAN-20261017-081-diagnostic-retention.md)로 승인·검증·정리했다. 외부 실제 장비/계정/사용량 검증은 [Open checks](../verification/OPEN_CHECKS.md)에서 이어간다.
