# PLAN-034 — 함께 기다리는 최초공개

2026-10-14 KST. 범위: 기존 공유 무대의 캐릭터 반응·응원단·선택형 오리지널 BGM. 공개 데이터/DB/권한/1840 캔버스 변경 없음. 이전 세션의 커밋·푸시·배포 승인 유지.

## 결정

- 기대 ON: 토리님의 환한 표정과 작은 국소 광채. OFF: 잠깐의 장난스러운 반눈 표정 후 원래 초상 복귀. 클릭 의도에만 반응하며 서버 재조정/실패에는 표정 벌칙 없음. 수치·가짜 관객·죄책감 문구 없음.
- 원본 설계를 따른 빅타민 응원단: 개체별 위상/높이/기울기, 응원봉은 사각층에 부착. 원본에 없는 팔다리를 만들지 않음. 작은 앞줄과 뒤줄, 버튼 반응 시 한 차례 파도타기. 모바일은 개체 축소, lite 수량 축소, soft/off 정적 또는 생략.
- 별도 ‘응원봉 흔들기’는 로컬 파도타기만 실행한다(800ms 간격 상한). 기대 ON/OFF나 DB 쓰기 없이 반복해서 함께 놀 수 있다. 숫자/관객 집계/점수/미니게임 없음.
- T−68~18: 음악과 응원 동작이 실제 남은 시간에 따라 고조. T−18~10: 응원봉을 낮추고 관객석으로 내려앉으며 조명·장식·보조 정보 퇴장. **T−10부터 오직 숫자에 집중**: 장식/표정/음악/보조 버튼 없음. 항상 접근 가능한 일정표 보기/Escape는 유지. PLAN-033의 보조 UI 10→2초 퇴장은 이 계약으로 대체; 숫자 확대/링 소멸 10→2초는 유지.
- BGM은 YouTube 음원을 복사하지 않고 직접 작성한 협화음 패턴을 기존 sfx 단일 AudioContext/출력 버스로 합성. 사용자가 무대의 음악 버튼으로 시작. 전역 음소거·축하 카테고리·볼륨·숨김 탭·무대 닫기·일정 변경/삭제·10초 경계에 즉시 중단. 자동재생 우회 없음. 다른 탭 저장 변경도 반영.
- 기존 읽기 수동 종료/같은 화면 다시 보기/DB 판정 공개/동시·연쇄 일정/공유 시계/FLIP 경로 보존. 새 네트워크/DB 폴링 0.
- 퇴장하는 article의 inert와 실시간 시청 판정을 분리한다. 실제 표시 중인 공통 숫자 무대가 pending cohort를 관측하며, hidden/return 프레임은 관측에서 제외한다. 모든 article은 masked/released 전환 내내 같은 retreat 관리에 남아 재잠금/최종 읽기의 native inert·aria를 복원한다.

## 조사와 구현 연결

[YouTube Premiere](https://support.google.com/youtube/answer/9080341?hl=en)의 함께 기다리는 시청 페이지와 별도 카운트다운 테마를 참고하되 그 영상·음악·UI를 복제하지 않는다. [YouTube 운영 가이드](https://support.google.com/youtube/answer/12356784?hl=en)의 기다리는 동안의 참여를 기대 버튼과 캐릭터 반응으로 적용한다. 실시간 채팅/가짜 참여 지표 추가 없음.

[Apple audio-haptic design](https://developer.apple.com/videos/play/wwdc2019/810/)의 인과가 보이는 피드백과 고조 후 단절, [Lehne & Koelsch](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00079/full)의 기대→해소 모델을 설계 근거로 삼는다. 재미/시간 지각 개선은 이 제품에서 검증된 결과가 아닌 설계 가설이다. [MDN Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)의 사용자 제스처/음량 제어를 따른다.

캐릭터: 사용자 지정 Drive 레퍼런스 실제 열람, VIC 일러스트 헌법에 따른 1회 제작/초안 관찰/원본 보존. 새 생성물이 원본/사용자 승인/정밀 동일인 인증이라는 주장 없음. 생성 prompt·출처·파생 좌표/해시를 함께 기록.

## 순서와 검증

1. 참조/권리/캐릭터 설계 조사, 초안과 provenance 보존.
2. 공유 scene/동작 곡선/오디오 수명 구현. 기존 서버 경로 무수정.
3. 타입·lint·관련 단위·production build. 실제 fixture의 PC/agenda/landscape, ON/OFF/연타, 10초 경계, 음악 권한/중단, 숨김·삭제·미룸·재진입·수동 읽기, 1840 기하 확인. 브라우저 모든 POST 차단/합성 과거 달 사용.
4. G-21 독립 코드 검토 후 통합, 승인된 커밋/푸시, 실제 배포 SHA와 공개 페이지 합성 smoke 확인.

## 위험/미검증

생성 초안의 동일인성/축소 가독성, 오디오 장치별 음색·자동재생 정책, 참여 강도의 주관적 만족. 캐릭터는 의미 정보를 가리지 않고 상한 수량, 장식 aria-hidden. 소리는 전역 잠금을 우회하지 않는다. 섬광 추가 없이 작은 광채만. 기존 전역 harness 2건/실기기·실계정·RLS·provider 검증 공백은 별도 유지.

## 검증 상태

타입/lint/production build, 관련 단위·메모리 119, fresh-build 브라우저 86, 일반 `/` PC/agenda 합성 smoke PASS. 시각 baseline 3장 의도된 변경 확인, 읽기 baseline 유지. 독립 검토 지적 및 공개 관측 회귀 수정 후 전체 재실행 완료. 배포는 승인된 main push 후 확인. 상세 실패/수정 이력·범위는 [QA](../verification/TEASER_COMPANY-20261014.md).
