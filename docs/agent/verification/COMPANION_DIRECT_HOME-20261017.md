# 빅타민 실제 경로 귀가 검증 — 2026-10-17

Status: Deployed in owner-authorized combined086 releaseecaa940f. [PLAN-085](../plans/PLAN-20261017-085-companion-direct-home.md). The original085 local follow-up made no commit/push; later release evidence is in [086](COMPANION_HABITS_RELEASE-20261017.md#운영-배포).

## 변경

- 084의 임시 발판 생성/portal/CSS/지원 좌표를 제거했다. 투명한 공중 발판도 없다. 실제 텍스트·날짜·집 바닥의 안전한 실측 구간만 사용한다.
- 귀가 전용 A*는 최대200개 실제 구간의 끝점/현재·목표 투영점으로 이동 거리와 점프 비용을 비교한다. 발판 수만 적은 큰 우회 대신 가까운 경로를 선택한다. 매 행동 경계에서만 다시 계획하고180px 단위 걷기·기존140px/260px/240px 점프 한도를 유지한다.
- 보통 점프로 연결되지 않을 때만 같은 그래프에 집 바닥으로의 강한 도약을 허용한다. 실제 바닥 조각 사이 이동→집 가까운 이륙점→320ms 웅크리기→탄도 도약→기존 소파 진입이다. 수평120px와 발 기준 화면 상단100px를 제한하고, 임의 비행/순간이동/새 발판은 없다. 집 바닥이 없는 경우 실제 쿠션이 착지 대상이다.
- 사용자가 직접 놓은 카드 상단은 현재 점유한 출발점으로만 허용한다. 그 위를 걷거나 다른 manual-only 카드 상단을 목적지로 삼지 않는다. 일반 배회·먹이·최초공개의 경로 한도는 바꾸지 않았다.
- 시청자/편집실은 같은 renderer/측정/기존 프레임 scheduler를 사용한다. 새 DOM 측정 loop·timer·서버 요청·이미지·외부 의존성은 없다. 공개 DTO/권한/DB/unlock/KST/1840 표면과 모바일 빅타민 제외를 유지했다.

## 검증 환경·현재 결과

- 자격증명/환경 파일을 복사하지 않은 격리 production build `4hDUf-uLS8Smbkp1pEn_E`, port3185. 변경 제품4파일 SHA256이 격리 입력과 일치한다(`.scratch-pw/side-085-source-proof.json`). 운영/메인 빌드·아트·탭·DB와 분리했다.
- 전체 unit1,928/1,928(201파일), `next build`, 별도 typecheck, 전체 lint exit0. 순수 귀가/습관11개 사례: 빈 달 실제 착지·높이/거리, 바닥 조각, 정상 점프 우선, 우회 거리 비교, 근처 집 직접 도약, 수동 카드 출발 제한, OFF/일시정지/잘못된 기하/리플로/밀집 그래프, 습관 요약을 검사한다.
- 첫 실물 검사9/11에서 바닥 오른쪽 조각에 갇히면 출발 구간 하나만 고려하는 결함을 발견했다. 집 진입 도약을 전체 실제 그래프의 간선으로 연결해 보완하고 회귀 사례를 추가했다. 다른 실패는 viewport 축소로 집 자체가 compact 버튼으로 전환된 상황에서 계속 같은 집으로 가기를 기대한 하네스 오류였다. 실제 집이 남는 resize와 집이 접혀 취소→compact 집 열기→재호출을 분리했다. 처음 실패 증거는 `.scratch-pw/.scratch-pw/side-085-{visual.json,artifacts}`에 남긴다.
- 최종 production fixture 실제 상호작용14/14 PASS(3.1분): 시청자/빈 달 편집실, 호출 없는 자동 탈출21.9초(전체 사례 시간), native drag/접기 취소,1366×900 오른쪽 compact 집, 설정 창 왕복, 자동 점프 OFF 직접 호출, 집이 남는 resize, compact 전환 시 취소/재호출, 감소 동작, 실제 일정 위 배치 후 바로 도약/귀가, 기존 습관 초기화/학습 OFF, 기존 편집실 숨바꼭질·카드 신호·연속 크기 추출까지 포함했다. pageerror0/POST0을 각 사례에서 단언했고 POST는 모두 전송 전에 가로챘다. 실제 시계·네이티브 마우스/키보드를 사용했다.
- 최종 증거: `.scratch-pw/.scratch-pw/side-085-final-{visual.json,artifacts}`; viewer540/studio603 프레임 표본에서 임시 지원/DOM0,80ms 미만 간격의 최대 좌표 이동17.8/26px. 최종 `companion-085-{viewer,studio}-{jump.png,home.png,route.json}`와 실제 카드→귀가 PNG를 확인했다. 도착 소파 앞면/몸체 깊이와 임시 발판 부재를 직접 보았다. 이 수치는 실제 OBS GPU/인코더 성능을 보장하지 않는다.
- 변경4제품 파일의 source/build input SHA256 일치, 전체 unit1,928/1,928·lint/typecheck/build PASS를 최종 revision에서 확인했다. 최종 문서 harness231개/brief6634bytes·memory18/18·diff whitespace exit0. 운영 로그인/모든 시각 회귀/실제 OBS 장비/독립 리뷰는 별도다. 별도 대화에서 subagent 금지이므로 독립 리뷰어는 사용하지 않았다.
