# Local Agent Instructions — `tests/`

## Role
`unit/`(vitest) · `integration/`(vitest + **실제 Supabase**) · `e2e/`(playwright) ·
`visual/`(playwright, 시각 회귀 + 편집실·그림판·떡밥 실물 e2e + 공식 포스터 PNG 내보내기).

## Invariants
- 공개 경계 테스트(`unit/public-dto.test.ts`)는 **삭제·약화 금지**. 새 공개 필드를 추가하면 여기에 검사를 늘린다.
- 실물 검증은 **프로덕션 빌드**로 한다(`playwright.visual.config.ts`가 빌드 후 `next start`로 띄운다) —
  `next dev`는 HMR 상태로 거짓 결과를 내고, 다른 라우트의 CSS까지 실어 **옛 레이아웃을 흉내 낸다**
  (2026-08-05 실측: dev에서 표면 높이가 옛 값으로 나왔다 — 지오메트리 판단에 dev 금지).
- 레이아웃을 의도적으로 바꾸는 커밋은 **같은 커밋에서** `npm run test:visual -- --update-snapshots`로
  기준선을 갱신한다. 안 하면 게이트가 상시 red가 되어 진짜 드리프트를 못 잡는다.
- 편집실 실물 테스트는 `/visual-fixture/studio`(로그인 없이 셸을 띄우는 테스트 전용 라우트)를 쓰고,
  서버 쓰기는 `/api/studio-write`를 **가로채** 검사한다 — 운영 DB를 건드리지 않는다.
- 시간이 걸린 기능(떡밥 카운트다운)에 **가짜 시계(page.clock)를 쓰지 않는다**. 서버가 그린
  카운트다운과 어긋나 하이드레이션 오류가 나서, 앱이 아니라 하네스가 실패를 만든다.

## 통합 테스트(실제 DB) 안전 규칙 — 어기면 시청자 화면이 오염된다
- 테스트 일정은 **과거 달**에만 만든다(현재/미래 달 금지 — 시청자가 실시간으로 본다).
- 제목에 `[통합테스트]` 표식을 단다.
- `afterAll`에서 **물리 삭제**하고 잔여 0을 단언한다(tombstone도 남기지 않는다).
- 자격증명(`.env.local`)이 없으면 스스로 건너뛴다 — 남의 환경·CI에서 붉게 뜨지 않는다.
- 인증은 actor를 owner로 고정하고 service-role로 접근한다 → **RLS는 이 층의 대상이 아니다**
  (RLS는 공개 경계 e2e와 SQL 정책이 담당). 여기서 보는 것은 스키마·RPC·로더 계약이다.

## Verification
```bash
npm run test              # vitest(단위) — 네트워크 없음, 커밋마다
npm run test:integration  # 실제 Supabase 왕복(서버 액션 → DB → 공개 로더)
npm run test:e2e          # playwright e2e(공개 API 경계)
npm run test:visual       # 시각 회귀 + 편집실/그림판/떡밥 실물 e2e
```
