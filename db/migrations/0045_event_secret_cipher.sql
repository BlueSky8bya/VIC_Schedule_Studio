-- 비공개 일정 본문 at-rest 암호화용 컬럼.
-- 비공개(owner_private/embargo/work) 이벤트는 평문 컬럼(public_title/public_description)에
-- 중립 플레이스홀더('비공개')만 남기고, 실제 제목·설명·private_meta는 AES-256-GCM으로
-- 암호화한 JSON을 여기에 둔다. 공개 이벤트는 평문 유지, secret_cipher = NULL.
-- 포맷: 'v1$<iv>$<tag>$<ct>' (각 파트 base64). lib/private-layer/secret-crypto.ts 참조.
--
-- 컬럼 추가라 신규 RLS 테이블 grant 불필요(events RLS 정책이 이 컬럼도 그대로 커버).
-- title 인덱스/검색/정렬 없음 → 인덱스 불필요.

alter table public.events add column if not exists secret_cipher text;

comment on column public.events.secret_cipher is
  '비공개 이벤트 본문(제목/설명/private_meta) AES-256-GCM 암호문. v1$iv$tag$ct(base64). 공개 이벤트는 NULL.';
