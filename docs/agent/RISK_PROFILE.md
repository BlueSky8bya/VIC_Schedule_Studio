# Risk Profile

Default: `GENERAL`
Last reviewed: 2026-07-12

## Active Profiles

| 프로필 | 왜 켰나 | 어디에 적용되나 |
|---|---|---|
| `GENERAL` | 모든 프로젝트 기본 | 전역 |
| `SECURITY` | 제품의 핵심 약속이 "공개 데이터만 시청자에게" — 공개 API/로더가 실제 보안 경계다 | `lib/schedules/public-loader.ts`, `app/api/public/**`, `app/(public)/**`, `components/poster/**` |
| `PRIVACY` | 비공개 일정 본문(엠바고/작업)은 방송 전 유출되면 안 되고, DB에 AES-256-GCM으로 암호화되어 있다. 방문/체류 로그는 익명 해시지만 운영 지표다 | `lib/private-layer/**`, `lib/insights/**`, `db/migrations/0045*`, 공개 인사이트 |
| `AUTH` | Google 로그인 + 패스코드 언락 세션 + 5역할(owner/manager/worker/developer/viewer) + RLS. 권한 판정이 앱과 DB 두 층에 있다 | `lib/auth/**`, `lib/permissions/**`, `app/api/auth/**`, `app/(studio)/**` |
| `DESTRUCTIVE_DATA` | 마이그레이션은 수동 적용이고, 암호화 키 분실 = 복구 불가. 스티커/일정 삭제는 cascade | `db/migrations/**`, `scripts/**`, `PRIVATE_DATA_ENC_KEY` |

## Inactive Profiles Reviewed

- `RESEARCH` / `ML_EVALUATION`: 축구 시뮬(`lib/football`, `docs/sim/`)이 있지만 **연구 산출물이 아니라 재미 기능**이다. 통계 주장·논문·라벨 정의가 걸린 게 없다 → 비활성. (시뮬 결과로 무언가를 주장하기 시작하면 켠다.)
- `HEALTH`: 해당 없음.
- `FINANCE` / `PAYMENTS`: 결제 없음. "업 도움"은 외부 링크로 보내는 안내일 뿐 결제 흐름이 아니다.
- `LEGAL_COMPLIANCE`: 개인정보는 이메일·기기 토큰·익명 해시 수준. 규제 대상 데이터 없음.
- `PRODUCTION_INFRA`: Vercel 자동배포 + Supabase 관리형. IaC/네트워크/IAM을 직접 만지지 않는다. (단 **main push = 프로덕션 배포**라는 사실은 항상 유효 — `agent_policy.auto_push: false`.)
- `SAFETY_CRITICAL`: 해당 없음.

## Re-evaluation Triggers

다음이 생기면 이 파일을 다시 쓴다.

- 결제·후원 금액 처리를 앱 안에서 하게 될 때 → `PAYMENTS`, `FINANCE`
- 시뮬 결과를 근거로 무언가를 주장/공표할 때 → `RESEARCH`
- 캘린더가 2개 이상(다중 스트리머)이 되어 테넌시 경계가 생길 때 → `SECURITY` 재검토
- 방문자 개별 식별·추적을 시작할 때 → `PRIVACY` 강화, `LEGAL_COMPLIANCE` 검토
- 인프라를 직접 코드로 관리하기 시작할 때 → `PRODUCTION_INFRA`
