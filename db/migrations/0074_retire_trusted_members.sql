-- 0074 — 신뢰 멤버(매니저) 기능 철수 (2026-09-04, ADR-0018)
--
-- 무엇: trusted_members 테이블·enum trusted_role·is_active_trusted_member() 삭제.
-- 왜: 관리자 결정("멤버 관리 기능 아예 삭제 — 개발자·관리자·시청자만 남긴다"). 적용 시점 실측: 행 0(활성 0),
--     이 테이블을 참조하는 RLS 정책 0(0005가 이미 events/meta/event_tags 정책을 is_active_worker 기반으로 교체),
--     본문에 trusted_members가 등장하는 함수는 is_active_trusted_member 하나뿐.
-- 귀속: 코드(actor 판정·인사이트·활동 로그 이메일 해석)는 같은 커밋에서 조회를 전부 뺐다 — 옛 코드가 남아 있어도
--       조회 오류를 삼켜(false / 빈 목록) 화면은 깨지지 않는다.
-- 되돌리기: git 이력(이 마이그레이션 직전 커밋)의 0001·0022·0065 정의로 테이블·enum·함수를 새 마이그레이션에
--          재생성. 데이터는 없었다(행 0). is_active_worker()는 정책이 참조하므로 항상-false 스텁 그대로 둔다.

drop policy if exists "owners can manage trusted members" on public.trusted_members;
drop function if exists public.is_active_trusted_member(uuid);
drop table if exists public.trusted_members cascade;
drop type if exists public.trusted_role;
