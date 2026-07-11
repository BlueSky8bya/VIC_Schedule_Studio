# Project Map — 어디를 고쳐야 하는가

> 저장소를 통째로 스캔하지 마라. 여기서 목적지를 고르고, 그 폴더의 `README.md` / `AGENTS.md`로 내려가라.

## 라우팅 표

| 경로 | 역할 | 주 진입점 | 입력 → 출력 | 로컬 지침 | Risk |
|---|---|---|---|---|---|
| `app/(public)`, `app/page.tsx` | 공개 포스터 라우트 | `app/page.tsx` | 요청 → 시청자 포스터 SSR | `app/README.md` | SECURITY, PRIVACY |
| `app/api/public/**` | **공개 API 경계** | `broadcast/route.ts` 등 | 쿼리 → 공개 DTO(JSON) | `app/AGENTS.md` | SECURITY, PRIVACY |
| `app/(studio)/**` | 편집실·꾸미기·태그·멤버 | `studio/calendar/[y]/[m]` | 로그인 액터 → 역할별 화면 | `app/README.md` | AUTH |
| `app/api/{studio-write,sticker-write}` | 낙관적 쓰기 창구(keepalive) | `route.ts` | op + payload → 액션 | ADR-0006 | AUTH |
| `components/poster/**` | 시청자 포스터 · 꾸미기 · 공개 인사이트 | `public-poster.tsx` | 공개 스케줄 → 화면 | `components/README.md` | SECURITY |
| `components/studio/**` | 편집실 셸 · 관리자 인사이트 · 차트 | `studio-shell.tsx` | 스튜디오 스케줄 → 화면 | `components/AGENTS.md` | AUTH |
| `components/seasonal/**` | 시즌 장난감(월드컵 미니게임·중력공) | `worldcup-ball-goal.tsx` | 사용자 opt-in → 오버레이 | ADR-0009 | GENERAL |
| `lib/schedules/public-loader.ts` | **공개 데이터 단일 출처** | `getPublicSchedule` | Supabase(anon) → 공개 DTO | `lib/AGENTS.md` | SECURITY, PRIVACY |
| `lib/schedules/studio-loader.ts` + `*-actions.ts` | 스튜디오 읽기/쓰기 | 서버 액션 | 액터 + 입력 → DB | `lib/schedules/README.md` | AUTH |
| `lib/private-layer/**` | 패스코드 언락 · 본문 암호화 | `secret-crypto.ts` | 평문 ↔ AES-256-GCM | ADR-0002 | PRIVACY |
| `lib/auth/**`, `lib/permissions/**` | 액터 해석 · 역할 판정 | `actor.ts`, `roles.ts` | 세션 → 역할·권한 | ADR-0003 | AUTH |
| `lib/insights/**` | 관리자 인사이트 집계 | `actions.ts` | DB → 수치 없는 패널 데이터 | ADR-0008 | PRIVACY |
| `lib/ui/**`, `app/globals.css` | 디자인 토큰 · 브레이크포인트 · 햅틱 | `breakpoints.ts` | — | `CLAUDE.md` Design rules | GENERAL |
| `db/migrations/**` | 스키마(수동 적용, 멱등) | 최신 번호 파일 | SQL → Supabase | `db/migrations/README.md` | DESTRUCTIVE_DATA |
| `scripts/**` | 운영 스크립트(적용·검증·백필) | `apply-db.mjs` | CLI | `scripts/README.md` | DESTRUCTIVE_DATA |
| `scripts/agent-harness/**` | 하네스 자동화(세션 브리핑·드리프트·검증) | `verify-harness.mjs` | CLI/훅 | 이 문서 | GENERAL |
| `tests/**` | 단위(vitest) · e2e/visual(playwright) | `tests/e2e`, `tests/visual` | 코드 → PASS/FAIL | `tests/AGENTS.md` | GENERAL |
| `docs/**` | 토픽 문서 트리 | `docs/README.md` | — | `docs/README.md` | GENERAL |

## 경계 규칙(한 줄 요약)

- `app/(public)`·`app/api/public`은 **`public-loader`만** import한다. studio-loader·service-role 헬퍼·비공개 DTO 금지.
- 새 쓰기는 새 엔드포인트를 만들지 말고 `studio-write`/`sticker-write`의 **dispatch op**를 추가한다.
- 공개 응답 DTO는 **스프레드 금지**, 필드를 하나씩 명시해 조립한다.
- 포스터 표면(`[data-export-surface]`) 안에는 상호작용 크롬을 넣지 않는다(캡쳐에 박힌다).

## 자주 틀리는 곳

- **RLS 새 테이블**: `grant`(`*_grants.sql`)를 안 주면 service_role 쓰기가 조용히 permission denied로 죽는다.
- **Supabase select 1000행 cap**: 광역 조회는 `fetchAllRows` 페이지네이션.
- **`npm run build` exit code 확인**: Vercel은 lint 에러로도 빌드가 깨져 prod가 옛 빌드에 stuck된다.
