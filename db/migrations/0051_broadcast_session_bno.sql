-- 0051: 방송 세션에 SOOP 방송번호(bno)를 기록 — 세션 연속성 판정의 '정답값'.
--
-- 배경(버그, 2026-07-22~23 실제 발생): 세션을 잇거나 쪼개는 판정을 '시청자 폴링 간격'으로만 했다.
--   새벽·무관중 구간엔 시청자 폴링이 4시간(SESSION_GAP_MS) 넘게 비고, 백업 cron도 Hobby 요금제라
--   하루 1회(03:00 KST)뿐이라 표본이 성기다. 그 결과 하나의 연속 방송이 폴링 공백을 만나 두 세션으로
--   쪼개졌고, 뒷부분이 '새 방송'으로 다음날에 잘못 귀속됐으며(start_day 오귀속), 공백 구간 시간은
--   통째로 손실됐다(과소집계 + 총량 오류).
--
-- SOOP의 BNO(방송번호)는 '한 번의 연속 방송' 동안 불변이고, 방송을 새로 켜면 바뀐다. 즉 방송 정체성의
--   정답값이다. 이 컬럼을 세션에 남겨, 폴링이 아무리 비어도 bno가 같으면 같은 방송으로 이어 붙이고
--   (공백 시간도 라이브로 인정 — 같은 bno면 그 사이 계속 방송 중이었다는 뜻), bno가 다를 때만 쪼갠다.
--   → 폴링 간격에 의존하던 오귀속/손실을 원천 차단(재발 방지). bno를 모르는 레거시 행/조회 실패 시에만
--   예전 간격 휴리스틱으로 폴백.
alter table public.broadcast_session
  add column if not exists bno text;

-- 열린 세션(진행 중)을 bno로 빠르게 찾기 위한 보조 인덱스.
create index if not exists broadcast_session_open_bno_idx
  on public.broadcast_session (ended_at, bno);

comment on column public.broadcast_session.bno is
  'SOOP 방송번호 — 연속 방송 내내 불변. 세션 연속성(잇기/쪼개기) 판정의 정답값(폴링 간격 대신).';
