# 빅타민 로컬 개인화 — 최종 검증

2026-11-26 KST. 기준742de77b에서 구현, 최신 GitHub main5d84a62e의 harness/visual 기대 수정까지 병합. 사용자 요청으로 검수 뒤 커밋·통합·push·Workers Builds 배포 승인됨. 현재 출시 후보이며 실제 배포 증거는 별도 기록.

- 생산 빌드 exit0 및 제품 소스 전체 전후 해시 동일. typecheck/lint exit0.
- 전체 단위490파일, 7,495통과·1skip(총7,496). 원 로그 unit-release.log. 기존 bounded/final 이전 결과와 구별.
- harness 전체462문서 PASS. 예전742 기준 등록표/아트46 실패는 upstream에서 이미 고친 내용을 반영해 해소.
- 독립 검수3명: 환경 중단 학습, 집/밖 문맥, 늦은 탭 저장, 약관에 남은 운영 이력, React cleanup 전 빠른 설정 경합을 수정하고 재검토.
- 실제 Next production request handler→SSR/RSC→브라우저 hydration. 포인터·키보드, UI 설정·초기화·취소·재접속, 학습예산 확보 후 OFF/cat/dog, 빠른 OFF→ON/이전 drag 완료와 새 교감, 속도 storage 변경 직후 이탈 확인. 네트워크 canary0·전송 쓰기0·브라우저 오류0·listener 시도0·서버 fetch0. 단순 컴포넌트 wrapper와 구별.
- 실제 생산 manifest의 익명 getPrivacyHistoryAction POST는 HTTP200/RSC okfalse, 상세 이력 없음. 합성 owner/developer studio도 실제 SSR/hydration과 설정 진입, owner 개발자탭 없음/developer탭 있음 확인. 실제 로그인 세션을 위조하지 않음.
- 공개 방침390 펼침과 약관에서 상세 운영 원문 제외, 적용 정보 접근 및 가로넘침 없음 확인. 필요한 공개 전후/시행정보는 유지.

## 한계와 대안

Next listener 시작은 앞선 자동 검토에서 blocked by policy로 거절됐다. 이를 다시 띄우거나 위장하지 않고 모든 net.Server.listen을 금지한 in-process Next handler로 실제 앱을 검사했다. 플랫폼 middleware/Cloudflare edge는 배포 후 실제 응답으로 따로 확인한다.

Headless 새 탭 활성화는 document.hasFocus=true/hidden=false를 유지하고 blur/visibility 이벤트를 내지 않았다. 이 경로를 native blur PASS로 세지 않았다. 실제 설치 핸들러는 focus 상태를 명시한 fixture로 취소 동작을 확인했다. 실제 Google owner 로그인/RLS는 합성 자료로 인증하지 않는다. 기존 연결된 실제 developer 세션은 배포 후 읽기 전용 화면 검수를 추가한다.

배포 전 실제 익명 서비스도 확인: POST는 모두 차단했고 /cdn-cgi/rum과 서버 액션 등 차단 요청을 mutation으로 단정하지 않았다. 운영 일정/하트/제보 데이터 쓰기 없음. 실제 사용자 설정·도감·선물은 초기화하지 않는다.

[전후 보고서](report.html) · [독립 검수 상세](release-review.md) · [수치](verification.json). 세부 QA는 .scratch-pw/local-personalization/의 보존 정책을 따른다.
