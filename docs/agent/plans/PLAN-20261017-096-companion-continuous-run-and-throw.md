# 빅타민 목표까지 이어 달리기·관성 던지기

Status: Ready for authorized release. Unit2,087/typecheck/lint/build/harness252 and33 distinct native cases verified; actual viewer-focus1case remains a documented preparation/OS-focus evidence gap. [Verification](../verification/COMPANION_CONTINUOUS_RUN_THROW-20261017.md).

소유자 후속: 달리기가 약1초마다 멈추는 문제를 고치고 대부분 목표까지 이어 달리게 한다. 직접 잡아 던지면 실제 놓는 속도로 포물선을 그리며 날고, 새 공중 표정/포즈와 자연스러운 착지·회복으로 연결한다. 이전092/093의 짧고 긴 구간 혼합만으로 목표까지의 연속성을 충족했다고 보지 않는다.

- 진단: 현재 목표 선택·구간 상한·속도/종별 차이·다음 구간 사이 재추첨과 대기, pointer release 속도·낙하/첫 발판/화면 경계 경로를 각각 조사한다. 추측을 재현 결과로 쓰지 않는다.
- 달리기: 실제 안전 발판·연결 가능한 경로에 유한 목표를 기억하고, 같은 목표로 가는 중에는 구간 종료마다 일반 AI/idle로 넘기지 않는다. 끝·막힌 길·입력/식사/귀가·모달/비활성·공연·월/기하 변경과 quiet 정책은 우선한다. 안전 도약과 짧은 자발적 머뭇거림은 구분하며 매 구간 강제 정지를 만들지 않는다.
- 던지기: 실제 pointer 표본의 유한 속도를 캡/만료해 놓는 순간만 소비한다. 같은 공유 tick에서 중력 포물선과 실제 경로의 첫 하강 발판 교차를 계산한다. 워프·공중 발판·새 상시 루프/폴링은 만들지 않는다. 기존 잡은 부위·몸체 경계·나선 눈·취소/재잡기·소파 앞면·감소/OFF·모바일 제외를 보존한다.
- 공중 아트: 원본 두 귀·무사지 폼폼 설계로 발사/상승/정점/하강의 새 키 포즈를 단일 builtin 회차에서 제작한다. 실제 원본 열람·원문/계약/도구 입력·native·파생/등록·실제 사용을 분리한다. 기존 회복 그림/회차는 보존하고 자동 전문 미술 승인이나 수백 장 새 원화 주장을 만들지 않는다. decoder2 in-flight/3 retained 한도를 유지한다.
- 검증: 먼저 기존 build에서 실제 연속 이동/던지기 결함을 포착한다. 단위 검사로 목표 도착/중단/시간 독립 궤적·발판 교차/경계/취소를 검사하고, production fixture의 native pointer와 실제 좌표·프레임·상태 전환으로 달리기 정지 횟수/도착·포물선·첫 착지·새 포즈·나선 연속성을 확인한다. 공유 viewer/studio/preview, 저장 선택·모바일 제외·권한/공개 DTO/언락/KST/DB/의존성은 바꾸지 않는다.

독립 소스/QA 검토 뒤 main 통합·전체 unit/typecheck/lint/build/harness와 승인된 commit/push/운영 검증을 수행한다. 실제 OBS 장비/전체 난수/모든 장치는 별도이며 미실행은 PASS가 아니다.
