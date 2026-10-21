# VIC 일정표 일일 검수 · 개선 (165)

기존 예약 `automation`의 09:00 KST 작업에서 사용한다. 기존 companion QA의 200건 인증과 독립 검수 기준을 낮추지 않는 **상위 선별 절차**다. 이 CLI는 승인·배포 도구가 아니며 기본은 계획만 만든다.

## 실행

```powershell
node scripts/site-daily/runner.mjs --day 2026-10-21
node scripts/site-daily/runner.mjs --day 2026-10-21 --run-offline
```

`--root`, `--base <마지막 검사 Git ref>`, `--changed <경로 배열 JSON>`, `--history <확인된 기록 JSON>`, `--signals <허용 집계 JSON>`, `--ideas <아이디어 목록 JSON>`을 선택할 수 있다. 기본 변경 비교는 HEAD 대비 작업 변경+관련 미추적 소스이므로, **마지막 검사 이후 커밋도 포함하려면 `--base`를 꼭 지정한다.** 삭제된 파일·공유 스타일·빌드 설정·알 수 없는 의존성은 좁은 검사로 인증하지 않는다.

출력은 매번 새 `.scratch-pw/site-daily/<날짜-고유값>/`에 저장한다. 원본 보고서·실패를 수정하거나 재시도 PASS로 덮지 않는다. CLI의 source digest는 명시된 파일 부분집합이며 모든 import의 동결 인증이 아니다. 전체 동결은 companion runner의 별도 작업이다.

예약 실행자는 `.scratch-pw/site-daily/state.json`의 마지막 검사 ref·history 파일·활성 작업 경로를 읽고 `--base/--history`에 전달한다. 종료한 원run/실제 reporter/소스 digest를 확인한 기록만 history의 verified로 수입한다. 예: `{"area":"companion","day":"2026-10-21","kind":"full","status":"passed","sourceDigest":"<실제64자digest>","evidenceRef":".scratch-pw/.../report.json","verified":true}`. 누락·재시도·관측 전 설정을 PASS나 actual native로 올리지 않는다. **planner는 검수자가 확인한 ledger를 신뢰하는 순수 함수이며 증거 파일을 다시 확인하지 않는다.** 그래서 digest/ref는 필수지만 이것만으로 진정성/출시를 인증하지 않는다. 일반 사용자가 보낸 JSON이나 집계 자료를 verified history로 수입하지 않는다. 기록이 없으면 보수적으로 unknown/full-required를 유지한다. 수정된 소스와 마지막 ref/history를 새 증거를 남긴 뒤 저장하여 매번 과거 baseline에 머물지 않게 한다.

`--run-offline`은 고정 허용 목록의 단위 검사만 실행한다. 환경 변수는 기존 QA의 OS 런타임 허용 목록만 전달하고, Node HTTP/HTTPS/http2/fetch/socket(직접 Socket 포함)/UDP/DNS 요청 경로를 차단한다. 이 preload는 OS 방화벽이나 임의 native addon/다른 실행파일의 격리가 아니므로, 검증되지 않은 검사·새 실행파일을 목록에 넣지 않는다. 개발 서버·운영 로그인·DB·provider·채팅 원문을 조회하지 않는다. 접근을 시도한 검사가 있으면 원인 확인 대상으로 실패한다. 공개/로그인 사용자 UI·OBS 실제 기기·실제 DB 권한의 검증으로 세지 않는다. 기존 통합 테스트는 운영 DB 삽입/삭제 setup이 있어 자동 목록에서 제외했다. SIGINT/SIGTERM과 시간 초과 시 정확한 소유 PID의 자식 트리만 종료하고 종료를 기다린다. SIGKILL/기기 종료 같은 포착 불가능한 중단은 별도다.

## 매일 선택과 전체 회귀

1. 활성 검사/수정이 있으면 중복 시작하지 않고 이어간다. brief/CURRENT_STATE, 최신 관련 계획과 승인 backlog를 읽고 원본/보호 기록을 보존한다.
2. 사이트 전체를 companion·달력/편집·공개/공유·방송·인사이트·프라이버시·디자인·플랫폼 8영역으로 점검한다. 영역별 목표→관측 신호→지표를 3~5개 이내로 둔다. 사용 횟수나 체류 시간 증가는 성공 자체가 아니다.
3. 확인된 P0/P1/P2, 최근 실패, 소스 영향, 마지막 관측 경과, 실제 집계의 실패/시도 비율, 자료 부족으로 우선순위를 정한다. 현재 companion 가중치 16은 불안정 기간용 프로젝트 규칙이다. 다른 영역의 중대 결함이 더 높으면 그쪽을 우선한다. 가중치는 연구가 입증한 최적값이 아니다.
4. 공통 공개 경계·KST·인증 경로 검사+위험 1영역+회전 1영역을 먼저 실행한다. 연속 7개 관측일의 native/full PASS와 최근 full sweep이 확인되기 전에는 companion을 안정됐다고 보지 않는다. 단위 PASS를 실제 생활 관측일로 올리지 않는다.
5. 현재 companion 진단은 실제 daily90s 성격 3개(3일에 9개 회전)+소파143+네 실물 정리142+잠자리157의 **6건**이다. 실제 외출·걷기/뛰기/점프·10초 내 의미 있는 활동·대상 유지·다음 행동은 연속 trace/영상으로 확인한다. 잠자리의 표면·낮/밤과 두 가지 정리 경로도 회전한다. 안정화 후 다른 영역이 우선이면 성격 1개로 줄여 4건으로 한다. 모든 9성격의 제안/변경 이력은 매일 검토하지만 매일 9개 신규 기능을 강제로 만들지 않는다.
6. 계획에 출력된 companion command를 **동결된 소스에서 실제로 실행**한다. 진단 예산 20분, 공통/선별 점검 기본 45분이며, 7일마다 또는 관련 runtime/oracle·공유 CSS/빌드 의존 변경·확인된 회귀가 있으면 기존 full200 `--budget-minutes 45 --workers 3`으로 올린다. 예산은 진단/정기 검사의 상한이며 이미 승인된 결함 수정·출시를 포기하는 시한이 아니다. 긴급 P0 영역 복구를 진단 때문에 지연하지 않는다.
7. 진단 grep은 원래 runner에서 full200/all-nine gate가 미충족되어 `failed`로 보존된다. `inspectCompanionDiagnostic({root,run,sourcePaths:[...변경 제품 파일]})`는 선택된 실제 사례·앞뒤 guard만 별도 해석한다. 이어 `bindDiagnosticPlan(원래plan,진단결과,원report.diagnosticScope.nativeGrep)`의 **planSatisfied**도 통과해야 한다. 원래 계획의 수(현재6건), 각각의 필수 제목 정확히1회, 실제 grep 동일성을 비교하므로 제목이 바뀌어5건만 실행됐거나 다른 사례를 실행했으면 완료가 아니다。 원 보고서 PASS 변환 금지. sourcePaths가 비면 runner/catalog/guard/선택 spec만 부분 검증한 것이다. 미선택/영상 해시/전체 Git/배포 검증을 했다고 표시하지 않는다. 반환 `releaseEligible:false`는 항상 유지된다.
8. 실제 companion 수정·출시는 기존 full200, 전체 typecheck/lint/unit/build, 변경 관련 공유 viewer/studio/preview 실제 동작, 세 명의 새 비작성 독립 검수, review.mjs의 소스·원영상·실제 효과+다음 행동 심사를 통과한다. 외부 배포는 fullSHA와 공개 결과까지 확인해야 완료다. 비companion 수정도 권한/공개 DTO/KST/편집 저장 등의 실제 영향 경계를 확인한다. 단위 검사만으로 실제 UI 통과를 선언하지 않는다.

## 증거와 검사량 관리

- 설정 조합의 유한 모델과 실제 실행은 따로 센다. 특히 planned reduced/off가 있어도 actual motion이 full이면 full만 관측한 것이다. t-way 조합은 **정적 설정** 누락을 줄이는 보조이며 동작 순서·타이밍·소유권을 증명하지 않는다.
- 새로운 회귀는 기존 목적/순서 계약(잠자리 조작→정착→수면→다음, 같은 실물 운반→잔여 정리→씻기→외출, 수동 우선권→자율 복귀, 접근→접촉→효과→다음, 스크롤 동기화)에 가능한 한 병합한다. 서로 다른 결함 조건은 지우거나 검증 문턱을 낮추지 않는다. 새 테스트 비용·추가로 검출하는 조건을 기록한다.
- source/BUILD_ID가 묶인 원실패·영상/trace 추출물과 요약은 재사용할 수 있다. **과거 build/PASS를 현재 PASS로 캐시하지 않는다.** 동일 동결 버전에 관련 수정을 묶어 전체 검사를 한 번 시행하고 새 변경·실패 때만 반복한다.
- 매주 전체 검사에서 선별 검사의 놓친 결함·소요 시간·재발률을 비교해 우선순위와 회전 목록을 조정한다. 현재 200건의 실제 native wall은 35.26분, 합산 worker는 101.318분(3 workers)이다. 이미 병렬 효율이 높아 workers를 더 늘리지 않는다. 선별 검사로 시간이 얼마나 줄었는지는 실제 결과를 측정하기 전 추정으로만 쓴다.
- 제품 결함 / 검수 코드·fixture 오류 / 관측 경합 / 환경 / 증거 부족 / 미실행을 분리한다. retry는 원실패를 없애지 않는다. 불안정 사례는 소유자·원인·재현·수정·재검증 상태를 남기고 조용히 제외하지 않는다.

## 데이터: 가능한 것과 없는 것

오늘 확인한 것은 **소스 구조와 로컬 증거**다. 실제 운영 이용 기록은 수집하지 않았다. 기본 입력이 없으면 영역별 `not-provided`다. 권한 있는 기존 개발자 화면의 합계·고정 분류 성능 자료를 사용할 수 있는 경우에만 명시적으로 투영한 다음 입력한다. 그 권한/집계 제공 여부를 자동으로 가정하지 않는다.

허용 입력 예(합성 예이며 실제 사용자 자료 아님):

```json
{"schemaVersion":1,"source":"synthetic-test","periodDays":7,"observedDay":"2026-10-21","areas":[{"area":"calendar","sampleCount":20,"attempts":20,"failures":2,"repeatedActions":3,"p95Ms":420}]}
```

source는 `developer-aggregate`, `performance-aggregate`, `synthetic-test`만 허용한다. 표본은 **사건 수**이지 익명 사용자 수가 아니다. attempts/failures는 같은 과업·기간의 명시된 분모만 입력하고 추론해 채우지 않는다. 5건 미만은 수치 노출을 억제하지만 이것이 익명성/동의의 보장은 아니다. 7일 이상 지난 집계는 새로운 마찰 신호로 점수화하지 않는다. p95와 반복은 동일 과업의 목표·전후 맥락과 함께 사람이 판단하며 단일 전역 임계치로 결함 판정하지 않는다.

일반 insights/day timeline에는 이메일·세션·정확한 시각이 섞일 수 있다. 특히 `getActivityDayAction`의 pruneActivity는 환경 설정에 따라 삭제를 실행하므로 일일 읽기 전용 수집에 호출하지 않는다. visit_session 토큰/visit_key도 익명 집계로 취급하지 않는다. 방송/VOD 공개 내용 통계와 **이 사이트 이용 통계는 서로 다른 자료**다. 원문 채팅/검색어/세션/이메일/IP/쿠키/취향·수집·학습 정보/식별 가능한 자유 텍스트를 수집·프롬프트·공개 보고에 넣지 않는다. 새 추적, 동의 변경, service-role/운영 DB 직접 조회는 이 절차에 추가하지 않는다.

## 제안 → 사람 채택 → 구현·버그 수정 → 검증

`synthetic-test`는 입력 형태를 시험하기 위한 자료라 실제 이용 마찰 점수나 관측 공백을 줄이는 근거로 쓰지 않는다. 자료의 시기·출처·분모가 다른 집계를 합쳐 이용자가 늘거나 만족도가 개선됐다고 해석하지 않는다.

영역별 기본 관찰 목표: 달력/편집은 찾기→수정→저장 성공·재시도·KST, 공개/공유는 공개 범위·미리보기 해제 시각·권한, 방송은 갱신·기간/시간 경계·응답 지연, 인사이트는 집계 신선도·분모·표시 누락, 프라이버시는 DTO/식별자 노출·권한 경계, 디자인은 간격/대비/키보드 초점/탭·접기 통일, 플랫폼은 회귀/오류·비용·복구다. 빅타민 밖 영역도 읽기/안전 fixture로 확인하고 실제 로그인·기기가 없으면 검증 공백을 그대로 기록한다.

`area+problemKey`로 기존 제안/완료/거절 이력과 중복을 합친다. 하루 최대 **3개 구체적 제안**, 승인 후 동시 구현 **2개**를 기본으로 한다. 편의·디자인 통일·가독성·몰입/재미의 이득 × 근거 신뢰도 / 구현+토큰+유지 비용은 비교용 휴리스틱이다. 수치는 자동 승인이나 수익 최적화의 근거가 아니다.

빅타민은 9성격 각각의 목표/욕구/상황→접근·이동→실제 효과→다음 행동에서 포즈·표정·반응이 필요한지 매일 읽는다. 멈춘 얼굴 반복이나 무조건 마지막 인사, 불필요한 소파 복귀는 기능 수를 늘려 해결하지 않는다. 예: 정리를 완료한 깔끔이의 짧은 만족 반응이 **바로 다음 이동**으로 이어지는지, 실외 달력에서 재롱둥이의 방방 뛰기가 실제 사용자 맥락과 맞는지. 단독 예쁜 포즈와 의미 있는 생활 개선을 구분한다.

제안에는 문제와 관측 근거·전후 예시·연구 적용 한계·예상 비용·완료 조건을 쓴다. 사람의 이 대화 채택이 있기 전 `proposed` 상태로 둔다. `approved→implemented→verified(실제 효과+다음 연속행동)→released(fullSHA/공개)`를 구별한다. 기존 채택 항목은 재질문하지 않는다. **버그 수정은 이미 승인**되어 있으므로 새 제안 답변을 기다리며 멈추지 않는다.157에서 끝난156의 아홉 아이디어는 다시 미완료로 재등록하지 않는다.

## 근거 (직접 자료, 적용 범위의 한계 포함)

- [Google Regression Test Selection at Scale, 2026](https://storage.googleapis.com/gweb-research2023-media/pubtools/1048985.pdf): 비용·의존성 기반 선별. 작은 부분집합이 모든 결함을 잡는다는 결론은 아님. 0.9% 비용에서 실패 커밋의40% 검출이라는 결과는 주기적 전체 검사의 필요성도 보여준다.
- [NIST SP800-142, 2010](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-142.pdf): 제약 있는 t-way 설정 조합. 연속 생활의 이벤트 순서를 대신하지 않는다.
- [Google De-Flake Your Tests, 2020](https://storage.googleapis.com/gweb-research2023-media/pubtools/6478.pdf): 실패 분류와 flaky 원인 분석. 자동 분류도 오판하므로 실제 trace/영상과 별도 확인한다.
- [Google HEART, CHI2010 공식 초록](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/): 목표→신호→지표로 사용자 관점 정의. 활동량 자체를 만족도라고 해석하지 않는다. 이 자료는 공식 초록 범위로 읽었다.
- [W3C Privacy Principles, 2025-05-15](https://www.w3.org/TR/2025/STMT-privacy-principles-20250515/): 목적 제한·최소화. 기존 telemetry 코드가 있다는 사실은 동의/실제 dashboard 접근을 뜻하지 않는다.
- [Scene-Aware Behavior Synthesis for Virtual Pets, CHI2021](https://rawanmg.com/pdf/vrpet.pdf): 행동·목표 위치·경로를 함께 다룸. 20명/3장면 연구로 현재 프로젝트 효과가 입증된 것은 아니다.
- [iPET, ACL Demo2025](https://aclanthology.org/2025.acl-demo.40.pdf): 그럴듯함·일관성·생활 다양성·매력 관점. 제한된 자동 평가/온라인 표본이므로 LLM/RL 추가를 만능 해결책으로 삼지 않는다. 새 의존성이나 유료 AI를 설치하지 않았다.
