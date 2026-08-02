-- 0059: 방송 세션 시각 보정 재시도 플래그 — 머리/꼬리 손실 재발 방지.
--
-- 배경(2026-08-02 실제 발생): 4시간 방송(16:00:23~20:00:47)이 3시간 44분으로 과소집계됐다.
--   머리 손실 ~10분: 세션 insert 순간 방송국 API(fetchSoopBroadStart)가 실패해 started_at이
--     '첫 시청자 폴링 시각'(16:10)으로 굳었다. insert 때 이미 bno를 알고 있어서, 기존의
--     "bno를 처음 알게 된 순간 머리 보정" 분기는 이후 영영 타지 않는다 — 보정 기회가 딱 한 번.
--   꼬리 손실 ~7분: 오프라인 감지 순간 VOD가 아직 등록 전이라(방종 후 몇 분 걸림) 보수적으로
--     last_live_at(19:53)에서 닫고 끝. 그 경로는 재시도가 없다.
--
-- 해결: 보정 성공 여부를 플래그로 남겨, 실패했으면 이후 폴링에서 계속 재시도한다.
--   start_verified — started_at이 방송국 API의 실제 시작시각(broad_start) 또는 VOD 역산값으로
--     확정됨. false인 동안 라이브 tick마다 재시도.
--   vod_verified — ended_at이 VOD(reg_date/길이)로 확정됨. false인 동안, 닫힌 직후의
--     오프라인 tick에서 재시도(방종 몇 분 뒤 VOD가 올라오면 그때 꼬리를 복구).
alter table public.broadcast_session
  add column if not exists start_verified boolean not null default false,
  add column if not exists vod_verified boolean not null default false;

comment on column public.broadcast_session.start_verified is
  '시작시각이 방송국 API(broad_start)/VOD 정답값으로 확정됨. false면 라이브 tick마다 재보정 시도.';
comment on column public.broadcast_session.vod_verified is
  '종료시각이 VOD 정답값으로 확정됨. false면 닫힌 뒤에도 오프라인 tick에서 재보정 시도.';
