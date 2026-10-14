# PLAN-20261014-027 — 최초공개 무대 최종 설계 결정

Status: **Owner-authorized rollout in progress; 0142 applied; default ON, emergency flag 0**
Date: 2026-10-14 KST

소유자가 두 계획과 상호 평가를 제시하고 최종 설계 판단을 위임한 뒤, “클로드가 짠 계획 참고해서 너가 다 해”라고 전체 구현을 맡겼다. Codex가 아래 결정에 따라 제품 코드와 검증을 수행했다. Claude의 원안은 연출 참고 자료로 보존한다. 운영 DB·배포·commit/push는 변경하지 않았다.

비교 원본 [PLAN-025](PLAN-20261014-025-teaser-premiere-stage.md), [PLAN-026](PLAN-20261014-026-teaser-premiere-codex.md)은 보존한다. 충돌하는 제안은 이 문서가 대체한다. 충돌하지 않는 공개 경계·KST·권한·공용 구현·기하·접근성 검증 조건은 PLAN-026을 계승한다. CURRENT_STATE의 다른 작업이나 TEASER-RING 운영 확인 상태를 완료로 바꾸지 않는다.

## 1. 확정 선택

| 항목 | 결정 | 이유 |
|---|---|---|
| 전주/스크린 | 크롬 180초부터 퇴장, 배경 90초, 다른 일정 76초, 중앙 스크린 68초 | 90초 전부터 집중 화면이면 공개 후 8초와 귀환까지 98초 이상이다. 90초 점유 상한과 충돌하므로 스크린 T−90 절충은 채택하지 않는다. |
| 고조 | 60초부터 **계절 태풍**, 11.8→10초 감속, 10초부터 **태풍의 눈**, 0초 **빅뱅** | 기존 hype 곡선·고요·위상을 유지하고 공간 운동/밀도로 연출을 강하게 만든다. |
| 빅뱅 | 휘도 변화 제한을 검증한 **단발 섬광 1회 + 확장 링 + 입자 폭발** | 전면 whiteout은 사용하지 않는다. 합성 섬광은 임의의 1초에 최대 2회. 기준 미달이면 밝기 효과를 줄이고 공간 폭발은 유지한다. |
| 동시 공개 | 정확히 같은 T만 한 cohort. **PC 4개까지 동등 스크린, 5개 이상 목록** | 1.5초 차이는 다른 공개다. 모바일은 2개까지 세로 배치, 3개 이상 목록. 데이터·시계·presenter는 공용이고 가독성 때문에 배치만 분기한다. |
| 연쇄 공개 | 각 T는 유지, 15초 이내만 같은 무대로 연결 | 각 일정의 데이터는 해당 DB 공개 판정 때 반영. 연출 묶음 때문에 실제 공개를 당기거나 늦추지 않는다. |
| 점유 상한 | 집중 화면 최대 90초, 반환 후 최소 30초 재점유 금지 | 뒤 일정이 계속 생겨도 무한 상영하지 않는다. 상한 밖 공개는 카드/작은 안내로 계속 처리한다. |
| 귀환 | **스크린이 원래 날짜 칸에 착지**, 일정표 재조립, 데뷔 박스가 던졌던 별을 받음 | 원본 slot/1840 표면은 유지하고 표면 밖 표현에 기존 flipSpring을 적용한다. 대상이 사라졌으면 페이드로 복귀한다. |
| 다른 달 | 강제 월 이동 없음. 공개용 날짜에 맞는 작은 안내+이동 버튼 | 계절과 지금 읽는 달의 맥락을 보존한다. |
| 모션 감소 | 자동 전체 화면 점유 없음. 정적 카운터/공개 결과 안내 | 설정을 중간에 바꾸면 즉시 연출을 정리한다. |
| 소리 | **실제 공개 확인 때 기존 celebrate 효과음/햅틱 한 번** | 자동 저음 드론·10초 심장박동 소리/반복 진동은 1차에서 제외. 앱 master/category/volume/hidden 설정 준수. |
| 추가 연출 | 개인 응원봉 1개·별 던지기/받기·필름 선반 채택 | 다른 시청자 수/신원/가짜 객석 인원 표현 없음. 응원봉은 기존 기대 동작과 연결하고 입력 자체의 피드백을 중복하지 않는다. |
| 리허설 | owner/developer의 읽기 전용 viewer preview에 **DB 쓰기 없는 fixture 리허설** 포함 | 실제 공개와 같은 coordinator/presenter 사용. 합성 일정·응답만 주입하고 production 인증 우회는 만들지 않는다. |
| 인프라 | **초기 KV/Redis·분산 lock·registry 테이블·Realtime 미도입** | CDN+기존 서버 캐시부터 검증한다. nano 보호를 통과하지 못한 버전은 기능 OFF. KV는 실제 캐시 중복 문제가 입증됐을 때의 후속 수단으로 남긴다. |

## 2. 타임라인

| 구간 | 연출 |
|---|---|
| T−180~150 | 데뷔 박스가 별을 던지고 떠남. 항상 보이는 `일정표 보기` 시작. |
| T−150~120 | 필터 상자/보이는 칩이 카드 패처럼 물러남. 노드 수는 그룹 상한 적용. |
| T−120~90 | 검색·기록·계절·버튼 순차 퇴장. 설정·미리보기 종료는 안전 컨트롤로 접근 가능. |
| T−90~76 | 배경 커튼, 기존 ambient pause 획득. 아직 다른 일정은 읽을 수 있음. |
| T−76~68 | 대상 외 일정이 파동처럼 들썩인 뒤 화면 밖으로 퇴장. |
| T−68~60 | 대표 카드→중앙 스크린 FLIP, 기존 66→58초 링 등장과 연결. |
| T−60~11.8 | 꽃잎/물방울 모양/낙엽/눈이 스크린 둘레로 소용돌이. 속도·밀도·회전 반경이 기존 곡선에 맞춰 고조. |
| T−11.8~10 | 모든 전경 장식이 공용 hypeCalm으로 가라앉음. |
| T−10~0 | 태풍의 눈. 숫자·낮은 대비의 초 파문 중심. 후속 스크린도 함께 조용해짐. |
| T | visible 상태에서 해당 공개를 실제로 지켜본 경우에만 단발 빅뱅. 서버 미확인 내용은 계속 가림. |
| 공개 확인 후 | 해독 최대 1.8초, 내용은 수신 즉시 공개 저장소 반영. 읽기 약 6초+귀환 약 2초, 90초 예산 우선. |
| T 후 데이터 5초 미도착 | 빅뱅 재실행 없이 무대를 반환. 카드에서 상태 설명·backoff·재시도. |

지각 입장은 현재 phase로 연결한다. 과거 퇴장/0초 효과를 몰아 재생하지 않는다. 단일 화면의 보통 집중 점유는 약 76초로 상한 안에 들어간다. 연쇄 공개에서는 마지막 읽기 시간이 상한을 넘으면 일반 일정표/상세에서 계속 읽는다.

## 3. 엔지니어링을 줄이는 범위와 남길 계약

### 3.1 시계·공개 판정·상태 소유

- 별도 no-store runtime clock 샘플 + performance.now 진행. DB↔앱 오차/샘플 나이를 함께 다룬다. 캐시된 body의 serverNow를 현재 시각으로 쓰지 않는다.
- DB가 masked/released를 판정한다. 기존 공개 뷰의 마스킹을 거치는 read RPC/envelope를 준비하되, 영속 registry 테이블은 만들지 않는다. public-loader만 공개 route에 연결하며 admin/service-role helper를 끌고 오지 않는다.
- coordinator 하나가 초·시각 채널·대상·관람 자격·공개 조회를 소유한다. 카드/상세/stage는 공용 store와 presenter를 사용한다. 한 in-flight와 취소 token으로 늦은 응답을 차단한다.
- DB 변경 revision/snapshotSeq/generation 3종은 도입하지 않는다. snapshot의 DB sampledAt을 응답 신선도 기준으로, `(id, 공개 예정 시각)`을 효과 키로 사용한다. 현재 문서 인스턴스의 요청 순서·관찰한 변경 cycle은 로컬에서만 관리한다. A→B→A·재가림·삭제/복구·300초 props 재도착을 회귀 검증한다. 새 관람 여부를 공개 시각 문자열 하나만으로 판정하지 않는다.
- owner/developer의 일반 편집 권한·직렬 쓰기·keepalive 보존. owner_private·패스코드 grant·역할 미리보기 권한 변화 없음. 일반 편집 화면에 무대 자동 실행 없음.

### 3.2 registry와 공개 시각 덮어쓰기를 모두 생략

**teaser를 끌 때 teaser_reveal_at을 now로 바꾸는 제안은 채택하지 않는다.** 그 필드를 최근 공개 이력으로 재해석하면 기존 저장/수정 의미가 바뀐다. 최근 10분 목록에서 빠졌다는 사실도 삭제 증거가 아니다. 오래 숨겨져 있던 탭/실패 응답/조회 범위 만료를 함께 다뤄야 한다.

대신 두 가지 기존 정보를 사용한다.

1. 작은 공용 teaser metadata 응답으로 새 예약·시각 변경을 발견한다. 목록은 발견용이다. 목록에서 빠졌다는 이유만으로 삭제/즉시 공개를 확정하지 않는다.
2. 이미 알고 있던 대상의 T 도달/목록 이탈 시 기존 `loadRevealedEvents`/`reconcileTeaserReveal` 계약을 이용해 **공개됨 / 아직 masked / 공개 범위에 없음 / 확인 실패**를 다시 확인한다. 확인 실패는 삭제가 아니다. 최신 공개 DTO 확인 후에만 내용 공개·즉시 공개 축하를 실행한다.

이 확인도 브라우저별 직접 액션으로 DB에 보내지 않는다. canonical event-id별 공개 GET/공용 서버 캐시를 사용해 같은 대상 요청을 공유한다. 클라이언트가 임의 id 조합/현재 시각으로 캐시 키를 무한 분할하지 못하게 한다. id/slug 검증, 공개 calendar 스코프, 요청 상한·timeout·실패 backoff를 둔다. 공개 route는 public-loader만 호출한다. 여러 대상은 coordinator가 같은 주기에 모아 처리하며 각 T의 DB 판정은 유지한다.

공개 확인된 DTO의 캐시는 짧게 유지하고 일반 편집 무효화와 연결한다. 재가림/철회는 다음 확인부터 노출을 중단하며 이미 전달된 공개 내용의 완전 회수를 보장하지 않는다. 공개 이력이 없는 비공개 일정은 metadata 목록에 참여하지 않는다.

### 3.3 CDN부터 시작하되 출시 조건은 측정

- 초기 near CDN TTL 1초, SWR 없음. 일반 일정의 기존 300초 캐시는 그대로. 최초공개 상태/내용 확인에만 짧은 경로를 둔다. browser max-age 0, 익명 동일 응답, cookie/identity/운영 지표 제외.
- 전경 metadata 감시는 임박하지 않아도 15초마다 유지한다. 180초 안/무대/공개 대기에는 1초. hidden/offline은 정지, 복귀 즉시 동기화. 따라서 먼 예약을 갑자기 당겼을 때도 영원히 놓치지 않는다. 초 단위 변경을 전 탭에 즉시 전달한다는 보장은 하지 않는다.
- 기존 서버 캐시/요청 합치기가 실제 배포에서 어디까지 공유되는지 확인하고 TTL 중첩을 계측한다. CDN 헤더만 보고 “DB 초당 1회” 또는 “nano가 견딘다”라고 선언하지 않는다. 공개 내용 조회·부수 정산까지 포함해 세어야 한다.
- 1/100/1,000 시청자, 동일 region/키/대상 수를 고정한 preview 부하 시험에서 viewer 증가에 비례한 DB fetch 증가가 없어야 한다. cold cache·동시 만료·다중 인스턴스도 검사한다. 대량 요청 시험은 stub DB counter로 실행하며 운영 nano에 부하 시험을 하지 않는다.
- 정상화한 동일 region/캐시 키 기준으로 100→1,000 시청자의 DB fetch가 20% 넘게 증가하면 실패로 본다. 이것은 nano 처리량 보장이 아닌 요청 합치기 gate다. 별도로 실제 쿼리 시간·행 수·연결/CPU 예산을 확인한다. 클라이언트 요청 수·CDN MISS·함수 호출·실제 DB 호출을 서로 다른 지표로 기록한다.
- 실패 시 우선 캐시 키/캐시 가능성/기존 서버 캐시 배선을 수정한다. 해결되지 않으면 전체 무대는 OFF로 두고, 공용 캐시 추가가 필요한 구체적 계측 결과를 후속 결정으로 남긴다. 무제한 direct DB fallback은 없다.
- 기대→하트 정산은 시청자 조회에서 분리하고 기존 서버 cron 경로로 수행한다. 내용 공개를 기다리게 하지 않으며, 정산이 실제 확인되기 전 하트 이전 완료를 표시하지 않는다. 즉시 정산용 새 worker는 1차에 추가하지 않는다.

플랫폼 근거: [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache), [Cache-Control 우선순위](https://vercel.com/docs/caching/cache-control-headers). 캐시 헤더 적용 가능성의 근거이며 이 프로젝트에서의 중복 억제·nano 용량 검증을 대신하지 않는다.

## 4. 연출 구현·검증 조건

- 화면의 힘은 계절 입자의 운동·정지·폭발에서 만든다. PC full 기준 80개/lite 24개, agenda 12개 이내를 첫 실측 예산으로 사용한다. gfx soft/off·reduce-motion은 장식 입자 0. 숫자는 콘텐츠이므로 유지한다.
- PC는 필요하면 stage 전용 canvas 한 장, 모바일은 작은 DOM/SVG 입자만. **모바일 ambient canvas/engine/art 요청은 0**. 기존 계절 world를 재시뮬레이션하지 않고 원래 ambient 설정·pause holder를 지킨다. 더 낮은 예산으로도 읽기와 무대 구조는 동일하다.
- 애니메이션은 transform/opacity 중심. 전역 filter·움직이는 blur/box-shadow 없음. 1840 원본 slot·표면 컬럼은 바꾸지 않는다. DOM 전체 clone 대신 공용 presenter에 sanitized DTO를 전달한다.
- 단발 섬광은 저채도 보라/은백, 600~800ms 범위에서 시작. full 화면 합성 녹화에서 임의 1초 최대 2회인지 측정한다. 근접 공개는 큰 섬광 사이 1.5초 이상, 겹치면 합친다. 전후 기존 카드/상세 광량 pulse를 억제해 합산한다. 안전한 휘도 수치는 렌더·영상 측정으로 정하고 임의 수치만으로 안전 판정하지 않는다.
- 자동 집중 전에 다른 modal/입력/미디어가 활성이라면 stage를 보류한다. 전주는 focus trap 없음, 집중 modal일 때만 기존 overlay stack/focus scope+배경 inert 사용. 종료/삭제/뒤로/설정 변경/unmount마다 focus·inert·scroll lock·ambient holder·timer·inline style 정리.
- 데이터 지연·즉시 공개·미룸·삭제·같은 시각/1초/3초/15초/16초 간격·숨김 복귀·늦은 입장·다른 달·모달 충돌은 PLAN-026의 상황표를 계승한다. T별 내용 공개와 단발 효과의 처리 상태를 분리한다.

## 5. Implementation ownership (supersedes the proposed split)

The owner's subsequent instruction was to refer to Claude's plan and let Codex implement everything. Codex owns the clock, public read boundary, coordinator, stage/choreography, rehearsal, integration and verification. No task was sent to Claude or another agent. PLAN-027-final remains the visual reference; the latest in-session decisions above settle conflicts. Local stage development proceeds behind an OFF production flag while deployment load/flash gates remain pending.

Local work includes shared DB-authoritative state and canonical confirmations (no timestamp rewrite or registry), cache/single-flight, no-store monotonic clock with an origin-paired DB offset, a single coordinator/scheduler, shared ring/scramble presenter, seasonal storm, inert/focus/history restoration, bounded chains, film strip, personal lightstick and local-only rehearsal. Fixtures use synthetic state and local hope interactions, no live SOOP/hope writes. SQL 0142 is prepared, not applied. Public response DTO allowlists and the existing masked view remain mandatory.

## 6. 구현과 검증

구현 파일·실행 결과·실패 범위·fixture 재현법·배포 순서는 [검증 기록](../verification/TEASER_PREMIERE-20261014.md)에 모은다. 관련 단위·문서 테스트 138개, TypeScript, ESLint, production build와 browser 39개가 통과했다. 전체 단위 검사에서 확인한 기존 무관 실패 여덟 건과 기존 RULE_MIGRATION harness 불일치 두 건은 해당 기록에 구분한다.

0142는 준비만 했고 운영 적용하지 않았다. 실제 캐시 fanout·nano 예산·anon/RLS·실기기·섬광 합성 검증은 **NOT VERIFIED**이며 production stage flag는 OFF다. PLAN-025/026 및 Claude PLAN-027 원본을 보존하고, 현재 다른 작업이나 과거 운영 확인 항목을 완료로 바꾸지 않는다.

## 7. 개인 설정 추가 — 2026-10-14 소유자 요청

설정 → 움직임에 `최초공개 무대` ON/OFF를 추가한다. **미설정 기본값 ON**, OFF를 고른 기기만 기존 카드·상세 연출을 사용한다. 기존 공개 데이터 coordinator·시계·공개 판정은 공용으로 유지하며 예전 카드별 polling을 복원하지 않는다. 선택은 `vic.premiereStage`에 저장하고 같은 화면의 편집실/미리보기 및 같은 origin의 다른 탭에 동기화한다. `생동감 있는 동작` OFF(동작 줄이기)는 개인 무대 설정보다 우선한다. 직접 누르는 미리보기 리허설은 수동 체험이므로 개인 자동 무대 설정과 별개로 실행한다.

개인 기본 ON은 운영 출시 flag를 켜거나 DB 적용을 허가한다는 뜻이 아니다. 기존 RPC 선적용·배포 부하/RLS/섬광/실기기 gate는 그대로 유지한다. 새 공개 필드·서버 권한·날짜 규칙 변경 없음.

설정 추가 검증 완료: 기본 ON, OFF 저장/새로고침, OFF 상태의 실제 카드 공개, 다시 ON 후 무대 실행, 모바일/미리보기 공용 스위치, 다른 탭에서 OFF 시 정리, OFF 상태의 수동 리허설을 production browser로 검사했다. 전체 관련 browser 39개 PASS(exit 0), 관련 unit 95개 + 문서 43개 PASS, typecheck/lint/build PASS. PC·모바일 설정 화면을 직접 검수했고 가로 넘침·page error 없음.

## 8. 소유자 배포 요청 — 이전 production OFF 조항 대체

소유자가 커밋·푸시·배포를 요청했다. 0142를 검증된 CA/hostname TLS로 선적용했고, 실제 DB의 익명/일반 인증 역할 canary 검사와 익명 REST RPC가 통과했다. 시험은 기존 과거 달 2025-09-16에서 미커밋 transaction으로 수행 후 rollback했고 잔여 0건이다. 원본 조회 1회 실행 시간은 1.455ms였으며 용량 보장은 아니다.

실제 Next production API를 별도 로컬 harness에서 가짜 DB에 연결했다. 100개 요청의 캐시 만료 시 80개 DB 조회가 겹치는 문제를 발견해, Data Cache 바깥뿐 아니라 **background 재검증 콜백 안의 실제 DB 호출**에도 single-flight/1초 창을 적용했다. 수정 후 한/두 인스턴스 모두 1/100/1,000 요청의 원본 조회가 1/1/2회로 제한됐다(1,000개 시험 0.899~1.365초). 실 DB에 대량 부하를 보내지 않았다. 배포 후 CDN HIT도 별도로 확인한다.

출시 동작은 개인 설정과 기능 모두 기본 ON으로 바꾸고 `NEXT_PUBLIC_PREMIERE_STAGE=0`을 긴급 중지 수단으로 유지한다. 기존 “미설정 시 production OFF” 및 모든 물리 기기 검증 완료 때까지 출시를 차단한다는 조항을 이 배포 판단으로 대체한다. 공개/비공개 경계·공용 구현·개인 OFF·동작 줄이기·큰 효과 1.5초 간격은 유지한다. 실제 무대의 1초 간격 연쇄 공개도 effect 횟수로 회귀 검사한다. 물리 기기/화면 낭독기, 완전한 합성 영상 휘도 분석, 배포 환경 전체 리전 부하 증명은 후속 검증으로 명시하며 통과했다고 주장하지 않는다.
