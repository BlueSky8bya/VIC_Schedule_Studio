# 시청자 AI 빅타민

2026-10-15 KST. 소유자 요청: 연구 우선, 기본OFF, 달력 발판 이동·집기/아둥바둥·쓰다듬기·수면·하트 장난·배경 숨바꼭질, 수백 프레임 픽셀 모션. 기존 커밋/푸시/배포 승인 유효.

## 조사와 선택

- [Eon embodied brain](https://eon.systems/updates/embodied-brain-emulation), [FlyWire 논문](https://www.nature.com/articles/s41586-024-07763-9), [NeuroMechFly v2](https://www.nature.com/articles/s41592-024-02497-y): 신경 연결망/신체/감각·운동 모델은 연구 대상이며 인격 파일이 아니다. 초파리 뇌를 탑재했다고 주장하지 않는다.
- [GDC Utility AI](https://media.gdcvault.com/gdc10/slides/MarkDill_ImprovingAIUtilityTheory.pdf), [GameAIPro Utility+BT](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter10_Building_Utility_Decisions_into_Your_Existing_Behavior_Tree.pdf): 욕구/상황 점수·쿨다운·중단 가능한 행동 상태. 로컬 게임 AI를 선택, LLM/모델/DB 요청0.
- [Microsoft Agent Terrarium](https://commandline.microsoft.com/agent-terrarium-rust-human-agent-interaction/), [Shimeji 동작](https://github.com/TigerHix/shimeji-ee/blob/master/conf/behaviors.xml), [Red Blob graph navigation](https://www.redblobgames.com/pathfinding/a-star/introduction.html): 시뮬레이션/렌더/행동 분리, 드래그와 자율행동 우선순위, 보행/도약 가능한 발판 그래프.

## 제품 계약

- 설정 한 곳 `AI 빅타민`, 기본OFF. 시청자/비로그인/편집실 시청자 미리보기 공용. OFF면 루프/이미지 요청/뇌 상태 생성 없음. 실제 편집실과 onair에는 안 보임.
- 후속 요청 반영: 최상위 `빅타민` 설정 탭 안에 `움직임·장난·교감·성격` 하위 탭. 이동/점프/잠, 하트콩/계절숨기, 집기/쓰다듬기, 속도/크기/성향을 모두 조절. 전체OFF와 세부취향 저장을 분리.
- 고정 오버레이 한 마리, export1840 기하 불변. 화면 전체 빈 자리/일정 카드 윗면/날짜 칸을 인식. 점프는 발판 사이 탄도/명확한 착지, 제목 위에 눌러앉지 않음. viewport/scroll/월변경 때 갱신, 프레임마다 DOM 읽기 금지.
- 성격: 호기심·기력·친밀도·장난, 짧은 최근 행동 기억과 쿨다운. 걷기/깡충/둘러보기/하품/꾸벅/날짜 칸 잠/깨기/하트 콩/숨기/나오기. 손/발 없는 빅타민 구조 보존.
- 직접 입력 우선: pointer capture 드래그→버둥→안전 착지. 가까이 꾹 누른 채 작은 좌우 쓰다듬기→행복/작은 하트. 키보드 Enter/Space 애정, 화살표 이동, Esc 내려놓기 제공. 터치에서는 pet 자체만 touch-action:none.
- 자율 하트는 별도의 로컬 이펙트다. 실제 일정 하트/기대/북마크 클릭·카운트·서버 쓰기 금지. 텍스트/일정 내용을 외부 모델로 보내지 않는다.
- 배경 숨기: 기존 배경 선호값 보존, 한정된 일시 표시 lease만 사용. 모바일/낮은gfx에는 DOM 날짜 뒤 숨기 대체, ambient canvas 추가 금지. 숨은 동안 귀/작은 흔적, 자율 복귀 기한 존재. 설정OFF/새달/모달/숨김 탭/최초공개는 즉시 정리.
- 최초공개/상세/설정/다시보기/쇼케이스/숨김/ambient-pause에는 방해하지 않고 중단. 재개 시 누적 시간 따라잡지 않음. reduce-motion은 자리에서 표정 반응 중심, gfx등급은 fps/효과량 조절. 포커스 자동 훔치기/자율 소리 없음.

## 아트

실제 REF016/017의 두 귀·무사지 사각층 폼폼을 읽고 builtin1회로 16상태×16프레임(256셀) atlas 요청. 요청·실제 반환/유효 프레임 수·native SHA·파생/관찰을 별도 기록. 잘못된 셀이나 빈 프레임을 완성으로 세지 않음. 자동 다중 재생성/전문 미술 PASS 없음. 기존 응원단은 별도 유지.

## 단계와 검증

1. 순수 뇌/발판·상태 모델+단위 테스트. 2. 공유 설정/오버레이/관찰/입력. 3. 실제 픽셀 atlas 연결과 파생 검증. 4. 모달/최초공개/숨김/배경 lease·reduced/gfx/mobile 회귀. 5. type/lint/unit/build, 실제 fixture+POST차단 렌더와 상호작용, 독립 코드 리뷰, 운영 배포 확인.

성공 조건: OFF 비용0, ON 한 마리만, 직접 조작 우선, 수면/장난/이동/숨기 자율 선택, 실제 데이터 쓰기0, 달력 클릭/스크롤 유지, 분리된 원본/생성/표현 관찰. 픽셀 개수와 캐릭터 품질은 구분한다.

## 현재 결과

구현/로컬 검증 완료, 운영 배포 확인 중. [검증 기록](../verification/VIEWER_VICTAMIN-20261015.md): 단위65/렌더12/실제시청자2뷰, 기본OFF 자산0, 입력누수·키보드월이동·변한발판·quota복구 보완.256개유효셀과제작자관찰은미술승인과구별.
