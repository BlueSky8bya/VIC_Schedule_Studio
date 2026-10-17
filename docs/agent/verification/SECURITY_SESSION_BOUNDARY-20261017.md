# 로그인·이용기록·최초공개 경계 검증

Updated: 2026-10-17 KST
Status: 합성 경계·통합 production build 검증 완료. 운영 배포 확인 대기.
Scope: 실제 서버 actor/로그아웃 route/이용기록 reader·writer, 익명 HTTP, 격리 PostgreSQL. 기존 Chrome 개발자 세션의 운영 집계 API 허용도 한 경로 확인했다. Google 로그인 절차·모든 역할/운영 RLS 전체 검증은 아니다.

## 확인한 권한과 과거 증거

- `lib/auth/actor.ts:34`: 서버의 검증된 사용자와 Google provider를 확인하고 owner 설정→platform_admins→viewer 순으로 판정한다. 사용자가 쓰는 metadata의 역할 값은 권한 근거가 아니다. 개발자 조회 오류/설정 부재는 최소 권한과 `roleUncertain`으로 처리한다.
- `lib/activity/query.ts:86`, `:349`: 행동 타임라인/사용량은 developer 전용이다. owner도 읽을 수 없다. `lib/auth/fixture-dev.ts:5`의 fixture 예외는 production에서 무시된다.
- `app/api/developer/presence/route.ts:13`: 미인증401, developer 이외/불확정 역할403. 비공개 no-store와 Cookie 구분을 유지한다.
- [2026-09-21 개인정보 감사](PRIVACY-20260921.md): 익명 실제 REST 거절과 격리 SQL 역할 검증이 있다. 당시 실제 미래 teaser가 없어 공개 전 제목은 격리 canary로 확인했다. genuine OAuth·권한 만료/철회·다른 기기 검증은 남아 있다.
- [0142 적용 기록](TEASER_PREMIERE-20261014.md): 실제 DB의 익명/비권한 authenticated 역할로 과거 fixture 날짜의 합성 행을 transaction 안에서 검증한 뒤 rollback·잔여0을 확인했다. 서비스 역할의 앱 동작 검사나 SQL 역할 설정은 실제 사람의 Google 로그인 증거가 아니다.
- [078 이용기록 검사](ACTIVITY_COVERAGE-20261017.md): 합성 actor/모의 DB로 내부자 행과 시청자 집계, 개발자 외 읽기 거절을 확인했다. 운영 로그인 세션의 증명으로 확대하지 않는다.

## 발견·수정: 로그아웃 실패가 성공처럼 보이던 경로

기존 logout route는 `signOut({scope:"local"})`의 반환 error를 무시하고303으로 이동했다. 설치된 Auth SDK는 local scope에서도 Auth 서버를 호출하며,503 등 실패 때 세션 제거 전에 error를 반환한다. 메모리 저장소와 합성 fetch503으로 실제 설치 SDK를 실행해 error와 세션 잔존을 확인했다. 실제 네트워크 요청0이었다. `.scratch-pw/security-082-logout-sdk-repro.mjs`.

`app/api/auth/logout/route.ts:10`–`:20`: Auth client 부재·반환 error·예외는 고정된 `logout_unavailable`/503으로 명시한다. 성공만 기존 local scope/303→`/`를 유지한다. 두 결과 모두 private/no-store와 Vary Cookie를 사용한다. 강제 쿠키 삭제, 다른 기기 폐기, 권한 조작은 추가하지 않았다. 실패하면 기존 세션이 남을 수 있으며 이를 성공으로 보고하지 않는다.

신규 `tests/unit/security-session-boundary.test.ts:143`의3개 회귀는 수정 전 반환 error/설정 부재의303, 예외 전파로 실패했다. 수정 후 통과했다. 성공 경로에서는 합성 Auth 상태를 로그아웃으로 바꾼 뒤 서버 actor가 anonymous viewer로 판정하고, 뒤늦은 클라이언트 행동은 신원 없는 anon 집계로만 저장되는 것을 검사한다. 실제 브라우저 쿠키 폐기·JWT 만료/철회는 이 모의 검사의 대상이 아니다.

## 새 검증 결과

| 층 | 실행과 결과 | 증거의 한계 |
|---|---|---|
| 신규 서버 권한 unit |14/14 PASS. 실제 actor/route/reader/writer; owner·viewer·anon 읽기 거절, 유효 developer 허용, 비Google 승격 거절, 판정 오류 닫힘, production fixture 우회 거절, 로그아웃 실패/후속 anon 분리 | Auth·DB는 합성. fetch는 실패하도록 막음 |
| 관련 unit 전체 |6파일55/55 PASS. 위14개와 activity pipeline, teaser state loader/route, public boundary/DTO 포함 | 운영 OAuth/RLS가 아닌 함수·DTO 계약 |
| 현재 projection SQL |기존 `tests/sql/privacy-boundary.mjs`의0125 단언을 보존하고0138/0142를 각각2회 적용. anon/viewer/developer/owner projection, private·draft·deleted·비공개 calendar 제외, 가림·DB now 공개·허용 필드·쓰기 거절 PASS | 자격증명 없는 PGlite. 역할 보조 함수는 합성 |
| 실제 로컬 HTTP |기존 production build `Zs5cIlJvmS3fdbVqFDS9u`/3100의6/6 PASS. masked1개/4개 및 signedIn UI fixture의 전체 HTML+RSC에서 합성 제목 부재. 공개 샘플 제목/대상id 존재로 빈 응답 아님을 확인. fixture JSON 가림/공개 positive control과 익명 developer401/no-store 확인 | signedIn은 UI prop, 실제 로그인 아님. fixture는 이미 가린 DTO 사용. 새 logout 수정이 포함된 빌드는 아님 |
| 정적 검사 |변경 route/신규 unit/SQL test ESLint와 diff whitespace PASS | 전체 typecheck/build/배포는 root 통합 결과로 갱신 |

HTTP는 쿠키·Authorization 없이 GET만 사용했다. 사용자 세션·운영 일정·설정·분석 데이터를 추가/수정하지 않았다. fixture GET은 샘플만 사용한다. 익명 developer 경로는 SDK의 토큰 없는 사용자 조회 분기에서 종료하며 DB helper까지 도달하지 않는다. 원문 HTTP 응답은 저장하지 않고 상태/길이/검사 boolean만 `.scratch-pw/security-082-http-boundary.json`에 기록했다.

신규 SQL의 최초 invoker 실험은 앞 테스트의 합성 `test.role=owner`가 남아 잘못된 기준으로 실패했다. 해당 실험에서 viewer/no-unlock을 명시한 뒤 통과했다. 이는 운영 RLS 결함이 아니다. HTTP의 최초 공개 후 HTML positive control도 fixture가 서버 최초 렌더에는 scenario를 적용하지 않는다는 점을 확인해, 공개 후 fixture JSON positive control과 공개 샘플 제목 존재 검사로 교정했다.

## Security Advisor의 owner-rights view 경고

`db/migrations/0125_privacy_boundary.sql:39`–`:43`은 raw events에서 공개 전 teaser 행을 거절한다. `:65`는 owner-rights view가 의도된 공개 projection 경계임을 명시한다. 현재 `0138_public_events_tentative_teaser.sql:9`–`:33`은 공개 calendar/public scope/비draft/비삭제만 골라 DB `now()`로 제목·본문·시간·태그·연결·기간 등을 가리고, teaser의 날짜·공개시각·미정 상태만 공개한다. view의 명시 필드에 개인 신원/암호문은 없다. grant는 SELECT만이다.

`0142_public_teaser_state.sql:7`은 이미 SECURITY INVOKER RPC다. 가린 view만 읽고 명시20개 event 필드와 DB 시계를 반환한다. security_barrier는 view owner 권한 사용을 없애는 옵션이 아니며, 이를 invoker로 단순 전환하면 raw RLS에 막혀 익명 countdown stub이 사라진다. 격리 SQL에서 실제 ALTER VIEW를 transaction 안에 시험하고 rollback해 이 차이를 확인했다.

따라서0010 경고를 무시할 이유도, 그대로 invoker로 바꿀 이유도 없다. 의도된 제한 projection 예외로 검토한다. root의12:24KST 실제 read-only/TLS 카탈로그 집계에서 현재 view는 owner `postgres`, `security_barrier=true`, DB now/CASE 가림 존재, 정의 MD5 `ef0d8d5fbab01016170cafc18137f7a2`였다. anon/authenticated/service_role의 view SELECT와 state RPC EXECUTE도 확인됐다. `.scratch-pw/platform-082-db-inspect.json`. 이 집계는 현재 정의의 식별값·옵션·특정 구문 존재를 확인하며, 전체 운영 정의와 소스의 바이트 동등성 검사는 아니다. 본 lane은 제한 집계만 읽었고 운영 카탈로그를 직접 조회하지 않았다. 다른 Advisor 경고/정보까지 해결됐다는 뜻이 아니다. [Supabase0010 설명](https://supabase.github.io/splinter/0010_security_definer_view/), [PostgreSQL view 권한/보안 옵션](https://www.postgresql.org/docs/current/sql-createview.html).

## 0152 권한 조건 보존 최적화

root가12:24KST에 `0152_event_hearts_read_initplan.sql`을 실제 적용했다. 원 SELECT/PUBLIC/permissive 정책의 `user_id=auth.uid()`를 `user_id=(SELECT auth.uid())`로 바꿔 문장당 InitPlan 평가를 사용한다. 검증 TLS, statement timeout5초/lock timeout500ms에서 applied/ACL unchanged/scope unchanged/InitPlan expression/ok가 모두 true였다. 파일 SHA256 `d68f705afb4618cf53fd3706b3050dc3b31ef0b2968134d2fb75517938e5005a`. `.scratch-pw/platform-082-db-apply.json`.

독립 검토는 BEGIN/ROW EXCLUSIVE→기존 정책 검사→ALTER→COMMIT, NULL/뜻밖의 정책 거절, grant/역할/명령 보존을 확인했다. `tests/sql/event-heart-initplan.mjs`도 별도 실행해2,000개 합성 행의 사용자별 반환 주체·NULL·익명 거절·쓰기 거절·멱등·원 조건 rollback·InitPlan·drift guard를 확인했다. 실제 SQL/DB 호출은 root만 수행했다. 이 결과는 해당 SELECT 권한 조건 보존의 증거이며, 전체 기존 ACL 최소 권한 적합성이나 운영 요청의 개선률을 증명하지 않는다.

## 남은 범위

- genuine owner/developer/viewer Google 세션으로 접근 거절, 정상/실패 로그아웃 뒤 쿠키와 후속 요청, 두 기기 독립성, unlock 만료/철회를 확인한다. 사용자의 기존 세션/설정을 대신 바꾸지 않았다.
- 운영에 실제 공개 전 행이 있을 때 공개 HTML/RSC/API의 원문 미노출과 시각 변경 전파를 확인한다. 이번 검증을 위해 운영 데이터를 삽입하지 않았다.
- 새 logout route의 통합 build/typecheck/lint·배포 SHA 확인은 root 담당이다. 기존 fixture HTTP 성공을 새 코드 배포 성공으로 쓰지 않는다.
- root의 중간 production build `cD7GpusKUktHwYtvsBye4`, typecheck/전체 lint, unit1,911/1,911, 격리 SQL5종 PASS. 이 빌드의1차 lifecycle20/20에서 양쪽 화면 로그아웃4건의 마지막 행동이 합성 cookie 삭제 전에 전송됨을 확인했다. 실제 운영 Google 세션이나 Auth 서버 오류를 주입한 결과는 아니다. 뒤에 발견한 배치 임계값 결함 전의 결과로 보존한다.
- 이후20번째 logout의 threshold 선점 결함을 고친 **최종 격리 build `RG5zhm6oK09zKo0-1ZaCq`**에서 build/typecheck/전체 lint·unit1,913/1,913·served-build를 확인한 lifecycle20/20을 다시 통과했다. 해당 HTTP6/6도 root가 재실행해 HTML3개의 실제 build ID를 확인했다. 옛 HTTP 도구의 고정 build 문자열은 이 재실행 전에 실제 파일 읽기+응답 단언으로 바꿨다. source 경계 검사를 본 작업트리의 동시083 변경에 소급하지 않는다.

## 기존 실제 서비스 세션의 제한 확인

12:45KST Chrome의 기존 로그인 상태로 운영 `/api/developer/presence`를 직접 열어 개발자 집계 성공 DTO를 확인했다. 쿠키/토큰/계정정보를 읽거나 복사하지 않았으며 반환된 것은 기존 명시 count DTO뿐이었다. 이는 현재 실제 개발자 권한의 한 API 허용 경로를 확인한 것이지, 새 Google 로그인/다른 역할/개별 이용기록 reader/실제 로그아웃·revoke 증명은 아니다. 사용자 로그인 상태를 바꾸지 않았다.

12:46KST 같은 운영 API를 쿠키 없는 별도 HTTP 요청으로 확인해401·private/no-store·고정 unauthorized·운영 count 미노출 PASS. `.scratch-pw/security-082-production-anon.json`. 관리 Supabase 로그인과 앱 개발자 세션은 별도로 확인한 경로다. 원문 신원·activity 행은 수집하지 않았고 API 조회는 GET이었다.
- 실제 OBS/SOOP 송출·브라우저 캡처·인코더/네트워크 누락 측정은 별도다. 합성 권한 검사나 단독 브라우저 프레임 수치로 무끊김을 보장하지 않는다. 과거 유출 부재를 증명한 감사도 아니다.
