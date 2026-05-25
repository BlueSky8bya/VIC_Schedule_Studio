-- B: 공개 메모를 줄별로(가로 정렬·들여쓰기 단계) 저장한다.
-- 형태: [{ "text": string, "align": "left"|"center"|"right", "indent": number }]
-- 없으면(null) 기존 public_memo 줄바꿈을 폴백으로 쓴다.
alter table public.calendars
  add column if not exists public_memo_lines jsonb;
