-- 0061: 방문 = '탭 수명'으로 재정의 (PLAN-20260804-003 Phase A)
--
-- 배경: visit_session 1행 = '화면이 보인 한 구간'이다. 그런데 문서 네비게이션(pagehide)마다
-- 구간이 끊기므로 사이트 안에서 페이지를 옮길 때마다 새 행이 생긴다. 실측(2026-08-04 04:11~04:20,
-- owner 단독)에서 공백 0의 연속 9분 1회 방문이 4행(4초/5분/7초/4분)으로 찍혔다. 결과:
--   1) 방문수가 '많이 돌아다니는 역할'일수록 부풀어 역할 간 비교가 오염된다(스튜디오는 / ↔ /studio
--      layout이 달라 이동마다 끊기고, 잠금해제는 하드 리로드까지 한다).
--   2) 평균 체류가 1/4로 과소 집계된다(9분 → 2.25분).
--
-- visit_key = 브라우저 sessionStorage 값. sessionStorage는 '탭 수명'과 정확히 일치한다:
--   사이트 내 문서 이동·하드 리로드·탭 숨김/복귀 → 유지(같은 방문)
--   탭 닫기·새 탭 → 소멸(새 방문)
-- 시간 gap 휴리스틱(30분 등 임의 임계값)이 필요 없다. 탭을 켜둔 채 KST 자정을 넘기면 비콘이
-- 세션과 함께 visit_key도 재발급한다(day가 start 시점에 박히므로 일별 집계가 깨지지 않게).
--
-- 클라이언트 값이라 위조 가능하지만, 이 컬럼은 '같은 탭의 구간들을 잇는 그룹 키'일 뿐 권한·집계
-- 신뢰의 근거가 아니다(역할·계정은 서버가 actor로 재확인). null이면 옛 행 = 지금처럼 1행 1방문.
--
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0061_visit_key.sql

alter table public.visit_session add column if not exists visit_key text;

-- 방문 재구성은 (날짜 → 탭) 순으로 훑는다. 옛 행(null)은 인덱스에서 빼 크기를 줄인다.
create index if not exists visit_session_visit_key_idx
  on public.visit_session (day, visit_key)
  where visit_key is not null;

comment on column public.visit_session.visit_key is
  '브라우저 탭 수명 식별자(sessionStorage). 같은 탭에서 쪼개진 구간들을 한 방문으로 잇는 그룹 키. null=옛 행.';

-- visit_session은 0033/0035 기준 그대로: RLS deny-all + service_role 전용(추가 grant 불필요).
