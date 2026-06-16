# lib/ — 도메인 로직·유틸 라우팅

> 서버/클라 공용 로직. UI는 `components/`, 라우트는 `app/`. **필요한 폴더만 열어라.**

| 폴더 | 내용 | 비고 |
|---|---|---|
| `schedules/` | 일정 데이터 **로더·쓰기 액션** | ⭐ 공개/비공개 경계 핵심 — 자체 README 참조 |
| `auth/` | 인증·현재 액터/역할·관리자 판정·세션 | `actor.ts`=현재 사용자·역할, `admin.ts`, `config.ts`, `server.ts` |
| `permissions/` | 역할별 권한 판정(canEdit 등) | 서버 권한 체크의 단일 출처 |
| `private-layer/` | 비공개 레이어(passcode unlock 세션) | |
| `calendar/` | 달력 계산 | `month.ts`, `holidays.ts`(공휴일), `worldcup.ts`(경기일), `use-cell-range-select`, `use-equal-chain-heights`(잇기 높이) |
| `tags/` | 태그 도메인 로직 | |
| `insights/` | 방문/체류 인사이트 집계 | |
| `presence/` | 실시간 접속(presence ping) | |
| `perf/` | 서버 성능 샘플 | |
| `trusted-members/` | 신뢰 멤버(매니저/작업자) | |
| `domain/` | 공용 타입 | `schedule-types.ts` |
| `ui/` | UI 유틸 | `breakpoints.ts`, `haptics.ts`, `motion.ts` 등 — 모두 단일 출처 |
| `football/` | 월드컵 미니게임 **RL 시뮬 엔진**(제품 본체와 별개) | ⭐ 자체 README + `core/rl/rules/tactics/analytics` 트리 |

**경계 규칙**(`.claude/rules/public-private-boundary.md`): 공개 쪽(`app/api/public` 등)은
`schedules/public-loader`만 import. `studio-loader`·service-role·비공개 DTO는 금지.
