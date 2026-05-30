-- 방문 집계를 '계정 단위'로 바꾸기 위한 익명 계정 해시.
-- account_hash = sha256(salt + 정규화 이메일)을 잘라낸 값 — 단방향(복원 불가).
-- 이메일·user_id 원문은 여전히 저장하지 않는다(개인정보 비저장 원칙 유지). 같은 계정을
-- 하루 단위로 셀 수 있는 익명 식별자일 뿐이다.
--
-- 유니크 (day, account_hash, device): 같은 계정이 같은 날 같은 기기로 여러 번 들어와도 1줄.
--   → "방문수"는 (day, account_hash) 고유 개수 = 계정당 하루 1.
--   → "기기별"은 (day, account_hash, device) 줄 수 = 계정×기기(한 계정이 웹·iOS면 둘 다 1).
-- Postgres는 유니크 인덱스에서 NULL을 서로 '다른 값'으로 취급하므로(NULLS DISTINCT, 기본값),
-- account_hash가 없는 옛 행(이 마이그레이션 이전)은 충돌 없이 여러 줄로 그대로 공존한다.
-- 부분 인덱스(WHERE account_hash IS NOT NULL)는 ON CONFLICT 추론 대상이 못 되므로 일반 인덱스로 둔다.

alter table public.visit_log add column if not exists account_hash text;

create unique index if not exists visit_log_day_account_device_uidx
  on public.visit_log (day, account_hash, device);
