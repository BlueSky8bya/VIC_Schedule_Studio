# 빅타민 집 퇴장·최초공개 카드 입장·공개 카드 귀환

2026-10-16 KST. 최신 소유자 요청. 기존 최초공개 안무와 선택형 빅타민을 한 장면으로 연결한다.

1. 켜진 빅타민 집/compact 집·launcher는 기존 `data-pm-exit=5` 순서로 다른 패널과 함께 사라진다. 최초공개 시작 즉시 `blocked`로 집을 unmount하던 연결을 제거한다. 실제 자기 root의 portal만 등록하고 원래 inert/aria/style을 복원한다. 최신 소유자 추가 요청에 따라 단순12초 fade/up 대신 짧은 준비 반동→가까운 화면 가장자리로 호를 그리는 이동→살짝 접히는 깊이감→후반 감쇠를 적용한다. 실제 영역 기하를 최초/resize에만 측정하고 transform/opacity만 쓴다. 같은 그룹은 작은 순차 간격, 귀환은 기존 spring. 필터 퇴장과 달력 확장을 이어 빈 자리가 오래 남지 않게 한다. ambient의 fixed 포함 블록은 기존 fade 예외를 보존한다.
2. 빅타민 ON일 때만 같은 단일 renderer가 공연용 표시 소유권을 받는다. 평소 world/brain/food/hearts는 조용히 멈추고 숨김 탭·showcase·다른 창/ambient owner는 계속 차단한다. 자신의 정확한 최초공개 ambient owner와 page inert만 공연 표시에서 구분하며 일반 조작은 허용하지 않는다. 집/발판이 사라지는 동안의 표시 대기는 안전한 고정 위치로 두어 새 상시 측정/두 번째 rAF를 만들지 않는다.
3. 기존 지휘자의 공개 phase/target/ID/state만 소비한다.73→69초에 실제 보이는 떡밥 placeholder로 유한 이동·축소 진입을 마쳐68초의 기존 카드 gather/merge/expand보다 앞서 연결한다. 일반 숨바꼭질의 떡밥 제외 규칙은 유지하고, 이 전용 경로도 기하와 공개 마감만 쓴다. 이미 늦게 입장했거나 카드가 없으면 뒤늦은 비행 대신 현재 단계에 조용히 합류/생략한다.
4. 무대에서는 새 캐릭터나 renderer를 만들지 않는다. 기존 응원단 한 자리와 합류 상태를 연결하고 기존 응원봉·마지막10초 관람/8초 정지·음악/설정 곡선을 따른다. 빅타민 OFF면 기존 무대가 그대로 동작한다.
5. 공개가 확인된 뒤 명시적 ‘일정표 보기’ 버튼으로 나올 때만 입장했던 공개 일정(없으면 보이는 공개 cohort 중 하나)에서 한 번 통 튀어나온다. X/Escape/history/상세 보기/자동 중단과 구분한다. 실제 카드가 현재 달에 없거나 필터/삭제/가림 상태면 안전한 기존 위치로 복귀하며 강제 달 이동·스크롤·클릭은 하지 않는다.
6. 동시·연쇄 공개에도 한 마리/한 합류/한 귀환. 공개 시각 변경·cohort 교체·삭제·취소·설정 OFF·month/unmount에서 generation과 유한 cue를 정리한다. 숨김 복귀나 시계 보정은 현재 장면에 착지해 과거 비행을 재생하지 않는다. 감소동작·gfx soft/off·모바일은 기존 무대 정책과 실제 가시 기하에 맞춰 축소/생략한다.

검토 후 소유권을 통일했다. 레일 집과 compact 집 모두 React가 inactive/inert/aria를 전담하고 지휘자는 표시 안무만 맡는다. 동적 마운트 시 이미 잠긴 값을 캡처해 종료 후 다시 잠그는 충돌을 막기 위해 초기의 compact 외곽만 지휘자가 잠근다는 내부 설계를 대체한다.800ms 귀환도 집은 mounted/inactive 상태로 끝까지 이어지며, 비공개/다른 창의 잠금을 해제하지 않는다. 같은 레이아웃 안의 창 크기 변경도 기존 resize 사건에서 캐시 경로를 취소/재검증하고 별도 상시 측정은 만들지 않는다.

공개 전 제목/태그/실제 일정 시각·event 객체를 연결 계약에 넣지 않는다. 서버/DB/공개 경로·캐시·폴링·생산 의존성 변경0. 현재 곡선·FLIP·동일 renderer·공유 공개 구현·기본OFF/92px/1840 표면을 유지한다. 순수 상태/경계 단위, 실제 시간 PC/native/compact 퇴장·T73→68 순서·동시/변경/취소·OFF/숨김·명시적 귀환과 noPOST/DTO 검사를 시행하고 기존 승인 범위에서 commit/push/배포 확인까지 진행한다.

퇴장 설계 근거: [Apple Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion)의 상태 간 연결 추적과 짧고 목적 있는 움직임, [Material Motion](https://m3.material.io/styles/motion/overview/how-it-works)의 공간 관계·물리적 반응을 참고한다. 이를 그대로 복제하지 않고 현재 패널 형태·공유 spring·귀여운 시청자 톤에 맞춘 구현 판단이다. 과한 회전/섬광/전역 filter나 이미지 생성은 추가하지 않는다.

실제 모바일 검사에서 퇴장 요소가 layout viewport를814px까지 늘리는 결함을 발견했다. 물리 client∩visual viewport로 기하를 계산하고 html과 body 모두 overflow-x:clip을 적용한다. root 단독 clip으로 해결됐다는 초기 판단은 폐기했다. 마지막 cleanup 뒤700ms 유한 clip으로640ms 귀환을 끝낸 뒤 원래 상태를 복구한다. 참조수/재개 시 timer 취소로 다른 공연의 clip을 해제하지 않는다. 세로 overflow는 visible, sticky와1840 표면 기하는 유지한다. 토글은158→156.2초에 퇴장하고 배지는156→152초에 연결한다.

## 결과

완료. `8f4dcd46` 커밋·푸시·Vercel 운영 배포와 실제 익명 공개 PC1920/native390 검사를 확인했다. 최종 build/lint/type, 관련37파일385단위 통과. 최초공개6사례는 최종 첫 실행4개+정상 친밀도 감소 검사 기준 교정 후 해당2개 재실행으로 통과했고, 기존 무대5개는 한 실행 통과했다. PC/native 실제 퇴장 중간 PNG를 직접 검수했다. root 단독 clip 실패 등 이전 실패와 실제 기기/OBS 미검증 범위를 [검증 기록](../verification/VIEWER_VICTAMIN_HIDE_PREMIERE-20261016.md)에 구분했다.
