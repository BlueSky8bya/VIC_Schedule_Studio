# Active ExecPlan

Plan ID: PLAN-20260804-003
Status: In Progress
Task Risk: L2 (구조적 — 새 테이블 2건, 지표 정의 변경, 개인정보 방침 supersede)
Created / Updated: 2026-08-04

## Objective

방문 지표를 "행동을 재구성할 수 있는" 수준으로 올린다. 두 덩어리.

- **A. 방문 집계 정정** — 지금 방문수가 라우팅 구조에 오염돼 있다(문서 네비게이션마다 세션이
  쪼개져 4초짜리 유령 방문이 생기고, 평균 체류가 1/4로 과소 집계). 방문 = **탭 수명**으로 재정의.
- **B. 행동 기록(`activity_event`)** — 어느 화면·어느 일정·무엇을 수정했는지 남겨 세션을
  타임라인으로 재구성. 목적은 감시가 아니라 니즈 파악.

## 발단 (2026-08-04 실측)

배포 `13c9d40`(03:19) 직후 04:11–04:20 owner 단독 방문. 패널에 4행(4초/5분/7초/4분)으로
찍혔으나 실제로는 **공백 0의 연속 9분 1회 방문**이었다. 4초·7초 행은 이탈이 아니라
`pagehide`(문서 네비게이션)로 끊긴 자리. 무엇을 봤는지는 어떤 테이블에도 없었다.

## 확정 결정 (사용자, 2026-08-04)

1. **방문 = 탭 수명.** 탭 닫았다 다시 오면 새 방문. 시간 gap 휴리스틱 안 씀.
2. **추적 범위 = 내부자만 식별.** owner/manager/worker는 계정 단위 타임라인,
   viewer/익명은 **집계만**(개인 타임라인 없음).
3. **좌표·스크롤 깊이 미수집.** 볼륨 대비 해석 이득 없음.
4. **보존 90일.**
5. 실시간 프레즌스는 `visible` 플래그를 실어 **"화면에 떠 있음 / 탭만 열림" 2열**로 분리.

## 원칙 / 불가침

- `activity_event.meta`에 **일정 제목·본문을 넣지 않는다.** `event_id`만 저장하고 제목은
  읽는 시점에 권한 검사 후 조인. 안 그러면 이 테이블이 owner_private 우회 경로가 되어
  비공개 본문 AES-256-GCM 암호화(2026-06-17)가 무의미해진다. **이 설계의 최우선 제약.**
- 계정 식별은 기존 `accountHashOf(email)` 결정적 해시(`actions.ts:127`)를 재사용 —
  아는 이메일을 정방향 해싱해 대조. **이메일 원문·user_id는 계속 저장하지 않는다.**
- 새 테이블은 RLS deny-all + `service_role` DML grant를 **같은 마이그레이션에** 넣는다
  (0035·0043에서 두 번 당한 grant 누락 함정).
- 쓰기 로그는 서버 액션 안에서(진실), 열람 로그는 클라에서(의도). 둘을 `source`로 구분.
- 클릭마다 요청 금지 — 배치 flush(20개 / 5초 유휴 / hidden / pagehide, keepalive).

## 단계

### Phase A — 방문 집계 정정
- [ ] A1. `0061_visit_key.sql` — `visit_session.visit_key text` + 인덱스
- [ ] A2. `presence-beacon` — sessionStorage `visit_key` 발급, KST 자정 롤오버 시 재발급
- [ ] A3. `/api/presence` + `startVisitSession(device, anonId, visitKey)`
- [ ] A4. 집계 — 같은 계정 + 구간 겹치면 1방문, 체류는 구간 **union**(창 2개 이중계상 방지)
- [ ] A5. `presence-client` — `track({role, device, visible})` + `visibilitychange` 재track
- [ ] A6. 실시간 패널 2열("화면에 떠 있음 / 탭만 열림")
- [ ] A7. 죽은 코드 참조 정리(`presence_ping`·`owner_sessions`·`presence_hourly`·`presence_peak`).
      **테이블 DROP은 하지 않는다**(되돌리기 비쌈) — 코드 참조만.

### Phase B — 행동 기록
- [ ] B1. `0062_activity_event.sql` (+ grants 동일 파일)
- [ ] B2. `lib/activity/` — 서버 record 헬퍼 + 클라 버퍼
- [ ] B3. `/api/activity` 배치 수신
- [ ] B4. 서버 훅 — event/sticker/tag/support/unlock/heart/hope 액션
- [ ] B5. 클라 이벤트 — route/month/event.open/filter/export/zoom
- [ ] B6. 재구성 패널(계정 + 날짜 → 타임라인)
- [ ] B7. 90일 보존 청소(조회 시 지나가며 — unlock_attempts 패턴)
- [ ] B8. ADR — "익명 지표 → 내부자 계정 단위 행동 기록" supersede

## 검증

- `tsc --noEmit` · `npm run lint` · `next build` **exit code 확인**(tail만 보지 말 것)
- 공개 경계: `app/api/public/*` 응답에 신규 필드 0. `activity_event`는 개발자 패널 전용
- 역할별: viewer/익명은 개인 타임라인이 패널에 **안 뜨는지** 실측
- 회귀: 방문수·체류 변경은 과거 수치와 직접 비교 불가 — 패널에 기준 변경일 표기
