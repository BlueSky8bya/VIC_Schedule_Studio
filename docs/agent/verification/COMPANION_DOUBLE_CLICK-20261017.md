# 빅타민 더블클릭 위치 선택 제거

Status: Final local verification complete — authorized companion follow-up release pending.

소유자 요청: 빅타민 더블클릭의 십자선이 이동 기능이면 직접 드래그와 겹치므로 없앤다. 이 변경은 직전 빅타민 수정/운영 배포의 후속이다. 사용자 아트와089 사후 기록은 보존한다.

## 원인과 변경

공유 `viewer-companion.tsx`의 `onDoubleClick`이 `control.place()`를 호출해 `data-placing`을 붙이고 CSS crosshair를 표시했다. 그 호출과 스크린리더의 ‘두 번 누른 뒤 놓을 곳 선택’ 안내만 제거한다. 이중 클릭의 기본 동작/상위 전파 차단은 유지한다. 직접 드래그·P 위치 선택·Space/방향키/Escape 이동, 일반 모달 뒤 수면·팝오버 게스트·현재 frame/관성/흔들기/귀가/편집창 닫기 처리는 변경하지 않는다. 새 저장값·타이머·아트·서버 호출·권한/공개 DTO·KST·1840 기하 변화는 없다.

은퇴한 입력을 사용하던 테스트는 실제 입력으로 바꾼다. 일반 위치 선택 helper는 P를 사용하고, 모달 안에서는 P가 차단되는 기존 소유권을 유지해 double-click 무배치 확인 뒤 실제 grip-offset 드래그로 검사한다. 기존 modal focus·첫 실제 카드 착지·무숨김·quiet budget0·닫기 검증은 남긴다. 정상 세계의 viewer/studio × full/lite/reduced/off에도 double-click 무배치/십자선 없음과 기존 빠른 놓기/스크롤을 함께 확인한다.

## 검증과 전달

격리 production fixture build `cfCP-G3Tdqo5ki_v8G-I2`, 전체 unit1,950/1,950(skip0)·build/typecheck·격리/메인 전체 lint PASS. 실제 화면21/21, retry/skip/flaky0이다. 정상 세계 viewer/studio×4모드의 double-click 무배치/십자선 없음→빠른 drag/drop/scroll8개와 최신 native up2개, 일반 창 뒤 같은8모드의 double-click 위치/focus 유지→실제 drag 2회→수면 quiet budget0/닫힘8개, 추가 노출 수면 집기/첫 카드 낙하/키보드 P·Space·Arrow·Escape·인접 실제 제어권3개를 확인했다. modal 안 P를 열어 테스트를 통과시키지 않았다.

독립 소스 검토 blocking0, 원래 데이터/기하/모달 소유권 단언을 보존했다. 제품 변경은 renderer의 두 줄뿐이며 회귀 검사5파일과 renderer, 총6파일을 메인에 선택 통합했다. 이전089부터 필요한27개 build input의 바이트 일치를 확인했다. 대표 studio 창/수면 drag PNG도 검수했다. 문서 harness240개 PASS. 원본과 report/unit/manifest는 ignored 작업트리 및 메인 `.scratch-pw/companion-090/`에 보존한다.

테스트는 쓰기를 차단한 합성 일정 fixture를 사용했고 실제 운영 일정/권한/저장 설정을 바꾸지 않았다. fixture/독립 검토는 실제 OS/OBS/RLS 전수 증거가 아니다. 원격/실제 운영 결과는 배포 뒤 구분해 기록한다.
