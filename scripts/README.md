# scripts/ — 운영·유틸 스크립트

> Node `.mjs` 스크립트. 대부분 `.env.local`을 읽어 Supabase에 직접 붙는다.
> 실행: `node scripts/<파일>`. **프로덕션 데이터를 건드리는 것이 있으니** 무엇인지 보고 실행.

| 파일 | 역할 | 분류 |
|---|---|---|
| `apply-db.mjs` | 마이그레이션 SQL 적용 (`node scripts/apply-db.mjs db/migrations/<file>.sql`, 멱등) | 🔧 상시 도구 |
| `verify-db.mjs` | DB 스키마/상태 점검 | 🔧 점검 |
| `verify-public.mjs` | 공개 API 응답에 비공개 데이터 누출 없는지 검증(경계 가드) | 🔧 점검·중요 |
| `verify-seed.mjs` | 시드 데이터 검증 | 🔧 점검 |
| `audit-colors.mjs` | 태그 색 대비/가독성 감사 | 🎨 일회성 |
| `darken-tag-text.mjs` | 태그 글자색 일괄 어둡게(가독성) | 🎨 일회성 마이그레이션 |
| `recolor-tags.mjs` | 태그 색 일괄 재배정 | 🎨 일회성 마이그레이션 |
| `sort-tags-by-usage.mjs` | 사용량 기준 태그 정렬 | 🎨 일회성 |
| `taxonomy-probe.mjs` | 태그 분류 체계 탐색/분석 | 🔍 조사 |

**상시 도구**(apply-db / verify-*)는 계속 쓰고, **일회성**(🎨/🔍)은 과거 데이터 정리에 쓴
기록물 — 함부로 재실행하면 현재 데이터가 덮일 수 있으니 내용 확인 후 사용.
