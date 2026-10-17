# PLAN-20261017-079 — 서비스 전체 운영·비용·성능 감사

Status: Complete — 읽기 전용 감사 완료. 제품 개선·운영 설정 변경 미적용.
Scope: 읽기 전용 운영 조사와 재현 검사. Vercel/Supabase뿐 아니라 보안·캐시·배치·프런트엔드·복구·검사 신뢰성 포함.

## 목표

소유자가 요청한 서비스 전체 전수조사를 수행한다. 현재 운영 플랜/집계 사용량, 코드의 비용 증가 경로, 실제 DB 카탈로그/집계 통계, 공식 최신 한도를 함께 대조한다. 확인된 결함·설계상 비용·미측정 위험·오래된 기록을 분리하고 우선순위/개선안/검증 방법을 남긴다.

## 경계

- 운영은 읽기 전용. 과금 플랜 변경·마이그레이션·정리/삭제·재색인·VACUUM·대량 부하 시험·운영 작업 실행을 하지 않는다.
- DB는 읽기 전용 transaction·짧은 statement timeout·낮은 동시성의 집계/카탈로그만. 사용자 이메일·닉네임 연결·원문 일정·채팅·세션·토큰·자격 증명·raw query text를 출력/커밋하지 않는다.
- 실서비스 nano에 합성100/1000명 부하를 보내지 않는다. 큰 부하는 모의 DB/격리 fixture의 비용 계수로 검증한다.
- 실제 운영 플랜·사용 기간·집계 범위를 확인한다. 월말 예측은 가정과 구분하며, 과거 PASS나 공식 기본값을 현재 운영 설정으로 간주하지 않는다.
- 기존 공개 DTO·역할/언락·KST·시청자 집계 원칙과 사용자 미커밋 작업을 유지한다. 이번 요청은 조사이며 제품/데이터 변경은 결과와 분리한다.

## 조사 작업

1. Vercel: 현재 플랜·요금 기간·usage/observability 집계, functions·CPU/memory·전송·edge·image·빌드·캐시·지역·cron. 사용자 수에 비례하는 endpoint/백그라운드 fanout과 캐시 stampede.
2. Supabase: DB/인덱스 크기·대략 행 수·dead tuples·쿼리 누적 집계·접속·잠금·cron, retention·검색/VOD/방문/활동 데이터 성장. RLS/grants와 백업/복구 설정의 확인 범위.
3. 신뢰성: auth/public-private/cache 경계, 쓰기 순서/실패 표시·재시도·중복, 외부 API 장애, 환경 설정 실패와 rate limit, 개인정보/보존.
4. 클라이언트/배포: 요청·이미지·번들·모션/OBS·모바일·접근성, 장시간/복합 조작·기존 unit8/harness2 분류·CI/회귀검사 범위.
5. 독립 리뷰 후 감사 보고서와 즉시/다음/실기기 확인 목록 작성. 확인하지 못한 운영 설정을 명시한다.

## 산출물

[감사 보고서](../verification/PLATFORM_AUDIT-20261017.md). 로컬 원본은 `.scratch-pw/platform-079-*`에 민감 원문 없이 보존한다. 코드 변경이 생기지 않으면 문서/harness 검사만 실행하며 기존 오류를 PASS로 표기하지 않는다.

## 결과와 후속

Vercel Hobby의 조회 기간 CPU6시간47분/4시간, 메모리460.1/360GB-hours와 최근 warm timeout 집중을 확인했다. DB는272.26MB이며 유지보수 RPC 누적 비용·중복 실행·오류 캐시를 우선 조사/개선할 근거가 있다. 실제 함수의 격리 진단9개로 오류 반환·동시 중복·원문 로그·저장 상태 결함을 재현했다. PASS는 결함 재현 성공이며 수정 완료가 아니다.

Supabase dashboard 플랜/계정 사용량/백업, 진단·visit·perf 보존 범위, 실제 역할별 세션/RLS 전체, 실제 OBS/SOOP 장비와 모바일·접근성은 확인 범위를 명시했다. 미확인 외부 설정이 있어도 읽기 전용 감사 결과를 닫고 [Open checks](../verification/OPEN_CHECKS.md#platform-audit-079--운영비용복구-후속)에 후속으로 남긴다. 이번 감사는 제품/의존성/DB/플랜을 바꾸지 않았다.

문서 검증: 관련unit43/43 PASS, harness는 기존 rule inventory/hash2FAIL 유지·broken link0, git diff --check exit0. Vercel·DB·신뢰성/의존성 독립 리뷰의 범위·표현 보정을 반영했다. 새 문서만 로컬 저장, commit/push/배포 없음.
