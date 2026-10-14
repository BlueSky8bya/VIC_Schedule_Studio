# 빅타민 돌봄 검증 · 2026-10-15 KST

[PLAN-042](../plans/PLAN-20261015-042-victamin-care.md), [ADR-0031](../decisions/ADR-0031-viewer-victamin-local-companion.md). 기존 배포된 동행([검증](VIEWER_VICTAMIN-20261015.md)) 위에 현재 사용자 요청을 구현했다. 이전 커밋·푸시·배포 승인을 적용한다.

## 구현

- 사람 하트와 별개인 보라 표식/작은 별. 인간 선택·카운트·실제 handler/서버 요청 무변경. 인간 또는 pet 하트가 이미 있으면 파문과 아쉬운 기존 자세. 최대128개 명시 공개ID만 기기 기억, 제목/태그/신원/시각 저장 없음. 뇌에는 ID를 보내지 않는다. 인간 하트가 나중에 켜지면 보라는 제거한다.
- 메뉴 사과/레몬, 최대3개, 드래그/클릭배치/키보드 이동·놓기·삭제/치우기. 손에 든 먹이는 추격 대상에서 제외. 가까이서는 냄새 자세→기존 happy/nibble 동작·열매 축소→완료 때 한 번만 먹기 정산. 멀면 실제 도달 가능한 다단 발판 경로로 접근. 배부르면 기존 놀이·휴식 선택을 유지한다.
- 배고픔/애정/기력/호기심 네 수치만 기기 로컬v1, 활성 시간만 증가. 부재 페널티 없음. 저장 성공/실패 시도 모두5초 예산, 식사 완료/정리 강제 저장. 저장 차단/할당량 실패는 메모리로 지속.
- 설정→빅타민→성격의 기본/고양이/강아지 단일 선택, 교감→밥주기ON/OFF. 이전v1 선호 호환, 전체 기본OFF 유지. 고양이는 높은 자리·짧은 관찰·거리 있는 접근, 강아지는 가까운 접근·냄새 탐색 가중치. 실제 동물 정밀 모델/신경망/학습을 주장하지 않는다.
- 기존256셀을 재사용했다. 새로운 래스터 생성·원본 수정·미술 승인 없음. 먹이 두 종류는 시스템 이모지이며 OS별 모양이 다를 수 있다.

## 검사

- typecheck/full lint/최종 production fixture build 통과. 최종 입력 중단 수정 후 아래 전체 렌더를 같은 빌드에서 다시 확인했다. 의도적 포스터 기준선 변경 없음.
- 관련 단위63/63: brain13, feeding11, preferences14, care6, food3, heart3, ambient11, publicDTO2. 욕구 경계/정산, 모드 가중치, BFS도달성/로밍·점프OFF, 명시 저장allowlist/quota 재시도, 제거·이동된 먹이 발판 포함.
- 최종 렌더29개 통과: 기존동행9+설정3, care8, 순수DOM하트어댑터3, 실제fixture하트실행2, 중단/복귀4. 기본25는 한 실행2.2분, 추가중단4는 같은 최종 빌드에서13.7초. POST를 차단하고 시험 DB 쓰기0. 먹이 소비 후 초점 복귀도4개 PC/mobile 식사 검사에 포함.
- care8: PC1440/모바일390 × 사과/레몬, 배부르면9초 미섭취,3개 상한·치우기, 드래그·1.2초 누른 배치에서 하트/일정 클릭0, 설정pause·feedingOFF·월 변경, 먹기 중 메뉴3.1초 열어도 음식/욕구 정산 없음→닫으면 새2.6초 연출. 초기 실행은 모바일 locator·바닥 가정·agenda 진입 중 드롭 안정화 문제를 고쳤고 최종8/8을 별도로 확인했다. 실제 제품의 빠른 키 입력 focus race는 useLayoutEffect commit focus로 수정했다.
- 실제 하트 실행2: 합성 공개 버튼을 실제 fixture 카드에 놓고 로컬 Utility AI의18초 성숙을 실제 시간으로 기다렸다. 추가→실제 보라 CSS·인간aria=false·카운트17·native click0, reload 기억과 차단, 이미 인간aria=true이면 막힘·색상/카운트/클릭 보존. 별도어댑터3은 실제소스를 격리DOM에서 실행했으며 실제 페이지 검사와 구분한다. 운영 투표/RLS 검증 아님.
- 독립 코드 리뷰에서 quota 재시도, 식사 중 메뉴시간 정산, 먹이 소비 후 초점, 드래그 중 숨김 정착, reduced 경과시간, OS별 동작 독립 gate, 메뉴/키보드/점프 중 중단의 공중정지를 보완했다. 최종 재검토에 확정 차단 없음. 추가4: reduced공중집기→메뉴낮잠/안착, hidden이벤트hold해제/복귀·재집기, 실제자율점프 중 메뉴1.25초 동결/재개·착지, 음식pointercapture중hidden→캡처해제·바닥안착·추종종료. OS/device tab throttling 검증 아님.
- 실제 로컬 `/` PC1440/모바일390: 기본OFF atlas0, ON1280decode·직접교감·설정pause/OFF·선호저장·pageerror0. 두 context 각각 POST1 차단, 실제 쓰기0. 과거달 조회만, 시험데이터 생성0.
- 최종 로컬 실제 `/` 돌봄 smoke2뷰: 기본OFF atlas0→ON→바로 방향키 밥 배치에서도 월 불변·먹기/포만·애정 저장·actor초점 복귀, 강아지설정 저장/전체OFF, pageerror0. 각context POST1차단/실제쓰기0. `.scratch-pw/companion-care-root-local.json`, `companion-care-local-{1440,390}.png`. 설정 성격/메뉴/먹기 PC·모바일 캡처 확인. 조기 캡처의 비어 보인 그룹은 진입 애니메이션이 끝난 후 재캡처해 구분했다.
- `harness:verify`는 기존2개 실패(active-rule IDs / RULE_MIGRATION inventory) 그대로. 새 실패 없음.

## 한계·운영

동작/시각 확인은 headless Chromium PC·모바일 viewport다. 실제Safari/장시간 배터리/사용자 HCI연구/256셀 독립 미술 검수 아님. DB/API/역할/unlock/KST/1840기하 변경 없음. 기기 저장 삭제 시 돌봄·pet하트 기억도 초기화된다. 기존 harness2실패는 별도 기록하며 현재 검사를 통과했다고 바꾸지 않는다.

제품 `88e75d3ead8eee6bb9947d9983763e62508e5889` [Vercel success](https://vercel.com/bluesky-s-project3/vic-schedule-studio/H3yZygfyZnt1X3xxhvKSFmHxytv8), live build SHA 일치. 운영 실제 `/` PC1440·모바일390에서 기본OFF atlas0→ON→사과 배치·섭취/포만·애정 저장·초점/월 보존→강아지 성향 저장→전체OFF, pageerror0. 각context POST1 차단/실제쓰기0. 과거달 조회만, 시험데이터 생성0. `.scratch-pw/companion-care-root-production.json`, `companion-care-production-{1440,390}.png`. 운영 하트 쓰기/RLS/실기기 검증으로 확장해 주장하지 않는다.
