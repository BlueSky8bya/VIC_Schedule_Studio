# 복합 조작·실제 하트 지우기·일정 복구 — 2026-10-17

Status: Completed — cD 빌드5/5 PASS, 격리 배포 후보 RG5 첫 실행4 PASS/1 FAIL·viewer 단독 재관측1 PASS. 아래 실패·증거 범위를 구분한다.
Plan: [PLAN-082](../plans/PLAN-20261017-082-provider-and-lifecycle-validation.md)

## 이전 증거와 이번 범위

[078 기록](ACTIVITY_COVERAGE-20261017.md)의 마지막 한계는 당시 공개 fixture가 실제 하트 버튼 action을 전달하지 않아 보라 하트 제거의 native 수집을 입증하지 못했다는 뜻이다. 이번에는 기존 편집실의 **시청자 미리보기**가 실제 공유 `PublicPoster`에 하트 action을 전달하는 경로를 사용했다. 새 fixture나 서버 action을 만들지 않았다. 실제 투표 변경은 모든 요청을 가로채 차단한다.

이전 일정 복구 근거도 이름 등록·단위·합성 표시와 분리한다. 이번에는 전체 날짜 발판을 유지한 실제 planner가 일정을 기울인 후 사용자가 해당 일정을 클릭해 복구하고, 실제 client queue의 `companion-card-restore`를 관측했다. 테스트가 `cardPlay.bump`, 복구 callback, DOM 기울임 marker를 직접 호출하거나 삽입하지 않는다.

이번 lane은 제품·아트·DB·lockfile을 변경하지 않았다. 새 전용 검사 `tests/visual/companion-composed-input.spec.ts`와 이 기록만 추가했다. build/서버는 root와 공유하며 이 lane에서 생성하지 않았다.

## 안전한 실행 경계

- 첫 실행 build는 Next15.5.28 `Zs5cIlJvmS3fdbVqFDS9u`, 앞선 재실행은 `cD7GpusKUktHwYtvsBye4`다. `VISUAL_TEST_FIXTURE=1`, root 소유3100 production 서버를 재사용하고 과거2026-06 샘플만 사용했다. 이후 격리 배포 후보는 별도 절의 `RG5zhm6oK09zKo0-1ZaCq`다.
- 별칭 `127.0.0.2`와 격리 context의 WebDriver getter로 client queue를 실행한다. 모든 외부 요청을 차단하고 활동 전송은 로컬 인터셉터가 수신한다. 알려진 preview/이용기록 읽기 action만 합성 응답하며 나머지 쓰기와 API를 차단한다. API/preview 응답은 실제 운영 인증이나 DB 증거가 아니다.
- 새 빅타민 기능 기록은 고정 target·빈 metadata다. 원본에 함께 든 기존 section 기록의 날짜/편집 모드는 과거 합성 fixture 값이며 실제 계정·cookie·visitKey를 저장하지 않는다. PNG의 일정은 저장소 공개 샘플이다.
- 일반 복합 조작은 자율 산책·점프·장난을 끄고 실제 잡기/낙하/직접 쿠션 복귀는 유지한다. 실제 장난 검사는 별도로 산책·점프·일정 장난을 켠다. 희귀 장난의 RNG는 seed와 실제 walk/jump 도착 확률만 제어한다. 브라우저 시계와 날짜 발판은 변경하지 않는다.
- 스크롤 검사는 fixture가 화면에 맞춰지는 조건에서도 native window scroll이 발생하도록 문서 끝에 비상호작용 spacer를 붙인다. 발판·일정·소파의 DOM/좌표를 주입하지 않는다. 결과는 이 선언한 문서 흐름 조건에 한정한다.
- 쓰다듬기 종료 경계와 달리 이 검사의 활동 helper는 조작 뒤 합성 `blur`로 queue를 비운다. 실제 reload/logout/tab-close 검증으로 부르지 않는다. 해당 범위는 [별도 기록](ACTIVITY_LIFECYCLE-20261017.md)이다.

## 검사 내용

| 검사 | 실제 입력과 oracle |
|---|---|
| owner/developer 복합 반복 | 각 role에서 두 순서로 잡기→잡은 채 wheel→놓기, 다음/이전 달, 편집/시청자 팝오버 열고 닫기, 태그·계절 패널 접고 펴기, 미리보기 왕복. 각 role의 이동 완료4회만 기록 |
| 잡기·안정 상태 | 잡는 중 같은 actor DOM 유지·held 상태·숨김/화면 밖0, 안정 checkpoint에서 actor1개·보임. 전체 probe에서 중복 actor0 |
| 소파·집 바닥 음식·handoff | 실제 밥 버튼→음식을 집 바닥으로 native drag→첫 바닥 착지 후 태그/계절 패널4번 접펼. 음식 바닥 상대좌표·쿠션과 빅타민 발의 y오차 모두2px 미만. 검사가 끝나면 실제 음식 비우기. 집→집은 새 레이아웃의 실제 쿠션 지지를 유지. 일반 미리보기 복귀는 viewport로 정규화한 이전 지점과 거리0.2 미만의 실제 지지점 |
| 실제 보라 하트 제거 | 저장된 합법적 로컬 기념하트를 초기화한 뒤 실제 `.event-heart svg`를 클릭. marker와 로컬 기념하트만 제거·사람 하트 `aria-pressed=false`·숫자 불변·`companion-heart-clear`1회·일반 `event-heart`0회 |
| 실제 기록 화면 연결 | 위 실제 수집 target로만 일별/사용량 읽기 응답을 만든다. 개발자 이용기록을 실제 클릭해 열고 타임라인/적게 쓰인 기능의 이름을 확인한다. 합성 응답 표시이며 DB 저장 증거는 아니다 |
| 편집실·미리보기 일정 복구 | 전체 발판의 실제 planner가 native drag로 올린 뒤 자연스럽게 일정에 충돌해 기울임. 실제 카드 클릭→기울임 제거→`companion-card-restore` 정확히1회 |

## 실행 결과와 원 실패 보존

| 실행 | 결과 |
|---|---|
| 첫5개 | 일정 복구2/2 PASS. 복합2개는 편집실 닫기 버튼 이름 오지정으로 중단. 보라 하트의 native 제거/수집은 통과했으나 사용량 목록의 exact text locator가 위치 이름까지 합친 텍스트를 찾지 못함 |
| locator 수정 후3개 | owner 복합·보라 하트→기록 화면2 PASS. developer1 FAIL은 모든 비행 프레임이 viewport 내부여야 한다는 과도한 oracle. 유효한 낙하 중 scrollIntoView로 화면 밖을 통과한1frame이며 안정 checkpoint는 모두 보임 |
| handoff 보강 후2개 | owner1 PASS. developer1 FAIL은 같은 집 앵커도 viewport 점으로 비교한 oracle. 서로 다른 패널/스크롤 레이아웃에서 집의 실제 y가 달라 정규화거리0.313 관측. 양쪽 실제 쿠션 접지는 유지되어 home→home은 쿠션 지지로 교정 |
| scoped lint / typecheck |PASS. 최종 음식 보강 파일의 lint도 PASS. 제품 build/typecheck는 root의 공유 실행과 구분 |
| cD 공유 production build5개 |5/5 PASS, worker1·재시도0·skip0,1.7분. owner/developer 복합2·실제 보라 하트와 기록 화면1·실제 일정 복구2 |

원본은 로컬 `.scratch-pw/companion-composed-*`의 시도별 JSON·접미 PNG이며 커밋하지 않는다. 첫 실패 JSON은 `companion-composed-report-first-harness-failures.json`, 과도한 전체 비행 oracle는 `companion-composed-report-second-transient-oracle.json`, home oracle는 `companion-composed-report-third-home-oracle.json`으로 별도 보존했다. 초기 세 시도의 실패 trace는 공통 Playwright output 재사용으로 후속 실행에서 덮였으므로 현재 보존됐다고 주장하지 않는다. 실제 planner의 기울임·native 복구, 실제 보라 하트 제거 PNG를 직접 열어 확인했다.

cD 보고서는 `companion-composed-final-build-report.json`, 수집 원본/PNG는 `companion-composed-final-build-*`다. 복합 두 role에서 `companion-drag`는각4회, 음식 생성/이동/비우기·쿠션 복귀는각2회였다. 실제 하트 제거는1회·일반 하트0회, 실제 카드 복구는각1회다.5개 모두 예상 밖 요청·pageerror0이었다. 실제 수집된 보라 하트 이름이 타임라인과 적게 쓰인 기능에 함께 보이는 PNG도 직접 열람했다. 두 role의 집 바닥 음식·소파 안 수면 PNG에서 해당 안정 장면의 겹침/이탈은 보이지 않았다.

cD 복합 probe는 owner1,560/developer1,562frame였다. 중복 actor·잡은 중 숨김/화면 밖·전체 화면 밖 관측은모두0이었다. 일반 복귀 정규화 거리는 owner0.0354 미만/developer0.0473 미만이었다. 다만 전체 숨김 관측은 각각145/203frame로 화면교체 remount·geometry/texture 준비·이동 중 안전 게이트를 포함한다. zero-flicker 보장으로 바꾸지 않는다. 별도 실제 장난 probe479/377frame에서는 숨김·화면 밖·중복0이었다.

## 격리 배포 후보 재검사

root가 로그아웃20번째 이벤트의 keepalive 우선순위를 보강한 뒤,083의 별도 숨기/꺼내기 변경을 제외한 격리 snapshot을 빌드했다. 실제3100 서버의 build는 `RG5zhm6oK09zKo0-1ZaCq`, action manifest는 `.scratch-pw/release-082/.next`를 `VISUAL_TEST_BUILD_DIR`로 지정했다. 제품·테스트 소스는 바꾸지 않고 같은5개를 worker1·재시도0으로 실행했다.

첫 실행은 **4 PASS/1 FAIL**,2.6분이다. 음식 포함 owner/developer 복합2·실제 보라 하트→기록 화면1·편집실 자연 장난 복구1은 PASS다. 시청자 미리보기는60초 동안 planner가 날짜/바닥/패널 발판으로 이동했지만 일정을 기울이는 접촉이 발생하지 않아 `[data-vc-ruffled]`를 얻지 못했다. 복구 클릭이나 기록이 실행된 뒤 실패한 것이 아니며, 이 실행으로 최신 빌드의 해당 viewer 복구 완료를 입증하지 못했다. 전역 RNG seed와 도착 확률 제어만으로 희귀한 전체 지도 접촉을 항상 보장할 수 없는 검사 한계다. cD의 성공을 최신 빌드 성공으로 옮기지 않는다.

`companion-composed-release-first-report.json`, `companion-composed-release-*` 수집 JSON/PNG, 실패의 `companion-composed-release-first-viewer-trace.zip`·`-fail.png`·`-error-context.md`를 별도 보존했다. 새 집 바닥/소파·실제 보라 하트 기록 화면 PNG를 직접 열람했다. 예상 밖 요청과 pageerror는5개 모두0이다.

제품·검사 소스를 바꾸지 않은 **viewer 단독1회 재관측은1/1 PASS**,15.0초였다. 실제 planner가 일정을 기울이고 실제 클릭으로 복구한 뒤 `companion-card-restore`1회가 수집됐다. 원본은 `companion-composed-release-viewer-repeat-report.json`와 같은 접두사의 JSON/PNG이며 native 복구 PNG를 직접 열람했다. 최초 전체 실행의4/1과 이 성공을 합쳐 “처음부터5/5 PASS”로 표현하지 않는다. 드문 자연 행동의 발생 시점에 의존하는 이 검사는 안정적인 고정 회귀 gate가 되려면 별도 하네스 보강이 필요하다. 입력 callback·기울임 marker를 주입해 성공으로 대체하지 않았다.

RG5 첫 복합 probe는 owner1,398/developer1,439frame였다. 중복·잡은 중 숨김/화면 밖·전체 화면 밖0, 일반 복귀 거리 각각0.0354/0.0473 미만이다. 전체 숨김은160/203frame로 앞선 전환 한계가 남는다. 두 role의 이동4회, 음식 생성/이동/비우기·쿠션 복귀각2회, 실제 보라 하트 제거1회·일반 하트0회도 다시 관측했다.083의 별도 변경·실제 운영 DB 저장·정확히 한 번 영구 저장은 이 재검사 범위가 아니다.

일반 화면교체 중 actor unmount/초기 geometry·texture 준비 구간은 probe에 숨김으로 관측된다. 실제 scroll이 source를 옮기는 낙하도 일시적으로 화면 밖을 통과할 수 있다. 이번 PASS 조건은 모든 교체/비행 frame의 무중단 표시가 아니라 **직접 잡은 동안의 연속성, 안정 지점의 정상 표시, 복구·활동 기록과 소파 지지**다. 이 구간을 숨기거나 zero-frame flicker로 주장하지 않는다.

작성자 외 root가 native 조작/합성 읽기/queue·RNG·안전 경계와 oracle를 읽어 blocking0을 보고했고, 음식 미포함을 지적해 최종 복합 검사에 실제 음식 바닥 이동을 추가했다. 이 lane에서 확정한 추가 제품 결함은0이다. 닫기 버튼·목록 선택자·지지점 비교 등 실패한 테스트 가정과 교정을 제품 수정으로 세지 않는다.

## 미검증

모든 순열·해상도·기기·그림체를 전수 검증한 결과가 아니다. 실제 owner/developer 로그인·Google 인증·RLS·운영 활동 저장·모바일·OS 종료·오프라인 재시도·실제 OBS 방송 장비를 증명하지 않는다. 모바일 빅타민 제외 정책과 공개/비공개·DB now·KST 경계는 변경하지 않았다. 실제 저장소 없는 standalone 공개 fixture의 투표 action 부재도 바꾸지 않았다.
