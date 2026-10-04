-- 0138: 가린 떡밥도 '미정' 여부는 공개 — 시청자가 미정 떡밥과 확정 떡밥을 구분한다(2026-10-05 소유자).
--
-- 0125 뷰는 공개 전 떡밥(h.hidden)의 is_tentative를 false로 덮었다. 미정은 내용이 아닌 상태값이라
-- (제목·시각·태그·카테고리·설명은 여전히 가림) 그대로 내보낸다. 서버 DTO(public-loader mapEvent)도
-- 같은 날 is_tentative를 실어 보내게 바뀌었다 — 뷰가 덮으면 그 변경이 무효였다(운영 실측 false).
-- 뷰 정의는 0125와 같고 is_tentative 한 줄만 다르다. 멱등.
-- 적용: node scripts/apply-db.mjs db/migrations/0138_public_events_tentative_teaser.sql

create or replace view public.public_schedule_events with (security_barrier=true) as
select e.id,e.calendar_id,e.date_key,e.created_at,
  case when h.hidden then null else e.end_date_key end as end_date_key,
  case when h.hidden then null else e.link_next end as link_next,
  case when h.hidden then false else e.is_support end as is_support,
  case when h.hidden then null else e.support_kind end as support_kind,
  case when h.hidden then null else e.support_url end as support_url,
  case when h.hidden then null else e.start_time end as start_time,
  case when h.hidden then null else e.end_time end as end_time,
  case when h.hidden then true else e.is_all_day end as is_all_day,
  e.is_tentative, -- (0138) 가린 떡밥도 미정 여부는 공개(상태값, 내용 아님)
  case when h.hidden then '' else e.public_title end as public_title,
  case when h.hidden then null else e.public_description end as public_description,
  e.status,e.sort_order,
  case when h.hidden then 'stream'::public.event_category else e.category end as category,
  e.teaser,e.teaser_reveal_at,
  case when h.hidden then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
    'tag_id',t.tag_id,'is_primary',t.is_primary,'sort_order',t.sort_order) order by t.sort_order)
    from public.event_tags t where t.event_id=e.id),'[]'::jsonb) end as event_tags
from public.events e join public.calendars c on c.id=e.calendar_id and c.is_public
cross join lateral (select coalesce(e.teaser,false) and e.teaser_reveal_at is not null
  and e.teaser_reveal_at>now() as hidden) h
where e.visibility_scope='public' and e.status<>'draft' and e.deleted_at is null;
revoke all on public.public_schedule_events from public,anon,authenticated;
grant select on public.public_schedule_events to anon,authenticated,service_role;
