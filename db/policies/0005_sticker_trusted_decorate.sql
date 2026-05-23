-- 꾸미기(스티커 인스턴스)는 신뢰 멤버(매니저·작업자)도 추가/이동/삭제할 수 있게 한다.
-- is_active_trusted_member()는 owner/developer(=is_calendar_admin)와 활성 신뢰 멤버를 모두 포함한다.
-- 주의: 일정·태그·멤버·private_layer·스티커 에셋(이미지 업로드)은 여전히 owner/developer 전용.
--       이 정책은 오직 sticker_instances(이모지 스티커 배치)에만 적용된다.
drop policy if exists "owners can manage sticker instances" on public.sticker_instances;

create policy "trusted members can manage sticker instances"
on public.sticker_instances for all
using (public.is_active_trusted_member(calendar_id))
with check (public.is_active_trusted_member(calendar_id));
