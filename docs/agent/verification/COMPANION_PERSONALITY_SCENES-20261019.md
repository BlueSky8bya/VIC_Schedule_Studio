# 빅타민 성격·생활 장면 실행 감사137

2026-10-19 KST. 상태: 구현·로컬·실제 공개 출시 검증 완료.

현재 사용자의 보고서 전부 적용 요청으로135/136의 신규 성격·장면 제안 대기를 대체했다. [원본 보고서](../reports/REPORT-20261019-136-personality-scenes.html)의108장면·36결합을 고유 ID 그대로 실행 카탈로그에 연결한다. 원본은 수정하지 않는다. 원본 SHA256: `c220eb832d5d901c14547d3cbc394012fd95880c3128e72bb0e52f3c3677e602`.

## 실행과 소유권

성격은 재롱둥이·탐험둥이·애교쟁이·잠꾸러기·깔끔이·사고뭉치·먹보·집돌이·둥글이다. 기존 curious 저장 ID는 유지하고 balanced를 추가했다. 설정 안에서는 선택 즉시 등록된 대표 포즈와 설명을 미리 보여 준다. 세계 배우는 실제 직접 조작·착지·기존 운반을 보존하며, 안전한 다음 선택에서 대표 준비 동작을 시작한다.

- 기존 단일 활성 시계와 몸·음식·장난감 소유자를 사용한다. 디렉터는 실제 조건의 현재 스냅샷에서 하나의 유한 의도를 고른다. 최근3장면 제외, 동일 직전 장면 제외,7.5초 무진행 취소,60초 전체 의도 예산을 둔다. 실제 목적 있는 이동은 현재 좌표 변화로 확인한다.
- 준비 표현과 완료는 구분한다. 실제 먹기·정리·물건 생성·가구 선택은 실제 효과의 성공 ACK만으로 다음 단계에 간다. 이동 완료/표현 시간 경과로 소비·발견·학습을 만들지 않는다. 물건 ID는 접근·들기·운반·전달 동안 고정한다. 사용자 선점/삭제 시 다른 실물을 대체 생성하지 않는다.
- 장난감은 실제 상자 입구 전달과 same-ID stash, 음식은 실제 섭취/집 안 안전한 빈 자리/포만·비최애 조건의 쓰레기통 전달을 사용한다. 먹이0+실제 허기에는 현재 밥통으로 가서1개만 꺼낸 뒤 공급 의도를 끝낸다. 기본8음식·4장난감 상한을 유지한다.
- TV는 실제5채널/공용세션 상태를 쓴다. 전등은136의 공용 영속 bool 저장을 쓴다. 사용자 수동 선택은15초 우선한다. 감상 전 소파로 실제 복귀하며, 이미 맞는 가구 상태는 불필요하게 다시 조작하지 않는다. 창가 감상은 커튼을 실제 열고, 강한 여름 햇빛의 집돌이는 닫은 작은 극장을 만든다.
- 씻기는 실제 패드에서 등록된 몸 포즈의 입 좌표에 칫솔을 맞추고500ms 이상 가시 접촉을 확인한다. 패드의 몸 전용 측정점은 bodyOnly로 표시해 작은 물체의 착지/보관/일반 가구 접근에 쓰지 않는다.
- 공개 일반 편집중에는 내용 없는 boolean만 읽고 패널 바깥 실제 안전 자리에서 성격별 표현을 한다. 입력 focus/텍스트/포인터를 빼앗지 않는다. 저장·undo/redo 반응은 기존 직렬 쓰기의 실제 서버 성공 뒤 고정 kind 한 개만 전달한다. 비공개·teaser·혼합 이력 묶음·실패/전송 없는 쓰기는 완료 신호가 없다.
- 실제 달력 월의 계절과 공용 KST/날씨, 실제 소리/쓰다듬기/식사/재회/옷 경험을 사용한다. 미경험·최근 장난감, 새 음식 부류, 최애·보관 ID, 실제 중단 원ID를 조건/대상 선택에 반영한다. 학습OFF에서는 회상·사회/시간 학습 단서를 사용하지 않고 새 경험을 학습하지 않는다. 기존 공용 음식 취향 판정은 유지한다. 현재 실물 운반/보관 소유권은 계속 보호한다.
- 마스터OFF·roamOFF·숨김·감소모션/gfxOFF·직접 조작·공연/보통 모달은 상위 우선권이다. sleepOFF에서는 잠을 제안하지 않는다. 사용자 입력/기존 유한 운반을 취소하면서3초 반응을 강제하지 않는다.

## 원본별 실행 대응

각 행의 조건은 원본 계약과 디렉터의 세부 guard를 함께 쓴다. 선택 가능한 상황을 만들기 위해 경험·실물·성공을 위조하지 않는다. 조건부 단계는 실제 대상/경로가 없으면 넘어가며 성공 효과로 기록하지 않는다. 순서에 있는 포즈는 기존 등록 몸 그림/접촉 샘플러를 사용한다.

### 재롱둥이 (performer)

누군가에게 보여 주는 작은 공연을 스스로 열고, 마지막 인사와 소품 반납까지 마치는 친구. 움직임의 크기보다 관객을 향한 시작과 끝이 특징이다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| P01 | 돌아온 사람을 위한 작은 개막식 | arrival | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow → 이동:floor |
| P02 | 마라카스 한 개로 여는 소품 무대 | toy | 실물장난감:inspect(maraca,tambourine) → 이동:floor → 실물장난감:play(maraca,tambourine) → 표현:cheer-rehearsal → 표현:bow → 실물장난감:return(maraca,tambourine) |
| P03 | 음악 한 구절을 받는 짧은 응원 | music | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow |
| P04 | 잘 끝난 공개 작업에 축하 한 번 | work | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow → 이동:floor |
| P05 | 앵콜은 딱 한 번, 다른 재롱으로 | pet | 표현:celebrate → 표현:bow → 표현:groom |
| P06 | 공과 맞춰 통통 | toy | 실물장난감:toss(ball) → 감상0.7초 → 이동:toy → 표현:celebrate → 표현:bow |
| P07 | 기차 옆 행진 | toy | 실물장난감:play(train) → 이동:toy → 표현:bow |
| P08 | 별 지팡이 소개 | toy | 실물장난감:inspect(star-wand) → 표현:cheer-rehearsal → 표현:bow → 실물장난감:return(star-wand) |
| P09 | 굴러도 마지막 인사 | recovered | 표현:shake → 표현:bow |
| P10 | 새로 입은 액세서리 자랑 | outfit | 표현:celebrate → 표현:bow → 표현:groom |
| P11 | 관객 없는 연습 | free | 표현:cheer-rehearsal → 표현:bow |
| P12 | 빛 아래 작은 무대 | tv | 이동:floor → 표현:cheer-rehearsal → 표현:celebrate → 표현:bow |
| X-P-house | 재롱둥이 · 집·TV·빛·씻기 | tv | 감상1.8초 → 이동:floor → 표현:cheer-rehearsal → 표현:bow → 실물장난감:return(조건부) |
| X-P-editor | 재롱둥이 · 편집하는 사람 곁 | work | 표현:celebrate → 표현:bow |
| X-P-music | 재롱둥이 · 실제 음악 | music | 표현:cheer-rehearsal → 표현:bow |
| X-P-return-time | 재롱둥이 · 귀가·재회·시간대 | arrival + experience + night | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow → 이동:floor |

### 탐험둥이 (curious)

새로운 대상의 원인과 결과를 한 번 확인하고 만족하는 관찰자. 이동 거리를 늘리기보다, 대상을 고르고 비교하는 순서로 호기심을 보여 준다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| C01 | 처음 놓인 장난감의 양쪽 살피기 | toy + toy-settled | 표현:sniff → 이동:toy → 실물장난감:inspect → 이동:toy-other-side(조건부) → 표현:sniff → 표현:bow → 실물장난감:play → 실물장난감:return |
| C02 | 처음 맛보는 음식 앞의 한 걸음 | food | 실물음식:inspect → 표현:shake → 이동:food → 실물음식:eat |
| C03 | 종이비행기의 도착 지점 조사 | toy | 실물장난감:inspect(paper-plane) → 실물장난감:toss(paper-plane) → 감상0.9초 → 이동:toy → 실물장난감:inspect(paper-plane) → 실물장난감:return(paper-plane) |
| C04 | TV 다섯 채널 중 한 번 비교하기 | tv | 이동:sofa → TV:nature → 감상1.4초 → TV:next → 감상3초 → 표현:bow |
| C05 | 달력이 바뀐 뒤 안전한 새 자리 하나 | layout | 표현:sniff → 이동:novel-place → 표현:stretch → 표현:bow |
| C06 | 멈춘 공을 늦게 톡 | toy + toy-settled | 감상0.5초 → 이동:toy → 실물장난감:play(ball) → 표현:bow |
| C07 | 만화경 가까이 보기 | toy | 실물장난감:inspect(kaleidoscope) → 표현:sniff → 실물장난감:return(kaleidoscope) |
| C08 | 팽이 앞 갸웃 | toy | 실물장난감:inspect(spinning-top) → 표현:bow → 실물장난감:return(spinning-top) |
| C09 | 덜 논 실물 선택 | toy | 실물장난감:inspect → 실물장난감:play → 표현:bow |
| C10 | 반대쪽으로 빼꼼 | free | 유한빼꼼:1.6초 → 표현:bow → 이동:novel-place |
| C11 | 처음 들린 소리 | music | 표현:sniff → 감상2.5초 → 표현:bow |
| C12 | 창밖 비 한 번 보기 | rain | 이동:window → 커튼:open → 감상2.2초 → 표현:stretch |
| X-C-house | 탐험둥이 · 집·TV·빛·씻기 | tv | 이동:sofa → TV:nature → 감상1.4초 → TV:toys → 감상2.6초 → 표현:bow |
| X-C-editor | 탐험둥이 · 편집하는 사람 곁 | editor-open | 표현:sniff → 표현:bow |
| X-C-music | 탐험둥이 · 실제 음악 | music | 표현:sniff → 감상2.3초 → 표현:bow |
| X-C-return-time | 탐험둥이 · 귀가·재회·시간대 | arrival | 이동:window → 커튼:open → 표현:sniff → 감상2초 → 표현:stretch |

### 애교쟁이 (affectionate)

사람과 잠깐 마음을 맞춘 뒤 만족하고 제 생활로 돌아가는 친구. 다가오는 거리와 기다림의 끝이 있어야 귀엽고 부담스럽지 않다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| A01 | 멈춘 마우스 옆의 작은 부탁 | free | 이동:pointer → 표현:ask-petting → 감상1.2초 → 표현:bow → 이동:floor |
| A02 | 실제 쓰다듬기 뒤 오래 남는 만족 | pet | 표현:lean-nuzzle → 표현:groom → 표현:bow |
| A03 | 놀던 인형을 들고 사람에게 인사 | toy | 실물장난감:inspect(duck,plush-fish) → 이동:pointer → 표현:bow → 실물장난감:play(duck,plush-fish) → 실물장난감:return(duck,plush-fish) |
| A04 | 밤의 실제 재회, 조용한 옆자리 | arrival + night | 이동:pointer → 표현:lean-nuzzle → 감상1초 → 표현:bow |
| A05 | 넘어진 뒤, 실제 안심을 기다리는 재접근 | recovered | 표현:shake → 이동:pointer → 표현:ask-petting → 감상1초 → 표현:groom → 이동:floor |
| A06 | 쿠션에서 몸 내밀기 | free | 이동:sofa → 표현:lean-nuzzle → 표현:groom |
| A07 | 한 번만 따라가기 | free | 이동:pointer → 표현:bow → 이동:floor |
| A08 | 음식보다 먼저 인사 | food | 이동:pointer → 표현:bow → 실물음식:eat |
| A09 | 음악 끝에 가까이 꾸벅 | music | 이동:pointer → 표현:bow → 감상0.8초 |
| A10 | 저장 뒤 응원 대신 곁 지키기 | work | 이동:pointer → 표현:lean-nuzzle → 감상1.2초 → 표현:bow |
| A11 | TV보다 사람 보기 | tv | 감상0.7초 → 이동:pointer → 표현:bow → 이동:sofa → 감상1.7초 |
| A12 | 교감 OFF의 조용한 인사 | free | 표현:bow → 표현:groom |
| X-A-house | 애교쟁이 · 집·TV·빛·씻기 | tv | 감상1.1초 → 이동:pointer → 표현:lean-nuzzle → 표현:bow |
| X-A-editor | 애교쟁이 · 편집하는 사람 곁 | work | 이동:pointer → 표현:lean-nuzzle → 감상0.9초 → 표현:bow |
| X-A-music | 애교쟁이 · 실제 음악 | music | 이동:pointer → 표현:bow → 감상1초 |
| X-A-return-time | 애교쟁이 · 귀가·재회·시간대 | arrival + night | 이동:pointer → 표현:lean-nuzzle → 표현:bow |

### 잠꾸러기 (sleepy)

낮은 에너지 속에서도 세상에 반응하는 친구. 영구 수면 대신 하품, 짧은 놀이, 자리 만들기와 깨어 있는 마무리로 졸음을 읽게 한다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| S01 | 잘 자려다 다시 구경하는 쿠션 의식 | free | 이동:sofa → 표현:doze-curl → 표현:cozy-nest → 수면허용·실졸음:6.5초 → 표현:stretch |
| S02 | 졸리지만 밥부터 먹는 한 끼 | food | 표현:stretch → 실물음식:inspect → 실물음식:eat → 표현:groom → 이동:sofa |
| S03 | 장난감 하나만 치우고 쉬기 | toy | 실물장난감:return → 이동:sofa → 표현:cozy-nest → 수면허용·실졸음:5.5초 |
| S04 | 달별 TV를 보다 준비하는 밤 휴식 | night | 이동:sofa → TV:moon → 감상2.2초 → 표현:doze-curl → TV:off → 전등OFF → 커튼:closed → 수면허용·실졸음:7초 → 표현:stretch |
| S05 | 깃털에 놀라 깨어나는 짧은 놀이 | toy | 실물장난감:inspect(feather) → 실물장난감:play(feather) → 표현:stretch → 실물장난감:return(feather) → 표현:bow |
| S06 | 느린 첫 인사 | arrival | 표현:stretch → 표현:bow |
| S07 | 물고기 인형 감상 | toy | 실물장난감:inspect(plush-fish) → 감상0.9초 → 실물장난감:return(plush-fish) |
| S08 | 쓰담 뒤 하품 | pet | 표현:doze-curl → 표현:stretch |
| S09 | 쉬다가 자세 바꾸기 | free | 표현:cozy-nest → 표현:stretch → 표현:groom |
| S10 | 떨어진 물건에 눈 뜨기 | toy + toy-settled | 표현:stretch → 실물장난감:inspect → 표현:bow |
| S11 | 깨어 있는 귀 반응 | free | 표현:doze-curl → 표현:stretch → 표현:bow |
| S12 | 작업 틈 스트레칭 | work | 표현:stretch → 표현:groom |
| X-S-house | 잠꾸러기 · 집·TV·빛·씻기 | night | 이동:sofa → TV:moon → 감상2.6초 → 표현:doze-curl → 수면허용·실졸음:6초 → 표현:stretch |
| X-S-editor | 잠꾸러기 · 편집하는 사람 곁 | work | 표현:stretch → 표현:groom |
| X-S-music | 잠꾸러기 · 실제 음악 | music | 표현:stretch → 수면허용·실졸음:5초(조건부) → 표현:groom |
| X-S-return-time | 잠꾸러기 · 귀가·재회·시간대 | arrival + night | 이동:sofa → 표현:doze-curl → 수면허용·실졸음:6초(조건부) → 표현:stretch |

### 깔끔이 (tidy)

주변의 실제 물건을 하나씩 제자리로 보내고 결과를 확인하는 친구. 손짓보다 정리 전후가 달라져야 한다. 깨끗한 곳에서는 짧은 몸단장으로 만족한다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| T01 | 한 물건부터 끝내는 장난감 정리 | toy | 표현:groom → 실물장난감:return → 표현:bow |
| T02 | 좋아하는 음식은 버리지 않고 보관 | food | 실물음식:tidy → 표현:groom → 표현:bow |
| T03 | 버릴 수 있는 음식만 실제 쓰레기통으로 | food | 실물음식:tidy → 표현:shake → 표현:groom |
| T04 | 정리하다 사용자가 집으면 바로 양보 | experience | 표현:bow → 실물장난감:return(조건부) → 표현:groom |
| T05 | 정리 완료 뒤 씻고 쉬는 작은 보상 | toy-returned | 이동:pad → 패드씻기:2초 → 이동:sofa → 표현:groom |
| T06 | 겹친 음식 하나 옮기기 | food | 실물음식:tidy → 표현:bow |
| T07 | 할 일이 없으면 몸단장 | free | 표현:groom → 표현:sniff → 표현:bow |
| T08 | 음식과 장난감 중 한 작업 | toy + food | 실물장난감:return → 표현:groom |
| T09 | 운반 중 새 물건은 다음 차례 | toy + toy-settled | 실물장난감:return → 표현:sniff → 표현:bow |
| T10 | 굴러도 원래 물건으로 | toy + recovered | 표현:shake → 실물장난감:return → 표현:groom |
| T11 | 음악 중에도 반납부터 | toy + music | 실물장난감:return → 표현:bow → 감상1.1초 |
| T12 | 편집 완료 뒤 내 주변 정돈 | work + toy | 실물장난감:return → 표현:groom |
| X-T-house | 깔끔이 · 집·TV·빛·씻기 | toy-returned | 이동:pad → 패드씻기:2.2초 → 표현:groom |
| X-T-editor | 깔끔이 · 편집하는 사람 곁 | work + toy | 실물장난감:return → 표현:bow |
| X-T-music | 깔끔이 · 실제 음악 | music + toy | 실물장난감:return → 표현:bow → 감상1.5초 |
| X-T-return-time | 깔끔이 · 귀가·재회·시간대 | arrival + toy | 실물장난감:return → 이동:sofa → 표현:groom |

### 사고뭉치 (mischievous)

작은 변화를 직접 만들고 그 결과를 따라가는 친구. 짧은 밀기와 추격, 놀람과 딴청이 연결되되 무한 난동과 사용자 방해는 성격으로 삼지 않는다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| M01 | 한 번 굴리고 한 번 더 바꾸는 공놀이 | toy | 실물장난감:toss(ball) → 이동:toy → 실물장난감:toss(ball) → 이동:toy → 실물장난감:return(ball) |
| M02 | 자동차를 밀고 따라잡는 작은 소동 | toy | 실물장난감:nudge(toy-car) → 이동:toy → 표현:pounce → 실물장난감:return(toy-car) |
| M03 | 사용자가 놓은 소품에 딱 한 번 덤비기 | toy + toy-settled | 표현:pounce → 실물장난감:play → 실물장난감:return |
| M04 | 정리한 상자는 건드리지 않는 딴청 | toy-returned | 표현:look → 이동:floor → 표현:pounce → 표현:bow |
| M05 | 채널 한 번 바꾸다가 조용해지는 반전 | tv | 감상1초 → TV:moon → 감상3.3초 → 표현:groom |
| M06 | 나온 블록 조금 흩어 보기 | toy | 실물장난감:toss(blocks) → 이동:toy → 실물장난감:inspect(blocks) → 표현:bow |
| M07 | 상자에서 한 개만 | free | 이동:box → 실물장난감:spawn → 실물장난감:play → 실물장난감:return |
| M08 | 먹기 전 한 번만 장난 | food | 실물음식:inspect → 표현:pounce → 실물음식:eat |
| M09 | 비행기 반대쪽 봤다가 따라가기 | toy | 실물장난감:toss(paper-plane) → 표현:look → 이동:toy → 실물장난감:inspect(paper-plane) → 실물장난감:return(paper-plane) |
| M10 | 고리 따라가다 회복 | toy + recovered | 표현:shake → 실물장난감:inspect(hoop) → 실물장난감:return(hoop) |
| M11 | 발견되면 완전히 나오기 | free | 유한빼꼼:1.7초 → 표현:bow → 이동:novel-place |
| M12 | 되돌리기 뒤 작은 갸웃 | undo | 표현:sniff → 표현:bow |
| X-M-house | 사고뭉치 · 집·TV·빛·씻기 | tv | 감상1.6초 → TV:next → 감상2.3초 → 실물장난감:play(조건부) → 실물장난감:return(조건부) |
| X-M-editor | 사고뭉치 · 편집하는 사람 곁 | undo | 표현:sniff → 표현:bow |
| X-M-music | 사고뭉치 · 실제 음악 | music + toy | 표현:pounce → 실물장난감:play → 실물장난감:return → 표현:bow |
| X-M-return-time | 사고뭉치 · 귀가·재회·시간대 | arrival | 이동:sofa → TV:moon → 감상3.3초 → 표현:groom |

### 먹보 (gourmet)

맛보기 전 기대와 먹은 뒤 만족, 남은 최애를 아끼는 선택이 또렷한 친구. 음식을 더 많이 만들어 성격을 드러내지 않고 현재 실물과 실제 경험을 소중히 다룬다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| G01 | 최애를 찾은 귀, 실제 한입의 만족 | food | 표현:bow → 실물음식:inspect → 실물음식:eat → 표현:celebrate → 표현:groom |
| G02 | 배부른 날 최애를 남겨 두기 | food | 실물음식:tidy → 표현:sniff → 표현:bow |
| G03 | 이전에 보관한 음식과 다시 만남 | food + experience | 이동:food → 표현:sniff → 실물음식:eat → 표현:celebrate |
| G04 | 새 빵과 익숙한 한 끼 사이의 결정 | food | 실물음식:compare → 실물음식:inspect → 실물음식:eat → 표현:groom |
| G05 | 식후 요리 TV, 당근 장난감은 먹지 않기 | meal | 표현:groom → 이동:sofa → TV:cooking → 감상3초 → 실물장난감:inspect(squeaky-carrot)(조건부) → 실물장난감:return(squeaky-carrot)(조건부) |
| G06 | 정착한 음식부터 보기 | food | 표현:sniff → 실물음식:eat → 표현:groom |
| G07 | 가까운 한 끼가 먼저 | food | 실물음식:eat → 표현:celebrate |
| G08 | 최애가 실제 바뀐 날 | favorite | 표현:celebrate → 실물음식:inspect(조건부) → 표현:groom |
| G09 | 음악은 먹은 다음 | music + meal | 표현:groom → 표현:bow |
| G10 | 아침 귀가의 음식 확인 | arrival + food + experience | 표현:sniff → 실물음식:eat → 표현:groom |
| G11 | 저장 성공 뒤 한입 후보 | work | 실물음식:eat(조건부) → 표현:bow |
| G12 | 음식 없는 날의 여유 | free | 표현:groom → 표현:bow → 실물장난감:inspect(조건부) → 실물장난감:return(조건부) |
| X-G-house | 먹보 · 집·TV·빛·씻기 | meal | 표현:groom → 이동:sofa → TV:cooking → 감상3초 |
| X-G-editor | 먹보 · 편집하는 사람 곁 | work | 실물음식:eat(조건부) → 표현:bow |
| X-G-music | 먹보 · 실제 음악 | music + meal | 표현:groom → 표현:bow |
| X-G-return-time | 먹보 · 귀가·재회·시간대 | arrival + food | 표현:sniff → 실물음식:eat → 표현:groom |

### 집돌이 (homebody)

방을 거점으로 깨어 있는 작은 생활을 즐기는 친구. 놀이·보관·TV·몸단장을 집 가까이에서 골고루 하고, 밖에 나가도 실제 귀가로 이야기를 닫는다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| H01 | 상자에서 꺼내 놀고 다시 집으로 | free | 이동:box → 실물장난감:spawn → 실물장난감:play → 실물장난감:return → 이동:sofa → 표현:groom |
| H02 | 밖의 좋아하는 소품을 데려오기 | toy + experience | 표현:bow → 이동:toy → 실물장난감:inspect → 실물장난감:return → 이동:sofa → 표현:groom |
| H03 | 여름 낮, 깨어 즐기는 작은 극장 | summer | 이동:sofa → 커튼:closed → 전등OFF → TV:nature → 감상3.6초 → 표현:groom |
| H04 | 접혔다 열린 집으로 실제 귀가 | layout | 이동:sofa → 표현:sniff → 표현:bow → 표현:groom |
| H05 | 쿠션·바닥·창가로 바뀌는 작은 일상 | free | 이동:sofa → 표현:groom → 이동:floor → 표현:stretch → 이동:window → 커튼:open → 감상1.8초 |
| H06 | 집 앞 기차 왕복 | toy | 실물장난감:play(train) → 이동:toy → 실물장난감:return(train) → 이동:sofa |
| H07 | 고리 쌓기 소품 감상 | toy | 실물장난감:inspect(stacking-rings) → 표현:sniff → 실물장난감:return(stacking-rings) |
| H08 | 좋아하는 음식 집 보관 | food | 실물음식:tidy → 표현:groom |
| H09 | 새로 펼친 방 둘러보기 | layout | 이동:sofa → 표현:sniff → 표현:bow |
| H10 | 익숙한 노래 한 구간 | music + experience | 이동:sofa → 감상3초 → 표현:groom |
| H11 | 새 편집 패널에 자리 양보 | layout | 이동:sofa → 표현:stretch |
| H12 | 포근히 파묻히기 후보 | free | 이동:sofa → 표현:cozy-nest → 표현:stretch → 표현:groom |
| X-H-house | 집돌이 · 집·TV·빛·씻기 | summer | 이동:sofa → 커튼:closed → 전등OFF → TV:nature → 감상3.6초 → 표현:groom |
| X-H-editor | 집돌이 · 편집하는 사람 곁 | layout | 이동:sofa → 표현:stretch |
| X-H-music | 집돌이 · 실제 음악 | music + experience | 이동:sofa → 감상3.3초 → 표현:groom |
| X-H-return-time | 집돌이 · 귀가·재회·시간대 | arrival | 이동:sofa → 표현:bow → 표현:groom → 감상1.4초 |

### 둥글이 (balanced)

상황에 어울리는 한 가지를 고르고 확실히 끝낸 뒤 다른 즐거움으로 넘어가는 친구. 여러 성격을 랜덤으로 섞거나 개성 없는 idle을 기본으로 삼는 균형형이 아니다.

| ID | 장면 | 현재 조건 신호 | 실행 순서 |
|---|---|---|---|
| B01 | 살펴보고 놀고 반납하는 생활 한 편 | toy | 실물장난감:inspect → 실물장난감:play → 실물장난감:return → 표현:bow |
| B02 | 두 번 같은 일을 했으면 다음 재미 찾기 | free | 표현:stretch → 이동:novel-place → 표현:bow → 실물장난감:inspect(조건부) → 실물장난감:return(조건부) |
| B03 | 배고픔과 새로움 사이에서 한 끼 결정 | food | 실물음식:inspect → 실물음식:eat → 표현:groom |
| B04 | 한두 개 정리한 뒤 감상으로 전환 | toy | 실물장난감:return → 이동:window → 커튼:open → 감상2.4초 → 표현:bow |
| B05 | 예상 밖의 중단에도 같은 일을 마치기 | recovered | 표현:shake → 실물장난감:return(조건부) → 실물음식:tidy(조건부) → 표현:bow |
| B06 | 공 한 번 뒤 반납 | toy | 실물장난감:play(ball) → 실물장난감:return(ball) → 표현:bow |
| B07 | 짧은 인사 뒤 양보 | free | 이동:pointer → 표현:bow → 감상0.9초 → 이동:floor |
| B08 | 쉬었다 작은 놀이 | toy | 이동:floor → 실물장난감:play → 실물장난감:return |
| B09 | 최근과 다른 소품 | toy | 실물장난감:inspect → 실물장난감:play → 실물장난감:return |
| B10 | 좋았던 교감 한 번 제안 | experience | 이동:pointer → 표현:ask-petting → 감상1초 → 표현:bow |
| B11 | 가을비 뒤 차분한 생활 | rain | 이동:window → 커튼:open → 감상1.8초 → 실물음식:tidy(조건부) → 표현:groom |
| B12 | 가장 최근 작업 완료만 응원 | work | 표현:bow → 표현:stretch |
| X-B-house | 둥글이 · 집·TV·빛·씻기 | tv | 감상1.8초 → 실물장난감:play(조건부) → 실물장난감:return(조건부) → 표현:stretch → 표현:bow |
| X-B-editor | 둥글이 · 편집하는 사람 곁 | work | 표현:bow → 표현:groom |
| X-B-music | 둥글이 · 실제 음악 | music | 표현:bow → 표현:stretch → 이동:novel-place |
| X-B-return-time | 둥글이 · 귀가·재회·시간대 | arrival + rain | 이동:window → 커튼:open → 감상1.6초 → 실물음식:tidy(조건부) → 표현:groom |

## 검증 상태와 한계

- 카탈로그: 원본108 ID/이름/순서,9성격별5대표·7소장면·4결합을 검사한다.
- 순수 디렉터:144 경로의 실제 조건/증명된 이동 끝점/명시 효과 ACK 프로토콜과 부정 조건을 검사한다. 이 호스트 검사는144개의 실제 브라우저 영상 검증을 뜻하지 않는다.
- 물리 소유자 통합: 실제 장난감 모델로 동일ID 운반·상자 전달·1개/2개 정리 제한·두 번 실제 toss·선점 취소와 실제 음식 최애/공급을 검사한다.
- 실제 검증: 최종 production-build fixture에서9성격×viewer/studio/실제 preview의 즉시 반응·20초 행동 연속성, 실제4개 정리·씻기, TV/전등/커튼·수동15초, 편집 입력/실제 성공·실패 ACK, 무클릭 공급·섭취와 기존 인근 UI 회귀를 확인했다. 서로 다른 native70건(신규38+인근32)과 unit3443/302 PASS,27선택 첫 동작 최대558.6ms/20초 내 의미 있는 행동 간격 최대4049.9ms를 확인했다. 최종 수치와 배포 증거는 [137 계획](../plans/PLAN-20261019-137-companion-personality-scenes.md)에 기록한다.
- G22: 성격 선택의 기존 고정 target/capture를 재사용하고 탐험둥이/둥글이 읽기 이름을 공용 labels에서 제공한다. 행동 타임라인·적게 쓰인 기능 양쪽 표시를 검사한다. 자동 준비·장면·TV·전등·커튼·운반·음식/장난감/학습 ID는 사용자 활동으로 전송하지 않는다.
- 새 몸 그림/9종 성격의 인간 시각 인지율, 실제 방송PC/OBS·로그인/RLS·모바일/스크린리더 증거는 이 검사의 범위가 아니다.

## 실패 보존과 복구

초기 native-1은 서버 실행 시 fixture 환경 누락으로404였으며 기능PASS로 쓰지 않았다. native-2는31 중30 PASS: studio 정리에서 몸 전용 패드 측정점을 장난감이 착지면으로 써 상자를 가린 실제 실패를 보존했다. bodyOnly 수신 제외와 실제 모델 회귀를 추가했다. 초기 전체단위3실패는 성격 이름/개수 변경2건과 기존 household 허기 우선권1건을 수정했고, 빌드에서 새 음식 selector의 false/undefined 타입 오류도 수정했다. 재검증 전 성공으로 취급하지 않았다.

후속 실제 실패·측정·교정과 독립 검수는 [137 계획의 실제 화면 기록](../plans/PLAN-20261019-137-companion-personality-scenes.md#실제-화면-실패-교정)에 보존한다.
