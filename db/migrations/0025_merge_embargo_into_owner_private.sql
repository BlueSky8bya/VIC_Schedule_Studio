-- "엠바고"와 "나만"은 의미가 비공개로 중복돼 하나로 통합한다 → 소유자 전용 owner_private("엠바고").
-- 기존 embargo 일정을 owner_private로 옮겨(소유자만 보게 됨 = 의도한 통합) "엠바고"로 합친다. 멱등.
update public.events
set visibility_scope = 'owner_private', updated_at = now()
where visibility_scope = 'embargo';
