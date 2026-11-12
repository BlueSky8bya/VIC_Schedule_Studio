-- 0161 뒤에 따로 실행: 비운 vod_chat_job 상태(TOAST)의 디스크 공간을 실제로 돌려준다. 465행이라 잠금은 순간이다.
-- VACUUM은 트랜잭션 안에서 못 돌아서 마이그레이션과 나눴다(한 파일 = 한 문장).
vacuum (full, analyze) public.vod_chat_job;
