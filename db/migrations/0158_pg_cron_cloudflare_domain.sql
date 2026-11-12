-- 0158: 호스팅을 Vercel에서 Cloudflare Workers로 옮기며 pg_cron 채팅 큐 호출 주소를 새 도메인으로 바꾼다.
-- 주기·인증·타임아웃은 0128과 같다. 새 도메인이 실제로 응답한 뒤에 적용한다(먼저 적용하면 5분마다 실패만 쌓인다).
-- 멱등. 되돌리기: 0128을 다시 적용.
select cron.unschedule('vic-vod-chat') where exists (select 1 from cron.job where jobname = 'vic-vod-chat');
select cron.schedule(
  'vic-vod-chat',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := 'https://victory-broadcast.com/api/cron/vod-chat?limit=4&chunks=120',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vic_cron_token'),
      'User-Agent', 'vic-pg-cron/1'
    ),
    timeout_milliseconds := 60000
  );
  $job$
);
notify pgrst, 'reload schema';
