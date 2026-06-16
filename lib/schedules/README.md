# lib/schedules/ — 데이터 로더·쓰기 액션

> ⭐ **공개/비공개 경계의 중심.** 로더 둘을 헷갈리지 마라.

## 로더 (읽기)
| 파일 | 역할 | 누가 import 가능 |
|---|---|---|
| `public-loader.ts` | **공개 데이터만** 구성(비공개 필드 제거된 DTO) | 공개 라우트(`app/api/public`, 공개 페이지) **허용** |
| `studio-loader.ts` | 비공개·작업자·엠바고 **포함** 전체 | 스튜디오 전용. 공개 쪽에서 **import 금지** |
| `cache.ts` | 로더 캐싱 | |
| `sample-data.ts` | 시드/샘플 | |

## 쓰기 액션 (server actions)
| 파일 | 대상 |
|---|---|
| `event-actions.ts` | 일정 CRUD |
| `link-actions.ts` | 일정 잇기(체인) |
| `tag-actions.ts` | 태그 배정·생성·색 |
| `heart-actions.ts` / `heart-tiers.ts` | 하트 / 인기 단계 |
| `sticker-actions.ts` / `sticker-asset-actions.ts` | 스티커 / 업로드 에셋 |
| `teaser-actions.ts` | 떡밥(공개 예약) |
| `theme-actions.ts` | 포스터 테마 |

**규칙**: studio→public 넘길 땐 객체 spread 말고 **명시적 DTO 구성**. private/embargo/work/
codename/editor/request 류 필드는 공개 응답에 절대 포함 금지(`.claude/rules/public-private-boundary.md`).
