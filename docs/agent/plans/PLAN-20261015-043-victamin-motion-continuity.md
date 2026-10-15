# 빅타민 이동·스프라이트 연속성

2026-10-15 KST. 사용자: “빅타민이 왜이렇게 치지직 거리고 툭툭 끊기고 얼굴 방향의 반대로 이동하지? 뭔가 부드럽지가 않아.” PLAN041/042의 기능 검사와 움직임 품질 검사를 구별해 보완한다. 기존 커밋/푸시/배포 승인 유지.

## 확인한 원인

`viewer-companion.tsx` paint는 정수 좌표, 방향 반전 없음. rAF게이트는 full30/lite12와 잔차 버림으로 이동 자체를 끊는다. 전역 now/action age/고정1500ms가 섞여 clip이 중간에서 시작하고, geometry callback은 움직이는 중에도 idle0을 그린다. 매 걷기는 smoothstep 출발/정지+450ms 대기를 반복한다. 점프 상승/하강행은 전체 비행 위상을 공유하고 180ms 준비에16셀을 압축한다. native1254²→16등분 파생은256개 비어있지 않은 셀만 검사했고 중심·발기준·시각 loop 연속성은 입증하지 않았다. 알파/실제 프레임 수치는 별도 확인한다.

## 수정 계약

- 위치 이동과 그림 교체 주기를 분리. 위치는 full rAF/lite30, subpixel·시간 기반. 그림은 낮은 주기와 clip별 loop/hold/entry로 관리. 모델 판단·저장·DOM관측은 무거워지지 않게 유지.
- 방향은 실제 수평 이동을 따르며 sprite만 반전. 메뉴/효과/입력좌표 불변. 세로 이동/정지 때 방향은 안정적으로 유지한다.
- geometry는 기하 상태만 갱신, 첫 배치 이외 paint를 끼워 넣지 않는다. 연속 먹이 경로의 불필요한450ms 멈춤을 제거하고 걷기 위상을 거리로 이어간다. 점프 각 단계는 독립적인 준비/상승/하강/착지 위상.
- 현재 원본/기존 파생을 보존. 프레임 정렬/loop 품질은 alpha·중심/기준점과 실제 재생으로 확인하고 필요한 경우 별도 파생/매핑을 기록한다. byte-distinct256을 부드러운256프레임으로 주장하지 않는다. 새로운 토리 얼굴/캐릭터 AI생성은 이번 기본 해법이 아니다.
- 기본OFF/공유시청자 구현, reduced/gfx/mobile·드래그/돌봄/하트경계·중단복귀 유지. DB/API/권한/unlock/KST/1840기하 변경 없음.

## 검증

좌우 보행/점프 facing과 메뉴 무반전, full/lite 실제 위치 갱신 간격·최대 순간이동, 클립 진입/loop/점프단계 위상, 하트 metadata 변경 중 idle혼입0, 메뉴/숨김/집기/먹기 회귀. 정지 그림만 보고 움직임 합격으로 처리하지 않는다. production fixture의 프레임 연속 캡처와 재생 관찰, 실제 운영2뷰, type/lint/unit/build·독립 코드 리뷰 후 승인된 배포 확인. headless cadence와 실제 사용자 기기 체감은 구별한다.

[rAF 공식 문서](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame): repaint 시각·timestamp 기반 진행/숨김 중단. [image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/image-rendering): 픽셀 샘플링과 이동 주기는 서로 다른 문제다.

상태: 수정·독립 코드 리뷰·최종 build/type/lint·unit73·fixture rendered33·실제 root2뷰 완료. 같은브라우저 기존운영/수정본 비교에서 위치갱신37~39%→100% 확인, 기기 일반화하지 않음. 승인된 운영 배포 확인 대기. [검증 기록](../verification/VIEWER_VICTAMIN_MOTION-20261015.md).
