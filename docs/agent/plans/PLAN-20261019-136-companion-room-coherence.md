# 136 — 집 구도·입체 TV·조명 기억과 성격 보고서

2026-10-19 KST. 상태: 구현·배포·실제 공개 검증 완료. 최신 첨부4를 미술 목표로 삼는다.135의 평면 TV30도 변형/좁은 launcher 방/전등 초기 OFF/커튼 비일관 조명은 이번 요청으로 대체한다. 원본 소파/보호 배우 그림·기존 출구/반납·공유 물리/KST·서버 경계는 유지한다.

## 구현 범위

- 전등은 밥통 수평 중심의 천장으로 이동한다. UI 상태를 로컬 공통 저장소로 옮겨 집 재마운트/라우트 이동/새로고침에도 최근 선택을 보존한다. 새 키의 첫 기본값은 밝은 테마ON/어두운 테마OFF, 이후 테마·시각이 명시 선택을 덮어쓰지 않는다. 향후 배우도 같은 setter를 사용하며 이번에는 새 자율 AI를 추가하지 않는다. 저장 불가 때는 세션 선택을 보존한다.
- 원본 일러스트처럼 두께·옆면이 보이고 소파를 향한 TV 본체를 내장 생성 도구로 한 번 제작한다. 평면 본체 전체를 rotateY로 찌그러뜨리는 구현을 제거하고 고정 실제 그림에 채널5개를 같은 화면 면으로 맞춘다. 생성 원본/프롬프트/파생/SHA를 새 회차에 보존한다. 미술 승인과 구현 QA는 구분한다.
- launcher가 여는 방은 공유 부동 패널 배치의 범위 안에서 너비를 늘리고 reference의 넓은 구도로 그린다. rail과 compact에 같은 내부 좌표·물리 앵커/44px 원칙을 쓴다. 작은 actual width의 예외만 구조 이유를 기록한다.
- 방/가구/커튼·소파 뒤/앞 모두 같은 조명 재질을 쓴다. 소파 hover가 앞 포털에만 다른 밝기를 주는 원인을 고치고 뒤/앞 동일 상태를 실제 배우가 앉은 채 검사한다. 창밖은 세계 계절/날씨/KST 풍경을 유지하고 실내 커튼은 실내 조명으로만 밝기를 맞춘다.
-9성격 제안 보고서는 대표5장면+소장면7개씩(총108개)과 결합 장면을 읽기 쉬운 HTML로 제공한다. 현재8종/신규9번째·이름 변경·미적용 AI를 명시하며 새 AI를 구현한 것으로 세지 않는다.

## 검증

새 저장소의 첫 테마/기존 선택/false/잘못된 저장·저장 실패·다중 구독/다른 탭, 실제 재마운트/라우트/새로고침을 확인한다. shared production build에서 viewer/studio/preview·panel/launcher·작은/큰 화면, 낮/밤·전등 양상태·커튼5단계·소파 hover와 foreground 전환, 출구·물리 분산·44px 조작·G22 단일 고정 이벤트/개발자 타임라인/least-used를 검사한다. 전체 unit/type/lint/build/harness·독립 시각/경계 리뷰 뒤 scoped commit/push 및 실제 공개 fullSHA/UI를 확인한다. 실제 로그인/RLS/OBS/전문 미술 승인/새 성격AI/공급자 한도 해결은 별개다.

## 구현과 검증 결과

- 전등과 밥통 중심 차이1px 미만, launcher 너비 기존1.5배의 viewport 제한, 실제3/4 TV 본체·그 화면 면만5채널 투영을 적용했다. 기존 몸/소파 원형·음식·장난감·창밖16풍경 원본은 보존했다. 새 배포 파생3개/96,410바이트와 생성 원본2개는 [출처](../../../art-src/빅타민/동행/작업회차/20261019-방입체조명136/README.md)에 보존했다. 숨은3D모델을 구현한 것으로 주장하지 않는다.
- 공통 로컬 전등 저장소는 명시false/최초 테마/잘못된 저장/저장 실패/다른 탭 변경·삭제/구독 정리를 검사했다. 현재와 향후 배우 조작은 같은 setter를 사용하며, 초기화·자율 상태 복구를 인간 활동으로 기록하지 않는다. 기존 고정 TV/전등 semantic action의 pointer/Enter/Space당 단일 기록과 개발자 timeline/least-used 표시를 재검사했다. 취향/음식/채널/성격 메타데이터 추가0, API·서버 역할·DB 변경0.
- 독립 room_review_136가 위치 불변 시 소파 foreground 재질 전달이 생략되는P2를 발견했다. 실제 room 재질을 읽고 조명·시간대·커튼 속성 변화에 기존 geometry delivery를1회 요청하도록 고쳤다. 일반style 변화는 같은 기하를 재전달하지 않으며 새 상시 측정 루프는 없다. 회귀 검사와 실제 앉은 배우의OFF→ON→OFF에서4개 색 토큰/hover 변환 일치로 확인했다.
- 최종 제품 fixture build PASS, typecheck PASS, 전체 lint PASS, unit **3211/296파일 PASS**(22:06 KST). 최초 회귀의 disconnect 정확히1회 기대는 관찰 대상 교체 때의 정상 disconnect를 빠뜨린 검사 오류였다. dispose 전후 증분1로 교정하고80개 관련 검사 PASS. 최초 native 시작은 PowerShell npm 인수 전달 오류로 서버 미기동이었다. 잘못 시작한 실행을 중지하고 명시 node/next CLI로 기동한 같은 build에서 **30/30 단일 실행 PASS**(2.3분).
- native30은 새136 검사6개(밝음/어두움 첫값·라우트/닫기/재열기/새로고침·viewer1440/studio1100·1920·앉은 소파)와 기존 출구/8개 실물 분산·44px 모든 edge·패드 실제 윤곽 최단선 중앙·커튼5단계/낮잠/기상·네 도감 키/점/ACK·활동 capture/display다. preview·고요한 motion·2400폭을 포함한다. 증거는 로컬 `.scratch-pw/companion-136/native-1-report.json`, `coherence/`, `interior/`, `spawn/`, `curtains/`, `gallery-131/`, `gallery-134/`, `activity-*`에 저장했다.
- root와 독립 room_review_136가 실제 렌더9장/TV 켜짐·앉은배우·양조명·각폭을 첨부 기준과 비교했다. 잔존P1/P2 없음. 전문 미술 승인·사용자 최종 시각 승인·실제 OBS/기기/로그인·RLS 검증과 구분한다.
- [성격 보고서](../reports/REPORT-20261019-136-personality-scenes.html)는9×대표5+소장면7=108과36결합을 담는다. 현재8종/신규9번째·이름제안/새AI미적용을 명시했다. 영구본 desktop1280/mobile390 직접 렌더, 가로 넘침0·깨진 앵커0·소스 링크6개 정상·외부 요청/스크립트0 PASS. 독립 검토도 같은 구조와 구분을 확인했다.

최종 typecheck/전체lint/build/harness335 PASS. 독립 room_release_review_136의 저장/구독·geometry루프/역할·공개정보/KST/G22/접근성 소스 리뷰도 추가P1/P2 없음이다. 보호 사용자 응원단 기록 SHA는 작업 전과 같다.

승인된 scoped commit/push와 해당 배포의 전체SHA/실제 공개 화면 검증은 다음 단계다. 보호 사용자 응원단 기록/다른 초안은 범위에서 제외한다. 배포 뒤 완료 상태는 로컬 문서에 닫고 docs-only 재배포는 하지 않는다.


## 출시 확인

승인된 scoped commit/push는 `f8646283b51204e88648c9d01500848b4d8145a6`, main이다. 기존 공개 GitHub 이름+noreply를 사용하고 보호 사용자 기록/관련 없는 초안은 제외했다. 커밋된 생성 원본2개와 배포3개는 출처 명세의 SHA와 일치하며 새 배포 합계96,410바이트다.

- [Vercel DkGpVjFmupwUqLe3xdnY5XEV9Ms4](https://vercel.com/bluesky-s-project3/vic-schedule-studio/DkGpVjFmupwUqLe3xdnY5XEV9Ms4) success를22:11:57 KST 확인했다.
- [원격 quality39257571710](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39257571710) completed/success 및 전 단계 성공을 확인했다. Unit/isolated SQL/harness/production build/타입/lint와 후처리까지 완료했다.
- 실제 공개 검증은 **22:12:57.716 KST PASS**, 로컬 `.scratch-pw/companion-136/production-1/`의 checker/helper 원문·summary·public-release-proof·그림 SHA/실제 PNG/JPG·전등 기억 증거에 보존했다. 첫 anonymous 저장/발견/취향/전등 seed0, 실제 공개 client chunk 전체SHA 일치, 기존109+신규3=112개 자산의 커밋 bytes 일치, 오류/예상외 요청0이다.
- 실제 KST 밤+밝은 테마에서 첫 전등ON, pointer/Enter/Space로 OFF→ON→OFF, 새로고침 뒤OFF 기억 확인. 전등/밥통 중심 일치, 넓은432px 방, 왜곡 없는 본체와 서로 다른5개 CRT 화면 decode/꺼짐 확인. root가 실제 공개 양조명 JPG를 직접 열어 커튼/창틀/가구/소파의 공통 조명을 확인했다. 앉은 배우 foreground와 제어한 낮/밤·양테마는 local native 증거다.
- 실제 상자의 장난감 발견1개, 네 도감 실루엣·점/좌우키·범위·ACK·두 행과 모바일 제외/한국어 global404도 확인했다. 모든write·telemetry는 차단했으며 예상한 하트 읽기POST2개도 실행하지 않았다. 실제 live-state GET/private manifest read0. 새 성격AI·전문 미술 승인·실제 로그인/RLS/OBS·공급자 한도 해결을 입증하지 않는다.

완료 상태는 로컬 문서에 반영했다. 같은 내용의 docs-only 추가push/재배포는 하지 않는다. 본인 소유3136 fixture 서버는 종료했다. 성격108+36 보고서는 사용자의 다음 방향 검토를 기다린다.
