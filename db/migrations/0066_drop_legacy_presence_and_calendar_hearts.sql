-- 0066: 죽은 프레즌스·하트 레거시 객체 정리 (2026-08-27, 코드 소비자 0 — 에이전트 감사 CHG-20260827-003)
--
-- 대상(모두 현재 코드가 읽지도 쓰지도 않는다):
--   · visit_log(0023)          — 방문 로그 1세대. 0035 visit_session으로 대체(24행, 백업됨).
--   · presence_ping(0024)      — 60초 하트비트 1세대 + presence_hourly/peak/active_days(0024/0025).
--                                visit_session의 start/touch/end 세션 모델로 대체(1,120행, 백업됨).
--   · owner_sessions(0027)     — 관리자 세션 집계 함수(인사이트가 visit_session을 직접 읽는다).
--   · calendar_hearts(0011)    — 달력 단위 하트 카운터 + add_calendar_heart(). 일정별 event_hearts(A)로
--                                대체됐고 공개 로더의 select도 이번에 제거(0행).
-- 백업: docs/agent/backups/2026-08-27_legacy-presence.json (visit_log·presence_ping 전 행).
-- 롤백: 위 마이그레이션 파일을 다시 적용하면 빈 객체가 되살아난다(데이터는 백업 JSON).
-- 멱등: 전부 if exists.

begin;

drop function if exists public.presence_hourly(date, date);
drop function if exists public.presence_peak(date, date);
drop function if exists public.presence_active_days(date, date);
drop function if exists public.owner_sessions(date, date);
drop function if exists public.add_calendar_heart(uuid);

drop table if exists public.presence_ping cascade;
drop table if exists public.visit_log cascade;
drop table if exists public.calendar_hearts cascade;

commit;
