-- 커스텀 이모지(이미지) 업로드: Supabase Storage 버킷 + 정책 + sticker_assets 신뢰멤버 관리.
-- 업로드/삭제는 소유자·개발자·매니저·작업자(활성 신뢰멤버), 읽기는 공개.

-- vic 캘린더의 활성 신뢰멤버인지 (slug 고정 헬퍼 — storage 정책에서 calendar_id 없이 쓰려고).
-- security definer라 내부 서브쿼리는 RLS를 우회해 calendars/ trusted_members를 읽는다.
create or replace function public.can_decorate_vic()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_trusted_member((select id from public.calendars where slug = 'vic'));
$$;

-- 공개 읽기 버킷
insert into storage.buckets (id, name, public)
values ('sticker-assets', 'sticker-assets', true)
on conflict (id) do update set public = true;

-- Storage 객체 정책: 읽기는 누구나, 쓰기는 신뢰멤버만
drop policy if exists "sticker assets read" on storage.objects;
create policy "sticker assets read" on storage.objects
for select using (bucket_id = 'sticker-assets');

drop policy if exists "sticker assets insert" on storage.objects;
create policy "sticker assets insert" on storage.objects
for insert with check (bucket_id = 'sticker-assets' and public.can_decorate_vic());

drop policy if exists "sticker assets update" on storage.objects;
create policy "sticker assets update" on storage.objects
for update using (bucket_id = 'sticker-assets' and public.can_decorate_vic())
with check (bucket_id = 'sticker-assets' and public.can_decorate_vic());

drop policy if exists "sticker assets delete" on storage.objects;
create policy "sticker assets delete" on storage.objects
for delete using (bucket_id = 'sticker-assets' and public.can_decorate_vic());

-- sticker_assets 테이블: 신뢰멤버도 관리(업로드/삭제). 읽기는 기존 "public can read sticker assets" 유지.
drop policy if exists "owners can manage sticker assets" on public.sticker_assets;
create policy "trusted members can manage sticker assets"
on public.sticker_assets for all
using (public.is_active_trusted_member(calendar_id))
with check (public.is_active_trusted_member(calendar_id));
