# scripts/ — 운영·유틸 스크립트

> Node `.mjs` 스크립트. 대부분 `.env.local`을 읽어 Supabase에 직접 붙는다.
> 실행: `node scripts/<파일>`. **프로덕션 데이터를 건드리는 것이 있으니** 무엇인지 보고 실행.

| 파일 | 역할 | 분류 |
|---|---|---|
| `apply-db.mjs` | 마이그레이션 SQL 적용 (`node scripts/apply-db.mjs db/migrations/<file>.sql`, 멱등) | 🔧 상시 도구 |
| `verify-db.mjs` | DB 스키마/상태 점검 | 🔧 점검 |
| `verify-public.mjs` | 공개 API 응답에 비공개 데이터 누출 없는지 검증(경계 가드) | 🔧 점검·중요 |
| `verify-seed.mjs` | 시드 데이터 검증 | 🔧 점검 |
| `ambient-art-outline.mjs` | 납품 아트 PNG의 **순검정 윤곽선** 제거(2026-09-06 라운드 6 A#2) — 아주 어두운 픽셀만 명도를 들어 올리고 그림의 지배 색조를 입힌다(붉은 띠는 회갈색으로). 원본을 먼저 복사하고 실행 | 🎨 일회성 마이그레이션 |
| `ambient-art-satcap.mjs` | 납품 아트 PNG의 **채도 위쪽만 압축**(2026-09-06 라운드 8 A#6) — 무릎(기본 .30) 아래는 그대로, 위만 비율 k로 눌러 한 세트로 보이게 한다. 봄 참나무가 최대 .92·픽셀 57%가 .35 초과로 여름·가을·겨울과 다른 세계였다. 파일을 제자리에서 바꾼다 | 🎨 일회성 마이그레이션 |
| `audit-colors.mjs` | 태그 색 대비/가독성 감사 | 🎨 일회성 |
| `darken-tag-text.mjs` | 태그 글자색 일괄 어둡게(가독성) | 🎨 일회성 마이그레이션 |
| `recolor-tags.mjs` | 태그 색 일괄 재배정 | 🎨 일회성 마이그레이션 |
| `sort-tags-by-usage.mjs` | 사용량 기준 태그 정렬 | 🎨 일회성 |
| `taxonomy-probe.mjs` | 태그 분류 체계 탐색/분석 | 🔍 조사 |
| `ambient-qa/` | **계절 배경 비주얼 QA 하네스**(2026-09-05, PLAN-20260905-005): 결정적 fixture 캡처·contact sheet·diff·셀프테스트 — [`ambient-qa/README.md`](ambient-qa/README.md). DB 무관 | 🔧 상시 도구 |
| `backfill-vod-timelines.mjs` | 팬 타임라인 전체 재수집(0071) — 댓글을 다시 읽어 `vod_timeline` upsert. **파싱 규칙을 고친 뒤 과거 VOD를 따라잡을 때** 쓴다. `--dry`로 무엇이 달라지는지 먼저 본다(숲 댓글 API가 죽은 VOD는 건너뛰어 멀쩡한 행을 덮지 않는다) | 🔧 상시 도구 |
| `lib/timeline-parse.mjs` | 위 스크립트가 쓰는 **파서 거울** — `lib/broadcast/vod-timeline.ts`와 규칙이 같아야 하고, 동치는 `tests/unit/vod-timeline.test.ts`가 지킨다. 규칙을 고치면 양쪽 다 고친다 | 📚 공용 모듈 |
| `cleanup-sticker-storage.mjs` | 0065(스티커 철수) 동반 — `sticker-assets` 버킷 비우기(`--delete`). **2026-08-27 실행 완료, 버킷 삭제됨 — 재실행 불필요(404)** | 🗑 일회성(완료) |

**상시 도구**(apply-db / verify-*)는 계속 쓰고, **일회성**(🎨/🔍)은 과거 데이터 정리에 쓴
기록물 — 함부로 재실행하면 현재 데이터가 덮일 수 있으니 내용 확인 후 사용.
