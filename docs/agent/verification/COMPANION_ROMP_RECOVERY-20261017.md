# 빅타민 빠른 회복·달리기·실제 음식 걸림 검증

[092 계획](../plans/PLAN-20261017-092-companion-romp-and-recovery.md)의 후속 구현이다. 소유자는 힘찬 좌우 털기와 달리기/도약의 다양성, 실제 구르기 연결을 요청했다.091의 집기 감도·나선눈 낙하/착지·실제 발판과090/087/088의 입력·편집창 닫기·직접 귀가는 보존한다.

## 실제 문제와 변경

기존 일반 이동은 기본40~120px·최대180px이며 각 구간마다 정지/재결정했다. 정지 후 자율 사고 분기는 연속 이동2회·1800ms 누적과 다른 모든 play의20초 쿨다운까지 요구했다. 별도 착지 사고 분기는 있었으나 음식이 사고를 일으키는 연결은 없었다. 사고 뒤 음식을 흔드는 표현과 실제 음식에 걸리는 원인을 구분했다.

- 회복: 기존800ms 중 앞520ms에 HD23의 눈 감은 그림과 연속 pose plane으로3왕복·최대8°의 빠른 털기를 한다.560ms 뒤 정상 눈으로 바뀌고 끝은 중립이다. 발 중앙 지지점은 그대로이며, 회복 진입에서 손의 유한 관성 꼬리를 끝내 전체 몸체 viewport 경계를 계산한다. 새 얼굴/귀 분할·그림·타이머·이미지 consumer는 없다.
- 달리기: 일반 scoot에 짧은 구간과 실제 안전 발판 안의2~5초급 긴 구간을 섞는다. 최대520px, 선택 속도에 제한된1~1.5배 변화이며 고양이/피로의 amble·사회적 접근·집/컨트롤의 짧은 도달 범위를 유지한다. 유효한 도약이 예정된 구간만 끝 속도0을 없애고, 실제 같은 발판의48px 이상/260px 이하 착지·현재 impulse와 속도 일치·천장 한계로 검증한 높은 도약에 정지 없이 연결한다. 스크롤 시 예정 좌표도 같은 실제 anchor delta를 따른다.
- 사고: 정지 상태의 연속 이력 추첨을 제거하고 실제 달리기당 한 번의 기회로 옮겼다. 일반 몸단장/감정과 분리한 mishap20초 제한을 두며, 같은 평면 진행 경로의 보이는 settled 음식과 실제로 만날 때만 걸린다. 집힌/떨어지는/없어진/옮긴 음식, 다른 발판의 음식은 원격 사고를 일으키지 않는다. 넓은 곳은 구르고, 가장자리나 점프OFF에서는 짧은 bump로 제한한다. 실제 돌 entity를 추가한 것은 아니며 평지의 헛디딤도 유한 표현이다.
- 소유권: 먹이 추적·휴식·직접 귀가·수동 집기·일반 창·편집·공연·비활성·감소/OFF가 우선한다. 자율 탐색 이동만 놀이를 허용하며 사고/도약 뒤에는 현재 실제 기하로 다시 판단한다. 음식 소비/논리 좌표·저장 설정·일정 데이터는 바꾸지 않고 기존 카드 기울임 토글과 복구를 재사용한다. 알려진 반응의 실제 첫/중간 packet만 기존2 in-flight/3 retained exact decoder로 준비한다.

공개 DTO/서버 역할/언락/KST·1840 포스터 기하·모바일 제외·직렬 쓰기와 사용자 아트를 변경하지 않는다. 새 의존성·모델/서버 요청·상시 루프/타이머·React 프레임 갱신은 없다.

## 실패를 먼저 확인한 항목

- 독립 검토에서 도약 목표가 가장자리에 clamp돼48px는 넘지만 달리기보다 느려지는 경우를 찾았다. 같은 impulse의 실제 flight로 수평 속도를 다시 계산해 원래 속도에서1.5%/0.5px/s 이상 벗어나면 도약을 포기한다. 끝970px에서58px만 남는 사례를 단위검사에 추가했다. bump 예정에도21만 읽던 경로는 실제 예정 반응의 첫/중간 행을 읽도록 고쳤다.
- 첫 빌드는 jump 전용으로 좁힌 branch에 walk 비교가 남아 타입 오류가 났다. 기존 jump의 `completedTravel>0` 판정으로 정리하고 재빌드했다. 단위검사 일부가 먼저 통과했다고 빌드 완료로 처리하지 않았다.
- 첫 native 관찰은 viewer의 긴 달리기만 확인됐고, studio는 실제 음식 구르기와 숫자 runUp7건이 있었지만 관측기가 `positive`를 기대해 도약을 놓쳤다. 마커 계약을 맞췄다. 실제909.313→1041.476px/음식950px 경로에서는 계획46px와 접촉24px+offset10이 불일치했다. 실제 접근34px로 정렬하고 이 기하를 단위검사에 넣었다. 자율 탐색 의도까지 막던 whitelist도 explore만 허용하고 feed/rest는 계속 제외한다.
- 두 번째 native 관찰에서 viewer는22.7초 안에 세 행동 모두 확인했다. Studio는 긴 달리기·도약·평지 구르기가 나왔지만 실제 음식은 왼쪽330/430/530px, 빅타민은 오른쪽 floor fragment1081~1810px에 있어 음식 접촉 기회가 없었다. 음식 없는 발판에서 음식 사고가 생기지 않는 것은 유지해야 한다. 제품을 바꾸지 않고 기존 DOM text/control 보호로 실측한 양쪽 발판에 native 음식 배치를 분산하는 검사 준비를 보완했다. 무작위 시계·난수·행동 callback·위치·DOM 글자를 주입하지 않는다.
- 다음 viewer 관찰은83.663초에 세 행동 모두 성립했고 실제4709관찰 프레임·음식 좌표 불변·trusted 입력108/108·POST/errors0을 독립 확인했다. 다만6개 음식×각 프레임의61,217개 개별 matcher가 trace 기록 병목을 만들어 자체 runner를 중단했다. 원본을 별도 보존하고 모든 프레임의 ID/좌표/상태 전수 조건을 같은 배열 집계와 첫 실패 진단으로 바꿨다. 제품·행동 확률·90초 관찰·조건은 바꾸지 않았으며 이 원본만으로 runner PASS라고 기록하지 않는다.

모든 첫 실패 report/trace/JSON/PNG와 관측 정정은 격리 작업트리 `.scratch-pw/092-*`에 별도 보존한다. seed 단위 분포·실제 자율 관찰·명령 귀가를 서로 다른 증거로 기록한다.

## 최종 검사

최종 production fixture build `B3kOFv2k7gOKS-k4vg0-n`, Windows Chromium. 설정/건강 상태만 seed하며 native 음식 생성/drag·P/Space 입력을 사용한다. 합성 fixture의 POST는 차단한다. 실제 현재/미래 달 운영 DB를 수정하지 않는다.

| 검사 | 결과 | 범위 |
|---|---|---|
| 전체 unit |1,966/1,966 PASS·skip0 |run/접촉/속도/회복·16seed×30초 상태 전이·기존 전체 |
| 정적 검사 |build/typecheck/전체 lint 및 최종 대상 lint PASS |최종 product 빌드 후 typecheck |
| 실제 회복 |최종8/8 PASS |full viewer/studio·lite·낙하22·빠른3왕복·취소·reduced/OFF |
| 실제 자율 관찰 |정식 gate와 별도 |같은 B3 viewer 기존 all3 원본·studio 최종 all3 PASS; 최근 viewer90초 긴 run 미관찰은 FAIL 그대로 보존 |
| 기존 회귀 |최종33/33 PASS |직접 귀가·편집창 닫기·관성·빠른 놓기·창/게스트·먹이 추적; 회복8과 합계41/41·skip/flaky0 |
| 독립 검토 |최종 source blocking0 |별도 작성자 교차검토; clamp/predecode/목표 권한/기하/관측 정정 |
| 소스 일치/harness |31파일 exact 일치·harness244 PASS |검증한 격리 소스만 main 통합; 탐색 spec은 아래 사유로 정식 추가 제외 |

최종 실제 회복3종은6개 극점(+−+−+−)을 확인했다. Viewer full −7.31~+7.11°·정상 눈1096ms, studio full −7.37~+7.14°·1085ms, viewer lite −6.38~+7.01°·1110ms이며1040ms 이후 중립/마지막 matrix identity·scale1이었다. 낙하34/35/34프레임 전부 실제 HD22·첫 지상에서도 같은 포즈, 전 프레임 동일 개체/visible/decoded·저장값 불변·POST/pageerror0이었다. 독립 검토는 이전20:19 파일과 구분한20:34 최종 JSON/대표 PNG3장에서도 귀/몸체 잘림·겹침·과도한 확대0을 확인했다. 이 표본이 모든 분포를 보증하지는 않는다.

### 확률적 관찰과 정식 회귀의 구분

새 탐색 spec은 임의의90초 안에 긴 달리기/음식 걸림/도약을 모두 요구했다. 제품에는 이 시간 보장 계약이 없다. 최근 viewer는 실제 달리기1.349초/197.05px 뒤 음식950 앞940px에서 구르기로 전환했고, 바닥 체류는18.321초뿐이었다. 이후 날짜/컨트롤 발판은 좁아 긴 달리기 후보가 제한됐다. 같은 B3의 직전 viewer 원본은1.639초/311.62px 긴 실제 HD20과 음식 걸림/도약을 모두 보여준다. 최종 studio는 세 행동 및 모든 후단 단언까지 PASS했다. 확률을 검사에 맞춰 바꾸거나 seed 선택/성공할 때까지 재실행하지 않는다.

독립 검토에서 이90초 검사를 정식 회귀로 추가하지 않는 분리를 승인했다(blocking0). 삭제해 실패를 숨기지 않고 ignored 탐색 harness/실패 JSON/trace와 원본을 보존한다. 정식 gate는 **unit1,966·native41 PASS**이며43 PASS로 합치지 않는다. 관측 종료 전에 timeout이 발생한 viewer의 후단 단언은 runner에서 실행되지 않았으므로 정적 원본 감사와 구분한다. 원본에 저장되지 않은 설정 전후값/care hunger/data-atlas는 그 감사로 재증명하지 않는다.

재실행이 필요한 경우에만 격리 작업트리 `C:/Projects/VIC-086`의 같은 build B3를 fixture 모드로3116에서 띄운 뒤, main에서 `node node_modules/@playwright/test/cli.js test --config=.scratch-pw/companion-092/exploratory.config.ts`를 실행한다. 실제 재실행은 이번 분리 이후 하지 않았다. 이 config의 `--list`는 탐색2건만 발견했다. 원본 spec은 main의 `.scratch-pw/companion-092/companion-romp.exploratory.spec.ts` 및 격리 `.scratch-pw/092-romp-exploratory.spec.ts`, 전체 실패 report는 main `.scratch-pw/companion-092/092-exploratory-final-report.json`, trace/각 관찰 원본은 격리 `.scratch-pw/092-*`에 있다. 이 로컬 증거는 제품 파일/원격 커밋에 넣지 않는다.

`node .scratch-pw/092-romp-raw-audit.mjs`를 격리 작업트리에서 실행해 동일 원본3개를 정적 재검증했다(exit0·구문/metrics JSON parse PASS·독립 감사 소스 검토 blocking0). 재시뮬레이션이나 난수 재추첨은 없다. Build B3 mtime20:25:39 KST이며 raw 자체에 buildID는 없어 원래 실행 기록과 현재 artifact의 출처를 구분한다.

| B3 원본 | raw mtime KST | 실제 HD20 장거리 | 실제 음식 HD21 | run→hop apex/착지 |
|---|---|---|---|---|
| 직전 viewer |20:37:49 |1.639초·311.62px |34프레임·같은 평면10px 앞 접촉/jostle |83.145px·같은 지지면 |
| 최종 studio |20:44:39 |최대2.132초·260.48px |35프레임·실제 접촉/jostle |87.887px·같은 지지면 |
| 최근 viewer |20:43:19 |90초 내 미관찰 유지 |24프레임·실제 접촉/jostle |101.634px·같은 지지면 |

음식72,216 frame-cell 전수에서 정확 ID/논리 좌표/먹힘·낙하 위반0·drift0, 개체 동일/visible/decoded 위반0, native 입력324/324 trusted·POST/errors0이었다. 실제 채택한 HD20/21·달리기→접촉 간격·실제 상승/하강 그림·40~105px apex·비정지 이륙/같은 방향/동일 지지면 착지와 원본 SHA256/mtime 불변을 assert했다. 이 결과를 새 native runner PASS2건으로 바꾸지 않는다. 정식41건의 설정 불변 검사와 원본 미저장 후조건을 혼동하지 않는다.

## 배포와 한계

관련15파일만86c6489ab671039fb9d89552d4600b098121e1d9로 commit/main push했다. 사용자 아트/.vscode/기존 미추적 작업은 제외했고 staged secret6종0·whitespace PASS였다. [Remote quality39030130301](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39030130301)은 해당 전체 SHA로 모든 단계(잠금 의존성·unit·격리 SQL 계약·harness·production build·생성 경로 typecheck·lint·post 포함) success, Vercel6NeqV9pGsNqdDNo7Y42Pffs1Re6x success였다.

2026-10-17 20:51:45 KST 운영 canary에서 전체 SHA exact·clock200 no-store·warm204·anonymous developer401 no-store/error-only·fixture HTTP200의 streaming404 비노출을 확인했다. 실제 로그인된 developer studio에서는 버전86c6489와 한 개체 visible/decoded·hidden/placement false를 읽기 확인했다. 실제 반복 흔들기/달리기/구르기/음식·도약은 production-build fixture/원본 감사 증거이며 운영에서 스케줄이나 설정을 변경하지 않았다. 자체 fixture server/runner는 종료했다. 로컬 `.scratch-pw/companion-092/`에 remote-run-final/remote-jobs/remote-status/deployed-canaries/deployed-ui/staged-files/source-equivalence와 감사 metrics를 보존한다. 배포 후 결과 메타데이터는 로컬만 갱신해 문서만을 위한 추가 배포를 만들지 않는다.

실제 OBS/OS·모든 장치/기하/난수 순열·실제 역할/RLS·상시 확률 보장을 증명하는 검사는 아니다. 기존 Vercel Hobby 초과와 별도 운영 검증은 미결로 둔다.
