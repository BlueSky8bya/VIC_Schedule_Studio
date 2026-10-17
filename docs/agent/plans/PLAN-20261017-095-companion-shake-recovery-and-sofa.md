# 빅타민 원형 흔들기·회복 표정·식사 재개·소파 반응

Status: Local verification complete; authorized release pending.

소유자 후속: 격렬한 원형/다방향 흔들기도 헤롱 상태로 이어지고, 회복은 웃는 얼굴이 아닌 어지러움을 털어내는 표정이어야 한다. 음식 접근 중 넘어져도 같은 음식을 다시 먹는다. 소파의094 박스/배지를 제거하고 그림 자체의 작은 확대·눌림으로 조작을 알린다.

- 흔들기: `held-shake.ts`의 perpendicular 방향 전환이 증거를 지우는 원인을 수정한다. 실제 시간16ms 표본·유한 기록·최소 이동/속도/지속 시간·한 gesture consume·만료는 유지하며 원/타원/대각/상하/불규칙 경로와 느림/떨림/단발 음성 사례를 검사한다. 새 tick/전역 입력/타이머는 없다.
- 회복: 기존 row23은 실제 웃는 입을 포함한다. 원본 설계를 보존하며 회복 구간의 찡그린 눈·물결 입→차분한 정상 눈 연결을 준비한다. 필요한 아트는 별도 한국어 회차/정확한 원본·파생 해시로 보존하고 실제 사용/등록/작은 크기 렌더를 확인한다. 기존 decoder2 in-flight/3 retained 예산을 유지한다.
- 먹이: 정상 경로에서 목표가 무조건 사라진다고 단정하지 않는다. 기존 meal에 대해 planner가 일시적으로 undefined/다른 음식을 주는 경우와 실제 제거·숨김·직접 조작 취소를 구분해 같은 ID 재접근을 보존한다. 가짜 먹기/보상·다른 음식 대체·사고 반복·무한 재시도는 허용하지 않는다.
- 소파:094의 배지/배경과 비확대 조항을 현재 요청으로 대체한다. 물리 버튼·2px 좌석·방/표면1840은 고정하고 로컬 그림과 포털 앞면의 같은 paint transform을 맞춘다. hover는 작은 확대, active는 눌림·release 복원; 키보드 포커스는 유지하고 reduced/off/soft는 움직임을 줄인다. 거주/들기/접힘/zoom 상태에서 앞면이 어긋나지 않아야 한다.
- 경계: 공유 viewer/studio/preview, 모바일 제외, 저장 선택·공개 DTO·역할·언락·KST·DB/의존성을 유지한다. 사용자 아트는 보존하며 새 서버 요청/모델 runtime/상시 loop를 추가하지 않는다.

검증: 관련 단위 검사와 전체 unit/typecheck/lint/build, 실제 production fixture native 원형 흔들기→낙하→회복, 동일 음식 사고→재접근→실제 소비·1회 보상, 소파 hover/down/up/거주 전경/quiet·양쪽 UI를 검증한다. 독립 소스·렌더 검토 후 승인된 commit/push/운영 확인을 진행한다. 실패와 미실행은 별도로 기록한다.

로컬 결과: 최종 main 전체 unit2,040·typecheck/lint·harness250·packet 재생성 check PASS. production fixture build/typecheck와 native29종을 재검증까지 확인했다. 관련64파일 exact SHA 및893개 추적 코드의 EOL 제외 내용 일치를 확인했고 독립 source/raw 검토 차단0이다. 원형/음식 fixture와 최종 소파 CSS fixture, 실패 시도·준비 전제 교정·별도 재보행/실제 OBS 장비 등 검증 한계는 [검증 기록](../verification/COMPANION_SHAKE_RECOVERY_SOFA-20261017.md)에 분리한다. 승인된 main commit/push·remote quality/Vercel·운영 확인은 다음 단계다.
