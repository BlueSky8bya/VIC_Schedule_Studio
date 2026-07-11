# Local Agent Instructions — `lib/`

## Role
도메인 타입 · 데이터 로더/액션 · 권한 · 비공개 레이어(암호화) · 인사이트 집계 · UI 유틸.

## Read Before Editing
- `lib/README.md`, `lib/schedules/README.md`
- `docs/agent/domain-rules/SECURITY.md` · `AUTH.md`

## Invariants
- **`public-loader`는 공개 데이터의 단일 출처다.** 여기 들어가는 select는 항상 공개 스코프 + 캘린더 스코프.
- 서버 액션은 **자기 안에서 권한을 검사한다**(라우트가 대신해 주지 않는다).
- 시간은 KST. 날짜 귀속(방송 세션 등)은 `start_day`(KST 시작일) 규칙을 따른다.
- 하트 배지는 단조화 + 직렬 큐(과거 회귀 2건). 절대 수치 기반 tier를 남의 하트로 흔들지 않는다.
- 비공개 본문은 `lib/private-layer/secret-crypto.ts`로만 다룬다. 키 없으면 큰 소리로 throw(조용한 실패 금지).

## Restricted Changes
- 공개 DTO 필드 추가/변경 · 권한 판정 로직 · 암호화 포맷 → ADR 검토 후에만.

## Verification
```bash
npm run test        # vitest (public-dto, owner-email, football taxonomy 등)
```
