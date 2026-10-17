# Broadcast work bounds — PLAN080

Updated: 2026-10-17 KST

Scope: backend 수집·파생 검색·개발자 현재 접속 집계. 아래 동작 검사는 synthetic fixture와 격리 WASM PostgreSQL이다. root가 뒤에 수행한 운영 DDL 적용은 별도로 기록한다. 실제 로그인 RLS·비용 개선을 증명하지 않는다.

## 변경

- `/api/soop-live` 동시 cache miss를 프로세스 안에서 합친다. cache TTL은 SOOP 응답 완료 뒤부터 20초. live tick과 수집 작업을 `after()` 한 소유자에 붙였다. 같은 프로세스 timeline/archive 작업도 single-flight. 오류/성공 모두 `finally`로 점유를 해제한다. 서로 다른 서버 인스턴스를 하나로 합치는 기능은 아니다.
- `WorkBudget`은 `performance.now()` 단일 deadline. poll은 50초, viewer source fetch는 8초 상한 뒤 background 50초, chat route는 인증부터 50초. chat collector는 부모 잔여 시간과 기존 35초 중 작은 값. DB/외부 HTTP에 잔여 시간 이하 abort signal을 전달한다. 네트워크 취소가 이미 시작된 PostgreSQL 문장의 즉시 중단이나 서버 실행 시간의 절대 상한을 보장하지는 않는다.
- `vod_timeline_project()`의 실제 공개 projection 변경 때만 UPDATE 및 `timeline-search` dirty revision 증가. 수집과 moderation이 이 공통 지점을 사용한다. 기존 bool `vod_timeline_ingest()` 계약·moderation 선택·VOD별 advisory lock·stale fetch 거절을 유지하고 별도 `{accepted,changed}` RPC를 더했다.
- 동일 댓글 재수집은 5개 전역 검색 계산을 다시 하지 않는다. dirty revision이 남으면 댓글 갱신 주기와 무관하게 재시도한다. 계산/한글 읽기 동의어 실패·deadline 종료는 dirty를 남긴다. 전 과정 성공 뒤 읽었던 revision만 ack하므로 더 새 변경을 지우지 않는다. 기존 숫자 동의어 API는 보존했다.
- graph 성공 마커는 term rebuild 뒤 실제 관계 표 swap 성공에만 기록한다. 오늘(KST) graph 성공과 trends 성공을 모두 확인해야 재시도를 생략한다. trend 성공으로 graph 실패를 가리지 않고 반대 실패도 재시도한다. 야간 작업 중복은 transaction advisory try-lock으로 막는다.
- 전체 VOD sweep은 호출당 최대 8페이지, 페이지 상한 500·행 상한 10,000·checkpoint 8MiB. CAS revision에 다음 페이지와 현재 source snapshot을 저장한다. 실패·불완전 목록은 완료/삭제로 해석하지 않는다. 24시간 지난 snapshot은 **다음 수집 호출에서** 새로 시작한다(예약 삭제 TTL은 아님).
- 완전한 scan만 단일 RPC transaction으로 upsert와 기존 소량 삭제 정책을 적용한다. guest와 sweep 시작 뒤 갱신된 행은 보존한다. 삭제 후보가 20개 초과면 삭제하지 않는다. 완료 snapshot은 비운다. migration 자체는 source row를 정리하지 않는다.
- 개발자 현재 접속 API: 8개 HEAD count → 1개 aggregate RPC. 기존 developer-only/roleUncertain 거절, private/no-store, 90초·KST 날짜 경계, 명시적인 count DTO 유지. RPC/table 모두 anon/authenticated 권한 없음.

## 격리 검증

`node tests/sql/broadcast-work-bounds.mjs .scratch-pw/timeline-db/node_modules/@electric-sql/pglite/dist/index.js` PASS.

실제 SQL 실행으로 migration 멱등, 동일 projection/candidate 물리 UPDATE 없음, bool 호환·moderation 뒤 dirty 증가·stale snapshot, graph 실패+trend 성공/반대 실패/swap false 재시도, 불완전 sweep 완료 거절, CAS 충돌, guest·동시 새 행 보존, KST 자정 aggregate/미래·종료·stale·잘못된 role 제외, synthetic 민감 canary 비반환, anon/authenticated RPC·table 거절 및 service grant, rollback 함수 복원을 확인했다.

관련 unit 8 suite 83개 PASS: `broadcast-work-bounds`, `vod-timeline-sync`, `vod-timeline-callers`, `vod-chat-recovery`, `vod-archive`, `cron-auth`, `live-presence-route`, `search-xlit`. 여기에는 source 완료 TTL, concurrent miss/sweep 합치기, rejected single-flight 재시도, 8페이지 재개, HTTP/shape/CAS 실패 시 미완료 유지, 소비된 부모 deadline 재연장 금지, unchanged ingest 계산 생략, dirty/xlit 실패 보존을 포함한다. 기존 chat 재점검 fixture는 2026-09-28부터 제품에 적용된 3일/365일 정책으로 맞췄고 제품 정책은 바꾸지 않았다.

관련 scoped ESLint PASS. TypeScript `tsc --noEmit` PASS(후속 소규모 검증 보강 전 실행; 최종 통합 typecheck/build는 root가 담당).

## 적용 순서·되돌리기

1. root가 `0151_broadcast_work_bounds.sql`과 테스트·권한을 독립 검토한다.
2. root가 2026-10-17 10:25KST에 검증 TLS로 additive migration을 적용했다. application reader보다 먼저 필요하다. 적용 파일 SHA256 `4871f2599a1501306dbf0b415f4ceb292a1c0e43ff32661452d2c16a5d708301`. 기존 함수 정의를 제한된 로컬 백업으로 보존했다. pg_cron 설정 불변·초기 메타데이터0행·새 table/RPC의 anon/authenticated 거절과 service_role 권한을 카탈로그에서 확인했다. migration 자체는 운영 source 행 삭제/정리나 cron 실행을 하지 않았다. 최종 앱 배포는 [통합 기록](PLATFORM_REMEDIATION-20261017.md)을 따른다.
3. 코드 배포 후 집계 공개 경계와 수집의 accepted/dirty/checkpoint 전이를 aggregate로 확인한다. source 원문/인증 식별자는 로그에 남기지 않는다.
4. rollback은 이전 application부터 배포한 뒤 `ROLLBACK-0151-broadcast-work.sql`의 함수 정의만 적용한다. 과거 migration 전체를 재실행하면 data DELETE/backfill/cron 변경이 섞이므로 금지. additive checkpoint/table/RPC는 in-flight 종료 확인 전 보존한다.

## 남는 한계

- Redis·분산 compute lease는 추가하지 않았다. 프로세스 밖 중복 source fetch/파생 계산은 가능하고 DB revision·advisory lock이 stale publication을 막는다. 실제 invocation/CPU/timeout 감소량은 배포 후 같은 기간·분모로 측정해야 한다.
- SOOP 비공식 응답 계약은 바뀔 수 있다. live 조회의 기존 실패→offline DTO 계약은 유지한다. 수집 source 오류는 기존 공개 데이터를 보존한다.
- 500페이지/10,000행/8MiB 한계를 넘는 archive는 완료로 처리하지 않는다. 규모가 커지면 streaming stage 확장 검토가 필요하다.
- 현재 graph 내부 SQL 자체의 작업량은 줄이지 않았다. 성공 마커와 중복/불필요 실행 감소가 이번 범위다.
