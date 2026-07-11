# Definition of Done

> "코드를 썼다"가 아니라 "검증했다"가 완료다. **실행하지 않은 검증은 성공이라고 말하지 않는다.**
> 못 돌린 항목은 `NOT VERIFIED`로 남기고 그 이유를 적는다.

## 0. 모든 변경 공통 (게이트)

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint --max-warnings=0 → error 0이어야 함
npm run build         # exit code 확인! (tail만 보지 말 것 — Vercel은 lint 에러로도 빌드가 깨진다)
npm run test          # vitest
```

- [ ] 위 4개 통과(또는 실패를 그대로 보고)
- [ ] 공개/비공개 경계 재확인 — 공개 응답에 비공개 필드가 없는가
- [ ] Accepted ADR과 충돌하지 않는가 (충돌하면 supersede 먼저)
- [ ] **회귀 리뷰**: 생성/드래그/순서변경/저장순서, 낙관적 상태 ↔ 서버 prop 동기화, 게이팅 범위,
      주변 레이아웃·패딩
- [ ] 되돌리는 법을 한 줄로 말할 수 있는가

## 1. 시청자 포스터 (`components/poster/**`, `app/page.tsx`)

- [ ] 실물 렌더 확인(프로덕션 빌드 + Playwright): 데스크톱 / 태블릿(≤1040 → 아젠다) / 모바일(≤640)
- [ ] 포스터 표면(`[data-export-surface]`) 안에 상호작용 크롬이 안 들어갔는가(캡쳐에 박힌다)
- [ ] 스티커 좌표 안전: 표면 폭 1840 고정, 내부를 뷰포트로 재배치하지 않았는가 (ADR-0004)
- [ ] 로딩/빈 상태/에러 상태가 사람 말로 되어 있는가
- [ ] 모션: 진입 ≤500ms, 그리드 stagger 총 ≤500ms, `html[data-reduce-motion]` 존중
- [ ] 대비 AA(본문 4.5:1, 큰 글자 3:1), 터치 타깃 ≥44px

## 2. 편집실 (`components/studio/**`, `app/(studio)/**`)

- [ ] 역할별로 확인: owner / manager(비공개 접근 0) / worker(work만) / developer(오너전용 불가) / viewer(→ `/`)
- [ ] 서버 권한 검사가 살아 있는가(클라 게이트는 유일한 방어선이 아니다)
- [ ] 낙관적 쓰기는 직렬 큐 + keepalive 경로인가 (ADR-0006)
- [ ] 게이팅을 좁게 걸었는가(전역 pending으로 무관한 버튼을 막지 않았는가)
- [ ] **실물 확인**: 로컬에선 로그인이 필요해 자동화가 막혀 있다 → 사용자에게 확인 요청하고
      그 사실을 `CURRENT_STATE.md`에 남긴다 (ISSUE-001)

## 3. 공개 API / 로더 (`app/api/public/**`, `lib/schedules/public-loader.ts`) — SECURITY

- [ ] `public-loader`만 import(studio-loader·service-role·비공개 DTO 금지)
- [ ] 응답 DTO를 **스프레드 없이** 필드 단위로 조립했는가
- [ ] 새 필드가 private/internal/embargo/work/editor/요청 페이로드 성격이 아닌가
- [ ] 집계로 여는 데이터는 SECURITY DEFINER 함수가 **집계만** 반환하는가 (ADR-0008)
- [ ] 실제 응답을 눈으로 확인(`curl`)했는가

## 4. DB 마이그레이션 (`db/migrations/**`) — DESTRUCTIVE_DATA

- [ ] 멱등(`if not exists` / `create or replace`)인가
- [ ] RLS 새 테이블이면 `grant`(service_role) 파일을 같이 넣었는가 — 안 주면 서버 쓰기가 조용히 죽는다
- [ ] 되돌리는 법(반대 SQL 또는 무해함)을 커밋 메시지에 적었는가
- [ ] `node scripts/apply-db.mjs db/migrations/<file>.sql` 실행하고 결과를 보고했는가
- [ ] 파괴적(삭제/변환)이면 [domain-rules/DESTRUCTIVE_DATA.md](domain-rules/DESTRUCTIVE_DATA.md) 절차를 밟았는가

## 5. 내보내기(PNG) 영향

- [ ] 공식 export(Playwright, 공개 포스터 라우트)에 관리 UI·비공개 배지·언락 컨트롤이 안 들어가는가
- [ ] 애니메이션 스티커는 정지 프레임으로 나간다는 사실이 사용자에게 드러나는가

## 6. 문서 (변경이 문서를 거짓으로 만들면 완료가 아니다)

- [ ] `docs/agent/CURRENT_STATE.md` 갱신(상태·이슈·다음 단계·마지막 검증)
- [ ] 되돌리기 비싼 결정을 내렸으면 `docs/agent/decisions/`에 ADR + `DECISION_INDEX` 한 줄
- [ ] 폴더 역할·명령·경계가 바뀌었으면 `PROJECT_MAP.md` / 해당 README
- [ ] `npm run harness:verify` 통과
