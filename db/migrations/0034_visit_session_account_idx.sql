-- R12(새 방문자 vs 재방문자)용 — 계정 해시로 '이전에 본 적 있는지' 조회를 빠르게.
create index if not exists visit_session_account_idx on public.visit_session (account_hash);
