# Domain Rule — DESTRUCTIVE_DATA (마이그레이션 · 파괴적 작업)

적용 경로: `db/migrations/**` · `scripts/**`(apply-db, 백필, recolor 등) · 프로덕션 데이터에 닿는 모든 것

## 마이그레이션 절차

1. SQL은 **멱등**하게(`if not exists`, `create or replace`, 백필은 조건부).
2. RLS 테이블을 새로 만들면 **`grant` 파일을 함께**(`*_grants.sql`). 안 주면 service_role 쓰기가
   `permission denied(42501)`로 **조용히** 실패한다. (0035·0043에서 두 번 당했다.)
3. 파일 상단 주석에 **무엇을·왜·귀속 규칙·되돌리는 법**을 적는다.
4. 적용: `node scripts/apply-db.mjs db/migrations/<file>.sql` (읽기: `.env.local`).
   결과(성공/실패)를 **그대로** 보고한다.
5. 코드 배포와 스키마 적용의 **순서**를 명시한다(특히 암호화·NOT NULL·컬럼 삭제).

## 파괴적 작업(삭제·변환·비가역) 전 체크

- [ ] 영향 행 수를 먼저 센다(`select count(*)` — 실행 전에)
- [ ] 되돌릴 수 있는가? 없으면 **사용자 명시 승인** 없이는 실행하지 않는다
- [ ] 가능하면 dry-run 또는 되돌릴 수 있는 형태(soft delete / 새 컬럼)로 바꾼다
- [ ] 되돌리기 경로(반대 SQL, 백업, 보상 액션)를 커밋 메시지에 적는다

## 절대 하지 않는 것 (명시 승인 없이)

- `git reset --hard` · `git clean -fd` · force push · 사용자 uncommitted 변경 덮어쓰기
- 프로덕션 데이터 삭제/대량 UPDATE
- `PRIVATE_DATA_ENC_KEY` 회전·삭제 (분실 = 비공개 본문 영구 복구 불가)
- 컬럼/테이블 DROP (먼저 사용 중단 → 관찰 → 그 다음 제거)

## 현재 알려진 함정

- Supabase select는 기본 **1000행에서 잘린다** — 광역 조회는 `fetchAllRows` 페이지네이션.
- 방송 세션·방문 로그는 RLS deny-all이다. 공개로 열려면 집계 RPC만(ADR-0008).
