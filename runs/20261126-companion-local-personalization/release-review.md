# 2026-11-26 독립 검수·출시 점검

사용자 추가 승인: 남은 독립/실제 앱 검수, 발견 문제 수정, GitHub 최신 커밋 확인 후 커밋·통합·push·배포. 초기 기록의 배포 미승인 문구를 이번 승인 범위에서 대체한다.

## 독립 검수와 수정

비작성자 세 검수자가 학습/저장, 권한/공개 정보, UX/검증을 분담했다. 발견한 문제를 수정하고 재검토했다.

1. 교감 중 설정·창·기하 변경을 짧은 교감 선호로 학습하던 경계: 환경 중단은 contact만 취소, 실제 포인터 정상 이탈만 완료. 발견 공유창은 보존.
2. 집 판단에 바깥 학습값을 쓰던 문맥 누락: brain/planner/deliberation에서 현재 support의 집/밖을 전달. 실제 행동·계획·숙고의 교차 회귀 12건 추가.
3. 같은 초기화 세대의 오래된 탭이 새 근거를 덮어쓰던 문제: load/save 학습 stamp 비교, 충돌 시 거부·최신 상태 재로딩. localStorage의 정확히 동시 다중 프로세스 원자성을 보장하는 트랜잭션은 아니다.
4. `/terms`에도 남아 있던 상세 운영표 제거. 필요한 시행 정보와 공개 전후 비교는 유지하며, 상세 원문은 실제 인증 developer gate 한곳에 둠.
5. 설정 알림과 React cleanup 사이에 이전 입력이 완료되던 경합: 알림 수신 즉시 이전 학습 epoch 차단. OFF→ON을 한 task로 되돌려도 새 controller가 재생성되어 새 교감은 정상 학습. 옛 drag 완료는 무시.

## 낡은 검증과 환경 문제 분리

- 원격 main `3e684731`에 harness·아트46건 수정, `791d541f`에 현재 화면과 어긋난 visual 기대 수정이 이미 있었다. `5d84a62e`까지 확인하고 병합했다. 현재 harness 전체 통과. 예전742 기준 실패를 계속 현재 실패로 세지 않는다.
- 이전 OFF/cat/dog 검사는 학습 예산 소진 상태에서 검사해 거짓 통과 여지가 있었다. 최종 실제 앱 검수는 각 사례에서 credit1을 먼저 확보한다.
- headless 탭 전환은 native blur/visibility를 발생시키지 않았다(hasFocus=true/hidden=false/events0). 이 경우는 NOT EXERCISED. 설치된 실제 blur 핸들러를 명시적 focus-state fixture로 검사하는 대안과 구별한다.
- Next POST mock의 body 소비 누락을 QA 어댑터에서 수정했다. 실제 익명 서버 액션 응답 검증에 사용했으며 제품에 auth 우회나 mock을 넣지 않았다.
- 한 차례 로컬 빌드 두 실행이 겹쳐 중간 manifest 충돌로 실패했다. 원 로그 보존. 단일 최종 빌드는 종료코드0, 타입·lint도 최종 종료코드0.
- `docs/deployment.md`는 옛 Vercel 최초 배포 기록이었다. 현재 Cloudflare 정본 링크와 로컬 cf:deploy 금지 이유를 머리에 표시했다. Vercel의 옛 failure status는 현 Workers 배포 실패가 아니다.

## 실제 앱 검증 범위

설치된 Next 생산 request handler와 실제 build HTML/RSC/JS를 Playwright에 연결했다. 모든 net.Server.listen과 서버 outbound fetch를 금지한 채 실행한다. 컴포넌트만 새 bundle로 올리는 검수와 구별된다. public/studio fixture는 실제 shared client 코드를 hydration하며, 운영 DB 쓰기·인증 토큰 변조 없이 검사했다.

- owner/developer studio SSR·hydration → 설정 → 빅타민 → 함께 지내기: 정상, owner 개발자 탭 없음/developer 탭 있음. 이 UI role prop은 합성 자료이며 실제 로그인 권한 증거가 아니다.
- 생산 manifest의 실제 getPrivacyHistoryAction ID로 익명 HTTP POST: 200 text/x-component의 `{ok:false}`, 상세 이력 없음. 서버 fetch/listen0.
- 공개 방침390px 펼친 정보, 시행 정보 접근, 가로넘침 없음. `/privacy`와 `/terms`에 상세 운영 원문 없음.
- 실제 Google 로그인·DB RLS·모든 성격 장시간·실제 native focus 전환은 이 결과로 인증하지 않는다. 변경 범위는 새 DB 권한/스키마를 만들지 않았고 역할 gate는 합성 단위 및 실제 익명 서버 액션으로 확인했다.

실제 앱 전체 회귀와 생산 배포 결과는 최종 verification.json 및 Hub 출시 기록에 연결한다. 원 QA 로그·요청/응답은 worktree의 `.scratch-pw/local-personalization/`에 두며 보존 정책을 따른다. 운영 데이터 정리·삭제 없음.
