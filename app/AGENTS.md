# Local Agent Instructions — `app/` (라우트)

## Role
Next.js App Router. 공개 포스터(`/`, `(public)`) · 스튜디오(`(studio)`) · API(`api/`).

## Read Before Editing
- `app/README.md`(이 폴더 라우팅) · `docs/agent/domain-rules/SECURITY.md`
- ADR-0001(공개 경계), ADR-0005(월 라우트), ADR-0008(공개 인사이트)

## Invariants
- `app/(public)`·`app/page.tsx`·`app/api/public/**`는 **`lib/schedules/public-loader`만** import한다.
  studio-loader · service-role 헬퍼 · 비공개 DTO 타입 import 금지.
- 공개 응답 DTO는 **스프레드 없이** 필드 단위로 조립한다.
- 스튜디오 월 라우트(`[year]/[month]`)는 북마크·콜드 진입 전용. 런타임 월 이동을 라우트로 만들지 않는다.
- 시청자(viewer)는 `/studio` 접근 시 `/`로 리다이렉트((studio) layout 가드).

## Restricted Changes (별도 확인 없이 금지)
- 공개 API에 새 필드/엔드포인트 추가 → SECURITY 절차(집계만, 명시 DTO, curl 확인) 필수
- 인증·리다이렉트 흐름 변경
- 새 쓰기 엔드포인트 신설 — `studio-write`/`sticker-write`의 dispatch op를 쓴다

## Verification
```bash
npm run build && npm run start   # dev 서버는 HMR 상태로 거짓 결과를 낸다. 검증은 prod 빌드로.
curl -s http://localhost:3000/api/public/vic/<endpoint>
```
