# Domain Rule — SECURITY (공개/비공개 정보 경계)

적용 경로: `lib/schedules/public-loader.ts` · `app/api/public/**` · `app/(public)/**` · `app/page.tsx` ·
`components/poster/**`(공개 렌더) · 공개 인사이트

근거: [ADR-0001](../decisions/ADR-0001-public-private-server-boundary.md) ·
[ADR-0008](../decisions/ADR-0008-public-insights-aggregate-rpc.md) · `docs/security-boundary.md` ·
`.claude/rules/public-private-boundary.md`

## 절대 규칙

1. **공개 경로는 `public-loader`만 import한다.** studio-loader, 비공개 DTO 타입, service-role 헬퍼 금지.
2. **공개 DTO는 명시적으로 조립한다.** 객체 스프레드로 DB 행을 흘리지 않는다.
3. 다음 성격의 필드는 공개 응답에 **절대** 넣지 않는다: private, internal, embargo, codename,
   editor/작성자, work(작업자용), 요청 페이로드, 운영 지표(방문·체류·동시접속), 세션 원본.
4. 가시성 스코프 읽기 권한: public → 모두 / work → owner·developer·worker / owner_private → **owner만**.
   매니저는 비공개 접근 0.
5. RLS는 1차 방어선일 뿐이다. 쿼리에서도 `visibility_scope = 'public'`처럼 **명시적으로** 좁힌다.
6. 캘린더 스코프(`calendar_id`)를 항상 건다 — RLS는 공개 행을 허용할 뿐 캘린더를 가르지 않는다.

## 새 공개 데이터를 열 때 절차

1. "이건 팬에게 주는 값인가, 운영 지표인가"를 먼저 판정한다. 운영 지표면 **열지 않는다**.
2. 원본 테이블이 deny-all이면 **SECURITY DEFINER 집계 함수**를 만들고 anon에게 EXECUTE만 준다.
   함수는 집계만 반환한다(원본 행·시각·제목 금지).
3. `public-loader`에 로더를 추가하고, 공개 API는 그 로더만 부른다.
4. 응답을 `curl`로 직접 확인한다. 눈으로 보기 전엔 "안전하다"고 말하지 않는다.

## 검증

```bash
npm run test                       # tests/unit/public-dto.test.ts 포함
curl -s http://localhost:3000/api/public/vic/<endpoint> | jq   # 실제 응답 확인
node scripts/verify-public.mjs     # 공개 노출 점검 스크립트
```
