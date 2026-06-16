# app/ — 라우트(Next.js App Router) 라우팅

> 라우트 그룹 `(auth)`/`(studio)`와 `api/`. 시간은 항상 KST.

## 페이지
| 경로 | 내용 |
|---|---|
| `page.tsx` (루트 `/`) | 비로그인 포함 누구나 보는 **공개 포스터**(2026-06 기준 로그인 장벽 제거) |
| `(auth)/login`, `(auth)/auth/callback` | 구글 로그인·콜백 |
| `(studio)/studio/(home)` | 스튜디오 홈 |
| `(studio)/studio/calendar/[year]/[month]` | 편집실 달력(북마크/콜드진입용 — 런타임 월이동 아님) |
| `(studio)/studio/decorate/[year]/[month]` | 포스터 꾸미기 |
| `(studio)/studio/private-layer` | 비공개 레이어(unlock) |
| `(studio)/studio/tags` | 태그 관리 |
| `(studio)/studio/trusted-members` | 신뢰 멤버 관리 |

`(studio)` 레이아웃에 접근 가드(viewer→`/`). 가드 검증은 브라우저로(loading.tsx 스트리밍 함정).

## API
| 경로 | 내용 | 경계 |
|---|---|---|
| `api/public/[calendarSlug]/{events,proposals}` | ⭐ **공개 API** | `public-loader`만 사용·비공개 필드 금지 |
| `api/studio-write`, `api/sticker-write` | 편집 낙관적 쓰기(keepalive) | 떠나도 안 잃게 |
| `api/unlock-private-layer`, `api/private-layer` | 비공개 unlock·데이터 | 구글 로그인+패스코드 |
| `api/auth/{login,logout}` | 인증 | |
| `api/presence` | 접속 ping | |
| `api/trusted-members` | 멤버 관리 | |

전역 규칙·역할은 루트 `CLAUDE.md`·`docs/sop.md`, 데이터 경계는 `docs/security-boundary.md`.
