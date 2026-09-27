-- 다시보기 채팅 수집을 DB가 직접 5분마다 깨운다(2026-09-27).
-- 왜: GitHub Actions 스케줄(30분)은 실측 36시간에 12번만 돌았고(플랫폼 스로틀), Vercel Hobby 크론은 하루 1회,
--     cron-job.org는 사용자 계정이라 코드가 못 만진다. pg_cron은 정각에 돌고 pg_net으로 HTTP를 쏠 수 있다.
-- 열쇠: Vault에 토큰 하나(`vic_cron_token`)를 DB가 만들어 두고, 라우트는 서비스 롤 RPC(cron_token_matches)로
--     비교한다. CRON_SECRET(Vercel env)은 그대로 살아 있다 — 바깥 트리거(Actions·cron-job.org)는 계속 그 길.
-- 안전: 토큰은 vault.decrypted_secrets에서만 읽힌다(postgres/서비스 롤). anon·authenticated는 함수 실행 불가.
-- 멱등. 되돌리기: select cron.unschedule('vic-vod-chat'); drop function public.cron_token_matches(text);
--        (토큰 삭제: delete from vault.secrets where name='vic_cron_token')
create extension if not exists pg_net with schema extensions;

-- 토큰이 없을 때만 만든다(재적용해도 바뀌지 않는다 — 바뀌면 이미 도는 잡의 헤더와 어긋난다).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'vic_cron_token') then
    perform vault.create_secret(encode(gen_random_bytes(24), 'hex'), 'vic_cron_token',
      'pg_cron -> Vercel /api/cron/* Bearer token (0128)');
  end if;
end $$;

create or replace function public.cron_token_matches(p_token text)
returns boolean
language sql security definer set search_path = public, vault as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'vic_cron_token' and decrypted_secret = p_token
  );
$$;
revoke all on function public.cron_token_matches(text) from public, anon, authenticated;
grant execute on function public.cron_token_matches(text) to service_role;

-- 5분마다 채팅 큐 한 조각. 응답은 net._http_response에 남아 status 확인이 된다.
-- timeout 60초 = 라우트 maxDuration과 같다(기본 5초면 클라이언트가 먼저 끊긴다).
select cron.unschedule('vic-vod-chat') where exists (select 1 from cron.job where jobname = 'vic-vod-chat');
select cron.schedule(
  'vic-vod-chat',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := 'https://vic-schedule-studio.vercel.app/api/cron/vod-chat?limit=4&chunks=120',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vic_cron_token'),
      'User-Agent', 'vic-pg-cron/1'
    ),
    timeout_milliseconds := 60000
  );
  $job$
);
notify pgrst, 'reload schema';
