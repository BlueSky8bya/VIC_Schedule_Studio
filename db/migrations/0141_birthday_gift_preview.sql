-- 0141: 생일 선물(카드·캡슐 뽑기) 미리보기 스위치(2026-10-06 소유자).
--
-- 개발자 설정의 토글 하나 — 켜면 관리자(owner)도 편집실의 시청자 화면 미리보기에서 생일 선물 카드와
-- 캡슐 뽑기 창을 보고, 뽑기는 생일 당일이 아니어도 열 수 있다. 꺼져 있으면(기본) 생일 카드는 개발자만,
-- 뽑기는 생일 당일에만. 시청자 화면(/)에는 어느 경우에도 생일 노래만(공개 응답에 이 열을 싣지 않는다 —
-- public-loader는 열 이름을 골라 읽는다).
-- 쓰기: setBirthdayGiftPreviewAction(개발자만, service_role). 읽기: studio-loader(로그인 사용자).
-- 되돌리기: alter table public.calendars drop column birthday_gift_preview;
-- 적용: node scripts/apply-db.mjs db/migrations/0141_birthday_gift_preview.sql

alter table public.calendars add column if not exists birthday_gift_preview boolean not null default false;
